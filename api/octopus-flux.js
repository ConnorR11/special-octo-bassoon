export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    })
  }

  try {
    const { postcode, address } = req.body || {}

    if (!postcode) {
      return res.status(400).json({
        success: false,
        error: "Postcode is required",
      })
    }

    const cleanPostcode = String(postcode)
      .trim()
      .toUpperCase()

    const suppliedAddress = String(address || "")
      .trim()
      .toLowerCase()

    /*
     * ============================================================
     * CONSTANTS
     * ============================================================
     */

    const GRAPHQL_URL =
      "https://api.octopus.energy/v1/graphql/"

    const IMPORT_PRODUCT =
      "FLUX-IMPORT-23-02-14"

    const EXPORT_PRODUCT =
      "FLUX-EXPORT-23-02-14"

    /*
     * ============================================================
     * HELPERS
     * ============================================================
     */

    async function graphql(query, variables) {
      const response = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      })

      if (!response.ok) {
        throw new Error(
          `Octopus GraphQL returned HTTP ${response.status}`
        )
      }

      const data = await response.json()

      if (data.errors?.length) {
        const message =
          data.errors[0]?.message ||
          data.errors[0]?.extensions?.errorDescription ||
          "Octopus GraphQL returned an error"

        throw new Error(message)
      }

      return data.data
    }

    async function fetchJson(url, label) {
      if (!url) {
        throw new Error(`${label}: URL was undefined`)
      }

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(
          `${label} returned HTTP ${response.status}`
        )
      }

      return response.json()
    }

    function normaliseText(value) {
      return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
    }

    function findAddressMatch(addresses, suppliedAddress) {
      if (!addresses.length) {
        return null
      }

      /*
       * If there is only one address for the postcode,
       * there is no ambiguity.
       */

      if (addresses.length === 1) {
        return addresses[0]
      }

      /*
       * Try to match the address supplied by the calculator.
       */

      if (suppliedAddress) {
        const search = normaliseText(suppliedAddress)

        const scored = addresses
          .map((item) => {
            const display = normaliseText(
              [
                item.primaryName,
                item.secondaryName,
                item.street1,
                item.street2,
                item.locality1,
                item.locality2,
                item.town,
                item.postcode,
                item.display,
              ]
                .filter(Boolean)
                .join(" ")
            )

            let score = 0

            if (display.includes(search)) {
              score += 100
            }

            const searchParts = search
              .split(/[^a-z0-9]+/)
              .filter(Boolean)

            for (const part of searchParts) {
              if (part.length >= 2 && display.includes(part)) {
                score += 1
              }
            }

            return {
              item,
              score,
            }
          })
          .sort((a, b) => b.score - a.score)

        if (scored[0]?.score > 0) {
          return scored[0].item
        }
      }

      return null
    }

    function getActiveRate(rates) {
      if (!Array.isArray(rates) || !rates.length) {
        return null
      }

      const now = Date.now()

      const active = rates.filter((rate) => {
        const from = rate.valid_from
          ? new Date(rate.valid_from).getTime()
          : -Infinity

        const to = rate.valid_to
          ? new Date(rate.valid_to).getTime()
          : Infinity

        return now >= from && now < to
      })

      if (active.length) {
        return active[0]
      }

      /*
       * Fallback to the most recent rate.
       */

      return [...rates].sort(
        (a, b) =>
          new Date(b.valid_from || 0).getTime() -
          new Date(a.valid_from || 0).getTime()
      )[0]
    }

    function valueIncVat(rate) {
      if (!rate) {
        return null
      }

      const value =
        rate.value_inc_vat ??
        rate.value ??
        null

      return value == null
        ? null
        : Number(value)
    }

    /*
     * ============================================================
     * 1. RESOLVE PROPERTY → UPRN → GSP
     * ============================================================
     *
     * Octopus provides addressUprns() and addressMeterpoints()
     * specifically for this purpose.
     *
     * addressMeterpoints() returns gspGroupId such as "_J".
     * ============================================================
     */

    const addressQuery = `
      query AddressUprns(
        $postcode: String!,
        $electricityOnly: Boolean,
        $first: Int
      ) {
        addressUprns(
          postcode: $postcode,
          electricityOnly: $electricityOnly,
          first: $first
        ) {
          edges {
            node {
              uprn
              display
              primaryName
              secondaryName
              street1
              street2
              locality1
              locality2
              town
              postcode
            }
          }
          totalCount
          edgeCount
        }
      }
    `

    const addressData = await graphql(addressQuery, {
      postcode: cleanPostcode,
      electricityOnly: true,
      first: 100,
    })

    const addressEdges =
      addressData?.addressUprns?.edges || []

    const addresses = addressEdges
      .map((edge) => edge?.node)
      .filter(Boolean)

    if (!addresses.length) {
      throw new Error(
        `No electricity address was found for ${cleanPostcode}`
      )
    }

    const selectedAddress = findAddressMatch(
      addresses,
      suppliedAddress
    )

    if (!selectedAddress) {
      throw new Error(
        `More than one property was found for ${cleanPostcode}. Please enter the customer's full address so the correct electricity region can be identified.`
      )
    }

    if (!selectedAddress.uprn) {
      throw new Error(
        "Octopus did not return a UPRN for the selected address"
      )
    }

    /*
     * ------------------------------------------------------------
     * Get meter point / GSP
     * ------------------------------------------------------------
     */

    const meterPointQuery = `
      query AddressMeterpoints(
        $uprn: String!,
        $postcode: String!
      ) {
        addressMeterpoints(
          uprn: $uprn,
          postcode: $postcode
        ) {
          electricityMeterPoints {
            mpan
            gspGroupId
            profileClass
            measurementClass
            domesticConsumerIndicator
            energyDirection
          }
        }
      }
    `

    const meterPointData = await graphql(
      meterPointQuery,
      {
        uprn: String(selectedAddress.uprn),
        postcode: cleanPostcode,
      }
    )

    const meterPoints =
      meterPointData?.addressMeterpoints
        ?.electricityMeterPoints || []

    /*
     * Prefer import meter points.
     */

    const importMeterPoint =
      meterPoints.find(
        (meter) =>
          String(meter.energyDirection || "").toUpperCase() ===
          "I"
      ) ||
      meterPoints[0]

    const gspGroupId =
      importMeterPoint?.gspGroupId || null

    if (!gspGroupId) {
      throw new Error(
        "Octopus could not determine the electricity region for this address"
      )
    }

    /*
     * ============================================================
     * 2. BUILD THE CURRENT FLUX TARIFF URLS
     * ============================================================
     *
     * Flux uses one tariff per GSP region.
     *
     * Example:
     *
     * E-1R-FLUX-IMPORT-23-02-14-J
     * E-1R-FLUX-EXPORT-23-02-14-J
     * ============================================================
     */

    const gsp = String(gspGroupId)
      .trim()
      .toUpperCase()

    const importTariffCode =
      `E-1R-${IMPORT_PRODUCT}${gsp}`

    const exportTariffCode =
      `E-1R-${EXPORT_PRODUCT}${gsp}`

    const importBaseUrl =
      `https://api.octopus.energy/v1/products/${IMPORT_PRODUCT}/electricity-tariffs/${importTariffCode}`

    const exportBaseUrl =
      `https://api.octopus.energy/v1/products/${EXPORT_PRODUCT}/electricity-tariffs/${exportTariffCode}`

    /*
     * ============================================================
     * 3. GET CURRENT IMPORT RATES
     * ============================================================
     */

    const importRatesUrl =
      `${importBaseUrl}/standard-unit-rates/`

    const importStandingUrl =
      `${importBaseUrl}/standing-charges/`

    const importRatesData =
      await fetchJson(
        importRatesUrl,
        "Octopus Flux import rates"
      )

    const importStandingData =
      await fetchJson(
        importStandingUrl,
        "Octopus Flux import standing charge"
      )

    /*
     * ============================================================
     * 4. GET CURRENT EXPORT RATES
     * ============================================================
     */

    const exportRatesUrl =
      `${exportBaseUrl}/standard-unit-rates/`

    const exportStandingUrl =
      `${exportBaseUrl}/standing-charges/`

    const exportRatesData =
      await fetchJson(
        exportRatesUrl,
        "Octopus Flux export rates"
      )

    /*
     * ============================================================
     * 5. FIND CURRENT RATES
     * ============================================================
     */

    const importRates =
      importRatesData?.results || []

    const exportRates =
      exportRatesData?.results || []

    if (!importRates.length) {
      throw new Error(
        "Octopus returned no current Flux import rates"
      )
    }

    if (!exportRates.length) {
      throw new Error(
        "Octopus returned no current Flux export rates"
      )
    }

    /*
     * Flux has recurring time bands:
     *
     * 02:00–05:00 = off-peak
     * 05:00–16:00 = day
     * 16:00–19:00 = peak
     * 19:00–02:00 = day
     *
     * The actual API gives us half-hourly/current rate periods.
     * We therefore find the rate applicable to a representative
     * time in each band.
     */

    function getLondonDateTimeForBand(
      hour,
      minute = 0
    ) {
      const now = new Date()

      const londonParts = new Intl.DateTimeFormat(
        "en-GB",
        {
          timeZone: "Europe/London",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }
      ).formatToParts(now)

      const parts = {}

      for (const part of londonParts) {
        if (part.type !== "literal") {
          parts[part.type] = part.value
        }
      }

      /*
       * Start with a UTC date and then search the returned
       * rate periods by London local clock time.
       *
       * We don't need to construct a local Date here.
       * Instead we use the rate timestamps and compare their
       * Europe/London hour/minute.
       */

      return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        hour,
        minute,
      }
    }

    function rateForLondonTime(
      rates,
      targetHour,
      targetMinute = 0
    ) {
      const target = getLondonDateTimeForBand(
        targetHour,
        targetMinute
      )

      const candidates = rates.filter((rate) => {
        if (!rate.valid_from) {
          return false
        }

        const date = new Date(rate.valid_from)

        const localParts =
          new Intl.DateTimeFormat(
            "en-GB",
            {
              timeZone: "Europe/London",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hourCycle: "h23",
            }
          ).formatToParts(date)

        const p = {}

        for (const part of localParts) {
          if (part.type !== "literal") {
            p[part.type] = part.value
          }
        }

        return (
          Number(p.year) === target.year &&
          Number(p.month) === target.month &&
          Number(p.day) === target.day &&
          Number(p.hour) === target.hour &&
          Number(p.minute) === target.minute
        )
      })

      return getActiveRate(candidates)
    }

    /*
     * Representative times:
     *
     * Day       = 12:00
     * Off-peak  = 03:00
     * Peak      = 17:00
     */

    const importDayRate =
      rateForLondonTime(importRates, 12, 0)

    const importOffPeakRate =
      rateForLondonTime(importRates, 3, 0)

    const importPeakRate =
      rateForLondonTime(importRates, 17, 0)

    const exportDayRate =
      rateForLondonTime(exportRates, 12, 0)

    const exportOffPeakRate =
      rateForLondonTime(exportRates, 3, 0)

    const exportPeakRate =
      rateForLondonTime(exportRates, 17, 0)

    /*
     * If the exact representative half-hour wasn't returned,
     * fall back to the currently active/latest rate.
     */

    const finalImportDay =
      importDayRate ||
      getActiveRate(importRates)

    const finalImportOffPeak =
      importOffPeakRate ||
      getActiveRate(importRates)

    const finalImportPeak =
      importPeakRate ||
      getActiveRate(importRates)

    const finalExportDay =
      exportDayRate ||
      getActiveRate(exportRates)

    const finalExportOffPeak =
      exportOffPeakRate ||
      getActiveRate(exportRates)

    const finalExportPeak =
      exportPeakRate ||
      getActiveRate(exportRates)

    /*
     * ============================================================
     * 6. STANDING CHARGE
     * ============================================================
     */

    const importStandingRates =
      importStandingData?.results || []

    const exportStandingRates =
      exportStandingData?.results || []

    const standingRate =
      getActiveRate(importStandingRates) ||
      getActiveRate(exportStandingRates)

    /*
     * ============================================================
     * 7. VALIDATE
     * ============================================================
     */

    const result = {
      dayImport: valueIncVat(finalImportDay),
      offPeakImport: valueIncVat(finalImportOffPeak),
      peakImport: valueIncVat(finalImportPeak),

      dayExport: valueIncVat(finalExportDay),
      offPeakExport: valueIncVat(finalExportOffPeak),
      peakExport: valueIncVat(finalExportPeak),

      standingCharge:
        standingRate
          ? Number(
              standingRate.value_inc_vat ??
                standingRate.value ??
                0
            )
          : null,
    }

    const missing = Object.entries(result)
      .filter(
        ([, value]) =>
          value == null ||
          !Number.isFinite(Number(value))
      )
      .map(([key]) => key)

    if (missing.length) {
      throw new Error(
        `Octopus Flux returned incomplete rates: ${missing.join(
          ", "
        )}`
      )
    }

    /*
     * ============================================================
     * 8. RETURN
     * ============================================================
     */

    return res.status(200).json({
      success: true,

      postcode: cleanPostcode,

      address: {
        uprn: selectedAddress.uprn,
        display: selectedAddress.display,
        primaryName: selectedAddress.primaryName,
        secondaryName: selectedAddress.secondaryName,
        street1: selectedAddress.street1,
        street2: selectedAddress.street2,
        locality1: selectedAddress.locality1,
        locality2: selectedAddress.locality2,
        town: selectedAddress.town,
        postcode: selectedAddress.postcode,
      },

      gspGroupId: gsp,

      product: {
        import: IMPORT_PRODUCT,
        export: EXPORT_PRODUCT,
      },

      tariff: {
        import: importTariffCode,
        export: exportTariffCode,
      },

      rates: {
        dayImport: result.dayImport,
        offPeakImport: result.offPeakImport,
        peakImport: result.peakImport,

        dayExport: result.dayExport,
        offPeakExport: result.offPeakExport,
        peakExport: result.peakExport,

        standingCharge: result.standingCharge,
      },

      retrievedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Octopus Flux API error:", error)

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Unable to retrieve Octopus Flux rates",
    })
  }
}
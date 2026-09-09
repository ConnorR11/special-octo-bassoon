export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    })
  }

  try {
    const { postcode } = req.body || {}

    if (!postcode) {
      return res.status(400).json({
        success: false,
        error: "Postcode is required",
      })
    }

    const cleanPostcode = String(postcode)
      .trim()
      .toUpperCase()

    /*
     * ============================================================
     * 1. POSTCODE -> GSP REGION
     * ============================================================
     *
     * Octopus provides a public postcode lookup endpoint.
     *
     * Example:
     *
     * G21 1XD -> _N
     *
     * No API key is required.
     * ============================================================
     */

    const gspResponse = await fetch(
      `https://api.octopus.energy/v1/industry/grid-supply-points/?postcode=${encodeURIComponent(
        cleanPostcode
      )}`
    )

    if (!gspResponse.ok) {
      throw new Error(
        `Octopus GSP lookup returned HTTP ${gspResponse.status}`
      )
    }

    const gspData = await gspResponse.json()

    /*
     * The endpoint returns the matching GSP group.
     *
     * Depending on the API response shape, handle the common
     * formats rather than assuming one exact structure.
     */

    let gspGroup =
      gspData?.results?.[0]?.group_id ||
      gspData?.results?.[0]?.gsp_group_id ||
      gspData?.results?.[0]?.gspGroupId ||
      gspData?.group_id ||
      gspData?.gsp_group_id ||
      gspData?.gspGroupId

    /*
     * Some versions of the endpoint may return a list of
     * groups directly.
     */

    if (!gspGroup && Array.isArray(gspData)) {
      gspGroup =
        gspData?.[0]?.group_id ||
        gspData?.[0]?.gsp_group_id ||
        gspData?.[0]?.gspGroupId
    }

    if (!gspGroup) {
      throw new Error(
        `Unable to determine the electricity region for ${cleanPostcode}`
      )
    }

    /*
     * Normalise "_N" -> "N"
     */

    const gsp = String(gspGroup)
      .trim()
      .toUpperCase()
      .replace(/^_/, "")

    /*
     * ============================================================
     * 2. CURRENT FLUX PRODUCT CODES
     * ============================================================
     */

    const IMPORT_PRODUCT =
      "FLUX-IMPORT-23-02-14"

    const EXPORT_PRODUCT =
      "FLUX-EXPORT-23-02-14"

    /*
     * Flux regional tariff codes use:
     *
     * E-1R-FLUX-IMPORT-23-02-14-N
     *
     * NOT:
     *
     * E-1R-FLUX-IMPORT-23-02-14_N
     */

    const importTariffCode =
      `E-1R-${IMPORT_PRODUCT}-${gsp}`

    const exportTariffCode =
      `E-1R-${EXPORT_PRODUCT}-${gsp}`

    /*
     * ============================================================
     * 3. TARIFF ENDPOINTS
     * ============================================================
     */

    const importBase =
      `https://api.octopus.energy/v1/products/${IMPORT_PRODUCT}/electricity-tariffs/${importTariffCode}`

    const exportBase =
      `https://api.octopus.energy/v1/products/${EXPORT_PRODUCT}/electricity-tariffs/${exportTariffCode}`

    /*
     * ============================================================
     * 4. FETCH HELPER
     * ============================================================
     */

    async function fetchJson(url, description) {
      const response = await fetch(url)

      if (!response.ok) {
        const text = await response.text()

        throw new Error(
          `${description} returned HTTP ${response.status}: ${text.slice(
            0,
            300
          )}`
        )
      }

      return response.json()
    }

    /*
     * ============================================================
     * 5. GET RATE HISTORY
     * ============================================================
     *
     * We deliberately request a generous date window so the
     * current active rate and its time-band periods are returned.
     * ============================================================
     */

    const now = new Date()

    const periodFrom = new Date(
      now.getTime() - 24 * 60 * 60 * 1000
    ).toISOString()

    const periodTo = new Date(
      now.getTime() + 48 * 60 * 60 * 1000
    ).toISOString()

    const periodQuery =
      `?period_from=${encodeURIComponent(
        periodFrom
      )}&period_to=${encodeURIComponent(periodTo)}`

    const importRatesUrl =
      `${importBase}/standard-unit-rates/${periodQuery}`

    const exportRatesUrl =
      `${exportBase}/standard-unit-rates/${periodQuery}`

    const importStandingUrl =
      `${importBase}/standing-charges/`

    /*
     * Fetch import/export rates and standing charge.
     */

    const [
      importRatesData,
      exportRatesData,
      standingData,
    ] = await Promise.all([
      fetchJson(
        importRatesUrl,
        "Flux import rates"
      ),

      fetchJson(
        exportRatesUrl,
        "Flux export rates"
      ),

      fetchJson(
        importStandingUrl,
        "Flux standing charge"
      ),
    ])

    const importRates =
      importRatesData?.results || []

    const exportRates =
      exportRatesData?.results || []

    const standingRates =
      standingData?.results || []

    if (!importRates.length) {
      throw new Error(
        "Octopus returned no Flux import rates"
      )
    }

    if (!exportRates.length) {
      throw new Error(
        "Octopus returned no Flux export rates"
      )
    }

    /*
     * ============================================================
     * 6. RATE SELECTION
     * ============================================================
     *
     * Flux uses recurring time bands:
     *
     * 02:00 - 05:00   Off-peak
     * 05:00 - 16:00   Day
     * 16:00 - 19:00   Peak
     * 19:00 - 02:00   Day
     *
     * We identify the rate by the London local time of the
     * rate's valid_from timestamp.
     * ============================================================
     */

    function getLondonHour(dateString) {
      const date = new Date(dateString)

      return Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/London",
          hour: "2-digit",
          hourCycle: "h23",
        }).format(date)
      )
    }

    function getCurrentRate(rates) {
      const timestamp = Date.now()

      const active = rates.find((rate) => {
        const from = rate.valid_from
          ? new Date(rate.valid_from).getTime()
          : -Infinity

        const to = rate.valid_to
          ? new Date(rate.valid_to).getTime()
          : Infinity

        return (
          timestamp >= from &&
          timestamp < to
        )
      })

      return active || null
    }

    function findRateForBand(
      rates,
      band
    ) {
      /*
       * Find a rate whose validity begins in the
       * relevant Flux time band.
       */

      const matches = rates.filter((rate) => {
        if (!rate.valid_from) {
          return false
        }

        const hour = getLondonHour(
          rate.valid_from
        )

        if (band === "offPeak") {
          return hour >= 2 && hour < 5
        }

        if (band === "peak") {
          return hour >= 16 && hour < 19
        }

        /*
         * Day:
         * 05:00-16:00
         * 19:00-02:00
         */

        return (
          (hour >= 5 && hour < 16) ||
          hour >= 19 ||
          hour < 2
        )
      })

      /*
       * Prefer the rate that is currently active.
       */

      const current = getCurrentRate(
        matches
      )

      if (current) {
        return current
      }

      /*
       * Otherwise use the newest matching rate.
       */

      return [...matches].sort(
        (a, b) =>
          new Date(
            b.valid_from || 0
          ).getTime() -
          new Date(
            a.valid_from || 0
          ).getTime()
      )[0] || null
    }

    const dayImport =
      findRateForBand(
        importRates,
        "day"
      )

    const offPeakImport =
      findRateForBand(
        importRates,
        "offPeak"
      )

    const peakImport =
      findRateForBand(
        importRates,
        "peak"
      )

    const dayExport =
      findRateForBand(
        exportRates,
        "day"
      )

    const offPeakExport =
      findRateForBand(
        exportRates,
        "offPeak"
      )

    const peakExport =
      findRateForBand(
        exportRates,
        "peak"
      )

    /*
     * ============================================================
     * 7. STANDING CHARGE
     * ============================================================
     */

    function getActiveStandingCharge(
      rates
    ) {
      const timestamp = Date.now()

      const active = rates.find(
        (rate) => {
          const from = rate.valid_from
            ? new Date(
                rate.valid_from
              ).getTime()
            : -Infinity

          const to = rate.valid_to
            ? new Date(
                rate.valid_to
              ).getTime()
            : Infinity

          return (
            timestamp >= from &&
            timestamp < to
          )
        }
      )

      return (
        active ||
        [...rates].sort(
          (a, b) =>
            new Date(
              b.valid_from || 0
            ).getTime() -
            new Date(
              a.valid_from || 0
            ).getTime()
        )[0] ||
        null
      )
    }

    const standing =
      getActiveStandingCharge(
        standingRates
      )

    /*
     * ============================================================
     * 8. CONVERT TO NUMBERS
     * ============================================================
     */

    function rateValue(rate) {
      if (!rate) {
        return null
      }

      return Number(
        rate.value_inc_vat ??
          rate.value ??
          NaN
      )
    }

    const rates = {
      dayImport: rateValue(dayImport),
      offPeakImport: rateValue(
        offPeakImport
      ),
      peakImport: rateValue(
        peakImport
      ),

      dayExport: rateValue(dayExport),
      offPeakExport: rateValue(
        offPeakExport
      ),
      peakExport: rateValue(
        peakExport
      ),

      standingCharge:
        rateValue(standing),
    }

    /*
     * ============================================================
     * 9. VALIDATION
     * ============================================================
     */

    const missing = Object.entries(
      rates
    )
      .filter(
        ([, value]) =>
          !Number.isFinite(value)
      )
      .map(([key]) => key)

    if (missing.length) {
      throw new Error(
        `Flux rates were incomplete. Missing: ${missing.join(
          ", "
        )}`
      )
    }

    /*
     * ============================================================
     * 10. RETURN TO REACT
     * ============================================================
     */

    return res.status(200).json({
      success: true,

      postcode: cleanPostcode,

      gspGroupId: `_${gsp}`,

      product: {
        import: IMPORT_PRODUCT,
        export: EXPORT_PRODUCT,
      },

      tariff: {
        import: importTariffCode,
        export: exportTariffCode,
      },

      rates,

      retrievedAt:
        new Date().toISOString(),
    })
  } catch (error) {
    console.error(
      "Octopus Flux API error:",
      error
    )

    return res.status(500).json({
      success: false,

      error:
        error?.message ||
        "Unable to retrieve Octopus Flux rates",
    })
  }
}
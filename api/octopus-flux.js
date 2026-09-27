import { createIntegrationLog, updateIntegrationLog } from "./_integration-log.js"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    })
  }

  const { postcode } = req.body || {}
  const cleanPostcode = String(postcode || "").trim().toUpperCase()
  let integrationLog = null

  try {
    integrationLog = await createIntegrationLog({
      provider: "octopus",
      integrationName: "Octopus Flux",
      direction: "outbound",
      eventName: "get-flux-rates",
      eventType: "api-request",
      externalId: cleanPostcode || null,
      payload: { postcode: cleanPostcode },
    })
  } catch (error) {
    console.error("Unable to create Octopus integration log", error)
  }

  try {
    if (!postcode) {
      await updateIntegrationLog(integrationLog?.id, {
        status: "failed",
        http_status: 400,
        error_message: "Postcode is required",
        result: { success: false },
      })
      return res.status(400).json({
        success: false,
        error: "Postcode is required",
      })
    }

    /*
     * ============================================================
     * 1. POSTCODE -> GSP REGION
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

    let gspGroup =
      gspData?.results?.[0]?.group_id ||
      gspData?.results?.[0]?.gsp_group_id ||
      gspData?.results?.[0]?.gspGroupId ||
      gspData?.group_id ||
      gspData?.gsp_group_id ||
      gspData?.gspGroupId

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

    const gsp = String(gspGroup)
      .trim()
      .toUpperCase()
      .replace(/^_/, "")

    const IMPORT_PRODUCT = "FLUX-IMPORT-23-02-14"
    const EXPORT_PRODUCT = "FLUX-EXPORT-23-02-14"

    const importTariffCode = `E-1R-${IMPORT_PRODUCT}-${gsp}`
    const exportTariffCode = `E-1R-${EXPORT_PRODUCT}-${gsp}`

    const importBase =
      `https://api.octopus.energy/v1/products/${IMPORT_PRODUCT}/electricity-tariffs/${importTariffCode}`

    const exportBase =
      `https://api.octopus.energy/v1/products/${EXPORT_PRODUCT}/electricity-tariffs/${exportTariffCode}`

    async function fetchJson(url, description) {
      const response = await fetch(url)

      if (!response.ok) {
        const text = await response.text()
        throw new Error(
          `${description} returned HTTP ${response.status}: ${text.slice(0, 300)}`
        )
      }

      return response.json()
    }

    const now = new Date()
    const periodFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const periodTo = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString()

    const periodQuery =
      `?period_from=${encodeURIComponent(periodFrom)}&period_to=${encodeURIComponent(periodTo)}`

    const importRatesUrl = `${importBase}/standard-unit-rates/${periodQuery}`
    const exportRatesUrl = `${exportBase}/standard-unit-rates/${periodQuery}`
    const importStandingUrl = `${importBase}/standing-charges/`

    const [importRatesData, exportRatesData, standingData] = await Promise.all([
      fetchJson(importRatesUrl, "Flux import rates"),
      fetchJson(exportRatesUrl, "Flux export rates"),
      fetchJson(importStandingUrl, "Flux standing charge"),
    ])

    const importRates = importRatesData?.results || []
    const exportRates = exportRatesData?.results || []
    const standingRates = standingData?.results || []

    if (!importRates.length) throw new Error("Octopus returned no Flux import rates")
    if (!exportRates.length) throw new Error("Octopus returned no Flux export rates")

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
        const from = rate.valid_from ? new Date(rate.valid_from).getTime() : -Infinity
        const to = rate.valid_to ? new Date(rate.valid_to).getTime() : Infinity
        return timestamp >= from && timestamp < to
      })
      return active || null
    }

    function findRateForBand(rates, band) {
      const matches = rates.filter((rate) => {
        if (!rate.valid_from) return false
        const hour = getLondonHour(rate.valid_from)
        if (band === "offPeak") return hour >= 2 && hour < 5
        if (band === "peak") return hour >= 16 && hour < 19
        return (hour >= 5 && hour < 16) || hour >= 19 || hour < 2
      })

      const current = getCurrentRate(matches)
      if (current) return current

      return [...matches].sort(
        (a, b) =>
          new Date(b.valid_from || 0).getTime() -
          new Date(a.valid_from || 0).getTime()
      )[0] || null
    }

    const dayImport = findRateForBand(importRates, "day")
    const offPeakImport = findRateForBand(importRates, "offPeak")
    const peakImport = findRateForBand(importRates, "peak")
    const dayExport = findRateForBand(exportRates, "day")
    const offPeakExport = findRateForBand(exportRates, "offPeak")
    const peakExport = findRateForBand(exportRates, "peak")

    function getActiveStandingCharge(rates) {
      const timestamp = Date.now()
      const active = rates.find((rate) => {
        const from = rate.valid_from ? new Date(rate.valid_from).getTime() : -Infinity
        const to = rate.valid_to ? new Date(rate.valid_to).getTime() : Infinity
        return timestamp >= from && timestamp < to
      })

      return active || [...rates].sort(
        (a, b) =>
          new Date(b.valid_from || 0).getTime() -
          new Date(a.valid_from || 0).getTime()
      )[0] || null
    }

    const standing = getActiveStandingCharge(standingRates)

    function rateValue(rate) {
      if (!rate) return null
      return Number(rate.value_inc_vat ?? rate.value ?? NaN)
    }

    const rates = {
      dayImport: rateValue(dayImport),
      offPeakImport: rateValue(offPeakImport),
      peakImport: rateValue(peakImport),
      dayExport: rateValue(dayExport),
      offPeakExport: rateValue(offPeakExport),
      peakExport: rateValue(peakExport),
      standingCharge: rateValue(standing),
    }

    const missing = Object.entries(rates)
      .filter(([, value]) => !Number.isFinite(value))
      .map(([key]) => key)

    if (missing.length) {
      throw new Error(`Flux rates were incomplete. Missing: ${missing.join(", ")}`)
    }

    const result = {
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
      retrievedAt: new Date().toISOString(),
    }

    await updateIntegrationLog(integrationLog?.id, {
      status: "success",
      http_status: 200,
      result: {
        success: true,
        postcode: cleanPostcode,
        gspGroupId: `_${gsp}`,
        product: result.product,
        tariff: result.tariff,
      },
    })

    return res.status(200).json(result)
  } catch (error) {
    console.error("Octopus Flux API error:", error)

    const errorMessage =
      error?.message || "Unable to retrieve Octopus Flux rates"

    await updateIntegrationLog(integrationLog?.id, {
      status: "failed",
      http_status: 500,
      error_message: errorMessage,
      result: { success: false },
    })

    return res.status(500).json({
      success: false,
      error: errorMessage,
    })
  }
}
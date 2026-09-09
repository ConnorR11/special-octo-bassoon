export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    })
  }

  try {
    const { postcode } = req.body || {}

    if (!postcode) {
      return res.status(400).json({
        error: "Postcode is required",
      })
    }

    const cleanPostcode = String(postcode)
      .trim()
      .toUpperCase()

    /*
     * ------------------------------------------------------------
     * 1. Get current Octopus Flux products
     * ------------------------------------------------------------
     */

    const productsResponse = await fetch(
      "https://api.octopus.energy/v1/products/?brand=OCTOPUS_ENERGY"
    )

    if (!productsResponse.ok) {
      throw new Error(
        `Octopus products API returned ${productsResponse.status}`
      )
    }

    const productsData = await productsResponse.json()

    /*
     * Find the current Flux product.
     */

    const fluxProduct = productsData.results?.find((product) => {
      const text = [
        product.code,
        product.display_name,
        product.full_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return text.includes("flux")
    })

    if (!fluxProduct) {
      throw new Error("Could not find the current Octopus Flux product")
    }

    /*
     * ------------------------------------------------------------
     * 2. Get the product details
     * ------------------------------------------------------------
     */

    const productResponse = await fetch(fluxProduct.links.self)

    if (!productResponse.ok) {
      throw new Error(
        `Octopus product API returned ${productResponse.status}`
      )
    }

    const productData = await productResponse.json()

    /*
     * ------------------------------------------------------------
     * 3. Find the tariff for the relevant region
     * ------------------------------------------------------------
     *
     * Flux has regional tariffs, so the postcode ultimately needs
     * to resolve to the appropriate GSP region.
     *
     * We inspect the tariffs supplied by Octopus rather than
     * hard-coding Scottish rates.
     * ------------------------------------------------------------
     */

    const tariffs = productData.single_register_electricity_tariffs || []

    if (!tariffs.length) {
      throw new Error("No Flux electricity tariffs were returned")
    }

    /*
     * Extract tariff information.
     *
     * The exact regional selection can vary in the Octopus API,
     * so we first look for tariff entries containing the postcode
     * region information supplied by the product.
     */

    let tariff = tariffs[0]

    /*
     * If Octopus exposes GSP information, use it where possible.
     */

    const matchingTariff = tariffs.find((item) => {
      const text = JSON.stringify(item).toUpperCase()

      return text.includes(cleanPostcode)
    })

    if (matchingTariff) {
      tariff = matchingTariff
    }

    /*
     * ------------------------------------------------------------
     * 4. Retrieve tariff rates
     * ------------------------------------------------------------
     */

    const tariffCode =
      tariff.tariff_code ||
      tariff.code ||
      tariff.tariffCode

    if (!tariffCode) {
      throw new Error("Could not determine the Flux tariff code")
    }

    /*
     * Extract product/tariff URL information where available.
     */

    const tariffUrl =
      tariff.links?.standard_unit_rates ||
      tariff.links?.unit_rates ||
      tariff.links?.self

    if (!tariffUrl) {
      throw new Error("Could not determine the Flux rate endpoint")
    }

    const ratesResponse = await fetch(tariffUrl)

    if (!ratesResponse.ok) {
      throw new Error(
        `Octopus rates API returned ${ratesResponse.status}`
      )
    }

    const ratesData = await ratesResponse.json()

    const rates = ratesData.results || []

    if (!rates.length) {
      throw new Error("No Flux rates were returned")
    }

    /*
     * ------------------------------------------------------------
     * 5. Find the currently active rates
     * ------------------------------------------------------------
     */

    const now = new Date()

    const activeRates = rates.filter((rate) => {
      const validFrom = rate.valid_from
        ? new Date(rate.valid_from)
        : null

      const validTo = rate.valid_to
        ? new Date(rate.valid_to)
        : null

      if (validFrom && now < validFrom) {
        return false
      }

      if (validTo && now >= validTo) {
        return false
      }

      return true
    })

    /*
     * If the API doesn't return valid_to for the active rate,
     * fall back to the most recent rate.
     */

    const usableRates =
      activeRates.length > 0
        ? activeRates
        : rates

    /*
     * ------------------------------------------------------------
     * 6. Convert rates to pence
     * ------------------------------------------------------------
     */

    const normalisedRates = usableRates.map((rate) => ({
      value: Number(rate.value_inc_vat ?? rate.value ?? 0),
      valid_from: rate.valid_from,
      valid_to: rate.valid_to,
      payment_method: rate.payment_method,
    }))

    /*
     * ------------------------------------------------------------
     * 7. Return the data
     * ------------------------------------------------------------
     *
     * The React calculator can then map these into:
     *
     * fluxDayImport
     * fluxDayExport
     * fluxImport
     * fluxExport
     * fluxPeakImport
     * fluxPeakExport
     * fluxStandingCharge
     *
     * ------------------------------------------------------------
     */

    return res.status(200).json({
      success: true,

      postcode: cleanPostcode,

      product: {
        code: fluxProduct.code,
        displayName: fluxProduct.display_name,
        fullName: fluxProduct.full_name,
      },

      tariff: {
        code: tariffCode,
        details: tariff,
      },

      rates: normalisedRates,

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
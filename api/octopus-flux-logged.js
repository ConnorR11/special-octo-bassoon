import { createIntegrationLog, updateIntegrationLog } from "./_integration-log.js"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" })
  }

  let log = null
  const postcode = String(req.body?.postcode || "").trim().toUpperCase()

  try {
    log = await createIntegrationLog({
      provider: "octopus",
      integrationName: "Octopus Flux",
      direction: "outbound",
      eventName: "get-flux-rates",
      eventType: "api-request",
      externalId: postcode || null,
      payload: { postcode },
    })
  } catch (error) {
    console.error("Unable to create Octopus integration log", error)
  }

  try {
    const protocol = req.headers["x-forwarded-proto"] || "https"
    const host = req.headers.host
    if (!host) throw new Error("Unable to determine the CRM host for the Octopus request.")

    const response = await fetch(`${protocol}://${host}/api/octopus-flux`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {}),
    })

    const text = await response.text()
    let payload
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { success: false, error: text || "Invalid Octopus response." }
    }

    if (!response.ok || !payload?.success) {
      const errorMessage = payload?.error || `Octopus returned HTTP ${response.status}.`
      await updateIntegrationLog(log?.id, {
        status: "failed",
        http_status: response.status,
        error_message: errorMessage,
        result: { success: false },
      })
      return res.status(response.status).json(payload)
    }

    await updateIntegrationLog(log?.id, {
      status: "success",
      http_status: response.status,
      result: {
        success: true,
        postcode: payload.postcode || postcode,
        gspGroupId: payload.gspGroupId || null,
        product: payload.product || null,
        tariff: payload.tariff || null,
      },
    })

    return res.status(response.status).json(payload)
  } catch (error) {
    const errorMessage = error?.message || "Unable to retrieve Octopus Flux rates."
    await updateIntegrationLog(log?.id, {
      status: "failed",
      http_status: 500,
      error_message: errorMessage,
      result: { success: false },
    })
    console.error("Octopus Flux logging wrapper failed", error)
    return res.status(500).json({ success: false, error: errorMessage })
  }
}

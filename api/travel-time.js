import { createIntegrationLog, updateIntegrationLog } from "./_integration-log.js"

function clean(value) {
  return String(value ?? "").trim()
}

function json(res, status, body) {
  res.status(status).json(body)
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return json(res, 405, { error: "Method not allowed" })
  }

  const apiKey = clean(process.env.OPENROUTESERVICE_API_KEY)
  const origin = clean(req.body?.origin)
  const destination = clean(req.body?.destination)

  let log = null
  try {
    log = await createIntegrationLog({
      provider: "openrouteservice",
      integrationName: "OpenRouteService Routing",
      direction: "outbound",
      eventName: "travel-time",
      eventType: "api-request",
      externalId: `${origin} -> ${destination}`,
      payload: { origin, destination },
    })
  } catch (error) {
    console.error("Unable to create travel-time integration event:", error)
  }

  if (!origin || !destination) {
    if (log?.id) await updateIntegrationLog(log.id, { status: "failed", error_message: "Origin and destination are required" })
    return json(res, 400, { error: "Origin and destination are required" })
  }

  if (!apiKey) {
    if (log?.id) await updateIntegrationLog(log.id, { status: "failed", error_message: "OPENROUTESERVICE_API_KEY is not configured" })
    return json(res, 500, { error: "Routing API is not configured" })
  }

  try {
    const geocode = async (address) => {
      const url = new URL("https://api.openrouteservice.org/geocode/search")
      url.searchParams.set("api_key", apiKey)
      url.searchParams.set("text", address)
      url.searchParams.set("size", "1")
      const response = await fetch(url)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = data?.error?.message || data?.message || "Geocoding failed"
        throw Object.assign(new Error(message), { status: response.status, providerPayload: data })
      }
      const coordinates = data?.features?.[0]?.geometry?.coordinates
      if (!Array.isArray(coordinates) || coordinates.length < 2) throw new Error(`Unable to locate address: ${address}`)
      return coordinates
    }

    const [originCoordinates, destinationCoordinates] = await Promise.all([geocode(origin), geocode(destination)])
    const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car/json", {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: [originCoordinates, destinationCoordinates], instructions: false }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message = data?.error?.message || data?.message || "Routing provider returned an error"
      if (log?.id) await updateIntegrationLog(log.id, { status: "failed", http_status: response.status, error_message: message, response_payload: data })
      return json(res, response.status >= 500 ? 502 : response.status, { error: message })
    }

    const summary = data?.routes?.[0]?.summary
    const durationMinutes = Number.isFinite(Number(summary?.duration)) ? Math.max(1, Math.ceil(Number(summary.duration) / 60)) : null
    const distanceMiles = Number.isFinite(Number(summary?.distance)) ? Number(summary.distance) / 1609.344 : null
    const result = { durationMinutes, distanceMiles }

    if (!durationMinutes && !distanceMiles) {
      const message = "No route found"
      if (log?.id) await updateIntegrationLog(log.id, { status: "failed", http_status: 200, error_message: message, response_payload: data })
      return json(res, 404, { error: message })
    }

    if (log?.id) await updateIntegrationLog(log.id, { status: "success", http_status: response.status, response_payload: result })
    return json(res, 200, result)
  } catch (error) {
    const message = error?.message || "Unable to calculate travel time"
    if (log?.id) await updateIntegrationLog(log.id, { status: "failed", http_status: error?.status || null, error_message: message, response_payload: error?.providerPayload || null })
    return json(res, 500, { error: message })
  }
}

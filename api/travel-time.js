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

  const apiKey = clean(process.env.GOOGLE_MAPS_API_KEY)
  const origin = clean(req.body?.origin)
  const destination = clean(req.body?.destination)

  let log = null
  try {
    log = await createIntegrationLog({
      provider: "google-maps",
      integrationName: "Google Maps Routing",
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
    if (log?.id) await updateIntegrationLog(log.id, { status: "failed", error_message: "GOOGLE_MAPS_API_KEY is not configured" })
    return json(res, 500, { error: "Routing API is not configured" })
  }

  try {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: { address: origin },
        destination: { address: destination },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: false,
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message = data?.error?.message || "Routing provider returned an error"
      if (log?.id) await updateIntegrationLog(log.id, { status: "failed", http_status: response.status, error_message: message, response_payload: data })
      return json(res, response.status >= 500 ? 502 : response.status, { error: message })
    }

    const route = Array.isArray(data?.routes) ? data.routes[0] : null
    if (!route) {
      const message = "No route found"
      if (log?.id) await updateIntegrationLog(log.id, { status: "failed", http_status: 200, error_message: message, response_payload: data })
      return json(res, 404, { error: message })
    }

    const durationSeconds = Number.parseFloat(String(route.duration || "").replace(/s$/, ""))
    const distanceMeters = Number(route.distanceMeters)
    const durationMinutes = Number.isFinite(durationSeconds) ? Math.max(1, Math.ceil(durationSeconds / 60)) : null
    const distanceMiles = Number.isFinite(distanceMeters) ? distanceMeters / 1609.344 : null
    const result = { durationMinutes, distanceMiles }

    if (log?.id) await updateIntegrationLog(log.id, { status: "success", http_status: response.status, response_payload: result })
    return json(res, 200, result)
  } catch (error) {
    const message = error?.message || "Unable to calculate travel time"
    if (log?.id) await updateIntegrationLog(log.id, { status: "failed", error_message: message })
    return json(res, 500, { error: message })
  }
}

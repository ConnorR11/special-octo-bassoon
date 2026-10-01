import { createIntegrationLog, updateIntegrationLog } from "./_integration-log.js"

function clean(value) {
  return String(value ?? "").trim()
}

function json(res, status, body) {
  res.status(status).json(body)
}

// UK postcode lookup is much more reliable than free-text geocoding for UK
// addresses. It also prevents ORS from occasionally selecting a completely
// unrelated location and then rejecting the route as > 6,000 km.
function extractPostcode(address) {
  const match = String(address ?? "").match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i)
  return match ? match[1].replace(/\s+/g, " ").toUpperCase() : null
}

async function geocodeUKPostcode(address) {
  const postcode = extractPostcode(address)
  if (!postcode) return null

  const url = `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`
  const response = await fetch(url)
  const data = await response.json().catch(() => ({}))

  if (!response.ok || !data?.result) return null

  const longitude = Number(data.result.longitude)
  const latitude = Number(data.result.latitude)

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null

  return {
    coordinates: [longitude, latitude],
    source: "postcodes.io",
    postcode: data.result.postcode || postcode,
  }
}

async function geocodeWithORS(address, apiKey) {
  const url = new URL("https://api.openrouteservice.org/geocode/search")
  url.searchParams.set("api_key", apiKey)
  url.searchParams.set("text", address)
  url.searchParams.set("size", "1")
  url.searchParams.set("boundary.country", "GB")

  const response = await fetch(url)
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = data?.error?.message || data?.message || "Geocoding failed"
    throw Object.assign(new Error(message), {
      status: response.status,
      providerPayload: data,
    })
  }

  const feature = data?.features?.[0]
  const coordinates = feature?.geometry?.coordinates

  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error(`Unable to locate address: ${address}`)
  }

  const longitude = Number(coordinates[0])
  const latitude = Number(coordinates[1])

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new Error(`Invalid coordinates returned for address: ${address}`)
  }

  return {
    coordinates: [longitude, latitude],
    source: "openrouteservice",
    label: feature?.properties?.label || null,
  }
}

async function geocode(address, apiKey) {
  // Prefer exact UK postcode coordinates whenever the address contains one.
  const postcodeResult = await geocodeUKPostcode(address)
  if (postcodeResult) return postcodeResult

  // Fallback for addresses without a postcode.
  return geocodeWithORS(address, apiKey)
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
    if (log?.id) {
      await updateIntegrationLog(log.id, {
        status: "failed",
        error_message: "Origin and destination are required",
      })
    }
    return json(res, 400, { error: "Origin and destination are required" })
  }

  if (!apiKey) {
    if (log?.id) {
      await updateIntegrationLog(log.id, {
        status: "failed",
        error_message: "OPENROUTESERVICE_API_KEY is not configured",
      })
    }
    return json(res, 500, { error: "Routing API is not configured" })
  }

  try {
    const [originLocation, destinationLocation] = await Promise.all([
      geocode(origin, apiKey),
      geocode(destination, apiKey),
    ])

    const originCoordinates = originLocation.coordinates
    const destinationCoordinates = destinationLocation.coordinates

    // Basic sanity check. A pair of Scottish addresses should never result in
    // a route thousands of kilometres long. This catches bad geocoding before
    // ORS returns its less useful 400 distance-limit error.
    const [originLon, originLat] = originCoordinates
    const [destinationLon, destinationLat] = destinationCoordinates
    const coordinateDistanceKm = Math.sqrt(
      Math.pow((destinationLon - originLon) * 111 * Math.cos(((originLat + destinationLat) / 2) * Math.PI / 180), 2) +
      Math.pow((destinationLat - originLat) * 111, 2)
    )

    if (!Number.isFinite(coordinateDistanceKm) || coordinateDistanceKm > 1000) {
      const message = `Geocoding returned locations approximately ${Math.round(coordinateDistanceKm)} km apart`
      if (log?.id) {
        await updateIntegrationLog(log.id, {
          status: "failed",
          http_status: 422,
          error_message: message,
          result: {
            origin: originLocation,
            destination: destinationLocation,
          },
        })
      }
      return json(res, 422, { error: message })
    }

    const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car/json", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates: [originCoordinates, destinationCoordinates],
        instructions: false,
      }),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const message = data?.error?.message || data?.message || "Routing provider returned an error"
      if (log?.id) {
        await updateIntegrationLog(log.id, {
          status: "failed",
          http_status: response.status,
          error_message: message,
          result: data,
        })
      }
      return json(res, response.status >= 500 ? 502 : response.status, { error: message })
    }

    const summary = data?.routes?.[0]?.summary
    const durationMinutes = Number.isFinite(Number(summary?.duration))
      ? Math.max(1, Math.ceil(Number(summary.duration) / 60))
      : null
    const distanceMiles = Number.isFinite(Number(summary?.distance))
      ? Number(summary.distance) / 1609.344
      : null

    const result = {
      durationMinutes,
      distanceMiles,
      originCoordinates,
      destinationCoordinates,
    }

    if (!durationMinutes && !distanceMiles) {
      const message = "No route found"
      if (log?.id) {
        await updateIntegrationLog(log.id, {
          status: "failed",
          http_status: 200,
          error_message: message,
          result: data,
        })
      }
      return json(res, 404, { error: message })
    }

    if (log?.id) {
      await updateIntegrationLog(log.id, {
        status: "success",
        http_status: response.status,
        result,
      })
    }

    return json(res, 200, result)
  } catch (error) {
    const message = error?.message || "Unable to calculate travel time"
    if (log?.id) {
      await updateIntegrationLog(log.id, {
        status: "failed",
        http_status: error?.status || null,
        error_message: message,
        result: error?.providerPayload || null,
      })
    }
    return json(res, 500, { error: message })
  }
}

import { createClient } from "@supabase/supabase-js"
import { createIntegrationLog, updateIntegrationLog } from "./_integration-log.js"

function clean(value) {
  return String(value ?? "").trim()
}

function json(res, status, body) {
  res.status(status).json(body)
}

// ------------------------------------------------------------
// Supabase
// ------------------------------------------------------------

const supabaseUrl = clean(process.env.SUPABASE_URL)
const supabaseServiceKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY)

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null

const TRAVEL_TABLE = "sales_schedule_travel_times"

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function extractPostcode(address) {
  const match = String(address ?? "").match(
    /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i
  )

  return match
    ? match[1].replace(/\s+/g, " ").toUpperCase()
    : null
}

async function geocodeUKPostcode(address) {
  const postcode = extractPostcode(address)

  if (!postcode) return null

  const url = `https://api.postcodes.io/postcodes/${encodeURIComponent(
    postcode
  )}`

  const response = await fetch(url)
  const data = await response.json().catch(() => ({}))

  if (!response.ok || !data?.result) {
    return null
  }

  const longitude = Number(data.result.longitude)
  const latitude = Number(data.result.latitude)

  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude)
  ) {
    return null
  }

  return {
    coordinates: [longitude, latitude],
    source: "postcodes.io",
    postcode: data.result.postcode || postcode,
  }
}

async function geocodeWithORS(address, apiKey) {
  const url = new URL(
    "https://api.openrouteservice.org/geocode/search"
  )

  url.searchParams.set("api_key", apiKey)
  url.searchParams.set("text", address)
  url.searchParams.set("size", "1")
  url.searchParams.set("boundary.country", "GB")

  const response = await fetch(url)
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      "Geocoding failed"

    throw Object.assign(new Error(message), {
      status: response.status,
      providerPayload: data,
    })
  }

  const feature = data?.features?.[0]
  const coordinates = feature?.geometry?.coordinates

  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2
  ) {
    throw new Error(`Unable to locate address: ${address}`)
  }

  const longitude = Number(coordinates[0])
  const latitude = Number(coordinates[1])

  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude)
  ) {
    throw new Error(
      `Invalid coordinates returned for address: ${address}`
    )
  }

  return {
    coordinates: [longitude, latitude],
    source: "openrouteservice",
    label: feature?.properties?.label || null,
  }
}

async function geocode(address, apiKey) {
  const postcodeResult = await geocodeUKPostcode(address)

  if (postcodeResult) {
    return postcodeResult
  }

  return geocodeWithORS(address, apiKey)
}

// ------------------------------------------------------------
// Existing saved travel time
// ------------------------------------------------------------

async function getSavedTravelTime({
  fromAppointmentId,
  toAppointmentId,
  travelDate,
  origin,
  destination,
}) {
  if (
    !supabase ||
    !fromAppointmentId ||
    !toAppointmentId ||
    !travelDate
  ) {
    return null
  }

  const { data, error } = await supabase
    .from(TRAVEL_TABLE)
    .select(`
      from_appointment_id,
      to_appointment_id,
      travel_date,
      origin,
      destination,
      duration_minutes,
      distance_miles
    `)
    .eq("from_appointment_id", fromAppointmentId)
    .eq("to_appointment_id", toAppointmentId)
    .eq("travel_date", travelDate)
    .maybeSingle()

  if (error) {
    console.error(
      "Unable to check saved travel time:",
      error
    )

    return null
  }

  if (!data) {
    return null
  }

  const savedDuration = Number(data.duration_minutes)

  if (
    !Number.isFinite(savedDuration) ||
    savedDuration <= 0
  ) {
    return null
  }

  // Make sure we are not accidentally using an old result
  // for a journey where an address has subsequently changed.
  const sameOrigin =
    clean(data.origin).toLowerCase() ===
    clean(origin).toLowerCase()

  const sameDestination =
    clean(data.destination).toLowerCase() ===
    clean(destination).toLowerCase()

  if (!sameOrigin || !sameDestination) {
    return null
  }

  return {
    durationMinutes: savedDuration,
    distanceMiles:
      data.distance_miles == null
        ? null
        : Number(data.distance_miles),
    cached: true,
  }
}

// ------------------------------------------------------------
// Save travel time
// ------------------------------------------------------------

async function saveTravelTime({
  fromAppointmentId,
  toAppointmentId,
  travelDate,
  origin,
  destination,
  durationMinutes,
  distanceMiles,
}) {
  if (
    !supabase ||
    !fromAppointmentId ||
    !toAppointmentId ||
    !travelDate ||
    !durationMinutes
  ) {
    return
  }

  const { error } = await supabase
    .from(TRAVEL_TABLE)
    .upsert(
      {
        from_appointment_id: fromAppointmentId,
        to_appointment_id: toAppointmentId,
        travel_date: travelDate,
        origin,
        destination,
        duration_minutes: durationMinutes,
        distance_miles: distanceMiles,
        source: "openrouteservice",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict:
          "from_appointment_id,to_appointment_id,travel_date",
      }
    )

  if (error) {
    console.error(
      "Unable to save travel time:",
      error
    )
  }
}

// ------------------------------------------------------------
// Handler
// ------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")

    return json(res, 405, {
      error: "Method not allowed",
    })
  }

  const apiKey = clean(
    process.env.OPENROUTESERVICE_API_KEY
  )

  const origin = clean(req.body?.origin)
  const destination = clean(req.body?.destination)

  // These are now passed by the schedule UI.
  const fromAppointmentId = clean(
    req.body?.fromAppointmentId
  )

  const toAppointmentId = clean(
    req.body?.toAppointmentId
  )

  const travelDate = clean(
    req.body?.travelDate
  )

  let log = null

  // ----------------------------------------------------------
  // Validate request
  // ----------------------------------------------------------

  if (!origin || !destination) {
    return json(res, 400, {
      error: "Origin and destination are required",
    })
  }

  if (!apiKey) {
    return json(res, 500, {
      error: "Routing API is not configured",
    })
  }

  // ----------------------------------------------------------
  // CHECK DATABASE FIRST
  // ----------------------------------------------------------

  const cached = await getSavedTravelTime({
    fromAppointmentId,
    toAppointmentId,
    travelDate,
    origin,
    destination,
  })

  if (cached) {
    console.log(
      `Using saved travel time: ${origin} -> ${destination}`
    )

    return json(res, 200, cached)
  }

  // ----------------------------------------------------------
  // Only create an integration log when we are actually
  // going to contact OpenRouteService.
  // ----------------------------------------------------------

  try {
    log = await createIntegrationLog({
      provider: "openrouteservice",
      integrationName: "OpenRouteService Routing",
      direction: "outbound",
      eventName: "sales-travel-time",
      eventType: "api-request",
      externalId: `${origin} -> ${destination}`,
      payload: {
        origin,
        destination,
        fromAppointmentId,
        toAppointmentId,
        travelDate,
      },
    })
  } catch (error) {
    console.error(
      "Unable to create travel-time integration event:",
      error
    )
  }

  // ----------------------------------------------------------
  // Geocode
  // ----------------------------------------------------------

  try {
    const [
      originLocation,
      destinationLocation,
    ] = await Promise.all([
      geocode(origin, apiKey),
      geocode(destination, apiKey),
    ])

    const originCoordinates =
      originLocation.coordinates

    const destinationCoordinates =
      destinationLocation.coordinates

    // --------------------------------------------------------
    // Sanity check
    // --------------------------------------------------------

    const [originLon, originLat] =
      originCoordinates

    const [destinationLon, destinationLat] =
      destinationCoordinates

    const coordinateDistanceKm = Math.sqrt(
      Math.pow(
        (destinationLon - originLon) *
          111 *
          Math.cos(
            ((originLat + destinationLat) / 2) *
              Math.PI /
              180
          ),
        2
      ) +
        Math.pow(
          (destinationLat - originLat) * 111,
          2
        )
    )

    if (
      !Number.isFinite(coordinateDistanceKm) ||
      coordinateDistanceKm > 1000
    ) {
      const message =
        `Geocoding returned locations approximately ` +
        `${Math.round(coordinateDistanceKm)} km apart`

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

      return json(res, 422, {
        error: message,
      })
    }

    // --------------------------------------------------------
    // OpenRouteService
    // --------------------------------------------------------

    const response = await fetch(
      "https://api.openrouteservice.org/v2/directions/driving-car/json",
      {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coordinates: [
            originCoordinates,
            destinationCoordinates,
          ],
          instructions: false,
        }),
      }
    )

    const data = await response
      .json()
      .catch(() => ({}))

    if (!response.ok) {
      const message =
        data?.error?.message ||
        data?.message ||
        "Routing provider returned an error"

      if (log?.id) {
        await updateIntegrationLog(log.id, {
          status: "failed",
          http_status: response.status,
          error_message: message,
          result: data,
        })
      }

      return json(
        res,
        response.status >= 500
          ? 502
          : response.status,
        {
          error: message,
        }
      )
    }

    // --------------------------------------------------------
    // Extract result
    // --------------------------------------------------------

    const summary =
      data?.routes?.[0]?.summary

    const durationMinutes =
      Number.isFinite(Number(summary?.duration))
        ? Math.max(
            1,
            Math.ceil(
              Number(summary.duration) / 60
            )
          )
        : null

    const distanceMiles =
      Number.isFinite(Number(summary?.distance))
        ? Number(summary.distance) /
          1609.344
        : null

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

      return json(res, 404, {
        error: message,
      })
    }

    const result = {
      durationMinutes,
      distanceMiles,
      originCoordinates,
      destinationCoordinates,
      cached: false,
    }

    // --------------------------------------------------------
    // SAVE RESULT
    // --------------------------------------------------------

    await saveTravelTime({
      fromAppointmentId,
      toAppointmentId,
      travelDate,
      origin,
      destination,
      durationMinutes,
      distanceMiles,
    })

    // --------------------------------------------------------
    // Integration log
    // --------------------------------------------------------

    if (log?.id) {
      await updateIntegrationLog(log.id, {
        status: "success",
        http_status: response.status,
        result,
      })
    }

    return json(res, 200, result)
  } catch (error) {
    const message =
      error?.message ||
      "Unable to calculate travel time"

    if (log?.id) {
      await updateIntegrationLog(log.id, {
        status: "failed",
        http_status: error?.status || null,
        error_message: message,
        result:
          error?.providerPayload || null,
      })
    }

    return json(res, 500, {
      error: message,
    })
  }
}

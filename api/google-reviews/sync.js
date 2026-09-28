import { createIntegrationLog, updateIntegrationLog } from "../_integration-log.js"
import {
  getAccessToken,
  googleBusinessRequest,
  normaliseGoogleReview,
  parseCookies,
} from "./_google-reviews.js"

const CONFIG_EVENT_NAME = "google-reviews-location-config"
const REVIEW_BATCH_SIZE = 10
const KNOWN_LOCATION_ID = "9930514822053454607"

function supabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase server credentials are not configured.")
  }
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ""), serviceRoleKey }
}

async function getStoredLocationConfig() {
  const { supabaseUrl, serviceRoleKey } = supabaseConfig()
  const url = new URL(`${supabaseUrl}/rest/v1/integration_event_logs`)
  url.searchParams.set("event_name", `eq.${CONFIG_EVENT_NAME}`)
  url.searchParams.set("status", "eq.success")
  url.searchParams.set("order", "created_at.desc")
  url.searchParams.set("limit", "1")
  url.searchParams.set("select", "id,payload,created_at")

  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    throw new Error(`Unable to read Google Reviews configuration from Supabase (${response.status})`)
  }

  const rows = await response.json()
  const payload = rows?.[0]?.payload
  if (!payload?.accountName || !payload?.locationName) return null

  return {
    accountName: payload.accountName,
    locationName: payload.locationName,
  }
}

async function saveLocationConfig(location) {
  try {
    const log = await createIntegrationLog({
      provider: "google",
      integrationName: "Google Reviews",
      direction: "outbound",
      eventName: CONFIG_EVENT_NAME,
      eventType: "configuration",
      externalId: location.locationName,
      payload: {
        accountName: location.accountName,
        locationName: location.locationName,
        status: "configured",
        source: location.source || "api",
      },
    })

    if (log?.id) {
      await updateIntegrationLog(log.id, {
        status: "success",
        http_status: 200,
        result: {
          accountName: location.accountName,
          locationName: location.locationName,
          status: "configured",
          source: location.source || "api",
        },
      })
    }
  } catch (error) {
    console.error("Unable to cache Google Business Profile location:", error)
  }
}

async function getLocationDirectly(accessToken, locationId) {
  // Google documents locations.get as a direct lookup by location ID. Unlike
  // accounts.locations.list, this does not require the account ID in the path.
  // The returned resource name contains both the account and location IDs.
  const query = new URLSearchParams({
    readMask: "name,title,storefrontAddress,websiteUri",
  })

  const data = await googleBusinessRequest(
    accessToken,
    `/v1/locations/${encodeURIComponent(locationId)}?${query.toString()}`,
    {},
    "businessInformation",
  )

  if (!data?.name) {
    throw new Error("Google did not return a resource name for the supplied Business Profile location ID.")
  }

  const match = String(data.name).match(/^accounts\/([^/]+)\/locations\/([^/]+)$/)
  if (!match) {
    throw new Error(`Google returned an unexpected Business Profile location name: ${data.name}`)
  }

  return {
    accountName: `accounts/${match[1]}`,
    locationName: data.name,
    businessName: data.title || null,
    discovered: true,
    source: "location-id",
  }
}

async function discoverLocation(accessToken) {
  const configuredAccountId = String(process.env.GOOGLE_REVIEW_ACCOUNT_ID || "").trim()
  const configuredLocationId = String(process.env.GOOGLE_REVIEW_LOCATION_ID || KNOWN_LOCATION_ID).trim()
  const configuredLocationName = String(process.env.GOOGLE_REVIEW_LOCATION_NAME || "").trim().toLowerCase()

  if (configuredAccountId && configuredLocationId) {
    return {
      accountName: `accounts/${configuredAccountId}`,
      locationName: `accounts/${configuredAccountId}/locations/${configuredLocationId}`,
      discovered: false,
      source: "environment",
    }
  }

  // We already know the exact Google Business Profile location ID supplied
  // by the user. Resolve it directly to obtain the account ID. This avoids
  // the rate-limited accounts.list and accounts/-/locations discovery calls.
  if (configuredLocationId) {
    return getLocationDirectly(accessToken, configuredLocationId)
  }

  // Fallback for installations where no location ID has been configured.
  // This path is deliberately not used for Homeshield because the location ID
  // above is known.
  const locations = []
  let pageToken = null
  for (let page = 0; page < 20; page += 1) {
    const query = new URLSearchParams({
      pageSize: "100",
      readMask: "name,title,storefrontAddress,websiteUri",
    })
    if (pageToken) query.set("pageToken", pageToken)

    const data = await googleBusinessRequest(
      accessToken,
      `/v1/accounts/-/locations?${query.toString()}`,
      {},
      "businessInformation",
    )
    locations.push(...(data.locations || []))
    pageToken = data.nextPageToken || null
    if (!pageToken) break
  }

  const selected = configuredLocationName
    ? locations.find((location) => String(location.title || "").toLowerCase() === configuredLocationName)
    : locations.find((location) => /homeshield\.ltd/i.test(String(location.websiteUri || "")))
      || locations.find((location) => /homeshield/i.test(String(location.title || "")))

  if (!selected?.name) {
    const error = new Error("Unable to identify the Homeshield Google Business Profile location automatically.")
    error.code = "GOOGLE_REVIEW_LOCATION_SELECTION_REQUIRED"
    error.locations = locations.map((location) => ({
      locationName: location.name,
      businessName: location.title || null,
      websiteUrl: location.websiteUri || null,
    }))
    throw error
  }

  const match = String(selected.name).match(/^accounts\/([^/]+)\/locations\/([^/]+)$/)
  if (!match) throw new Error(`Google returned an unexpected Business Profile location name: ${selected.name}`)

  return {
    accountName: `accounts/${match[1]}`,
    locationName: selected.name,
    discovered: true,
    source: "discovery",
  }
}

async function getLocation(accessToken) {
  const stored = await getStoredLocationConfig()
  if (stored) return { ...stored, discovered: false, source: "cached" }

  const discovered = await discoverLocation(accessToken)
  await saveLocationConfig(discovered)
  return discovered
}

async function listReviewBatch(accessToken, locationName) {
  const query = new URLSearchParams({
    pageSize: String(REVIEW_BATCH_SIZE),
    orderBy: "updateTime desc",
  })

  const data = await googleBusinessRequest(
    accessToken,
    `/v4/${locationName}/reviews?${query.toString()}`,
    {},
    "reviews",
  )

  return {
    reviews: data.reviews || [],
    nextPageToken: data.nextPageToken || null,
    averageRating: data.averageRating ?? null,
    totalReviewCount: data.totalReviewCount ?? null,
  }
}

async function upsertReview(review) {
  const row = normaliseGoogleReview(review)
  const { supabaseUrl, serviceRoleKey } = supabaseConfig()

  let response
  try {
    response = await fetch(
      `${supabaseUrl}/rest/v1/reviews?on_conflict=source%2Cexternal_review_id`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(row),
        signal: AbortSignal.timeout(20000),
      },
    )
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error(`Supabase review upsert timed out after 20 seconds for ${row.external_review_id}`)
    }
    throw error
  }

  const text = await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`)
  }
  return Array.isArray(data) ? data[0] : data
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate")

  let log = null
  let location = null

  try {
    try {
      log = await createIntegrationLog({
        provider: "google",
        integrationName: "Google Reviews",
        direction: "outbound",
        eventName: "google-reviews-sync",
        eventType: "api",
        payload: {
          action: "sync",
          status: "started",
          requestedReviewCount: REVIEW_BATCH_SIZE,
        },
      })
    } catch (error) {
      console.error("Unable to create Google Reviews integration event log:", error)
    }

    const refreshToken = parseCookies(req.headers.cookie).google_reviews_refresh_token
    if (!refreshToken) {
      const error = new Error("Google Reviews is not connected. Open /api/google-reviews/auth first.")
      error.status = 401
      throw error
    }

    const accessToken = await getAccessToken(refreshToken)
    location = await getLocation(accessToken)

    if (log?.id) {
      await updateIntegrationLog(log.id, {
        external_id: location.locationName,
        payload: {
          action: "sync",
          accountName: location.accountName,
          locationName: location.locationName,
          locationSource: location.source,
          requestedReviewCount: REVIEW_BATCH_SIZE,
          expectedGoogleRequests: location.source === "cached" || location.source === "environment" ? 1 : 2,
          status: "processing",
        },
      })
    }

    const reviewData = await listReviewBatch(accessToken, location.locationName)
    let imported = 0
    let failed = 0
    const errors = []

    for (const review of reviewData.reviews) {
      try {
        await upsertReview(review)
        imported += 1
      } catch (error) {
        failed += 1
        errors.push({ reviewId: review?.reviewId || null, error: error instanceof Error ? error.message : String(error) })
      }
    }

    const result = {
      status: failed > 0 ? "partial" : "success",
      accountName: location.accountName,
      locationName: location.locationName,
      locationSource: location.source,
      googleApiRequests: location.source === "cached" || location.source === "environment" ? 1 : 2,
      requestedReviewCount: REVIEW_BATCH_SIZE,
      imported,
      failed,
      returnedByGoogle: reviewData.reviews.length,
      totalFromGoogle: reviewData.totalReviewCount,
      averageRating: reviewData.averageRating,
      nextPageToken: reviewData.nextPageToken,
      hasMore: Boolean(reviewData.nextPageToken),
      errors,
    }

    if (log?.id) {
      await updateIntegrationLog(log.id, {
        status: failed > 0 ? "failed" : "success",
        http_status: failed > 0 ? 207 : 200,
        result,
        error_message: failed > 0 ? `${failed} Google review(s) failed to import.` : null,
      })
    }

    return res.status(failed > 0 ? 207 : 200).json({ connected: true, ...result })
  } catch (error) {
    const result = {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      code: error?.code || null,
      locations: error?.locations || undefined,
      locationName: location?.locationName || null,
    }

    try {
      if (log?.id) {
        await updateIntegrationLog(log.id, {
          status: "failed",
          http_status: error?.status || 500,
          external_id: location?.locationName || null,
          error_message: result.error,
          result,
        })
      } else {
        await createIntegrationLog({
          provider: "google",
          integrationName: "Google Reviews",
          direction: "outbound",
          eventName: "google-reviews-sync",
          eventType: "api",
          externalId: location?.locationName || null,
          payload: { action: "sync", result },
        })
      }
    } catch (logError) {
      console.error("Unable to record Google Reviews integration failure:", logError)
    }

    console.error("Google Reviews sync error:", error)
    return res.status(error?.status >= 400 && error.status < 600 ? error.status : 502).json({
      connected: true,
      ...result,
    })
  }
}

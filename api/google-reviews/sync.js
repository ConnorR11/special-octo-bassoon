import { createIntegrationLog, updateIntegrationLog } from "../_integration-log.js"
import {
  getAccessToken,
  googleBusinessRequest,
  normaliseGoogleReview,
  parseCookies,
} from "./_google-reviews.js"

async function listAllAccounts(accessToken) {
  const accounts = []
  let pageToken = null

  for (let page = 0; page < 20; page += 1) {
    const query = new URLSearchParams({ pageSize: "20" })
    if (pageToken) query.set("pageToken", pageToken)

    const data = await googleBusinessRequest(accessToken, `/v4/accounts?${query.toString()}`)
    accounts.push(...(data.accounts || []))
    pageToken = data.nextPageToken || null
    if (!pageToken) break
  }

  return accounts
}

async function listAllLocations(accessToken, accountName) {
  const locations = []
  let pageToken = null

  for (let page = 0; page < 20; page += 1) {
    const query = new URLSearchParams({ pageSize: "100" })
    if (pageToken) query.set("pageToken", pageToken)

    const data = await googleBusinessRequest(
      accessToken,
      `/v4/${accountName}/locations?${query.toString()}`,
    )
    locations.push(...(data.locations || []))
    pageToken = data.nextPageToken || null
    if (!pageToken) break
  }

  return locations
}

async function findLocation(accessToken) {
  const configuredAccountId = String(process.env.GOOGLE_REVIEW_ACCOUNT_ID || "").trim()
  const configuredLocationId = String(process.env.GOOGLE_REVIEW_LOCATION_ID || "").trim()
  const configuredLocationName = String(process.env.GOOGLE_REVIEW_LOCATION_NAME || "").trim().toLowerCase()

  if (configuredAccountId && configuredLocationId) {
    return {
      accountName: `accounts/${configuredAccountId}`,
      locationName: `accounts/${configuredAccountId}/locations/${configuredLocationId}`,
      location: null,
      discovered: false,
    }
  }

  const accounts = await listAllAccounts(accessToken)
  if (!accounts.length) {
    throw new Error("Google returned no Business Profile accounts for this user.")
  }

  const allLocations = []
  for (const account of accounts) {
    if (!account?.name) continue
    try {
      const locations = await listAllLocations(accessToken, account.name)
      allLocations.push(...locations.map((location) => ({ ...location, accountName: account.name })))
    } catch (error) {
      console.warn(`Unable to list locations for ${account.name}:`, error?.message || error)
    }
  }

  if (!allLocations.length) {
    throw new Error("Google returned no accessible Business Profile locations.")
  }

  const byConfiguredName = configuredLocationName
    ? allLocations.find((location) => String(location.locationName || "").toLowerCase() === configuredLocationName)
    : null

  const byWebsite = allLocations.find((location) => /homeshield\.ltd/i.test(String(location.websiteUrl || "")))
  const byName = allLocations.find((location) => /homeshield/i.test(String(location.locationName || "")))
  const selected = byConfiguredName || byWebsite || byName

  if (!selected) {
    const available = allLocations.map((location) => ({
      accountName: location.accountName,
      locationName: location.name,
      businessName: location.locationName || null,
      websiteUrl: location.websiteUrl || null,
    }))
    const error = new Error("Unable to identify the Homeshield Google Business Profile location automatically.")
    error.code = "GOOGLE_REVIEW_LOCATION_SELECTION_REQUIRED"
    error.locations = available
    throw error
  }

  return {
    accountName: selected.accountName,
    locationName: selected.name,
    location: selected,
    discovered: true,
  }
}

async function listAllReviews(accessToken, locationName) {
  const reviews = []
  let pageToken = null

  for (let page = 0; page < 100; page += 1) {
    const query = new URLSearchParams({
      pageSize: "50",
      orderBy: "updateTime desc",
    })
    if (pageToken) query.set("pageToken", pageToken)

    const data = await googleBusinessRequest(
      accessToken,
      `/v4/${locationName}/reviews?${query.toString()}`,
    )

    reviews.push(...(data.reviews || []))
    pageToken = data.nextPageToken || null
    if (!pageToken) {
      return {
        reviews,
        averageRating: data.averageRating ?? null,
        totalReviewCount: data.totalReviewCount ?? reviews.length,
      }
    }
  }

  throw new Error("Google returned more review pages than the CRM sync limit allows.")
}

async function upsertReview(review) {
  const row = normaliseGoogleReview(review)
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase server credentials are not configured.")
  }

  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/reviews?on_conflict=source%2Cexternal_review_id`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(row),
    },
  )

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

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

  const refreshToken = parseCookies(req.headers.cookie).google_reviews_refresh_token
  if (!refreshToken) {
    return res.status(401).json({
      connected: false,
      error: "Google Reviews is not connected. Open /api/google-reviews/auth first.",
    })
  }

  let log = null
  let location = null

  try {
    const accessToken = await getAccessToken(refreshToken)
    location = await findLocation(accessToken)

    try {
      log = await createIntegrationLog({
        provider: "google",
        integrationName: "Google Reviews",
        direction: "outbound",
        eventName: "google-reviews-sync",
        eventType: "api",
        externalId: location.locationName,
        payload: {
          action: "sync",
          accountName: location.accountName,
          locationName: location.locationName,
          discovered: location.discovered,
        },
      })
    } catch (error) {
      console.error("Unable to create Google Reviews integration event log:", error)
    }

    const reviewData = await listAllReviews(accessToken, location.locationName)
    let imported = 0
    let failed = 0
    const errors = []

    for (const review of reviewData.reviews) {
      try {
        await upsertReview(review)
        imported += 1
      } catch (error) {
        failed += 1
        errors.push({
          reviewId: review?.reviewId || null,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const result = {
      status: failed > 0 ? "partial" : "success",
      accountName: location.accountName,
      locationName: location.locationName,
      imported,
      failed,
      totalFromGoogle: reviewData.totalReviewCount,
      averageRating: reviewData.averageRating,
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

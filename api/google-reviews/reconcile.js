import { createIntegrationLog, updateIntegrationLog } from "../_integration-log.js"
import {
  getAccessToken,
  getStoredRefreshToken,
  googleBusinessRequest,
} from "./_google-reviews.js"

function authorised(req) {
  const expected = String(process.env.CRON_SECRET || "").trim()
  if (!expected) return false
  const header = String(req.headers.authorization || "")
  return header === "Bearer " + expected
}

async function getStoredLocationConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = new URL(supabaseUrl.replace(/\/$/, "") + "/rest/v1/integration_event_logs")
  url.searchParams.set("event_name", "eq.google-reviews-location-config")
  url.searchParams.set("status", "eq.success")
  url.searchParams.set("order", "created_at.desc")
  url.searchParams.set("limit", "1")
  url.searchParams.set("select", "payload")

  const response = await fetch(url, {
    headers: { apikey: serviceRoleKey, Authorization: "Bearer " + serviceRoleKey },
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error("Unable to read Google Reviews location configuration.")
  const rows = await response.json()
  return rows?.[0]?.payload || null
}

async function listAllGoogleReviewIds(accessToken, locationName) {
  const ids = new Set()
  let pageToken = null
  let pages = 0

  do {
    pages += 1
    const query = new URLSearchParams({
      pageSize: "50",
      orderBy: "updateTime desc",
    })
    if (pageToken) query.set("pageToken", pageToken)

    const data = await googleBusinessRequest(
      accessToken,
      "/v4/" + locationName + "/reviews?" + query.toString(),
      {},
      "reviews",
    )

    for (const review of data.reviews || []) {
      const id = String(review?.reviewId || review?.name?.split("/").pop() || "").trim()
      if (id) ids.add(id)
    }

    pageToken = data.nextPageToken || null
    if (pages > 200) throw new Error("Google Reviews reconciliation exceeded the safety page limit.")
  } while (pageToken)

  return { ids, pages }
}

async function getStoredGoogleReviewIds() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = new URL(supabaseUrl.replace(/\/$/, "") + "/rest/v1/reviews")
  url.searchParams.set("source", "eq.google")
  url.searchParams.set("select", "external_review_id")
  url.searchParams.set("limit", "10000")

  const response = await fetch(url, {
    headers: { apikey: serviceRoleKey, Authorization: "Bearer " + serviceRoleKey },
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error("Unable to read Google reviews from the CRM.")
  const rows = await response.json()
  return new Set((rows || []).map(row => String(row?.external_review_id || "").trim()).filter(Boolean))
}

async function deleteStoredReview(id) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = new URL(supabaseUrl.replace(/\/$/, "") + "/rest/v1/reviews")
  url.searchParams.set("source", "eq.google")
  url.searchParams.set("external_review_id", "eq." + id)

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey,
      Authorization: "Bearer " + serviceRoleKey,
      Prefer: "return=minimal",
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error("Unable to delete Google review " + id + " from the CRM.")
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end()
  if (!authorised(req)) return res.status(401).json({ error: "Unauthorised" })

  let log = null

  try {
    log = await createIntegrationLog({
      provider: "google",
      integrationName: "Google Reviews",
      direction: "inbound",
      eventName: "google-reviews-reconcile",
      eventType: "cron",
      payload: { action: "started" },
    })

    const refreshToken = await getStoredRefreshToken()
    if (!refreshToken) throw new Error("Google Reviews is not connected.")

    const location = await getStoredLocationConfig()
    if (!location?.locationName) throw new Error("Google Reviews location is not configured.")

    const accessToken = await getAccessToken(refreshToken)
    const google = await listAllGoogleReviewIds(accessToken, location.locationName)
    const stored = await getStoredGoogleReviewIds()

    const deleted = []
    for (const id of stored) {
      if (!google.ids.has(id)) {
        await deleteStoredReview(id)
        deleted.push(id)
      }
    }

    const result = {
      status: "success",
      googleReviewCount: google.ids.size,
      crmGoogleReviewCountBefore: stored.size,
      deletedCount: deleted.length,
      deletedReviewIds: deleted,
      googlePagesChecked: google.pages,
    }

    if (log?.id) await updateIntegrationLog(log.id, {
      status: "success",
      http_status: 200,
      result,
    })

    return res.status(200).json(result)
  } catch (error) {
    if (log?.id) await updateIntegrationLog(log.id, {
      status: "failed",
      http_status: error?.status || 500,
      error_message: error instanceof Error ? error.message : String(error),
    })
    console.error("Google Reviews reconciliation error:", error)
    return res.status(500).json({ status: "failed", error: error instanceof Error ? error.message : String(error) })
  }
}

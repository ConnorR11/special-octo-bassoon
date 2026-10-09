import { createIntegrationLog, updateIntegrationLog } from "../_integration-log.js"
import {
  getAccessToken,
  getStoredRefreshToken,
  googleBusinessRequest,
  normaliseGoogleReview,
} from "./_google-reviews.js"

function authorised(req) {
  const expected = String(process.env.GOOGLE_REVIEWS_WEBHOOK_SECRET || "").trim()
  if (!expected) return false
  const supplied = String(req.query?.token || "").trim()
  return supplied && supplied === expected
}

async function upsertReview(review) {
  const row = normaliseGoogleReview(review)
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase server credentials are not configured.")

  const response = await fetch(
    supabaseUrl.replace(/\/$/, "") + "/rest/v1/reviews?on_conflict=source%2Cexternal_review_id",
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: "Bearer " + serviceRoleKey,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(15000),
    },
  )
  if (!response.ok) throw new Error("Supabase review upsert failed: " + await response.text())
  return row
}

async function markReviewDeleted(reviewId) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = new URL(supabaseUrl.replace(/\/$/, "") + "/rest/v1/reviews")
  url.searchParams.set("source", "eq.google")
  url.searchParams.set("external_review_id", "eq." + reviewId)

  url.searchParams.set("is_deleted", "eq.false")
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: "Bearer " + serviceRoleKey,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error("Supabase review soft-delete failed: " + await response.text())
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end()
  if (!authorised(req)) return res.status(401).json({ error: "Unauthorised" })

  let log = null

  try {
    const message = req.body?.message || {}
    const encoded = message.data
    if (!encoded) return res.status(204).end()

    const decoded = Buffer.from(String(encoded), "base64").toString("utf8")
    const notification = JSON.parse(decoded)

    const type = String(notification.notificationType || notification.notification_type || "").toUpperCase()
    const reviewName = notification.reviewName || notification.review_name || null
    const locationName = notification.locationName || notification.location_name || null

    if (!["NEW_REVIEW", "UPDATED_REVIEW"].includes(type) || !reviewName) {
      return res.status(204).end()
    }

    log = await createIntegrationLog({
      provider: "google",
      integrationName: "Google Reviews",
      direction: "inbound",
      eventName: "google-review-webhook",
      eventType: type,
      externalId: reviewName,
      payload: { notificationType: type, reviewName, locationName },
    })

    const refreshToken = await getStoredRefreshToken()
    if (!refreshToken) throw new Error("Google Reviews is not connected. Reconnect Google Reviews to store the refresh token.")

    const accessToken = await getAccessToken(refreshToken)

    let review
    try {
      review = await googleBusinessRequest(
        accessToken,
        "/v4/" + reviewName,
        {},
        "reviews",
      )
    } catch (error) {
      if (error?.status === 404) {
        const reviewId = String(reviewName).split("/").pop()
        await markReviewDeleted(reviewId)
        if (log?.id) await updateIntegrationLog(log.id, {
          status: "success",
          http_status: 200,
          result: { action: "delete", reviewId, reason: "Google review no longer exists" },
        })
        return res.status(204).end()
      }
      throw error
    }

    const row = await upsertReview(review)

    if (log?.id) await updateIntegrationLog(log.id, {
      status: "success",
      http_status: 200,
      result: { action: type === "NEW_REVIEW" ? "create" : "update", externalReviewId: row.external_review_id },
    })

    return res.status(204).end()
  } catch (error) {
    if (log?.id) {
      await updateIntegrationLog(log.id, {
        status: "failed",
        http_status: error?.status || 500,
        error_message: error instanceof Error ? error.message : String(error),
      })
    }
    console.error("Google Reviews webhook error:", error)
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
  }
}

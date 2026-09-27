import crypto from "node:crypto"

export const GOOGLE_REVIEWS_SCOPE = "https://www.googleapis.com/auth/business.manage"

export function createState(secret) {
  const timestamp = String(Date.now())
  const nonce = crypto.randomBytes(24).toString("hex")
  const payload = `${timestamp}.${nonce}`
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url")
  return `${payload}.${signature}`
}

export function verifyState(state, secret) {
  const parts = String(state || "").split(".")
  if (parts.length !== 3) return false

  const [timestamp, nonce, signature] = parts
  if (!/^\d+$/.test(timestamp) || !nonce || !signature) return false

  const age = Date.now() - Number(timestamp)
  if (age < 0 || age > 10 * 60 * 1000) return false

  const payload = `${timestamp}.${nonce}`
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url")

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

export function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => {
        const index = part.indexOf("=")
        if (index < 0) return [part.trim(), ""]
        return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]
      })
      .filter(([key]) => key),
  )
}

export async function getAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  })

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  const data = await response.json()

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Unable to refresh Google access token")
  }

  return data.access_token
}

const GOOGLE_API_HOSTS = {
  accountManagement: "https://mybusinessaccountmanagement.googleapis.com",
  businessInformation: "https://mybusinessbusinessinformation.googleapis.com",
  reviews: "https://mybusiness.googleapis.com",
}

export async function googleBusinessRequest(accessToken, path, options = {}, service = "reviews") {
  const host = GOOGLE_API_HOSTS[service] || GOOGLE_API_HOSTS.reviews
  const response = await fetch(`${host}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  })

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!response.ok) {
    const message = typeof data === "string"
      ? data
      : data?.error?.message || data?.error?.status || JSON.stringify(data)
    const error = new Error(`Google Business Profile request failed (${response.status}): ${message}`)
    error.status = response.status
    error.google = data
    throw error
  }

  return data
}

export function ratingToNumber(value) {
  const ratings = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  }

  if (Number.isInteger(value)) return value
  return ratings[String(value || "").toUpperCase()] || null
}

export function normaliseGoogleReview(review) {
  const reviewId = review?.reviewId || review?.name?.split("/").pop() || null
  const rating = ratingToNumber(review?.starRating)
  if (!reviewId) throw new Error("Google review is missing reviewId")
  if (!rating || rating < 1 || rating > 5) throw new Error(`Google review ${reviewId} has an invalid star rating`)

  return {
    source: "google",
    external_review_id: String(reviewId),
    reviewer_name: review?.reviewer?.displayName || null,
    reviewer_email: null,
    rating,
    title: null,
    review_text: review?.comment || null,
    review_date: review?.createTime || null,
    response_text: review?.reviewReply?.comment || null,
    responded_at: review?.reviewReply?.updateTime || null,
    reference: review?.name || null,
    updated_at: review?.updateTime || new Date().toISOString(),
  }
}

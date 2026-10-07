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

function tokenEncryptionKey() {
  const secret = process.env.GOOGLE_REVIEWS_TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  if (!secret) throw new Error("Google Reviews token encryption key is not configured.")
  return crypto.createHash("sha256").update(secret).digest()
}

export function encryptRefreshToken(refreshToken) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", tokenEncryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(String(refreshToken), "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return "v1." + iv.toString("base64url") + "." + tag.toString("base64url") + "." + ciphertext.toString("base64url")
}

export function decryptRefreshToken(value) {
  const parts = String(value || "").split(".")
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Stored Google Reviews token is invalid.")
  const iv = Buffer.from(parts[1], "base64url")
  const tag = Buffer.from(parts[2], "base64url")
  const ciphertext = Buffer.from(parts[3], "base64url")
  const decipher = crypto.createDecipheriv("aes-256-gcm", tokenEncryptionKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}

async function supabaseRequest(path, options = {}) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase server credentials are not configured.")
  return fetch(supabaseUrl.replace(/\/$/, "") + path, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: "Bearer " + serviceRoleKey,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    signal: options.signal || AbortSignal.timeout(15000),
  })
}

export async function saveRefreshToken(refreshToken) {
  const response = await supabaseRequest("/rest/v1/integration_event_logs", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      provider: "google",
      integration_name: "Google Reviews",
      direction: "outbound",
      event_name: "google-reviews-refresh-token",
      event_type: "credential",
      status: "success",
      payload: { token: encryptRefreshToken(refreshToken) },
    }),
  })
  if (!response.ok) throw new Error("Unable to securely store the Google Reviews refresh token.")
}

export async function getStoredRefreshToken() {
  const url = new URL("/rest/v1/integration_event_logs", "https://placeholder.invalid")
  url.searchParams.set("event_name", "eq.google-reviews-refresh-token")
  url.searchParams.set("status", "eq.success")
  url.searchParams.set("order", "created_at.desc")
  url.searchParams.set("limit", "1")
  url.searchParams.set("select", "payload")
  const response = await supabaseRequest(url.pathname + url.search, {})
  if (!response.ok) throw new Error("Unable to read the stored Google Reviews refresh token.")
  const rows = await response.json()
  const encrypted = rows?.[0]?.payload?.token
  return encrypted ? decryptRefreshToken(encrypted) : null
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
    signal: AbortSignal.timeout(15000),
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

  let response
  try {
    response = await fetch(`${host}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      signal: options.signal || AbortSignal.timeout(20000),
    })
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      const timeoutError = new Error(`Google Business Profile request timed out after 20 seconds: ${service} ${path}`)
      timeoutError.status = 504
      timeoutError.code = "GOOGLE_REQUEST_TIMEOUT"
      throw timeoutError
    }
    throw error
  }

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

import crypto from "node:crypto"

function verifyState(state, secret) {
  const parts = String(state || "").split(".")
  if (parts.length !== 3) return false

  const [timestamp, nonce, signature] = parts
  if (!/^\d+$/.test(timestamp) || !nonce || !signature) return false

  const age = Date.now() - Number(timestamp)
  if (age < 0 || age > 10 * 60 * 1000) return false

  const payload = `${timestamp}.${nonce}`
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url")

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    )
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  const { code, state, error } = req.query || {}
  if (error) return res.redirect(`/seo?gsc_error=${encodeURIComponent(error)}`)

  const clientId = process.env.GOOGLE_CLIENT_ID || ""
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || ""

  if (!clientId || !clientSecret) {
    return res.status(500).send("Google OAuth credentials are not configured in Vercel.")
  }

  if (!code || !verifyState(state, clientSecret)) {
    return res.status(400).send("Invalid Google OAuth state.")
  }

  const baseUrl = process.env.APP_URL || `https://${req.headers.host}`
  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/gsc-callback`
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  })

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    })
    const tokens = await tokenResponse.json()

    if (!tokenResponse.ok || !tokens.refresh_token) {
      console.error("Google token exchange failed:", tokens)
      return res.status(502).send("Google authorisation could not be completed. Check the OAuth client and redirect URI.")
    }

    // Keep the long-lived refresh token in a first-party, HttpOnly cookie.
    // SameSite=None + Secure also survives the Google -> CRM OAuth navigation
    // consistently across browsers, while the token remains inaccessible to JS.
    const cookie = [
      `gsc_refresh_token=${encodeURIComponent(tokens.refresh_token)}`,
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=None",
      "Max-Age=31536000",
    ].join("; ")

    res.setHeader("Set-Cookie", cookie)
    res.setHeader("Cache-Control", "no-store")
    return res.redirect("/seo?gsc_connected=1")
  } catch (err) {
    console.error("Google OAuth callback error:", err)
    return res.status(500).send("Google authorisation failed.")
  }
}

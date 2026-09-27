import { verifyState } from "./_google-reviews.js"

export default async function handler(req, res) {
  const { code, state, error } = req.query || {}

  if (error) {
    return res.redirect(`/reviews?google_reviews_error=${encodeURIComponent(error)}`)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || ""
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || ""

  if (!clientId || !clientSecret) {
    return res.status(500).send("Google OAuth credentials are not configured in Vercel.")
  }

  if (!code || !verifyState(state, clientSecret)) {
    return res.status(400).send("Invalid Google OAuth state.")
  }

  const baseUrl = process.env.APP_URL || `https://${req.headers.host}`
  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/google-reviews/callback`
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
      console.error("Google Reviews token exchange failed:", tokens)
      return res.status(502).send("Google Reviews authorisation could not be completed. Check the OAuth client, scope and redirect URI.")
    }

    const requestHost = String(req.headers.host || "").split(":")[0].toLowerCase()
    const domainAttribute = requestHost === "crm.homeshield.ltd" || requestHost.endsWith(".homeshield.ltd")
      ? "; Domain=.homeshield.ltd"
      : ""

    const cookie = [
      `google_reviews_refresh_token=${encodeURIComponent(tokens.refresh_token)}`,
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      "Max-Age=31536000",
      domainAttribute.replace(/^; /, ""),
    ].filter(Boolean).join("; ")

    res.setHeader("Set-Cookie", cookie)
    res.setHeader("Cache-Control", "no-store")
    return res.redirect("/reviews?google_reviews_connected=1")
  } catch (err) {
    console.error("Google Reviews OAuth callback error:", err)
    return res.status(500).send("Google Reviews authorisation failed.")
  }
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => {
    const index = part.indexOf("=")
    if (index < 0) return [part.trim(), ""]
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]
  }).filter(([key]) => key))
}

export default async function handler(req, res) {
  const { code, state, error } = req.query || {}
  if (error) return res.redirect(`/seo?gsc_error=${encodeURIComponent(error)}`)

  const cookies = parseCookies(req.headers.cookie)
  if (!code || !state || !cookies.gsc_oauth_state || state !== cookies.gsc_oauth_state) {
    return res.status(400).send("Invalid Google OAuth state.")
  }

  const redirectUri = `${process.env.APP_URL || `https://${req.headers.host}`}/api/gsc-callback`
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
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

    const isSecure = String(req.headers['x-forwarded-proto'] || 'https') === 'https'
    const cookie = `gsc_refresh_token=${encodeURIComponent(tokens.refresh_token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${isSecure ? '; Secure' : ''}`
    res.setHeader("Set-Cookie", [cookie, `gsc_oauth_state=; Path=/; HttpOnly; Max-Age=0${isSecure ? '; Secure' : ''}`])
    return res.redirect("/seo?gsc_connected=1")
  } catch (err) {
    console.error("Google OAuth callback error:", err)
    return res.status(500).send("Google authorisation failed.")
  }
}

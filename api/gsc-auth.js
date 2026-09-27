export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) return res.status(500).json({ error: "GOOGLE_CLIENT_ID is not configured in Vercel." })

  const redirectUri = `${process.env.APP_URL || `https://${req.headers.host}`}/api/gsc-callback`
  const state = crypto.randomUUID()
  const isSecure = String(req.headers['x-forwarded-proto'] || 'https') === 'https'

  res.setHeader("Set-Cookie", `gsc_oauth_state=${encodeURIComponent(state)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${isSecure ? '; Secure' : ''}`)

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    state,
  })

  res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` })
  res.end()
}

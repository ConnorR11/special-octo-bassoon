import { createState, GOOGLE_REVIEWS_SCOPE } from "./_google-reviews.js"

export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: "Google OAuth credentials are not configured in Vercel." })
  }

  const baseUrl = process.env.APP_URL || `https://${req.headers.host}`
  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/google-reviews/callback`
  const state = createState(clientSecret)

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_REVIEWS_SCOPE,
    state,
  })

  res.writeHead(302, {
    Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  })
  res.end()
}

import crypto from "node:crypto"

function createState(secret) {
  const timestamp = String(Date.now())
  const nonce = crypto.randomBytes(24).toString("hex")
  const payload = `${timestamp}.${nonce}`
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url")
  return `${payload}.${signature}`
}

export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: "Google OAuth credentials are not configured in Vercel." })
  }

  const baseUrl = process.env.APP_URL || `https://${req.headers.host}`
  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/gsc-callback`
  const state = createState(clientSecret)

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

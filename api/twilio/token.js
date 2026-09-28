import crypto from "node:crypto"

function base64url(value) {
  return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
}

function signToken(header, payload, secret) {
  const encodedHeader = base64url(JSON.stringify(header))
  const encodedPayload = base64url(JSON.stringify(payload))
  const unsigned = `${encodedHeader}.${encodedPayload}`
  const signature = crypto.createHmac("sha256", secret).update(unsigned).digest("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
  return `${unsigned}.${signature}`
}

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" })

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const apiKeySid = process.env.TWILIO_API_KEY_SID
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID

  if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
    return res.status(503).json({
      error: "Twilio browser calling is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET and TWILIO_TWIML_APP_SID to Vercel."
    })
  }

  const identity = String(req.query?.identity || "crm-user").replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 100)
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    jti: `${apiKeySid}-${now}`,
    iss: apiKeySid,
    sub: accountSid,
    iat: now,
    exp: now + 3600,
    grants: {
      identity,
      voice: {
        incoming: { allow: false },
        outgoing: { application_sid: twimlAppSid }
      }
    }
  }

  const token = signToken({ typ: "JWT", alg: "HS256" }, payload, apiKeySecret)
  res.setHeader("Cache-Control", "no-store")
  return res.status(200).json({ token, identity })
}

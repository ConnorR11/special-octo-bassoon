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

async function logIntegration({ eventName, externalId, status, httpStatus, payload, result, errorMessage }) {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "")
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
  if (!url || !serviceKey) return
  try {
    await fetch(`${url}/rest/v1/integration_event_logs`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        event_name: eventName,
        external_id: externalId || null,
        status,
        http_status: httpStatus ?? null,
        error_message: errorMessage || null,
        result: result || null,
        payload: payload || {},
        received_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
        provider: "twilio",
        integration_name: "twilio_voice",
        direction: "outbound",
        event_type: eventName,
      }),
    })
  } catch (error) {
    console.error("Twilio token: integration log failed", error)
  }
}

export default async function handler(req, res) {
  const requestId = req.headers?.["x-vercel-id"] || null
  const rawIdentity = String(req.query?.identity || "crm-user")
  const payloadForLog = { identity: rawIdentity, method: req.method }

  if (req.method !== "GET") {
    await logIntegration({ eventName: "twilio.voice.token", externalId: requestId, status: "failed", httpStatus: 405, payload: payloadForLog, errorMessage: "Method not allowed" })
    return res.status(405).json({ error: "Method not allowed" })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const apiKeySid = process.env.TWILIO_API_KEY_SID
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID

  if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
    const errorMessage = "Twilio browser calling is not configured."
    await logIntegration({ eventName: "twilio.voice.token", externalId: requestId, status: "failed", httpStatus: 503, payload: payloadForLog, errorMessage })
    return res.status(503).json({ error: `${errorMessage} Add TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET and TWILIO_TWIML_APP_SID to Vercel.` })
  }

  const identity = `crm_${rawIdentity}`.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 100)
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    jti: `${apiKeySid}-${now}`,
    iss: apiKeySid,
    sub: accountSid,
    iat: now,
    exp: now + 3600,
    grants: { identity, voice: { outgoing: { application_sid: twimlAppSid } } }
  }

  const token = signToken({ typ: "JWT", alg: "HS256", cty: "twilio-fpa;v=1" }, payload, apiKeySecret)
  res.setHeader("Cache-Control", "no-store")
  await logIntegration({ eventName: "twilio.voice.token", externalId: requestId, status: "success", httpStatus: 200, payload: payloadForLog, result: { identity, twiml_app_sid: twimlAppSid } })
  return res.status(200).json({ token, identity })
}

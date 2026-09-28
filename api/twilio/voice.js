function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function getParam(req, ...names) {
  const body = req.body || {}
  const query = req.query || {}
  let parsedBody = body
  if (typeof body === "string") {
    try { parsedBody = Object.fromEntries(new URLSearchParams(body)) } catch { parsedBody = {} }
  }
  for (const name of names) {
    const lower = name.toLowerCase()
    const value = parsedBody?.[name] ?? parsedBody?.[lower] ?? query?.[name] ?? query?.[lower]
    if (value !== undefined && value !== null && value !== "") return value
  }
  return null
}

function normaliseIdentity(value) {
  const raw = String(value || "").trim()
  if (!raw) return null
  // The Access Token prefixes the CRM identity with crm_ and replaces UUID
  // hyphens with underscores because Twilio identities cannot contain '-'.
  const withoutPrefix = raw.startsWith("crm_") ? raw.slice(4) : raw
  if (/^[0-9a-fA-F]{8}_[0-9a-fA-F]{4}_[0-9a-fA-F]{4}_[0-9a-fA-F]{4}_[0-9a-fA-F]{12}$/.test(withoutPrefix)) {
    return withoutPrefix.replace(/_/g, "-").toLowerCase()
  }
  return raw
}

async function getProfilePhone(identity) {
  const authUserId = normaliseIdentity(identity)
  if (!authUserId) return null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error("Twilio voice: Supabase server credentials are missing")
    return null
  }

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }

  // profiles.auth_user_id is the primary link to the Supabase Auth user.
  const authResponse = await fetch(`${url}/rest/v1/profiles?select=twilio_phone_number&auth_user_id=eq.${encodeURIComponent(authUserId)}&limit=1`, { headers })
  if (authResponse.ok) {
    const rows = await authResponse.json()
    const phone = rows?.[0]?.twilio_phone_number
    if (phone) return phone
  } else {
    console.error("Twilio voice: auth_user_id lookup failed", authResponse.status)
  }

  // Backwards-compatible fallback if an older profile uses id for the auth UUID.
  const idResponse = await fetch(`${url}/rest/v1/profiles?select=twilio_phone_number&id=eq.${encodeURIComponent(authUserId)}&limit=1`, { headers })
  if (!idResponse.ok) {
    console.error("Twilio voice: id lookup failed", idResponse.status)
    return null
  }
  const rows = await idResponse.json()
  return rows?.[0]?.twilio_phone_number || null
}

function xmlResponse(res, status, xml) {
  res.statusCode = status
  res.setHeader("Content-Type", "text/xml; charset=utf-8")
  res.setHeader("Cache-Control", "no-store")
  res.end(xml)
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") return xmlResponse(res, 200, "<Response><Say>Twilio voice endpoint is reachable.</Say></Response>")
    if (req.method !== "POST") return xmlResponse(res, 405, "<Response><Say>Method not allowed.</Say></Response>")

    const to = getParam(req, "CrmTo", "ToNumber", "To")
    const identity = getParam(req, "CrmIdentity", "Identity")
    const normalisedIdentity = normaliseIdentity(identity)
    const from = await getProfilePhone(identity)

    console.log("Twilio voice request", {
      to,
      identity,
      normalisedIdentity,
      from,
      caller: getParam(req, "From"),
      twilioTo: getParam(req, "To"),
      callSid: getParam(req, "CallSid"),
    })

    if (!from) {
      console.error("Twilio voice: no twilio_phone_number for CRM identity", identity || "(missing)")
      return xmlResponse(res, 200, "<Response><Say>No Twilio phone number is configured for this user.</Say></Response>")
    }

    const destination = String(to || "").replace(/[\s()-]/g, "")
    if (!/^\+?[1-9]\d{7,14}$/.test(destination)) {
      console.error("Twilio voice: invalid destination", to)
      return xmlResponse(res, 200, "<Response><Say>Invalid destination number.</Say></Response>")
    }

    const xml = `<Response><Dial callerId="${escapeXml(from)}"><Number>${escapeXml(destination)}</Number></Dial></Response>`
    console.log("Twilio voice response", { from, destination, xml })
    return xmlResponse(res, 200, xml)
  } catch (error) {
    console.error("Twilio voice endpoint error", error)
    return xmlResponse(res, 200, "<Response><Say>Unable to start the call.</Say></Response>")
  }
}

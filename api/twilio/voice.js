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
  let withoutClient = raw.startsWith("client:") ? raw.slice(7) : raw
  const withoutPrefix = withoutClient.startsWith("crm_") ? withoutClient.slice(4) : withoutClient
  if (/^[0-9a-fA-F]{8}[_-][0-9a-fA-F]{4}[_-][0-9a-fA-F]{4}[_-][0-9a-fA-F]{4}[_-][0-9a-fA-F]{12}$/.test(withoutPrefix)) {
    return withoutPrefix.replace(/_/g, "-").toLowerCase()
  }
  return withoutPrefix
}

function normalisePhone(value) {
  if (value === null || value === undefined || value === "") return null
  let phone = String(value).trim().replace(/[\s()-]/g, "")
  if (!phone) return null
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`
  if (!phone.startsWith("+")) phone = `+${phone}`
  return phone
}

async function getProfilePhone(identity) {
  const authUserId = normaliseIdentity(identity)
  if (!authUserId) return { phone: null, lookupIdentity: null, profileFound: false, error: "No identity supplied" }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return { phone: null, lookupIdentity: authUserId, profileFound: false, error: "Supabase server credentials are missing" }

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  const response = await fetch(`${url}/rest/v1/profiles?select=twilio_phone_number&auth_user_id=eq.${encodeURIComponent(authUserId)}&limit=1`, { headers })
  if (!response.ok) return { phone: null, lookupIdentity: authUserId, profileFound: false, error: `Supabase HTTP ${response.status}` }

  const rows = await response.json()
  const profileFound = rows.length > 0
  const phone = normalisePhone(rows?.[0]?.twilio_phone_number)
  return { phone, lookupIdentity: authUserId, profileFound, error: null }
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
    const identityParam = getParam(req, "CrmIdentity", "Identity")
    const twilioFrom = getParam(req, "From")
    const identity = identityParam || twilioFrom
    const profile = await getProfilePhone(identity)
    const from = profile.phone

    console.log("Twilio voice lookup diagnostic", {
      to,
      identityParam,
      twilioFrom,
      lookupIdentity: profile.lookupIdentity,
      profileFound: profile.profileFound,
      twilioPhoneNumber: from,
      error: profile.error,
    })

    if (!from) {
      const diagnostic = `Phone lookup failed. Identity received: ${identity || "NONE"}. Lookup UUID: ${profile.lookupIdentity || "NONE"}. Profile found: ${profile.profileFound ? "YES" : "NO"}. twilio_phone_number: ${from || "NULL"}. ${profile.error || "No phone number returned from profile."}`
      return xmlResponse(res, 200, `<Response><Say>${escapeXml(diagnostic)}</Say></Response>`)
    }

    const destination = String(to || "").replace(/[\s()-]/g, "")
    if (!/^\+?[1-9]\d{7,14}$/.test(destination)) return xmlResponse(res, 200, "<Response><Say>Invalid destination number.</Say></Response>")

    const xml = `<Response><Dial callerId="${escapeXml(from)}"><Number>${escapeXml(destination)}</Number></Dial></Response>`
    return xmlResponse(res, 200, xml)
  } catch (error) {
    console.error("Twilio voice endpoint error", error)
    return xmlResponse(res, 200, "<Response><Say>Unable to start the call.</Say></Response>")
  }
}

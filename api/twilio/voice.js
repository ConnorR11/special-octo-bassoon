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

function getSupabaseConfig() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "")
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
  return { url, serviceKey }
}

function supabaseHeaders(serviceKey) {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" }
}

async function getProfilePhone(identity) {
  const authUserId = normaliseIdentity(identity)
  if (!authUserId) return { phone: null, authUserId: null, reason: "No CRM identity supplied" }

  const { url, serviceKey } = getSupabaseConfig()
  if (!url || !serviceKey) {
    console.error("Twilio voice: Supabase server credentials are missing", {
      hasUrl: Boolean(url),
      hasServiceRoleKey: Boolean(serviceKey),
    })
    return {
      phone: null,
      authUserId,
      reason: `Supabase server credentials are missing (URL: ${url ? "present" : "missing"}, service role key: ${serviceKey ? "present" : "missing"})`,
    }
  }

  const headers = supabaseHeaders(serviceKey)

  const authResponse = await fetch(
    `${url}/rest/v1/profiles?select=twilio_phone_number&auth_user_id=eq.${encodeURIComponent(authUserId)}&limit=1`,
    { headers }
  )
  if (!authResponse.ok) {
    const detail = await authResponse.text().catch(() => "")
    console.error("Twilio voice: auth_user_id lookup failed", authResponse.status, detail)
  } else {
    const rows = await authResponse.json()
    const phone = normalisePhone(rows?.[0]?.twilio_phone_number)
    if (phone) return { phone, authUserId, profileFound: true, matchedBy: "auth_user_id" }
  }

  const idResponse = await fetch(
    `${url}/rest/v1/profiles?select=twilio_phone_number&id=eq.${encodeURIComponent(authUserId)}&limit=1`,
    { headers }
  )
  if (!idResponse.ok) {
    const detail = await idResponse.text().catch(() => "")
    console.error("Twilio voice: id lookup failed", idResponse.status, detail)
  } else {
    const rows = await idResponse.json()
    const phone = normalisePhone(rows?.[0]?.twilio_phone_number)
    if (phone) return { phone, authUserId, profileFound: true, matchedBy: "id" }
  }

  return { phone: null, authUserId, profileFound: false, matchedBy: null, reason: "Profile not found or twilio_phone_number is empty" }
}

async function createCallLog({ userId, callSid, from, to }) {
  const { url, serviceKey } = getSupabaseConfig()
  if (!url || !serviceKey || !userId || !callSid || !to) return

  try {
    const response = await fetch(`${url}/rest/v1/call_logs`, {
      method: "POST",
      headers: { ...supabaseHeaders(serviceKey), Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: userId,
        customer_phone: to,
        direction: "outbound",
        status: "initiated",
        twilio_call_sid: callSid,
        from_number: from || null,
        to_number: to,
        started_at: new Date().toISOString(),
      }),
    })
    if (!response.ok) {
      console.error("Twilio voice: unable to create call log", response.status, await response.text().catch(() => ""))
    }
  } catch (error) {
    console.error("Twilio voice: call log insert failed", error)
  }
}

function getBaseUrl(req) {
  const configured = String(process.env.APP_URL || "").trim().replace(/\/$/, "")
  if (configured) return configured
  const host = req.headers?.host
  return host ? `https://${host}` : "https://special-octo-bassoon-iota.vercel.app"
}

function xmlResponse(res, status, xml) {
  res.statusCode = status
  res.setHeader("Content-Type", "text/xml; charset=utf-8")
  res.setHeader("Cache-Control", "no-store")
  res.end(xml)
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return xmlResponse(res, 200, "<Response><Say>Twilio voice endpoint is reachable.</Say></Response>")
    }

    if (req.method !== "POST") {
      return xmlResponse(res, 405, "<Response><Say>Method not allowed.</Say></Response>")
    }

    const to = getParam(req, "CrmTo", "ToNumber", "To")
    const identityParam = getParam(req, "CrmIdentity", "Identity")
    const twilioFrom = getParam(req, "From")
    const callSid = getParam(req, "CallSid")
    const identity = identityParam || twilioFrom
    const lookup = await getProfilePhone(identity)
    const from = lookup.phone

    console.log("Twilio voice request", {
      to,
      identity,
      normalisedIdentity: lookup.authUserId,
      from,
      caller: twilioFrom,
      twilioTo: getParam(req, "To"),
      callSid,
      profileFound: lookup.profileFound,
      matchedBy: lookup.matchedBy,
      reason: lookup.reason,
    })

    if (!from) {
      const message = `Phone lookup failed. Identity received: ${identity || "NULL"}. Lookup UUID: ${lookup.authUserId || "NULL"}. Profile found: ${lookup.profileFound ? "YES" : "NO"}. twilio_phone_number: ${lookup.phone || "NULL"}. ${lookup.reason || "Unknown lookup error"}`
      console.error("Twilio voice: " + message)
      return xmlResponse(res, 200, `<Response><Say>${escapeXml(message)}</Say></Response>`)
    }

    const destination = normalisePhone(to)
    if (!destination || !/^\+?[1-9]\d{7,14}$/.test(destination)) {
      console.error("Twilio voice: invalid destination", to)
      return xmlResponse(res, 200, "<Response><Say>Invalid destination number.</Say></Response>")
    }

    await createCallLog({ userId: lookup.authUserId, callSid, from, to: destination })

    const callbackUrl = `${getBaseUrl(req)}/api/twilio/call-status`
    const xml = `<Response><Dial callerId="${escapeXml(from)}" statusCallback="${escapeXml(callbackUrl)}" statusCallbackMethod="POST" statusCallbackEvent="initiated ringing answered completed"><Number>${escapeXml(destination)}</Number></Dial></Response>`
    console.log("Twilio voice response", { from, destination, callSid, callbackUrl, xml })
    return xmlResponse(res, 200, xml)
  } catch (error) {
    console.error("Twilio voice endpoint error", error)
    return xmlResponse(res, 200, "<Response><Say>Unable to start the call.</Say></Response>")
  }
}

function escapeXml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;")
}

async function getProfilePhone(identity) {
  if (!identity) return null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null

  const response = await fetch(`${url}/rest/v1/profiles?select=twilio_phone_number&id=eq.${encodeURIComponent(identity)}&limit=1`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  })

  if (!response.ok) {
    console.error("Failed to load Twilio phone number from profile", response.status)
    return null
  }

  const rows = await response.json()
  return rows?.[0]?.twilio_phone_number || null
}

export default async function handler(req, res) {
  try {
    const to = req.body?.To || req.query?.To || req.body?.to || req.query?.to
    const identity = req.body?.Identity || req.query?.Identity || req.body?.identity || req.query?.identity
    const from = await getProfilePhone(identity)

    if (!from) {
      return res.status(503).type("text/xml").send("<Response><Say>No Twilio phone number is configured for this user.</Say></Response>")
    }

    if (!to || !/^\+?[1-9]\d{7,14}$/.test(String(to).replace(/[\s()-]/g, ""))) {
      return res.status(400).type("text/xml").send("<Response><Say>Invalid destination number.</Say></Response>")
    }

    const destination = String(to).replace(/[\s()-]/g, "")
    const xml = `<Response><Dial callerId="${escapeXml(from)}"><Number>${escapeXml(destination)}</Number></Dial></Response>`
    res.status(200).type("text/xml").send(xml)
  } catch (error) {
    console.error("Twilio voice endpoint error", error)
    res.status(500).type("text/xml").send("<Response><Say>Unable to start the call.</Say></Response>")
  }
}

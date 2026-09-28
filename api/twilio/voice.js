function escapeXml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;")
}

export default function handler(req, res) {
  const to = req.body?.To || req.query?.To || req.body?.to || req.query?.to
  const from = process.env.TWILIO_PHONE_NUMBER

  if (!from) return res.status(503).type("text/xml").send("<Response><Say>Twilio is not configured.</Say></Response>")
  if (!to || !/^\+?[1-9]\d{7,14}$/.test(String(to).replace(/[\s()-]/g, ""))) {
    return res.status(400).type("text/xml").send("<Response><Say>Invalid destination number.</Say></Response>")
  }

  const destination = String(to).replace(/[\s()-]/g, "")
  const xml = `<Response><Dial callerId="${escapeXml(from)}"><Number>${escapeXml(destination)}</Number></Dial></Response>`
  res.status(200).type("text/xml").send(xml)
}

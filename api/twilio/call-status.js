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

function getSupabaseConfig() {
  return {
    url: String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, ""),
    serviceKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
  }
}

function statusMap(value) {
  const status = String(value || "").toLowerCase()
  if (status === "initiated") return "initiated"
  if (status === "ringing") return "ringing"
  if (status === "answered") return "connected"
  if (status === "completed") return "completed"
  if (status === "busy") return "rejected"
  if (status === "no-answer") return "no_answer"
  if (status === "failed") return "failed"
  if (status === "canceled" || status === "cancelled") return "cancelled"
  return "initiated"
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed")

  const callSid = getParam(req, "CallSid")
  const dialStatus = getParam(req, "DialCallStatus") || getParam(req, "CallStatus")
  const durationRaw = getParam(req, "DialCallDuration")
  const dialCallSid = getParam(req, "DialCallSid")
  const to = getParam(req, "To")
  const from = getParam(req, "From")
  const status = statusMap(dialStatus)
  const { url, serviceKey } = getSupabaseConfig()

  console.log("Twilio call status", { callSid, dialCallSid, dialStatus, status, durationRaw, from, to })

  if (!url || !serviceKey || !callSid) return res.status(200).send("OK")

  try {
    const updates = { status, updated_at: new Date().toISOString() }
    if (from) updates.from_number = from
    if (to) updates.to_number = to
    if (status === "ringing") updates.ringing_at = new Date().toISOString()
    if (status === "connected") updates.answered_at = new Date().toISOString()
    if (["completed", "failed", "cancelled", "rejected", "no_answer"].includes(status)) {
      updates.ended_at = new Date().toISOString()
      const duration = Number(durationRaw)
      if (Number.isFinite(duration) && duration >= 0) updates.duration_seconds = Math.round(duration)
    }
    if (dialCallSid) updates.metadata = { dial_call_sid: dialCallSid, last_twilio_status: dialStatus }

    const response = await fetch(`${url}/rest/v1/call_logs?twilio_call_sid=eq.${encodeURIComponent(callSid)}`, {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(updates),
    })

    if (!response.ok) console.error("Twilio call status: call log update failed", response.status, await response.text().catch(() => ""))
  } catch (error) {
    console.error("Twilio call status error", error)
  }

  return res.status(200).send("OK")
}

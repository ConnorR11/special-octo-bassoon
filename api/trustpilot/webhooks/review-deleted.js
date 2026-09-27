function normaliseEventBody(body) {
  if (!body || typeof body !== "object") return []
  if (Array.isArray(body.events)) return body.events
  if (body.eventName || body.eventData) return [body]
  return []
}

async function supabaseRequest(path, options = {}) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase server credentials are not configured.")
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  })

  const text = await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }

  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`)
  }

  return data
}

async function createIntegrationLog(event, payload) {
  const eventData = event?.eventData || {}
  const rows = await supabaseRequest("integration_event_logs", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      provider: "trustpilot",
      integration_name: "Trustpilot Reviews",
      direction: "inbound",
      event_name: event?.eventName || "service-review-deleted",
      event_type: "webhook",
      external_id: eventData?.id ? String(eventData.id) : null,
      status: "received",
      payload,
    }),
  })

  return Array.isArray(rows) ? rows[0] : null
}

async function updateIntegrationLog(logId, values) {
  if (!logId) return
  await supabaseRequest(`integration_event_logs?id=eq.${encodeURIComponent(logId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ ...values, processed_at: new Date().toISOString() }),
  })
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const events = normaliseEventBody(req.body)
  if (!events.length) return res.status(200).json({ received: true, processed: 0 })

  const results = []
  let hadFailure = false

  for (const event of events) {
    let log = null

    try {
      log = await createIntegrationLog(event, event?.eventData || {})
    } catch (error) {
      console.error("Unable to create Trustpilot deletion integration log:", error)
    }

    if (event?.eventName !== "service-review-deleted") {
      const result = { status: "ignored", reason: "Event is not a Trustpilot review deletion" }
      results.push(result)
      try { await updateIntegrationLog(log?.id, { status: "ignored", http_status: 200, result }) } catch (error) { console.error(error) }
      continue
    }

    try {
      const eventData = event?.eventData || {}
      const reviewId = eventData?.id ? String(eventData.id) : null

      if (!reviewId) {
        const result = { status: "ignored", reason: "Missing Trustpilot review id" }
        results.push(result)
        await updateIntegrationLog(log?.id, { status: "ignored", http_status: 200, result })
        continue
      }

      const existing = await supabaseRequest(
        `reviews?source=eq.trustpilot&external_review_id=eq.${encodeURIComponent(reviewId)}&select=id,customer_id,is_deleted`,
        { method: "GET" },
      )

      if (!Array.isArray(existing) || existing.length === 0) {
        const result = { status: "ignored", reviewId, reason: "Review does not exist in CRM" }
        results.push(result)
        await updateIntegrationLog(log?.id, { status: "ignored", http_status: 200, result })
        continue
      }

      const reviewRowId = existing[0].id
      const deletedAt = new Date().toISOString()

      await supabaseRequest(`reviews?id=eq.${encodeURIComponent(reviewRowId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ is_deleted: true, deleted_at: deletedAt, updated_at: deletedAt }),
      })

      const result = {
        status: "deleted",
        reviewId,
        reviewRowId,
        customerId: existing[0].customer_id || null,
        deletedAt,
      }

      results.push(result)
      await updateIntegrationLog(log?.id, { status: "success", http_status: 200, result })
    } catch (error) {
      hadFailure = true
      const result = {
        status: "failed",
        reviewId: event?.eventData?.id ? String(event.eventData.id) : null,
        error: error instanceof Error ? error.message : String(error),
      }
      results.push(result)
      try {
        await updateIntegrationLog(log?.id, { status: "failed", http_status: 500, error_message: result.error, result })
      } catch (logError) {
        console.error("Unable to record Trustpilot deletion webhook failure:", logError)
      }
      console.error("Trustpilot review deleted webhook error:", error)
    }
  }

  return res.status(hadFailure ? 500 : 200).json({
    received: true,
    processed: results.length,
    results,
  })
}

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
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`)
  }

  return data
}

async function createLog(event, payload) {
  const eventData = event?.eventData || {}
  const rows = await supabaseRequest("trustpilot_webhook_logs", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      event_name: event?.eventName || "unknown",
      review_id: eventData?.id ? String(eventData.id) : null,
      status: "received",
      payload: eventData,
    }),
  })

  return Array.isArray(rows) ? rows[0] : null
}

async function updateLog(logId, values) {
  if (!logId) return

  await supabaseRequest(`trustpilot_webhook_logs?id=eq.${encodeURIComponent(logId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      ...values,
      processed_at: new Date().toISOString(),
    }),
  })
}

function mapReview(eventData) {
  return {
    source: "trustpilot",
    external_review_id: eventData?.id ? String(eventData.id) : null,
    reviewer_name: eventData?.consumer?.name || null,
    reviewer_email: null,
    rating: Number(eventData?.stars),
    title: eventData?.title || null,
    review_text: eventData?.text || null,
    review_date: eventData?.createdAt || null,
    response_text: null,
    responded_at: null,
    invite_type: null,
    reference: eventData?.referenceId ? String(eventData.referenceId) : null,
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  let events

  try {
    events = normaliseEventBody(req.body)
  } catch (error) {
    console.error("Trustpilot webhook body error:", error)
    return res.status(400).json({ error: "Invalid webhook body" })
  }

  const results = []
  let hadFailure = false

  for (const event of events) {
    let log = null

    try {
      log = await createLog(event, event?.eventData || {})
    } catch (error) {
      console.error("Unable to create Trustpilot webhook log:", error)
    }

    if (event?.eventName !== "service-review-created") {
      const result = { status: "ignored", reason: "Event is not a new review" }
      results.push(result)
      try {
        await updateLog(log?.id, { status: "ignored", http_status: 200, result })
      } catch (error) {
        console.error("Unable to update Trustpilot webhook log:", error)
      }
      continue
    }

    try {
      const review = mapReview(event.eventData || {})

      if (!review.external_review_id) {
        const result = { status: "ignored", reason: "Missing Trustpilot review id" }
        results.push(result)
        await updateLog(log?.id, { status: "ignored", http_status: 200, result })
        continue
      }

      if (!Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) {
        const result = { status: "ignored", reviewId: review.external_review_id, reason: "Invalid rating" }
        results.push(result)
        await updateLog(log?.id, { status: "ignored", http_status: 200, result })
        continue
      }

      const existing = await supabaseRequest(
        `reviews?source=eq.trustpilot&external_review_id=eq.${encodeURIComponent(review.external_review_id)}&select=id,customer_id`,
        { method: "GET" },
      )

      let result

      if (Array.isArray(existing) && existing.length > 0) {
        await supabaseRequest(`reviews?id=eq.${encodeURIComponent(existing[0].id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(review),
        })

        result = { status: "updated", reviewId: review.external_review_id }
      } else {
        await supabaseRequest("reviews", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(review),
        })

        result = { status: "created", reviewId: review.external_review_id }
      }

      results.push(result)
      await updateLog(log?.id, { status: "success", http_status: 200, result })
    } catch (error) {
      hadFailure = true
      const result = {
        status: "failed",
        reviewId: event?.eventData?.id ? String(event.eventData.id) : null,
        error: error instanceof Error ? error.message : String(error),
      }

      results.push(result)

      try {
        await updateLog(log?.id, {
          status: "failed",
          http_status: 500,
          error_message: result.error,
          result,
        })
      } catch (logError) {
        console.error("Unable to record Trustpilot webhook failure:", logError)
      }

      console.error("Trustpilot new review webhook error:", error)
    }
  }

  if (!events.length) {
    return res.status(200).json({ received: true, processed: 0 })
  }

  if (hadFailure) {
    return res.status(500).json({
      received: true,
      processed: results.length,
      results,
    })
  }

  return res.status(200).json({
    received: true,
    processed: results.length,
    results,
  })
}

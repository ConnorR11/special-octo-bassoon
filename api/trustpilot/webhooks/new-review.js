function getHeader(req, name) {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

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

  try {
    const events = normaliseEventBody(req.body)
    const newReviewEvents = events.filter((event) => event?.eventName === "service-review-created")

    if (!newReviewEvents.length) {
      return res.status(200).json({ received: true, processed: 0 })
    }

    const results = []

    for (const event of newReviewEvents) {
      const review = mapReview(event.eventData || {})

      if (!review.external_review_id) {
        results.push({ status: "ignored", reason: "Missing Trustpilot review id" })
        continue
      }

      if (!Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) {
        results.push({ status: "ignored", reviewId: review.external_review_id, reason: "Invalid rating" })
        continue
      }

      const existing = await supabaseRequest(
        `reviews?source=eq.trustpilot&external_review_id=eq.${encodeURIComponent(review.external_review_id)}&select=id,customer_id`,
        { method: "GET" },
      )

      if (Array.isArray(existing) && existing.length > 0) {
        await supabaseRequest(`reviews?id=eq.${encodeURIComponent(existing[0].id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(review),
        })

        results.push({ status: "updated", reviewId: review.external_review_id })
      } else {
        await supabaseRequest("reviews", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(review),
        })

        results.push({ status: "created", reviewId: review.external_review_id })
      }
    }

    return res.status(200).json({ received: true, processed: results.length, results })
  } catch (error) {
    console.error("Trustpilot new review webhook error:", error)
    return res.status(500).json({ error: "Webhook processing failed" })
  }
}

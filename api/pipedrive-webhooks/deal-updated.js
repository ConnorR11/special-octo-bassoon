function send(res, status, body) {
  res.status(status).json(body)
}

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body
  let raw = ""
  for await (const chunk of req) raw += chunk
  try { return JSON.parse(raw || "{}") } catch { return {} }
}

async function logEvent(supabaseUrl, serviceRoleKey, values) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/integration_event_logs`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        provider: "pipedrive",
        integration_name: "Pipedrive Webhooks",
        direction: "inbound",
        event_name: values.eventName || "deal.updated",
        event_type: values.eventType || "webhook",
        external_id: values.externalId || null,
        status: values.status || "received",
        http_status: values.httpStatus || null,
        error_message: values.errorMessage || null,
        payload: values.payload || null,
        result: values.result || null,
        processed_at: values.processedAt || null,
      }),
    })
  } catch (error) {
    console.error("Pipedrive integration log failed:", error)
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { success: false, error: "Method not allowed" })

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim()
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
  const pipedriveToken = String(process.env.PIPEDRIVE_API_TOKEN || "").trim()
  const webhookSecret = String(process.env.PIPEDRIVE_WEBHOOK_SECRET || "").trim()

  if (!supabaseUrl || !serviceRoleKey || !pipedriveToken) {
    return send(res, 500, { success: false, error: "Pipedrive integration environment variables are not configured." })
  }

  if (webhookSecret) {
    const suppliedSecret = String(req.query?.secret || getHeader(req, "x-pipedrive-webhook-secret") || "").trim()
    if (!suppliedSecret || suppliedSecret !== webhookSecret) return send(res, 401, { success: false, error: "Invalid webhook secret." })
  }

  const body = await readBody(req)
  const event = body?.event || body?.meta?.event || "deal.updated"
  const dealId = String(
    body?.data?.item?.id ??
    body?.data?.item?.deal_id ??
    body?.data?.id ??
    body?.item?.id ??
    ""
  ).trim()

  const receivedAt = new Date().toISOString()
  const baseLog = {
    eventName: event,
    eventType: "deal",
    externalId: dealId,
    payload: body,
  }

  if (!dealId) {
    await logEvent(supabaseUrl, serviceRoleKey, { ...baseLog, status: "ignored", httpStatus: 200, result: { reason: "No deal ID in webhook payload" }, processedAt: new Date().toISOString() })
    return send(res, 200, { success: true, ignored: true, reason: "No deal ID in webhook payload" })
  }

  try {
    const dealResponse = await fetch(`https://api.pipedrive.com/api/v2/deals/${encodeURIComponent(dealId)}?api_token=${encodeURIComponent(pipedriveToken)}`, { headers: { Accept: "application/json" } })
    const dealJson = await dealResponse.json().catch(() => ({}))
    if (!dealResponse.ok || !dealJson?.success) {
      const message = dealJson?.error || `Pipedrive deal lookup failed with HTTP ${dealResponse.status}.`
      await logEvent(supabaseUrl, serviceRoleKey, { ...baseLog, status: "failed", httpStatus: dealResponse.status, errorMessage: message, result: { dealId }, processedAt: new Date().toISOString() })
      return send(res, 502, { success: false, error: message })
    }

    const deal = dealJson.data || {}
    const personId = deal?.person_id?.value ?? deal?.person_id ?? null
    let customerName = ""

    if (personId) {
      const personResponse = await fetch(`https://api.pipedrive.com/api/v2/persons/${encodeURIComponent(personId)}?api_token=${encodeURIComponent(pipedriveToken)}`, { headers: { Accept: "application/json" } })
      const personJson = await personResponse.json().catch(() => ({}))
      if (personResponse.ok && personJson?.success) {
        customerName = String(personJson?.data?.name || "").trim()
      }
    }

    if (!customerName) {
      customerName = String(deal?.person_name || deal?.person?.name || "").trim()
    }

    if (!customerName) {
      await logEvent(supabaseUrl, serviceRoleKey, { ...baseLog, status: "ignored", httpStatus: 200, result: { reason: "Deal has no customer/person name", dealId }, processedAt: new Date().toISOString() })
      return send(res, 200, { success: true, updated: false, reason: "Deal has no customer/person name" })
    }

    const lookup = await fetch(`${supabaseUrl}/rest/v1/deals?pipedrive_deal_id=eq.${encodeURIComponent(dealId)}&select=id,pipedrive_deal_id,customer_name`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, Accept: "application/json" },
    })
    const existingDeals = await lookup.json().catch(() => [])

    if (!lookup.ok || !Array.isArray(existingDeals) || !existingDeals.length) {
      await logEvent(supabaseUrl, serviceRoleKey, { ...baseLog, status: "ignored", httpStatus: 200, result: { reason: "No matching CRM deal", dealId, customerName }, processedAt: new Date().toISOString() })
      return send(res, 200, { success: true, updated: false, reason: "No matching CRM deal", dealId, customerName })
    }

    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/deals?pipedrive_deal_id=eq.${encodeURIComponent(dealId)}`, {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ customer_name: customerName }),
    })
    const updated = await updateResponse.json().catch(() => [])

    if (!updateResponse.ok) {
      const message = Array.isArray(updated) ? "CRM deal update failed." : String(updated?.message || updated?.error || "CRM deal update failed.")
      await logEvent(supabaseUrl, serviceRoleKey, { ...baseLog, status: "failed", httpStatus: updateResponse.status, errorMessage: message, result: { dealId, customerName }, processedAt: new Date().toISOString() })
      return send(res, 500, { success: false, error: message })
    }

    const result = { dealId, customerName, updatedRows: Array.isArray(updated) ? updated.length : 0, receivedAt }
    await logEvent(supabaseUrl, serviceRoleKey, { ...baseLog, status: "success", httpStatus: 200, result, processedAt: new Date().toISOString() })
    return send(res, 200, { success: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected Pipedrive webhook error."
    await logEvent(supabaseUrl, serviceRoleKey, { ...baseLog, status: "failed", httpStatus: 500, errorMessage: message, processedAt: new Date().toISOString() })
    return send(res, 500, { success: false, error: message })
  }
}

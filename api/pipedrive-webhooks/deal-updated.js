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

function validBasicAuth(req, username, password) {
  if (!username || !password) return true
  const header = String(getHeader(req, "authorization") || "")
  if (!header.toLowerCase().startsWith("basic ")) return false
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8")
    const separator = decoded.indexOf(":")
    if (separator < 0) return false
    return decoded.slice(0, separator) === username && decoded.slice(separator + 1) === password
  } catch {
    return false
  }
}

async function logEvent(supabaseUrl, serviceRoleKey, values) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/integration_event_logs`, {
      method: "POST",
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
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

async function getDealFields(pipedriveToken) {
  const response = await fetch(`https://api.pipedrive.com/api/v2/dealFields?limit=500&api_token=${encodeURIComponent(pipedriveToken)}`, {
    headers: { Accept: "application/json" },
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok || !json?.success) throw new Error(`Pipedrive deal fields lookup failed with HTTP ${response.status}.`)

  const fields = Array.isArray(json.data) ? json.data : []
  const result = {}
  for (const field of fields) {
    // Pipedrive API v2 uses field_name and field_code.
    const fieldName = String(field?.field_name || field?.name || "").trim().toLowerCase()
    const fieldKey = String(field?.field_code || field?.key || "").trim()
    if (fieldName === "installation: start date") result.installationStartDate = { ...field, key: fieldKey }
    if (fieldName === "installation: fit team") result.fitTeam = { ...field, key: fieldKey }
  }
  return result
}

function getCustomFieldValue(deal, key) {
  if (!key) return null
  const customFields = deal?.custom_fields
  if (customFields && typeof customFields === "object") return customFields[key] ?? null
  return deal?.[key] ?? null
}

function unwrapValue(value) {
  let current = value
  for (let i = 0; i < 5; i += 1) {
    if (current === null || current === undefined) return null
    if (typeof current !== "object" || Array.isArray(current)) return current
    if (Object.prototype.hasOwnProperty.call(current, "value")) {
      current = current.value
      continue
    }
    if (Object.prototype.hasOwnProperty.call(current, "date")) {
      current = current.date
      continue
    }
    if (Object.prototype.hasOwnProperty.call(current, "start_date")) {
      current = current.start_date
      continue
    }
    return current
  }
  return current
}

function normaliseDate(value) {
  const unwrapped = unwrapValue(value)
  if (unwrapped === null || unwrapped === undefined || unwrapped === "") return null
  const text = String(unwrapped).trim()
  if (!text) return null
  const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoMatch) return isoMatch[1]
  const ukMatch = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (ukMatch) return `${ukMatch[3]}-${ukMatch[2].padStart(2, "0")}-${ukMatch[1].padStart(2, "0")}`
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function normaliseFitTeam(value, field) {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "object") {
    if (Array.isArray(value)) return value.map((item) => String(item?.label ?? item?.name ?? item?.value ?? item)).filter(Boolean).join(", ") || null
    return String(value.label ?? value.name ?? value.value ?? "").trim() || null
  }

  const optionId = Number(value)
  const options = field?.options || field?.settings?.options || []
  if (Number.isFinite(optionId) && Array.isArray(options)) {
    const option = options.find((item) => Number(item?.id) === optionId)
    if (option?.label) return String(option.label).trim()
  }

  return String(value).trim() || null
}

async function getStageName(pipedriveToken, stageId) {
  if (!stageId) return null
  const response = await fetch(`https://api.pipedrive.com/api/v2/stages/${encodeURIComponent(stageId)}?api_token=${encodeURIComponent(pipedriveToken)}`, {
    headers: { Accept: "application/json" },
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok || !json?.success) return null
  return String(json?.data?.name || "").trim() || null
}

async function getPersonName(pipedriveToken, personId) {
  if (!personId) return null
  const response = await fetch(`https://api.pipedrive.com/api/v2/persons/${encodeURIComponent(personId)}?api_token=${encodeURIComponent(pipedriveToken)}`, {
    headers: { Accept: "application/json" },
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok || !json?.success) return null
  return String(json?.data?.name || "").trim() || null
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { success: false, error: "Method not allowed" })

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim()
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
  const pipedriveToken = String(process.env.PIPEDRIVE_API_TOKEN || "").trim()
  const webhookUsername = String(process.env.PIPEDRIVE_WEBHOOK_USERNAME || "").trim()
  const webhookPassword = String(process.env.PIPEDRIVE_WEBHOOK_PASSWORD || "").trim()

  if (!supabaseUrl || !serviceRoleKey || !pipedriveToken) return send(res, 500, { success: false, error: "Pipedrive integration environment variables are not configured." })
  if (!validBasicAuth(req, webhookUsername, webhookPassword)) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Pipedrive Webhook"')
    return send(res, 401, { success: false, error: "Invalid webhook credentials." })
  }

  const body = await readBody(req)
  const event = body?.event || body?.meta?.event || "deal.updated"
  const dealId = String(body?.data?.item?.id ?? body?.data?.item?.deal_id ?? body?.data?.id ?? body?.item?.id ?? "").trim()
  const receivedAt = new Date().toISOString()
  const baseLog = { eventName: event, eventType: "deal", externalId: dealId, payload: body }

  if (!dealId) {
    await logEvent(supabaseUrl, serviceRoleKey, { ...baseLog, status: "ignored", httpStatus: 200, result: { reason: "No deal ID in webhook payload" }, processedAt: new Date().toISOString() })
    return send(res, 200, { success: true, ignored: true, reason: "No deal ID in webhook payload" })
  }

  try {
    const fields = await getDealFields(pipedriveToken)
    const customFieldKeys = [fields.installationStartDate?.key, fields.fitTeam?.key].filter(Boolean)

    const dealUrl = new URL(`https://api.pipedrive.com/api/v2/deals/${encodeURIComponent(dealId)}`)
    dealUrl.searchParams.set("api_token", pipedriveToken)
    // v2 requires custom_fields as an optional response field and can then be limited to specific field codes.
    dealUrl.searchParams.set("include_fields", "custom_fields")
    if (customFieldKeys.length) dealUrl.searchParams.set("custom_fields", customFieldKeys.join(","))
    dealUrl.searchParams.set("include_option_labels", "true")

    const dealResponse = await fetch(dealUrl.toString(), { headers: { Accept: "application/json" } })
    const dealJson = await dealResponse.json().catch(() => ({}))
    if (!dealResponse.ok || !dealJson?.success) {
      const message = dealJson?.error || `Pipedrive deal lookup failed with HTTP ${dealResponse.status}.`
      await logEvent(supabaseUrl, serviceRoleKey, { ...baseLog, status: "failed", httpStatus: dealResponse.status, errorMessage: message, result: { dealId }, processedAt: new Date().toISOString() })
      return send(res, 502, { success: false, error: message })
    }

    const deal = dealJson.data || {}
    const rawInstallationStartDate = getCustomFieldValue(deal, fields.installationStartDate?.key)
    const installationStartDate = normaliseDate(rawInstallationStartDate)
    const fitTeam1 = normaliseFitTeam(getCustomFieldValue(deal, fields.fitTeam?.key), fields.fitTeam)
    const pipedriveStage = await getStageName(pipedriveToken, deal?.stage_id) || String(deal?.stage_name || deal?.stage?.name || "").trim() || null

    const personId = deal?.person_id?.value ?? deal?.person_id ?? null
    const customerName = await getPersonName(pipedriveToken, personId) || String(deal?.person_name || deal?.person?.name || "").trim() || null

    const lookup = await fetch(`${supabaseUrl}/rest/v1/deals?pipedrive_deal_id=eq.${encodeURIComponent(dealId)}&select=id,pipedrive_deal_id,customer_name,installation_start_date,fit_team_1,pipedrive_stage`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, Accept: "application/json" },
    })
    const existingDeals = await lookup.json().catch(() => [])
    if (!lookup.ok || !Array.isArray(existingDeals) || !existingDeals.length) {
      await logEvent(supabaseUrl, serviceRoleKey, { ...baseLog, status: "ignored", httpStatus: 200, result: { reason: "No matching CRM deal", dealId, customerName, installationStartDate, fitTeam1, pipedriveStage }, processedAt: new Date().toISOString() })
      return send(res, 200, { success: true, updated: false, reason: "No matching CRM deal", dealId })
    }

    const updatePayload = {
      customer_name: customerName,
      installation_start_date: installationStartDate,
      fit_team_1: fitTeam1,
      pipedrive_stage: pipedriveStage,
    }

    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/deals?pipedrive_deal_id=eq.${encodeURIComponent(dealId)}`, {
      method: "PATCH",
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(updatePayload),
    })
    const updated = await updateResponse.json().catch(() => [])
    if (!updateResponse.ok) {
      const message = Array.isArray(updated) ? "CRM deal update failed." : String(updated?.message || updated?.error || "CRM deal update failed.")
      await logEvent(supabaseUrl, serviceRoleKey, { ...baseLog, status: "failed", httpStatus: updateResponse.status, errorMessage: message, result: { dealId, updatePayload }, processedAt: new Date().toISOString() })
      return send(res, 500, { success: false, error: message })
    }

    const result = { dealId, customerName, installationStartDate, fitTeam1, pipedriveStage, updatedRows: Array.isArray(updated) ? updated.length : 0, receivedAt }
    await logEvent(supabaseUrl, serviceRoleKey, { ...baseLog, status: "success", httpStatus: 200, result, processedAt: new Date().toISOString() })
    return send(res, 200, { success: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected Pipedrive webhook error."
    await logEvent(supabaseUrl, serviceRoleKey, { ...baseLog, status: "failed", httpStatus: 500, errorMessage: message, processedAt: new Date().toISOString() })
    return send(res, 500, { success: false, error: message })
  }
}

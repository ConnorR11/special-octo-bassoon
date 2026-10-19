import { createClient } from "@supabase/supabase-js"

function mapValidation(item) {
  const id = Number(item?.id)
  if (!Number.isSafeInteger(id) || id <= 0) return null

  const first = item.customer_first_name || null
  const last = item.customer_last_name || null
  const fullName = item.customer_full_name || [first, last].filter(Boolean).join(" ") || null
  const address = item.installation_address_full ||
    [item.installation_address_line_1, item.installation_address_line_2, item.installation_address_line_3, item.installation_area_town, item.installation_county]
      .filter(Boolean).join(", ") || null
  const statusName = item.validation_status?.name || item.validation_status?.status || item.status || null
  const productName = item.product_type?.name || item.product_type?.title || null

  return {
    epvs_validation_id: id,
    customer_first_name: first,
    customer_last_name: last,
    customer_full_name: fullName,
    customer_phone: item.customer_phone || null,
    customer_email: item.customer_email || null,
    installation_address: address,
    installation_postcode: item.installation_postcode || null,
    product_type_id: item.product_type_id == null ? null : Number(item.product_type_id),
    validation_status_id: item.validation_status_id == null ? null : Number(item.validation_status_id),
    status: statusName,
    contract_value: item.total_contract_value == null || item.total_contract_value === "" ? null : Number(item.total_contract_value),
    contract_signed_at: item.date_contract_signed || null,
    epvs_created_at: item.created_at || null,
    epvs_updated_at: item.updated_at || null,
    last_activity_at: item.last_activity_at || null,
    last_synced_at: new Date().toISOString(),
    raw_payload: item,
    updated_at: new Date().toISOString(),
  }
}

const json = (res, status, body) => {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Cache-Control", "no-store")
  return res.status(status).json(body)
}

async function logWebhook(supabase, { status, httpStatus, errorMessage = null, payload = {}, result = null }) {
  try {
    const { error } = await supabase.from("integration_event_logs").insert({
      provider: "epvs",
      integration_name: "EPVS Validation Hub Webhook",
      direction: "inbound",
      event_name: "epvs_webhook",
      event_type: payload?.event || payload?.event_type || payload?.type || "validation_event",
      external_id: payload?.data?.validation_id || payload?.validation_id || payload?.data?.id || payload?.id || null,
      status,
      http_status: httpStatus,
      error_message: errorMessage ? String(errorMessage).slice(0, 2000) : null,
      payload,
      result,
      received_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
    })
    if (error) console.error("EPVS webhook log insert failed", error.message)
  } catch (error) {
    console.error("EPVS webhook log insert failed", error instanceof Error ? error.message : String(error))
  }
}

function getWebhookData(body) {
  const data = body?.data && typeof body.data === "object" ? body.data : body
  const validation = data?.validation && typeof data.validation === "object" ? data.validation
    : data?.validation_data && typeof data.validation_data === "object" ? data.validation_data
    : data
  const id = Number(data?.validation_id ?? validation?.validation_id ?? validation?.id ?? body?.validation_id ?? body?.id)
  const statusId = data?.status_id ?? validation?.validation_status_id ?? body?.status_id
  const statusName = data?.status_name ?? validation?.validation_status?.name ?? validation?.validation_status?.status ?? validation?.status_name ?? validation?.status ?? body?.status_name
  return { data, validation, id, statusId, statusName }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." })

  const expectedSecret = String(process.env.EPVS_WEBHOOK_SECRET || "").trim()
  if (!expectedSecret) return json(res, 503, { error: "EPVS webhook secret is not configured." })
  const suppliedSecret = String(req.query?.secret || req.headers["x-epvs-webhook-secret"] || "").trim()
  if (!suppliedSecret || suppliedSecret !== expectedSecret) {
    return json(res, 401, { error: "Unauthorized webhook request." })
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim()
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
  const epvsToken = String(process.env.EPVS_TOKEN || "").trim()
  if (!supabaseUrl || !serviceKey || !epvsToken) return json(res, 500, { error: "Server integration configuration is missing." })

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const body = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body) } catch { return null } })() : req.body
  if (!body || typeof body !== "object") {
    await logWebhook(supabase, { status: "failed", httpStatus: 400, errorMessage: "Invalid JSON webhook body." })
    return json(res, 400, { error: "Invalid JSON webhook body." })
  }

  try {
    const { data, validation, id, statusId, statusName } = getWebhookData(body)
    if (!Number.isSafeInteger(id) || id <= 0) {
      await logWebhook(supabase, { status: "ignored", httpStatus: 200, errorMessage: "Webhook did not contain a validation ID.", payload: body })
      return json(res, 200, { received: true, ignored: true, reason: "No validation ID was provided." })
    }

    let item = validation && (validation.customer_first_name || validation.customer_full_name || validation.installation_address_line_1 || validation.total_contract_value != null)
      ? validation : null

    // Status-only webhooks do not contain the full application. Fetch the current
    // validation from EPVS so new applications can be inserted and existing ones refreshed.
    if (!item) {
      const epvsResponse = await fetch(`https://www.validationhub.co.uk/api/v1/validations/${id}`, {
        method: "GET",
        headers: { Authorization: "Bearer " + epvsToken, Accept: "application/json" },
        signal: AbortSignal.timeout(20000),
      })
      const responseText = await epvsResponse.text()
      let responseData
      try { responseData = JSON.parse(responseText) } catch { responseData = null }
      if (epvsResponse.ok) {
        item = responseData?.data?.validation || responseData?.data || responseData?.validation || responseData
      } else {
        // If EPVS cannot return the full record, still apply status updates to an
        // already-imported application rather than losing a valid status webhook.
        const update = { last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        if (statusId != null && Number.isFinite(Number(statusId))) update.validation_status_id = Number(statusId)
        if (statusName != null && String(statusName).trim()) update.status = String(statusName).trim()
        const { data: updated, error } = await supabase.from("epvs_submissions")
          .update(update).eq("epvs_validation_id", id).select("id").maybeSingle()
        if (error) throw error
        if (!updated) {
          await logWebhook(supabase, { status: "failed", httpStatus: epvsResponse.status, errorMessage: "Unable to retrieve full validation and no existing CRM application matched.", payload: body, result: { validationId: id, epvsHttpStatus: epvsResponse.status } })
          return json(res, 502, { received: true, error: "Could not retrieve the EPVS application to create it in the CRM.", epvsHttpStatus: epvsResponse.status })
        }
        await logWebhook(supabase, { status: "success", httpStatus: 200, payload: body, result: { validationId: id, updatedExisting: true, statusOnly: true } })
        return json(res, 200, { received: true, updated: true, validationId: id, statusOnly: true })
      }
    }

    if (!item || Number(item.id ?? item.validation_id ?? id) !== id) {
      item = { ...(item || {}), id }
    }
    if (statusId != null && item.validation_status_id == null) item.validation_status_id = statusId
    if (statusName != null && !item.validation_status && !item.status) item.status = statusName

    const mapped = mapValidation(item)
    if (!mapped) throw new Error("Could not map webhook validation to an EPVS application.")
    const { data: saved, error: saveError } = await supabase.from("epvs_submissions")
      .upsert(mapped, { onConflict: "epvs_validation_id" })
      .select("id,epvs_validation_id,linked_deal_id")
      .single()
    if (saveError) throw saveError

    const result = { validationId: id, crmApplicationId: saved.id, linkedDealPreserved: Boolean(saved.linked_deal_id) }
    await logWebhook(supabase, { status: "success", httpStatus: 200, payload: body, result })
    return json(res, 200, { received: true, createdOrUpdated: true, ...result })
  } catch (error) {
    console.error("EPVS webhook processing failed", error instanceof Error ? error.message : String(error))
    await logWebhook(supabase, { status: "failed", httpStatus: 500, errorMessage: error instanceof Error ? error.message : String(error), payload: body })
    return json(res, 500, { error: "EPVS webhook processing failed." })
  }
}

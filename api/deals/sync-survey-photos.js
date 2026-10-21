import { createClient } from "@supabase/supabase-js"

function json(res, status, body) {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Cache-Control", "no-store")
  return res.status(status).json(body)
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." })
  const authorization = String(req.headers?.authorization || "")
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : ""
  if (!accessToken) return json(res, 401, { error: "Please sign in before syncing the survey PDF." })

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const pipedriveToken = process.env.PIPEDRIVE_API_TOKEN
  if (!supabaseUrl || !serviceKey) return json(res, 500, { error: "Supabase server configuration is missing." })
  if (!pipedriveToken) return json(res, 500, { error: "PIPEDRIVE_API_TOKEN is not configured." })

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  let logRowId = null
  async function finishLog(status, httpStatus, errorMessage, result) {
    if (!logRowId) return
    const update = {
      status,
      http_status: httpStatus,
      error_message: errorMessage || null,
      result: result || {},
      processed_at: new Date().toISOString(),
    }
    const { error } = await supabase.from("integration_event_logs").update(update).eq("id", logRowId)
    if (error) console.error("Unable to update survey photos integration log:", error.message)
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !authData?.user) return json(res, 401, { error: "Your session has expired. Please sign in again." })

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {})
    const dealId = String(body.deal_id || "").trim()
    const documentId = String(body.document_id || "").trim()
    if (!dealId || !documentId) return json(res, 400, { error: "deal_id and document_id are required." })

    const { data: logRow, error: logError } = await supabase.from("integration_event_logs").insert({
      provider: "pipedrive",
      integration_name: "Survey Photos PDF Sync",
      direction: "outbound",
      event_name: "survey_photos_pdf_sync",
      event_type: "survey_photos_url_update",
      external_id: documentId,
      status: "received",
      received_at: new Date().toISOString(),
      payload: { deal_id: dealId, document_id: documentId, triggered_by: authData.user.email || authData.user.id },
    }).select("id").single()
    if (logError) console.error("Unable to create survey photos integration log:", logError.message)
    logRowId = logRow?.id || null

    const { data: document, error: documentError } = await supabase.from("deal_documents")
      .select("id,deal_id,category,file_name,storage_path")
      .eq("id", documentId).eq("deal_id", dealId).eq("category", "survey_pdf").maybeSingle()
    if (documentError) throw documentError
    if (!document) {
      const message = "Generated survey PDF was not found for this deal."
      await finishLog("failed", 404, message, { success: false })
      return json(res, 404, { error: message })
    }

    const { data: deal, error: dealError } = await supabase.from("deals")
      .select("id,pipedrive_deal_id").eq("id", dealId).maybeSingle()
    if (dealError) throw dealError
    if (!deal) {
      const message = "CRM deal not found."
      await finishLog("failed", 404, message, { success: false })
      return json(res, 404, { error: message })
    }
    if (!deal.pipedrive_deal_id) {
      const message = "This CRM deal is not linked to a Pipedrive deal."
      await finishLog("failed", 409, message, { success: false })
      return json(res, 409, { error: message })
    }

    async function pipedriveRequest(path, options = {}) {
      const response = await fetch("https://api.pipedrive.com/v1/" + path + (path.includes("?") ? "&" : "?") + "api_token=" + encodeURIComponent(pipedriveToken), {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || payload.error_info || ("Pipedrive request failed (HTTP " + response.status + ")."))
      }
      return payload.data
    }

    const fields = await pipedriveRequest("dealFields")
    const normalise = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "")
    const field = (fields || []).find(item => normalise(item.name || item.field_name || item.label) === "surveyphotos")
    if (!field || !field.key) {
      const surveyFields = (fields || [])
        .filter(item => normalise(item.name || item.field_name || item.label).includes("survey"))
        .map(item => ({ name: item.name || item.field_name || item.label || null, key: item.key || item.field_code || null }))
      const message = 'Could not find the Pipedrive deal custom field named "Survey: Photos".'
      await finishLog("failed", 500, message, { success: false, surveyFields: surveyFields })
      return json(res, 500, { error: message, surveyFields: surveyFields })
    }

    const baseUrl = (process.env.CRM_BASE_URL || "https://crm.homeshield.ltd").replace(/\/+$/, "")
    const stableUrl = baseUrl + "/survey-pdf/?document_id=" + encodeURIComponent(document.id)
    const updateResult = await pipedriveRequest("deals/" + encodeURIComponent(deal.pipedrive_deal_id), {
      method: "PUT",
      body: JSON.stringify({ [field.key]: stableUrl }),
    })
    await finishLog("success", 200, null, {
      success: true,
      pipedrive_deal_id: deal.pipedrive_deal_id,
      field_name: field.name || field.field_name || field.label || "Survey: Photos",
      field_key: field.key,
      url: stableUrl,
      pipedrive_updated: Boolean(updateResult),
    })
    return json(res, 200, { success: true, url: stableUrl, message: 'Survey PDF URL saved to Pipedrive field "Survey: Photos".' })
  } catch (error) {
    const message = error?.message || "Unable to sync survey PDF URL to Pipedrive."
    console.error("Unable to sync survey PDF URL to Pipedrive:", message)
    await finishLog("failed", 502, message, { success: false })
    return json(res, 502, { error: message })
  }
}

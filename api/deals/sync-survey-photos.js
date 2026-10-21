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
  const finishLog = async ({ status, httpStatus, errorMessage = null, result = {} }) => {
    if (!logRowId) return
    const { error } = await supabase.from("integration_event_logs").update({
      status, http_status: httpStatus, error_message: errorMessage, result,
      processed_at: new Date().toISOString(),
    }).eq("id", logRowId)
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
    const { data: document, error: docError } = await supabase.from("deal_documents")
      .select("id,deal_id,category,file_name,storage_path").eq("id", documentId).eq("deal_id", dealId).eq("category", "survey_pdf").maybeSingle()
    if (docError) throw docError
    if (!document) {
      const message = "Generated survey PDF was not found for this deal."
      await finishLog({ status: "failed", httpStatus: 404, errorMessage: message, result: { success: false } })
      return json(res, 404, { error: message })
    }
    const { data: deal, error: dealError } = await supabase.from("deals").select("id,pipedrive_deal_id").eq("id", dealId).maybeSingle()
    if (dealError) throw dealError
    if (!deal) {
      const message = "CRM deal not found."
      await finishLog({ status: "failed", httpStatus: 404, errorMessage: message, result: { success: false } })
      return json(res, 404, { error: message })
    }
    if (!deal.pipedrive_deal_id) {
      const message = "This CRM deal is not linked to a Pipedrive deal."
      await finishLog({ status: "failed", httpStatus: 409, errorMessage: message, result: { success: false } })
      return json(res, 409, { error: message })
    }
    const pipedriveRequest = async (path, options = {}) => {
      const response = await fetch(`https://api.pipedrive.com/v1/${path}${path.includes("?") ? "&" : "?"}api_token=${encodeURIComponent(pipedriveToken)}`, {
        ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload.success === false) throw new Error(payload.error || payload.error_info || `Pipedrive request failed (HTTP ${response.status}).`)
      return payload.data
    }
    const fields = await pipedriveRequest("dealFields")
    const field = (fields || []).find(item => String(item.name || "").trim().toLowerCase() === "survey: photos")
    if (!field?.key) return json(res, 500, { error: 'Could not find the Pipedrive deal custom field named "Survey: Photos". Check the exact field name and that it is a deal field.' })
    const baseUrl = (process.env.CRM_BASE_URL || "https://crm.homeshield.ltd").replace(/\\/+$/, "")
    const stableUrl = `${baseUrl}/survey-pdf/?document_id=${encodeURIComponent(document.id)}`
    await pipedriveRequest(`deals/${encodeURIComponent(deal.pipedrive_deal_id)}`, { method: "PUT", body: JSON.stringify({ [field.key]: stableUrl }) })
    return json(res, 200, { success: true, url: stableUrl, message: 'Survey PDF URL saved to Pipedrive field "Survey: Photos".' })
  } catch (error) {
    console.error("Unable to sync survey PDF URL to Pipedrive:", error?.message || error)
    return json(res, 502, { error: error?.message || "Unable to sync survey PDF URL to Pipedrive." })
  }
}

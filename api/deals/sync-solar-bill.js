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
  if (!accessToken) return json(res, 401, { error: "Please sign in before syncing the solar energy bill." })

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
    if (error) console.error("Unable to update solar energy bill integration log:", error.message)
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
      integration_name: "Solar Energy Bill Sync",
      direction: "outbound",
      event_name: "electricity_bill_epvs_waiver_sync",
      event_type: "electricity_bill_epvs_waiver_url_update",
      external_id: documentId,
      status: "received",
      received_at: new Date().toISOString(),
      payload: { deal_id: dealId, document_id: documentId, triggered_by: authData.user.email || authData.user.id },
    }).select("id").single()
    if (logError) {
      console.error("Unable to create solar energy bill integration log:", logError.message)
    }
    logRowId = logRow?.id || null

    const { data: document, error: documentError } = await supabase
      .from("deal_documents").select("id,deal_id,category,file_name,storage_path,mime_type")
      .eq("id", documentId).eq("deal_id", dealId).eq("category", "electricity_bill_epvs_waiver").maybeSingle()
    if (documentError) throw documentError
    if (!document) {
      await finishLog({ status: "failed", httpStatus: 404, errorMessage: "Solar energy bill was not found for this deal.", result: { success: false } })
      return json(res, 404, { error: "Survey video was not found for this deal." })
    }

    const { data: deal, error: dealError } = await supabase
      .from("deals").select("id,pipedrive_deal_id,customer_name,contract_number")
      .eq("id", dealId).maybeSingle()
    if (dealError) throw dealError
    if (!deal) {
      await finishLog({ status: "failed", httpStatus: 404, errorMessage: "CRM deal not found.", result: { success: false } })
      return json(res, 404, { error: "CRM deal not found." })
    }
    if (!deal.pipedrive_deal_id) {
      const message = "This CRM deal is not linked to a Pipedrive deal, so the solar energy bill could not be synced."
      await finishLog({ status: "failed", httpStatus: 409, errorMessage: message, result: { success: false } })
      return json(res, 409, { error: message })
    }

    const pipedriveRequest = async (path, options = {}) => {
      const separator = path.includes("?") ? "&" : "?"
      const response = await fetch(`https://api.pipedrive.com/v1/${path}${separator}api_token=${encodeURIComponent(pipedriveToken)}`, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload.success === false) throw new Error(payload.error || payload.error_info || `Pipedrive request failed (HTTP ${response.status}).`)
      return payload.data
    }

    // Store a stable CRM URL in Pipedrive. The CRM route authenticates the user and
    // generates a short-lived storage URL only when the video is opened.
    const crmBaseUrl = (process.env.CRM_BASE_URL || "https://crm.homeshield.ltd").replace(/\/+$/, "")
    const stableBillUrl = `${crmBaseUrl}/solar-bill/?document_id=${encodeURIComponent(document.id)}`

    const fields = await pipedriveRequest("dealFields")
    const surveyField = (fields || []).find(field => String(field.name || "").trim().toLowerCase() === "solar energy bill")
    if (!surveyField?.key) {
      const message = 'Could not find the Pipedrive deal custom field named "Solar Energy Bill". Check its exact field name and that it is a deal field.'
      await finishLog({ status: "failed", httpStatus: 500, errorMessage: message, result: { success: false } })
      return json(res, 500, { error: message })
    }

    await pipedriveRequest(`deals/${encodeURIComponent(deal.pipedrive_deal_id)}`, {
      method: "PUT",
      body: JSON.stringify({ [surveyField.key]: stableBillUrl }),
    })

    await finishLog({ status: "success", httpStatus: 200, result: { success: true, pipedrive_deal_id: String(deal.pipedrive_deal_id), document_id: document.id, file_name: document.file_name, url: stableBillUrl } })

    return json(res, 200, {
      success: true,
      message: 'Solar energy bill URL saved to Pipedrive field "Solar Energy Bill".',
      url: stableVideoUrl,
    })
  } catch (error) {
    console.error("Unable to sync solar energy bill to Pipedrive:", error)
    await finishLog({ status: "failed", httpStatus: 502, errorMessage: error?.message || "Unable to sync solar energy bill to Pipedrive.", result: { success: false } })
    return json(res, 502, { error: error?.message || "Unable to sync solar energy bill to Pipedrive." })
  }
}

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
  if (!accessToken) return json(res, 401, { error: "Please sign in before syncing the survey video." })

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const pipedriveToken = process.env.PIPEDRIVE_API_TOKEN
  if (!supabaseUrl || !serviceKey) return json(res, 500, { error: "Supabase server configuration is missing." })
  if (!pipedriveToken) return json(res, 500, { error: "PIPEDRIVE_API_TOKEN is not configured." })

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !authData?.user) return json(res, 401, { error: "Your session has expired. Please sign in again." })

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {})
    const dealId = String(body.deal_id || "").trim()
    const documentId = String(body.document_id || "").trim()
    if (!dealId || !documentId) return json(res, 400, { error: "deal_id and document_id are required." })

    const { data: document, error: documentError } = await supabase
      .from("deal_documents").select("id,deal_id,category,file_name,storage_path,mime_type")
      .eq("id", documentId).eq("deal_id", dealId).eq("category", "survey_video").maybeSingle()
    if (documentError) throw documentError
    if (!document) return json(res, 404, { error: "Survey video was not found for this deal." })

    const { data: deal, error: dealError } = await supabase
      .from("deals").select("id,pipedrive_deal_id,customer_name,contract_number")
      .eq("id", dealId).maybeSingle()
    if (dealError) throw dealError
    if (!deal) return json(res, 404, { error: "CRM deal not found." })
    if (!deal.pipedrive_deal_id) return json(res, 409, { error: "This CRM deal is not linked to a Pipedrive deal, so the survey video could not be synced." })

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

    // Survey videos remain in the private bucket. Use a long-lived signed URL rather than making customer video files public.
    const { data: signed, error: signedError } = await supabase.storage
      .from("deal-documents").createSignedUrl(document.storage_path, 31536000, { download: document.file_name })
    if (signedError) throw signedError
    if (!signed?.signedUrl) throw new Error("Supabase did not return a signed video URL.")

    const fields = await pipedriveRequest("dealFields")
    const surveyField = (fields || []).find(field => String(field.name || "").trim().toLowerCase() === "survey: file")
    if (!surveyField?.key) return json(res, 500, { error: 'Could not find the Pipedrive deal custom field named "Survey: File". Check its exact field name and that it is a deal field.' })

    await pipedriveRequest(`deals/${encodeURIComponent(deal.pipedrive_deal_id)}`, {
      method: "PUT",
      body: JSON.stringify({ [surveyField.key]: signed.signedUrl }),
    })

    return json(res, 200, {
      success: true,
      message: 'Survey video URL saved to Pipedrive field "Survey: File".',
      expires_in_days: 365,
    })
  } catch (error) {
    console.error("Unable to sync solar survey video to Pipedrive:", error)
    return json(res, 502, { error: error?.message || "Unable to sync survey video to Pipedrive." })
  }
}

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
  if (!accessToken) return json(res, 401, { error: "Please sign in to open this solar energy bill." })

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return json(res, 500, { error: "Storage configuration is missing." })

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken)
    if (userError || !userData?.user) return json(res, 401, { error: "Your session has expired. Please sign in again." })
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {})
    const documentId = String(body.document_id || "").trim()
    if (!documentId) return json(res, 400, { error: "The solar energy bill reference is missing." })

    const { data: document, error: documentError } = await supabase
      .from("deal_documents")
      .select("id,deal_id,category,storage_path")
      .eq("id", documentId)
      .eq("category", "electricity_bill_epvs_waiver")
      .maybeSingle()
    if (documentError) throw documentError
    if (!document) return json(res, 404, { error: "Solar energy bill not found." })

    const { data: signed, error: signedError } = await supabase.storage
      .from("deal-documents").createSignedUrl(document.storage_path, 300)
    if (signedError || !signed?.signedUrl) return json(res, 404, { error: "Solar energy bill file could not be found." })
    return json(res, 200, { url: signed.signedUrl })
  } catch (error) {
    console.error("Open solar energy bill failed:", error?.message || error)
    return json(res, 500, { error: "Unable to open this solar energy bill right now." })
  }
}

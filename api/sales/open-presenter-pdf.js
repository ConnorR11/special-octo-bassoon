import { createClient } from "@supabase/supabase-js"

const json = (res, status, body) => {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Cache-Control", "no-store")
  return res.status(status).json(body)
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." })
  const authorization = req.headers?.authorization || ""
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : ""
  if (!token) return json(res, 401, { error: "Please sign in to open the presenter." })

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return json(res, 500, { error: "Storage configuration is missing." })

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user) return json(res, 401, { error: "Your session has expired. Please sign in again." })
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {})
    const path = String(body.path || "")
    if (path !== "Homeshield-Solar-Presenter-edited.pdf" && path !== "Homeshield-Solar-Presenter-no-page-29.pdf") {
      return json(res, 400, { error: "Invalid presenter file reference." })
    }
    const { data, error } = await supabase.storage.from("presenters").createSignedUrl(path, 1800)
    if (error || !data?.signedUrl) return json(res, 404, { error: "The presenter PDF has not been uploaded to private storage yet." })
    return json(res, 200, { url: data.signedUrl })
  } catch (error) {
    console.error("Open sales presenter failed:", error)
    return json(res, 500, { error: "Unable to open the Sales Presenter." })
  }
}

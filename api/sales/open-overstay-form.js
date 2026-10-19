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
  if (!token) return json(res, 401, { error: "Please sign in to open this overstay form." })
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return json(res, 500, { error: "Storage configuration is missing." })
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user) return json(res, 401, { error: "Your session has expired. Please sign in again." })
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {})
    const path = String(body.path || "").trim()
    if (!path || path.includes("..") || path.startsWith("/") || path.split("/").length !== 2) {
      return json(res, 400, { error: "Invalid overstay form reference." })
    }
    const appointmentRowId = path.split("/")[0]
    const { data: appointment, error: appointmentError } = await supabase.from("appointments")
      .select("appointment_row_id,overstay_form_link").eq("appointment_row_id", appointmentRowId).maybeSingle()
    if (appointmentError) throw appointmentError
    if (!appointment || appointment.overstay_form_link !== path) return json(res, 404, { error: "Overstay form not found." })
    const { data, error } = await supabase.storage.from("overstay-forms").createSignedUrl(path, 300)
    if (error || !data?.signedUrl) return json(res, 404, { error: "Overstay form file could not be found." })
    return json(res, 200, { url: data.signedUrl })
  } catch (error) {
    console.error("Open overstay form failed:", error?.message || error)
    return json(res, 500, { error: "Unable to open this overstay form right now." })
  }
}

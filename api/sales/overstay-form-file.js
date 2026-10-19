import { createClient } from "@supabase/supabase-js"

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).send("Method not allowed.")
  }

  const path = String(req.query?.path || "").trim()
  if (!path || path.includes("..") || path.startsWith("/") || path.split("/").length !== 2) {
    return res.status(400).send("Invalid overstay form reference.")
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return res.status(500).send("Overstay form storage is not configured.")

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const appointmentRowId = path.split("/")[0]
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("appointment_row_id,overstay_form_link")
      .eq("appointment_row_id", appointmentRowId)
      .maybeSingle()
    if (appointmentError) throw appointmentError
    if (!appointment || appointment.overstay_form_link !== path) {
      return res.status(404).send("Overstay form not found.")
    }

    const { data, error } = await supabase.storage.from("overstay-forms").createSignedUrl(path, 60)
    if (error || !data?.signedUrl) return res.status(404).send("Overstay form file could not be found.")

    res.setHeader("Cache-Control", "no-store")
    return res.redirect(302, data.signedUrl)
  } catch (error) {
    console.error("Open overstay form failed:", error?.message || error)
    return res.status(500).send("Unable to open the overstay form right now.")
  }
}

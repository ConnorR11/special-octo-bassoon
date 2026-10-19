import { createClient } from "@supabase/supabase-js"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

const json = (res, status, body) => {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Cache-Control", "no-store")
  return res.status(status).json(body)
}
const safe = value => String(value ?? "").trim()
const formatDate = value => {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" })
}
const wrapText = (text, font, size, maxWidth) => {
  const words = String(text || "—").split(/\s+/)
  const lines = []
  let line = ""
  for (const word of words) {
    const candidate = line ? line + " " + word : word
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = candidate
  }
  if (line) lines.push(line)
  return lines
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." })
  const authorization = req.headers?.authorization || ""
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : ""
  if (!accessToken) return json(res, 401, { error: "Please sign in again before generating the overstay form." })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return json(res, 500, { error: "Overstay form storage is not configured." })
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  let logId = null
  const finishLog = async (status, httpStatus, errorMessage = null, result = {}) => {
    if (!logId) return
    const { error } = await supabase.from("integration_event_logs").update({
      status, http_status: httpStatus, error_message: errorMessage, result, processed_at: new Date().toISOString(),
    }).eq("id", logId)
    if (error) console.error("Unable to update overstay form integration log:", error.message)
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !authData?.user) return json(res, 401, { error: "Your session has expired. Please sign in again." })
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {})
    const appointmentRowId = safe(body.appointment_row_id)
    const reason = safe(body.reason)
    if (!appointmentRowId || !reason) return json(res, 400, { error: "Appointment and overstay reason are required." })
    if (reason.length > 3000) return json(res, 400, { error: "The overstay reason must be 3,000 characters or fewer." })

    const { data: logRow, error: logError } = await supabase.from("integration_event_logs").insert({
      provider: "supabase_storage",
      integration_name: "Overstay Form PDF",
      direction: "outbound",
      event_name: "overstay_form_generate",
      event_type: "pdf_generation_and_storage",
      external_id: appointmentRowId,
      status: "started",
      received_at: new Date().toISOString(),
      payload: { appointment_row_id: appointmentRowId, reason_length: reason.length, triggered_by: authData.user.email || authData.user.id },
    }).select("id").single()
    if (logError) console.error("Unable to create overstay form integration log:", logError.message)
    else logId = logRow?.id || null

    const { data: appointment, error: appointmentError } = await supabase.from("appointments")
      .select("appointment_row_id,name,address,postcode,phone_number_1,email_address,job_type,product,branch,rep_allocated,rep_arrival_time,result,appointment_date")
      .eq("appointment_row_id", appointmentRowId).maybeSingle()
    if (appointmentError) throw appointmentError
    if (!appointment) {
      await finishLog("failed", 404, "Appointment not found.", { success: false })
      return json(res, 404, { error: "Appointment not found." })
    }
    const arrival = appointment.rep_arrival_time ? new Date(appointment.rep_arrival_time) : null
    const resultAt = new Date()
    const durationMinutes = arrival && !Number.isNaN(arrival.getTime()) ? Math.max(0, Math.round((resultAt - arrival) / 60000)) : null
    if (durationMinutes === null || durationMinutes < 120) {
      await finishLog("failed", 409, "The appointment does not meet the two-hour overstay threshold.", { success: false, duration_minutes: durationMinutes })
      return json(res, 409, { error: "The visit has not exceeded two hours, so an overstay form is not required." })
    }

    const pdf = await PDFDocument.create()
    const page = pdf.addPage([595.28, 841.89])
    const regular = await pdf.embedFont(StandardFonts.Helvetica)
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
    const navy = rgb(0.06, 0.14, 0.25)
    const blue = rgb(0.13, 0.60, 0.93)
    const grey = rgb(0.36, 0.40, 0.44)
    const margin = 48
    const width = page.getWidth() - margin * 2
    let y = 790
    page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: page.getHeight(), color: rgb(1, 1, 1) })
    page.drawRectangle({ x: 0, y: 805, width: page.getWidth(), height: 36, color: navy })
    page.drawText("HOMESHIELD SCOTLAND LTD", { x: margin, y: 817, size: 13, font: bold, color: rgb(1, 1, 1) })
    y = 765
    page.drawText("OVERSTAY FORM", { x: margin, y, size: 23, font: bold, color: navy })
    y -= 20
    page.drawText("Appointment visit duration and reason record", { x: margin, y, size: 10, font: regular, color: grey })
    y -= 34
    const field = (label, value) => {
      page.drawText(label.toUpperCase(), { x: margin, y, size: 8, font: bold, color: grey })
      y -= 16
      const lines = wrapText(value || "—", regular, 11, width)
      for (const line of lines) { page.drawText(line, { x: margin, y, size: 11, font: regular, color: navy }); y -= 15 }
      y -= 10
      page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: margin + width, y: y + 4 }, thickness: 0.6, color: rgb(0.86, 0.88, 0.90) })
      y -= 7
    }
    field("Customer name", appointment.name)
    field("Address", [appointment.address, appointment.postcode].filter(Boolean).join(", "))
    field("Customer phone", appointment.phone_number_1)
    field("Appointment date", formatDate(appointment.appointment_date))
    field("Representative", appointment.rep_allocated)
    field("Branch", appointment.branch)
    field("Product / job type", appointment.product || appointment.job_type)
    field("Arrival time", formatDate(appointment.rep_arrival_time))
    field("Form generated", formatDate(resultAt.toISOString()))
    field("Visit duration at form generation", `${Math.floor(durationMinutes / 60)} hours ${durationMinutes % 60} minutes`)
    page.drawText("REASON FOR OVERSTAY", { x: margin, y, size: 9, font: bold, color: blue })
    y -= 19
    let reasonPage = page
    for (const line of wrapText(reason, regular, 11, width)) {
      if (y < 70) {
        reasonPage = pdf.addPage([595.28, 841.89])
        y = 790
        reasonPage.drawText("OVERSTAY FORM — CONTINUED", { x: margin, y, size: 12, font: bold, color: navy })
        y -= 28
      }
      reasonPage.drawText(line, { x: margin, y, size: 11, font: regular, color: navy })
      y -= 16
    }
    const bytes = await pdf.save()
    const storagePath = `${appointmentRowId}/${Date.now()}-overstay-form.pdf`
    const { error: uploadError } = await supabase.storage.from("overstay-forms").upload(storagePath, new Blob([bytes], { type: "application/pdf" }), { contentType: "application/pdf", upsert: true })
    if (uploadError) throw new Error(`Unable to upload PDF to the overstay-forms bucket: ${uploadError.message}`)

    const { error: updateError } = await supabase.from("appointments").update({
      reason_for_overstay: reason,
      overstay_form_link: storagePath,
    }).eq("appointment_row_id", appointmentRowId)
    if (updateError) throw updateError

    await finishLog("success", 200, null, { success: true, appointment_row_id: appointmentRowId, storage_path: storagePath, duration_minutes: durationMinutes })
    return json(res, 200, { success: true, storage_path: storagePath, duration_minutes: durationMinutes, message: "Overstay PDF generated and stored." })
  } catch (error) {
    console.error("Overstay form generation failed:", error)
    await finishLog("failed", 500, error?.message || "Overstay form generation failed.", { success: false })
    return json(res, 500, { error: error?.message || "Unable to generate the overstay form." })
  }
}

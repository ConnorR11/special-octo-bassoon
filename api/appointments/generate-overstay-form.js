import { createClient } from "@supabase/supabase-js"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

const json = (res, status, body) => {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Cache-Control", "no-store")
  return res.status(status).json(body)
}
const safe = value => String(value ?? "").trim()
const OVERSTAY_REASONS = [
  "Exploring financing options",
  "Finance application",
  "Clarifying product specifications",
  "Price negotiations",
  "General conversation with customer",
  "Discussion of styles and designs",
  "Completion of paperwork",
  "Answering customer questions",
  "Late arrival",
]
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
    const selectedReasons = reason.split(/\s*;\s*/).map(value => value.trim()).filter(Boolean)
    if (!selectedReasons.length || selectedReasons.some(value => !OVERSTAY_REASONS.includes(value))) {
      return json(res, 400, { error: "Select one or more valid reasons from the approved overstay reason list." })
    }

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
    if (!arrival || Number.isNaN(arrival.getTime())) {
      await finishLog("failed", 409, "A valid representative arrival time is required.", { success: false })
      return json(res, 409, { error: "A valid representative arrival time is required before generating the overstay form." })
    }
    // The representative arrival must fall on the appointment's calendar day in UK time.
    const londonDate = value => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(value)
    const appointmentDate = appointment.appointment_date ? new Date(appointment.appointment_date) : null
    if (!appointmentDate || Number.isNaN(appointmentDate.getTime()) || londonDate(arrival) !== londonDate(appointmentDate)) {
      await finishLog("failed", 409, "The representative arrival date does not match the appointment date.", { success: false, arrival_time: arrival.toISOString(), appointment_date: appointment.appointment_date || null })
      return json(res, 409, { error: "The representative arrival time must be on the same calendar day as the appointment date." })
    }
    const durationMinutes = Math.max(0, Math.round((resultAt - arrival) / 60000))
    if (durationMinutes < 120) {
      await finishLog("failed", 409, "The appointment does not meet the two-hour overstay threshold.", { success: false, duration_minutes: durationMinutes })
      return json(res, 409, { error: "The visit has not exceeded two hours, so an overstay form is not required." })
    }

    const pdf = await PDFDocument.create()
    const page = pdf.addPage([595.28, 841.89])
    const regular = await pdf.embedFont(StandardFonts.Helvetica)
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
    const navy = rgb(0.015, 0.20, 0.34)
    const deepNavy = rgb(0.0, 0.16, 0.29)
    const blue = rgb(0.02, 0.43, 0.96)
    const paleBlue = rgb(0.91, 0.95, 0.98)
    const border = rgb(0.73, 0.84, 0.92)
    const grey = rgb(0.30, 0.37, 0.44)
    const white = rgb(1, 1, 1)
    const margin = 34
    const width = page.getWidth() - margin * 2
    const right = page.getWidth() - margin
    const text = (value, x, y, size, font = regular, color = navy) => page.drawText(String(value ?? ""), { x, y, size, font, color })
    const drawWrapped = (value, x, y, size, font, color, maxWidth, lineHeight = size * 1.35) => {
      let baseline = y
      for (const line of wrapText(value || "—", font, size, maxWidth)) {
        text(line, x, baseline, size, font, color)
        baseline -= lineHeight
      }
      return baseline
    }
    const section = (title, top, height) => {
      page.drawRectangle({ x: margin, y: top - height, width, height, color: white, borderColor: border, borderWidth: 0.8 })
      page.drawRectangle({ x: margin, y: top - 28, width, height: 28, color: deepNavy })
      text(title.toUpperCase(), margin + 38, top - 18, 10, bold, white)
      // Simple white pictogram block, matching the section-icon treatment of the reference.
      page.drawCircle({ x: margin + 18, y: top - 11, size: 4.2, color: white })
      page.drawRectangle({ x: margin + 12, y: top - 22, width: 12, height: 7, color: white })
    }
    const row = (top, label, value, height = 31) => {
      page.drawRectangle({ x: margin, y: top - height, width: 196, height, color: paleBlue })
      page.drawLine({ start: { x: margin, y: top - height }, end: { x: right, y: top - height }, thickness: 0.65, color: border })
      page.drawLine({ start: { x: margin + 196, y: top }, end: { x: margin + 196, y: top - height }, thickness: 0.65, color: border })
      text(label, margin + 18, top - height / 2 - 3, 9, bold, deepNavy)
      drawWrapped(value || "—", margin + 208, top - height / 2 - 3, 9.5, regular, rgb(0.20, 0.22, 0.24), width - 220, 11)
    }

    // Reference design: branded header, explanatory notice, grouped detail tables and footer.
    page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: page.getHeight(), color: white })
    page.drawRectangle({ x: 0, y: page.getHeight() - 106, width: page.getWidth(), height: 106, color: deepNavy })
    page.drawRectangle({ x: 0, y: page.getHeight() - 108, width: page.getWidth(), height: 2, color: blue })
    // Shield-style mark drawn with vector shapes so the PDF does not depend on a remote asset.
    page.drawSvgPath("M 0 0 L 25 0 L 25 24 L 12.5 34 L 0 24 Z", { x: margin, y: page.getHeight() - 76, scale: 1.35, color: rgb(0.78, 0.86, 0.92), borderColor: white, borderWidth: 1 })
    page.drawLine({ start: { x: margin + 5, y: page.getHeight() - 57 }, end: { x: margin + 29, y: page.getHeight() - 80 }, thickness: 4, color: white })
    page.drawLine({ start: { x: margin + 5, y: page.getHeight() - 80 }, end: { x: margin + 29, y: page.getHeight() - 57 }, thickness: 4, color: white })
    text("HOMESHIELD SCOTLAND LTD", margin + 48, page.getHeight() - 49, 15, bold, white)
    text("Enhancing Homes Across Scotland", margin + 48, page.getHeight() - 70, 11, regular, white)

    text("OVERSTAY", margin, 700, 29, bold, deepNavy)
    text("FORM", margin + 151, 700, 29, regular, deepNavy)
    page.drawRectangle({ x: margin, y: 682, width: 70, height: 3, color: blue })

    // Informational notice copied from the supplied reference design.
    page.drawRectangle({ x: margin, y: 555, width, height: 108, color: paleBlue, borderColor: paleBlue, borderWidth: 0.5 })
    page.drawCircle({ x: margin + 24, y: 635, size: 13, color: rgb(0.02, 0.43, 0.82) })
    text("i", margin + 21.4, 630, 15, bold, white)
    const notice = "Trading Standards state that sales should normally last no more than two hours. When the visit lasts more than two hours we are required to record this and the reasons why this has occurred. As this has occurred in this sales visit, we would ask for you to confirm that the reasons for this overstay are correct.\n\nIf you do not agree with the reason our representative has given you for the overstay, please contact us. We are bound at all times by Trading Standards, and further details can be found at www.consumeradvice.scot"
    let noticeY = 638
    for (const paragraph of notice.split("\\n\\n")) {
      noticeY = drawWrapped(paragraph, margin + 48, noticeY, 8.7, regular, deepNavy, width - 62, 11.5) - 6
    }

    section("Customer Details", 540, 124)
    row(512, "Name:", appointment.name)
    row(481, "Address:", [appointment.address, appointment.postcode].filter(Boolean).join(", "))
    row(450, "Phone Number:", appointment.phone_number_1)
    row(419, "Email:", appointment.email_address, 31)

    section("Sales Representative", 380, 59)
    row(352, "Representative’s Name:", appointment.rep_allocated, 31)

    section("Reason for Overlong Sales Visit", 310, 70)
    row(282, "Reason for Overlong Sales Visit:", selectedReasons.join(", "), 42)

    section("Visit Date", 230, 59)
    row(202, "Date:", formatDate(appointment.appointment_date), 31)

    // Compact visit duration is included as an additional record while keeping the reference's structure.
    text("VISIT DURATION", margin, 145, 7.5, bold, rgb(0.02, 0.43, 0.82))
    text(`${Math.floor(durationMinutes / 60)} hours ${durationMinutes % 60} minutes`, margin, 130, 10, bold, deepNavy)
    text(`Arrival: ${formatDate(appointment.rep_arrival_time)}   •   Form generated: ${formatDate(resultAt.toISOString())}`, margin, 115, 7.2, regular, grey)

    page.drawLine({ start: { x: margin, y: 78 }, end: { x: right, y: 78 }, thickness: 1, color: blue })
    // Three-column contact footer, like the reference.
    text("515 Lawmoor Street, Dixon Blazes", margin + 24, 59, 7.4, regular, deepNavy)
    text("Industrial Estate, Glasgow G5 0TT", margin + 24, 48, 7.4, regular, deepNavy)
    page.drawCircle({ x: margin + 7, y: 57, size: 5, color: deepNavy })
    page.drawLine({ start: { x: 282, y: 42 }, end: { x: 282, y: 69 }, thickness: 0.7, color: border })
    text("0800 6 118 118", 296, 56, 8, regular, deepNavy)
    page.drawLine({ start: { x: 420, y: 42 }, end: { x: 420, y: 69 }, thickness: 0.7, color: border })
    text("info@homeshield.ltd", 433, 56, 7.4, regular, deepNavy)

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

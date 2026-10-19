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
    const selectedReasons = reason.split(/\\s*;\\s*/).map(value => value.trim()).filter(Boolean)
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
    // This form records a same-day visit. Refuse stale test/appointment records rather than
    // misrepresenting several days of elapsed wall-clock time as the visit duration.
    const londonDate = value => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(value)
    if (londonDate(arrival) !== londonDate(resultAt)) {
      await finishLog("failed", 409, "The arrival time is not from today; actual visit duration cannot be verified.", { success: false, arrival_time: arrival.toISOString(), generated_at: resultAt.toISOString() })
      return json(res, 409, { error: "This appointment's arrival time is not today. To avoid recording an incorrect visit duration, generate the overstay form from the appointment on the day of the visit." })
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
    const navy = rgb(0.025, 0.15, 0.29)
    const blue = rgb(0.04, 0.39, 0.63)
    const paleBlue = rgb(0.92, 0.96, 0.985)
    const light = rgb(0.965, 0.976, 0.987)
    const grey = rgb(0.34, 0.40, 0.47)
    const border = rgb(0.83, 0.88, 0.92)
    const white = rgb(1, 1, 1)
    const margin = 42
    const width = page.getWidth() - margin * 2
    const right = page.getWidth() - margin
    let y = 0
    const drawText = (text, x, baseline, size, font = regular, color = navy) => page.drawText(String(text ?? ""), { x, y: baseline, size, font, color })
    const roundedPanel = (x, top, w, h, color = light, stroke = border) => {
      page.drawRectangle({ x, y: top - h, width: w, height: h, color, borderColor: stroke, borderWidth: 0.7 })
    }
    const fitLines = (value, font, size, maxWidth) => wrapText(value || "—", font, size, maxWidth)
    const drawField = (label, value, x, top, w, opts = {}) => {
      const labelSize = opts.labelSize || 7.2
      const valueSize = opts.valueSize || 10
      drawText(label.toUpperCase(), x, top - 11, labelSize, bold, grey)
      const lines = fitLines(value, regular, valueSize, w - 18)
      let baseline = top - 27
      for (const line of lines.slice(0, opts.maxLines || 2)) {
        drawText(line, x, baseline, valueSize, regular, navy)
        baseline -= 13
      }
    }

    // Brand header and title
    page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: page.getHeight(), color: white })
    page.drawRectangle({ x: 0, y: page.getHeight() - 58, width: page.getWidth(), height: 58, color: navy })
    page.drawRectangle({ x: 0, y: page.getHeight() - 61, width: page.getWidth(), height: 3, color: blue })
    drawText("HOMESHIELD", margin, page.getHeight() - 28, 15, bold, white)
    drawText("SCOTLAND LTD", margin, page.getHeight() - 44, 8, bold, rgb(0.78, 0.87, 0.94))
    drawText("OVERSTAY FORM", margin, 744, 24, bold, navy)
    drawText("Appointment visit duration and reason record", margin, 725, 9.5, regular, grey)
    page.drawRectangle({ x: right - 122, y: 714, width: 122, height: 24, color: paleBlue, borderColor: border, borderWidth: 0.7 })
    drawText("VISIT OVER 2 HOURS", right - 113, 723, 7.4, bold, blue)

    // Customer details: two-column compact grid
    const panelTop = 700
    const panelHeight = 174
    roundedPanel(margin, panelTop, width, panelHeight, white, border)
    page.drawRectangle({ x: margin, y: panelTop - 28, width, height: 28, color: paleBlue })
    drawText("APPOINTMENT DETAILS", margin + 14, panelTop - 18, 8, bold, navy)
    const colGap = 18
    const colW = (width - 28 - colGap) / 2
    const x1 = margin + 14
    const x2 = x1 + colW + colGap
    const rowTop = panelTop - 34
    drawField("Customer name", appointment.name, x1, rowTop, colW)
    drawField("Customer phone", appointment.phone_number_1, x2, rowTop, colW)
    drawField("Address", [appointment.address, appointment.postcode].filter(Boolean).join(", "), x1, rowTop - 42, colW)
    drawField("Appointment date", formatDate(appointment.appointment_date), x2, rowTop - 42, colW)
    drawField("Representative", appointment.rep_allocated, x1, rowTop - 84, colW)
    drawField("Branch", appointment.branch, x2, rowTop - 84, colW)
    drawField("Product / job type", appointment.product || appointment.job_type, x1, rowTop - 126, colW)
    drawField("Representative arrival", formatDate(appointment.rep_arrival_time), x2, rowTop - 126, colW)

    // Duration summary card
    const durationTop = 506
    roundedPanel(margin, durationTop, width, 64, paleBlue, border)
    drawText("VISIT DURATION", margin + 14, durationTop - 17, 7.4, bold, blue)
    drawText(`${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`, margin + 14, durationTop - 43, 17, bold, navy)
    drawText(`Form generated ${formatDate(resultAt.toISOString())}`, margin + 190, durationTop - 28, 8.5, regular, grey)
    drawText("Duration measured from representative arrival to form generation.", margin + 190, durationTop - 43, 7.3, regular, grey)

    // Selected reasons in a highlighted, readable panel
    const reasons = reason.split(/\s*;\s*/).map(value => value.trim()).filter(Boolean)
    const reasonLines = []
    for (const item of reasons) {
      const wrapped = wrapText(item, regular, 9.5, width - 48)
      reasonLines.push(...wrapped)
    }
    const reasonPanelTop = 424
    const lineHeight = 15
    const reasonPanelHeight = Math.max(78, 45 + reasonLines.length * lineHeight)
    roundedPanel(margin, reasonPanelTop, width, reasonPanelHeight, light, border)
    page.drawRectangle({ x: margin, y: reasonPanelTop - 29, width, height: 29, color: navy })
    drawText("REASON FOR OVERSTAY", margin + 14, reasonPanelTop - 19, 8.5, bold, white)
    let reasonY = reasonPanelTop - 47
    for (const line of reasonLines) {
      page.drawCircle({ x: margin + 17, y: reasonY + 3, size: 2, color: blue })
      drawText(line, margin + 27, reasonY, 9.5, regular, navy)
      reasonY -= lineHeight
    }

    // Footer with company contact details and page rule
    const footerY = 43
    page.drawLine({ start: { x: margin, y: footerY + 21 }, end: { x: right, y: footerY + 21 }, thickness: 0.8, color: border })
    drawText("HOMESHIELD SCOTLAND LTD", margin, footerY + 7, 7.2, bold, navy)
    drawText("info@homeshield.ltd  |  0800 6 118 118", right - 180, footerY + 7, 7.2, regular, blue)
    drawText("Overstay visit record", margin, footerY - 8, 6.5, regular, grey)

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

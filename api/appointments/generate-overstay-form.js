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
    const deepNavy = rgb(0.0, 0.16, 0.29)
    const blue = rgb(0.02, 0.43, 0.96)
    const paleBlue = rgb(0.91, 0.95, 0.98)
    const border = rgb(0.73, 0.84, 0.92)
    const grey = rgb(0.30, 0.37, 0.44)
    const white = rgb(1, 1, 1)
    const margin = 32
    const width = page.getWidth() - margin * 2
    const right = page.getWidth() - margin
    const text = (value, x, y, size, font = regular, color = deepNavy) => page.drawText(String(value ?? ""), { x, y, size, font, color })
    const linesFor = (value, font, size, maxWidth) => wrapText(value || "—", font, size, maxWidth)
    const drawLines = (lines, x, y, size, font, color, lineHeight = size * 1.3) => {
      lines.forEach((line, index) => text(line, x, y - index * lineHeight, size, font, color))
    }

    page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: page.getHeight(), color: white })
    page.drawRectangle({ x: 0, y: page.getHeight() - 100, width: page.getWidth(), height: 100, color: deepNavy })
    page.drawRectangle({ x: 0, y: page.getHeight() - 102, width: page.getWidth(), height: 2, color: blue })

    let logoEmbedded = false
    try {
      const host = req.headers?.["x-forwarded-host"] || req.headers?.host
      const protocol = req.headers?.["x-forwarded-proto"] || "https"
      if (host) {
        const logoResponse = await fetch(`${protocol}://${host}/homeshield-logo.png`)
        if (logoResponse.ok) {
          const logoBytes = new Uint8Array(await logoResponse.arrayBuffer())
          const logoImage = await pdf.embedPng(logoBytes)
          const logoScale = Math.min(0.72, 76 / logoImage.width, 70 / logoImage.height)
          const logoDims = logoImage.scale(logoScale)
          page.drawImage(logoImage, { x: margin, y: page.getHeight() - 88, width: logoDims.width, height: logoDims.height })
          logoEmbedded = true
        }
      }
    } catch (logoError) {
      console.error("Unable to load HomeShield logo for overstay PDF:", logoError?.message)
    }
    const brandX = logoEmbedded ? margin + 90 : margin
    text("HOMESHIELD SCOTLAND LTD", brandX, 800, 14, bold, white)
    text("Enhancing Homes Across Scotland", brandX, 782, 10, regular, white)

    text("OVERSTAY", margin, 752, 26, bold, deepNavy)
    text("FORM", margin + 146, 752, 26, regular, deepNavy)
    page.drawRectangle({ x: margin, y: 736, width: 66, height: 3, color: blue })

    // Informational notice panel, with measured wrapping to avoid crowding.
    const notice = "Trading Standards state that sales should normally last no more than two hours. When the visit lasts more than two hours we are required to record this and the reasons why this has occurred. As this has occurred in this sales visit, we would ask for you to confirm that the reasons for this overstay are correct.\n\nIf you do not agree with the reason our representative has given you for the overstay, please contact us. We are bound at all times by Trading Standards, and further details can be found at www.consumeradvice.scot"
    const noticeParagraphs = notice.split("\n\n")
    const noticeLines = noticeParagraphs.flatMap((paragraph, index) => [...(index ? [""] : []), ...linesFor(paragraph, regular, 7.8, width - 70)])
    const noticeHeight = Math.max(83, 20 + noticeLines.length * 10)
    const noticeTop = 718
    page.drawRectangle({ x: margin, y: noticeTop - noticeHeight, width, height: noticeHeight, color: paleBlue, borderColor: paleBlue, borderWidth: 0.5 })
    page.drawCircle({ x: margin + 23, y: noticeTop - 24, size: 12, color: rgb(0.02, 0.43, 0.82) })
    text("i", margin + 20.5, noticeTop - 29, 14, bold, white)
    drawLines(noticeLines.filter(line => line !== ""), margin + 43, noticeTop - 19, 7.8, regular, deepNavy, 10)
    let y = noticeTop - noticeHeight - 13

    const drawSection = (title, rows) => {
      const labelW = 185
      const valueW = width - labelW - 16
      const rowLayouts = rows.map(item => {
        const labelLines = linesFor(item.label, bold, 8.2, labelW - 22)
        const valueLines = linesFor(item.value, regular, 8.7, valueW - 20)
        const lineCount = Math.max(labelLines.length, valueLines.length)
        return { ...item, labelLines, valueLines, height: Math.max(27, 12 + lineCount * 10.5) }
      })
      const headerH = 25
      const totalH = headerH + rowLayouts.reduce((sum, item) => sum + item.height, 0)
      const top = y
      page.drawRectangle({ x: margin, y: top - totalH, width, height: totalH, color: white, borderColor: border, borderWidth: 0.75 })
      page.drawRectangle({ x: margin, y: top - headerH, width, height: headerH, color: deepNavy })
      text(title.toUpperCase(), margin + 16, top - 16, 9.2, bold, white)
      let rowTop = top - headerH
      for (const item of rowLayouts) {
        const bottom = rowTop - item.height
        page.drawRectangle({ x: margin, y: bottom, width: labelW, height: item.height, color: paleBlue })
        page.drawLine({ start: { x: margin, y: bottom }, end: { x: right, y: bottom }, thickness: 0.55, color: border })
        page.drawLine({ start: { x: margin + labelW, y: rowTop }, end: { x: margin + labelW, y: bottom }, thickness: 0.55, color: border })
        const labelY = rowTop - (item.height - item.labelLines.length * 10.5) / 2 - 7
        const valueY = rowTop - (item.height - item.valueLines.length * 10.5) / 2 - 7
        drawLines(item.labelLines, margin + 10, labelY, 8.2, bold, deepNavy, 10.5)
        drawLines(item.valueLines, margin + labelW + 11, valueY, 8.7, regular, rgb(0.20, 0.22, 0.24), 10.5)
        rowTop = bottom
      }
      y = top - totalH - 10
    }

    drawSection("Customer Details", [
      { label: "Name:", value: appointment.name },
      { label: "Address:", value: [appointment.address, appointment.postcode].filter(Boolean).join(", ") },
      { label: "Phone Number:", value: appointment.phone_number_1 },
      { label: "Email:", value: appointment.email_address },
    ])
    drawSection("Sales Representative", [
      { label: "Representative’s Name:", value: appointment.rep_allocated },
    ])
    drawSection("Reason for Overlong Sales Visit", [
      { label: "Reason for Overlong Sales Visit:", value: selectedReasons.join(", ") },
    ])
    drawSection("Visit Date", [
      { label: "Date:", value: formatDate(appointment.appointment_date) },
    ])

    // Reserve a consistent footer zone. If the selected reasons are unusually long,
    // the data sections will be compacted by wrapping within their own rows.
    const durationY = Math.max(y - 1, 104)
    text("VISIT DURATION", margin, durationY, 7.2, bold, blue)
    text(`${Math.floor(durationMinutes / 60)} hours ${durationMinutes % 60} minutes`, margin, durationY - 12, 9, bold, deepNavy)
    text(`Arrival: ${formatDate(appointment.rep_arrival_time)}   •   Form generated: ${formatDate(resultAt.toISOString())}`, margin, durationY - 24, 6.5, regular, grey)

    page.drawLine({ start: { x: margin, y: 55 }, end: { x: right, y: 55 }, thickness: 1, color: blue })
    // Footer address, telephone and email icons.
    page.drawCircle({ x: margin + 5, y: 34, size: 4, color: deepNavy })
    page.drawLine({ start: { x: margin + 5, y: 29 }, end: { x: margin + 5, y: 23 }, thickness: 1.5, color: deepNavy })
    text("515 Lawmoor Street, Dixon Blazes", margin + 18, 36, 6.5, regular, deepNavy)
    text("Industrial Estate, Glasgow G5 0TT", margin + 18, 27, 6.5, regular, deepNavy)
    page.drawLine({ start: { x: 282, y: 21 }, end: { x: 282, y: 44 }, thickness: 0.6, color: border })
    page.drawLine({ start: { x: 291, y: 37 }, end: { x: 296, y: 31 }, thickness: 2, color: deepNavy })
    page.drawLine({ start: { x: 296, y: 31 }, end: { x: 301, y: 37 }, thickness: 2, color: deepNavy })
    text("0800 6 118 118", 306, 31, 7, regular, deepNavy)
    page.drawLine({ start: { x: 420, y: 21 }, end: { x: 420, y: 44 }, thickness: 0.6, color: border })
    page.drawRectangle({ x: 429, y: 28, width: 12, height: 8, borderColor: deepNavy, borderWidth: 1 })
    page.drawLine({ start: { x: 429, y: 36 }, end: { x: 435, y: 32 }, thickness: 0.8, color: deepNavy })
    page.drawLine({ start: { x: 441, y: 36 }, end: { x: 435, y: 32 }, thickness: 0.8, color: deepNavy })
    text("info@homeshield.ltd", 446, 31, 6.4, regular, deepNavy)

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

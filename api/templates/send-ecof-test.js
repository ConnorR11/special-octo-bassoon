import { createClient } from "@supabase/supabase-js"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

const json = (res, status, body) => {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Cache-Control", "no-store")
  return res.status(status).json(body)
}
const TEST_RECIPIENT = "connor@homeshield.ltd"

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." })
  const authorization = String(req.headers?.authorization || "")
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : ""
  if (!accessToken) return json(res, 401, { error: "Please sign in again before sending the test ECOF." })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const tenantId = process.env.MICROSOFT_TENANT_ID
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  const sender = process.env.CONTRACT_SENDER_EMAIL
  if (![supabaseUrl, serviceKey].every(Boolean)) return json(res, 500, { error: "ECOF test email logging is not configured." })

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  let logId = null
  const finishLog = async (status, httpStatus, errorMessage = null, result = {}) => {
    if (!logId) return
    const { error } = await db.from("integration_event_logs").update({
      status, http_status: httpStatus, error_message: errorMessage, result, processed_at: new Date().toISOString(),
    }).eq("id", logId)
    if (error) console.error("Unable to update ECOF test email log:", error.message)
  }
  const fail = async (status, message, sourceStatus = status) => {
    await finishLog("failed", sourceStatus, message, { success: false, message })
    return json(res, status, { error: message })
  }

  try {
    const { data: userData, error: userError } = await db.auth.getUser(accessToken)
    if (userError || !userData?.user) return json(res, 401, { error: "Your session has expired. Please sign in again." })
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {})
    const appointmentRowId = String(body.appointment_row_id || "").trim()
    const customerName = String(body.customer_name || "Customer").trim().slice(0, 160)
    const documentPages = Array.isArray(body.document_pages) ? body.document_pages : []
    if (!appointmentRowId || !documentPages.length || documentPages.length > 20) return json(res, 400, { error: "Select an appointment and load the ECOF document before sending a test." })
    if (documentPages.some(page => typeof page !== "string" || page.length > 30000)) return json(res, 413, { error: "The ECOF document content is too large to generate as a PDF." })

    const { data: logRow, error: logError } = await db.from("integration_event_logs").insert({
      provider: "microsoft_graph", integration_name: "Microsoft 365 ECOF Test Email", direction: "outbound",
      event_name: "ecof_test_email_send", event_type: "pdf_attachment_test_email", external_id: appointmentRowId,
      status: "received", received_at: new Date().toISOString(),
      payload: { appointment_row_id: appointmentRowId, recipient: TEST_RECIPIENT, customer_name: customerName, triggered_by: userData.user.email || userData.user.id },
    }).select("id").single()
    if (logError || !logRow?.id) {
      console.error("Unable to create ECOF test email log:", logError?.message || "No log row returned")
      return json(res, 500, { error: "The test email was not sent because its CRM integration log could not be created." })
    }
    logId = logRow.id

    if (![tenantId, clientId, clientSecret, sender].every(Boolean)) return await fail(500, "Email service is not fully configured. Check the Microsoft 365 email environment variables.")
    const { data: appointment, error: appointmentError } = await db.from("appointments")
      .select("appointment_row_id,name").eq("appointment_row_id", appointmentRowId).maybeSingle()
    if (appointmentError) throw appointmentError
    if (!appointment) return await fail(404, "The selected appointment could not be found.")

    const tokenResponse = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
    })
    const tokenData = await tokenResponse.json()
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Microsoft Graph ECOF token request failed:", { status: tokenResponse.status, error: tokenData.error || null })
      return await fail(502, "Microsoft 365 authentication failed. Check app credentials and Mail.Send consent.", tokenResponse.status)
    }

    const safeName = customerName.replace(/[^a-zA-Z0-9 ._-]/g, "").trim() || "Customer"
    const pdf = await PDFDocument.create()
    const regular = await pdf.embedFont(StandardFonts.Helvetica)
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
    const navy = rgb(8 / 255, 41 / 255, 71 / 255)
    const blue = rgb(8 / 255, 127 / 255, 189 / 255)
    const grey = rgb(82 / 255, 101 / 255, 120 / 255)
    const border = rgb(213 / 255, 225 / 255, 232 / 255)
    const pageWidth = 595.28, pageHeight = 841.89, margin = 38
    const cleanText = value => String(value ?? "").replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/•/g, "-").replace(/£/g, "GBP ")
    const wrap = (value, font, size, maxWidth) => {
      const words = cleanText(value || "").split(/\\s+/)
      const lines = []
      let line = ""
      for (const word of words) {
        const next = line ? line + " " + word : word
        if (font.widthOfTextAtSize(next, size) > maxWidth && line) { lines.push(line); line = word }
        else line = next
      }
      if (line) lines.push(line)
      return lines
    }
    let pageNumber = 0
    for (const rawPage of documentPages) {
      pageNumber++
      const page = pdf.addPage([pageWidth, pageHeight])
      page.drawRectangle({ x: 0, y: pageHeight - 92, width: pageWidth, height: 92, color: navy })
      page.drawRectangle({ x: 0, y: pageHeight - 95, width: pageWidth, height: 3, color: blue })
      let logoEmbedded = false
      try {
        const logoResponse = await fetch("https://crm.homeshield.ltd/homeshield-logo.png")
        if (logoResponse.ok) {
          const logo = await pdf.embedPng(new Uint8Array(await logoResponse.arrayBuffer()))
          const scale = Math.min(0.65, 68 / logo.width, 62 / logo.height)
          const dims = logo.scale(scale)
          page.drawImage(logo, { x: margin, y: pageHeight - 82, width: dims.width, height: dims.height })
          logoEmbedded = true
        }
      } catch (logoError) { console.error("Unable to embed ECOF logo:", logoError?.message) }
      const brandX = logoEmbedded ? margin + 82 : margin
      page.drawText("HOMESHIELD SCOTLAND LTD", { x: brandX, y: pageHeight - 42, size: 14, font: bold, color: rgb(1, 1, 1) })
      page.drawText("Enhancing Homes Across Scotland", { x: brandX, y: pageHeight - 60, size: 9, font: regular, color: rgb(1, 1, 1) })

      const content = cleanText(rawPage || "").replace(/PLEASE DO NOT REPLY TO THIS EMAIL\\. IT IS AN UNATTENDED AUTOMATED SERVICE\\./gi, "").trim()
      const lines = content.split(/\\r?\\n/).flatMap(line => line.trim() ? wrap(line.trim(), regular, 8.5, pageWidth - margin * 2) : [""])
      const availableHeight = pageHeight - 215
      const fontSize = Math.min(8.5, Math.max(5.8, availableHeight / Math.max(lines.length * 1.4, 1)))
      const lineHeight = fontSize * 1.4
      let y = pageHeight - 125
      for (const line of lines) {
        if (line) page.drawText(line, { x: margin, y, size: fontSize, font: regular, color: navy })
        y -= line ? lineHeight : Math.max(4, lineHeight * 0.55)
      }
      page.drawLine({ start: { x: margin, y: 62 }, end: { x: pageWidth - margin, y: 62 }, thickness: 1, color: blue })
      page.drawText("515 Lawmoor Street, Dixon Blazes Industrial Estate, Glasgow G5 0TT", { x: margin, y: 43, size: 6.5, font: regular, color: navy })
      page.drawText("0800 6 118 118  |  info@homeshield.ltd", { x: pageWidth - margin - 160, y: 43, size: 6.5, font: regular, color: navy })
      page.drawText(`Page ${pageNumber} of ${documentPages.length}`, { x: pageWidth - margin - 48, y: 24, size: 6, font: regular, color: grey })
    }
    const pdfBytes = await pdf.save()
    const attachmentName = `${safeName.replace(/\\s+/g, "-")}-ECOF-Test.pdf`
    const sendResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
      method: "POST", headers: { Authorization: `Bearer ${tokenData.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: {
        subject: `TEST ECOF – ${safeName}`,
        body: { contentType: "Text", content: `Please find attached the test ECOF for ${customerName}. This test copy has been sent to ${TEST_RECIPIENT} only; it has not been sent to the customer.` },
        toRecipients: [{ emailAddress: { address: TEST_RECIPIENT } }],
        attachments: [{ "@odata.type": "#microsoft.graph.fileAttachment", name: attachmentName, contentType: "application/pdf", contentBytes: Buffer.from(pdfBytes).toString("base64") }],
      }, saveToSentItems: true }),
    })
    if (!sendResponse.ok) {
      const details = await sendResponse.text()
      console.error("Microsoft Graph ECOF test sendMail failed:", { status: sendResponse.status, details: details.slice(0, 1000) })
      if (sendResponse.status === 408 || sendResponse.status === 504) return await fail(504, "Microsoft 365 timed out. Check Sent Items before retrying to avoid a duplicate.", sendResponse.status)
      return await fail(502, `Microsoft 365 could not send the ECOF test email (HTTP ${sendResponse.status}).`, sendResponse.status)
    }
    await finishLog("success", 202, null, { success: true, recipient: TEST_RECIPIENT, sender, subject: `TEST ECOF – ${safeName}`, attachment_name: attachmentName, attachment_size_bytes: pdfBytes.length, appointment_row_id: appointmentRowId })
    return json(res, 200, { success: true, message: "Test ECOF accepted by Microsoft 365.", recipient: TEST_RECIPIENT })
  } catch (error) {
    console.error("Send ECOF test email endpoint failed:", error)
    await finishLog("failed", 500, error?.message || "Unexpected server error", { success: false })
    return json(res, 500, { error: "An unexpected error occurred while sending the ECOF test email." })
  }
}

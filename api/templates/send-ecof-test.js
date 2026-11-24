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
    const pdfBase64 = String(body.pdf_base64 || "").replace(/^data:application\\/pdf;base64,/, "")
    if (!appointmentRowId || !pdfBase64) return json(res, 400, { error: "Select an appointment and generate the ECOF PDF before sending a test." })
    if (pdfBase64.length > 9_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(pdfBase64)) return json(res, 413, { error: "The generated ECOF PDF is too large or invalid." })
    const pdfBytes = Buffer.from(pdfBase64, "base64")
    if (pdfBytes.length < 8 || pdfBytes.subarray(0, 5).toString("ascii") !== "%PDF-") return json(res, 400, { error: "The generated attachment is not a valid PDF." })

    const { data: logRow, error: logError } = await db.from("integration_event_logs").insert({
      provider: "microsoft_graph", integration_name: "Microsoft 365 ECOF Test Email", direction: "outbound",
      event_name: "ecof_test_email_send", event_type: "formatted_pdf_attachment_test_email", external_id: appointmentRowId,
      status: "received", received_at: new Date().toISOString(),
      payload: { appointment_row_id: appointmentRowId, recipient: TEST_RECIPIENT, customer_name: customerName, attachment_size_bytes: pdfBytes.length, triggered_by: userData.user.email || userData.user.id },
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

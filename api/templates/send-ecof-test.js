import { createClient } from "@supabase/supabase-js"

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
    const documentHtml = String(body.document_html || "")
    if (!appointmentRowId || !documentHtml) return json(res, 400, { error: "Select an appointment and load the ECOF document before sending a test." })
    if (documentHtml.length > 180000) return json(res, 413, { error: "The ECOF document is too large to send as a test email." })

    const { data: logRow, error: logError } = await db.from("integration_event_logs").insert({
      provider: "microsoft_graph", integration_name: "Microsoft 365 ECOF Test Email", direction: "outbound",
      event_name: "ecof_test_email_send", event_type: "html_document_test_email", external_id: appointmentRowId,
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

    const safeName = customerName.replace(/[<>]/g, "")
    const emailHtml = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;background:#f2f5f7;font-family:Arial,sans-serif"><div style="max-width:900px;margin:0 auto;background:#fff;padding:24px;border:1px solid #dfe7ed"><p style="margin:0 0 18px;padding:10px 12px;background:#fff7e6;border:1px solid #f0d69a;color:#785414;font-size:12px"><b>TEST ECOF ONLY</b> — This is a test copy sent to ${TEST_RECIPIENT}. It has not been sent to the customer.</p>${documentHtml}</div></body></html>`
    const sendResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
      method: "POST", headers: { Authorization: `Bearer ${tokenData.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: {
        subject: `TEST ECOF – ${safeName}`,
        body: { contentType: "HTML", content: emailHtml },
        toRecipients: [{ emailAddress: { address: TEST_RECIPIENT } }],
      }, saveToSentItems: true }),
    })
    if (!sendResponse.ok) {
      const details = await sendResponse.text()
      console.error("Microsoft Graph ECOF test sendMail failed:", { status: sendResponse.status, details: details.slice(0, 1000) })
      if (sendResponse.status === 408 || sendResponse.status === 504) return await fail(504, "Microsoft 365 timed out. Check Sent Items before retrying to avoid a duplicate.", sendResponse.status)
      return await fail(502, `Microsoft 365 could not send the ECOF test email (HTTP ${sendResponse.status}).`, sendResponse.status)
    }
    await finishLog("success", 202, null, { success: true, recipient: TEST_RECIPIENT, sender, subject: `TEST ECOF – ${safeName}`, appointment_row_id: appointmentRowId })
    return json(res, 200, { success: true, message: "Test ECOF accepted by Microsoft 365.", recipient: TEST_RECIPIENT })
  } catch (error) {
    console.error("Send ECOF test email endpoint failed:", error)
    await finishLog("failed", 500, error?.message || "Unexpected server error", { success: false })
    return json(res, 500, { error: "An unexpected error occurred while sending the ECOF test email." })
  }
}

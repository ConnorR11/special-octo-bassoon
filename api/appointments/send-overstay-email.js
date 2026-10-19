import { createClient } from "@supabase/supabase-js"

const json = (res, status, body) => {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Cache-Control", "no-store")
  return res.status(status).json(body)
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." })
  const authorization = req.headers?.authorization || ""
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : ""
  if (!accessToken) return json(res, 401, { error: "Please sign in again before sending the overstay email." })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const tenantId = process.env.MICROSOFT_TENANT_ID
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  const sender = process.env.CONTRACT_SENDER_EMAIL
  if (![supabaseUrl, serviceKey].every(Boolean)) return json(res, 500, { error: "Overstay email logging is not configured." })

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  let logId = null
  const finishLog = async (status, httpStatus, errorMessage = null, result = {}) => {
    if (!logId) return
    const { error } = await supabase.from("integration_event_logs").update({
      status, http_status: httpStatus, error_message: errorMessage, result, processed_at: new Date().toISOString(),
    }).eq("id", logId)
    if (error) console.error("Unable to update overstay email log:", error.message)
  }
  const fail = async (status, message, sourceStatus = status) => {
    await finishLog("failed", sourceStatus, message, { success: false, message })
    return json(res, status, { error: message })
  }

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken)
    if (userError || !userData?.user) return json(res, 401, { error: "Your session has expired. Please sign in again." })
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {})
    const appointmentRowId = String(body.appointment_row_id || "").trim()
    const customerEmail = String(body.customer_email || "").trim()
    const { data: logRow, error: logError } = await supabase.from("integration_event_logs").insert({
      provider: "microsoft_graph", integration_name: "Microsoft 365 Overstay Email", direction: "outbound",
      event_name: "overstay_email_send", event_type: "email_with_pdf_attachment", external_id: appointmentRowId || null,
      status: "started", received_at: new Date().toISOString(),
      payload: { appointment_row_id: appointmentRowId || null, recipient: customerEmail || null, sender, triggered_by: userData.user.email || userData.user.id },
    }).select("id").single()
    if (logError) console.error("Unable to create overstay email log:", logError.message)
    else logId = logRow?.id || null

    if (![tenantId, clientId, clientSecret, sender].every(Boolean)) return await fail(500, "Email service is not fully configured. Check Microsoft 365 environment variables.")
    if (!appointmentRowId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return await fail(400, "A valid customer email address is required.")
    const { data: appointment, error: appointmentError } = await supabase.from("appointments")
      .select("appointment_row_id,name,result,email_address,overstay_form_link,reason_for_overstay")
      .eq("appointment_row_id", appointmentRowId).maybeSingle()
    if (appointmentError) throw appointmentError
    if (!appointment) return await fail(404, "Appointment not found.")
    const eligible = ["pm", "pm dnh", "single item", "bo"]
    if (!eligible.includes(String(appointment.result || "").trim().toLowerCase())) return await fail(409, "Overstay emails are only available for PM, PM DNH, Single Item and BO results.")
    if (String(appointment.email_address || "").trim().toLowerCase() !== customerEmail.toLowerCase()) return await fail(409, "The customer email must be saved on the appointment before sending.")
    const storagePath = String(appointment.overstay_form_link || "").trim()
    if (!storagePath.startsWith(`${appointmentRowId}/`) || storagePath.includes("..")) return await fail(409, "The overstay form has not been generated. Save the result and generate the PDF first.")
    const { data: pdfFile, error: pdfError } = await supabase.storage.from("overstay-forms").download(storagePath)
    if (pdfError || !pdfFile) return await fail(500, "Unable to retrieve the overstay PDF from storage.")
    if (pdfFile.size > 10 * 1024 * 1024) return await fail(413, "The overstay PDF exceeds the 10 MB email attachment limit.")

    const { data: emailTemplate, error: templateError } = await supabase.from("templates")
      .select("name,description,template_body,active").eq("template_type", "email").eq("name", "Overstay Form Email").eq("active", true).maybeSingle()
    if (templateError) throw templateError
    if (!emailTemplate) return await fail(500, "The active Overstay Form Email template was not found. Activate it in CRM Templates.")
    const replacements = { customer_name: appointment.name || "Customer", recipient: customerEmail, sender }
    const render = value => String(value || "").replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => replacements[key] ?? "")
    const subject = render(emailTemplate.description) || "Your HomeShield Overstay Form"
    const emailBody = render(emailTemplate.template_body) || `Dear ${appointment.name || "Customer"},\n\nPlease find attached the overstay form for your visit.\n\nKind regards,\nHomeShield Scotland Ltd`
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
    })
    const tokenData = await tokenResponse.json()
    if (!tokenResponse.ok || !tokenData.access_token) return await fail(502, "Microsoft 365 authentication failed. Check app credentials and Mail.Send consent.", tokenResponse.status)
    const attachmentName = `${String(appointment.name || "Customer").replace(/[^a-zA-Z0-9._-]/g, "-")}-Overstay-Form.pdf`
    const sendResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
      method: "POST", headers: { Authorization: `Bearer ${tokenData.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: {
        subject, body: { contentType: "Text", content: emailBody },
        toRecipients: [{ emailAddress: { address: customerEmail } }],
        attachments: [{ "@odata.type": "#microsoft.graph.fileAttachment", name: attachmentName, contentType: "application/pdf", contentBytes: Buffer.from(await pdfFile.arrayBuffer()).toString("base64") }],
      }, saveToSentItems: true }),
    })
    if (!sendResponse.ok) {
      const details = await sendResponse.text()
      console.error("Microsoft Graph overstay sendMail failed:", { status: sendResponse.status, details: details.slice(0, 1000) })
      if (sendResponse.status === 408 || sendResponse.status === 504) return await fail(504, "Microsoft 365 timed out. Check Sent Items before retrying to avoid a duplicate.", sendResponse.status)
      return await fail(502, `Microsoft 365 could not send the overstay email (HTTP ${sendResponse.status}).`, sendResponse.status)
    }
    await finishLog("success", 202, null, { success: true, recipient: customerEmail, sender, subject, attachment_name: attachmentName, appointment_row_id: appointmentRowId })
    return json(res, 200, { success: true, message: "Overstay email accepted by Microsoft 365.", recipient: customerEmail })
  } catch (error) {
    console.error("Send overstay email endpoint failed:", error)
    await finishLog("failed", 500, error?.message || "Unexpected server error", { success: false })
    return json(res, 500, { error: "An unexpected error occurred while sending the overstay email." })
  }
}

import { createClient } from "@supabase/supabase-js"

const json = (res, status, body) => {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Cache-Control", "no-store")
  return res.status(status).json(body)
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." })
  const authorization = String(req.headers?.authorization || "")
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : ""
  if (!accessToken) return json(res, 401, { error: "Please sign in again before sending the ECOF." })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const tenantId = process.env.MICROSOFT_TENANT_ID
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  const sender = process.env.CONTRACT_SENDER_EMAIL
  if (![supabaseUrl, serviceKey].every(Boolean)) return json(res, 500, { error: "ECOF email logging is not configured." })
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  let logId = null
  const finish = async (status, httpStatus, message = null, result = {}) => {
    if (!logId) return
    const { error } = await db.from("integration_event_logs").update({ status, http_status: httpStatus, error_message: message, result, processed_at: new Date().toISOString() }).eq("id", logId)
    if (error) console.error("Unable to update ECOF email log:", error.message)
  }
  const fail = async (status, message, sourceStatus = status) => {
    await finish("failed", sourceStatus, message, { success: false, message })
    return json(res, status, { error: message })
  }
  try {
    const { data: userData, error: userError } = await db.auth.getUser(accessToken)
    if (userError || !userData?.user) return json(res, 401, { error: "Your session has expired. Please sign in again." })
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {})
    const appointmentRowId = String(body.appointment_row_id || "").trim()
    const customerEmail = String(body.customer_email || "").trim()
    const ecofPath = String(body.ecof_pdf_path || "").trim()
    const { data: logRow, error: logError } = await db.from("integration_event_logs").insert({
      provider: "microsoft_graph", integration_name: "Microsoft 365 ECOF Email", direction: "outbound",
      event_name: "ecof_email_send", event_type: "email_with_pdf_attachment", external_id: appointmentRowId || null,
      status: "received", received_at: new Date().toISOString(),
      payload: { appointment_row_id: appointmentRowId || null, recipient: customerEmail || null, attachment_storage_path: ecofPath || null, sender, triggered_by: userData.user.email || userData.user.id },
    }).select("id").single()
    if (logError || !logRow?.id) return json(res, 500, { error: "The ECOF email was not sent because its integration log could not be created." })
    logId = logRow.id
    if (![tenantId, clientId, clientSecret, sender].every(Boolean)) return await fail(500, "Email service is not fully configured. Check Microsoft 365 environment variables.")
    if (!appointmentRowId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return await fail(400, "A valid appointment and customer email address are required.")
    if (!ecofPath.startsWith("ecof-pdfs/") || ecofPath.includes("..")) return await fail(400, "Invalid ECOF PDF storage path.")
    const { data: appointment, error: appointmentError } = await db.from("appointments")
      .select("appointment_row_id,name,result,email_address,overstay_form_link")
      .eq("appointment_row_id", appointmentRowId).maybeSingle()
    if (appointmentError) throw appointmentError
    if (!appointment) return await fail(404, "Appointment not found.")
    const result = String(appointment.result || "").trim().toLowerCase()
    if (!["pm", "pm dnh"].includes(result)) return await fail(409, "ECOF-only emails are available for PM and PM DNH appointments.")
    if (String(appointment.email_address || "").trim().toLowerCase() !== customerEmail.toLowerCase()) return await fail(409, "The customer email must match the saved appointment email.")
    const { data: ecofFile, error: ecofError } = await db.storage.from("signatures").download(ecofPath)
    if (ecofError || !ecofFile) return await fail(500, "Unable to retrieve the generated ECOF PDF.")
    const attachments = [{
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: `${String(appointment.name || "Customer").replace(/[^a-zA-Z0-9._-]/g, "-")}-ECOF.pdf`,
      contentType: "application/pdf",
      contentBytes: Buffer.from(await ecofFile.arrayBuffer()).toString("base64"),
    }]
    if (appointment.overstay_form_link) {
      const path = String(appointment.overstay_form_link).trim()
      if (!path.startsWith(`${appointmentRowId}/`) || path.includes("..")) return await fail(409, "The saved overstay form path is invalid.")
      const { data: overstayFile, error: overstayError } = await db.storage.from("overstay-forms").download(path)
      if (overstayError || !overstayFile) return await fail(500, "The overstay form could not be retrieved, so the ECOF email was not sent.")
      if (ecofFile.size + overstayFile.size > 10 * 1024 * 1024) return await fail(413, "The ECOF and overstay attachments exceed the email attachment limit.")
      attachments.push({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: `${String(appointment.name || "Customer").replace(/[^a-zA-Z0-9._-]/g, "-")}-Overstay-Form.pdf`,
        contentType: "application/pdf",
        contentBytes: Buffer.from(await overstayFile.arrayBuffer()).toString("base64"),
      })
    }
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
    })
    const tokenData = await tokenResponse.json()
    if (!tokenResponse.ok || !tokenData.access_token) return await fail(502, "Microsoft 365 authentication failed. Check app credentials and Mail.Send consent.", tokenResponse.status)
    const subject = "Your Homeshield Choice of Funding"
    const emailBody = `Hello ${appointment.name || "Customer"},\n\nThanks for choosing Homeshield Scotland.\n\nAttached to this email, you will find a document outlining the funding options available to you. Should you have any questions or require further clarification regarding these options, please do not hesitate to get in touch.\n\nFor any enquiries, please contact us at info@homeshield.ltd or on 0800 6 118 118. We are committed to responding promptly and ensuring that your experience with Homeshield Scotland is exceptional.\n\nKind regards,\nHomeshield Scotland`
    const sendResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
      method: "POST", headers: { Authorization: `Bearer ${tokenData.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { subject, body: { contentType: "Text", content: emailBody }, toRecipients: [{ emailAddress: { address: customerEmail } }], attachments }, saveToSentItems: true }),
    })
    if (!sendResponse.ok) {
      const details = await sendResponse.text()
      console.error("Microsoft Graph ECOF sendMail failed:", { status: sendResponse.status, details: details.slice(0, 1000) })
      if ([408, 504].includes(sendResponse.status)) return await fail(504, "Microsoft 365 timed out. Check Sent Items before retrying to avoid a duplicate.", sendResponse.status)
      return await fail(502, `Microsoft 365 could not send the ECOF email (HTTP ${sendResponse.status}).`, sendResponse.status)
    }
    await finish("success", 202, null, { success: true, recipient: customerEmail, sender, subject, appointment_row_id: appointmentRowId, attachment_names: attachments.map(item => item.name) })
    return json(res, 200, { success: true, message: "ECOF email accepted by Microsoft 365.", recipient: customerEmail })
  } catch (error) {
    console.error("Send ECOF email failed:", error)
    await finish("failed", 500, error?.message || "Unexpected server error", { success: false })
    return json(res, 500, { error: "An unexpected error occurred while sending the ECOF email." })
  }
}

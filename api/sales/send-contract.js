import { createClient } from "@supabase/supabase-js"

const json = (res, status, body) => {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Cache-Control", "no-store")
  return res.status(status).json(body)
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." })

  const authorization = req.headers?.authorization || req.headers?.Authorization || ""
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : ""
  if (!accessToken) return json(res, 401, { error: "Please sign in again before sending the contract." })

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const tenantId = process.env.MICROSOFT_TENANT_ID
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  const sender = process.env.CONTRACT_SENDER_EMAIL

  if (![supabaseUrl, serviceKey].every(Boolean)) {
    console.error("Contract email attempt cannot be logged: Supabase server configuration is missing.")
    return json(res, 500, { error: "Contract email logging is not configured. Check the Supabase server environment variables." })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let logId = null
  const finishLog = async ({ status, httpStatus, errorMessage = null, result = {} }) => {
    if (!logId) return
    const { error } = await supabase
      .from("integration_event_logs")
      .update({
        status,
        http_status: httpStatus,
        error_message: errorMessage,
        result,
        processed_at: new Date().toISOString(),
      })
      .eq("id", logId)
    if (error) console.error("Unable to update contract email integration log:", error.message)
  }
  const fail = async (status, message, httpStatus = status) => {
    await finishLog({
      status: "failed",
      httpStatus,
      errorMessage: message,
      result: { success: false, message },
    })
    return json(res, status, { error: message })
  }

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken)
    if (userError || !userData?.user) return json(res, 401, { error: "Your session has expired. Please sign in again." })

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {})
    const appointmentRowId = String(body?.appointment_row_id || "").trim()
    const customerEmail = String(body?.customer_email || "").trim()
    const fileName = String(body?.file_name || "Digital-Solar-Contract.pdf").replace(/[^a-zA-Z0-9._-]/g, "-")
    const pdfPath = String(body?.pdf_path || "").trim()

    // Record the attempt before validation or Microsoft Graph calls. Never log the PDF or credentials.
    const { data: logRow, error: logError } = await supabase
      .from("integration_event_logs")
      .insert({
        provider: "microsoft_graph",
        integration_name: "Microsoft 365 Contract Email",
        direction: "outbound",
        event_name: "contract_email_send",
        event_type: "email_with_pdf_attachment",
        external_id: appointmentRowId || null,
        status: "received",
        received_at: new Date().toISOString(),
        payload: {
          appointment_row_id: appointmentRowId || null,
          recipient: customerEmail || null,
          sender,
          attachment_name: fileName,
          attachment_type: "application/pdf",
          attachment_storage_path: pdfPath || null,
          triggered_by: userData.user.email || userData.user.id,
        },
      })
      .select("id")
      .single()
    if (logError) console.error("Unable to create contract email integration log:", logError.message)
    else logId = logRow?.id || null

    if (![tenantId, clientId, clientSecret, sender].every(Boolean)) {
      return await fail(500, "Email service is not fully configured. Check the Microsoft 365 email environment variables.")
    }
    if (!appointmentRowId || !customerEmail || !pdfPath) {
      return await fail(400, "Appointment, customer email and contract PDF are required.")
    }
    if (!pdfPath.startsWith("contract-pdfs/") || pdfPath.includes("..")) {
      return await fail(400, "Invalid contract PDF storage path.")
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return await fail(400, "Please enter a valid customer email address.")
    }
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("appointment_row_id,name,result,email_address,contract_number,signature_path,express_fit_signature_path,seg_disclaimer_signature_path")
      .eq("appointment_row_id", appointmentRowId)
      .maybeSingle()
    if (appointmentError) throw appointmentError
    if (!appointment) return await fail(404, "Appointment not found.")
    if (String(appointment.result || "").trim().toLowerCase() !== "sold") {
      return await fail(409, "Only appointments marked Sold can have a contract emailed.")
    }
    if (!appointment.signature_path || !appointment.express_fit_signature_path || !appointment.seg_disclaimer_signature_path) {
      return await fail(409, "All three customer signatures must be saved before sending the contract.")
    }
    if (String(appointment.email_address || "").trim().toLowerCase() !== customerEmail.toLowerCase()) {
      return await fail(409, "The customer email does not match the saved appointment. Please go back and save the correct email first.")
    }

    const tokenResponse = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    })
    const tokenData = await tokenResponse.json()
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Microsoft Graph token request failed:", {
        status: tokenResponse.status,
        error: tokenData.error || null,
        error_description: tokenData.error_description || null,
        error_codes: tokenData.error_codes || null,
        trace_id: tokenData.trace_id || null,
        correlation_id: tokenData.correlation_id || null,
      })
      const authCode = tokenData.error || "unknown_error"
      const authDescription = String(tokenData.error_description || "").replace(/[\\r\\n]+/g, " ").slice(0, 500)
      return await fail(502, `Microsoft 365 authentication failed (${authCode})${authDescription ? `: ${authDescription}` : ". Check the app credentials and Mail.Send admin consent."}`, tokenResponse.status)
    }

    const { data: pdfFile, error: pdfDownloadError } = await supabase.storage.from("signatures").download(pdfPath)
    if (pdfDownloadError || !pdfFile) {
      console.error("Unable to download contract PDF from storage:", pdfDownloadError?.message)
      return await fail(500, "Unable to retrieve the generated contract PDF from storage.")
    }
    if (pdfFile.size > 10 * 1024 * 1024) {
      return await fail(413, "The contract PDF is over the 10 MB email attachment limit.")
    }
    const pdfBase64 = Buffer.from(await pdfFile.arrayBuffer()).toString("base64")

    const { data: emailTemplate, error: templateError } = await supabase
      .from("templates")
      .select("name,description,template_body,active")
      .eq("template_type", "email")
      .eq("name", "Solar Contract Email")
      .eq("active", true)
      .maybeSingle()
    if (templateError) throw templateError
    if (!emailTemplate) return await fail(500, "The active Solar Contract Email template was not found. Open CRM Templates and activate it.")

    const replacements = {
      customer_name: appointment.name || "Customer",
      contract_number: appointment.contract_number || "",
      recipient: customerEmail,
      sender,
    }
    const renderTemplate = value => String(value || "").replace(/{{\\s*([a-zA-Z0-9_]+)\\s*}}/g, (_, key) => replacements[key] ?? "")
    const subject = renderTemplate(emailTemplate.description) || `Your Homeshield contract${appointment.contract_number ? ` – ${appointment.contract_number}` : ""}`
    const emailBody = renderTemplate(emailTemplate.template_body) || `Dear ${appointment.name || "Customer"},\\n\\nPlease find attached your Homeshield contract.\\n\\nKind regards,\\nHomeshield Scotland Ltd`
    const sendResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body: {
            contentType: "Text",
            content: `Dear ${appointment.name || "Customer"},\n\nPlease find attached your Homeshield contract.\n\nKind regards,\nHomeshield Scotland Ltd`,
          },
          toRecipients: [{ emailAddress: { address: customerEmail } }],
          attachments: [{
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`,
            contentType: "application/pdf",
            contentBytes: pdfBase64,
          }],
        },
        saveToSentItems: true,
      }),
    })

    if (!sendResponse.ok) {
      const details = await sendResponse.text()
      console.error("Microsoft Graph sendMail failed:", sendResponse.status, details.slice(0, 1500))
      if (sendResponse.status === 403) {
        return await fail(502, "Microsoft 365 refused to send the email. Check admin consent and confirm app@homeshield.ltd is an active mailbox.", sendResponse.status)
      }
      return await fail(502, `Microsoft 365 could not send the contract (HTTP ${sendResponse.status}).`, sendResponse.status)
    }

    await finishLog({
      status: "success",
      httpStatus: 202,
      result: {
        success: true,
        message: "Contract email accepted by Microsoft 365.",
        recipient: customerEmail,
        sender,
        subject,
        attachment_name: fileName,
        appointment_row_id: appointmentRowId,
        contract_number: appointment.contract_number || null,
      },
    })

    return json(res, 200, { success: true, message: "Contract email accepted by Microsoft 365.", recipient: customerEmail })
  } catch (error) {
    console.error("Send contract endpoint failed:", error)
    await finishLog({
      status: "failed",
      httpStatus: 500,
      errorMessage: error?.message || "Unexpected server error",
      result: { success: false, message: "Unexpected server error" },
    })
    return json(res, 500, { error: "An unexpected error occurred while sending the contract." })
  }
}

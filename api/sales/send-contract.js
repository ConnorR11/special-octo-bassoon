import { createClient } from "@supabase/supabase-js"

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
})

export default async function handler(req) {
  if (req.method !== "POST") return json(405, { error: "Method not allowed." })

  const authorization = req.headers.get("authorization") || ""
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : ""
  if (!accessToken) return json(401, { error: "Please sign in again before sending the contract." })

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const tenantId = process.env.MICROSOFT_TENANT_ID
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  const sender = process.env.CONTRACT_SENDER_EMAIL

  if (![supabaseUrl, serviceKey, tenantId, clientId, clientSecret, sender].every(Boolean)) {
    return json(500, { error: "Email service is not fully configured. Check the server environment variables." })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken)
    if (userError || !userData?.user) return json(401, { error: "Your session has expired. Please sign in again." })

    const body = await req.json()
    const appointmentRowId = String(body?.appointment_row_id || "").trim()
    const customerEmail = String(body?.customer_email || "").trim()
    const fileName = String(body?.file_name || "Digital-Solar-Contract.pdf").replace(/[^a-zA-Z0-9._-]/g, "-")
    const pdfBase64 = String(body?.pdf_base64 || "").replace(/^data:application\/pdf;base64,/, "")
    if (!appointmentRowId || !customerEmail || !pdfBase64) {
      return json(400, { error: "Appointment, customer email and contract PDF are required." })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return json(400, { error: "Please enter a valid customer email address." })
    }
    if (pdfBase64.length > 12_000_000) return json(413, { error: "The contract PDF is too large to email." })

    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("appointment_row_id,name,result,email_address,contract_number,signature_path,express_fit_signature_path,seg_disclaimer_signature_path")
      .eq("appointment_row_id", appointmentRowId)
      .maybeSingle()
    if (appointmentError) throw appointmentError
    if (!appointment) return json(404, { error: "Appointment not found." })
    if (String(appointment.result || "").trim().toLowerCase() !== "sold") {
      return json(409, { error: "Only appointments marked Sold can have a contract emailed." })
    }
    if (!appointment.signature_path || !appointment.express_fit_signature_path || !appointment.seg_disclaimer_signature_path) {
      return json(409, { error: "All three customer signatures must be saved before sending the contract." })
    }
    if (String(appointment.email_address || "").trim().toLowerCase() !== customerEmail.toLowerCase()) {
      return json(409, { error: "The customer email does not match the saved appointment. Please go back and save the correct email first." })
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
      console.error("Microsoft Graph token request failed:", tokenData.error || tokenResponse.status)
      return json(502, { error: "Microsoft 365 authentication failed. Check the app credentials and Mail.Send admin consent." })
    }

    const sendResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: `Your Homeshield contract${appointment.contract_number ? ` – ${appointment.contract_number}` : ""}`,
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
        return json(502, { error: "Microsoft 365 refused to send the email. Check admin consent and confirm app@homeshield.ltd is an active mailbox." })
      }
      return json(502, { error: `Microsoft 365 could not send the contract (HTTP ${sendResponse.status}).` })
    }

    return json(200, { success: true, message: "Contract email accepted by Microsoft 365.", recipient: customerEmail })
  } catch (error) {
    console.error("Send contract endpoint failed:", error)
    return json(500, { error: "An unexpected error occurred while sending the contract." })
  }
}

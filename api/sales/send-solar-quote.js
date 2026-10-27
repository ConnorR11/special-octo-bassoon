import { createClient } from "@supabase/supabase-js"
import crypto from "node:crypto"

const json = (res, status, body) => {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Cache-Control", "no-store")
  return res.status(status).json(body)
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." })
  const authorization = String(req.headers?.authorization || "")
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : ""
  if (!accessToken) return json(res, 401, { error: "Please sign in again before sending the quote." })

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const tenantId = process.env.MICROSOFT_TENANT_ID
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  const sender = process.env.CONTRACT_SENDER_EMAIL
  if (![supabaseUrl, serviceKey].every(Boolean)) return json(res, 500, { error: "Solar quote email logging is not configured." })

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  let logId = null
  const finishLog = async ({ status, httpStatus, errorMessage = null, result = {} }) => {
    if (!logId) return
    const { error } = await db.from("integration_event_logs").update({
      status, http_status: httpStatus, error_message: errorMessage, result, processed_at: new Date().toISOString(),
    }).eq("id", logId)
    if (error) console.error("Unable to update solar quote email log:", error.message)
  }
  const fail = async (status, message, httpStatus = status) => {
    await finishLog({ status: "failed", httpStatus, errorMessage: message, result: { success: false, message } })
    return json(res, status, { error: message })
  }

  try {
    const { data: userData, error: userError } = await db.auth.getUser(accessToken)
    if (userError || !userData?.user) return json(res, 401, { error: "Your session has expired. Please sign in again." })
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {})
    const appointmentRowId = String(body.appointment_row_id || "").trim()
    const customerEmail = String(body.customer_email || "").trim()
    const quoteLink = String(body.quote_link || "").trim()

    const { data: logRow, error: logError } = await db.from("integration_event_logs").insert({
      provider: "microsoft_graph", integration_name: "Microsoft 365 Solar Quote Email", direction: "outbound",
      event_name: "quote_email_send", event_type: "email_with_secure_link", external_id: appointmentRowId || null,
      status: "received", received_at: new Date().toISOString(),
      payload: { appointment_row_id: appointmentRowId || null, recipient: customerEmail || null, sender, triggered_by: userData.user.email || userData.user.id },
    }).select("id").single()
    if (logError) console.error("Unable to create solar quote email log:", logError.message)
    else logId = logRow?.id || null

    if (![tenantId, clientId, clientSecret, sender].every(Boolean)) return await fail(500, "Email service is not fully configured. Check the Microsoft 365 email environment variables.")
    if (!appointmentRowId || !customerEmail || !quoteLink) return await fail(400, "Appointment, customer email and secure quote link are required.")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return await fail(400, "Please enter a valid customer email address.")

    let parsedLink
    try { parsedLink = new URL(quoteLink) } catch { return await fail(400, "The secure quote link is invalid.") }
    if (parsedLink.protocol !== "https:" || parsedLink.pathname !== "/api/sales/view-solar-quote") {
      return await fail(400, "The link must be a valid secure quote link.")
    }
    const rawToken = parsedLink.searchParams.get("token") || ""
    if (!rawToken || rawToken.length > 200) return await fail(400, "The secure quote link is missing its token.")
    // Customer emails always use the canonical CRM domain, not a temporary Vercel URL.
    const publicBaseUrl = String(process.env.PUBLIC_APP_URL || "https://crm.homeshield.ltd").replace(/\/$/, "")
    const customerQuoteLink = publicBaseUrl + "/api/sales/view-solar-quote?token=" + encodeURIComponent(rawToken)
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
    const { data: quote, error: quoteError } = await db.from("solar_quotes")
      .select("id,appointment_row_id,quote_ref,customer_email,expires_at,status")
      .eq("public_token_hash", tokenHash).maybeSingle()
    if (quoteError) throw quoteError
    if (!quote || quote.appointment_row_id !== appointmentRowId) return await fail(404, "The secure quote link does not match this appointment.")
    if (quote.expires_at && new Date(quote.expires_at).getTime() <= Date.now()) return await fail(410, "This secure quote link has expired. Create a new link first.")
    if (["expired", "failed"].includes(String(quote.status || "").toLowerCase())) return await fail(409, "This quote link is not available to send.")
    const { data: appointment, error: appointmentError } = await db.from("appointments")
      .select("appointment_row_id,name,email_address").eq("appointment_row_id", appointmentRowId).maybeSingle()
    if (appointmentError) throw appointmentError
    if (!appointment) return await fail(404, "Appointment not found.")
    if (String(appointment.email_address || "").trim().toLowerCase() !== customerEmail.toLowerCase()) {
      return await fail(409, "The recipient must match the email address saved on the appointment.")
    }

    const { data: template, error: templateError } = await db.from("templates")
      .select("name,description,template_body,active").eq("template_type", "email")
      .eq("name", "Solar Quote Email").eq("active", true).maybeSingle()
    if (templateError) throw templateError
    if (!template) return await fail(500, "The active Solar Quote Email template was not found. Open CRM Templates and activate it.")

    const replacements = {
      customer_name: appointment.name || "Customer",
      quote_ref: quote.quote_ref || "",
      recipient: customerEmail,
      sender,
      quote_link: customerQuoteLink,
    }
    const renderTemplate = value => String(value || "").replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => replacements[key] ?? "")
    const subject = renderTemplate(template.description).trim() || "Your Homeshield solar quote"
    const templateBody = String(template.template_body || "").trim()
    if (!templateBody || !/{{\s*quote_link\s*}}/.test(templateBody)) return await fail(500, "The Solar Quote Email template must include the {{quote_link}} placeholder.")

    // Escape editable template content before converting it to HTML. Render the secure
    // link placeholder as a prominent button rather than exposing a long raw URL.
    const escapeHtml = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
    const quoteButton = `<p style="margin:28px 0;text-align:center"><a href="${escapeHtml(customerQuoteLink)}" style="display:inline-block;background:#174b40;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;padding:15px 28px;border-radius:6px">View your solar quote</a></p>`
    const htmlBody = templateBody
      .split(/({{\s*quote_link\s*}})/g)
      .map(part => /{{\s*quote_link\s*}}/.test(part) ? quoteButton : escapeHtml(renderTemplate(part)).replace(/\r?\n/g, "<br>"))
      .join("")
    const emailBody = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f6f5"><div style="max-width:600px;margin:0 auto;padding:28px;background:#ffffff;color:#26332f;font-family:Arial,sans-serif;font-size:15px;line-height:1.65;border-radius:8px">${htmlBody}</div></body></html>`

    const tokenResponse = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
    })
    const tokenData = await tokenResponse.json()
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Microsoft Graph token request failed:", { status: tokenResponse.status, error: tokenData.error || null, error_description: tokenData.error_description || null })
      return await fail(502, "Microsoft 365 authentication failed. Check app credentials and Mail.Send admin consent.", tokenResponse.status)
    }

    const sendResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
      method: "POST", headers: { Authorization: `Bearer ${tokenData.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: {
        subject, body: { contentType: "HTML", content: emailBody },
        toRecipients: [{ emailAddress: { address: customerEmail } }],
      }, saveToSentItems: true }),
    })
    if (!sendResponse.ok) {
      const details = await sendResponse.text()
      console.error("Microsoft Graph sendMail failed:", { status: sendResponse.status, details: details.slice(0, 1000) })
      if (sendResponse.status === 403) return await fail(502, "Microsoft 365 refused to send the email. Check Mail.Send admin consent and the sender mailbox.", sendResponse.status)
      return await fail(502, `Microsoft 365 could not send the quote (HTTP ${sendResponse.status}).`, sendResponse.status)
    }

    const now = new Date().toISOString()
    await db.from("solar_quotes").update({ status: "sent", sent_at: now, customer_email: customerEmail }).eq("id", quote.id)
    await db.from("solar_quote_events").insert({ quote_id: quote.id, event_type: "sent", channel: "email", recipient: customerEmail, details: { subject, sender } })
    await finishLog({ status: "success", httpStatus: 202, result: { success: true, recipient: customerEmail, sender, subject, appointment_row_id: appointmentRowId, quote_ref: quote.quote_ref } })
    return json(res, 200, { success: true, message: "Solar quote email accepted by Microsoft 365.", recipient: customerEmail })
  } catch (error) {
    console.error("Send solar quote email failed:", error)
    await finishLog({ status: "failed", httpStatus: 500, errorMessage: error?.message || "Unexpected server error", result: { success: false, message: "Unexpected server error" } })
    return json(res, 500, { error: "An unexpected error occurred while sending the quote." })
  }
}

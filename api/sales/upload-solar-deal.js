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
  if (!accessToken) return json(res, 401, { error: "Please sign in before uploading the solar deal." })

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const pipedriveToken = process.env.PIPEDRIVE_API_TOKEN
  if (![supabaseUrl, serviceKey].every(Boolean)) {
    return json(res, 500, { error: "Supabase server configuration is missing." })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let logId = null
  const finishLog = async ({ status, httpStatus, errorMessage = null, result = {} }) => {
    if (!logId) return
    const { error } = await supabase.from("integration_event_logs").update({
      status,
      http_status: httpStatus,
      error_message: errorMessage,
      result,
      processed_at: new Date().toISOString(),
    }).eq("id", logId)
    if (error) console.error("Unable to update solar deal upload log:", error.message)
  }
  const fail = async (status, message) => {
    await finishLog({
      status: "failed",
      httpStatus: status,
      errorMessage: message,
      result: { success: false, message },
    })
    return json(res, status, { success: false, error: message })
  }

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken)
    if (userError || !userData?.user) return json(res, 401, { error: "Your session has expired. Please sign in again." })

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {})
    const appointmentRowId = String(body?.appointment_row_id || "").trim()
    if (!appointmentRowId) return json(res, 400, { error: "appointment_row_id is required." })

    const { data: logRow, error: logError } = await supabase.from("integration_event_logs").insert({
      provider: "pipedrive",
      integration_name: "Upload Solar Deal",
      direction: "outbound",
      event_name: "upload_solar_deal",
      event_type: "solar_contract_deal_sync",
      external_id: appointmentRowId,
      status: "received",
      received_at: new Date().toISOString(),
      payload: {
        appointment_row_id: appointmentRowId,
        triggered_by: userData.user.email || userData.user.id,
      },
    }).select("id").single()
    if (logError) console.error("Unable to create solar deal upload log:", logError.message)
    else logId = logRow?.id || null

    if (!pipedriveToken) return await fail(500, "PIPEDRIVE_API_TOKEN is not configured.")

    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("appointment_row_id,name,result,email_address,phone_number_1,address,postcode,product,job_type,rep_allocated,branch,sales_notes,epvs_calculation,contract_number,signature_path,express_fit_signature_path,seg_disclaimer_signature_path")
      .eq("appointment_row_id", appointmentRowId)
      .maybeSingle()
    if (appointmentError) throw appointmentError
    if (!appointment) return await fail(404, "Appointment not found.")
    if (String(appointment.result || "").trim().toLowerCase() !== "sold") {
      return await fail(409, "Only appointments marked Sold can be uploaded as a solar deal.")
    }
    if (!appointment.signature_path || !appointment.express_fit_signature_path || !appointment.seg_disclaimer_signature_path) {
      return await fail(409, "All three customer signatures must be saved before uploading the deal.")
    }
    const isSolar = [appointment.product, appointment.job_type].some(value => String(value || "").toLowerCase().includes("solar"))
      || Boolean(appointment.epvs_calculation)
    if (!isSolar) return await fail(409, "This appointment is not identified as a solar contract.")
    if (!appointment.contract_number) return await fail(409, "The contract number has not been saved yet.")

    const pipedriveRequest = async (path, options = {}) => {
      const separator = path.includes("?") ? "&" : "?"
      const response = await fetch(`https://api.pipedrive.com/v1/${path}${separator}api_token=${encodeURIComponent(pipedriveToken)}`, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || payload.error_info || `Pipedrive request failed (HTTP ${response.status}).`)
      }
      return payload.data
    }

    const now = new Date().toISOString()
    const systemCost = Number(appointment?.epvs_calculation?.data?.systemCost || 0)
    const dealValue = Number.isFinite(systemCost) && systemCost > 0 ? systemCost : 0
    const contractTitle = `${appointment.contract_number} - ${appointment.name || "Customer"}`

    const { data: existingSupabaseDeal, error: existingDealError } = await supabase
      .from("deals")
      .select("pipedrive_deal_id")
      .eq("appointment_row_id", appointmentRowId)
      .maybeSingle()
    if (existingDealError) throw existingDealError

    let pipedriveDeal = null
    if (existingSupabaseDeal?.pipedrive_deal_id) {
      pipedriveDeal = await pipedriveRequest(`deals/${encodeURIComponent(existingSupabaseDeal.pipedrive_deal_id)}`, {
        method: "PUT",
        body: JSON.stringify({ title: contractTitle, value: dealValue, currency: "GBP", status: "won" }),
      })
    } else {
      // Recover a deal created by a previous attempt before creating another.
      const search = await pipedriveRequest(`deals/search?term=${encodeURIComponent(appointment.contract_number)}&fields=title&exact_match=true`)
      const existingPipedriveDeal = (search?.items || []).map(item => item?.item).find(item =>
        String(item?.title || "").startsWith(String(appointment.contract_number))
      )
      if (existingPipedriveDeal?.id) {
        pipedriveDeal = await pipedriveRequest(`deals/${encodeURIComponent(existingPipedriveDeal.id)}`, {
          method: "PUT",
          body: JSON.stringify({ title: contractTitle, value: dealValue, currency: "GBP", status: "won" }),
        })
      } else {
        const customerEmail = String(appointment.email_address || "").trim()
        let personId = null
        if (customerEmail) {
          const peopleSearch = await pipedriveRequest(`persons/search?term=${encodeURIComponent(customerEmail)}&fields=email&exact_match=true`)
          const person = (peopleSearch?.items || []).map(item => item?.item).find(candidate =>
            (candidate?.emails || []).some(email => String(email?.value || "").toLowerCase() === customerEmail.toLowerCase())
          )
          if (person?.id) personId = person.id
        }
        if (!personId) {
          const createdPerson = await pipedriveRequest("persons", {
            method: "POST",
            body: JSON.stringify({
              name: appointment.name || customerEmail || "Solar customer",
              email: customerEmail ? [{ value: customerEmail, primary: true, label: "work" }] : [],
              phone: appointment.phone_number_1 ? [{ value: appointment.phone_number_1, primary: true, label: "work" }] : [],
            }),
          })
          personId = createdPerson?.id || null
        }
        pipedriveDeal = await pipedriveRequest("deals", {
          method: "POST",
          body: JSON.stringify({
            title: contractTitle,
            value: dealValue,
            currency: "GBP",
            status: "won",
            person_id: personId || undefined,
          }),
        })
      }
    }

    const pipedriveDealId = Number(pipedriveDeal?.id || pipedriveDeal?.deal?.id || existingSupabaseDeal?.pipedrive_deal_id)
    if (!Number.isFinite(pipedriveDealId) || pipedriveDealId <= 0) {
      throw new Error("Pipedrive did not return a valid deal ID.")
    }

    const { data: existingRow, error: existingRowError } = await supabase
      .from("deals")
      .select("id,created_at")
      .eq("pipedrive_deal_id", pipedriveDealId)
      .maybeSingle()
    if (existingRowError) throw existingRowError

    const dealRow = {
      pipedrive_deal_id: pipedriveDealId,
      contract_number: appointment.contract_number,
      customer_name: appointment.name || null,
      phone: appointment.phone_number_1 || null,
      email: appointment.email_address || null,
      address: appointment.address || null,
      postcode: appointment.postcode || null,
      product: appointment.product || appointment.job_type || "Solar",
      deal_value: dealValue || null,
      salesperson: appointment.rep_allocated || null,
      salesperson_name: appointment.rep_allocated || null,
      sale_date: now.slice(0, 10),
      status: "sold",
      notes: appointment.sales_notes || null,
      synced_at: now,
      updated_at: now,
      pipedrive_data: pipedriveDeal,
      appointment_row_id: appointmentRowId,
      branch: appointment.branch || null,
    }
    const { error: upsertError } = await supabase.from("deals").upsert(dealRow, { onConflict: "pipedrive_deal_id" })
    if (upsertError) throw upsertError

    const result = {
      success: true,
      appointment_row_id: appointmentRowId,
      contract_number: appointment.contract_number,
      pipedrive_deal_id: pipedriveDealId,
      supabase_deal_id: existingRow?.id || null,
      deal_value: dealValue,
    }
    await finishLog({ status: "success", httpStatus: 200, result })
    return json(res, 200, result)
  } catch (error) {
    console.error("Upload solar deal failed:", error)
    await finishLog({
      status: "failed",
      httpStatus: 500,
      errorMessage: error?.message || "Unexpected server error",
      result: { success: false, message: error?.message || "Unexpected server error" },
    })
    return json(res, 500, { success: false, error: error?.message || "Unable to upload solar deal." })
  }
}

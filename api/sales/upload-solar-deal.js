import { createClient } from "@supabase/supabase-js"

const json = (res, status, body) => {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Cache-Control", "no-store")
  return res.status(status).json(body)
}

const ADMIN_FEE = 399
const PIPEDRIVE_OWNER_ID = 11989938
const NEW_CONTRACT_STAGE_ID = 8

const firstValue = (...values) => values.find(value => value !== undefined && value !== null && value !== "")
const numeric = value => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
const personName = profile => String(profile?.full_name || profile?.display_name || profile?.email || "").trim()

function totalPanels(data) {
  const arrays = Array.isArray(data?.arrays) ? data.arrays : []
  const fromArrays = arrays.reduce((sum, array) => sum + Math.max(0, Number(array?.panelCount ?? array?.panel_count ?? array?.numberOfPanels ?? array?.number_of_panels ?? 0) || 0), 0)
  if (fromArrays > 0) return fromArrays
  const hardwareSources = [data?.hardware, data?.openSolar?.hardware, data?.open_solar?.hardware].filter(Boolean)
  for (const source of hardwareSources) {
    const panels = Array.isArray(source?.panels) ? source.panels : []
    const count = panels.reduce((sum, panel) => sum + Math.max(0, Number(panel?.quantity ?? panel?.panelCount ?? panel?.panel_count ?? 0) || 0), 0)
    if (count > 0) return count
  }
  return firstValue(data?.panelQuantity, data?.numberOfPanels, null)
}

function hardwareValue(data, type, key) {
  const sources = [data?.hardware, data?.openSolar?.hardware, data?.open_solar?.hardware].filter(Boolean)
  for (const source of sources) {
    const items = Array.isArray(source?.[type]) ? source[type] : []
    const item = items.find(Boolean)
    if (item && firstValue(item[key], item[key === "capacity" ? "size" : key]) !== undefined) {
      const value = firstValue(item[key], item[key === "capacity" ? "size" : key])
      if (value !== undefined) return value
    }
  }
  return null
}

async function resolveStaff(supabase, appointment) {
  const email = String(appointment?.rep_allocated || "").trim()
  if (!email) return { rep: null, salesManager: null, branchManager: null }

  const { data: rep, error: repError } = await supabase
    .from("profiles")
    .select("id,full_name,display_name,email,role,branch,manager_id,sales_manager")
    .ilike("email", email)
    .maybeSingle()
  if (repError) throw repError
  if (!rep) return { rep: null, salesManager: null, branchManager: null }

  const managerIds = [...new Set([rep.sales_manager, rep.manager_id].filter(Boolean))]
  let managers = []
  if (managerIds.length) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,full_name,display_name,email,role,branch,manager_id,sales_manager")
      .in("id", managerIds)
    if (error) throw error
    managers = data || []
  }

  const roleOf = profile => String(profile?.role || "").toLowerCase()
  const salesManager = managers.find(profile => String(profile.id) === String(rep.sales_manager) && roleOf(profile).includes("sales manager"))
    || managers.find(profile => roleOf(profile).includes("sales manager"))
    || null
  const branchManager = managers.find(profile => String(profile.id) === String(rep.manager_id) && roleOf(profile).includes("branch manager"))
    || managers.find(profile => roleOf(profile).includes("branch manager"))
    || null

  return { rep, salesManager, branchManager }
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
    await finishLog({ status: "failed", httpStatus: status, errorMessage: message, result: { success: false, message } })
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
      payload: { appointment_row_id: appointmentRowId, triggered_by: userData.user.email || userData.user.id },
    }).select("id").single()
    if (logError) console.error("Unable to create solar deal upload log:", logError.message)
    else logId = logRow?.id || null

    if (!pipedriveToken) return await fail(500, "PIPEDRIVE_API_TOKEN is not configured.")

    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("appointment_row_id,name,result,email_address,phone_number_1,secondary_phone_number,address,postcode,product,job_type,rep_allocated,branch,sales_notes,lead_source,canvasser,appointment_date,epvs_calculation,contract_number,signature_path,express_fit_signature_path,seg_disclaimer_signature_path")
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
    if (!appointment.appointment_date) return await fail(409, "The appointment date is missing; Date Sold cannot be populated.")

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
    const data = appointment?.epvs_calculation?.data || {}
    const results = appointment?.epvs_calculation?.results || {}
    const systemCost = numeric(firstValue(data.systemCost, results.systemCost, 0)) || 0
    const dealValue = Math.max(0, systemCost)
    const adminFee = ADMIN_FEE
    const dateSold = String(appointment.appointment_date).slice(0, 10)
    const contractTitle = `${appointment.contract_number} - ${appointment.name || "Customer"}`
    const { rep, salesManager, branchManager } = await resolveStaff(supabase, appointment)

    let lender = null
    const financeProductId = numeric(data.financeProductId)
    if (financeProductId) {
      const { data: financeProduct, error: financeError } = await supabase
        .from("finance_products")
        .select("id,lender,apr,term")
        .eq("id", financeProductId)
        .maybeSingle()
      if (financeError) throw financeError
      lender = financeProduct?.lender || null
    }

    const batteryQuantity = firstValue(data.batteryQuantity, hardwareValue(data, "batteries", "quantity"), null)
    const batteryCapacity = firstValue(data.batteryCapacity, hardwareValue(data, "batteries", "capacity"), null)
    const inverterCapacity = firstValue(data.inverterCapacity, hardwareValue(data, "inverters", "capacity"), null)
    const panelCount = totalPanels(data)

    const contractPdfPath = String(body?.pdf_path || "").trim()
    if (!contractPdfPath || !contractPdfPath.startsWith("contract-pdfs/" + appointmentRowId + "/") || contractPdfPath.includes("..")) {
      return await fail(409, "The generated contract PDF path was not provided or does not match this appointment.")
    }
    const contractFileUrl = `https://crm.homeshield.ltd/contract-file?path=${encodeURIComponent(contractPdfPath)}`

    const fieldsResponse = await pipedriveRequest("dealFields")
    const dealFields = Array.isArray(fieldsResponse) ? fieldsResponse : []
    const normalizedFieldName = value => String(value || "").trim().toLowerCase()
    const fieldByName = new Map(dealFields.map(field => [
      normalizedFieldName(field?.name || field?.field_name),
      String(field?.key || field?.field_code || "").trim(),
    ]).filter(([name, key]) => name && key))
    const contractFileFieldKey = fieldByName.get("contract: file")
    if (!contractFileFieldKey) throw new Error('Pipedrive deal field "Contract: File" was not found.')

    // Custom fields are resolved by their Pipedrive labels, avoiding hard-coded custom-field hashes.
    // Finance: Status is intentionally excluded from this payload.
    const customValues = {
      "Finance: Lender": lender,
      "Finance: Rate": firstValue(data.financeRate, null),
      "Finance: Term": firstValue(data.financeTerm, null),
      "Solar: Inverter Size": inverterCapacity,
      "Solar: Number of Batteries": batteryQuantity,
      "Solar: Battery Size": batteryCapacity,
      "Solar: Number Of Solar Panels": panelCount,
      "Glide: Appointment Table Row": appointment.appointment_row_id,
      "Deposit: Amount": firstValue(data.deposit, null),
      "Contract: Payment Method": firstValue(data.paymentMethod, null),
      "AF: Price - Admin Fee": adminFee,
      "Contract Number": appointment.contract_number,
      "Date Sold": dateSold,
      "Contract: Order Price": systemCost + adminFee,
      "Contract: Contract Price": systemCost,
      "Contract: Net Sales": systemCost,
      "Lead Source": appointment.lead_source,
      "Lead: Marketing Team": "Paul Ross",
      "Lead: Canvasser": appointment.canvasser,
      "Sales Rep": personName(rep) || appointment.rep_allocated,
      "Sales Manager": personName(salesManager) || null,
      "Branch Manager": personName(branchManager) || null,
      "Lead: Phone Number 1": appointment.phone_number_1,
      "Lead: Phone Number 2": appointment.secondary_phone_number,
      "Lead: Email": appointment.email_address,
      "Lead: Postcode": appointment.postcode,
      "Lead: Address": appointment.address,
      "Sales Branch": appointment.branch,
      "ECOF: File": "N/A",
      "Overstay Form": "N/A",
      "Customer Name": appointment.name,
    }
    const missingFields = []
    const customFieldPayload = {}
    for (const [name, value] of Object.entries(customValues)) {
      if (value === undefined || value === null || value === "") continue
      const key = fieldByName.get(normalizedFieldName(name))
      if (!key) {
        missingFields.push(name)
        continue
      }
      customFieldPayload[key] = value
    }
    customFieldPayload[contractFileFieldKey] = contractFileUrl

    const baseDealPayload = {
      title: contractTitle,
      value: dealValue,
      currency: "GBP",
      status: "open",
      stage_id: NEW_CONTRACT_STAGE_ID,
      owner_id: PIPEDRIVE_OWNER_ID,
      ...customFieldPayload,
    }

    const { data: existingSupabaseDeal, error: existingDealError } = await supabase
      .from("deals")
      .select("pipedrive_deal_id")
      .eq("appointment_row_id", appointmentRowId)
      .maybeSingle()
    if (existingDealError) throw existingDealError

    let pipedriveDeal = null
    let personId = null
    if (existingSupabaseDeal?.pipedrive_deal_id) {
      pipedriveDeal = await pipedriveRequest(`deals/${encodeURIComponent(existingSupabaseDeal.pipedrive_deal_id)}`, {
        method: "PUT",
        body: JSON.stringify(baseDealPayload),
      })
    } else {
      const search = await pipedriveRequest(`deals/search?term=${encodeURIComponent(appointment.contract_number)}&fields=title&exact_match=true`)
      const existingPipedriveDeal = (search?.items || []).map(item => item?.item).find(item =>
        String(item?.title || "").startsWith(String(appointment.contract_number))
      )
      if (existingPipedriveDeal?.id) {
        pipedriveDeal = await pipedriveRequest(`deals/${encodeURIComponent(existingPipedriveDeal.id)}`, {
          method: "PUT",
          body: JSON.stringify(baseDealPayload),
        })
      } else {
        const customerEmail = String(appointment.email_address || "").trim()
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
          body: JSON.stringify({ ...baseDealPayload, person_id: personId || undefined }),
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
      salesperson_name: personName(rep) || appointment.rep_allocated || null,
      sale_date: dateSold,
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
      stage_id: NEW_CONTRACT_STAGE_ID,
      date_sold: dateSold,
      custom_fields_updated: Object.keys(customFieldPayload).length - 1,
      custom_fields_missing_in_pipedrive: missingFields,
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

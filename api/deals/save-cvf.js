import { createClient } from "@supabase/supabase-js"

const ON_HOLD_STAGE_ID = 174

const json = (res, status, body) => {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Cache-Control", "no-store")
  return res.status(status).json(body)
}

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { success: false, error: "Method not allowed." })

  const authorization = req.headers?.authorization || ""
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : ""
  if (!accessToken) return json(res, 401, { success: false, error: "Please sign in before saving the CVF." })

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const pipedriveToken = process.env.PIPEDRIVE_API_TOKEN
  if (!supabaseUrl || !serviceKey) return json(res, 500, { success: false, error: "Supabase server configuration is missing." })
  if (!pipedriveToken) return json(res, 500, { success: false, error: "Pipedrive integration is not configured." })

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken)
    if (userError || !userData?.user) return json(res, 401, { success: false, error: "Your session has expired. Please sign in again." })

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {})
    const dealId = String(body.deal_id || "").trim()
    const fileName = String(body.file_name || "").trim()
    const storagePath = String(body.storage_path || "").trim()
    if (!dealId || !/^[a-zA-Z0-9_-]+ - Contract Variation \d{3}\.pdf$/.test(fileName)) {
      return json(res, 400, { success: false, error: "The deal or CVF filename is invalid." })
    }
    if (!storagePath) return json(res, 400, { success: false, error: "The uploaded CVF storage path is missing." })

    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("id,appointment_row_id,contract_number,pipedrive_deal_id,updated_epvs_calculation,customer_name,address,postcode")
      .eq("id", dealId)
      .maybeSingle()
    if (dealError) throw dealError
    if (!deal?.appointment_row_id) return json(res, 404, { success: false, error: "The deal or its linked appointment could not be found." })
    if (!deal.pipedrive_deal_id) return json(res, 409, { success: false, error: "This deal is not linked to a Pipedrive deal." })
    const updatedCalculation = deal.updated_epvs_calculation
    if (!updatedCalculation?.data || !updatedCalculation?.results || !updatedCalculation?.thirtyYearProjection) {
      return json(res, 409, { success: false, error: "The saved Updated EPVS calculation is incomplete. The current EPVS baseline has not been changed." })
    }

    const appointmentRowId = String(deal.appointment_row_id)
    if (storagePath !== `cvf-pdfs/${appointmentRowId}/${fileName}`) {
      return json(res, 400, { success: false, error: "The CVF storage path does not match this deal." })
    }
    const folder = `cvf-pdfs/${appointmentRowId}`
    const { data: storedFiles, error: storageError } = await supabase.storage.from("signatures").list(folder, { limit: 100 })
    if (storageError) throw storageError
    if (!(storedFiles || []).some(file => file.name === fileName)) {
      return json(res, 404, { success: false, error: "The CVF PDF was not found in Storage. Please retry the upload." })
    }

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

    // Update the linked Pipedrive person first. The deal-updated webhook
    // reads customer name/postcode from this person and would otherwise
    // immediately overwrite the corrected CRM values with stale details.
    const pipedriveDeal = await pipedriveRequest(`deals/${encodeURIComponent(deal.pipedrive_deal_id)}`)
    const personId = pipedriveDeal?.person_id?.value ?? pipedriveDeal?.person_id ?? null
    if (!personId) throw new Error("The linked Pipedrive person could not be found, so customer details were not synced.")

    const customerName = String(deal.customer_name || "").trim()
    const customerAddress = String(deal.address || "").trim()
    const customerPostcode = String(deal.postcode || "").trim()
    if (!customerName || !customerAddress || !customerPostcode) {
      throw new Error("The deal must have a customer name, address and postcode before syncing the CVF.")
    }

    const personUpdate = await fetch(
      `https://api.pipedrive.com/api/v2/persons/${encodeURIComponent(personId)}?api_token=${encodeURIComponent(pipedriveToken)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: customerName,
          // "address" is the standard Pipedrive person field. "postal_address"
          // is a Contact Sync-only field and returns HTTP 403 when that
          // optional feature is not enabled.
          address: [customerAddress, customerPostcode].filter(Boolean).join(", "),
        }),
      }
    )
    const personPayload = await personUpdate.json().catch(() => ({}))
    if (!personUpdate.ok || personPayload.success === false) {
      throw new Error(personPayload.error || personPayload.error_info || `Unable to update the linked Pipedrive person's name and address (HTTP ${personUpdate.status}).`)
    }

    const fields = await pipedriveRequest("dealFields")
    const leadAddressField = (Array.isArray(fields) ? fields : []).find(field =>
      String(field?.name || field?.field_name || "").trim().toLowerCase() === "lead: address"
    )
    const leadAddressFieldKey = String(leadAddressField?.key || leadAddressField?.field_code || "").trim()
    if (!leadAddressFieldKey) throw new Error('Pipedrive deal field "Lead: Address" was not found.')

    const contractFileField = (Array.isArray(fields) ? fields : []).find(field =>
      String(field?.name || field?.field_name || "").trim().toLowerCase() === "contract: file"
    )
    const contractFileFieldKey = String(contractFileField?.key || contractFileField?.field_code || "").trim()
    if (!contractFileFieldKey) throw new Error('Pipedrive deal field "Contract: File" was not found.')

    const contractFileUrl = `https://crm.homeshield.ltd/contract-file?path=${encodeURIComponent(storagePath)}`
    await pipedriveRequest(`deals/${encodeURIComponent(deal.pipedrive_deal_id)}`, {
      method: "PUT",
      body: JSON.stringify({
        [contractFileFieldKey]: contractFileUrl,
        [leadAddressFieldKey]: customerAddress,
        stage_id: ON_HOLD_STAGE_ID,
      }),
    })

    // Once the revised paperwork is safely stored and the Pipedrive deal is
    // updated, promote the exact Updated EPVS JSON used for this CVF to become
    // the new Current EPVS baseline for the next variation.
    const { data: promotedRows, error: promoteError } = await supabase
      .from("deals")
      .update({ current_epvs_calculation: updatedCalculation })
      .eq("id", deal.id)
      .select("id")
    if (promoteError) throw promoteError
    if (!Array.isArray(promotedRows) || promotedRows.length !== 1) {
      throw new Error("The CVF was saved and synced to Pipedrive, but the Current EPVS baseline could not be updated. Please retry.")
    }

    return json(res, 200, {
      success: true,
      storage_path: storagePath,
      contract_file_url: contractFileUrl,
      stage_id: ON_HOLD_STAGE_ID,
      customer_details_synced: true,
      current_epvs_promoted: true,
    })
  } catch (error) {
    console.error("Save CVF failed:", error)
    return json(res, 500, { success: false, error: error?.message || "Unable to save the CVF and update Pipedrive." })
  }
}

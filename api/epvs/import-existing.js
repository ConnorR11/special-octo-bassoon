import { createClient } from "@supabase/supabase-js"

const json = (res, status, body) => {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Cache-Control", "no-store")
  return res.status(status).json(body)
}

function mapValidation(item) {
  const id = Number(item?.id)
  if (!Number.isSafeInteger(id) || id <= 0) return null

  const first = item.customer_first_name || null
  const last = item.customer_last_name || null
  const fullName = item.customer_full_name || [first, last].filter(Boolean).join(" ") || null
  const address = item.installation_address_full ||
    [item.installation_address_line_1, item.installation_address_line_2, item.installation_address_line_3, item.installation_area_town, item.installation_county]
      .filter(Boolean).join(", ") || null
  const statusName = item.validation_status?.name || item.validation_status?.status || item.status || null
  const productName = item.product_type?.name || item.product_type?.title || null

  return {
    epvs_validation_id: id,
    customer_first_name: first,
    customer_last_name: last,
    customer_full_name: fullName,
    customer_phone: item.customer_phone || null,
    customer_email: item.customer_email || null,
    installation_address: address,
    installation_postcode: item.installation_postcode || null,
    product_type_id: item.product_type_id == null ? null : Number(item.product_type_id),
    validation_status_id: item.validation_status_id == null ? null : Number(item.validation_status_id),
    status: statusName,
    contract_value: item.total_contract_value == null || item.total_contract_value === "" ? null : Number(item.total_contract_value),
    contract_signed_at: item.date_contract_signed || null,
    epvs_created_at: item.created_at || null,
    epvs_updated_at: item.updated_at || null,
    last_activity_at: item.last_activity_at || null,
    last_synced_at: new Date().toISOString(),
    raw_payload: item,
    updated_at: new Date().toISOString(),
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." })

  const authorization = String(req.headers?.authorization || "")
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : ""
  if (!accessToken) return json(res, 401, { error: "Please sign in to import EPVS applications." })

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim()
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
  const epvsToken = String(process.env.EPVS_TOKEN || "").trim()
  if (!supabaseUrl || !serviceKey) return json(res, 500, { error: "Supabase server configuration is missing." })
  if (!epvsToken) return json(res, 500, { error: "EPVS_TOKEN is not configured on the server." })

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !authData?.user) return json(res, 401, { error: "Your session has expired. Please sign in again." })

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("permission_level, active")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle()
    if (profileError) throw profileError
    if (!profile || profile.active === false || Number(profile.permission_level || 0) < 3) {
      return json(res, 403, { error: "Administrator or management access is required to import EPVS applications." })
    }

    const epvsResponse = await fetch("https://validationhub.co.uk/api/v1/validations", {
      method: "GET",
      headers: { Authorization: "Bearer " + epvsToken, Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    })
    const responseText = await epvsResponse.text()
    let responseData
    try { responseData = JSON.parse(responseText) } catch { responseData = null }
    if (!epvsResponse.ok) {
      console.error("EPVS list request failed", { status: epvsResponse.status, body: responseText.slice(0, 500) })
      return json(res, 502, { error: "EPVS rejected the application-list request.", epvsHttpStatus: epvsResponse.status })
    }
    if (!responseData || !Array.isArray(responseData.data)) {
      console.error("Unexpected EPVS list response shape", responseText.slice(0, 500))
      return json(res, 502, { error: "EPVS returned an unexpected response. No records were imported." })
    }

    const mapped = responseData.data.map(mapValidation).filter(Boolean)
    let imported = 0
    for (let i = 0; i < mapped.length; i += 100) {
      const batch = mapped.slice(i, i + 100)
      const { data, error } = await supabase
        .from("epvs_submissions")
        .upsert(batch, { onConflict: "epvs_validation_id" })
        .select("id")
      if (error) throw error
      imported += data?.length || batch.length
    }

    return json(res, 200, {
      status: "success",
      fetchedFromEpvs: responseData.data.length,
      importedOrUpdated: imported,
      skippedInvalidRecords: responseData.data.length - mapped.length,
      note: "Existing links to CRM deals were preserved; no new EPVS applications were submitted.",
    })
  } catch (error) {
    console.error("EPVS import failed:", error)
    return json(res, 500, { error: "Unable to import EPVS applications.", detail: error instanceof Error ? error.message : String(error) })
  }
}

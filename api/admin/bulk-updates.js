function send(res, status, body) {
  res.status(status).json(body)
}

function header(req, name) {
  const value = req.headers?.[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

async function isAuthorized(req, config) {
  // Authenticate the user's Supabase session, then enforce the same permission level
  // used by the CRM's admin pages. Never expose the Pipedrive API token to the browser.
  const auth = String(header(req, "authorization") || "")
  if (!auth.toLowerCase().startsWith("bearer ")) return false
  const userToken = auth.slice(7).trim()
  if (!userToken || !config.supabaseUrl || !config.serviceKey) return false

  const userResponse = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: config.serviceKey, Authorization: `Bearer ${userToken}`, Accept: "application/json" },
  })
  const user = await responseJson(userResponse)
  if (!userResponse.ok || !user?.id) return false

  const profileUrl = new URL(`${config.supabaseUrl}/rest/v1/profiles`)
  profileUrl.searchParams.set("select", "permission_level,active")
  profileUrl.searchParams.set("auth_user_id", `eq.${user.id}`)
  profileUrl.searchParams.set("limit", "1")
  const profileResponse = await fetch(profileUrl, {
    headers: { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}`, Accept: "application/json" },
  })
  const profiles = await responseJson(profileResponse)
  if (!profileResponse.ok || !Array.isArray(profiles) || !profiles.length) return false
  const profile = profiles[0]
  return Number(profile.permission_level) >= 4 && profile.active !== false
}

function getConfig() {
  return {
    supabaseUrl: String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, ""),
    serviceKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
    pipedriveToken: String(process.env.PIPEDRIVE_API_TOKEN || "").trim(),
  }
}

async function responseJson(response) {
  return response.json().catch(() => ({}))
}

async function fetchPipedriveWithRateLimitRetry(url, options = {}, maxRetries = 4) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, options)
    if (response.status !== 429 || attempt >= maxRetries) return response
    const retryAfter = Number(response.headers.get("retry-after"))
    const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 30000)
      : Math.min(1000 * (2 ** attempt), 16000)
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
}

async function fetchStageMap(token) {
  const response = await fetchPipedriveWithRateLimitRetry(`https://api.pipedrive.com/api/v2/stages?limit=500&api_token=${encodeURIComponent(token)}`, {
    headers: { Accept: "application/json" },
  })
  const json = await responseJson(response)
  if (!response.ok || !json?.success || !Array.isArray(json.data)) {
    const retryHint = response.status === 429 ? " Pipedrive rate limit is still active; wait briefly and retry." : ""
    throw new Error(`Pipedrive stage list failed (HTTP ${response.status}).${retryHint}`)
  }
  return new Map(json.data.map((stage) => [String(stage.id), String(stage.name || "").trim()]).filter((entry) => entry[1]))
}

async function fetchDealStage(token, dealId, stageMap) {
  const response = await fetchPipedriveWithRateLimitRetry(`https://api.pipedrive.com/api/v2/deals/${encodeURIComponent(dealId)}?api_token=${encodeURIComponent(token)}`, {
    headers: { Accept: "application/json" },
  })
  const json = await responseJson(response)
  if (!response.ok || !json?.success || !json?.data) {
    return { stage: null, error: `Pipedrive deal lookup failed (HTTP ${response.status})` }
  }
  const deal = json.data
  const stageIdValue = deal.stage_id?.id ?? deal.stage_id?.value ?? deal.stage_id
  const stageId = stageIdValue === null || stageIdValue === undefined ? "" : String(stageIdValue)
  const stage = String(deal.stage_name || deal.stage?.name || stageMap.get(stageId) || "").trim()
  return stage ? { stage, stageId: stageId || null } : { stage: null, stageId: stageId || null, error: "No stage name returned by Pipedrive" }
}

async function getMissingStageRows(config, limit, offset) {
  const url = new URL(`${config.supabaseUrl}/rest/v1/deals`)
  url.searchParams.set("select", "id,pipedrive_deal_id,pipedrive_stage,contract_number,customer_name,sale_date")
  url.searchParams.set("pipedrive_deal_id", "not.is.null")
  url.searchParams.set("or", "(pipedrive_stage.is.null,pipedrive_stage.eq.)")
  url.searchParams.set("order", "sale_date.asc.nullslast,id.asc")
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("offset", String(offset))
  const response = await fetch(url, {
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      Accept: "application/json",
      Prefer: "count=exact",
    },
  })
  const rows = await responseJson(response)
  if (!response.ok || !Array.isArray(rows)) {
    throw new Error(`Supabase lookup failed (HTTP ${response.status})`)
  }
  const contentRange = String(response.headers.get("content-range") || "")
  const totalMatch = contentRange.match(/\/(\d+)$/)
  return { rows, total: totalMatch ? Number(totalMatch[1]) : null }
}

async function updateStageIfStillMissing(config, row, stage) {
  const url = new URL(`${config.supabaseUrl}/rest/v1/deals`)
  url.searchParams.set("id", `eq.${row.id}`)
  url.searchParams.set("pipedrive_deal_id", `eq.${row.pipedrive_deal_id}`)
  url.searchParams.set("or", "(pipedrive_stage.is.null,pipedrive_stage.eq.)")
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ pipedrive_stage: stage, updated_at: new Date().toISOString() }),
  })
  const updated = await responseJson(response)
  if (!response.ok || !Array.isArray(updated)) {
    return { success: false, error: `Supabase update failed (HTTP ${response.status})` }
  }
  return { success: updated.length === 1, skipped: updated.length === 0 }
}

async function runBackfill(config, { limit, offset, dryRun }) {
  const { rows, total } = await getMissingStageRows(config, limit, offset)
  if (!rows.length) {
    return { job: "backfill-pipedrive-stages", dryRun, requested: 0, updated: 0, skipped: 0, failed: 0, totalMissing: total, nextOffset: null, results: [] }
  }

  const stageMap = await fetchStageMap(config.pipedriveToken)
  const results = new Array(rows.length)
  let cursor = 0
  const worker = async () => {
    while (true) {
      const index = cursor++
      if (index >= rows.length) return
      const row = rows[index]
      const dealId = String(row.pipedrive_deal_id)
      try {
        const found = await fetchDealStage(config.pipedriveToken, dealId, stageMap)
        if (!found.stage) {
          results[index] = { dealId, contractNumber: row.contract_number, customerName: row.customer_name, status: "failed", error: found.error, stageId: found.stageId || null }
          continue
        }
        if (dryRun) {
          results[index] = { dealId, contractNumber: row.contract_number, customerName: row.customer_name, status: "preview", stage: found.stage }
          continue
        }
        const update = await updateStageIfStillMissing(config, row, found.stage)
        results[index] = {
          dealId,
          contractNumber: row.contract_number,
          customerName: row.customer_name,
          status: update.success ? "updated" : update.skipped ? "skipped" : "failed",
          stage: found.stage,
          ...(update.error ? { error: update.error } : {}),
        }
      } catch {
        results[index] = { dealId, contractNumber: row.contract_number, customerName: row.customer_name, status: "failed", error: "Unexpected error processing this deal" }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, rows.length) }, () => worker()))

  const updated = results.filter((item) => item.status === "updated").length
  const skipped = results.filter((item) => item.status === "skipped").length
  const failed = results.filter((item) => item.status === "failed").length
  return {
    job: "backfill-pipedrive-stages",
    dryRun,
    requested: rows.length,
    updated,
    previewed: results.filter((item) => item.status === "preview").length,
    skipped,
    failed,
    totalMissing: total,
    nextOffset: rows.length === limit && (total === null || total > 0) ? 0 : null,
    results,
  }
}

async function logBulkRun(config, { jobName, status, httpStatus, errorMessage = null, result = null, query = null, externalId = null }) {
  const url = `${config.supabaseUrl}/rest/v1/integration_event_logs`
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      provider: "pipedrive",
      integration_name: "CRM Bulk Updates",
      direction: "outbound",
      event_name: jobName,
      event_type: "bulk_update",
      external_id: externalId,
      status,
      http_status: httpStatus,
      error_message: errorMessage,
      payload: query,
      result,
      processed_at: status === "received" ? null : new Date().toISOString(),
    }),
  })
  if (!response.ok) {
    const details = await response.text().catch(() => "")
    console.error("Bulk update integration log failed", response.status, details)
    throw new Error("Could not write the required integration log entry")
  }
}


const INSTALLATION_START_DATE_FIELD_KEY = "55177af32aecef5d2f250bd701c2bbee064136fc"
function normalisePipedriveDate(value) {
  let current = value
  for (let i = 0; i < 5; i += 1) {
    if (current === null || current === undefined || current === "") return null
    if (typeof current !== "object" || Array.isArray(current)) break
    if (Object.prototype.hasOwnProperty.call(current, "value")) current = current.value
    else if (Object.prototype.hasOwnProperty.call(current, "date")) current = current.date
    else if (Object.prototype.hasOwnProperty.call(current, "start_date")) current = current.start_date
    else break
  }
  if (current === null || current === undefined || current === "") return null
  const text = String(current).trim()
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  const uk = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (uk) return uk[3] + "-" + uk[2].padStart(2, "0") + "-" + uk[1].padStart(2, "0")
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}
async function getMissingInstallationDateRows(config, limit, offset) {
  const url = new URL(config.supabaseUrl + "/rest/v1/deals")
  url.searchParams.set("select", "id,pipedrive_deal_id,installation_start_date,contract_number,customer_name")
  url.searchParams.set("pipedrive_deal_id", "not.is.null")
  // Temporarily limit this backfill to deals at the Contract Complete stage.
  url.searchParams.set("pipedrive_stage", "eq.Contract Complete")
  // installation_start_date is a date column, so missing values are SQL NULL.
  // Avoid an empty-string OR filter, which PostgREST rejects for date columns.
  url.searchParams.set("installation_start_date", "is.null")
  url.searchParams.set("order", "sale_date.asc.nullslast,id.asc")
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("offset", String(offset))
  const response = await fetch(url, { headers: { apikey: config.serviceKey, Authorization: "Bearer " + config.serviceKey, Accept: "application/json", Prefer: "count=exact" } })
  const rows = await responseJson(response)
  if (!response.ok || !Array.isArray(rows)) {
    const detail = rows && typeof rows === "object" ? (rows.message || rows.details || rows.hint || rows.error) : null
    throw new Error("Supabase lookup failed (HTTP " + response.status + ")" + (detail ? ": " + String(detail).slice(0, 300) : ""))
  }
  const totalMatch = String(response.headers.get("content-range") || "").match(/\/(\d+)$/)
  return { rows, total: totalMatch ? Number(totalMatch[1]) : null }
}
async function fetchPipedriveInstallationDate(token, dealId) {
  // Try v2 first, then v1: custom deal fields can be represented differently
  // between API versions and the v1 response exposes fields by their field key.
  const v2Url = new URL("https://api.pipedrive.com/api/v2/deals/" + encodeURIComponent(dealId))
  v2Url.searchParams.set("api_token", token)
  // Pipedrive v2 requires custom fields to be explicitly requested.
  v2Url.searchParams.set("custom_fields", INSTALLATION_START_DATE_FIELD_KEY)
  const endpoints = [
    v2Url.toString(),
    "https://api.pipedrive.com/v1/deals/" + encodeURIComponent(dealId) + "?api_token=" + encodeURIComponent(token),
  ]
  let lastHttpStatus = null
  let fieldWasPresent = false
  for (const url of endpoints) {
    const response = await fetchPipedriveWithRateLimitRetry(url, { headers: { Accept: "application/json" } })
    const json = await responseJson(response)
    lastHttpStatus = response.status
    if (!response.ok || !json?.success || !json?.data) continue
    const deal = json.data
    const fields = deal.custom_fields && typeof deal.custom_fields === "object" ? deal.custom_fields : deal
    const raw = fields[INSTALLATION_START_DATE_FIELD_KEY] ?? deal[INSTALLATION_START_DATE_FIELD_KEY]
    if (raw !== undefined && raw !== null && raw !== "") fieldWasPresent = true
    const date = normalisePipedriveDate(raw)
    if (date) return { date }
  }
  if (lastHttpStatus !== null && lastHttpStatus >= 400) {
    return { date: null, error: "Pipedrive deal lookup failed (HTTP " + lastHttpStatus + ")" }
  }
  return {
    date: null,
    error: fieldWasPresent
      ? "Installation: Start Date field was returned by Pipedrive but was not a valid date"
      : "Installation: Start Date field was not present or is blank in both Pipedrive API responses",
  }
}
async function updateInstallationDateIfStillMissing(config, row, date) {
  const url = new URL(config.supabaseUrl + "/rest/v1/deals")
  url.searchParams.set("id", "eq." + row.id)
  url.searchParams.set("pipedrive_deal_id", "eq." + row.pipedrive_deal_id)
  url.searchParams.set("or", "(installation_start_date.is.null,installation_start_date.eq.)")
  const response = await fetch(url, {
    method: "PATCH",
    headers: { apikey: config.serviceKey, Authorization: "Bearer " + config.serviceKey, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ installation_start_date: date, updated_at: new Date().toISOString() }),
  })
  const updated = await responseJson(response)
  if (!response.ok || !Array.isArray(updated)) return { success: false, error: "Supabase update failed (HTTP " + response.status + ")" }
  return { success: updated.length === 1, skipped: updated.length === 0 }
}
async function runInstallationDateBackfill(config, { limit, offset, dryRun }) {
  const { rows, total } = await getMissingInstallationDateRows(config, limit, offset)
  if (!rows.length) return { job: "backfill-installation-start-dates", dryRun, requested: 0, previewed: 0, updated: 0, skipped: 0, failed: 0, totalMissing: total, nextOffset: null, results: [] }
  const results = new Array(rows.length)
  let cursor = 0
  const worker = async () => {
    while (true) {
      const index = cursor++
      if (index >= rows.length) return
      const row = rows[index]
      const dealId = String(row.pipedrive_deal_id)
      try {
        const found = await fetchPipedriveInstallationDate(config.pipedriveToken, dealId)
        if (!found.date) {
          const confirmedEmpty = String(found.error || "").includes("field was not present or is blank")
          results[index] = {
            dealId,
            contractNumber: row.contract_number,
            customerName: row.customer_name,
            status: confirmedEmpty ? "skipped" : "failed",
            error: confirmedEmpty ? "No Installation: Start Date in Pipedrive — skipped for this run" : found.error,
          }
          continue
        }
        if (dryRun) { results[index] = { dealId, contractNumber: row.contract_number, customerName: row.customer_name, status: "preview", installationStartDate: found.date }; continue }
        const update = await updateInstallationDateIfStillMissing(config, row, found.date)
        results[index] = { dealId, contractNumber: row.contract_number, customerName: row.customer_name, status: update.success ? "updated" : update.skipped ? "skipped" : "failed", installationStartDate: found.date, ...(update.error ? { error: update.error } : {}) }
      } catch { results[index] = { dealId, contractNumber: row.contract_number, customerName: row.customer_name, status: "failed", error: "Unexpected error processing this deal" } }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, rows.length) }, () => worker()))
  const updated = results.filter(item => item.status === "updated").length
  const skipped = results.filter(item => item.status === "skipped").length
  const failed = results.filter(item => item.status === "failed").length
  return { job: "backfill-installation-start-dates", dryRun, requested: rows.length, updated, previewed: results.filter(item => item.status === "preview").length, skipped, failed, totalMissing: total, nextOffset: rows.length === limit && (total === null || total > 0) ? 0 : null, results }
}

const JOBS = {
  "backfill-pipedrive-stages": runBackfill,
  "backfill-installation-start-dates": runInstallationDateBackfill,
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return send(res, 405, { success: false, error: "Use GET for the authenticated bulk job endpoint" })
  }

  const config = getConfig()
  let authorized = false
  try { authorized = await isAuthorized(req, config) } catch { authorized = false }
  if (!authorized) {
    res.setHeader("WWW-Authenticate", 'Bearer realm="CRM Bulk Updates"')
    return send(res, 401, { success: false, error: "Unauthorized. Sign in with an active CRM administrator account." })
  }

  if (!config.supabaseUrl || !config.serviceKey || !config.pipedriveToken) {
    return send(res, 500, { success: false, error: "Required Supabase or Pipedrive environment variables are missing." })
  }

  const query = req.query || {}
  const jobName = String(query.job || "backfill-pipedrive-stages")
  const job = JOBS[jobName]
  if (!job) return send(res, 400, { success: false, error: "Unknown job", availableJobs: Object.keys(JOBS) })

  const limit = Math.min(250, Math.max(1, Number.parseInt(query.limit, 10) || 250))
  const offset = Math.max(0, Number.parseInt(query.offset, 10) || 0)
  const dryRun = String(query.execute || "").toLowerCase() !== "true"
  const runQuery = { limit, offset, dryRun }

  try {
    // Record the run before calling the external API; then record its outcome.
    await logBulkRun(config, { jobName, status: "received", httpStatus: 200, query: runQuery })
  } catch {
    return send(res, 500, { success: false, error: "Bulk update was not run because its integration-log entry could not be created." })
  }

  try {
    const result = await job(config, { limit, offset, dryRun })
    const success = result.failed === 0
    const summary = {
      requested: result.requested,
      updated: result.updated,
      previewed: result.previewed || 0,
      skipped: result.skipped,
      failed: result.failed,
      totalMissing: result.totalMissing,
      nextOffset: result.nextOffset,
    }
    await logBulkRun(config, {
      jobName,
      status: success ? (dryRun ? "success" : "success") : "failed",
      httpStatus: success ? 200 : 207,
      query: runQuery,
      result: summary,
    })
    return send(res, success ? 200 : 207, { success, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bulk job failed"
    try {
      await logBulkRun(config, { jobName, status: "failed", httpStatus: 502, errorMessage: message, query: runQuery })
    } catch {
      // Preserve the original integration failure response; the logging failure is visible in server logs.
    }
    return send(res, 502, { success: false, job: jobName, error: message })
  }
}

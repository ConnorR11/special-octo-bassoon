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

async function fetchStageMap(token) {
  const response = await fetch(`https://api.pipedrive.com/api/v2/stages?limit=500&api_token=${encodeURIComponent(token)}`, {
    headers: { Accept: "application/json" },
  })
  const json = await responseJson(response)
  if (!response.ok || !json?.success || !Array.isArray(json.data)) {
    throw new Error(`Pipedrive stage list failed (HTTP ${response.status})`)
  }
  return new Map(json.data.map((stage) => [String(stage.id), String(stage.name || "").trim()]).filter((entry) => entry[1]))
}

async function fetchDealStage(token, dealId, stageMap) {
  const response = await fetch(`https://api.pipedrive.com/api/v2/deals/${encodeURIComponent(dealId)}?api_token=${encodeURIComponent(token)}`, {
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
  url.searchParams.set("select", "id,pipedrive_deal_id,pipedrive_stage,contract_number,customer_name")
  url.searchParams.set("pipedrive_deal_id", "not.is.null")
  url.searchParams.set("or", "(pipedrive_stage.is.null,pipedrive_stage.eq.)")
  url.searchParams.set("order", "id.asc")
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

const JOBS = {
  "backfill-pipedrive-stages": runBackfill,
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

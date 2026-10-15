function send(res, status, body) {
  res.status(status).json(body)
}

function header(req, name) {
  const value = req.headers?.[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function hasValidBasicAuth(req) {
  const username = String(process.env.PIPEDRIVE_WEBHOOK_USERNAME || "").trim()
  const password = String(process.env.PIPEDRIVE_WEBHOOK_PASSWORD || "").trim()
  // Bulk updates must fail closed; never allow an unauthenticated request.
  if (!username || !password) return false
  const auth = String(header(req, "authorization") || "")
  if (!auth.toLowerCase().startsWith("basic ")) return false
  try {
    const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8")
    const split = decoded.indexOf(":")
    return split >= 0 && decoded.slice(0, split) === username && decoded.slice(split + 1) === password
  } catch {
    return false
  }
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
    nextOffset: rows.length === limit && (total === null || offset + rows.length < total) ? offset + rows.length : null,
    results,
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

  if (!hasValidBasicAuth(req)) {
    res.setHeader("WWW-Authenticate", 'Basic realm="CRM Bulk Updates"')
    return send(res, 401, { success: false, error: "Unauthorized. Configure PIPEDRIVE_WEBHOOK_USERNAME and PIPEDRIVE_WEBHOOK_PASSWORD in Vercel." })
  }

  const config = getConfig()
  if (!config.supabaseUrl || !config.serviceKey || !config.pipedriveToken) {
    return send(res, 500, { success: false, error: "Required Supabase or Pipedrive environment variables are missing." })
  }

  const query = req.query || {}
  const jobName = String(query.job || "backfill-pipedrive-stages")
  const job = JOBS[jobName]
  if (!job) return send(res, 400, { success: false, error: "Unknown job", availableJobs: Object.keys(JOBS) })

  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 100))
  const offset = Math.max(0, Number.parseInt(query.offset, 10) || 0)
  // Safe by default: no writes unless execute=true is explicitly supplied.
  const dryRun = String(query.execute || "").toLowerCase() !== "true"

  try {
    const result = await job(config, { limit, offset, dryRun })
    return send(res, 200, { success: result.failed === 0, ...result })
  } catch (error) {
    return send(res, 502, { success: false, job: jobName, error: error instanceof Error ? error.message : "Bulk job failed" })
  }
}

function send(res, status, body) {
  res.status(status).json(body)
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return send(res, 405, { success: false, error: "Method not allowed" })
  }

  const expectedSecret = String(process.env.PIPEDRIVE_STAGE_SYNC_SECRET || "").trim()
  const suppliedSecret = String(req.query?.key || "").trim()
  if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
    return send(res, 401, { success: false, error: "Unauthorized" })
  }

  // Deliberately restricted to the single approved test deal.
  const dealId = "32578"
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim()
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
  const pipedriveToken = String(process.env.PIPEDRIVE_API_TOKEN || "").trim()

  if (!supabaseUrl || !serviceRoleKey || !pipedriveToken) {
    return send(res, 500, { success: false, error: "Required server environment variables are missing" })
  }

  try {
    const pdResponse = await fetch(
      `https://api.pipedrive.com/api/v2/deals/${dealId}?api_token=${encodeURIComponent(pipedriveToken)}`,
      { headers: { Accept: "application/json" } }
    )
    const pdJson = await pdResponse.json().catch(() => ({}))
    if (!pdResponse.ok || !pdJson?.success || !pdJson?.data) {
      return send(res, 502, { success: false, error: "Pipedrive deal lookup failed", upstreamStatus: pdResponse.status })
    }

    const deal = pdJson.data
    let stageName = String(deal.stage_name || deal.stage?.name || "").trim()
    const stageId = deal.stage_id?.id ?? deal.stage_id?.value ?? deal.stage_id

    if (!stageName && stageId) {
      const stageResponse = await fetch(
        `https://api.pipedrive.com/api/v2/stages/${encodeURIComponent(String(stageId))}?api_token=${encodeURIComponent(pipedriveToken)}`,
        { headers: { Accept: "application/json" } }
      )
      const stageJson = await stageResponse.json().catch(() => ({}))
      if (stageResponse.ok && stageJson?.success) {
        stageName = String(stageJson?.data?.name || "").trim()
      }
    }

    if (!stageName) {
      return send(res, 502, { success: false, error: "Pipedrive returned no usable stage name", stageId: stageId ?? null })
    }

    const lookupUrl = `${supabaseUrl}/rest/v1/deals?pipedrive_deal_id=eq.${dealId}&select=id,pipedrive_deal_id,pipedrive_stage,contract_number,customer_name`
    const lookup = await fetch(lookupUrl, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, Accept: "application/json" }
    })
    const rows = await lookup.json().catch(() => [])
    if (!lookup.ok || !Array.isArray(rows) || rows.length !== 1) {
      return send(res, 502, { success: false, error: "Could not uniquely match the Supabase deal", matchedRows: Array.isArray(rows) ? rows.length : null })
    }

    const row = rows[0]
    if (row.pipedrive_stage && String(row.pipedrive_stage).trim()) {
      return send(res, 409, { success: false, error: "Record already has a stage; left unchanged", dealId, customerName: row.customer_name, existingStage: row.pipedrive_stage })
    }

    const patch = await fetch(
      `${supabaseUrl}/rest/v1/deals?id=eq.${encodeURIComponent(row.id)}&pipedrive_deal_id=eq.${dealId}&pipedrive_stage=is.null`,
      {
        method: "PATCH",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({ pipedrive_stage: stageName, updated_at: new Date().toISOString() })
      }
    )
    const updated = await patch.json().catch(() => [])
    if (!patch.ok) {
      return send(res, 502, { success: false, error: "Supabase update failed", upstreamStatus: patch.status })
    }

    // Verify by reading the row back, not just trusting the PATCH response.
    const verify = await fetch(
      `${supabaseUrl}/rest/v1/deals?id=eq.${encodeURIComponent(row.id)}&select=id,pipedrive_deal_id,pipedrive_stage,contract_number,customer_name`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, Accept: "application/json" } }
    )
    const verifiedRows = await verify.json().catch(() => [])
    if (!verify.ok || !Array.isArray(verifiedRows) || verifiedRows.length !== 1 || verifiedRows[0].pipedrive_stage !== stageName) {
      return send(res, 502, { success: false, error: "Update attempted but verification did not match", stageFromPipedrive: stageName })
    }

    return send(res, 200, {
      success: true,
      updated: Array.isArray(updated) && updated.length === 1,
      verified: true,
      dealId,
      supabaseId: row.id,
      contractNumber: verifiedRows[0].contract_number,
      customerName: verifiedRows[0].customer_name,
      stage: verifiedRows[0].pipedrive_stage
    })
  } catch (error) {
    return send(res, 500, { success: false, error: "Unexpected sync error" })
  }
}

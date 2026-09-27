export async function createIntegrationLog({
  provider,
  integrationName,
  direction = "outbound",
  eventName,
  eventType,
  externalId = null,
  payload = null,
}) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) return null

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/integration_event_logs`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      provider,
      integration_name: integrationName,
      direction,
      event_name: eventName || null,
      event_type: eventType || eventName || null,
      external_id: externalId,
      status: "received",
      payload,
    }),
  })

  if (!response.ok) {
    console.error("Unable to create integration event log", await response.text())
    return null
  }

  const rows = await response.json()
  return Array.isArray(rows) ? rows[0] : null
}

export async function updateIntegrationLog(logId, values = {}) {
  if (!logId) return

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) return

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/integration_event_logs?id=eq.${encodeURIComponent(logId)}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      ...values,
      processed_at: new Date().toISOString(),
    }),
  })

  if (!response.ok) {
    console.error("Unable to update integration event log", await response.text())
  }
}

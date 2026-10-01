import { createClient } from "@supabase/supabase-js"

function getAdminClient() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error("Supabase server credentials are not configured.")
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })
  try {
    const supabase = getAdminClient()
    const { userId, action = "claim", leadId, result, note } = req.body || {}
    if (!userId) return res.status(400).json({ error: "userId is required." })

    if (action === "claim") {
      const { data, error } = await supabase.rpc("claim_next_lead_for_user", { p_user_id: userId })
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ lead: data || null })
    }

    if (action === "result") {
      if (!leadId || !result) return res.status(400).json({ error: "leadId and result are required." })
      const { data, error } = await supabase.rpc("result_claimed_lead", {
        p_user_id: userId,
        p_lead_id: leadId,
        p_result: result,
        p_note: note || null,
      })
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ lead: data || null })
    }

    if (action === "release") {
      if (!leadId) return res.status(400).json({ error: "leadId is required." })
      const { error } = await supabase.rpc("release_claimed_lead", { p_user_id: userId, p_lead_id: leadId })
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: "Unknown action." })
  } catch (error) {
    console.error("leads-queue error", error)
    return res.status(500).json({ error: error?.message || "Internal server error." })
  }
}

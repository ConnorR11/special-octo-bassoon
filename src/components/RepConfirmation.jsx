import React, { useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { supabase } from "../lib/supabase"

function getSubmittedBy(user) {
  const metadataName = String(user?.user_metadata?.full_name || user?.user_metadata?.name || "").trim()
  return metadataName || user?.email || "Unknown"
}

export default function RepConfirmation({ appointment, menuItem = false, onTriggered, onUpdated }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function confirm() {
    if (!appointment?.appointment_row_id || saving) return
    setSaving(true)
    setError("")
    let actionId = null
    const now = new Date().toISOString()

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      const triggeredBy = getSubmittedBy(userData?.user)

      const { data: action, error: actionError } = await supabase
        .from("action_runs")
        .insert({
          action_type: "rep_confirmation",
          status: "running",
          entity_type: "appointment",
          entity_id: appointment.appointment_row_id,
          triggered_by: triggeredBy,
          started_at: now,
          input_data: {
            appointment_row_id: appointment.appointment_row_id,
            allocated_rep: appointment.rep_allocated || null,
            branch: appointment.branch || null,
          },
        })
        .select("id")
        .single()

      if (actionError) throw actionError
      actionId = action.id

      const { error: actionUpdateError } = await supabase
        .from("action_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          output_data: {
            appointment_row_id: appointment.appointment_row_id,
            rep_confirmation: true,
            allocated_rep: appointment.rep_allocated || null,
          },
        })
        .eq("id", actionId)

      if (actionUpdateError) throw actionUpdateError

      onTriggered?.()
      onUpdated?.(appointment)
    } catch (err) {
      console.error("Rep confirmation action failed:", err)
      const message = err?.message || "Unable to confirm rep attendance."
      setError(message)
      if (actionId) {
        await supabase
          .from("action_runs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: message,
          })
          .eq("id", actionId)
      }
    } finally {
      setSaving(false)
    }
  }

  const style = menuItem
    ? { width: "100%", display: "flex", alignItems: "center", gap: 9, minHeight: 38, padding: "0 10px", border: 0, borderRadius: 7, background: "transparent", color: "#243342", cursor: saving ? "default" : "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, textAlign: "left", opacity: saving ? 0.6 : 1 }
    : { display: "flex", alignItems: "center", gap: 7, height: 40, padding: "0 15px", border: 0, borderRadius: 8, background: "#2499ed", color: "#fff", cursor: saving ? "default" : "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, opacity: saving ? 0.65 : 1 }

  return <>
    <button type="button" disabled={saving} onClick={confirm} style={style}>
      <CheckCircle2 size={15} />
      <span>{saving ? "Confirming..." : "Rep Confirmation"}</span>
    </button>
    {error && !menuItem && <div style={{ marginTop: 6, padding: "7px 9px", background: "#fbeaea", color: "#8b3333", borderRadius: 6, fontSize: 10 }}>{error}</div>}
  </>
}

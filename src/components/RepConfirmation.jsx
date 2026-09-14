import React, { useEffect, useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { supabase } from "../lib/supabase"

function getSubmittedBy(user) {
  const metadataName = String(user?.user_metadata?.full_name || user?.user_metadata?.name || "").trim()
  return metadataName || user?.email || "Unknown"
}

export default function RepConfirmation({ appointment, menuItem = false, onTriggered, onUpdated }) {
  const [saving, setSaving] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    async function checkConfirmation() {
      if (!appointment?.appointment_row_id) {
        setConfirmed(false)
        return
      }

      const { data, error: queryError } = await supabase
        .from("action_runs")
        .select("id")
        .eq("action_type", "rep_confirmation")
        .eq("entity_type", "appointment")
        .eq("entity_id", appointment.appointment_row_id)
        .eq("status", "completed")
        .limit(1)

      if (queryError) {
        console.error("Error checking rep confirmation:", queryError)
        return
      }

      if (!cancelled) setConfirmed((data || []).length > 0)
    }

    checkConfirmation()
    return () => { cancelled = true }
  }, [appointment?.appointment_row_id])

  async function confirm() {
    if (!appointment?.appointment_row_id || saving || confirmed) return
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

      setConfirmed(true)
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

  const locked = saving || confirmed
  const style = menuItem
    ? { width: "100%", display: "flex", alignItems: "center", gap: 9, minHeight: 38, padding: "0 10px", border: 0, borderRadius: 7, background: confirmed ? "#f3f4f6" : "transparent", color: confirmed ? "#9aa1a8" : "#243342", cursor: locked ? "default" : "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, textAlign: "left", opacity: saving ? 0.6 : 1 }
    : { display: "flex", alignItems: "center", gap: 7, height: 40, padding: "0 15px", border: 0, borderRadius: 8, background: confirmed ? "#e9ecef" : "#2499ed", color: confirmed ? "#8a9299" : "#fff", cursor: locked ? "default" : "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, opacity: saving ? 0.65 : 1 }

  return <>
    <button type="button" disabled={locked} onClick={confirm} style={style}>
      <CheckCircle2 size={15} />
      <span>{saving ? "Confirming..." : confirmed ? "Completed" : "Rep Confirmation"}</span>
    </button>
    {error && !menuItem && <div style={{ marginTop: 6, padding: "7px 9px", background: "#fbeaea", color: "#8b3333", borderRadius: 6, fontSize: 10 }}>{error}</div>}
  </>
}

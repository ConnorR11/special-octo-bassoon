import React, { useEffect, useState } from "react"
import { UserRound, X } from "lucide-react"
import { supabase } from "../lib/supabase"

function getSubmittedBy(user) {
  const metadataName = String(user?.user_metadata?.full_name || user?.user_metadata?.name || "").trim()
  return metadataName || user?.email || "Unknown"
}

export default function AllocateSalesRep({ appointment, onUpdated }) {
  const [reps, setReps] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [selectedRep, setSelectedRep] = useState("")
  const [allocating, setAllocating] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadReps() {
      if (!appointment?.branch) {
        setReps([])
        return
      }

      const { data, error: queryError } = await supabase
        .from("profiles")
        .select("full_name, display_name, email, active, role, branch")
        .eq("role", "Sales Rep")
        .eq("branch", appointment.branch)
        .order("full_name", { ascending: true })

      if (queryError) {
        console.error("Error loading sales reps:", queryError)
        setError(queryError.message || "Unable to load sales reps.")
        return
      }

      setReps((data || []).filter((profile) => profile.active !== false && profile.email))
    }

    loadReps()
  }, [appointment?.branch])

  if (!appointment?.branch) return null

  const currentRepEmail = String(appointment?.rep_allocated || "").trim()
  const currentRep = reps.find((rep) => String(rep.email || "").trim().toLowerCase() === currentRepEmail.toLowerCase())
  const currentRepName = currentRep?.full_name || currentRep?.display_name || currentRepEmail
  const isReallocation = Boolean(currentRepEmail)

  async function allocateSalesRep() {
    if (!appointment?.appointment_row_id || !selectedRep || allocating) return

    const selectedProfile = reps.find((rep) => rep.email === selectedRep)
    if (!selectedProfile) {
      setError("Please select a valid sales rep.")
      return
    }

    setAllocating(true)
    setError("")
    let actionId = null
    const now = new Date().toISOString()

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      const triggeredBy = getSubmittedBy(userData?.user)

      const actionType = isReallocation ? "reallocate_sales_rep" : "allocate_sales_rep"

      const { data: action, error: actionError } = await supabase
        .from("action_runs")
        .insert({
          action_type: actionType,
          status: "running",
          entity_type: "appointment",
          entity_id: appointment.appointment_row_id,
          triggered_by: triggeredBy,
          started_at: now,
          input_data: {
            appointment_row_id: appointment.appointment_row_id,
            branch: appointment.branch,
            previous_rep: currentRepEmail || null,
            previous_rep_name: currentRepName || null,
            new_rep: selectedProfile.email,
            new_rep_name: selectedProfile.full_name || selectedProfile.display_name || selectedProfile.email,
          },
        })
        .select("id")
        .single()

      if (actionError) throw actionError
      actionId = action.id

      const { data: updatedAppointment, error: updateError } = await supabase
        .from("appointments")
        .update({ rep_allocated: selectedProfile.email })
        .eq("appointment_row_id", appointment.appointment_row_id)
        .select("*")
        .single()

      if (updateError) throw updateError

      const { error: actionUpdateError } = await supabase
        .from("action_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          output_data: {
            appointment_row_id: updatedAppointment.appointment_row_id,
            branch: updatedAppointment.branch,
            previous_rep: currentRepEmail || null,
            previous_rep_name: currentRepName || null,
            rep_allocated: updatedAppointment.rep_allocated,
            rep_name: selectedProfile.full_name || selectedProfile.display_name || selectedProfile.email,
          },
        })
        .eq("id", actionId)

      if (actionUpdateError) throw actionUpdateError

      setShowForm(false)
      setSelectedRep("")
      onUpdated?.(updatedAppointment)
    } catch (err) {
      console.error("Allocate Sales Rep action failed:", err)
      const message = err?.message || "Unable to allocate sales rep."
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
      setAllocating(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("")
          setSelectedRep("")
          setShowForm(true)
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "7px",
          height: "40px",
          padding: "0 15px",
          border: "none",
          borderRadius: "8px",
          background: "#2499ed",
          color: "#fff",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: "12px",
          fontWeight: 700,
        }}
      >
        <UserRound size={16} />
        {isReallocation ? "Reallocate Sales Rep" : "Allocate Sales Rep"}
      </button>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ width: "100%", maxWidth: "420px", background: "#fff", borderRadius: "10px", boxShadow: "0 15px 50px rgba(0,0,0,.2)", overflow: "hidden" }}>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#172033" }}>{isReallocation ? "Reallocate Sales Rep" : "Allocate Sales Rep"}</h2>
                <div style={{ marginTop: 4, fontSize: 10, color: "#888" }}>{isReallocation ? `Currently allocated to ${currentRepName}` : `Select a sales rep from ${appointment.branch}`}</div>
              </div>
              <button type="button" onClick={() => setShowForm(false)} style={{ border: 0, background: "transparent", color: "#888", cursor: "pointer", display: "flex" }}><X size={18} /></button>
            </div>
            <div style={{ padding: "18px" }}>
              <label htmlFor="allocate-sales-rep-select" style={{ display: "block", marginBottom: 7, fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase" }}>Sales Rep</label>
              <select id="allocate-sales-rep-select" value={selectedRep} onChange={(event) => setSelectedRep(event.target.value)} style={{ width: "100%", height: 40, border: "1px solid #d9dadd", borderRadius: 7, padding: "0 10px", fontFamily: "inherit", fontSize: 12, background: "#fff", color: "#172033" }}>
                <option value="">Select sales rep...</option>
                {reps.map((rep) => (
                  <option key={rep.email} value={rep.email}>{rep.full_name || rep.display_name || rep.email}</option>
                ))}
              </select>
              {reps.length === 0 && <div style={{ marginTop: 10, padding: "9px 10px", background: "#fbeaea", borderRadius: 6, color: "#8b3333", fontSize: 10 }}>No active sales reps were found in this branch.</div>}
              {error && <div style={{ marginTop: 10, padding: "9px 10px", background: "#fbeaea", borderRadius: 6, color: "#8b3333", fontSize: 10 }}>{error}</div>}
            </div>
            <div style={{ padding: "14px 18px", borderTop: "1px solid #eee", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ height: 36, padding: "0 13px", border: "1px solid #dddfe3", borderRadius: 7, background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}>Cancel</button>
              <button type="button" disabled={!selectedRep || allocating} onClick={allocateSalesRep} style={{ height: 36, padding: "0 15px", border: 0, borderRadius: 7, background: "#172554", color: "#fff", cursor: !selectedRep || allocating ? "default" : "pointer", opacity: !selectedRep || allocating ? .5 : 1, fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}>{allocating ? "Saving..." : isReallocation ? "Reallocate Rep" : "Allocate Rep"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

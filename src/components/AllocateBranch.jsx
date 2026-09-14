import React, { useEffect, useState } from "react"
import { GitBranch, X } from "lucide-react"
import { supabase } from "../lib/supabase"
import AllocateSalesRep from "./AllocateSalesRep"

const MAKE_ALLOCATE_BRANCH_WEBHOOK = import.meta.env.VITE_MAKE_ALLOCATE_BRANCH_WEBHOOK

function getSubmittedBy(user) {
  const metadataName = String(user?.user_metadata?.full_name || user?.user_metadata?.name || "").trim()
  return metadataName || user?.email || "Unknown"
}

export default function AllocateBranch({ appointment, onUpdated }) {
  const [branches, setBranches] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState("")
  const [allocating, setAllocating] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadBranches() {
      const { data, error: queryError } = await supabase
        .from("profiles")
        .select("full_name, display_name, email, active, role, branch")
        .eq("role", "Sales Rep")
        .order("full_name", { ascending: true })

      if (queryError) {
        console.error("Error loading branches:", queryError)
        return
      }

      const uniqueBranches = [...new Set(
        (data || [])
          .filter((profile) => profile.active !== false)
          .map((profile) => String(profile.branch || "").trim())
          .filter(Boolean)
      )].sort((a, b) => a.localeCompare(b))

      setBranches(uniqueBranches)
    }

    loadBranches()
  }, [])

  if (!appointment?.cps_c) return null

  async function allocateBranch() {
    if (!appointment?.appointment_row_id || !selectedBranch || allocating) return

    setAllocating(true)
    setError("")
    let actionId = null
    const now = new Date().toISOString()
    const previousBranch = appointment.branch || null

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      const triggeredBy = getSubmittedBy(userData?.user)

      const { data: action, error: actionError } = await supabase
        .from("action_runs")
        .insert({
          action_type: "allocate_branch",
          status: "running",
          entity_type: "appointment",
          entity_id: appointment.appointment_row_id,
          triggered_by: triggeredBy,
          started_at: now,
          input_data: {
            appointment_row_id: appointment.appointment_row_id,
            previous_branch: previousBranch,
            new_branch: selectedBranch,
          },
        })
        .select("id")
        .single()

      if (actionError) throw actionError
      actionId = action.id

      const { data: updatedAppointment, error: updateError } = await supabase
        .from("appointments")
        .update({ branch: selectedBranch })
        .eq("appointment_row_id", appointment.appointment_row_id)
        .select("*")
        .single()

      if (updateError) throw updateError

      const { data: managerProfiles, error: managerError } = await supabase
        .from("profiles")
        .select("full_name, role, branch, phone_number, active")
        .eq("branch", selectedBranch)
        .eq("active", true)

      if (managerError) throw managerError

      const branchManager = (managerProfiles || []).find((profile) =>
        String(profile.role || "").trim().toLowerCase().endsWith("branch manager")
      )

      const primarySalesManager = (managerProfiles || []).find((profile) =>
        String(profile.role || "").trim().toLowerCase().endsWith("sales manager")
      )

      if (!MAKE_ALLOCATE_BRANCH_WEBHOOK) {
        throw new Error("The Allocate Branch Make webhook is not configured in the deployment environment.")
      }

      const webhookPayload = {
        "Customer Name": updatedAppointment.name || "",
        ManagerNumber: branchManager?.phone_number || "",
        SalesManagerNumber: primarySalesManager?.phone_number || "",
        appointmentTimeSplit: updatedAppointment.appointment_date || "",
        MTV: updatedAppointment.postcode || "",
        Product: updatedAppointment.product || updatedAppointment.measure || "",
        Branch: selectedBranch,
      }

      const webhookResponse = await fetch(MAKE_ALLOCATE_BRANCH_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload),
      })

      const webhookText = await webhookResponse.text()

      if (!webhookResponse.ok) {
        throw new Error(`Make webhook returned ${webhookResponse.status}${webhookText ? `: ${webhookText}` : ""}`)
      }

      const { error: actionUpdateError } = await supabase
        .from("action_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          output_data: {
            appointment_row_id: appointment.appointment_row_id,
            previous_branch: previousBranch,
            branch: updatedAppointment.branch,
            branch_manager: branchManager?.full_name || null,
            primary_sales_manager: primarySalesManager?.full_name || null,
            webhook_triggered: true,
          },
        })
        .eq("id", actionId)

      if (actionUpdateError) throw actionUpdateError

      setShowForm(false)
      setSelectedBranch("")
      onUpdated?.(updatedAppointment)
    } catch (err) {
      console.error("Allocate Branch action failed:", err)
      const message = err?.message || "Unable to allocate branch."
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
          setSelectedBranch(appointment.branch || "")
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
        <GitBranch size={16} />
        {appointment.branch ? "Reallocate Branch" : "Allocate Branch"}
      </button>

      <AllocateSalesRep appointment={appointment} onUpdated={onUpdated} />

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ width: "100%", maxWidth: "420px", background: "#fff", borderRadius: "10px", boxShadow: "0 15px 50px rgba(0,0,0,.2)", overflow: "hidden" }}>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#172033" }}>{appointment.branch ? "Reallocate Branch" : "Allocate Branch"}</h2>
                <div style={{ marginTop: 4, fontSize: 10, color: "#888" }}>{appointment.branch ? `Currently allocated to ${appointment.branch}` : "Select the branch for this appointment"}</div>
              </div>
              <button type="button" onClick={() => setShowForm(false)} style={{ border: 0, background: "transparent", color: "#888", cursor: "pointer", display: "flex" }}><X size={18} /></button>
            </div>
            <div style={{ padding: "18px" }}>
              <label htmlFor="allocate-branch-select" style={{ display: "block", marginBottom: 7, fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase" }}>Branch</label>
              <select id="allocate-branch-select" value={selectedBranch} onChange={(event) => setSelectedBranch(event.target.value)} style={{ width: "100%", height: 40, border: "1px solid #d9dadd", borderRadius: 7, padding: "0 10px", fontFamily: "inherit", fontSize: 12, background: "#fff", color: "#172033" }}>
                <option value="">Select branch...</option>
                {branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
              </select>
              {branches.length === 0 && <div style={{ marginTop: 10, padding: "9px 10px", background: "#fbeaea", borderRadius: 6, color: "#8b3333", fontSize: 10 }}>No active sales rep branches were found in user profiles.</div>}
              {error && <div style={{ marginTop: 10, padding: "9px 10px", background: "#fbeaea", borderRadius: 6, color: "#8b3333", fontSize: 10 }}>{error}</div>}
            </div>
            <div style={{ padding: "14px 18px", borderTop: "1px solid #eee", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ height: 36, padding: "0 13px", border: "1px solid #dddfe3", borderRadius: 7, background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}>Cancel</button>
              <button type="button" disabled={!selectedBranch || allocating} onClick={allocateBranch} style={{ height: 36, padding: "0 15px", border: 0, borderRadius: 7, background: "#172554", color: "#fff", cursor: !selectedBranch || allocating ? "default" : "pointer", opacity: !selectedBranch || allocating ? .5 : 1, fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}>{allocating ? "Allocating..." : "Save Branch"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

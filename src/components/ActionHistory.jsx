import React, { useEffect, useState } from "react"
import { CheckCircle2, Clock3, XCircle, GitBranch, X } from "lucide-react"
import { supabase } from "../lib/supabase"

function display(value, fallback = "—") {
  const text = String(value ?? "").trim()
  return text || fallback
}

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return display(value)
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function statusIcon(status) {
  if (status === "completed") return <CheckCircle2 size={15} />
  if (status === "failed") return <XCircle size={15} />
  return <Clock3 size={15} />
}

function statusLabel(status) {
  if (status === "completed") return "Completed"
  if (status === "failed") return "Failed"
  return "Running"
}

function getSubmittedBy(user) {
  const metadataName = String(user?.user_metadata?.full_name || user?.user_metadata?.name || "").trim()
  return metadataName || user?.email || "Unknown"
}

export default function ActionHistory({ entityType = "appointment", entityId }) {
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [appointment, setAppointment] = useState(null)
  const [branches, setBranches] = useState([])
  const [showBranchForm, setShowBranchForm] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState("")
  const [allocating, setAllocating] = useState(false)
  const [allocationError, setAllocationError] = useState("")

  async function loadAppointmentAndBranches() {
    if (!supabase || entityType !== "appointment" || !entityId) return

    const [appointmentResult, profilesResult] = await Promise.all([
      supabase
        .from("appointments")
        .select("appointment_row_id, cps_c, branch")
        .eq("appointment_row_id", entityId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name, display_name, email, active, role, branch")
        .order("full_name", { ascending: true }),
    ])

    if (appointmentResult.error) {
      console.error("Error loading appointment for branch allocation:", appointmentResult.error)
      return
    }

    setAppointment(appointmentResult.data || null)

    if (!profilesResult.error) {
      const uniqueBranches = [...new Set(
        (profilesResult.data || [])
          .filter((profile) => profile.active !== false)
          .map((profile) => String(profile.branch || "").trim())
          .filter(Boolean)
      )].sort((a, b) => a.localeCompare(b))
      setBranches(uniqueBranches)
    }
  }

  async function loadActions() {
    if (!supabase || !entityId) {
      setActions([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError("")

    const { data, error: queryError } = await supabase
      .from("action_runs")
      .select("id, action_type, status, triggered_by, started_at, completed_at, created_at")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })

    if (queryError) {
      console.error("Error loading action history:", queryError)
      setError(queryError.message || "Unable to load action history.")
      setActions([])
    } else {
      setActions(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    let active = true

    async function load() {
      if (!active) return
      await Promise.all([loadActions(), loadAppointmentAndBranches()])
    }

    load()

    return () => {
      active = false
    }
  }, [entityType, entityId])

  async function allocateBranch() {
    if (!entityId || !selectedBranch || allocating) return

    setAllocating(true)
    setAllocationError("")
    let actionId = null
    const now = new Date().toISOString()

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      const triggeredBy = getSubmittedBy(userData?.user)

      const previousBranch = appointment?.branch || null

      const { data: action, error: actionError } = await supabase
        .from("action_runs")
        .insert({
          action_type: "allocate_branch",
          status: "running",
          entity_type: "appointment",
          entity_id: entityId,
          triggered_by: triggeredBy,
          started_at: now,
          input_data: {
            appointment_row_id: entityId,
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
        .eq("appointment_row_id", entityId)
        .select("appointment_row_id, cps_c, branch")
        .single()

      if (updateError) throw updateError

      const { error: actionUpdateError } = await supabase
        .from("action_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          output_data: {
            appointment_row_id: entityId,
            previous_branch: previousBranch,
            branch: updatedAppointment.branch,
          },
        })
        .eq("id", actionId)

      if (actionUpdateError) throw actionUpdateError

      setAppointment(updatedAppointment)
      setShowBranchForm(false)
      setSelectedBranch("")
      await loadActions()
    } catch (err) {
      console.error("Allocate Branch action failed:", err)
      const message = err?.message || "Unable to allocate branch."
      setAllocationError(message)

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

  const canAllocateBranch = entityType === "appointment" && appointment?.cps_c === true

  return (
    <section className="action-history">
      <style>{`
        .action-history{background:#fff;border:1px solid #e1e5ea;border-radius:8px;overflow:hidden}
        .action-history-header{padding:14px 16px;border-bottom:1px solid #e8ebef;font-size:13px;font-weight:800;color:#172033;display:flex;align-items:center;justify-content:space-between;gap:12px}
        .action-history-header-actions{display:flex;align-items:center;gap:8px}
        .action-history-branch{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 11px;border:0;border-radius:6px;background:#2499ed;color:#fff;cursor:pointer;font-family:inherit;font-size:10px;font-weight:700}
        .action-history-current-branch{font-size:10px;font-weight:600;color:#64748b}
        .action-history-empty{padding:18px 16px;color:#94a3b8;font-size:12px}
        .action-history-error{padding:12px 16px;color:#991b1b;background:#fef2f2;font-size:12px}
        .action-history-list{display:flex;flex-direction:column}
        .action-history-row{display:grid;grid-template-columns:32px minmax(150px,1fr) 110px 150px 145px;gap:12px;align-items:center;padding:11px 16px;border-bottom:1px solid #edf0f3;font-size:12px}
        .action-history-row:last-child{border-bottom:0}
        .action-history-icon{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:#f3f5f7;color:#64748b}
        .action-history-action{font-weight:700;color:#172033;text-transform:capitalize}
        .action-history-status{display:flex;align-items:center;gap:5px;color:#64748b;font-weight:600}
        .action-history-status.completed{color:#16834a}
        .action-history-status.failed{color:#b42318}
        .action-history-user,.action-history-date{color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .action-history-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px}
        .action-history-modal{width:100%;max-width:420px;background:#fff;border-radius:10px;box-shadow:0 15px 50px rgba(0,0,0,.2);overflow:hidden}
        .action-history-modal-header{padding:16px 18px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between}
        .action-history-modal-title{margin:0;font-size:15px;font-weight:700;color:#172033}
        .action-history-modal-close{border:0;background:transparent;color:#888;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .action-history-modal-body{padding:18px}
        .action-history-label{display:block;margin-bottom:7px;font-size:10px;font-weight:700;color:#555;text-transform:uppercase}
        .action-history-select{width:100%;height:40px;border:1px solid #d9dadd;border-radius:7px;padding:0 10px;font-family:inherit;font-size:12px;background:#fff;color:#172033}
        .action-history-modal-footer{padding:14px 18px;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:8px}
        .action-history-cancel{height:36px;padding:0 13px;border:1px solid #dddfe3;border-radius:7px;background:#fff;color:#333;cursor:pointer;font-family:inherit;font-size:11px}
        .action-history-save{height:36px;padding:0 15px;border:0;border-radius:7px;background:#172554;color:#fff;cursor:pointer;font-family:inherit;font-size:11px;font-weight:600}
        .action-history-save:disabled{opacity:.5;cursor:default}
        .action-history-allocation-error{margin-top:10px;padding:9px 10px;background:#fbeaea;border-radius:6px;color:#8b3333;font-size:10px}
        @media(max-width:800px){.action-history-row{grid-template-columns:32px minmax(130px,1fr) 100px;gap:8px}.action-history-user,.action-history-date{display:none}.action-history-current-branch{display:none}}
      `}</style>

      <div className="action-history-header">
        <span>Activity</span>
        {canAllocateBranch && (
          <div className="action-history-header-actions">
            {appointment?.branch && <span className="action-history-current-branch">Current: {appointment.branch}</span>}
            <button
              type="button"
              className="action-history-branch"
              onClick={() => {
                setAllocationError("")
                setSelectedBranch(appointment?.branch || "")
                setShowBranchForm(true)
              }}
            >
              <GitBranch size={13} />
              Allocate Branch
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="action-history-empty">Loading activity...</div>
      ) : error ? (
        <div className="action-history-error">{error}</div>
      ) : actions.length === 0 ? (
        <div className="action-history-empty">No actions have been run for this appointment.</div>
      ) : (
        <div className="action-history-list">
          {actions.map((action) => {
            const status = display(action.status, "running").toLowerCase()
            const label = display(action.action_type, "Action").replace(/_/g, " ")
            const date = action.completed_at || action.started_at || action.created_at

            return (
              <div className="action-history-row" key={action.id}>
                <div className="action-history-icon">{statusIcon(status)}</div>
                <div className="action-history-action">{label}</div>
                <div className={`action-history-status ${status}`}>
                  {statusIcon(status)}
                  {statusLabel(status)}
                </div>
                <div className="action-history-user">{display(action.triggered_by)}</div>
                <div className="action-history-date">{formatDate(date)}</div>
              </div>
            )
          })}
        </div>
      )}

      {showBranchForm && (
        <div className="action-history-modal-backdrop">
          <div className="action-history-modal">
            <div className="action-history-modal-header">
              <div>
                <h2 className="action-history-modal-title">Allocate Branch</h2>
                <div style={{ marginTop: 4, fontSize: 10, color: "#888" }}>
                  {appointment?.branch ? `Currently allocated to ${appointment.branch}` : "Select the branch for this appointment"}
                </div>
              </div>
              <button type="button" className="action-history-modal-close" onClick={() => setShowBranchForm(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="action-history-modal-body">
              <label className="action-history-label" htmlFor="allocate-branch-select">Branch</label>
              <select
                id="allocate-branch-select"
                className="action-history-select"
                value={selectedBranch}
                onChange={(event) => setSelectedBranch(event.target.value)}
              >
                <option value="">Select branch...</option>
                {branches.map((branch) => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>

              {branches.length === 0 && (
                <div className="action-history-allocation-error">No active branches were found in user profiles.</div>
              )}

              {allocationError && (
                <div className="action-history-allocation-error">{allocationError}</div>
              )}
            </div>

            <div className="action-history-modal-footer">
              <button type="button" className="action-history-cancel" onClick={() => setShowBranchForm(false)}>Cancel</button>
              <button type="button" className="action-history-save" disabled={!selectedBranch || allocating} onClick={allocateBranch}>
                {allocating ? "Allocating..." : "Allocate Branch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

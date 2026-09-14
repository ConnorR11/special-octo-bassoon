import React, { useEffect, useState } from "react"
import { CheckCircle2, Clock3, XCircle } from "lucide-react"
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

export default function ActionHistory({ entityType = "appointment", entityId }) {
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    async function loadActions() {
      if (!supabase || !entityId) {
        if (active) {
          setActions([])
          setLoading(false)
        }
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

      if (!active) return

      if (queryError) {
        console.error("Error loading action history:", queryError)
        setError(queryError.message || "Unable to load action history.")
        setActions([])
      } else {
        setActions(data || [])
      }

      setLoading(false)
    }

    loadActions()

    return () => {
      active = false
    }
  }, [entityType, entityId])

  return (
    <section className="action-history">
      <style>{`
        .action-history{background:#fff;border:1px solid #e1e5ea;border-radius:8px;overflow:hidden}
        .action-history-header{padding:14px 16px;border-bottom:1px solid #e8ebef;font-size:13px;font-weight:800;color:#172033}
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
        @media(max-width:800px){.action-history-row{grid-template-columns:32px minmax(130px,1fr) 100px;gap:8px}.action-history-user,.action-history-date{display:none}}
      `}</style>

      <div className="action-history-header">Activity</div>

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
    </section>
  )
}

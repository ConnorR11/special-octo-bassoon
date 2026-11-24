import React, { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"

function durationLabel(minutes) {
  const value = Number(minutes)
  if (!Number.isFinite(value)) return "—"
  if (value < 60) return `${Math.round(value)} mins`
  if (value < 1440) return `${(value / 60).toFixed(1)} hrs`
  return `${(value / 1440).toFixed(1)} days`
}
function monthLabel(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
}
function number(value) { return Number(value || 0).toLocaleString("en-GB") }

export default function SpeedToLeadAnalysis() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError("")
      const { data, error: queryError } = await supabase.rpc("get_monthly_speed_to_lead")
      if (!active) return
      if (queryError) setError(queryError.message || "Unable to load speed-to-lead data.")
      else setRows(data || [])
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [])

  const chartRows = useMemo(() => rows.filter(row => Number(row.leads_called) > 0), [rows])
  const maxMinutes = Math.max(60, ...chartRows.map(row => Number(row.median_minutes) || 0))
  const latest = chartRows[chartRows.length - 1]
  const total = chartRows.reduce((sum, row) => sum + Number(row.leads_called || 0), 0)

  return <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
    <div>
      <h2 style={{ margin: "0 0 5px", color: "#10233a", fontSize: 21 }}>Speed to Lead Analysis</h2>
      <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>Monthly time between lead received date/time and first call recorded.</p>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}><div style={{ color: "#64748b", fontSize: 11 }}>Leads with first call</div><strong style={{ display: "block", marginTop: 5, fontSize: 23, color: "#10233a" }}>{loading ? "—" : number(total)}</strong></div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}><div style={{ color: "#64748b", fontSize: 11 }}>Latest month median</div><strong style={{ display: "block", marginTop: 5, fontSize: 23, color: "#10233a" }}>{loading || !latest ? "—" : durationLabel(latest.median_minutes)}</strong></div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}><div style={{ color: "#64748b", fontSize: 11 }}>Latest month called within 60 mins</div><strong style={{ display: "block", marginTop: 5, fontSize: 23, color: "#10233a" }}>{loading || !latest ? "—" : `${Number(latest.within_60_pct).toFixed(1)}%`}</strong></div>
    </div>
    <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, minWidth: 0 }}>
      <h3 style={{ margin: "0 0 14px", color: "#10233a", fontSize: 16 }}>Median speed to first call by month</h3>
      {loading ? <p style={{ color: "#64748b" }}>Loading report…</p> : error ? <p style={{ color: "#b91c1c" }}>{error}</p> : chartRows.length === 0 ? <p style={{ color: "#64748b" }}>No leads have both timestamps recorded.</p> : <div style={{ display: "flex", alignItems: "end", gap: 5, height: 230, overflowX: "auto", padding: "12px 4px 0" }}>
        {chartRows.map(row => {
          const value = Number(row.median_minutes) || 0
          const height = Math.max(3, value / maxMinutes * 175)
          return <div key={row.month_start} title={`${monthLabel(row.month_start)}: ${durationLabel(value)} median`} style={{ minWidth: 34, flex: "1 0 34px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "end", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, color: "#475569", whiteSpace: "nowrap" }}>{durationLabel(value)}</span>
            <div style={{ width: "70%", maxWidth: 32, height, background: "#32718f", borderRadius: "4px 4px 0 0" }} />
            <span style={{ fontSize: 9, color: "#64748b", whiteSpace: "nowrap" }}>{monthLabel(row.month_start)}</span>
          </div>
        })}
      </div>}
      <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: 10 }}>Lower bars indicate faster first contact. The median is used so unusually long delays do not dominate the monthly trend.</p>
    </section>
    <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0" }}><h3 style={{ margin: 0, color: "#10233a", fontSize: 16 }}>Monthly breakdown</h3></div>
      {loading ? <p style={{ padding: 16, color: "#64748b" }}>Loading report…</p> : error ? <p style={{ padding: 16, color: "#b91c1c" }}>{error}</p> : <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 650, fontSize: 12 }}>
          <thead><tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>{["Month","Leads called","Median speed","Average speed","Within 60 mins"].map(label => <th key={label} style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{label}</th>)}</tr></thead>
          <tbody>{rows.map(row => <tr key={row.month_start} style={{ borderTop: "1px solid #e2e8f0" }}>
            <td style={{ padding: "10px 12px", fontWeight: 650 }}>{monthLabel(row.month_start)}</td>
            <td style={{ padding: "10px 12px" }}>{number(row.leads_called)}</td>
            <td style={{ padding: "10px 12px", fontWeight: 650 }}>{durationLabel(row.median_minutes)}</td>
            <td style={{ padding: "10px 12px" }}>{durationLabel(row.average_minutes)}</td>
            <td style={{ padding: "10px 12px" }}>{Number(row.within_60_pct).toFixed(1)}%</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
    <p style={{ margin: 0, color: "#64748b", fontSize: 10, lineHeight: 1.5 }}>Based on leads with both received_date_time and first_time_called populated. Negative intervals are excluded. Older records with very long gaps remain in the data; median speed is the main trend measure.</p>
  </div>
}

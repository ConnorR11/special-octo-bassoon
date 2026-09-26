import React, { useEffect, useMemo, useState } from "react"
import { BarChart3, CalendarDays, RefreshCw } from "lucide-react"
import { supabase } from "../lib/supabase"

const METRICS = [["cps_h", "H"], ["cps_c", "C"], ["cps_p", "P"], ["cps_s", "S"], ["net_value", "Net Value"]]

function isTrue(value) { if (value === true) return true; if (typeof value === "string") return ["true", "t", "1", "yes", "y"].includes(value.trim().toLowerCase()); return value === 1 }
function isoDate(date) { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, "0"); const day = String(date.getDate()).padStart(2, "0"); return `${year}-${month}-${day}` }
function startOfMondayWeek(date) { const result = new Date(date); result.setHours(0, 0, 0, 0); const day = result.getDay(); const daysSinceMonday = day === 0 ? 6 : day - 1; result.setDate(result.getDate() - daysSinceMonday); return result }
function addDays(date, days) { const result = new Date(date); result.setDate(result.getDate() + days); return result }
function formatDate(date) { return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) }
function formatNumber(value) { return Number(value || 0).toLocaleString("en-GB", { maximumFractionDigits: 1 }) }
function formatCurrency(value) { return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number(value || 0)) }

export default function MI() {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const periods = useMemo(() => {
    const today = new Date()
    const currentWeekStart = startOfMondayWeek(today)
    const lastWeekStart = addDays(currentWeekStart, -7)
    const lastWeekEnd = addDays(lastWeekStart, 6)
    const yearStart = new Date(today.getFullYear(), 0, 1)
    const firstWeekStart = startOfMondayWeek(yearStart)
    const weeks = []
    for (let cursor = new Date(firstWeekStart); cursor < currentWeekStart; cursor = addDays(cursor, 7)) weeks.push(new Date(cursor))
    return { year: today.getFullYear(), lastWeekStart, lastWeekEnd, weeks }
  }, [])

  async function loadReport() {
    if (!supabase) return
    setLoading(true); setError("")
    try {
      const from = isoDate(periods.weeks[0] || new Date(periods.year, 0, 1))
      const to = isoDate(addDays(periods.lastWeekEnd, 1))
      const { data, error: queryError } = await supabase.from("appointments").select("appointment_row_id, appointment_date, result, cps_h, cps_c, cps_p, cps_s").gte("appointment_date", `${from}T00:00:00`).lt("appointment_date", `${to}T00:00:00`)
      if (queryError) throw queryError

      const loadedAppointments = data || []
      const appointmentIds = loadedAppointments.map(row => row.appointment_row_id).filter(Boolean)
      const netValueByAppointmentId = {}
      for (let i = 0; i < appointmentIds.length; i += 100) {
        const batch = appointmentIds.slice(i, i + 100)
        const { data: deals, error: dealsError } = await supabase.from("deals").select("appointment_row_id, net_value").in("appointment_row_id", batch)
        if (dealsError) throw dealsError
        ;(deals || []).forEach(deal => {
          if (!deal.appointment_row_id) return
          const value = Number(deal.net_value || 0)
          netValueByAppointmentId[String(deal.appointment_row_id)] = Number.isFinite(value) ? value : 0
        })
      }

      setAppointments(loadedAppointments.map(appointment => ({ ...appointment, net_value: netValueByAppointmentId[String(appointment.appointment_row_id)] || 0 })))
    } catch (err) {
      console.error("Error loading MI report:", err); setError(err?.message || "Unable to load management information."); setAppointments([])
    } finally { setLoading(false) }
  }

  useEffect(() => { loadReport() }, [periods])

  const report = useMemo(() => {
    const weekly = new Map(periods.weeks.map(week => [isoDate(week), { cps_h: 0, cps_c: 0, cps_p: 0, cps_s: 0, net_value: 0 }]))
    const lastWeek = { cps_h: 0, cps_c: 0, cps_p: 0, cps_s: 0, net_value: 0 }
    appointments.forEach(appointment => {
      if (!appointment?.appointment_date) return
      const date = new Date(appointment.appointment_date); if (Number.isNaN(date.getTime())) return
      const key = isoDate(startOfMondayWeek(date)); const bucket = weekly.get(key)
      METRICS.forEach(([field]) => {
        if (field === "net_value") {
          if (String(appointment.result || "").trim().toLowerCase() !== "sold") return
          const value = Number(appointment.net_value || 0)
          if (bucket) bucket.net_value += value
          if (key === isoDate(periods.lastWeekStart)) lastWeek.net_value += value
        } else if (isTrue(appointment[field])) {
          if (bucket) bucket[field] += 1
          if (key === isoDate(periods.lastWeekStart)) lastWeek[field] += 1
        }
      })
    })
    const weekCount = periods.weeks.length || 1
    const rows = METRICS.map(([field, label]) => {
      const average = Array.from(weekly.values()).reduce((total, week) => total + week[field], 0) / weekCount
      const last = lastWeek[field]; const variance = last - average; const percentage = average === 0 ? null : (variance / average) * 100
      return { field, label, last, average, variance, percentage }
    })
    return { rows, weekCount }
  }, [appointments, periods])

  return <section className="mi-page" style={{ maxWidth: 1200, width: "100%", margin: "0 auto", padding: "8px 4px 40px" }}>
    <style>{`\n      .mi-page * { max-width: 100%; }\n      .mi-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:22px; gap:18px; }\n      .mi-title-wrap { min-width:0; }\n      .mi-title { margin:0; font-size:26px; line-height:1.15; color:#263645; }\n      .mi-subtitle { margin:0; color:#74808a; font-size:12px; line-height:1.45; }\n      .mi-periods { display:flex; gap:10px; margin-bottom:18px; }\n      .mi-period { flex:1; min-width:0; border:1px solid #dce4ea; border-radius:10px; background:#fff; padding:13px 16px; }\n      .mi-period-label { font-size:9px; font-weight:800; color:#788690; text-transform:uppercase; margin-bottom:6px; }\n      .mi-period-value { color:#263645; font-size:12px; font-weight:700; line-height:1.35; }\n      .mi-table { border:1px solid #dce4ea; border-radius:11px; overflow:hidden; background:#fff; }\n      .mi-table-inner { width:100%; }\n      .mi-table-header, .mi-table-row { display:grid; grid-template-columns:1.25fr repeat(5, 1fr); gap:10px; align-items:center; }\n      .mi-table-header { padding:12px 16px; background:#f3f6f8; border-bottom:1px solid #dce4ea; font-size:9px; font-weight:800; color:#687782; text-transform:uppercase; }\n      .mi-table-row { padding:16px; border-bottom:1px solid #eef1f3; }\n      .mi-table-row:last-child { border-bottom:0; }\n      .mi-note { margin-top:12px; color:#8a959d; font-size:10px; line-height:1.4; }\n      @media (max-width:900px) { .mi-page { padding:4px 0 28px !important; } .mi-header { display:block; margin-bottom:18px; } .mi-title { font-size:24px; } .mi-subtitle { font-size:11px; margin-top:7px; max-width:100%; } .mi-refresh { margin-top:12px; } .mi-periods { display:grid; grid-template-columns:1fr; gap:8px; } .mi-period { padding:12px 14px; } .mi-table { overflow-x:auto; -webkit-overflow-scrolling:touch; } .mi-table-inner { min-width:760px; } .mi-note { line-height:1.4; } }\n    `}</style>
    <div className="mi-header"><div className="mi-title-wrap"><div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}><BarChart3 size={22} color="#1676b8" /><h1 className="mi-title">Management Information</h1></div><p className="mi-subtitle">Weekly senior management report — company-wide H C P S activity and net value sold.</p></div><button className="mi-refresh" type="button" onClick={loadReport} disabled={loading} style={{ height: 38, padding: "0 12px", border: "1px solid #d7dee8", borderRadius: 8, background: "#fff", color: "#53616b", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700, cursor: loading ? "default" : "pointer" }}><RefreshCw size={14} />Refresh</button></div>
    <div className="mi-periods"><div className="mi-period"><div className="mi-period-label">Last Week</div><div className="mi-period-value"><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><CalendarDays size={15} />{formatDate(periods.lastWeekStart)} — {formatDate(periods.lastWeekEnd)}</span></div></div><div className="mi-period"><div className="mi-period-label">Average Week</div><div className="mi-period-value">{periods.year} · {report.weekCount} completed weeks</div></div></div>
    {error && <div style={{ marginBottom: 16, padding: 13, border: "1px solid #f0c8c8", borderRadius: 9, background: "#fff7f7", color: "#a33b3b", fontSize: 11 }}>{error}</div>}
    <div className="mi-table"><div className="mi-table-inner"><div className="mi-table-header"><div></div>{METRICS.map(([, label]) => <div key={label}>{label}</div>)}</div>{loading ? <div style={{ padding: 35, textAlign: "center", color: "#89939c", fontSize: 11 }}>Loading management information...</div> : [
      { key: "last", label: "Last Week" },
      { key: "average", label: "Avg Week" },
      { key: "variance", label: "Variance" },
      { key: "percentage", label: "Vs Average" },
    ].map(row => <div className="mi-table-row" key={row.key}><div style={{ fontSize: 13, fontWeight: 800, color: "#263645" }}>{row.label}</div>{report.rows.map(metric => { const value = metric[row.key]; let display = "—"; if (row.key === "percentage") display = value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`; else if (metric.field === "net_value") display = formatCurrency(row.key === "variance" ? Math.abs(value) : value); else display = formatNumber(row.key === "variance" ? Math.abs(value) : value); return <div key={metric.field} style={{ fontSize: row.key === "last" ? 14 : 13, fontWeight: row.key === "last" ? 800 : 700, color: row.key === "variance" ? (value >= 0 ? "#21824a" : "#b64b4b") : row.key === "percentage" ? (value === null ? "#89939c" : value >= 0 ? "#21824a" : "#b64b4b") : "#263645" }}>{row.key === "variance" && value !== 0 ? (value >= 0 ? "+" : "-") : ""}{display}</div> })}</div>)}</div></div>
    <div className="mi-note">H C P S are counted independently from appointment records. Net Value Sold sums the <strong>net_value</strong> of deals linked to appointments marked Sold, using the appointment date for the week. A single appointment can contribute to more than one H C P S metric.</div>
  </section>
}

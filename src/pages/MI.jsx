import React, { useEffect, useMemo, useState } from "react"
import { BarChart3, CalendarDays, RefreshCw } from "lucide-react"
import { supabase } from "../lib/supabase"

const METRICS = [
  ["cps_h", "H"],
  ["cps_c", "C"],
  ["cps_p", "P"],
  ["cps_s", "S"],
]

function isTrue(value) {
  if (value === true) return true
  if (typeof value === "string") return ["true", "t", "1", "yes", "y"].includes(value.trim().toLowerCase())
  return value === 1
}

function isoDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function startOfMondayWeek(date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  const day = result.getDay()
  const daysSinceMonday = day === 0 ? 6 : day - 1
  result.setDate(result.getDate() - daysSinceMonday)
  return result
}

function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function formatDate(date) {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-GB", { maximumFractionDigits: 1 })
}

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
    for (let cursor = new Date(firstWeekStart); cursor < currentWeekStart; cursor = addDays(cursor, 7)) {
      weeks.push(new Date(cursor))
    }
    return { year: today.getFullYear(), lastWeekStart, lastWeekEnd, weeks }
  }, [])

  async function loadReport() {
    if (!supabase) return
    setLoading(true)
    setError("")
    try {
      const from = isoDate(periods.weeks[0] || new Date(periods.year, 0, 1))
      const to = isoDate(addDays(periods.lastWeekEnd, 1))
      const { data, error: queryError } = await supabase
        .from("appointments")
        .select("appointment_row_id, appointment_date, cps_h, cps_c, cps_p, cps_s")
        .gte("appointment_date", `${from}T00:00:00`)
        .lt("appointment_date", `${to}T00:00:00`)

      if (queryError) throw queryError
      setAppointments(data || [])
    } catch (err) {
      console.error("Error loading MI report:", err)
      setError(err?.message || "Unable to load management information.")
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadReport() }, [periods])

  const report = useMemo(() => {
    const weekly = new Map(periods.weeks.map(week => [isoDate(week), { cps_h: 0, cps_c: 0, cps_p: 0, cps_s: 0 }]))
    const lastWeek = { cps_h: 0, cps_c: 0, cps_p: 0, cps_s: 0 }

    appointments.forEach(appointment => {
      if (!appointment?.appointment_date) return
      const date = new Date(appointment.appointment_date)
      if (Number.isNaN(date.getTime())) return
      const weekStart = startOfMondayWeek(date)
      const key = isoDate(weekStart)
      const bucket = weekly.get(key)
      METRICS.forEach(([field]) => {
        if (!isTrue(appointment[field])) return
        if (bucket) bucket[field] += 1
        if (key === isoDate(periods.lastWeekStart)) lastWeek[field] += 1
      })
    })

    const weekCount = periods.weeks.length || 1
    const rows = METRICS.map(([field, label]) => {
      const average = Array.from(weekly.values()).reduce((total, week) => total + week[field], 0) / weekCount
      const last = lastWeek[field]
      const variance = last - average
      const percentage = average === 0 ? null : (variance / average) * 100
      return { field, label, last, average, variance, percentage }
    })
    return { rows, weekCount }
  }, [appointments, periods])

  return <section style={{ maxWidth: 1200, margin: "0 auto", padding: "8px 4px 40px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}><BarChart3 size={22} color="#1676b8" /><h1 style={{ margin: 0, fontSize: 26, color: "#263645" }}>Management Information</h1></div>
        <p style={{ margin: 0, color: "#74808a", fontSize: 12 }}>Weekly senior management report — company-wide H C P S activity.</p>
      </div>
      <button type="button" onClick={loadReport} disabled={loading} style={{ height: 38, padding: "0 12px", border: "1px solid #d7dee8", borderRadius: 8, background: "#fff", color: "#53616b", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700, cursor: loading ? "default" : "pointer" }}><RefreshCw size={14} />Refresh</button>
    </div>

    <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
      <div style={{ flex: 1, border: "1px solid #dce4ea", borderRadius: 10, background: "#fff", padding: "13px 16px" }}><div style={{ fontSize: 9, fontWeight: 800, color: "#788690", textTransform: "uppercase", marginBottom: 6 }}>Last Week</div><div style={{ display: "flex", alignItems: "center", gap: 7, color: "#263645", fontSize: 12, fontWeight: 700 }}><CalendarDays size={15} />{formatDate(periods.lastWeekStart)} — {formatDate(periods.lastWeekEnd)}</div></div>
      <div style={{ flex: 1, border: "1px solid #dce4ea", borderRadius: 10, background: "#fff", padding: "13px 16px" }}><div style={{ fontSize: 9, fontWeight: 800, color: "#788690", textTransform: "uppercase", marginBottom: 6 }}>Average Week</div><div style={{ fontSize: 12, fontWeight: 700, color: "#263645" }}>{periods.year} · {report.weekCount} completed weeks</div></div>
    </div>

    {error && <div style={{ marginBottom: 16, padding: 13, border: "1px solid #f0c8c8", borderRadius: 9, background: "#fff7f7", color: "#a33b3b", fontSize: 11 }}>{error}</div>}

    <div style={{ border: "1px solid #dce4ea", borderRadius: 11, overflow: "hidden", background: "#fff" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr", gap: 10, padding: "12px 16px", background: "#f3f6f8", borderBottom: "1px solid #dce4ea", fontSize: 9, fontWeight: 800, color: "#687782", textTransform: "uppercase" }}><div>Metric</div><div>Last Week</div><div>Avg Week</div><div>Variance</div><div>Vs Average</div></div>
      {loading ? <div style={{ padding: 35, textAlign: "center", color: "#89939c", fontSize: 11 }}>Loading management information...</div> : report.rows.map(row => <div key={row.field} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr", gap: 10, padding: "16px", borderBottom: "1px solid #eef1f3", alignItems: "center" }}><div style={{ fontSize: 14, fontWeight: 800, color: "#263645" }}>{row.label}</div><div style={{ fontSize: 15, fontWeight: 800, color: "#263645" }}>{formatNumber(row.last)}</div><div style={{ fontSize: 13, color: "#53616b" }}>{formatNumber(row.average)}</div><div style={{ fontSize: 13, fontWeight: 700, color: row.variance >= 0 ? "#21824a" : "#b64b4b" }}>{row.variance >= 0 ? "+" : ""}{formatNumber(row.variance)}</div><div style={{ fontSize: 13, fontWeight: 800, color: row.percentage === null ? "#89939c" : row.percentage >= 0 ? "#21824a" : "#b64b4b" }}>{row.percentage === null ? "—" : `${row.percentage >= 0 ? "+" : ""}${row.percentage.toFixed(1)}%`}</div></div>)}
    </div>
    <div style={{ marginTop: 12, color: "#8a959d", fontSize: 10 }}>H C P S are counted independently from appointment records. A single appointment can contribute to more than one metric.</div>
  </section>
}

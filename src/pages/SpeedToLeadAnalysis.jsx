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
function compactMinutes(value) {
  const mins = Number(value)
  if (!Number.isFinite(mins)) return "—"
  if (mins < 60) return `${Math.round(mins)}m`
  if (mins < 1440) return `${(mins / 60).toFixed(1)}h`
  return `${(mins / 1440).toFixed(1)}d`
}


function UnderThresholdsChart({ rows }) {
  const series = [
    { key: "under_2_pct", label: "Under 2", color: "#32718f" },
    { key: "under_10_pct", label: "Under 10", color: "#607a35" },
    { key: "under_30_pct", label: "Under 30", color: "#a04d7e" },
    { key: "within_60_pct", label: "Under 60", color: "#00818a" },
  ]
  const width = Math.max(520, rows.length * 58 + 64), height = 250
  const left = 38, right = 12, top = 12, bottom = 38
  const plotWidth = width - left - right, plotHeight = height - top - bottom
  const highestPercentage = Math.max(0, ...rows.flatMap(row => series.map(item => Number(row[item.key]) || 0)))
  const yAxisMax = Math.max(10, Math.ceil(highestPercentage / 10) * 10)
  const yTicks = Array.from({ length: yAxisMax / 10 + 1 }, (_, index) => index * 10)
  const x = i => left + (rows.length <= 1 ? plotWidth / 2 : i * plotWidth / (rows.length - 1))
  const y = v => top + plotHeight - (Math.max(0, Math.min(yAxisMax, Number(v) || 0)) / yAxisMax) * plotHeight
  return <div style={{ minWidth: 0 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px 14px", marginBottom: 10 }}>
      {series.map(s => <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: 11 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />{s.label} mins</span>)}
    </div>
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Percentage of called leads within 2, 10, 30 and 60 minutes by month" style={{ display: "block", width: "100%", minWidth: 520, height: "auto" }}>
        {yTicks.map(t => <g key={t}><line x1={left} x2={width-right} y1={y(t)} y2={y(t)} stroke="#d8dee5" strokeDasharray="5 4" /><text x={left-8} y={y(t)+4} textAnchor="end" fill="#737b85" fontSize="11">{t}</text></g>)}
        {rows.map((r,i) => <text key={r.month_start} x={x(i)} y={height-10} textAnchor="middle" fill="#737b85" fontSize="11">{monthLabel(r.month_start).split(" ")[0]}</text>)}
        {series.map(s => <g key={s.key}><polyline fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={rows.map((r,i) => `${x(i)},${y(r[s.key])}`).join(" ")} />{rows.map((r,i) => <circle key={r.month_start} cx={x(i)} cy={y(r[s.key])} r="2.5" fill={s.color}><title>{monthLabel(r.month_start)}: {Number(r[s.key] || 0).toFixed(1)}%</title></circle>)}</g>)}
      </svg>
    </div>
  </div>
}


function DayHourHeatmap({ rows, loading, error }) {
  const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
  const hours = Array.from({ length: 12 }, (_, index) => index + 9)
  return <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, minWidth: 0 }}>
    <div style={{ marginBottom: 14 }}>
      <h3 style={{ margin: 0, color: "#10233a", fontSize: 16 }}>Speed to Lead by Day &amp; Time</h3>
      <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 11 }}>Percentage of called Core leads contacted within 10 minutes, by the day and hour the lead was received (UK time).</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px 14px", marginTop: 10, marginBottom: 10, color: "#64748b", fontSize: 11 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: "#dc2626" }} />Red: under 25%</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: "#f59e0b" }} />Amber: 25–49%</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: "#16a34a" }} />Green: 50%+</span>
      </div>
    </div>
    {loading ? <p style={{ color: "#64748b" }}>Loading day and time analysis…</p> : error ? <p style={{ color: "#b91c1c" }}>{error}</p> : <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: 620 }}>
        <div style={{ display: "grid", gridTemplateColumns: "48px repeat(12,minmax(30px,1fr))", gap: 3, alignItems: "center" }}>
          <div style={{ color: "#64748b", fontSize: 10 }}>Day</div>
          {hours.map(hour => <div key={hour} style={{ textAlign: "center", color: "#64748b", fontSize: 9 }}>{String(hour).padStart(2,"0")}:00</div>)}
          {days.map((day, dayIndex) => <React.Fragment key={day}>
            <div style={{ color: "#475569", fontSize: 11, fontWeight: 600 }}>{day.slice(0,3)}</div>
            {hours.map(hour => {
              const item = rows.find(row => Number(row.weekday_index) === dayIndex + 1 && Number(row.hour_of_day) === hour)
              const pct = item ? Number(item.within_10_pct) || 0 : null
              const trafficColor = pct === null ? "#e2e8f0" : pct >= 50 ? "#16a34a" : pct >= 25 ? "#f59e0b" : "#dc2626"
              const textColor = pct === null ? "#64748b" : pct >= 25 && pct < 50 ? "#422006" : "#ffffff"
              return <div key={hour} title={item ? `${day} ${String(hour).padStart(2,"0")}:00 · ${pct.toFixed(1)}% within 10 mins · ${compactMinutes(item.average_minutes)} average · ${durationLabel(item.median_minutes)} median · ${number(item.leads_called)} called leads` : `${day} ${String(hour).padStart(2,"0")}:00 · No data`} style={{ height: 25, borderRadius: 3, background: trafficColor, border: "1px solid rgba(15,23,42,.08)", display: "flex", alignItems: "center", justifyContent: "center", color: textColor, fontSize: 9, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden" }}>{item ? `${pct.toFixed(0)}%` : "—"}</div>
            })}
          </React.Fragment>)}
        </div>

      </div>
    </div>}
  </section>
}

export default function SpeedToLeadAnalysis() {
  const [rows, setRows] = useState([])
  const [weeklyRows, setWeeklyRows] = useState([])
  const [dayHourRows, setDayHourRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError("")
      const [{ data, error: queryError }, { data: weeklyData, error: weeklyError }, { data: dayHourData, error: dayHourError }] = await Promise.all([supabase.rpc("get_monthly_speed_to_lead"), supabase.rpc("get_weekly_speed_to_lead"), supabase.rpc("get_speed_to_lead_by_received_hour")])
      if (!active) return
      if (queryError || weeklyError || dayHourError) setError((queryError || weeklyError || dayHourError).message || "Unable to load speed-to-lead data.")
      else { setRows(data || []); setWeeklyRows(weeklyData || []); setDayHourRows(dayHourData || []) }
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [])

  const chartRows = useMemo(() => rows.filter(row => Number(row.leads_called) > 0), [rows])
  const latest = chartRows[chartRows.length - 1]
  const total = chartRows.reduce((sum, row) => sum + Number(row.leads_called || 0), 0)
  const currentMonthDate = new Date()
  currentMonthDate.setDate(1)
  const previousMonthDate = new Date(currentMonthDate)
  previousMonthDate.setMonth(previousMonthDate.getMonth() - 1)
  const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`
  const weeklyMonths = [currentMonthDate, previousMonthDate].map(date => ({
    key: monthKey(date),
    label: date.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
    rows: weeklyRows.filter(row => row.month_start === monthKey(date))
  }))
  const weekRangeLabel = row => {
    const start = new Date(`${row.week_start}T12:00:00`)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const format = date => date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    return `${format(start)} – ${format(end)}`
  }

  return <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
    <div>
      <h2 style={{ margin: "0 0 5px", color: "#10233a", fontSize: 21 }}>Core Speed To Lead Analysis</h2>
      <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>Monthly time between lead received date/time and first call recorded.</p>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}><div style={{ color: "#64748b", fontSize: 11 }}>Leads with first call</div><strong style={{ display: "block", marginTop: 5, fontSize: 23, color: "#10233a" }}>{loading ? "—" : number(total)}</strong></div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}><div style={{ color: "#64748b", fontSize: 11 }}>Latest month median</div><strong style={{ display: "block", marginTop: 5, fontSize: 23, color: "#10233a" }}>{loading || !latest ? "—" : durationLabel(latest.median_minutes)}</strong></div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}><div style={{ color: "#64748b", fontSize: 11 }}>Latest month called within 10 mins</div><strong style={{ display: "block", marginTop: 5, fontSize: 23, color: "#10233a" }}>{loading || !latest ? "—" : `${Number(latest.under_10_pct).toFixed(1)}%`}</strong></div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,560px),1fr))", gap: 14, alignItems: "stretch" }}>
      <DayHourHeatmap rows={dayHourRows} loading={loading} error={error} />
      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, minWidth: 0 }}>
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ margin: 0, color: "#10233a", fontSize: 16 }}>Monthly Speed to Lead Performance</h3>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 11 }}>Percentage of called Core leads first contacted within 2, 10, 30 and 60 minutes, by month received.</p>
        </div>
        {loading ? <p style={{ color: "#64748b" }}>Loading report…</p> : error ? <p style={{ color: "#b91c1c" }}>{error}</p> : chartRows.length === 0 ? <p style={{ color: "#64748b" }}>No leads have both timestamps recorded.</p> : <UnderThresholdsChart rows={chartRows} />}
      </section>
    </div>
    <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0" }}>
        <h3 style={{ margin: 0, color: "#10233a", fontSize: 16 }}>Monthly &amp; weekly breakdown</h3>
        <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 11 }}>Monthly totals are shown as section headers, with weekly figures underneath for the current and previous month.</p>
      </div>
      {loading ? <p style={{ padding: 16, color: "#64748b" }}>Loading report…</p> : error ? <p style={{ padding: 16, color: "#b91c1c" }}>{error}</p> : <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900, fontSize: 12 }}>
          <thead><tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>{["Month / week","Leads called","Median speed","Average speed","Within 2 mins","Within 10 mins","Within 30 mins","Within 60 mins"].map(label => <th key={label} style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{label}</th>)}</tr></thead>
          <tbody>{rows.map(monthRow => {
            const monthWeeks = weeklyRows.filter(week => week.month_start === monthRow.month_start)
            const showWeeks = weeklyMonths.some(month => month.key === monthRow.month_start)
            return <React.Fragment key={monthRow.month_start}>
              <tr style={{ borderTop: "1px solid #d7e2ee", background: "#edf4fa", color: "#10233a" }}>
                <td style={{ padding: "10px 12px", fontWeight: 750 }}>{monthLabel(monthRow.month_start)}</td>
                <td style={{ padding: "10px 12px", fontWeight: 650 }}>{number(monthRow.leads_called)}</td>
                <td style={{ padding: "10px 12px", fontWeight: 650 }}>{durationLabel(monthRow.median_minutes)}</td>
                <td style={{ padding: "10px 12px" }}>{durationLabel(monthRow.average_minutes)}</td>
                <td style={{ padding: "10px 12px" }}>{Number(monthRow.under_2_pct).toFixed(1)}%</td>
                <td style={{ padding: "10px 12px" }}>{Number(monthRow.under_10_pct).toFixed(1)}%</td>
                <td style={{ padding: "10px 12px" }}>{Number(monthRow.under_30_pct).toFixed(1)}%</td>
                <td style={{ padding: "10px 12px" }}>{Number(monthRow.within_60_pct).toFixed(1)}%</td>
              </tr>
              {showWeeks && monthWeeks.map(week => <tr key={`${monthRow.month_start}-${week.week_start}`} style={{ borderTop: "1px solid #e8edf3", background: "#fff" }}>
                <td style={{ padding: "8px 12px 8px 28px", color: "#475569" }}>↳ {weekRangeLabel(week)}</td>
                <td style={{ padding: "8px 12px" }}>{number(week.leads_called)}</td>
                <td style={{ padding: "8px 12px", fontWeight: 650 }}>{durationLabel(week.median_minutes)}</td>
                <td style={{ padding: "8px 12px" }}>{durationLabel(week.average_minutes)}</td>
                <td style={{ padding: "8px 12px" }}>{Number(week.within_2_pct).toFixed(1)}%</td>
                <td style={{ padding: "8px 12px" }}>{Number(week.within_10_pct).toFixed(1)}%</td>
                <td style={{ padding: "8px 12px" }}>{Number(week.within_30_pct).toFixed(1)}%</td>
                <td style={{ padding: "8px 12px" }}>{Number(week.within_60_pct).toFixed(1)}%</td>
              </tr>)}
            </React.Fragment>
          })}</tbody>
        </table>
      </div>}
    </section>
  </div>
}

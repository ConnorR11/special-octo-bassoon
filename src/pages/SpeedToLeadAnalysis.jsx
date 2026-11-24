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

export default function SpeedToLeadAnalysis() {
  const [rows, setRows] = useState([])
  const [dayHourRows, setDayHourRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError("")
      const [{ data, error: queryError }, { data: dayHourData, error: dayHourError }] = await Promise.all([supabase.rpc("get_monthly_speed_to_lead"), supabase.rpc("get_speed_to_lead_by_received_hour")])
      if (!active) return
      if (queryError || dayHourError) setError((queryError || dayHourError).message || "Unable to load speed-to-lead data.")
      else { setRows(data || []); setDayHourRows(dayHourData || []) }
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
      <h2 style={{ margin: "0 0 5px", color: "#10233a", fontSize: 21 }}>Core Speed To Lead Analysis</h2>
      <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>Monthly time between lead received date/time and first call recorded.</p>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}><div style={{ color: "#64748b", fontSize: 11 }}>Leads with first call</div><strong style={{ display: "block", marginTop: 5, fontSize: 23, color: "#10233a" }}>{loading ? "—" : number(total)}</strong></div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}><div style={{ color: "#64748b", fontSize: 11 }}>Latest month median</div><strong style={{ display: "block", marginTop: 5, fontSize: 23, color: "#10233a" }}>{loading || !latest ? "—" : durationLabel(latest.median_minutes)}</strong></div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}><div style={{ color: "#64748b", fontSize: 11 }}>Latest month called within 60 mins</div><strong style={{ display: "block", marginTop: 5, fontSize: 23, color: "#10233a" }}>{loading || !latest ? "—" : `${Number(latest.within_60_pct).toFixed(1)}%`}</strong></div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,440px),1fr))", gap: 14, alignItems: "stretch" }}>
      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, minWidth: 0 }}>
        <h3 style={{ margin: "0 0 14px", color: "#10233a", fontSize: 16 }}>Median speed to first call by month</h3>
        {loading ? <p style={{ color: "#64748b" }}>Loading report…</p> : error ? <p style={{ color: "#b91c1c" }}>{error}</p> : chartRows.length === 0 ? <p style={{ color: "#64748b" }}>No leads have both timestamps recorded.</p> : <div style={{ display: "flex", alignItems: "end", gap: 5, height: 230, overflowX: "auto", padding: "12px 4px 0" }}>
          {chartRows.map(row => { const value = Number(row.median_minutes) || 0; const height = Math.max(3, value / maxMinutes * 155); return <div key={row.month_start} title={`${monthLabel(row.month_start)}: ${durationLabel(value)} median`} style={{ minWidth: 34, flex: "1 0 34px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "end", alignItems: "center", gap: 6 }}><span style={{ fontSize: 9, color: "#475569", whiteSpace: "nowrap" }}>{durationLabel(value)}</span><div style={{ width: "70%", maxWidth: 32, height, background: "#32718f", borderRadius: "4px 4px 0 0" }} /><span style={{ fontSize: 9, color: "#64748b", whiteSpace: "nowrap" }}>{monthLabel(row.month_start)}</span></div> })}
        </div>}
        <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: 10 }}>Lower bars indicate faster first contact. Median limits the impact of unusually long delays.</p>
      </section>
      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, minWidth: 0 }}>
        {loading ? <p style={{ color: "#64748b" }}>Loading report…</p> : error ? <p style={{ color: "#b91c1c" }}>{error}</p> : chartRows.length === 0 ? <p style={{ color: "#64748b" }}>No leads have both timestamps recorded.</p> : <UnderThresholdsChart rows={chartRows} />}
        <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: 10 }}>Percentage of called leads first contacted within each time threshold, grouped by received month.</p>
      </section>
    </div>
    <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, minWidth: 0 }}>
      <div style={{ marginBottom: 14 }}><h3 style={{ margin: 0, color: "#10233a", fontSize: 16 }}>Speed to Lead by Day &amp; Time</h3><p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 11 }}>Percentage of called Core leads contacted within 60 minutes, by the day and hour the lead was received (UK time).</p></div>
      {loading ? <p style={{ color: "#64748b" }}>Loading day and time analysis…</p> : error ? <p style={{ color: "#b91c1c" }}>{error}</p> : <div style={{ overflowX: "auto" }}><div style={{ minWidth: 690 }}>
        <div style={{ display: "grid", gridTemplateColumns: "76px repeat(24,minmax(20px,1fr))", gap: 3, alignItems: "center" }}>
          <div style={{ color: "#64748b", fontSize: 10 }}>Day / hour</div>
          {Array.from({ length: 24 }, (_, hour) => <div key={hour} style={{ textAlign: "center", color: "#64748b", fontSize: 9 }}>{String(hour).padStart(2,"0")}</div>)}
          {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map((day, dayIndex) => <React.Fragment key={day}>
            <div style={{ color: "#475569", fontSize: 11, fontWeight: 600 }}>{day.slice(0,3)}</div>
            {Array.from({ length: 24 }, (_, hour) => {
              const item = dayHourRows.find(row => Number(row.weekday_index) === dayIndex + 1 && Number(row.hour_of_day) === hour)
              const pct = item ? Number(item.within_60_pct) || 0 : null
              const opacity = pct === null ? 0.08 : 0.18 + (Math.min(100, pct) / 100) * 0.82
              return <div key={hour} title={item ? `${day} ${String(hour).padStart(2,"0")}:00 · ${pct.toFixed(1)}% within 60 mins · ${number(item.leads_called)} called leads · ${durationLabel(item.median_minutes)} median` : `${day} ${String(hour).padStart(2,"0")}:00 · No data`} style={{ height: 25, borderRadius: 3, background: pct === null ? "#e2e8f0" : `rgba(0,129,138,${opacity})`, border: "1px solid rgba(15,23,42,.04)" }} />
            })}
          </React.Fragment>)}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, marginTop: 10, color: "#64748b", fontSize: 10 }}><span>Lower</span>{[0.15,0.35,0.55,0.75,1].map(opacity => <i key={opacity} style={{ width: 17, height: 11, borderRadius: 2, background: `rgba(0,129,138,${opacity})` }} />)}<span>Higher % within 60 mins</span></div>
      </div></div>}
      <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: 10 }}>Hover over a cell to see lead volume, median response time and percentage contacted within 60 minutes. Blank cells indicate no called leads in that time slot.</p>
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
    <p style={{ margin: 0, color: "#64748b", fontSize: 10, lineHeight: 1.5 }}>All charts use Core leads received from 1 January 2026 onwards. Day and time are calculated in UK local time; only leads with a recorded first call are included in response-speed percentages.</p>
  </div>
}

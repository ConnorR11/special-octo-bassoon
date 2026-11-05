import React, { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"

const channels = [
  { key: "SOCIAL", label: "Social Performance", color: "#e58b91" },
  { key: "PPC", label: "PPC Performance", color: "#b8a9dc" },
  { key: "AFFILIATE", label: "Affiliate Performance", color: "#8fcf83" },
  { key: "YOUTUBE", label: "Youtube Performance", color: "#d40000" },
  { key: "TIK TOK", label: "Tik Tok Performance", color: "#f0a17e" },
  { key: "EMAIL/SMS", label: "Email/SMS Performance", color: "#15558b" },
  { key: "OUTBRAIN", label: "Outbrain Performance", color: "#9dc6ee" },
]

const money = value => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0))
const whole = value => new Intl.NumberFormat("en-GB").format(Number(value || 0))
const normalise = value => {
  const v = String(value || "").trim().toUpperCase()
  if (v === "TIKTOK" || v === "TIK TOK") return "TIK TOK"
  if (v === "EMAIL" || v === "SMS" || v === "EMAIL/SMS") return "EMAIL/SMS"
  return v
}
function isoWeekInfo(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const year = d.getUTCFullYear()
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  const monday = new Date(Date.UTC(year, 0, 4))
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() || 7) - 1) + (week - 1) * 7)
  const start = new Date(monday)
  const end = new Date(monday); end.setUTCDate(end.getUTCDate() + 6)
  const local = value => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
  return { year, week, key: `${year}-W${String(week).padStart(2, "0")}`, start: local(start), end: local(end) }
}
const dateLabel = date => date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }).replace(" ", "th-").replace("th-", " ")

export default function ProntoSpend() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError("")
      try {
        const all = []
        let offset = 0
        while (true) {
          const { data, error: queryError } = await supabase.from("leads")
            .select("marketing_row_id,received_date_time,introducer,lead_cost,lead_source")
            .eq("lead_source", "Pronto Windows")
            .gte("received_date_time", "2025-12-29T00:00:00.000Z")
            .lt("received_date_time", new Date(Date.now() + 86400000).toISOString())
            .order("received_date_time", { ascending: true })
            .range(offset, offset + 999)
          if (queryError) throw queryError
          all.push(...(data || []))
          if (!data || data.length < 1000) break
          offset += 1000
        }
        if (!cancelled) setLeads(all)
      } catch (e) {
        if (!cancelled) setError(e?.message || "Unable to load Pronto spend.")
      } finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const report = useMemo(() => {
    const weeks = new Map()
    const totals = { spend: 0, leads: 0, cplSpend: 0, cplLeads: 0, byChannel: {} }
    channels.forEach(c => { totals.byChannel[c.key] = { spend: 0, leads: 0, cplSpend: 0, cplLeads: 0 } })
    leads.forEach(lead => {
      if (!lead.received_date_time) return
      const info = isoWeekInfo(new Date(lead.received_date_time))
      if (info.year !== 2026) return
      if (!weeks.has(info.key)) {
        const byChannel = {}
        channels.forEach(c => { byChannel[c.key] = { spend: 0, leads: 0, cplSpend: 0, cplLeads: 0 } })
        weeks.set(info.key, { ...info, spend: 0, leads: 0, cplSpend: 0, cplLeads: 0, byChannel })
      }
      const row = weeks.get(info.key)
      const channel = normalise(lead.introducer)
      const spend = Number(lead.lead_cost || 0)
      row.spend += spend; row.leads += 1
      totals.spend += spend; totals.leads += 1
      // The graph should only include CPLs explicitly entered and greater than zero.
      const enteredCpl = lead.lead_cost !== null && lead.lead_cost !== undefined && lead.lead_cost !== "" && Number(lead.lead_cost) > 0
      if (enteredCpl) {
        row.cplSpend += spend; row.cplLeads += 1
        totals.cplSpend += spend; totals.cplLeads += 1
      }
      if (row.byChannel[channel]) {
        row.byChannel[channel].spend += spend; row.byChannel[channel].leads += 1
        if (enteredCpl) { row.byChannel[channel].cplSpend += spend; row.byChannel[channel].cplLeads += 1 }
      }
      if (totals.byChannel[channel]) {
        totals.byChannel[channel].spend += spend; totals.byChannel[channel].leads += 1
        if (enteredCpl) { totals.byChannel[channel].cplSpend += spend; totals.byChannel[channel].cplLeads += 1 }
      }
    })
    return { weeks: [...weeks.values()].sort((a,b) => a.week-b.week), totals }
  }, [leads])

  const chart = useMemo(() => {
    const width = 1000, height = 300, left = 58, right = 24, top = 20, bottom = 48
    const values = report.weeks.flatMap(week => channels.map(channel => {
      const item = week.byChannel[channel.key]
      return item?.cplLeads ? item.cplSpend / item.cplLeads : null
    })).filter(value => value !== null && Number.isFinite(value))
    const max = Math.max(10, Math.ceil((Math.max(...values, 0) * 1.15) / 5) * 5)
    const x = index => report.weeks.length <= 1 ? (width - left - right) / 2 + left : left + index * (width - left - right) / (report.weeks.length - 1)
    const y = value => top + (max - value) / max * (height - top - bottom)
    return { width, height, left, right, top, bottom, max, x, y }
  }, [report.weeks])
  const cell = { padding: "7px 8px", border: "1px solid #d7dee7", textAlign: "right", whiteSpace: "nowrap", fontSize: 11 }
  const groupHead = color => ({ ...cell, textAlign: "center", background: color, color: "#fff", fontWeight: 700, padding: "8px 5px" })
  const subHead = { ...cell, background: "#eef2f6", fontWeight: 700, textAlign: "center" }
  const rowData = (item, key) => {
    const data = item.byChannel[key] || { spend: 0, leads: 0 }
    return <><td style={cell}>{money(data.spend)}</td><td style={{ ...cell, textAlign: "center" }}>{whole(data.leads)}</td><td style={cell}>{money(data.leads ? data.spend / data.leads : 0)}</td></>
  }
  const dateRange = item => {
    const start = new Date(item.start.getTime() + item.start.getTimezoneOffset() * 60000)
    const end = new Date(item.end.getTime() + item.end.getTimezoneOffset() * 60000)
    return `${start.getDate()}th-${end.getDate()}th`
  }
  return <section style={{ background: "#fff", border: "1px solid #dbe3ed", borderRadius: 12, padding: 18, marginBottom: 22 }}>
    <div style={{ marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18, color: "#172033" }}>Pronto weekly spend</h2>
      <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 12 }}>Weekly Pronto Windows lead spend by introducer, with lead volume and cost per lead. Lead cost uses the value recorded on each lead.</p>
    </div>
    {loading ? <p style={{ color: "#64748b" }}>Loading weekly spend…</p> : error ? <p style={{ color: "#b91c1c" }}>{error}</p> : <>
      <div style={{ margin: "16px 0 20px", padding: "14px 12px", border: "1px solid #e2e8f0", borderRadius: 8 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "#172033" }}>Weekly CPL by introducer</h3>
        <div style={{ width: "100%", overflowX: "auto" }}>
          <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="Line chart showing weekly cost per lead by introducer" style={{ display: "block", width: "100%", minWidth: 600, height: "auto" }}>
            {Array.from({ length: 5 }, (_, i) => {
              const value = chart.max * i / 4
              const yy = chart.y(value)
              return <g key={i}>
                <line x1={chart.left} x2={chart.width - chart.right} y1={yy} y2={yy} stroke="#e2e8f0" strokeDasharray="3 3" />
                <text x={chart.left - 10} y={yy + 4} textAnchor="end" fontSize="11" fill="#64748b">{money(value)}</text>
              </g>
            })}
            {report.weeks.map((week, i) => <g key={week.key}>
              <line x1={chart.x(i)} x2={chart.x(i)} y1={chart.top} y2={chart.height - chart.bottom} stroke="#f1f5f9" />
              <text x={chart.x(i)} y={chart.height - 18} textAnchor="middle" fontSize="11" fill="#64748b">W{week.week}</text>
            </g>)}
            {channels.map(channel => {
              const points = report.weeks.map((week, i) => {
                const item = week.byChannel[channel.key]
                return item?.cplLeads ? { x: chart.x(i), y: chart.y(item.cplSpend / item.cplLeads) } : null
              })
              const segments = []
              let current = []
              points.forEach(point => {
                if (point) current.push(point)
                else if (current.length) { segments.push(current); current = [] }
              })
              if (current.length) segments.push(current)
              return <g key={channel.key}>
                {segments.map((segment, i) => <polyline key={i} points={segment.map(point => `${point.x},${point.y}`).join(" ")} fill="none" stroke={channel.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />)}
                {points.filter(Boolean).map((point, i) => <circle key={i} cx={point.x} cy={point.y} r="3.5" fill={channel.color} stroke="#fff" strokeWidth="1.5" />)}
              </g>
            })}
          </svg>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginTop: 8 }}>
          {channels.map(channel => <span key={channel.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#475569", fontSize: 11 }}><span style={{ width: 18, height: 3, borderRadius: 2, background: channel.color, display: "inline-block" }} />{channel.label.replace(" Performance", "")}</span>)}
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", minWidth: 1250, width: "100%" }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ ...groupHead("#43b8c1"), textAlign: "left" }}>Week</th>
            <th rowSpan={2} style={{ ...groupHead("#43b8c1"), textAlign: "center" }}>Dates</th>
            <th colSpan={3} style={groupHead("#43b8c1")}>Overall Performance</th>
            {channels.map(c => <th key={c.key} colSpan={3} style={groupHead(c.color)}>{c.label}</th>)}
          </tr>
          <tr>
            {["Total Spent","Leads Total","CPL"].map(x => <th key={x} style={subHead}>{x}</th>)}
            {channels.map(c => <React.Fragment key={c.key}>{["Spend","Leads","CPL"].map(x => <th key={x} style={subHead}>{x}</th>)}</React.Fragment>)}
          </tr>
        </thead>
        <tbody>
          <tr style={{ background: "#e9edf2", fontWeight: 700 }}>
            <td style={{ ...cell, textAlign: "left" }}>Totals</td><td style={cell}>—</td>
            <td style={cell}>{money(report.totals.spend)}</td><td style={{ ...cell, textAlign: "center" }}>{whole(report.totals.leads)}</td><td style={cell}>{money(report.totals.leads ? report.totals.spend / report.totals.leads : 0)}</td>
            {channels.map(c => rowData(report.totals, c.key))}
          </tr>
          {report.weeks.map(week => <tr key={week.key}>
            <td style={{ ...cell, textAlign: "center", fontWeight: 700 }}>{week.week}</td><td style={{ ...cell, textAlign: "center" }}>{dateRange(week)}</td>
            <td style={cell}>{money(week.spend)}</td><td style={{ ...cell, textAlign: "center" }}>{whole(week.leads)}</td><td style={cell}>{money(week.leads ? week.spend / week.leads : 0)}</td>
            {channels.map(c => rowData(week, c.key))}
          </tr>)}
          {!report.weeks.length && <tr><td colSpan={26} style={{ ...cell, textAlign: "center" }}>No Pronto Windows leads found for 2026.</td></tr>}
        </tbody>
      </table>
      </div>
    </>}
  </section>
}

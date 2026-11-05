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
    const totals = { spend: 0, leads: 0, byChannel: {} }
    channels.forEach(c => { totals.byChannel[c.key] = { spend: 0, leads: 0 } })
    leads.forEach(lead => {
      if (!lead.received_date_time) return
      const info = isoWeekInfo(new Date(lead.received_date_time))
      if (info.year !== 2026) return
      if (!weeks.has(info.key)) {
        const byChannel = {}
        channels.forEach(c => { byChannel[c.key] = { spend: 0, leads: 0 } })
        weeks.set(info.key, { ...info, spend: 0, leads: 0, byChannel })
      }
      const row = weeks.get(info.key)
      const channel = normalise(lead.introducer)
      const spend = Number(lead.lead_cost || 0)
      row.spend += spend; row.leads += 1
      totals.spend += spend; totals.leads += 1
      if (row.byChannel[channel]) { row.byChannel[channel].spend += spend; row.byChannel[channel].leads += 1 }
      if (totals.byChannel[channel]) { totals.byChannel[channel].spend += spend; totals.byChannel[channel].leads += 1 }
    })
    return { weeks: [...weeks.values()].sort((a,b) => a.week-b.week), totals }
  }, [leads])

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
    {loading ? <p style={{ color: "#64748b" }}>Loading weekly spend…</p> : error ? <p style={{ color: "#b91c1c" }}>{error}</p> : <div style={{ overflowX: "auto" }}>
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
    </div>}
  </section>
}

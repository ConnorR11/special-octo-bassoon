import React, { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"

const money = value => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number(value || 0))
const number = value => new Intl.NumberFormat("en-GB").format(Number(value || 0))
const pct = (value, total) => total ? `${(value / total * 100).toFixed(1)}%` : "0.0%"

function getPeriods() {
  const today = new Date()
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const currentStart = new Date(monday); currentStart.setDate(currentStart.getDate() - 28)
  const previousStart = new Date(currentStart); previousStart.setDate(previousStart.getDate() - 28)
  const fmt = date => date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  return {
    current: { start: currentStart, end: monday, label: `${fmt(currentStart)} – ${fmt(new Date(monday.getTime() - 86400000))}` },
    previous: { start: previousStart, end: currentStart, label: `${fmt(previousStart)} – ${fmt(new Date(currentStart.getTime() - 86400000))}` },
  }
}

function emptyStats(name) {
  return { name, leads: 0, dup: 0, wn: 0, ooa: 0, booked: 0, h: 0, c: 0, p: 0, s: 0, value: 0 }
}

function ProntoWeeklyComparison() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const periods = useMemo(getPeriods, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError("")
      try {
        const start = periods.previous.start.toISOString()
        const end = periods.current.end.toISOString()
        const leads = []
        let offset = 0
        while (true) {
          const { data: batch, error: leadError } = await supabase.from("leads")
            .select("marketing_row_id,introducer,disposition")
            .eq("lead_source", "Pronto Windows")
            .gte("received_date_time", start).lt("received_date_time", end)
            .order("received_date_time", { ascending: true }).range(offset, offset + 999)
          if (leadError) throw leadError
          leads.push(...(batch || []))
          if (!batch || batch.length < 1000) break
          offset += 1000
        }

        const ids = leads.map(row => row.marketing_row_id).filter(Boolean)
        const appointments = []
        for (let i = 0; i < ids.length; i += 400) {
          const { data: batch, error: appointmentError } = await supabase.from("appointments")
            .select("marketing_row_id,cps_h,cps_c,cps_p,cps_s,appointment_row_id")
            .in("marketing_row_id", ids.slice(i, i + 400))
          if (appointmentError) throw appointmentError
          appointments.push(...(batch || []))
        }
        const appointmentIds = [...new Set(appointments.map(row => row.appointment_row_id).filter(Boolean))]
        const deals = []
        for (let i = 0; i < appointmentIds.length; i += 400) {
          const { data: batch, error: dealError } = await supabase.from("deals")
            .select("appointment_row_id,net_value")
            .in("appointment_row_id", appointmentIds.slice(i, i + 400))
          if (dealError) throw dealError
          deals.push(...(batch || []))
        }
        const dealsByAppointment = new Map()
        deals.forEach(deal => dealsByAppointment.set(deal.appointment_row_id, (dealsByAppointment.get(deal.appointment_row_id) || 0) + Number(deal.net_value || 0)))
        const appointmentsByLead = new Map()
        appointments.forEach(a => appointmentsByLead.set(a.marketing_row_id, [...(appointmentsByLead.get(a.marketing_row_id) || []), a]))
        const periodFor = lead => {
          const date = new Date(lead.received_date_time)
          return date >= periods.current.start ? "current" : "previous"
        }
        const summaries = { current: new Map(), previous: new Map() }
        const totals = { current: emptyStats("All introducers"), previous: emptyStats("All introducers") }
        leads.forEach(lead => {
          const period = periodFor(lead)
          const intro = String(lead.introducer || "(No Introducer)")
          if (!summaries[period].has(intro)) summaries[period].set(intro, emptyStats(intro))
          const stats = summaries[period].get(intro)
          const total = totals[period]
          const related = appointmentsByLead.get(lead.marketing_row_id) || []
          const disposition = String(lead.disposition || "").toLowerCase()
          const values = {
            leads: 1,
            dup: disposition.includes("duplicate") ? 1 : 0,
            wn: disposition.includes("wrong number") ? 1 : 0,
            ooa: disposition.includes("out of area") ? 1 : 0,
            booked: related.length ? 1 : 0,
            h: related.some(a => a.cps_h === true) ? 1 : 0,
            c: related.some(a => a.cps_c === true) ? 1 : 0,
            p: related.some(a => a.cps_p === true) ? 1 : 0,
            s: related.some(a => a.cps_s === true) ? 1 : 0,
            value: related.reduce((sum, a) => sum + Number(dealsByAppointment.get(a.appointment_row_id) || 0), 0),
          }
          Object.entries(values).forEach(([key, value]) => { stats[key] += value; total[key] += value })
        })
        if (!cancelled) setData({ summaries, totals })
      } catch (err) {
        if (!cancelled) setError(err?.message || "Unable to load the weekly comparison.")
      } finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [periods])

  const metrics = [
    ["Leads", "leads", "count"], ["DUP", "dup", "count"], ["WN", "wn", "count"], ["OOA", "ooa", "count"],
    ["Booked", "booked", "count"], ["Booked %", "bookedRate", "percent"], ["H", "h", "count"], ["C", "c", "count"],
    ["P", "p", "count"], ["S", "s", "count"], ["Lead → H", "hRate", "percent"], ["Lead → P", "pRate", "percent"], ["Net value", "value", "money"],
  ]
  const valueFor = (stats, key) => key === "bookedRate" ? pct(stats.booked, stats.leads) : key === "hRate" ? pct(stats.h, stats.leads) : key === "pRate" ? pct(stats.p, stats.leads) : key === "value" ? money(stats.value) : number(stats[key])
  const delta = (a, b, key) => {
    const av = key === "bookedRate" ? (a.leads ? a.booked / a.leads * 100 : 0) : key === "hRate" ? (a.leads ? a.h / a.leads * 100 : 0) : key === "pRate" ? (a.leads ? a.p / a.leads * 100 : 0) : Number(a[key] || 0)
    const bv = key === "bookedRate" ? (b.leads ? b.booked / b.leads * 100 : 0) : key === "hRate" ? (b.leads ? b.h / b.leads * 100 : 0) : key === "pRate" ? (b.leads ? b.p / b.leads * 100 : 0) : Number(b[key] || 0)
    const diff = av - bv
    return `${diff > 0 ? "+" : ""}${key.endsWith("Rate") ? diff.toFixed(1) + " pp" : key === "value" ? money(diff) : number(diff)}`
  }

  return <section style={{ background: "#fff", border: "1px solid #dbe3ed", borderRadius: 12, padding: 18, marginBottom: 22 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
      <div><h2 style={{ margin: 0, fontSize: 18, color: "#172033" }}>4-week performance comparison</h2><p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 12 }}>Four complete Monday–Sunday weeks compared with the four immediately before.</p></div>
      <span style={{ fontSize: 11, color: "#64748b" }}>Independent of the main date filter</span>
    </div>
    {loading ? <p style={{ color: "#64748b", fontSize: 13 }}>Loading comparison…</p> : error ? <p style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p> : data && <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, marginTop: 14 }}>
        {[["Last 4 weeks", periods.current.label], ["Previous 4 weeks", periods.previous.label]].map(([label, range]) => <div key={label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10 }}><strong style={{ display: "block", fontSize: 12 }}>{label}</strong><span style={{ fontSize: 11, color: "#64748b" }}>{range}</span></div>)}
      </div>
      <div style={{ overflowX: "auto", marginTop: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 760 }}>
          <thead><tr>{["Metric", "Last 4 weeks", "Previous 4 weeks", "Change"].map(label => <th key={label} style={{ textAlign: label === "Metric" ? "left" : "right", padding: "9px 10px", borderBottom: "1px solid #dbe3ed", color: "#64748b", fontWeight: 600 }}>{label}</th>)}</tr></thead>
          <tbody>{metrics.map(([label, key]) => <tr key={key}><td style={{ padding: "9px 10px", borderBottom: "1px solid #edf1f5", fontWeight: 600 }}>{label}</td><td style={{ padding: "9px 10px", textAlign: "right", borderBottom: "1px solid #edf1f5" }}>{valueFor(data.totals.current, key)}</td><td style={{ padding: "9px 10px", textAlign: "right", borderBottom: "1px solid #edf1f5" }}>{valueFor(data.totals.previous, key)}</td><td style={{ padding: "9px 10px", textAlign: "right", borderBottom: "1px solid #edf1f5", color: "#334155" }}>{delta(data.totals.current, data.totals.previous, key)}</td></tr>)}</tbody>
        </table>
      </div>
      <h3 style={{ fontSize: 14, margin: "20px 0 8px" }}>Introducer breakdown</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 900 }}>
          <thead><tr>{["Introducer", "Leads", "Booked", "Booked %", "H", "C", "P", "S", "Lead → H", "Lead → P", "Net value"].map(label => <th key={label} style={{ textAlign: label === "Introducer" ? "left" : "right", padding: "8px", borderBottom: "1px solid #dbe3ed", color: "#64748b", whiteSpace: "nowrap" }}>{label}</th>)}</tr></thead>
          <tbody>{[...new Set([...data.summaries.current.keys(), ...data.summaries.previous.keys()])].sort().map(name => {
            const a = data.summaries.current.get(name) || emptyStats(name), b = data.summaries.previous.get(name) || emptyStats(name)
            return <React.Fragment key={name}><tr><td style={{ padding: 8, borderBottom: "1px solid #edf1f5", fontWeight: 600 }}>{name}</td>{["leads","booked","bookedRate","h","c","p","s","hRate","pRate","value"].map(key => <td key={key} style={{ padding: 8, borderBottom: "1px solid #edf1f5", textAlign: "right", whiteSpace: "nowrap" }}>{valueFor(a,key)}</td>)}</tr></React.Fragment>
          })}</tbody>
        </table>
      </div>
      <p style={{ margin: "10px 0 0", color: "#94a3b8", fontSize: 10 }}>Counts are based on distinct leads. Booked means at least one linked appointment; H/C/P/S count a lead once if any linked appointment has that flag. Net value is the sum of net_value on linked deals.</p>
    </>}
  </section>
}

export default ProntoWeeklyComparison

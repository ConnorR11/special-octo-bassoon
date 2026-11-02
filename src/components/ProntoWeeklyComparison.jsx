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
            .select("marketing_row_id,introducer,disposition,received_date_time")
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
    ["Leads", "leads", "count"],
    ["Booked", "booked", "count"], ["Booked %", "bookedRate", "percent"], ["H", "h", "count"], ["C", "c", "count"],
    ["P", "p", "count"], ["S", "s", "count"], ["Lead → H", "hRate", "percent"], ["Lead → P", "pRate", "percent"], ["Net value", "value", "money"],
  ]
  const numericValue = (stats, key) => key === "bookedRate" ? (stats.leads ? stats.booked / stats.leads * 100 : 0) : key === "hRate" ? (stats.leads ? stats.h / stats.leads * 100 : 0) : key === "pRate" ? (stats.leads ? stats.p / stats.leads * 100 : 0) : Number(stats[key] || 0)
  const valueFor = (stats, key) => {
    const value = numericValue(stats, key)
    return key.endsWith("Rate") ? `${value.toFixed(1)}%` : key === "value" ? money(value) : number(value)
  }
  const changeFor = (current, previous, key) => {
    const difference = numericValue(current, key) - numericValue(previous, key)
    const formatted = key.endsWith("Rate") ? `${Math.abs(difference).toFixed(1)} pp` : key === "value" ? money(Math.abs(difference)) : number(Math.abs(difference))
    return `${difference > 0 ? "+" : difference < 0 ? "−" : ""}${formatted}`
  }

  return <section style={{ background: "#fff", border: "1px solid #dbe3ed", borderRadius: 12, padding: 18, marginBottom: 22 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
      <div><h2 style={{ margin: 0, fontSize: 18, color: "#172033" }}>Pronto introducer comparison</h2><p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 12 }}>Introducer-level figures for the last four complete weeks versus the four weeks before, with the difference.</p></div>
    </div>
    {loading ? <p style={{ color: "#64748b", fontSize: 13 }}>Loading comparison…</p> : error ? <p style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p> : data && <>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "14px 0 10px", fontSize: 11 }}>
        <span><strong>Last 4 weeks:</strong> {periods.current.label}</span>
        <span><strong>Previous 4 weeks:</strong> {periods.previous.label}</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 1500 }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ position: "sticky", left: 0, zIndex: 2, background: "#fff", textAlign: "left", padding: "9px 8px", borderBottom: "1px solid #dbe3ed" }}>Introducer</th>
              {metrics.map(([label, key]) => <th key={key} colSpan={3} style={{ textAlign: "center", padding: "8px 4px", borderBottom: "1px solid #dbe3ed", borderLeft: "1px solid #e2e8f0", color: "#334155", whiteSpace: "nowrap" }}>{label}</th>)}
            </tr>
            <tr>
              {metrics.flatMap(([label, key]) => ["L4W", "P4W", "Δ"].map((heading, index) => <th key={key + heading} style={{ textAlign: "right", padding: "7px 6px", borderBottom: "1px solid #dbe3ed", borderLeft: index === 0 ? "1px solid #e2e8f0" : undefined, color: "#64748b", fontWeight: 500, whiteSpace: "nowrap" }}>{heading}</th>))}
            </tr>
          </thead>
          <tbody>{[...new Set([...data.summaries.current.keys(), ...data.summaries.previous.keys()])].sort().map(name => {
            const current = data.summaries.current.get(name) || emptyStats(name)
            const previous = data.summaries.previous.get(name) || emptyStats(name)
            return <tr key={name}>
              <td style={{ position: "sticky", left: 0, zIndex: 1, background: "#fff", padding: "9px 8px", borderBottom: "1px solid #edf1f5", fontWeight: 600, whiteSpace: "nowrap" }}>{name}</td>
              {metrics.flatMap(([label, key]) => [
                <td key={key + "current"} style={{ padding: "9px 6px", textAlign: "right", borderBottom: "1px solid #edf1f5", borderLeft: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{valueFor(current, key)}</td>,
                <td key={key + "previous"} style={{ padding: "9px 6px", textAlign: "right", borderBottom: "1px solid #edf1f5", whiteSpace: "nowrap" }}>{valueFor(previous, key)}</td>,
                <td key={key + "difference"} style={{ padding: "9px 6px", textAlign: "right", borderBottom: "1px solid #edf1f5", whiteSpace: "nowrap", color: numericValue(current, key) > numericValue(previous, key) ? "#15803d" : numericValue(current, key) < numericValue(previous, key) ? "#b91c1c" : "#64748b", fontWeight: 600 }}>{changeFor(current, previous, key)}</td>
              ])}
            </tr>
          })}
            <tr style={{ background: "#f8fafc" }}>
              <td style={{ position: "sticky", left: 0, zIndex: 1, background: "#f8fafc", padding: "10px 8px", borderTop: "2px solid #cbd5e1", fontWeight: 700, whiteSpace: "nowrap" }}>TOTAL</td>
              {metrics.flatMap(([label, key]) => [
                <td key={key + "total-current"} style={{ padding: "10px 6px", textAlign: "right", borderTop: "2px solid #cbd5e1", borderLeft: "1px solid #e2e8f0", whiteSpace: "nowrap", fontWeight: 700 }}>{valueFor(data.totals.current, key)}</td>,
                <td key={key + "total-previous"} style={{ padding: "10px 6px", textAlign: "right", borderTop: "2px solid #cbd5e1", whiteSpace: "nowrap", fontWeight: 700 }}>{valueFor(data.totals.previous, key)}</td>,
                <td key={key + "total-difference"} style={{ padding: "10px 6px", textAlign: "right", borderTop: "2px solid #cbd5e1", whiteSpace: "nowrap", fontWeight: 700, color: numericValue(data.totals.current, key) > numericValue(data.totals.previous, key) ? "#15803d" : numericValue(data.totals.current, key) < numericValue(data.totals.previous, key) ? "#b91c1c" : "#64748b" }}>{changeFor(data.totals.current, data.totals.previous, key)}</td>
              ])}
            </tr>
          </tbody>
        </table>
      </div>
      <p style={{ margin: "10px 0 0", color: "#94a3b8", fontSize: 10 }}>All figures are grouped by introducer. Percentage differences are shown in percentage points. Scroll horizontally to see all metrics.</p>
    </>}
  </section>
}

export default ProntoWeeklyComparison

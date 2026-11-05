import React, { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"

const number = value => new Intl.NumberFormat("en-GB").format(Number(value || 0))
const percentage = (value, total) => total ? `${((value / total) * 100).toFixed(1)}%` : "0.0%"

function getPeriods() {
  const today = new Date()
  const thisMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  thisMonday.setDate(thisMonday.getDate() - ((thisMonday.getDay() + 6) % 7))
  const lastWeekStart = new Date(thisMonday); lastWeekStart.setDate(lastWeekStart.getDate() - 7)
  const fourWeeksStart = new Date(thisMonday); fourWeeksStart.setDate(fourWeeksStart.getDate() - 28)
  const yearStart = new Date(thisMonday.getFullYear(), 0, 1)
  const fmt = date => date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  const period = (start, end) => ({ start, end, label: `${fmt(start)} – ${fmt(new Date(end.getTime() - 86400000))}` })
  return { ytd: period(yearStart, thisMonday), fourWeeks: period(fourWeeksStart, thisMonday), lastWeek: period(lastWeekStart, thisMonday) }
}

function emptyStats(label) {
  return { label, spend: 0, leads: 0, booked: 0 }
}

function ProntoWeeklyComparison() {
  const [rows, setRows] = useState([])
  const [totals, setTotals] = useState({ ytd: emptyStats("TOTAL"), fourWeeks: emptyStats("TOTAL"), lastWeek: emptyStats("TOTAL") })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [expandedIntroducers, setExpandedIntroducers] = useState({})
  const periods = useMemo(getPeriods, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError("")
      try {
        const leads = []
        let offset = 0
        while (true) {
          const { data: batch, error: leadError } = await supabase.from("leads")
            .select("marketing_row_id,pronto_SID,introducer,received_date_time,lead_cost")
            .eq("lead_source", "Pronto Windows")
            .gte("received_date_time", periods.ytd.start.toISOString())
            .lt("received_date_time", periods.fourWeeks.end.toISOString())
            .order("received_date_time", { ascending: true })
            .range(offset, offset + 999)
          if (leadError) throw leadError
          leads.push(...(batch || []))
          if (!batch || batch.length < 1000) break
          offset += 1000
        }

        const ids = [...new Set(leads.map(row => row.marketing_row_id).filter(Boolean))]
        const appointments = []
        for (let i = 0; i < ids.length; i += 400) {
          const { data: batch, error: appointmentError } = await supabase.from("appointments")
            .select("marketing_row_id,appointment_date")
            .in("marketing_row_id", ids.slice(i, i + 400))
          if (appointmentError) throw appointmentError
          appointments.push(...(batch || []))
        }

        const bookedLeadIds = new Set(
          appointments.filter(appointment => appointment.appointment_date !== null && appointment.appointment_date !== "").map(appointment => appointment.marketing_row_id)
        )
        const grouped = new Map()
        const nextTotals = { ytd: emptyStats("TOTAL"), fourWeeks: emptyStats("TOTAL"), lastWeek: emptyStats("TOTAL") }

        leads.forEach(lead => {
          const received = new Date(lead.received_date_time)
          const sid = String(lead.pronto_SID || "").trim() || "(No SID)"
          const introducer = String(lead.introducer || "").trim() || "(No introducer)"
          const groupKey = introducer + "::" + sid
          if (!grouped.has(groupKey)) {
            grouped.set(groupKey, {
              introducer,
              sid,
              ytd: emptyStats(sid),
              fourWeeks: emptyStats(sid),
              lastWeek: emptyStats(sid),
            })
          }
          const row = grouped.get(groupKey)
          const isBooked = bookedLeadIds.has(lead.marketing_row_id)
          const spend = Number(lead.lead_cost || 0)
          const inPeriod = key => received >= periods[key].start && received < periods[key].end
          ;["ytd", "fourWeeks", "lastWeek"].forEach(key => {
            if (!inPeriod(key)) return
            row[key].spend += spend
            row[key].leads += 1
            nextTotals[key].spend += spend
            nextTotals[key].leads += 1
            if (isBooked) { row[key].booked += 1; nextTotals[key].booked += 1 }
          })
        })

        const introducerGroups = new Map()
        for (const row of grouped.values()) {
          if (!introducerGroups.has(row.introducer)) {
            introducerGroups.set(row.introducer, {
              introducer: row.introducer,
              items: [],
              ytd: emptyStats(row.introducer),
              fourWeeks: emptyStats(row.introducer),
              lastWeek: emptyStats(row.introducer),
            })
          }
          const group = introducerGroups.get(row.introducer)
          group.items.push(row)
          ;["ytd", "fourWeeks", "lastWeek"].forEach(period => ["spend", "leads", "booked"].forEach(key => { group[period][key] += row[period][key] }))
        }

        const sorted = [...introducerGroups.values()]
          .sort((a, b) => {
            if (a.introducer === "(No introducer)") return 1
            if (b.introducer === "(No introducer)") return -1
            return a.introducer.localeCompare(b.introducer)
          })
          .map(group => ({
            ...group,
            items: group.items.sort((a, b) => {
              if (a.sid === "(No SID)") return 1
              if (b.sid === "(No SID)") return -1
              return a.sid.localeCompare(b.sid, undefined, { numeric: true })
            }),
          }))
        if (!cancelled) {
          setRows(sorted)
          setTotals(nextTotals)
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || "Unable to load the SID comparison.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [periods])

  const money = value => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0))

  const metrics = [
    { label: "Spend", key: "spend", format: money },
    { label: "Leads", key: "leads", format: number },
    { label: "Booked", key: "booked", format: number },
    { label: "Booked %", key: "bookedRate", format: value => `${Number(value || 0).toFixed(1)}%` },
    { label: "CPL", key: "cpl", format: money },
    { label: "CPB", key: "cpb", format: money },
  ]

  const getMetricValue = (stats, key) => {
    if (key === "cpl") return stats.leads ? stats.spend / stats.leads : 0
    if (key === "cpb") return stats.booked ? stats.spend / stats.booked : 0
    if (key === "bookedRate") return stats.leads ? stats.booked / stats.leads * 100 : 0
    return Number(stats[key] || 0)
  }

  const cellStyle = { padding: "9px 8px", textAlign: "right", borderBottom: "1px solid #edf1f5", whiteSpace: "nowrap" }
  const headerStyle = { padding: "8px 7px", textAlign: "right", borderBottom: "1px solid #dbe3ed", color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }
  const periodKeys = ["ytd", "fourWeeks", "lastWeek"]
  const periodLabels = { ytd: "YTD", fourWeeks: "Last 4 weeks", lastWeek: "Last week" }
  const renderMetricCells = (stats, rowKey) => metrics.flatMap(metric => periodKeys.map(period => (
    <td key={rowKey + "-" + metric.key + "-" + period} style={{ ...cellStyle, borderLeft: period === "ytd" ? "1px solid #e2e8f0" : undefined, fontWeight: rowKey === "total" || rowKey.endsWith("summary") ? 700 : 500, color: rowKey.includes("sid") ? "#475569" : undefined }}>
      {metric.format(getMetricValue(stats[period], metric.key), stats[period])}
    </td>
  )))
  return <section style={{ background: "#fff", border: "1px solid #dbe3ed", borderRadius: 12, padding: 18, marginBottom: 22 }}>
    <div>
      <h2 style={{ margin: 0, fontSize: 18, color: "#172033" }}>Pronto SID performance comparison</h2>
      <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 12 }}>SID-level spend, leads, booked leads, booked rate, CPL and CPB across year to date, the last four complete weeks and last week.</p>
    </div>
    {loading ? <p style={{ color: "#64748b", fontSize: 13 }}>Loading SID comparison…</p> : error ? <p style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p> : <>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "14px 0 10px", fontSize: 11 }}>
        <span><strong>YTD:</strong> {periods.ytd.label}</span>
        <span><strong>Last 4 weeks:</strong> {periods.fourWeeks.label}</span>
        <span><strong>Last week:</strong> {periods.lastWeek.label}</span>
      </div>
      <div style={{ overflowX: "auto", marginTop: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 1050 }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ position: "sticky", left: 0, zIndex: 2, background: "#fff", textAlign: "left", padding: "9px 8px", borderBottom: "1px solid #dbe3ed" }}>Introducer</th>
              <th rowSpan={2} style={{ textAlign: "left", padding: "9px 8px", borderBottom: "1px solid #dbe3ed" }}>SID</th>
              {metrics.map(metric => <th key={metric.key} colSpan={3} style={{ textAlign: "center", padding: "8px 4px", borderBottom: "1px solid #dbe3ed", borderLeft: "1px solid #e2e8f0", color: "#334155", whiteSpace: "nowrap" }}>{metric.label}</th>)}
            </tr>
            <tr>
              {metrics.flatMap(metric => periodKeys.map(period => <th key={metric.key + period} style={{ ...headerStyle, borderLeft: period === "ytd" ? "1px solid #e2e8f0" : undefined }}>{periodLabels[period]}</th>))}
            </tr>
          </thead>
          <tbody>
            {rows.flatMap(group => {
              const expanded = Boolean(expandedIntroducers[group.introducer])
              const summaryRow = <tr key={group.introducer + "-summary"} style={{ background: "#f8fafc" }}>
                <td style={{ position: "sticky", left: 0, zIndex: 1, background: "#f8fafc", padding: "10px 8px", borderBottom: "1px solid #dbe3ed", fontWeight: 700, whiteSpace: "nowrap" }}>{group.introducer}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid #dbe3ed", whiteSpace: "nowrap" }}>
                  <button type="button" onClick={() => setExpandedIntroducers(current => ({ ...current, [group.introducer]: !current[group.introducer] }))} aria-expanded={expanded} style={{ border: 0, background: "transparent", color: "#2563eb", cursor: "pointer", padding: 0, font: "inherit", fontWeight: 600 }}>
                    {expanded ? "▾" : "▸"} {group.items.length} {group.items.length === 1 ? "SID" : "SIDs"}
                  </button>
                </td>
                {renderMetricCells(group, group.introducer + "-summary")}
              </tr>
              const sidRows = expanded ? group.items.map(row => <tr key={group.introducer + "-" + row.sid}>
                <td style={{ position: "sticky", left: 0, zIndex: 1, background: "#fff", padding: "8px", borderBottom: "1px solid #edf1f5", color: "#64748b" }} />
                <td style={{ padding: "8px 8px 8px 20px", borderBottom: "1px solid #edf1f5", fontWeight: 600, whiteSpace: "nowrap" }}>{row.sid}</td>
                {renderMetricCells(row, "sid-" + group.introducer + "-" + row.sid)}
              </tr>) : []
              return [summaryRow, ...sidRows]
            })}
            <tr style={{ background: "#e8eef6" }}>
              <td colSpan={2} style={{ position: "sticky", left: 0, zIndex: 1, background: "#e8eef6", padding: "10px 8px", borderTop: "2px solid #94a3b8", fontWeight: 700 }}>GRAND TOTAL</td>
              {renderMetricCells(totals, "total")}
            </tr>
          </tbody>
        </table>
      </div>
      <p style={{ margin: "10px 0 0", color: "#94a3b8", fontSize: 10 }}>Booked counts each lead once when it has at least one linked appointment with a non-empty appointment date. Booked % = booked leads divided by leads received. YTD and weekly periods are based on lead received date and exclude the current incomplete week.</p>
    </>}
  </section>
}

export default ProntoWeeklyComparison

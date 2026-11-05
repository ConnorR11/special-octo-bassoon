import React, { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"

const number = value => new Intl.NumberFormat("en-GB").format(Number(value || 0))
const percentage = (value, total) => total ? `${((value / total) * 100).toFixed(1)}%` : "0.0%"

function getPeriods() {
  const today = new Date()
  const thisMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  thisMonday.setDate(thisMonday.getDate() - ((thisMonday.getDay() + 6) % 7))
  const lastWeekStart = new Date(thisMonday)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)
  const fourWeeksStart = new Date(thisMonday)
  fourWeeksStart.setDate(fourWeeksStart.getDate() - 28)
  const fmt = date => date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  return {
    fourWeeks: {
      start: fourWeeksStart,
      end: thisMonday,
      label: `${fmt(fourWeeksStart)} – ${fmt(new Date(thisMonday.getTime() - 86400000))}`,
    },
    lastWeek: {
      start: lastWeekStart,
      end: thisMonday,
      label: `${fmt(lastWeekStart)} – ${fmt(new Date(thisMonday.getTime() - 86400000))}`,
    },
  }
}

function emptyStats(label) {
  return { label, spend: 0, leads: 0, booked: 0 }
}

function ProntoWeeklyComparison() {
  const [rows, setRows] = useState([])
  const [totals, setTotals] = useState({ fourWeeks: emptyStats("TOTAL"), lastWeek: emptyStats("TOTAL") })
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
            .gte("received_date_time", periods.fourWeeks.start.toISOString())
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
        const nextTotals = { fourWeeks: emptyStats("TOTAL"), lastWeek: emptyStats("TOTAL") }

        leads.forEach(lead => {
          const received = new Date(lead.received_date_time)
          const sid = String(lead.pronto_SID || "").trim() || "(No SID)"
          const introducer = String(lead.introducer || "").trim() || "(No introducer)"
          const groupKey = introducer + "::" + sid
          if (!grouped.has(groupKey)) {
            grouped.set(groupKey, {
              introducer,
              sid,
              fourWeeks: emptyStats(sid),
              lastWeek: emptyStats(sid),
            })
          }
          const row = grouped.get(groupKey)
          const isBooked = bookedLeadIds.has(lead.marketing_row_id)
          const isLastWeek = received >= periods.lastWeek.start && received < periods.lastWeek.end

          const spend = Number(lead.lead_cost || 0)
          row.fourWeeks.spend += spend
          nextTotals.fourWeeks.spend += spend
          row.fourWeeks.leads += 1
          nextTotals.fourWeeks.leads += 1
          if (isBooked) {
            row.fourWeeks.booked += 1
            nextTotals.fourWeeks.booked += 1
          }

          if (isLastWeek) {
            row.lastWeek.spend += spend
            nextTotals.lastWeek.spend += spend
            row.lastWeek.leads += 1
            nextTotals.lastWeek.leads += 1
            if (isBooked) {
              row.lastWeek.booked += 1
              nextTotals.lastWeek.booked += 1
            }
          }
        })

        const introducerGroups = new Map()
        for (const row of grouped.values()) {
          if (!introducerGroups.has(row.introducer)) {
            introducerGroups.set(row.introducer, {
              introducer: row.introducer,
              items: [],
              fourWeeks: emptyStats(row.introducer),
              lastWeek: emptyStats(row.introducer),
            })
          }
          const group = introducerGroups.get(row.introducer)
          group.items.push(row)
          ;["spend", "leads", "booked"].forEach(key => {
            group.fourWeeks[key] += row.fourWeeks[key]
            group.lastWeek[key] += row.lastWeek[key]
          })
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

  return <section style={{ background: "#fff", border: "1px solid #dbe3ed", borderRadius: 12, padding: 18, marginBottom: 22 }}>
    <div>
      <h2 style={{ margin: 0, fontSize: 18, color: "#172033" }}>Pronto SID performance comparison</h2>
      <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 12 }}>SID-level spend, leads, booked leads, CPL and CPB for the last four complete weeks versus last week.</p>
    </div>
    {loading ? <p style={{ color: "#64748b", fontSize: 13 }}>Loading SID comparison…</p> : error ? <p style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p> : <>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "14px 0 10px", fontSize: 11 }}>
        <span><strong>Last 4 weeks:</strong> {periods.fourWeeks.label}</span>
        <span><strong>Last week:</strong> {periods.lastWeek.label}</span>
      </div>
      <div style={{ overflowX: "auto", marginTop: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 820 }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ position: "sticky", left: 0, zIndex: 2, background: "#fff", textAlign: "left", padding: "9px 8px", borderBottom: "1px solid #dbe3ed" }}>Introducer</th>
              <th rowSpan={2} style={{ textAlign: "left", padding: "9px 8px", borderBottom: "1px solid #dbe3ed" }}>SID</th>
              {metrics.map(metric => <th key={metric.key} colSpan={metric.key === "bookedRate" ? 3 : 2} style={{ textAlign: "center", padding: "8px 4px", borderBottom: "1px solid #dbe3ed", borderLeft: "1px solid #e2e8f0", color: "#334155", whiteSpace: "nowrap" }}>{metric.label}</th>)}
            </tr>
            <tr>
              {metrics.flatMap(metric => {
                const headings = metric.key === "bookedRate" ? ["Last 4 weeks", "Last week", "Change"] : ["Last 4 weeks", "Last week"]
                return headings.map((heading, index) => <th key={metric.key + heading} style={{ ...headerStyle, borderLeft: index === 0 || heading === "Change" ? "1px solid #e2e8f0" : undefined }}>{heading}</th>)
              })}
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
                {metrics.flatMap(metric => {
                  const fourWeeksValue = metric.format(getMetricValue(group.fourWeeks, metric.key), group.fourWeeks)
                  const lastWeekValue = metric.format(getMetricValue(group.lastWeek, metric.key), group.lastWeek)
                  const cells = [
                    <td key={metric.key + "-summary-four-weeks"} style={{ ...cellStyle, borderLeft: "1px solid #e2e8f0", fontWeight: 700 }}>{fourWeeksValue}</td>,
                    <td key={metric.key + "-summary-last-week"} style={{ ...cellStyle, fontWeight: 700 }}>{lastWeekValue}</td>,
                  ]
                  if (metric.key === "bookedRate") {
                    const change = getMetricValue(group.lastWeek, "bookedRate") - getMetricValue(group.fourWeeks, "bookedRate")
                    const changeColor = change > 0 ? "#15803d" : change < 0 ? "#dc2626" : "#64748b"
                    cells.push(<td key="summary-bookedRate-change" style={{ ...cellStyle, borderLeft: "1px solid #e2e8f0", color: changeColor, fontWeight: 700 }}>{change > 0 ? "+" : ""}{change.toFixed(1)} pp</td>)
                  }
                  return cells
                })}
              </tr>
              const sidRows = expanded ? group.items.map(row => <tr key={group.introducer + "-" + row.sid}>
                <td style={{ position: "sticky", left: 0, zIndex: 1, background: "#fff", padding: "8px", borderBottom: "1px solid #edf1f5", color: "#64748b" }} />
                <td style={{ padding: "8px 8px 8px 20px", borderBottom: "1px solid #edf1f5", fontWeight: 600, whiteSpace: "nowrap" }}>{row.sid}</td>
                {metrics.flatMap(metric => {
                  const fourWeeksValue = metric.format(getMetricValue(row.fourWeeks, metric.key), row.fourWeeks)
                  const lastWeekValue = metric.format(getMetricValue(row.lastWeek, metric.key), row.lastWeek)
                  const cells = [
                    <td key={metric.key + "-sid-four-weeks"} style={{ ...cellStyle, borderLeft: "1px solid #e2e8f0", color: "#475569" }}>{fourWeeksValue}</td>,
                    <td key={metric.key + "-sid-last-week"} style={{ ...cellStyle, color: "#475569" }}>{lastWeekValue}</td>,
                  ]
                  if (metric.key === "bookedRate") {
                    const change = getMetricValue(row.lastWeek, "bookedRate") - getMetricValue(row.fourWeeks, "bookedRate")
                    const changeColor = change > 0 ? "#15803d" : change < 0 ? "#dc2626" : "#64748b"
                    cells.push(<td key="sid-bookedRate-change" style={{ ...cellStyle, color: changeColor, fontWeight: 600, borderLeft: "1px solid #e2e8f0" }}>{change > 0 ? "+" : ""}{change.toFixed(1)} pp</td>)
                  }
                  return cells
                })}
              </tr>) : []
              return [summaryRow, ...sidRows]
            })}
            <tr style={{ background: "#e8eef6" }}>
              <td colSpan={2} style={{ position: "sticky", left: 0, zIndex: 1, background: "#e8eef6", padding: "10px 8px", borderTop: "2px solid #94a3b8", fontWeight: 700 }}>GRAND TOTAL</td>
              {metrics.flatMap(metric => {
                const fourWeeksValue = metric.format(getMetricValue(totals.fourWeeks, metric.key), totals.fourWeeks)
                const lastWeekValue = metric.format(getMetricValue(totals.lastWeek, metric.key), totals.lastWeek)
                const cells = [
                  <td key={metric.key + "-total-four-weeks"} style={{ ...cellStyle, borderTop: "2px solid #94a3b8", borderLeft: "1px solid #e2e8f0", fontWeight: 700 }}>{fourWeeksValue}</td>,
                  <td key={metric.key + "-total-last-week"} style={{ ...cellStyle, borderTop: "2px solid #94a3b8", fontWeight: 700 }}>{lastWeekValue}</td>,
                ]
                if (metric.key === "bookedRate") {
                  const change = getMetricValue(totals.lastWeek, "bookedRate") - getMetricValue(totals.fourWeeks, "bookedRate")
                  const changeColor = change > 0 ? "#15803d" : change < 0 ? "#dc2626" : "#64748b"
                  cells.push(<td key="total-bookedRate-change" style={{ ...cellStyle, borderTop: "2px solid #94a3b8", borderLeft: "1px solid #e2e8f0", color: changeColor, fontWeight: 700 }}>{change > 0 ? "+" : ""}{change.toFixed(1)} pp</td>)
                }
                return cells
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p style={{ margin: "10px 0 0", color: "#94a3b8", fontSize: 10 }}>Booked counts each lead once when it has at least one linked appointment with a non-empty appointment date. Booked % = booked leads divided by leads received. The last-week figures are included within the four-week totals.</p>
    </>}
  </section>
}

export default ProntoWeeklyComparison

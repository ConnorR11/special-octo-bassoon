import React, { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

const number = value => new Intl.NumberFormat("en-GB").format(Number(value || 0))
const percentage = (value, total) => total ? `${((value / total) * 100).toFixed(1)}%` : "0.0%"
const SID_LINE_COLORS = ["#2563eb", "#0d9488", "#9333ea", "#ea580c", "#64748b", "#dc2626", "#0891b2", "#65a30d", "#c026d3", "#a16207", "#4f46e5", "#0f766e"]

function getWeeks() {
  const today = new Date()
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const fmt = date => date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  return Array.from({ length: 12 }, (_, index) => {
    const end = new Date(monday)
    end.setDate(end.getDate() - (index * 7))
    const start = new Date(end)
    start.setDate(start.getDate() - 7)
    return {
      key: `week${index + 1}`,
      start,
      end,
      label: `${fmt(start)} – ${fmt(new Date(end.getTime() - 86400000))}`,
    }
  }).reverse()
}

function emptyStats(sid) {
  return { sid, leads: 0, booked: 0 }
}

function ProntoSidWeeklyBreakdown() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedSids, setSelectedSids] = useState(null)
  const weeks = useMemo(getWeeks, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError("")
      try {
        const start = weeks[0].start.toISOString()
        const end = weeks[11].end.toISOString()
        const leads = []
        let offset = 0
        while (true) {
          const { data: batch, error: leadError } = await supabase
            .from("leads")
            .select("marketing_row_id,pronto_SID,received_date_time")
            .eq("lead_source", "Pronto Windows")
            .gte("received_date_time", start)
            .lt("received_date_time", end)
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
          const { data: batch, error: appointmentError } = await supabase
            .from("appointments")
            .select("marketing_row_id")
            .in("marketing_row_id", ids.slice(i, i + 400))
          if (appointmentError) throw appointmentError
          appointments.push(...(batch || []))
        }

        const appointmentsByLead = new Map()
        appointments.forEach(appointment => {
          const key = appointment.marketing_row_id
          appointmentsByLead.set(key, [...(appointmentsByLead.get(key) || []), appointment])
        })

        const grouped = new Map()
        leads.forEach(lead => {
          const date = new Date(lead.received_date_time)
          const week = weeks.find(item => date >= item.start && date < item.end)
          if (!week) return
          const sid = String(lead.pronto_SID || "").trim() || "(No SID)"
          const key = sid
          if (!grouped.has(key)) grouped.set(key, { sid, weeks: Object.fromEntries(weeks.map(item => [item.key, emptyStats(sid)])) })
          const stats = grouped.get(key).weeks[week.key]
          const related = appointmentsByLead.get(lead.marketing_row_id) || []
          stats.leads += 1
          if (related.length) stats.booked += 1
        })

        if (!cancelled) setRows([...grouped.values()].sort((a, b) => {
          if (a.sid === "(No SID)") return 1
          if (b.sid === "(No SID)") return -1
          return a.sid.localeCompare(b.sid, undefined, { numeric: true })
        }))
      } catch (err) {
        if (!cancelled) setError(err?.message || "Unable to load the SID weekly breakdown.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [weeks])

  const activeSids = selectedSids ?? rows.map(row => row.sid)
  const chartData = useMemo(() => weeks.map(week => {
    const point = { week: week.label }
    rows.forEach(row => {
      const stats = row.weeks[week.key]
      point[row.sid] = stats.leads ? Number(((stats.booked / stats.leads) * 100).toFixed(1)) : null
    })
    return point
  }), [rows, weeks])

  const totals = useMemo(() => Object.fromEntries(weeks.map(week => [week.key, rows.reduce((sum, row) => {
    const stats = row.weeks[week.key]
    sum.leads += stats.leads
    sum.booked += stats.booked
    return sum
  }, emptyStats("TOTAL"))])), [rows, weeks])

  return <section style={{ background: "#fff", border: "1px solid #dbe3ed", borderRadius: 12, padding: 18, marginBottom: 22 }}>
    <div>
      <h2 style={{ margin: 0, fontSize: 18, color: "#172033" }}>Pronto SID weekly breakdown</h2>
      <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 12 }}>Leads and booked percentage by SID, split into each of the last twelve complete weeks.</p>
    </div>
    {loading ? <p style={{ color: "#64748b", fontSize: 13 }}>Loading SID breakdown…</p> : error ? <p style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p> : <>
      <div style={{ marginTop: 18, padding: 14, border: "1px solid #e2e8f0", borderRadius: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, color: "#172033" }}>SID booking rate trends</h3>
            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 11 }}>Weekly booked percentage over the last 12 complete weeks. Select which SIDs appear.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setSelectedSids(rows.map(row => row.sid))} style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 9px", background: "#fff", fontSize: 11, cursor: "pointer" }}>Select all</button>
            <button type="button" onClick={() => setSelectedSids([])} style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 9px", background: "#fff", fontSize: 11, cursor: "pointer" }}>Clear all</button>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "7px 14px", marginBottom: 12 }}>
          {rows.map((row, index) => {
            const checked = activeSids.includes(row.sid)
            const color = SID_LINE_COLORS[index % SID_LINE_COLORS.length]
            return <label key={row.sid} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#334155", cursor: "pointer" }}>
              <input type="checkbox" checked={checked} onChange={event => setSelectedSids(current => {
                const selected = current ?? rows.map(item => item.sid)
                return event.target.checked ? [...selected, row.sid] : selected.filter(sid => sid !== row.sid)
              })} />
              <span style={{ width: 9, height: 9, borderRadius: 2, background: color, display: "inline-block" }} />
              {row.sid}
            </label>
          })}
        </div>
        <div style={{ width: "100%", height: 330 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 18, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="#e8edf3" strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#64748b" }} interval={0} />
              <YAxis domain={[0, 100]} tickFormatter={value => `${value}%`} tick={{ fontSize: 10, fill: "#64748b" }} width={44} />
              <Tooltip formatter={(value, name) => [`${value}%`, `SID ${name}`]} />
              {rows.filter(row => activeSids.includes(row.sid)).map(row => {
                const index = rows.findIndex(item => item.sid === row.sid)
                return <Line key={row.sid} type="monotone" dataKey={row.sid} name={row.sid} stroke={SID_LINE_COLORS[index % SID_LINE_COLORS.length]} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls={false} />
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{ overflowX: "auto", marginTop: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 760 }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ position: "sticky", left: 0, zIndex: 2, background: "#fff", textAlign: "left", padding: "9px 8px", borderBottom: "1px solid #dbe3ed" }}>SID</th>
              {weeks.map(week => <th key={week.key} colSpan={3} style={{ textAlign: "center", padding: "8px 4px", borderBottom: "1px solid #dbe3ed", borderLeft: "1px solid #e2e8f0", color: "#334155", whiteSpace: "nowrap" }}>{week.label}</th>)}
            </tr>
            <tr>
              {weeks.flatMap(week => ["Leads", "Booked", "Booked %"].map((heading, index) => <th key={week.key + heading} style={{ textAlign: "right", padding: "7px 8px", borderBottom: "1px solid #dbe3ed", borderLeft: index === 0 ? "1px solid #e2e8f0" : undefined, color: "#64748b", fontWeight: 500, whiteSpace: "nowrap" }}>{heading}</th>))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => <tr key={row.sid}>
              <td style={{ position: "sticky", left: 0, zIndex: 1, background: "#fff", padding: "9px 8px", borderBottom: "1px solid #edf1f5", fontWeight: 600, whiteSpace: "nowrap" }}>{row.sid}</td>
              {weeks.flatMap(week => {
                const stats = row.weeks[week.key]
                return [
                  { key: "leads", value: number(stats.leads) },
                  { key: "booked", value: number(stats.booked) },
                  { key: "bookedPct", value: percentage(stats.booked, stats.leads), lowBooked: stats.leads > 0 && (stats.booked / stats.leads) < 0.15 },
                ].map((item, index) => <td key={week.key + item.key} style={{ padding: "9px 8px", textAlign: "right", borderBottom: "1px solid #edf1f5", borderLeft: index === 0 ? "1px solid #e2e8f0" : undefined, color: item.lowBooked ? "#dc2626" : undefined, fontWeight: item.lowBooked ? 700 : 400 }}>{item.value}</td>)
              })}
            </tr>)}
            <tr style={{ background: "#f8fafc" }}>
              <td style={{ position: "sticky", left: 0, zIndex: 1, background: "#f8fafc", padding: "10px 8px", borderTop: "2px solid #cbd5e1", fontWeight: 700 }}>TOTAL</td>
              {weeks.flatMap(week => {
                const stats = totals[week.key]
                return [
                  { key: "leads", value: number(stats.leads) },
                  { key: "booked", value: number(stats.booked) },
                  { key: "bookedPct", value: percentage(stats.booked, stats.leads) },
                ].map((item, index) => <td key={week.key + "total" + item.key} style={{ padding: "10px 8px", textAlign: "right", borderTop: "2px solid #cbd5e1", borderLeft: index === 0 ? "1px solid #e2e8f0" : undefined, fontWeight: 700 }}>{item.value}</td>)
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p style={{ margin: "10px 0 0", color: "#94a3b8", fontSize: 10 }}>Booked counts a lead once if it has at least one linked appointment. Booked % is booked leads divided by leads received.</p>
    </>}
  </section>
}

export default ProntoSidWeeklyBreakdown

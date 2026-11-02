import React, { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"

const number = value => new Intl.NumberFormat("en-GB").format(Number(value || 0))

function getWeeks() {
  const today = new Date()
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const fmt = date => date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  return Array.from({ length: 4 }, (_, index) => {
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
  return { sid, leads: 0, booked: 0, p: 0 }
}

function ProntoWeeklyComparison() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const weeks = useMemo(getWeeks, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError("")
      try {
        const start = weeks[0].start.toISOString()
        const end = weeks[3].end.toISOString()
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
            .select("marketing_row_id,cps_p")
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
          if (related.some(appointment => appointment.cps_p === true)) stats.p += 1
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

  const totals = useMemo(() => Object.fromEntries(weeks.map(week => [week.key, rows.reduce((sum, row) => {
    const stats = row.weeks[week.key]
    sum.leads += stats.leads
    sum.booked += stats.booked
    sum.p += stats.p
    return sum
  }, emptyStats("TOTAL"))])), [rows, weeks])

  return <section style={{ background: "#fff", border: "1px solid #dbe3ed", borderRadius: 12, padding: 18, marginBottom: 22 }}>
    <div>
      <h2 style={{ margin: 0, fontSize: 18, color: "#172033" }}>Pronto SID weekly breakdown</h2>
      <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 12 }}>Lead, booked and P figures by SID, split into each of the last four complete weeks.</p>
    </div>
    {loading ? <p style={{ color: "#64748b", fontSize: 13 }}>Loading SID breakdown…</p> : error ? <p style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p> : <>
      <div style={{ overflowX: "auto", marginTop: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 760 }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ position: "sticky", left: 0, zIndex: 2, background: "#fff", textAlign: "left", padding: "9px 8px", borderBottom: "1px solid #dbe3ed" }}>SID</th>
              {weeks.map(week => <th key={week.key} colSpan={3} style={{ textAlign: "center", padding: "8px 4px", borderBottom: "1px solid #dbe3ed", borderLeft: "1px solid #e2e8f0", color: "#334155", whiteSpace: "nowrap" }}>{week.label}</th>)}
            </tr>
            <tr>
              {weeks.flatMap(week => ["Leads", "Booked", "P"].map((heading, index) => <th key={week.key + heading} style={{ textAlign: "right", padding: "7px 8px", borderBottom: "1px solid #dbe3ed", borderLeft: index === 0 ? "1px solid #e2e8f0" : undefined, color: "#64748b", fontWeight: 500 }}>{heading}</th>))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => <tr key={row.sid}>
              <td style={{ position: "sticky", left: 0, zIndex: 1, background: "#fff", padding: "9px 8px", borderBottom: "1px solid #edf1f5", fontWeight: 600, whiteSpace: "nowrap" }}>{row.sid}</td>
              {weeks.flatMap(week => {
                const stats = row.weeks[week.key]
                return ["leads", "booked", "p"].map((key, index) => <td key={week.key + key} style={{ padding: "9px 8px", textAlign: "right", borderBottom: "1px solid #edf1f5", borderLeft: index === 0 ? "1px solid #e2e8f0" : undefined }}>{number(stats[key])}</td>)
              })}
            </tr>)}
            <tr style={{ background: "#f8fafc" }}>
              <td style={{ position: "sticky", left: 0, zIndex: 1, background: "#f8fafc", padding: "10px 8px", borderTop: "2px solid #cbd5e1", fontWeight: 700 }}>TOTAL</td>
              {weeks.flatMap(week => ["leads", "booked", "p"].map((key, index) => <td key={week.key + "total" + key} style={{ padding: "10px 8px", textAlign: "right", borderTop: "2px solid #cbd5e1", borderLeft: index === 0 ? "1px solid #e2e8f0" : undefined, fontWeight: 700 }}>{number(totals[week.key][key])}</td>))}
            </tr>
          </tbody>
        </table>
      </div>
      <p style={{ margin: "10px 0 0", color: "#94a3b8", fontSize: 10 }}>Booked counts a lead once if it has at least one linked appointment. P counts a lead once if any linked appointment has CPS P marked true.</p>
    </>}
  </section>
}

export default ProntoWeeklyComparison

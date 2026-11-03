import React, { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw, FileSpreadsheet } from "lucide-react"
import * as XLSX from "xlsx-js-style"
import { supabase } from "../lib/supabase"

const PAGE_SIZE = 1000
const CHUNK_SIZE = 300
const money = value => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number(value || 0))
const number = value => new Intl.NumberFormat("en-GB").format(Number(value || 0))
const clean = value => String(value ?? "").trim().toLowerCase()
const truthy = value => ["true", "1", "yes", "y"].includes(clean(value))

function localDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function addDays(value, days) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + days)
  return localDate(date)
}

function dateRangeDefault() {
  const now = new Date()
  return { start: localDate(new Date(now.getFullYear(), now.getMonth(), 1)), end: localDate(now) }
}

function DataResults() {
  const defaults = useMemo(dateRangeDefault, [])
  const [startDate, setStartDate] = useState(defaults.start)
  const [endDate, setEndDate] = useState(defaults.end)
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({ deals: 0, net: 0, solid: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [exporting, setExporting] = useState(false)

  const loadData = useCallback(async () => {
    if (!supabase || !startDate || !endDate || startDate > endDate) {
      setError("Please select a valid date range.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const from = new Date(`${startDate}T00:00:00`).toISOString()
      const to = new Date(`${addDays(endDate, 1)}T00:00:00`).toISOString()
      const leads = []
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error: queryError } = await supabase.from("leads")
          .select("marketing_row_id,lead_source,disposition,archive_disposition,invalid,appointment_date_time,received_date_time")
          .gte("received_date_time", from).lt("received_date_time", to)
          .order("received_date_time", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1)
        if (queryError) throw queryError
        const batch = data || []
        leads.push(...batch)
        if (batch.length < PAGE_SIZE) break
      }

      const marketingIds = [...new Set(leads.map(lead => lead.marketing_row_id).filter(Boolean))]
      const appointments = []
      for (let offset = 0; offset < marketingIds.length; offset += CHUNK_SIZE) {
        const ids = marketingIds.slice(offset, offset + CHUNK_SIZE)
        const { data, error: appointmentError } = await supabase.from("appointments")
          .select("appointment_row_id,marketing_row_id,cps_h,cps_c,cps_p,cps_s")
          .in("marketing_row_id", ids)
        if (appointmentError) throw appointmentError
        appointments.push(...(data || []))
      }

      const appointmentIds = [...new Set(appointments.map(item => item.appointment_row_id).filter(Boolean))]
      const deals = []
      for (let offset = 0; offset < appointmentIds.length; offset += CHUNK_SIZE) {
        const ids = appointmentIds.slice(offset, offset + CHUNK_SIZE)
        const { data, error: dealError } = await supabase.from("deals")
          .select("id,appointment_row_id,net_value,pipedrive_stage")
          .in("appointment_row_id", ids)
        if (dealError) throw dealError
        deals.push(...(data || []))
      }

      const appointmentsByLead = new Map()
      appointments.forEach(item => {
        if (!appointmentsByLead.has(item.marketing_row_id)) appointmentsByLead.set(item.marketing_row_id, [])
        appointmentsByLead.get(item.marketing_row_id).push(item)
      })
      const dealsByAppointment = new Map()
      deals.forEach(item => {
        if (!dealsByAppointment.has(item.appointment_row_id)) dealsByAppointment.set(item.appointment_row_id, [])
        dealsByAppointment.get(item.appointment_row_id).push(item)
      })

      const grouped = new Map()
      leads.forEach(lead => {
        const source = String(lead.lead_source || "").trim() || "(No lead source)"
        if (!grouped.has(source)) grouped.set(source, {
          source, leads: 0, dup: 0, wn: 0, ooa: 0, inv: 0, booked: 0,
          callback: 0, noContact: 0, archivedNoContact: 0, h: 0, c: 0, p: 0, s: 0,
          net: 0, solid: 0, dealIds: new Set(),
        })
        const row = grouped.get(source)
        row.leads += 1
        const disposition = clean(lead.disposition)
        if (disposition === "duplicate") row.dup += 1
        if (disposition === "wrong number") row.wn += 1
        if (disposition === "out of area") row.ooa += 1
        const invalidReason = clean(lead.invalid)\n        if (invalidReason && !["duplicate", "wrong number", "out of area"].includes(invalidReason)) row.inv += 1
        if (lead.appointment_date_time || (appointmentsByLead.get(lead.marketing_row_id) || []).length) row.booked += 1
        if (disposition.startsWith("call back")) row.callback += 1
        if (disposition === "no contact") row.noContact += 1
        if (clean(lead.archive_disposition) === "no contact") row.archivedNoContact += 1

        const linkedAppointments = appointmentsByLead.get(lead.marketing_row_id) || []
        const flags = ["h", "c", "p", "s"].map(flag => linkedAppointments.some(item => item[`cps_${flag}`] === true))
        if (flags[0]) row.h += 1
        if (flags[1]) row.c += 1
        if (flags[2]) row.p += 1
        if (flags[3]) row.s += 1
        linkedAppointments.forEach(appointment => {
          ;(dealsByAppointment.get(appointment.appointment_row_id) || []).forEach(deal => {
            if (appointment.cps_s === true && !row.dealIds.has(deal.id)) {
              row.dealIds.add(deal.id)
              row.net += Number(deal.net_value || 0)
            }
            const stage = clean(deal.pipedrive_stage)
            if (stage !== "customer cancelled" && stage !== "decline" && !row._solidDealIds?.has(deal.id)) {
              if (!row._solidDealIds) row._solidDealIds = new Set()
              row._solidDealIds.add(deal.id)
              row.solid += Number(deal.net_value || 0)
            }
          })
        })
      })

      const result = [...grouped.values()].map(row => ({
        ...row,
        total: row.dup + row.wn + row.ooa + row.inv,
        netLeads: row.leads - row.dup - row.wn - row.ooa - row.inv,
        deals: row.dealIds.size,
      })).sort((a, b) => b.leads - a.leads || a.source.localeCompare(b.source))
      const allDealIds = new Set(deals.map(deal => deal.id))
      const netSold = result.reduce((sum, row) => sum + row.net, 0)
      const solid = result.reduce((sum, row) => sum + row.solid, 0)
      setRows(result)
      setSummary({ deals: allDealIds.size, net: netSold, solid })
    } catch (err) {
      console.error("Error loading Data Results:", err)
      setError(err?.message || "Unable to load Data Results.")
      setRows([])
      setSummary({ deals: 0, net: 0, solid: 0 })
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => { loadData() }, [loadData])

  const totals = useMemo(() => rows.reduce((sum, row) => {
    ;["leads", "dup", "wn", "ooa", "inv", "total", "netLeads", "booked", "callback", "noContact", "archivedNoContact", "h", "c", "p", "s", "net", "solid"].forEach(key => { sum[key] = (sum[key] || 0) + Number(row[key] || 0) })
    return sum
  }, {}), [rows])

  function exportExcel() {
    setExporting(true)
    try {
      const exportRows = rows.map(row => ({
        "Lead Source": row.source, Leads: row.leads, Dup: row.dup, WN: row.wn, OOA: row.ooa, INV: row.inv,
        Total: row.total, Net: row.netLeads, Booked: row.booked, "Call Back": row.callback, NC: row.noContact,
        "A NC": row.archivedNoContact, H: row.h, C: row.c, P: row.p, S: row.s, Net: row.net, Solid: row.solid,
      }))
      exportRows.push({
        "Lead Source": "TOTAL", Leads: totals.leads || 0, Dup: totals.dup || 0, WN: totals.wn || 0, OOA: totals.ooa || 0,
        INV: totals.inv || 0, Total: totals.total || 0, "Net Leads": totals.netLeads || 0, Booked: totals.booked || 0,
        "Call Back": totals.callback || 0, NC: totals.noContact || 0, "A NC": totals.archivedNoContact || 0,
        H: totals.h || 0, C: totals.c || 0, P: totals.p || 0, S: totals.s || 0, "Net Value": totals.net || 0, Solid: totals.solid || 0,
      })
      const sheet = XLSX.utils.json_to_sheet(exportRows)
      sheet["!cols"] = Object.keys(exportRows[0] || {}).map(key => ({ wch: Math.max(12, key.length + 3) }))
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, "Data Results")
      XLSX.writeFile(workbook, `data-results-${startDate}-to-${endDate}.xlsx`)
    } finally { setExporting(false) }
  }

  const th = { padding: "9px 8px", fontSize: 11, fontWeight: 600, color: "#64748b", textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid #dbe2ea", background: "#f8fafc", position: "sticky", top: 0, zIndex: 1 }
  const td = { padding: "8px", fontSize: 11, color: "#172033", whiteSpace: "nowrap", borderBottom: "1px solid #e8edf3" }
  const card = { background: "#fff", border: "1px solid #e1e7ee", borderRadius: 10, padding: "12px 15px", minWidth: 0 }

  return <div style={{ background: "#f5f7fa", minHeight: "calc(100vh - 60px)", margin: "-24px -32px", color: "#172033" }}>
    <section style={{ background: "#062b45", color: "#fff", padding: "24px 28px 20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(260px, 34%)", alignItems: "start", gap: 24 }}>
        <h1 style={{ margin: "18px 0 0", fontSize: 42, fontWeight: 700, textAlign: "center" }}>Data Results</h1>
        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 11, fontWeight: 600 }}>Start Date<input type="date" value={startDate} max={endDate} onChange={event => setStartDate(event.target.value)} style={{ padding: "9px 10px", borderRadius: 7, border: "1px solid #49657a", background: "#36566d", color: "#fff", colorScheme: "dark" }}/></label>
          <label style={{ display: "grid", gap: 6, fontSize: 11, fontWeight: 600 }}>End Date<input type="date" value={endDate} min={startDate} onChange={event => setEndDate(event.target.value)} style={{ padding: "9px 10px", borderRadius: 7, border: "1px solid #49657a", background: "#36566d", color: "#fff", colorScheme: "dark" }}/></label>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14, marginTop: 28 }}>
        <div style={card}><div style={{ color: "#7b8794", fontSize: 11 }}>Deals</div><div style={{ fontSize: 21, fontWeight: 650 }}>{loading ? "—" : number(summary.deals)}</div></div>
        <div style={card}><div style={{ color: "#7b8794", fontSize: 11 }}>Net Sold</div><div style={{ fontSize: 21, fontWeight: 650 }}>{loading ? "—" : money(summary.net)}</div></div>
        <div style={card}><div style={{ color: "#7b8794", fontSize: 11 }}>Solid</div><div style={{ fontSize: 21, fontWeight: 650 }}>{loading ? "—" : money(summary.solid)}</div></div>
        <div style={card}><div style={{ color: "#7b8794", fontSize: 11 }}>Drop Off</div><div style={{ fontSize: 21, fontWeight: 650 }}>{loading || !summary.net ? "—" : `${Math.max(0, (summary.net - summary.solid) / summary.net * 100).toFixed(1)}%`}</div></div>
      </div>
    </section>
    <section style={{ padding: "14px 22px 24px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <button type="button" onClick={loadData} disabled={loading} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid #d5dee8", borderRadius: 7, padding: "8px 12px", background: "#fff", color: "#334155", cursor: "pointer" }}><RefreshCw size={14}/>Refresh</button>
        <button type="button" onClick={exportExcel} disabled={loading || exporting || !rows.length} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid #d5dee8", borderRadius: 7, padding: "8px 12px", background: "#fff", color: "#334155", cursor: "pointer" }}><FileSpreadsheet size={14}/>{exporting ? "Exporting…" : "Export Excel"}</button>
      </div>
      {error && <div style={{ padding: 12, marginBottom: 10, borderRadius: 8, background: "#fff1f2", color: "#be123c", fontSize: 12 }}>{error}</div>}
      <div style={{ overflow: "auto", maxHeight: "calc(100vh - 320px)", background: "#fff", border: "1px solid #e2e8f0" }}>
        <table style={{ width: "100%", minWidth: 1250, borderCollapse: "separate", borderSpacing: 0 }}>
          <thead><tr>{["Lead Source", "Leads", "Dup", "WN", "OOA", "INV", "Total", "Net", "Booked", "Call Back", "NC", "A NC", "H", "C", "P", "S", "Net", "Solid"].map((heading, index) => <th key={heading + index} style={th}>{heading}</th>)}</tr></thead>
          <tbody>
            {rows.map(row => <tr key={row.source}>
              <td style={{ ...td, fontWeight: 650, position: "sticky", left: 0, background: "#fff", zIndex: 0 }}>{row.source}</td>
              {[row.leads, row.dup, row.wn, row.ooa, row.inv, row.total, row.netLeads, row.booked, row.callback, row.noContact, row.archivedNoContact, row.h, row.c, row.p, row.s].map((value, index) => <td key={index} style={{ ...td, textAlign: "right" }}>{number(value)}</td>)}
              <td style={{ ...td, textAlign: "right" }}>{money(row.net)}</td><td style={{ ...td, textAlign: "right" }}>{money(row.solid)}</td>
            </tr>)}
            {!loading && !rows.length && <tr><td colSpan={18} style={{ ...td, textAlign: "center", padding: 24, color: "#64748b" }}>No leads found in this date range.</td></tr>}
            <tr style={{ background: "#f8fafc" }}>
              <td style={{ ...td, fontWeight: 750, position: "sticky", left: 0, background: "#f8fafc" }}>TOTAL</td>
              {[totals.leads, totals.dup, totals.wn, totals.ooa, totals.inv, totals.total, totals.netLeads, totals.booked, totals.callback, totals.noContact, totals.archivedNoContact, totals.h, totals.c, totals.p, totals.s].map((value, index) => <td key={index} style={{ ...td, textAlign: "right", fontWeight: 750 }}>{number(value)}</td>)}
              <td style={{ ...td, textAlign: "right", fontWeight: 750 }}>{money(totals.net)}</td><td style={{ ...td, textAlign: "right", fontWeight: 750 }}>{money(totals.solid)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 10 }}>Leads are grouped by lead source using received date. H/C/P/S count each lead once if any linked appointment has that CPS flag. Net Sold includes deals linked to CPS S appointments; Solid excludes Customer Cancelled and Decline stages.</p>
    </section>
  </div>
}

export default DataResults

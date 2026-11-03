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
  return getPresetRange("last-week")
}

function getPresetRange(preset) {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const day = today.getDay()
  const thisMonday = new Date(today)
  thisMonday.setDate(today.getDate() - ((day + 6) % 7))
  const lastSunday = new Date(thisMonday)
  lastSunday.setDate(thisMonday.getDate() - 1)
  const lastMonday = new Date(lastSunday)
  lastMonday.setDate(lastSunday.getDate() - 6)

  if (preset === "last-week") return { start: localDate(lastMonday), end: localDate(lastSunday) }
  if (preset === "last-4-weeks") {
    const start = new Date(lastMonday)
    start.setDate(lastMonday.getDate() - 21)
    return { start: localDate(start), end: localDate(lastSunday) }
  }
  if (preset === "last-12-weeks") {
    const start = new Date(lastMonday)
    start.setDate(lastMonday.getDate() - 77)
    return { start: localDate(start), end: localDate(lastSunday) }
  }
  if (preset === "this-month") return { start: localDate(new Date(today.getFullYear(), today.getMonth(), 1)), end: localDate(today) }
  if (preset === "last-month") return { start: localDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)), end: localDate(new Date(today.getFullYear(), today.getMonth(), 0)) }
  if (preset === "ytd") return { start: localDate(new Date(today.getFullYear(), 0, 1)), end: localDate(today) }
  return { start: localDate(today), end: localDate(today) }
}

function DataResults() {
  const defaults = useMemo(dateRangeDefault, [])
  const [startDate, setStartDate] = useState(defaults.start)
  const [endDate, setEndDate] = useState(defaults.end)
  const [activePreset, setActivePreset] = useState("last-week")
  const [rows, setRows] = useState([])
  const [dealDetails, setDealDetails] = useState([])
  const [summary, setSummary] = useState({ deals: 0, net: 0, solid: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [exporting, setExporting] = useState(false)

  const applyPreset = preset => {
    const range = getPresetRange(preset)
    setActivePreset(preset)
    setStartDate(range.start)
    setEndDate(range.end)
  }

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
      // Query 1: leads received during the selected period. These figures describe
      // the lead cohort and are not affected by when its appointments took place.
      const leads = []
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error: queryError } = await supabase.from("leads")
          .select("marketing_row_id,lead_source,disposition,archive_disposition,invalid")
          .gte("received_date_time", from).lt("received_date_time", to)
          .order("received_date_time", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1)
        if (queryError) throw queryError
        const batch = data || []
        leads.push(...batch)
        if (batch.length < PAGE_SIZE) break
      }

      const grouped = new Map()
      const getRow = source => {
        const key = String(source || "").trim() || "(No lead source)"
        if (!grouped.has(key)) grouped.set(key, {
          source: key, leads: 0, dup: 0, wn: 0, ooa: 0, inv: 0,
          total: 0, netLeads: 0, callback: 0, noContact: 0, archivedNoContact: 0,
          appointments: 0, h: 0, c: 0, p: 0, s: 0,
          net: 0, solid: 0, dealIds: new Set(), solidDealIds: new Set(),
        })
        return grouped.get(key)
      }

      leads.forEach(lead => {
        const row = getRow(lead.lead_source)
        row.leads += 1
        const disposition = clean(lead.disposition)
        if (disposition === "duplicate") row.dup += 1
        if (disposition === "wrong number") row.wn += 1
        if (disposition === "out of area") row.ooa += 1
        const invalidReason = clean(lead.invalid)
        if (invalidReason && !["duplicate", "wrong number", "out of area"].includes(invalidReason)) row.inv += 1
        if (disposition.startsWith("call back")) row.callback += 1
        if (disposition === "no contact") row.noContact += 1
        if (clean(lead.archive_disposition) === "no contact") row.archivedNoContact += 1
      })

      // Query 2: appointments whose appointment date falls in the selected period.
      // HCPS and their linked deals are calculated from this separate appointment cohort.
      const appointments = []
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error: appointmentError } = await supabase.from("appointments")
          .select("appointment_row_id,marketing_row_id,lead_source,appointment_date,cps_h,cps_c,cps_p,cps_s")
          .gte("appointment_date", from).lt("appointment_date", to)
          .order("appointment_date", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1)
        if (appointmentError) throw appointmentError
        const batch = data || []
        appointments.push(...batch)
        if (batch.length < PAGE_SIZE) break
      }

      const appointmentMarketingIds = [...new Set(appointments.map(item => item.marketing_row_id).filter(Boolean))]
      const linkedLeadSources = new Map()
      for (let offset = 0; offset < appointmentMarketingIds.length; offset += CHUNK_SIZE) {
        const ids = appointmentMarketingIds.slice(offset, offset + CHUNK_SIZE)
        const { data, error: linkedLeadError } = await supabase.from("leads")
          .select("marketing_row_id,lead_source")
          .in("marketing_row_id", ids)
        if (linkedLeadError) throw linkedLeadError
        ;(data || []).forEach(lead => {
          if (!linkedLeadSources.has(lead.marketing_row_id)) linkedLeadSources.set(lead.marketing_row_id, lead.lead_source)
        })
      }

      const appointmentIds = [...new Set(appointments.map(item => item.appointment_row_id).filter(Boolean))]
      const deals = []
      for (let offset = 0; offset < appointmentIds.length; offset += CHUNK_SIZE) {
        const ids = appointmentIds.slice(offset, offset + CHUNK_SIZE)
        const { data, error: dealError } = await supabase.from("deals")
          .select("id,appointment_row_id,deal_value,net_value,pipedrive_stage")
          .in("appointment_row_id", ids)
        if (dealError) throw dealError
        deals.push(...(data || []))
      }

      // Exclude appointments from all appointment KPIs and deal totals when
      // their linked deal has a zero deal_value.
      const zeroValueAppointmentIds = new Set(
        deals.filter(deal => Number(deal.deal_value) === 0).map(deal => deal.appointment_row_id)
      )
      const includedAppointments = appointments.filter(
        appointment => !zeroValueAppointmentIds.has(appointment.appointment_row_id)
      )
      const includedAppointmentIds = new Set(includedAppointments.map(item => item.appointment_row_id))

      const dealsByAppointment = new Map()
      deals.filter(deal => includedAppointmentIds.has(deal.appointment_row_id)).forEach(deal => {
        if (!dealsByAppointment.has(deal.appointment_row_id)) dealsByAppointment.set(deal.appointment_row_id, [])
        dealsByAppointment.get(deal.appointment_row_id).push(deal)
      })

      const dealDetailsById = new Map()
      includedAppointments.forEach(appointment => {
        const source = linkedLeadSources.get(appointment.marketing_row_id) || appointment.lead_source || "(No lead source)"
        const row = getRow(source)
        row.appointments += 1
        if (appointment.cps_h === true) row.h += 1
        if (appointment.cps_c === true) row.c += 1
        if (appointment.cps_p === true) row.p += 1
        if (appointment.cps_s === true) row.s += 1
        ;(dealsByAppointment.get(appointment.appointment_row_id) || []).forEach(deal => {
          if (!dealDetailsById.has(deal.id)) dealDetailsById.set(deal.id, {
            id: deal.id, appointmentRowId: appointment.appointment_row_id,
            appointmentDate: appointment.appointment_date, source,
            h: appointment.cps_h === true, c: appointment.cps_c === true,
            p: appointment.cps_p === true, s: appointment.cps_s === true,
            net: Number(deal.net_value || 0), stage: deal.pipedrive_stage || "",
          })
          if (!row.dealIds.has(deal.id)) {
            row.dealIds.add(deal.id)
            row.net += Number(deal.net_value || 0)
          }
          const stage = clean(deal.pipedrive_stage)
          if (!["customer cancelled", "decline", "pending cancellation", "cancellation - awaiting refund"].includes(stage) && !row.solidDealIds.has(deal.id)) {
            row.solidDealIds.add(deal.id)
            row.solid += Number(deal.net_value || 0)
          }
        })
      })

      grouped.forEach(row => {
        row.total = row.dup + row.wn + row.ooa + row.inv
        row.netLeads = row.leads - row.total
      })
      const result = [...grouped.values()].map(row => ({
        ...row,
        total: row.dup + row.wn + row.ooa + row.inv,
        netLeads: row.leads - row.dup - row.wn - row.ooa - row.inv,
        deals: row.dealIds.size,
      })).sort((a, b) => b.net - a.net || b.leads - a.leads || a.source.localeCompare(b.source))
      const netSold = result.reduce((sum, row) => sum + row.net, 0)
      const soldDeals = result.reduce((sum, row) => sum + row.dealIds.size, 0)
      const solid = result.reduce((sum, row) => sum + row.solid, 0)
      setRows(result)
      setDealDetails([...dealDetailsById.values()].sort((a, b) => String(b.appointmentDate || "").localeCompare(String(a.appointmentDate || "")) || String(a.id).localeCompare(String(b.id))))
      setSummary({ deals: soldDeals, net: netSold, solid })
    } catch (err) {
      console.error("Error loading Data Results:", err)
      setError(err?.message || "Unable to load Data Results.")
      setRows([])
      setDealDetails([])
      setSummary({ deals: 0, net: 0, solid: 0 })
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => { loadData() }, [loadData])

  const totals = useMemo(() => rows.reduce((sum, row) => {
    ;["leads", "dup", "wn", "ooa", "inv", "total", "netLeads", "callback", "noContact", "archivedNoContact", "appointments", "h", "c", "p", "s", "net", "solid"].forEach(key => { sum[key] = (sum[key] || 0) + Number(row[key] || 0) })
    return sum
  }, {}), [rows])

  function exportExcel() {
    setExporting(true)
    try {
      const exportRows = rows.map(row => ({
        "Lead Sources": row.source, Leads: row.leads, Dup: row.dup, WN: row.wn, OOA: row.ooa, INV: row.inv,
        Total: row.total, Net: row.netLeads, Appointments: row.appointments, "Call Back": row.callback, NC: row.noContact, H: row.h, C: row.c, P: row.p, S: row.s, Net: row.net, Solid: row.solid,
      }))
      exportRows.push({
        "Lead Sources": "TOTAL", Leads: totals.leads || 0, Dup: totals.dup || 0, WN: totals.wn || 0, OOA: totals.ooa || 0,
        INV: totals.inv || 0, Total: totals.total || 0, "Net Leads": totals.netLeads || 0, Appointments: totals.appointments || 0,
        "Call Back": totals.callback || 0, NC: totals.noContact || 0,
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
  const card = { background: "#fff", color: "#172033", border: "1px solid #e1e7ee", borderRadius: 12, padding: "15px 18px", minWidth: 0, boxShadow: "0 2px 8px rgba(15, 35, 55, 0.08)" }

  return <div style={{ background: "#f5f7fa", minHeight: "calc(100vh - 60px)", margin: "-24px -32px", color: "#172033" }}>
    <section style={{ background: "linear-gradient(115deg, #062b45 0%, #0b3a59 100%)", color: "#fff", padding: "24px 28px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
        <div style={{ minWidth: 220 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.14em", fontWeight: 700, color: "#9db7c9", textTransform: "uppercase", marginBottom: 7 }}>Digital Team · Reporting</div>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.15, fontWeight: 750 }}>Data Results</h1>
          <p style={{ margin: "7px 0 0", fontSize: 12, color: "#c3d4e0" }}>Lead source performance and sales outcomes</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(190px, 1fr))", gap: 12, flex: "0 1 470px" }}>
          <label style={{ display: "grid", gap: 6, fontSize: 11, fontWeight: 650, color: "#d7e4ed" }}>START DATE<input type="date" value={startDate} max={endDate} onChange={event => setStartDate(event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "10px 11px", borderRadius: 8, border: "1px solid #496a80", background: "#244a64", color: "#fff", colorScheme: "dark", fontSize: 13 }}/></label>
          <label style={{ display: "grid", gap: 6, fontSize: 11, fontWeight: 650, color: "#d7e4ed" }}>END DATE<input type="date" value={endDate} min={startDate} onChange={event => setEndDate(event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "10px 11px", borderRadius: 8, border: "1px solid #496a80", background: "#244a64", color: "#fff", colorScheme: "dark", fontSize: 13 }}/></label>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#a9c0d0", letterSpacing: "0.06em", marginRight: 3 }}>QUICK RANGES</span>
        {[
          ["last-week", "Last week"],
          ["last-4-weeks", "Last 4 weeks"],
          ["last-12-weeks", "Last 12 weeks"],
          ["this-month", "This month"],
          ["last-month", "Last month"],
          ["ytd", "YTD"],
        ].map(([key, label]) => <button key={key} type="button" onClick={() => applyPreset(key)} style={{ border: activePreset === key ? "1px solid #d9e9f3" : "1px solid #496a80", borderRadius: 7, padding: "6px 11px", background: activePreset === key ? "#e7f0f6" : "rgba(255,255,255,0.08)", color: activePreset === key ? "#12344b" : "#e4edf3", fontSize: 11, fontWeight: activePreset === key ? 700 : 500, cursor: "pointer" }}>{label}</button>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14, marginTop: 20 }}>
        {[
          { label: "Deals", value: loading ? "—" : number(summary.deals), detail: "Sold deals in period" },
          { label: "Net Sold", value: loading ? "—" : money(summary.net), detail: "Net value of sold deals" },
          { label: "Solid", value: loading ? "—" : money(summary.solid), detail: "Value excluding cancellations" },
          { label: "Drop Off", value: loading || !summary.net ? "—" : `${Math.max(0, (summary.net - summary.solid) / summary.net * 100).toFixed(1)}%`, detail: "Net value lost before solid" },
        ].map(item => <div key={item.label} style={card}>
          <div style={{ fontSize: 11, fontWeight: 650, color: "#64748b", marginBottom: 7 }}>{item.label}</div>
          <div style={{ fontSize: 25, lineHeight: 1.15, fontWeight: 750, letterSpacing: "-0.025em", color: "#102a43" }}>{item.value}</div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>{item.detail}</div>
        </div>)}
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
          <thead>
            <tr>
              <th rowSpan={2} style={{ ...th, verticalAlign: "middle", minWidth: 150, textAlign: "left" }}>Lead Sources</th>
              <th colSpan={9} style={{ ...th, textAlign: "center", borderBottom: "1px solid #cbd5e1" }}>Leads</th>
              <th colSpan={7} style={{ ...th, textAlign: "center", borderBottom: "1px solid #cbd5e1", borderLeft: "2px solid #cbd5e1" }}>Appointments</th>
            </tr>
            <tr>
              {["Leads", "Dup", "WN", "OOA", "INV", "Total", "Net leads", "Call Back", "NC"].map(heading => <th key={heading} style={{ ...th, textAlign: "center" }}>{heading}</th>)}
              {["Appointments", "H", "C", "P", "S", "Net", "Solid"].map((heading, index) => <th key={heading} style={{ ...th, textAlign: "center", ...(index === 0 ? { borderLeft: "2px solid #cbd5e1" } : {}) }}>{heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => <tr key={row.source}>
              <td style={{ ...td, fontWeight: 650, position: "sticky", left: 0, background: "#fff", zIndex: 0, textAlign: "left" }}>{row.source}</td>
              {[row.leads, row.dup, row.wn, row.ooa, row.inv, row.total, row.netLeads, row.callback, row.noContact].map((value, index) => <td key={index} style={{ ...td, textAlign: "center" }}>{number(value)}</td>)}
              {[row.appointments, row.h, row.c, row.p, row.s].map((value, index) => <td key={`appointment-${index}`} style={{ ...td, textAlign: "right", ...(index === 0 ? { borderLeft: "2px solid #cbd5e1" } : {}) }}>{number(value)}</td>)}
              <td style={{ ...td, textAlign: "right" }}>{money(row.net)}</td><td style={{ ...td, textAlign: "right" }}>{money(row.solid)}</td>
            </tr>)}
            {!loading && !rows.length && <tr><td colSpan={17} style={{ ...td, textAlign: "center", padding: 24, color: "#64748b" }}>No leads found in this date range.</td></tr>}
            <tr style={{ background: "#f8fafc" }}>
              <td style={{ ...td, fontWeight: 750, position: "sticky", left: 0, background: "#f8fafc" }}>TOTAL</td>
              {[totals.leads, totals.dup, totals.wn, totals.ooa, totals.inv, totals.total, totals.netLeads, totals.callback, totals.noContact].map((value, index) => <td key={index} style={{ ...td, textAlign: "right", fontWeight: 750 }}>{number(value)}</td>)}
              {[totals.appointments, totals.h, totals.c, totals.p, totals.s].map((value, index) => <td key={`total-appointment-${index}`} style={{ ...td, textAlign: "right", fontWeight: 750, ...(index === 0 ? { borderLeft: "2px solid #cbd5e1" } : {}) }}>{number(value)}</td>)}
              <td style={{ ...td, textAlign: "right", fontWeight: 750 }}>{money(totals.net)}</td><td style={{ ...td, textAlign: "right", fontWeight: 750 }}>{money(totals.solid)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 10 }}>Lead outcomes are grouped by lead source using lead received date. Appointments, H/C/P/S and linked deal values are grouped separately using appointment date. Each linked deal is counted once per lead source; Solid excludes Customer Cancelled and Decline stages.</p>
      <div style={{ marginTop: 22, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "13px 15px", borderBottom: "1px solid #e2e8f0", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, color: "#17324a" }}>Linked deals included in report</h2>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>Deals linked to appointments dated within the selected period.</p>
          </div>
          <strong style={{ fontSize: 13, color: "#17324a" }}>{loading ? "Loading…" : number(dealDetails.length) + " deals"}</strong>
        </div>
        <div style={{ overflowX: "auto", maxHeight: 420 }}>
          <table style={{ width: "100%", minWidth: 900, borderCollapse: "separate", borderSpacing: 0 }}>
            <thead><tr>
              {["Deal ID", "Lead source", "Appointment date", "Appointment ID", "H", "C", "P", "S", "Net value", "Pipedrive stage"].map(label => <th key={label} style={th}>{label}</th>)}
            </tr></thead>
            <tbody>
              {dealDetails.map(deal => <tr key={deal.id}>
                <td style={td}>{deal.id}</td><td style={td}>{deal.source}</td><td style={td}>{deal.appointmentDate ? new Date(deal.appointmentDate).toLocaleDateString("en-GB") : "—"}</td>
                <td style={td}>{deal.appointmentRowId || "—"}</td>
                {[deal.h, deal.c, deal.p, deal.s].map((value, index) => <td key={index} style={{ ...td, textAlign: "center" }}>{value ? "✓" : "—"}</td>)}
                <td style={{ ...td, textAlign: "right", fontWeight: 650 }}>{money(deal.net)}</td><td style={td}>{deal.stage || "—"}</td>
              </tr>)}
              {!loading && !dealDetails.length && <tr><td colSpan={10} style={{ ...td, textAlign: "center", padding: 22, color: "#64748b" }}>No linked deals found for appointments in this date range.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
}

export default DataResults

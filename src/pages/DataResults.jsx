import React, { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw, FileSpreadsheet } from "lucide-react"
import * as XLSX from "xlsx-js-style"
import { supabase } from "../lib/supabase"

const PAGE_SIZE = 1000
const CHUNK_SIZE = 300
const money = value => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number(value || 0))
const money2 = value => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0))
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
  if (preset === "ytd") return { start: localDate(new Date(today.getFullYear(), 0, 1)), end: localDate(lastSunday) }
  return { start: localDate(today), end: localDate(today) }
}

function DataResults({ sourceFilter = null, reportTitle = "Data Results", embedded = false } = {}) {
  const defaults = useMemo(dateRangeDefault, [])
  const [startDate, setStartDate] = useState(defaults.start)
  const [endDate, setEndDate] = useState(defaults.end)
  const [activePreset, setActivePreset] = useState("last-week")
  const [rows, setRows] = useState([])
  const [dealDetails, setDealDetails] = useState([])
  const [dealSourceFilter, setDealSourceFilter] = useState("All")
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
        let leadQuery = supabase.from("leads")
          .select("marketing_row_id,lead_source,disposition,archive_disposition,invalid,lead_cost")
          .gte("received_date_time", from).lt("received_date_time", to)
          .order("received_date_time", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1)
        if (sourceFilter) leadQuery = Array.isArray(sourceFilter) ? leadQuery.in("lead_source", sourceFilter) : leadQuery.eq("lead_source", sourceFilter)
        const { data, error: queryError } = await leadQuery
        if (queryError) throw queryError
        const batch = data || []
        leads.push(...batch)
        if (batch.length < PAGE_SIZE) break
      }

      const grouped = new Map()
      const getRow = source => {
        const key = String(source || "").trim() || "(No lead source)"
        if (!grouped.has(key)) grouped.set(key, {
          source: key, spend: 0, leads: 0, missingSpend: 0, dup: 0, wn: 0, ooa: 0, inv: 0,
          total: 0, netLeads: 0, callback: 0, noContact: 0, archivedNoContact: 0,
          appointments: 0, h: 0, c: 0, p: 0, s: 0,
          net: 0, solid: 0, dealIds: new Set(), solidDealIds: new Set(),
        })
        return grouped.get(key)
      }

      leads.forEach(lead => {
        const row = getRow(lead.lead_source)
        row.leads += 1
        row.spend += Number(lead.lead_cost || 0)
        if (lead.lead_cost == null || Number(lead.lead_cost) <= 0) row.missingSpend += 1
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

      // Appointment rate is based on the selected lead cohort: count each lead once
      // if it has at least one linked appointment with an appointment date, regardless
      // of whether that appointment date falls inside the lead received-date period.
      const leadMarketingIds = [...new Set(leads.map(lead => lead.marketing_row_id).filter(Boolean))]
      const leadsWithAppointmentDate = new Set()
      for (let offset = 0; offset < leadMarketingIds.length; offset += CHUNK_SIZE) {
        const ids = leadMarketingIds.slice(offset, offset + CHUNK_SIZE)
        const { data, error: rateError } = await supabase.from("appointments")
          .select("marketing_row_id")
          .in("marketing_row_id", ids)
          .not("appointment_date", "is", null)
        if (rateError) throw rateError
        ;(data || []).forEach(item => {
          if (item.marketing_row_id) leadsWithAppointmentDate.add(item.marketing_row_id)
        })
      }
      const appointmentRate = leads.length ? leadsWithAppointmentDate.size / leads.length * 100 : 0

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

      const reportAppointments = sourceFilter
        ? appointments.filter(item => Array.isArray(sourceFilter)
          ? sourceFilter.some(source => clean(item.lead_source || linkedLeadSources.get(item.marketing_row_id)) === clean(source))
          : clean(item.lead_source || linkedLeadSources.get(item.marketing_row_id)) === clean(sourceFilter))
        : appointments
      const appointmentIds = [...new Set(reportAppointments.map(item => item.appointment_row_id).filter(Boolean))]
      const deals = []
      for (let offset = 0; offset < appointmentIds.length; offset += CHUNK_SIZE) {
        const ids = appointmentIds.slice(offset, offset + CHUNK_SIZE)
        const { data, error: dealError } = await supabase.from("deals")
          .select("id,appointment_row_id,customer_name,contract_number,deal_value,net_value,pipedrive_stage")
          .in("appointment_row_id", ids)
        if (dealError) throw dealError
        deals.push(...(data || []))
      }

      // Exclude appointments from all appointment KPIs and deal totals when
      // their linked deal has a zero deal_value.
      const zeroValueAppointmentIds = new Set(
        deals.filter(deal => Number(deal.deal_value) === 0).map(deal => deal.appointment_row_id)
      )
      const includedAppointments = reportAppointments.filter(
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
        const source = appointment.lead_source || linkedLeadSources.get(appointment.marketing_row_id) || "(No lead source)"
        const row = getRow(source)
        row.appointments += 1
        if (appointment.cps_h === true) row.h += 1
        if (appointment.cps_c === true) row.c += 1
        if (appointment.cps_p === true) row.p += 1
        if (appointment.cps_s === true) row.s += 1
        ;(dealsByAppointment.get(appointment.appointment_row_id) || []).forEach(deal => {
          if (!dealDetailsById.has(deal.id)) dealDetailsById.set(deal.id, {
            id: deal.id, customerName: deal.customer_name || "", contractNumber: deal.contract_number || "", appointmentRowId: appointment.appointment_row_id,
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
          if (!["customer cancelled", "decline", "pending cancellation", "cancellation - awaiting refund", "on hold", "returned to sales", "awaiting funds"].includes(stage) && !row.solidDealIds.has(deal.id)) {
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
      const sourceBreakdown = (sourceFilter ? (Array.isArray(sourceFilter) ? sourceFilter : [sourceFilter]) : [])
        .reduce((acc, source) => {
          const sourceRows = result.filter(row => clean(row.source) === clean(source))
          const sourceLeads = leads.filter(lead => clean(lead.lead_source) === clean(source))
          const sourceWithAppointments = new Set(sourceLeads.map(lead => lead.marketing_row_id).filter(id => leadsWithAppointmentDate.has(id)))
          const sourceNet = sourceRows.reduce((sum, row) => sum + row.net, 0)
          const sourceSolid = sourceRows.reduce((sum, row) => sum + row.solid, 0)
          acc[source] = {
            deals: sourceRows.reduce((sum, row) => sum + row.dealIds.size, 0),
            net: sourceNet,
            solid: sourceSolid,
            dropOff: sourceNet ? Math.max(0, (sourceNet - sourceSolid) / sourceNet * 100) : 0,
            appointmentRate: sourceLeads.length ? sourceWithAppointments.size / sourceLeads.length * 100 : 0,
          }
          return acc
        }, {})
      setRows(result)
      setDealDetails([...dealDetailsById.values()].sort((a, b) => String(b.appointmentDate || "").localeCompare(String(a.appointmentDate || "")) || String(a.id).localeCompare(String(b.id))))
      setSummary({ deals: soldDeals, net: netSold, solid, appointmentRate, sourceBreakdown })
    } catch (err) {
      console.error("Error loading Data Results:", err)
      setError(err?.message || "Unable to load Data Results.")
      setRows([])
      setDealDetails([])
      setSummary({ deals: 0, net: 0, solid: 0, appointmentRate: 0 })
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, sourceFilter])

  useEffect(() => { loadData() }, [loadData])

  const totals = useMemo(() => rows.reduce((sum, row) => {
    ;["spend", "leads", "missingSpend", "dup", "wn", "ooa", "inv", "total", "netLeads", "callback", "noContact", "archivedNoContact", "appointments", "h", "c", "p", "s", "net", "solid"].forEach(key => { sum[key] = (sum[key] || 0) + Number(row[key] || 0) })
    return sum
  }, {}), [rows])

  function exportExcel() {
    setExporting(true)
    try {
      const exportRows = rows.map(row => ({
        "Lead Sources": row.source, Spend: row.spend, Leads: row.leads, Dup: row.dup, WN: row.wn, OOA: row.ooa, INV: row.inv,
        Total: row.total, "Net Leads": row.netLeads, "Call Back": row.callback, NC: row.noContact, H: row.h, C: row.c, P: row.p, S: row.s, "Net Value": row.net, Solid: row.solid, CPL: row.leads ? row.spend / row.leads : 0, CPH: row.h ? row.spend / row.h : 0, CPP: row.p ? row.spend / row.p : 0, "Data%": row.solid ? row.spend / row.solid : 0,
      }))
      exportRows.push({
        "Lead Sources": "TOTAL", Spend: totals.spend || 0, Leads: totals.leads || 0, Dup: totals.dup || 0, WN: totals.wn || 0, OOA: totals.ooa || 0,
        INV: totals.inv || 0, Total: totals.total || 0, "Net Leads": totals.netLeads || 0,
        "Call Back": totals.callback || 0, NC: totals.noContact || 0,
        H: totals.h || 0, C: totals.c || 0, P: totals.p || 0, S: totals.s || 0, "Net Value": totals.net || 0, Solid: totals.solid || 0, CPL: totals.leads ? (totals.spend || 0) / totals.leads : 0, CPH: totals.h ? (totals.spend || 0) / totals.h : 0, CPP: totals.p ? (totals.spend || 0) / totals.p : 0, "Data%": totals.solid ? (totals.spend || 0) / totals.solid : 0,
      })
      const sheet = XLSX.utils.json_to_sheet(exportRows)
      sheet["!cols"] = Object.keys(exportRows[0] || {}).map(key => ({ wch: Math.max(12, key.length + 3) }))
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, String(reportTitle).slice(0, 31))
      XLSX.writeFile(workbook, `${String(reportTitle).toLowerCase().replace(/\\s+/g, "-")}-${startDate}-to-${endDate}.xlsx`)
    } finally { setExporting(false) }
  }

  const dealSources = [...new Set(dealDetails.map(deal => deal.source).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const visibleDealDetails = dealDetails
    .filter(deal => dealSourceFilter === "All" || deal.source === dealSourceFilter)
    .sort((a, b) => String(a.appointmentDate || "").localeCompare(String(b.appointmentDate || "")) || String(a.id).localeCompare(String(b.id)))

  const th = { padding: "9px 8px", fontSize: 11, fontWeight: 600, color: "#64748b", textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid #dbe2ea", background: "#f8fafc", position: "sticky", top: 0, zIndex: 1 }
  const td = { padding: "8px", fontSize: 11, color: "#172033", whiteSpace: "nowrap", borderBottom: "1px solid #e8edf3" }
  const card = { background: "#fff", color: "#172033", border: "1px solid #e1e7ee", borderRadius: 12, padding: "15px 18px", minWidth: 0, boxShadow: "0 2px 8px rgba(15, 35, 55, 0.08)" }

  return <div style={{ background: embedded ? "transparent" : "#f5f7fa", minHeight: embedded ? "auto" : "calc(100vh - 60px)", margin: embedded ? 0 : "-24px -32px", color: "#172033", borderRadius: embedded ? 10 : 0, overflow: "hidden" }}>
    <section style={{ background: "linear-gradient(115deg, #102f55 0%, #174b7c 100%)", color: "#fff", padding: embedded ? "16px 22px 14px" : "20px 28px 18px", borderRadius: embedded ? "10px 10px 0 0" : 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
        <div style={{ minWidth: 220 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.14em", fontWeight: 700, color: "#9db7c9", textTransform: "uppercase", marginBottom: 7 }}>Digital Team · Reporting</div>
          <h1 style={{ margin: 0, fontSize: embedded ? 25 : 30, lineHeight: 1.15, fontWeight: 750, letterSpacing: "-.025em" }}>{reportTitle}</h1>
          <p style={{ margin: "5px 0 0", fontSize: 11, color: "#c3d4e0" }}>Lead source performance and sales outcomes</p>
        </div>
        <button type="button" onClick={exportExcel} disabled={loading || exporting || !rows.length} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, border: "1px solid rgba(255,255,255,0.65)", borderRadius: 8, padding: "9px 15px", background: "#fff", color: "#173b5d", fontSize: 12, fontWeight: 650, cursor: loading || exporting || !rows.length ? "not-allowed" : "pointer", opacity: loading || exporting || !rows.length ? 0.65 : 1, boxShadow: "0 2px 5px rgba(0,0,0,0.12)" }}><FileSpreadsheet size={16}/>{exporting ? "Exporting…" : "Export"}</button>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#a9c0d0", letterSpacing: "0.06em", marginRight: 3 }}>QUICK RANGES</span>
          {[
            ["last-week", "Last week"],
            ["last-4-weeks", "Last 4 weeks"],
            ["last-12-weeks", "Last 12 weeks"],
            ["this-month", "This month"],
            ["last-month", "Last month"],
            ["ytd", "YTD"],
          ].map(([key, label]) => <button key={key} type="button" onClick={() => applyPreset(key)} style={{ border: activePreset === key ? "1px solid #d9e9f3" : "1px solid #496a80", borderRadius: 7, padding: "5px 10px", background: activePreset === key ? "#e7f0f6" : "rgba(255,255,255,0.08)", color: activePreset === key ? "#12344b" : "#e4edf3", fontSize: 11, fontWeight: activePreset === key ? 700 : 500, cursor: "pointer" }}>{label}</button>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(160px, 1fr))", gap: 10, flex: "0 1 420px" }}>
          <label style={{ display: "grid", gap: 5, fontSize: 11, fontWeight: 650, color: "#d7e4ed" }}>START DATE<input type="date" value={startDate} max={endDate} onChange={event => setStartDate(event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: 8, border: "1px solid #496a80", background: "#244a64", color: "#fff", colorScheme: "dark", fontSize: 13 }}/></label>
          <label style={{ display: "grid", gap: 5, fontSize: 11, fontWeight: 650, color: "#d7e4ed" }}>END DATE<input type="date" value={endDate} min={startDate} onChange={event => setEndDate(event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: 8, border: "1px solid #496a80", background: "#244a64", color: "#fff", colorScheme: "dark", fontSize: 13 }}/></label>
        </div>
      </div>
    </section>
    <section style={{ padding: embedded ? "16px 0 4px" : "14px 22px 24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 14, marginTop: 0 }}>
        {[
          { label: "Deals", value: loading ? "—" : number(summary.deals), detail: "Sold deals in period", split: "Windows: " + number(summary.sourceBreakdown?.["Global Windows"]?.deals || 0) + " · Solar: " + number(summary.sourceBreakdown?.["Global Solar"]?.deals || 0) },
          { label: "Net Sold", value: loading ? "—" : money(summary.net), detail: "Net value of sold deals", split: "Windows: " + money(summary.sourceBreakdown?.["Global Windows"]?.net || 0) + " · Solar: " + money(summary.sourceBreakdown?.["Global Solar"]?.net || 0) },
          { label: "Solid", value: loading ? "—" : money(summary.solid), detail: "Value excluding cancellations", split: "Windows: " + money(summary.sourceBreakdown?.["Global Windows"]?.solid || 0) + " · Solar: " + money(summary.sourceBreakdown?.["Global Solar"]?.solid || 0) },
          { label: "Drop Off", value: loading || !summary.net ? "—" : `${Math.max(0, (summary.net - summary.solid) / summary.net * 100).toFixed(1)}%`, detail: "Net value lost before solid", split: "Windows: " + Number(summary.sourceBreakdown?.["Global Windows"]?.dropOff || 0).toFixed(1) + "% · Solar: " + Number(summary.sourceBreakdown?.["Global Solar"]?.dropOff || 0).toFixed(1) + "%" },
          { label: "Appointment Rate", value: loading ? "—" : `${Number(summary.appointmentRate || 0).toFixed(1)}%`, detail: "Leads with a dated appointment", split: "Windows: " + Number(summary.sourceBreakdown?.["Global Windows"]?.appointmentRate || 0).toFixed(1) + "% · Solar: " + Number(summary.sourceBreakdown?.["Global Solar"]?.appointmentRate || 0).toFixed(1) + "%" },
        ].map(item => <div key={item.label} style={card}>
          <div style={{ fontSize: 11, fontWeight: 650, color: "#64748b", marginBottom: 7 }}>{item.label}</div>
          <div style={{ fontSize: 25, lineHeight: 1.15, fontWeight: 750, letterSpacing: "-0.025em", color: "#102a43" }}>{item.value}</div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>{item.detail}</div>
          {sourceFilter && Array.isArray(sourceFilter) && <div style={{ fontSize: 10, color: "#64748b", marginTop: 8, lineHeight: 1.5 }}>{item.split}</div>}
        </div>)}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginBottom: 10 }}>
        
        
      </div>
      {error && <div style={{ padding: 12, marginBottom: 10, borderRadius: 8, background: "#fff1f2", color: "#be123c", fontSize: 12 }}>{error}</div>}
      <div style={{ overflow: "auto", maxHeight: "calc(100vh - 320px)", background: "#fff", border: "1px solid #dbe5ef", borderRadius: 10, boxShadow: "0 2px 8px rgba(15,35,55,.04)" }}>
        <table style={{ width: "100%", minWidth: 1500, borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ ...th, verticalAlign: "middle", minWidth: 150, textAlign: "left" }}>Lead Sources</th>
              <th colSpan={10} style={{ ...th, textAlign: "center", borderBottom: "1px solid #cbd5e1" }}>Leads</th>
              <th colSpan={6} style={{ ...th, textAlign: "center", borderBottom: "1px solid #cbd5e1", borderLeft: "2px solid #cbd5e1" }}>Appointments</th>
              <th colSpan={4} style={{ ...th, textAlign: "center", borderBottom: "1px solid #cbd5e1", borderLeft: "2px solid #cbd5e1" }}>Marketing Efficiency</th>
            </tr>
            <tr>
              {["Spend", "Leads", "Dup", "WN", "OOA", "INV", "Total", "Net leads", "Call Back", "NC"].map(heading => <th key={heading} style={{ ...th, textAlign: "center", ...((heading === "INV" || (heading === "Spend" && rows.some(row => row.missingSpend > 0))) ? { background: "#fee2e2", color: "#b91c1c" } : {}) }}>{heading}</th>)}
              {["H", "C", "P", "S", "Net", "Solid"].map(heading => <th key={heading} style={{ ...th, textAlign: "center" }}>{heading}</th>)}
              {["CPL", "CPH", "CPP", "Data%"].map(heading => <th key={heading} style={{ ...th, textAlign: "center", borderLeft: heading === "CPL" ? "2px solid #cbd5e1" : undefined, ...(rows.some(row => row.missingSpend > 0) ? { background: "#fee2e2", color: "#b91c1c" } : {}) }}>{heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => <tr key={row.source}>
              <td style={{ ...td, fontWeight: 650, position: "sticky", left: 0, background: "#fff", zIndex: 0, textAlign: "left" }}>{row.source}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 600, ...(row.missingSpend > 0 ? { background: "#fef2f2", color: "#b91c1c" } : {}) }}>{money(row.spend)}</td>
              {[row.leads, row.dup, row.wn, row.ooa, row.inv, row.total, row.netLeads, row.callback, row.noContact].map((value, index) => <td key={index} style={{ ...td, textAlign: "center", ...(index === 4 ? { background: "#fef2f2", color: "#b91c1c", fontWeight: 650 } : {}) }}>{number(value)}</td>)}
              {[row.h, row.c, row.p, row.s].map((value, index) => <td key={`appointment-${index}`} style={{ ...td, textAlign: "right", ...(index === 0 ? { borderLeft: "2px solid #cbd5e1" } : {}) }}>{number(value)}</td>)}
              <td style={{ ...td, textAlign: "right" }}>{money(row.net)}</td><td style={{ ...td, textAlign: "right" }}>{money(row.solid)}</td>
              <td style={{ ...td, textAlign: "right", borderLeft: "2px solid #cbd5e1", ...(row.missingSpend > 0 ? { background: "#fef2f2", color: "#b91c1c" } : {}) }}>{row.leads ? money2(row.spend / row.leads) : "—"}</td>
              <td style={{ ...td, textAlign: "right", ...(row.missingSpend > 0 ? { background: "#fef2f2", color: "#b91c1c" } : {}) }}>{row.h ? money2(row.spend / row.h) : "—"}</td>
              <td style={{ ...td, textAlign: "right", ...(row.missingSpend > 0 ? { background: "#fef2f2", color: "#b91c1c" } : {}) }}>{row.p ? money2(row.spend / row.p) : "—"}</td>
              <td style={{ ...td, textAlign: "right", ...(row.missingSpend > 0 ? { background: "#fef2f2", color: "#b91c1c" } : {}) }}>{row.solid ? `${(row.spend / row.solid * 100).toFixed(1)}%` : "—"}</td>
            </tr>)}
            {!loading && !rows.length && <tr><td colSpan={21} style={{ ...td, textAlign: "center", padding: 24, color: "#64748b" }}>No leads found in this date range.</td></tr>}
            <tr style={{ background: "#f8fafc" }}>
              <td style={{ ...td, fontWeight: 750, position: "sticky", left: 0, background: "#f8fafc" }}>TOTAL</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 750, ...(rows.some(row => row.missingSpend > 0) ? { background: "#fee2e2", color: "#b91c1c" } : {}) }}>{money(totals.spend)}</td>
              {[totals.leads, totals.dup, totals.wn, totals.ooa, totals.inv, totals.total, totals.netLeads, totals.callback, totals.noContact].map((value, index) => <td key={index} style={{ ...td, textAlign: "center", fontWeight: 750, ...(index === 4 ? { background: "#fee2e2", color: "#b91c1c" } : {}) }}>{number(value)}</td>)}
              {[totals.h, totals.c, totals.p, totals.s].map((value, index) => <td key={`total-appointment-${index}`} style={{ ...td, textAlign: "center", fontWeight: 750, ...(index === 0 ? { borderLeft: "2px solid #cbd5e1" } : {}) }}>{number(value)}</td>)}
              <td style={{ ...td, textAlign: "right", fontWeight: 750 }}>{money(totals.net)}</td><td style={{ ...td, textAlign: "right", fontWeight: 750 }}>{money(totals.solid)}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 750, borderLeft: "2px solid #cbd5e1", ...(rows.some(row => row.missingSpend > 0) ? { background: "#fee2e2", color: "#b91c1c" } : {}) }}>{totals.leads ? money2(totals.spend / totals.leads) : "—"}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 750, ...(rows.some(row => row.missingSpend > 0) ? { background: "#fee2e2", color: "#b91c1c" } : {}) }}>{totals.h ? money2(totals.spend / totals.h) : "—"}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 750, ...(rows.some(row => row.missingSpend > 0) ? { background: "#fee2e2", color: "#b91c1c" } : {}) }}>{totals.p ? money2(totals.spend / totals.p) : "—"}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 750, ...(rows.some(row => row.missingSpend > 0) ? { background: "#fee2e2", color: "#b91c1c" } : {}) }}>{totals.solid ? `${(totals.spend / totals.solid * 100).toFixed(1)}%` : "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 10 }}>Lead outcomes are grouped by lead source using lead received date. Appointments, H/C/P/S and linked deal values are grouped separately using appointment date. Each linked deal is counted once per lead source; Solid excludes Customer Cancelled and Decline stages.</p>
      <div style={{ marginTop: 18, background: "#fff", border: "1px solid #dbe5ef", borderRadius: 10, overflow: "hidden", boxShadow: "0 2px 8px rgba(15,35,55,.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "13px 15px", borderBottom: "1px solid #e2e8f0", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, color: "#17324a" }}>Linked deals included in report</h2>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>Deals linked to appointments dated within the selected period.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}><select value={dealSourceFilter} onChange={event => setDealSourceFilter(event.target.value)} style={{ padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", color: "#17324a", fontSize: 12 }}><option value="All">All lead sources</option>{dealSources.map(source => <option key={source} value={source}>{source}</option>)}</select><strong style={{ fontSize: 13, color: "#17324a" }}>{loading ? "Loading…" : number(visibleDealDetails.length) + " deals"}</strong></div>
        </div>
        <div style={{ overflowX: "auto", maxHeight: 420 }}>
          <table style={{ width: "100%", minWidth: 900, borderCollapse: "separate", borderSpacing: 0 }}>
            <thead><tr>
              {["Customer - Contract", "Lead source", "Appointment date", "Appointment ID", "H", "C", "P", "S", "Net value", "Pipedrive stage"].map(label => <th key={label} style={th}>{label}</th>)}
            </tr></thead>
            <tbody>
              {visibleDealDetails.map(deal => <tr key={deal.id}>
                <td style={td}>{[deal.customerName, deal.contractNumber].filter(Boolean).join(" - ") || "—"}</td><td style={td}>{deal.source}</td><td style={td}>{deal.appointmentDate ? new Date(deal.appointmentDate).toLocaleDateString("en-GB") : "—"}</td>
                <td style={td}>{deal.appointmentRowId || "—"}</td>
                {[deal.h, deal.c, deal.p, deal.s].map((value, index) => <td key={index} style={{ ...td, textAlign: "center" }}>{value ? "✓" : "—"}</td>)}
                <td style={{ ...td, textAlign: "right", fontWeight: 650 }}>{money(deal.net)}</td><td style={td}>{deal.stage || "—"}</td>
              </tr>)}
              {!loading && !visibleDealDetails.length && <tr><td colSpan={10} style={{ ...td, textAlign: "center", padding: 22, color: "#64748b" }}>No linked deals found for appointments in this date range.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
}

export default DataResults

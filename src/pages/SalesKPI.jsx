import React, { useEffect, useMemo, useState } from "react"
import { CalendarDays, ChevronDown, ChevronUp, RefreshCw, Users } from "lucide-react"
import { supabase } from "../lib/supabase"

const DEAL_BATCH_SIZE = 100

function londonDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date)
  const p = Object.fromEntries(parts.filter(x => x.type !== "literal").map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}

function periodDates(period) {
  const today = londonDate()
  const current = new Date(`${today}T12:00:00`)
  const day = current.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(current)
  monday.setDate(monday.getDate() + mondayOffset)
  if (period === "this") return { start: londonDate(monday), end: today }
  if (period === "last") {
    const start = new Date(monday); start.setDate(start.getDate() - 7)
    const end = new Date(monday); end.setDate(end.getDate() - 1)
    return { start: londonDate(start), end: londonDate(end) }
  }
  return { start: `${today.slice(0, 4)}-01-01`, end: today }
}

function formatDate(value) { if (!value) return ""; const [year, month, day] = value.split("-"); return `${day}/${month}/${year}` }
function formatNumber(value) { return new Intl.NumberFormat("en-GB").format(value || 0) }
function formatCurrency(value) { return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value || 0) }
function formatConversion(value) { return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value).toFixed(1) : "—" }
function formatPercent(value) { return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : "—" }
function isTrue(value) { if (value === true) return true; if (typeof value === "string") return ["true", "t", "1", "yes", "y"].includes(value.trim().toLowerCase()); return value === 1 }
function normaliseEmail(value) { return String(value ?? "").trim().toLowerCase() }

export default function SalesKPI() {
  const initial = periodDates("this")
  const [startDate, setStartDate] = useState(initial.start)
  const [endDate, setEndDate] = useState(initial.end)
  const [period, setPeriod] = useState("this")
  const [appointments, setAppointments] = useState([])
  const [profiles, setProfiles] = useState([])
  const [jobTypeFilter, setJobTypeFilter] = useState("all")
  const [branchFilter, setBranchFilter] = useState("all")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [sortField, setSortField] = useState("h")
  const [sortDirection, setSortDirection] = useState("desc")

  async function loadKPI(range = { start: startDate, end: endDate }) {
    if (!supabase) { setError("Supabase is not configured."); return }
    if (!range.start || !range.end) { setError("Please enter both a start and end date."); return }
    if (range.start > range.end) { setError("The start date cannot be after the end date."); return }
    setLoading(true); setError("")
    try {
      const endExclusive = new Date(`${range.end}T12:00:00`)
      endExclusive.setDate(endExclusive.getDate() + 1)
      const endExclusiveString = `${endExclusive.getFullYear()}-${String(endExclusive.getMonth() + 1).padStart(2, "0")}-${String(endExclusive.getDate()).padStart(2, "0")}T00:00:00`
      const [appointmentsResult, profilesResult] = await Promise.all([
        supabase.from("appointments").select("appointment_row_id, rep_allocated, cps_h, cps_c, cps_p, cps_s, job_type, branch").gte("appointment_date", `${range.start}T00:00:00`).lt("appointment_date", endExclusiveString).order("appointment_date", { ascending: true }),
        supabase.from("profiles").select("email, full_name").order("full_name", { ascending: true }),
      ])
      if (appointmentsResult.error) throw appointmentsResult.error
      if (profilesResult.error) throw profilesResult.error
      const loaded = appointmentsResult.data || []
      const dealByAppointmentId = {}
      const solidByAppointmentId = {}
      const appointmentIds = loaded.map(a => a.appointment_row_id).filter(Boolean)
      for (let i = 0; i < appointmentIds.length; i += DEAL_BATCH_SIZE) {
        const batch = appointmentIds.slice(i, i + DEAL_BATCH_SIZE)
        const { data, error: dealsError } = await supabase.from("deals").select("appointment_row_id, net_value, pipedrive_stage").in("appointment_row_id", batch)
        if (dealsError) throw dealsError
        ;(data || []).forEach(deal => {
          if (!deal.appointment_row_id) return
          const value = Number(deal.net_value || 0)
          dealByAppointmentId[String(deal.appointment_row_id)] = Number.isFinite(value) ? value : 0
          solidByAppointmentId[String(deal.appointment_row_id)] = !["Deal Lost", "Sales"].includes(String(deal.pipedrive_stage || "").trim()) && Number.isFinite(value) ? value : 0
        })
      }
      setAppointments(loaded.map(a => ({ ...a, net_value: dealByAppointmentId[String(a.appointment_row_id)] || 0, solid_value: solidByAppointmentId[String(a.appointment_row_id)] || 0 })))
      setProfiles(profilesResult.data || [])
      setJobTypeFilter("all"); setBranchFilter("all")
    } catch (err) {
      console.error("Error loading sales KPI:", err); setError(err?.message || "Unable to load sales KPI."); setAppointments([]); setProfiles([])
    } finally { setLoading(false) }
  }

  function selectPeriod(value) {
    const dates = periodDates(value)
    setPeriod(value); setStartDate(dates.start); setEndDate(dates.end); loadKPI(dates)
  }
  function selectCustom() { setPeriod("custom") }
  function handleStartDateChange(value) { setStartDate(value); setPeriod("custom") }
  function handleEndDateChange(value) { setEndDate(value); setPeriod("custom") }
  useEffect(() => { loadKPI() }, [])

  const repNameByEmail = useMemo(() => profiles.reduce((map, profile) => {
    const email = normaliseEmail(profile.email); const name = String(profile.full_name ?? "").trim()
    if (email && name) map[email] = name
    return map
  }, {}), [profiles])

  const filteredAppointments = useMemo(() => appointments.filter(a => (jobTypeFilter === "all" || (a.job_type || "Unspecified") === jobTypeFilter) && (branchFilter === "all" || (a.branch || "Unspecified") === branchFilter)), [appointments, jobTypeFilter, branchFilter])

  const rows = useMemo(() => {
    const grouped = new Map()
    filteredAppointments.forEach(a => {
      const key = a.rep_allocated || "__unallocated__"
      if (!grouped.has(key)) grouped.set(key, { key, rep_name: repNameByEmail[normaliseEmail(a.rep_allocated)] || a.rep_allocated || "Unallocated", h: 0, c: 0, p: 0, s: 0, net_value: 0, solid_value: 0 })
      const row = grouped.get(key)
      if (isTrue(a.cps_h)) row.h++
      if (isTrue(a.cps_c)) row.c++
      if (isTrue(a.cps_p)) row.p++
      if (isTrue(a.cps_s)) row.s++
      row.net_value += Number(a.net_value || 0)
      row.solid_value += Number(a.solid_value || 0)
    })
    return Array.from(grouped.values())
  }, [filteredAppointments, repNameByEmail])

  const jobTypes = useMemo(() => Array.from(new Set(appointments.map(a => a.job_type || "Unspecified"))).sort((a, b) => a.localeCompare(b)), [appointments])
  const branches = useMemo(() => Array.from(new Set(appointments.map(a => a.branch || "Unspecified"))).sort((a, b) => a.localeCompare(b)), [appointments])

  const sortedRows = useMemo(() => [...rows].sort((a, b) => {
    if (a.key === "__unallocated__" && b.key !== "__unallocated__") return 1
    if (b.key === "__unallocated__" && a.key !== "__unallocated__") return -1
    let difference
    if (sortField === "rep_allocated") difference = a.rep_name.localeCompare(b.rep_name)
    else if (sortField === "conversion") difference = (b.s > 0 ? b.p / b.s : 0) - (a.s > 0 ? a.p / a.s : 0)
    else if (sortField === "bo_percent") difference = (b.c > 0 ? ((b.c - b.p) / b.c) * 100 : 0) - (a.c > 0 ? ((a.c - a.p) / a.c) * 100 : 0)
    else if (sortField === "avg_order_value") difference = (b.s > 0 ? b.net_value / b.s : 0) - (a.s > 0 ? a.net_value / a.s : 0)
    else difference = Number(b[sortField] || 0) - Number(a[sortField] || 0)
    return sortDirection === "asc" ? difference : -difference
  }), [rows, sortField, sortDirection])

  const totals = useMemo(() => rows.reduce((t, r) => ({ h: t.h + r.h, c: t.c + r.c, p: t.p + r.p, s: t.s + r.s, net_value: t.net_value + r.net_value, solid_value: t.solid_value + r.solid_value }), { h: 0, c: 0, p: 0, s: 0, net_value: 0, solid_value: 0 }), [rows])
  const totalConversion = totals.s > 0 ? totals.p / totals.s : 0
  const totalBoPercent = totals.c > 0 ? ((totals.c - totals.p) / totals.c) * 100 : 0
  const totalAvgOrderValue = totals.s > 0 ? totals.net_value / totals.s : 0
  const displayedRepCount = rows.filter(r => r.key !== "__unallocated__").length

  function changeSort(field) {
    if (sortField === field) setSortDirection(current => current === "desc" ? "asc" : "desc")
    else { setSortField(field); setSortDirection(field === "rep_allocated" ? "asc" : "desc") }
  }
  function SortIcon({ field }) { if (sortField !== field) return null; return sortDirection === "desc" ? <ChevronDown size={14} /> : <ChevronUp size={14} /> }

  return <>
    <style>{`.sales-kpi-page{min-height:100%;padding:28px 32px 40px;background:#f5f7fa;color:#0f172a;box-sizing:border-box}.sales-kpi-container{max-width:1400px;margin:0 auto}.sales-kpi-header{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:16px}.sales-kpi-heading h1{margin:0;font-size:32px;line-height:1.1;font-weight:750;letter-spacing:-.025em}.sales-kpi-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}.sales-kpi-periods{display:flex;gap:7px}.sales-kpi-period{height:38px;padding:0 15px;border:1px solid #d7dee7;border-radius:8px;background:#fff;color:#475569;font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap}.sales-kpi-period:hover{border-color:#0877bd}.sales-kpi-period.active{background:#0877bd;border-color:#0877bd;color:#fff}.sales-kpi-date-card{display:flex;align-items:flex-end;gap:10px;padding:10px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 2px 8px rgba(15,23,42,.04)}.sales-kpi-date-field{display:flex;flex-direction:column;gap:5px}.sales-kpi-date-field span{font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.06em}.sales-kpi-date-input{display:flex;align-items:center;gap:7px;height:38px;padding:0 9px;border:1px solid #d7dee7;border-radius:8px;background:#fff;box-sizing:border-box}.sales-kpi-date-input svg{color:#64748b;flex:0 0 auto}.sales-kpi-date-input input{border:0;outline:0;background:transparent;color:#0f172a;font:inherit;font-size:13px;min-width:118px}.sales-kpi-run{height:38px;padding:0 13px;border:0;border-radius:8px;background:#0877bd;color:#fff;font-weight:700;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:7px}.sales-kpi-run:disabled{opacity:.65;cursor:default}.sales-kpi-summary{display:flex;align-items:center;gap:8px;margin:0 0 16px;color:#64748b;font-size:12px;font-weight:600}.sales-kpi-summary-label{color:#0f172a;font-weight:750}.sales-kpi-panel{background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 2px 10px rgba(15,23,42,.05);overflow:hidden}.sales-kpi-panel-header{padding:20px 22px;border-bottom:1px solid #e8edf2;display:flex;justify-content:space-between;align-items:center;gap:20px}.sales-kpi-panel-title{display:flex;align-items:center;gap:11px}.sales-kpi-panel-icon{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;background:#eaf5fc;color:#0877bd}.sales-kpi-panel-header h2{margin:0;font-size:18px;font-weight:750}.sales-kpi-panel-header p{margin:3px 0 0;color:#64748b;font-size:12px}.sales-kpi-date-range{color:#64748b;font-size:12px;font-weight:600;white-space:nowrap}.sales-kpi-filter-bar{display:flex;align-items:center;gap:10px;padding:14px 22px;border-bottom:1px solid #e8edf2}.sales-kpi-filter-label{color:#64748b;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}.sales-kpi-filter-select{height:34px;min-width:150px;padding:0 10px;border:1px solid #d7dee7;border-radius:8px;background:#fff;color:#0f172a;font-size:12px;outline:none;cursor:pointer}.sales-kpi-filter-clear{height:34px;padding:0 11px;border:1px solid #d7dee7;border-radius:8px;background:#fff;color:#64748b;font-size:12px;font-weight:700;cursor:pointer}.sales-kpi-table-wrap{overflow-x:auto}.sales-kpi-table{width:100%;border-collapse:collapse;font-size:13px}.sales-kpi-table th{height:46px;padding:0 22px;text-align:left;background:#f8fafc;color:#64748b;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid #e2e8f0;white-space:nowrap;user-select:none}.sales-kpi-table th:not(:first-child),.sales-kpi-table td:not(:first-child){text-align:right}.sales-kpi-table th.sortable{cursor:pointer}.sales-kpi-table th.sortable:hover{color:#0877bd}.sales-kpi-sort{display:inline-flex;align-items:center;gap:4px}.sales-kpi-table td{height:48px;padding:0 22px;border-bottom:1px solid #edf1f5;color:#1e293b;font-variant-numeric:tabular-nums}.sales-kpi-table tbody tr:hover{background:#f8fbfd}.sales-kpi-rep{display:flex;align-items:center;gap:9px;text-align:left;font-weight:650}.sales-kpi-rep-dot{width:8px;height:8px;border-radius:50%;background:#0877bd;flex:0 0 auto}.sales-kpi-table tr.unallocated{background:#fffaf0}.sales-kpi-table tr.unallocated .sales-kpi-rep-dot{background:#f59e0b}.sales-kpi-total td{height:52px;background:#eef5f9;border-bottom:2px solid #d7e4ed;font-weight:800;color:#0f172a}.sales-kpi-total td:not(:first-child){font-size:14px}.sales-kpi-total .sales-kpi-rep-dot{background:#0f172a}.sales-kpi-empty{text-align:center!important;color:#64748b!important;padding:36px 20px!important;height:auto!important}.sales-kpi-error{margin-bottom:18px;padding:12px 15px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:13px}.sales-kpi-error strong{display:block;margin-bottom:2px}.sales-kpi-spin{animation:sales-kpi-spin 1s linear infinite}@keyframes sales-kpi-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@media(max-width:1050px){.sales-kpi-header{align-items:flex-start;flex-direction:column}.sales-kpi-controls{justify-content:flex-start;width:100%}}@media(max-width:600px){.sales-kpi-page{padding:20px 14px 30px}.sales-kpi-heading h1{font-size:27px}.sales-kpi-controls{align-items:stretch;flex-direction:column}.sales-kpi-periods{width:100%;flex-wrap:wrap}.sales-kpi-period{flex:1}.sales-kpi-date-card{width:100%;box-sizing:border-box;flex-wrap:wrap}.sales-kpi-date-field{flex:1;min-width:135px}.sales-kpi-date-input input{min-width:0;width:100%}.sales-kpi-run{flex:1;justify-content:center}.sales-kpi-panel-header{align-items:flex-start;flex-direction:column}.sales-kpi-date-range{white-space:normal}.sales-kpi-filter-bar{flex-wrap:wrap;padding:12px 14px}.sales-kpi-filter-select{flex:1;min-width:130px}}`}</style>
    <div className="sales-kpi-page"><div className="sales-kpi-container">
      <header className="sales-kpi-header">
        <div className="sales-kpi-heading"><h1>Sales KPI</h1></div>
        <div className="sales-kpi-controls">
          <div className="sales-kpi-periods">
            <button type="button" className={`sales-kpi-period ${period === "ytd" ? "active" : ""}`} onClick={() => selectPeriod("ytd")} disabled={loading}>Year to Date</button>
            <button type="button" className={`sales-kpi-period ${period === "last" ? "active" : ""}`} onClick={() => selectPeriod("last")} disabled={loading}>Last Week</button>
            <button type="button" className={`sales-kpi-period ${period === "this" ? "active" : ""}`} onClick={() => selectPeriod("this")} disabled={loading}>This Week</button>
            <button type="button" className={`sales-kpi-period ${period === "custom" ? "active" : ""}`} onClick={selectCustom} disabled={loading}>Custom</button>
          </div>
          {period === "custom" && <div className="sales-kpi-date-card">
            <label className="sales-kpi-date-field"><span>Start date</span><div className="sales-kpi-date-input"><CalendarDays size={15}/><input type="date" value={startDate} onChange={e => handleStartDateChange(e.target.value)}/></div></label>
            <label className="sales-kpi-date-field"><span>End date</span><div className="sales-kpi-date-input"><CalendarDays size={15}/><input type="date" value={endDate} onChange={e => handleEndDateChange(e.target.value)}/></div></label>
            <button className="sales-kpi-run" onClick={() => loadKPI()} disabled={loading}><RefreshCw size={14} className={loading ? "sales-kpi-spin" : ""}/>{loading ? "Loading" : "Run"}</button>
          </div>}
        </div>
      </header>
      <div className="sales-kpi-summary" aria-live="polite"><span className="sales-kpi-summary-label">Displaying</span><span>{formatNumber(displayedRepCount)} reps</span></div>
      {error && <div className="sales-kpi-error"><strong>Unable to load KPI</strong>{error}</div>}
      <section className="sales-kpi-panel">
        <div className="sales-kpi-panel-header"><div className="sales-kpi-panel-title"><div className="sales-kpi-panel-icon"><Users size={17}/></div><div><h2>Sales Rep Performance</h2><p>Appointments grouped by allocated sales rep.</p></div></div><div className="sales-kpi-date-range">{formatDate(startDate)} – {formatDate(endDate)}</div></div>
        <div className="sales-kpi-filter-bar"><span className="sales-kpi-filter-label">Filter</span><select className="sales-kpi-filter-select" value={jobTypeFilter} onChange={e => setJobTypeFilter(e.target.value)}><option value="all">All job types</option>{jobTypes.map(jobType => <option key={jobType} value={jobType}>{jobType}</option>)}</select><select className="sales-kpi-filter-select" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}><option value="all">All branches</option>{branches.map(branch => <option key={branch} value={branch}>{branch}</option>)}</select>{(jobTypeFilter !== "all" || branchFilter !== "all") && <button className="sales-kpi-filter-clear" onClick={() => { setJobTypeFilter("all"); setBranchFilter("all") }}>Clear filters</button>}</div>
        <div className="sales-kpi-table-wrap"><table className="sales-kpi-table"><thead><tr><th className="sortable" onClick={() => changeSort("rep_allocated")}><span className="sales-kpi-sort">REP <SortIcon field="rep_allocated"/></span></th><th className="sortable" onClick={() => changeSort("h")}><span className="sales-kpi-sort">H <SortIcon field="h"/></span></th><th className="sortable" onClick={() => changeSort("c")}><span className="sales-kpi-sort">C <SortIcon field="c"/></span></th><th className="sortable" onClick={() => changeSort("p")}><span className="sales-kpi-sort">P <SortIcon field="p"/></span></th><th className="sortable" onClick={() => changeSort("s")}><span className="sales-kpi-sort">S <SortIcon field="s"/></span></th><th className="sortable" onClick={() => changeSort("net_value")}><span className="sales-kpi-sort">NET VALUE <SortIcon field="net_value"/></span></th><th className="sortable" onClick={() => changeSort("conversion")}><span className="sales-kpi-sort">CONVERSION <SortIcon field="conversion"/></span></th><th className="sortable" onClick={() => changeSort("bo_percent")}><span className="sales-kpi-sort">BO% <SortIcon field="bo_percent"/></span></th><th className="sortable" onClick={() => changeSort("avg_order_value")}><span className="sales-kpi-sort">AVG <SortIcon field="avg_order_value"/></span></th><th className="sortable" onClick={() => changeSort("solid_value")}><span className="sales-kpi-sort">SOLID <SortIcon field="solid_value"/></span></th></tr></thead><tbody>
          <tr className="sales-kpi-total"><td><div className="sales-kpi-rep"><span className="sales-kpi-rep-dot"/>Total</div></td><td>{formatNumber(totals.h)}</td><td>{formatNumber(totals.c)}</td><td>{formatNumber(totals.p)}</td><td>{formatNumber(totals.s)}</td><td>{formatCurrency(totals.net_value)}</td><td>{formatConversion(totalConversion)}</td><td>{formatPercent(totalBoPercent)}</td><td>{formatCurrency(totalAvgOrderValue)}</td><td>{formatCurrency(totals.solid_value)}</td></tr>
          {loading ? <tr><td colSpan="10" className="sales-kpi-empty">Loading sales KPI...</td></tr> : sortedRows.length === 0 ? <tr><td colSpan="10" className="sales-kpi-empty">No appointments found for the selected filters.</td></tr> : sortedRows.map(row => { const conversion = row.s > 0 ? row.p / row.s : 0; const boPercent = row.c > 0 ? ((row.c - row.p) / row.c) * 100 : 0; const avgOrderValue = row.s > 0 ? row.net_value / row.s : 0; return <tr key={row.key} className={row.key === "__unallocated__" ? "unallocated" : ""}><td><div className="sales-kpi-rep"><span className="sales-kpi-rep-dot"/>{row.rep_name}</div></td><td>{formatNumber(row.h)}</td><td>{formatNumber(row.c)}</td><td>{formatNumber(row.p)}</td><td>{formatNumber(row.s)}</td><td>{formatCurrency(row.net_value)}</td><td>{formatConversion(conversion)}</td><td>{formatPercent(boPercent)}</td><td>{formatCurrency(avgOrderValue)}</td><td>{formatCurrency(row.solid_value)}</td></tr> })}
        </tbody></table></div>
      </section>
    </div></div>
  </>
}

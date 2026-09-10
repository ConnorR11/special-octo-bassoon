import React, { useEffect, useMemo, useState } from "react"
import { CalendarDays, ChevronDown, ChevronUp, RefreshCw, Users } from "lucide-react"
import { supabase } from "../lib/supabase"

const DEFAULT_START = "2026-05-01"
const DEFAULT_END = "2026-09-06"

function formatDate(value) {
  if (!value) return ""
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-GB").format(value || 0)
}

export default function SalesKPI() {
  const [startDate, setStartDate] = useState(DEFAULT_START)
  const [endDate, setEndDate] = useState(DEFAULT_END)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [sortField, setSortField] = useState("h")
  const [sortDirection, setSortDirection] = useState("desc")

  async function loadKPI() {
    if (!supabase) {
      setError("Supabase is not configured.")
      return
    }

    if (!startDate || !endDate) {
      setError("Please enter both a start and end date.")
      return
    }

    if (startDate > endDate) {
      setError("The start date cannot be after the end date.")
      return
    }

    setLoading(true)
    setError("")

    // Date range filters appointment_date. H/C/P/S are counted independently.
    const endExclusive = new Date(`${endDate}T00:00:00`)
    endExclusive.setDate(endExclusive.getDate() + 1)

    const { data, error: supabaseError } = await supabase
      .from("appointments")
      .select("rep_allocated, cps_h, cps_c, cps_p, cps_s")
      .gte("appointment_date", `${startDate}T00:00:00`)
      .lt("appointment_date", endExclusive.toISOString())

    if (supabaseError) {
      console.error("Error loading sales KPI:", supabaseError)
      setError(supabaseError.message)
      setRows([])
      setLoading(false)
      return
    }

    const grouped = new Map()

    ;(data || []).forEach((appointment) => {
      const key = appointment.rep_allocated || "__unallocated__"

      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          rep_allocated: appointment.rep_allocated || "Unallocated",
          h: 0,
          c: 0,
          p: 0,
          s: 0,
        })
      }

      const row = grouped.get(key)
      if (appointment.cps_h === true) row.h += 1
      if (appointment.cps_c === true) row.c += 1
      if (appointment.cps_p === true) row.p += 1
      if (appointment.cps_s === true) row.s += 1
    })

    setRows(Array.from(grouped.values()))
    setLoading(false)
  }

  useEffect(() => {
    loadKPI()
  }, [])

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (a.key === "__unallocated__" && b.key !== "__unallocated__") return 1
      if (b.key === "__unallocated__" && a.key !== "__unallocated__") return -1

      if (sortField === "rep_allocated") {
        const result = a.rep_allocated.localeCompare(b.rep_allocated)
        return sortDirection === "asc" ? result : -result
      }

      const difference = Number(b[sortField] || 0) - Number(a[sortField] || 0)
      return sortDirection === "asc" ? -difference : difference
    })
  }, [rows, sortField, sortDirection])

  const totals = useMemo(
    () =>
      rows.reduce(
        (total, row) => ({
          h: total.h + row.h,
          c: total.c + row.c,
          p: total.p + row.p,
          s: total.s + row.s,
        }),
        { h: 0, c: 0, p: 0, s: 0 }
      ),
    [rows]
  )

  function changeSort(field) {
    if (sortField === field) {
      setSortDirection((current) => (current === "desc" ? "asc" : "desc"))
      return
    }

    setSortField(field)
    setSortDirection(field === "rep_allocated" ? "asc" : "desc")
  }

  function SortIcon({ field }) {
    if (sortField !== field) return null
    return sortDirection === "desc" ? <ChevronDown size={14} /> : <ChevronUp size={14} />
  }

  return (
    <>
      <style>{`
        .sales-kpi-page { min-height: 100%; padding: 28px 32px 40px; background: #f5f7fa; color: #0f172a; box-sizing: border-box; }
        .sales-kpi-container { max-width: 1400px; margin: 0 auto; }
        .sales-kpi-header { display:flex; justify-content:space-between; align-items:flex-end; gap:28px; margin-bottom:24px; }
        .sales-kpi-eyebrow { color:#0877bd; font-size:12px; font-weight:800; letter-spacing:.09em; text-transform:uppercase; margin-bottom:6px; }
        .sales-kpi-header h1 { margin:0; font-size:32px; line-height:1.1; font-weight:750; letter-spacing:-.025em; }
        .sales-kpi-header p { margin:8px 0 0; color:#64748b; font-size:14px; }
        .sales-kpi-date-card { display:flex; align-items:flex-end; gap:12px; padding:14px; background:#fff; border:1px solid #e2e8f0; border-radius:12px; box-shadow:0 2px 8px rgba(15,23,42,.04); }
        .sales-kpi-date-field { display:flex; flex-direction:column; gap:6px; }
        .sales-kpi-date-field span { font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:.06em; }
        .sales-kpi-date-input { display:flex; align-items:center; gap:8px; height:38px; padding:0 10px; border:1px solid #d7dee7; border-radius:8px; background:#fff; box-sizing:border-box; }
        .sales-kpi-date-input svg { color:#64748b; flex:0 0 auto; }
        .sales-kpi-date-input input { border:0; outline:0; background:transparent; color:#0f172a; font:inherit; font-size:13px; min-width:125px; }
        .sales-kpi-run { height:38px; padding:0 15px; border:0; border-radius:8px; background:#0877bd; color:#fff; font-weight:700; font-size:13px; cursor:pointer; display:inline-flex; align-items:center; gap:7px; }
        .sales-kpi-run:hover { background:#06659f; }
        .sales-kpi-run:disabled { opacity:.65; cursor:default; }
        .sales-kpi-summary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin-bottom:24px; }
        .sales-kpi-summary-card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:18px 20px; box-shadow:0 2px 8px rgba(15,23,42,.04); position:relative; overflow:hidden; }
        .sales-kpi-summary-card::before { content:""; position:absolute; left:0; top:0; bottom:0; width:4px; background:#0877bd; }
        .sales-kpi-summary-card span { display:block; color:#64748b; font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; margin-bottom:7px; }
        .sales-kpi-summary-card strong { display:block; font-size:30px; line-height:1; letter-spacing:-.025em; }
        .sales-kpi-panel { background:#fff; border:1px solid #e2e8f0; border-radius:14px; box-shadow:0 2px 10px rgba(15,23,42,.05); overflow:hidden; }
        .sales-kpi-panel-header { padding:20px 22px; border-bottom:1px solid #e8edf2; display:flex; justify-content:space-between; align-items:center; gap:20px; }
        .sales-kpi-panel-title { display:flex; align-items:center; gap:11px; }
        .sales-kpi-panel-icon { width:34px; height:34px; border-radius:9px; display:grid; place-items:center; background:#eaf5fc; color:#0877bd; }
        .sales-kpi-panel-header h2 { margin:0; font-size:18px; font-weight:750; }
        .sales-kpi-panel-header p { margin:3px 0 0; color:#64748b; font-size:12px; }
        .sales-kpi-date-range { color:#64748b; font-size:12px; font-weight:600; white-space:nowrap; }
        .sales-kpi-table-wrap { overflow-x:auto; }
        .sales-kpi-table { width:100%; border-collapse:collapse; font-size:13px; }
        .sales-kpi-table th { height:46px; padding:0 22px; text-align:left; background:#f8fafc; color:#64748b; font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; border-bottom:1px solid #e2e8f0; white-space:nowrap; user-select:none; }
        .sales-kpi-table th:not(:first-child), .sales-kpi-table td:not(:first-child) { text-align:right; }
        .sales-kpi-table th.sortable { cursor:pointer; }
        .sales-kpi-table th.sortable:hover { color:#0877bd; }
        .sales-kpi-sort { display:inline-flex; align-items:center; gap:4px; }
        .sales-kpi-table td { height:48px; padding:0 22px; border-bottom:1px solid #edf1f5; color:#1e293b; font-variant-numeric:tabular-nums; }
        .sales-kpi-table tbody tr:hover { background:#f8fbfd; }
        .sales-kpi-table tbody tr.unallocated { background:#fffaf0; }
        .sales-kpi-rep { display:flex; align-items:center; gap:9px; text-align:left; font-weight:650; }
        .sales-kpi-rep-dot { width:8px; height:8px; border-radius:50%; background:#0877bd; flex:0 0 auto; }
        .sales-kpi-table tr.unallocated .sales-kpi-rep-dot { background:#f59e0b; }
        .sales-kpi-total td { height:56px; background:#f1f6fa; border-top:2px solid #d7e4ed; border-bottom:0; font-weight:800; color:#0f172a; }
        .sales-kpi-total td:not(:first-child) { font-size:15px; }
        .sales-kpi-empty { text-align:center !important; color:#64748b !important; padding:36px 20px !important; height:auto !important; }
        .sales-kpi-error { margin-bottom:18px; padding:12px 15px; border-radius:10px; background:#fef2f2; border:1px solid #fecaca; color:#991b1b; font-size:13px; }
        .sales-kpi-error strong { display:block; margin-bottom:2px; }
        .sales-kpi-spin { animation:sales-kpi-spin 1s linear infinite; }
        @keyframes sales-kpi-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @media (max-width:900px) { .sales-kpi-header{flex-direction:column;align-items:stretch}.sales-kpi-date-card{width:fit-content;max-width:100%;flex-wrap:wrap}.sales-kpi-summary{grid-template-columns:repeat(2,minmax(0,1fr))} }
        @media (max-width:600px) { .sales-kpi-page{padding:20px 14px 30px}.sales-kpi-header h1{font-size:27px}.sales-kpi-date-card{width:100%;box-sizing:border-box}.sales-kpi-date-field{flex:1;min-width:135px}.sales-kpi-date-input input{min-width:0;width:100%}.sales-kpi-run{flex:1;justify-content:center}.sales-kpi-panel-header{align-items:flex-start;flex-direction:column}.sales-kpi-date-range{white-space:normal} }
      `}</style>

      <div className="sales-kpi-page">
        <div className="sales-kpi-container">
          <header className="sales-kpi-header">
            <div>
              <div className="sales-kpi-eyebrow">Sales</div>
              <h1>Sales KPI</h1>
              <p>H, C, P and S performance by rep.</p>
            </div>

            <div className="sales-kpi-date-card">
              <label className="sales-kpi-date-field">
                <span>Start date</span>
                <div className="sales-kpi-date-input">
                  <CalendarDays size={15} />
                  <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </div>
              </label>
              <label className="sales-kpi-date-field">
                <span>End date</span>
                <div className="sales-kpi-date-input">
                  <CalendarDays size={15} />
                  <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </div>
              </label>
              <button className="sales-kpi-run" onClick={loadKPI} disabled={loading}>
                <RefreshCw size={15} className={loading ? "sales-kpi-spin" : ""} />
                {loading ? "Loading" : "Apply"}
              </button>
            </div>
          </header>

          <section className="sales-kpi-summary">
            {[['H', totals.h], ['C', totals.c], ['P', totals.p], ['S', totals.s]].map(([label, value]) => (
              <div className="sales-kpi-summary-card" key={label}>
                <span>{label}</span>
                <strong>{formatNumber(value)}</strong>
              </div>
            ))}
          </section>

          {error && <div className="sales-kpi-error"><strong>Unable to load Sales KPI</strong>{error}</div>}

          <section className="sales-kpi-panel">
            <div className="sales-kpi-panel-header">
              <div className="sales-kpi-panel-title">
                <div className="sales-kpi-panel-icon"><Users size={17} /></div>
                <div>
                  <h2>Performance by rep</h2>
                  <p>{rows.length} reps · Counts are based on appointment date</p>
                </div>
              </div>
              <div className="sales-kpi-date-range">{formatDate(startDate)} – {formatDate(endDate)}</div>
            </div>

            <div className="sales-kpi-table-wrap">
              <table className="sales-kpi-table">
                <thead>
                  <tr>
                    {[
                      ["rep_allocated", "rep_allocated"],
                      ["h", "H"],
                      ["c", "C"],
                      ["p", "P"],
                      ["s", "S"],
                    ].map(([field, label]) => (
                      <th key={field} className="sortable" onClick={() => changeSort(field)}>
                        <span className="sales-kpi-sort">{label}<SortIcon field={field} /></span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan="5" className="sales-kpi-empty">Loading Sales KPI…</td></tr>}
                  {!loading && sortedRows.length === 0 && <tr><td colSpan="5" className="sales-kpi-empty">No appointments found for this date range.</td></tr>}
                  {!loading && sortedRows.map((row) => (
                    <tr key={row.key} className={row.key === "__unallocated__" ? "unallocated" : ""}>
                      <td><div className="sales-kpi-rep"><span className="sales-kpi-rep-dot" /><span>{row.rep_allocated}</span></div></td>
                      <td>{formatNumber(row.h)}</td>
                      <td>{formatNumber(row.c)}</td>
                      <td>{formatNumber(row.p)}</td>
                      <td>{formatNumber(row.s)}</td>
                    </tr>
                  ))}
                </tbody>
                {!loading && sortedRows.length > 0 && (
                  <tfoot><tr className="sales-kpi-total"><td>Total</td><td>{formatNumber(totals.h)}</td><td>{formatNumber(totals.c)}</td><td>{formatNumber(totals.p)}</td><td>{formatNumber(totals.s)}</td></tr></tfoot>
                )}
              </table>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

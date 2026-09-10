import React, { useEffect, useMemo, useState } from "react"
import { CalendarDays, RefreshCw, Search, Trophy } from "lucide-react"
import { supabase } from "../lib/supabase"

const DEFAULT_START = "2026-05-01"
const DEFAULT_END = "2026-09-06"

function formatDate(value) {
  if (!value) return ""
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

export default function SalesKPI() {
  const [startDate, setStartDate] = useState(DEFAULT_START)
  const [endDate, setEndDate] = useState(DEFAULT_END)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [sortField, setSortField] = useState("h")
  const [sortDirection, setSortDirection] = useState("desc")
  const [search, setSearch] = useState("")

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

    // The selected dates filter appointment_date. The four CPS columns are
    // then counted independently when their value is true.
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

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()

    return rows
      .filter((row) => !q || row.rep_allocated.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sortField === "rep_allocated") {
          return sortDirection === "asc"
            ? a.rep_allocated.localeCompare(b.rep_allocated)
            : b.rep_allocated.localeCompare(a.rep_allocated)
        }

        const difference = Number(b[sortField] || 0) - Number(a[sortField] || 0)
        return sortDirection === "asc" ? -difference : difference
      })
  }, [rows, search, sortField, sortDirection])

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

  return (
    <div className="sales-kpi-page">
      <section className="sales-kpi-hero">
        <div>
          <div className="sales-kpi-eyebrow">Sales</div>
          <h1>Sales KPI</h1>
          <p>H, C, P and S counts between the selected appointment dates.</p>
        </div>

        <div className="sales-kpi-controls">
          <label>
            <span>Start</span>
            <div className="sales-kpi-date-input">
              <CalendarDays size={15} />
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
          </label>

          <label>
            <span>End</span>
            <div className="sales-kpi-date-input">
              <CalendarDays size={15} />
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </label>

          <button className="sales-kpi-run" onClick={loadKPI} disabled={loading}>
            <RefreshCw size={15} className={loading ? "sales-kpi-spin" : ""} />
            Apply
          </button>
        </div>
      </section>

      <section className="sales-kpi-summary">
        <div className="sales-kpi-summary-card">
          <span>H</span>
          <strong>{totals.h}</strong>
        </div>
        <div className="sales-kpi-summary-card">
          <span>C</span>
          <strong>{totals.c}</strong>
        </div>
        <div className="sales-kpi-summary-card">
          <span>P</span>
          <strong>{totals.p}</strong>
        </div>
        <div className="sales-kpi-summary-card">
          <span>S</span>
          <strong>{totals.s}</strong>
        </div>
      </section>

      {error && <div className="error"><b>Database error</b><span>{error}</span></div>}

      <section className="sales-kpi-content">
        <div className="sales-kpi-toolbar">
          <div>
            <h2>Salespeople</h2>
            <span>
              {formatDate(startDate)} – {formatDate(endDate)} · {filteredRows.length} reps
            </span>
          </div>

          <div className="sales-kpi-search">
            <Search size={15} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search rep_allocated"
            />
          </div>
        </div>

        <div className="sales-kpi-table-wrap">
          <table className="sales-kpi-table">
            <thead>
              <tr>
                <th onClick={() => changeSort("rep_allocated")}>rep_allocated</th>
                <th onClick={() => changeSort("h")}>H</th>
                <th onClick={() => changeSort("c")}>C</th>
                <th onClick={() => changeSort("p")}>P</th>
                <th onClick={() => changeSort("s")}>S</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="5" className="sales-kpi-empty">Loading KPI…</td>
                </tr>
              )}

              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan="5" className="sales-kpi-empty">No appointments found for this date range.</td>
                </tr>
              )}

              {!loading && filteredRows.map((row, index) => (
                <tr key={row.key}>
                  <td>
                    <div className="sales-kpi-name">
                      {index < 3 && <Trophy size={13} />}
                      <span>{row.rep_allocated}</span>
                    </div>
                  </td>
                  <td>{row.h}</td>
                  <td>{row.c}</td>
                  <td>{row.p}</td>
                  <td>{row.s}</td>
                </tr>
              ))}
            </tbody>
            {!loading && filteredRows.length > 0 && (
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td>{totals.h}</td>
                  <td>{totals.c}</td>
                  <td>{totals.p}</td>
                  <td>{totals.s}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  )
}

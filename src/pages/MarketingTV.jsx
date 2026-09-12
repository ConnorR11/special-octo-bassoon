import React, { useEffect, useMemo, useState } from "react"
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  RefreshCw,
  Check,
  X,
} from "lucide-react"
import { supabase } from "../lib/supabase"

function formatDateForInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function formatDisplayDate(value) {
  if (!value) return "—"
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatTime(value) {
  if (!value) return "—"
  const text = String(value).trim()
  const match = text.match(/[T ](\d{2}):(\d{2})/)
  if (match) return `${match[1]}:${match[2]}`
  const timeMatch = text.match(/^(\d{2}):(\d{2})/)
  return timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : text.slice(0, 5)
}

function display(value, fallback = "—") {
  const text = String(value ?? "").trim()
  return text || fallback
}

function normaliseEmail(value) {
  return String(value ?? "").trim().toLowerCase()
}

function isTrueValue(value) {
  if (value === true) return true
  if (typeof value === "string") {
    const v = value.trim().toLowerCase()
    return ["true", "t", "1", "yes", "y"].includes(v)
  }
  return typeof value === "number" && value === 1
}

function countTrue(rows, field) {
  return rows.reduce(
    (total, row) => total + (isTrueValue(row[field]) ? 1 : 0),
    0
  )
}

function isSold(appointment) {
  return String(appointment?.result ?? "").trim().toLowerCase() === "sold"
}

function getDealNetValue(appointment) {
  if (!isSold(appointment)) return null

  const deal = Array.isArray(appointment?.deals)
    ? appointment.deals[0]
    : appointment?.deals
  const value = Number(deal?.net_value)
  return Number.isFinite(value) ? value : null
}

function formatCurrency(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "NULL"
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function sumNetValue(rows) {
  return rows.reduce((total, row) => total + (getDealNetValue(row) ?? 0), 0)
}

function sortBranches(rows) {
  return [...new Set(rows.map((row) => display(row.branch, "Unassigned")))].sort((a, b) => {
    if (a === "Unassigned") return 1
    if (b === "Unassigned") return -1
    return a.localeCompare(b)
  })
}

function SummaryTable({ appointments }) {
  const branches = useMemo(() => sortBranches(appointments), [appointments])

  return (
    <div className="mtv-summary-wrap">
      <div className="mtv-summary-header">
        <div>BRANCH</div>
        <div className="mtv-summary-columns">
          <span>H</span><span>C</span><span>P</span><span>S</span><span>VALUE</span>
        </div>
      </div>

      <div className="mtv-summary-row mtv-summary-total">
        <span>Total</span>
        <div className="mtv-summary-values">
          <span>{countTrue(appointments, "cps_h")}</span>
          <span>{countTrue(appointments, "cps_c")}</span>
          <span>{countTrue(appointments, "cps_p")}</span>
          <span>{countTrue(appointments, "cps_s")}</span>
          <span>{formatCurrency(sumNetValue(appointments))}</span>
        </div>
      </div>

      {branches.map((branch) => {
        const rows = appointments.filter((row) => display(row.branch, "Unassigned") === branch)
        return (
          <div className="mtv-summary-row" key={branch}>
            <span className="mtv-summary-branch">{branch}</span>
            <div className="mtv-summary-values">
              <span>{countTrue(rows, "cps_h")}</span>
              <span>{countTrue(rows, "cps_c")}</span>
              <span>{countTrue(rows, "cps_p")}</span>
              <span>{countTrue(rows, "cps_s")}</span>
              <span>{formatCurrency(sumNetValue(rows))}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatusTick({ value }) {
  return value ? (
    <span className="mtv-tick"><Check size={13} /></span>
  ) : (
    <span className="mtv-cross"><X size={13} /></span>
  )
}

function AppointmentRow({ appointment, onSelect, repNameByEmail }) {
  const repEmail = appointment.rep_allocated
  const repName = repNameByEmail[normaliseEmail(repEmail)] || repEmail
  const netValue = getDealNetValue(appointment)

  const hasRep = Boolean(String(repEmail ?? "").trim())
  const repConfirmed = Boolean(appointment.rep_confirmed_time)

  const rowStatusClass = !hasRep
    ? "mtv-row-unassigned"
    : repConfirmed
      ? "mtv-row-confirmed"
      : "mtv-row-unconfirmed"

  return (
    <tr
      className={`mtv-appointment-row ${rowStatusClass}`}
      onClick={() => onSelect?.(appointment)}
    >
      <td className="mtv-cell mtv-name-cell" title={appointment.name || "Unnamed customer"}>
        {display(appointment.name, "Unnamed customer")}
      </td>
      <td className="mtv-cell" title={display(appointment.branch)}>
        {display(appointment.branch)}
      </td>
      <td className="mtv-cell" title={display(repName)}>
        {display(repName)}
      </td>
      <td className="mtv-cell mtv-time-cell">
        {formatTime(appointment.appointment_date)}
      </td>
      <td className="mtv-cell">{display(appointment.postcode)}</td>
      <td className="mtv-cell">{display(appointment.product)}</td>
      <td className="mtv-cell">{display(appointment.lead_source)}</td>
      <td className="mtv-cell mtv-status-cell">
        <StatusTick value={Boolean(appointment.was_picked_up || appointment.pickup_rep)} />
      </td>
      <td className="mtv-cell mtv-result-cell">{display(appointment.result)}</td>
      <td className="mtv-cell mtv-value-cell">{formatCurrency(netValue)}</td>
      <td className="mtv-cell mtv-status-cell">
        {appointment.epvs_calculation ? "✓" : "—"}
      </td>
    </tr>
  )
}

function BranchSection({ branch, appointments, onSelect, repNameByEmail }) {
  const [open, setOpen] = useState(true)

  const sorted = [...appointments].sort((a, b) =>
    String(a.appointment_date || "").localeCompare(String(b.appointment_date || ""))
  )

  return (
    <section className="mtv-branch-section">
      <button
        type="button"
        className="mtv-branch-title"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{branch}</span>
        <span className="mtv-branch-count">{appointments.length}</span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {open && (
        <div className="mtv-table-scroll">
          <table className="mtv-table">
            <thead>
              <tr className="mtv-table-header">
                <th>NAME</th>
                <th>BRANCH</th>
                <th>REP</th>
                <th>TIME</th>
                <th>POSTCODE</th>
                <th>MEASURE</th>
                <th>LEAD SOURCE</th>
                <th>PICKUP</th>
                <th>RESULT</th>
                <th>NET VALUE</th>
                <th>SURVEY</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((appointment) => (
                <AppointmentRow
                  key={appointment.appointment_row_id}
                  appointment={appointment}
                  onSelect={onSelect}
                  repNameByEmail={repNameByEmail}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function MarketingTV({ onSelectAppointment }) {
  const [selectedDate, setSelectedDate] = useState(formatDateForInput(new Date()))
  const [appointments, setAppointments] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("mastersheet")
  const [lastUpdated, setLastUpdated] = useState(null)

  async function loadAppointments(date = selectedDate) {
    if (!supabase) {
      setError("Supabase is not configured. Check your environment variables.")
      setLoading(false)
      return
    }

    setLoading(true)
    setError("")

    try {
      const endDate = new Date(`${date}T00:00:00Z`)
      endDate.setUTCDate(endDate.getUTCDate() + 1)
      const nextDate = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, "0")}-${String(endDate.getUTCDate()).padStart(2, "0")}`

      const [appointmentsResult, profilesResult] = await Promise.all([
        supabase
          .from("appointments")
          .select("*, deals(net_value)")
          .gte("appointment_date", `${date}T00:00:00.000Z`)
          .lt("appointment_date", `${nextDate}T00:00:00.000Z`)
          .order("appointment_date", { ascending: true }),
        supabase
          .from("profiles")
          .select("email, full_name")
          .order("full_name", { ascending: true }),
      ])

      if (appointmentsResult.error) throw appointmentsResult.error
      if (profilesResult.error) throw profilesResult.error

      setAppointments(appointmentsResult.data || [])
      setProfiles(profilesResult.data || [])
      setLastUpdated(new Date())
    } catch (err) {
      console.error("Error loading Marketing TV appointments:", err)
      setError(err?.message || "Unable to load appointments.")
      setAppointments([])
      setProfiles([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAppointments(selectedDate)
  }, [selectedDate])

  useEffect(() => {
    const interval = setInterval(() => {
      loadAppointments(selectedDate)
    }, 60000)
    return () => clearInterval(interval)
  }, [selectedDate])

  const today = formatDateForInput(new Date())

  const repNameByEmail = useMemo(
    () => profiles.reduce((map, profile) => {
      const email = normaliseEmail(profile.email)
      const name = String(profile.full_name ?? "").trim()
      if (email && name) map[email] = name
      return map
    }, {}),
    [profiles]
  )

  const visibleAppointments = useMemo(() => {
    if (activeTab === "mastersheet") {
      return appointments.filter((appointment) =>
        isTrueValue(appointment.cps_c) || isTrueValue(appointment.cps_s)
      )
    }

    if (activeTab === "handover") {
      return appointments.filter((appointment) =>
        !isTrueValue(appointment.cps_c) && !isTrueValue(appointment.cps_s)
      )
    }

    return []
  }, [appointments, activeTab])

  const visibleGrouped = useMemo(() => {
    const groups = {}

    visibleAppointments.forEach((appointment) => {
      const branch = display(appointment.branch, "Unassigned")
      if (!groups[branch]) groups[branch] = []
      groups[branch].push(appointment)
    })

    return Object.entries(groups)
      .sort(([a], [b]) => {
        if (a === "Unassigned") return 1
        if (b === "Unassigned") return -1
        return a.localeCompare(b)
      })
      .map(([branch, rows]) => ({ branch, rows }))
  }, [visibleAppointments])

  return (
    <section className="marketing-tv-page">
      <style>{`
        .marketing-tv-page{
          margin:-24px;
          min-height:calc(100vh - 90px);
          background:#f5f6f8;
          color:#172033;
          font-family:Inter,Arial,sans-serif
        }

        .mtv-top-card{
          margin:10px 14px 8px;
          background:#fff;
          border:1px solid #dfe5ea;
          border-radius:8px;
          overflow:hidden;
          box-shadow:0 1px 2px rgba(15,23,42,.04)
        }

        .mtv-hero{
          background:#00304b;
          color:#fff;
          min-height:112px;
          padding:20px 24px 18px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:28px
        }

        .mtv-hero-title-block{min-width:0}

        .mtv-hero h1{
          margin:0;
          font-size:clamp(28px,3vw,46px);
          line-height:1;
          font-weight:700;
          letter-spacing:-1.5px
        }

        .mtv-hero-date{
          margin-top:7px;
          font-size:12px;
          font-weight:600;
          color:#b8cfdb
        }

        .mtv-summary-wrap{
          width:min(560px,55vw);
          font-size:11px;
          background:rgba(255,255,255,.025);
          border-radius:6px;
          overflow:hidden
        }

        .mtv-summary-header,
        .mtv-summary-row{
          display:grid;
          grid-template-columns:minmax(140px,1fr) minmax(315px,1fr);
          align-items:center
        }

        .mtv-summary-header{
          min-height:26px;
          padding:0 9px;
          color:#d7e3e9;
          font-size:10px;
          font-weight:800;
          letter-spacing:.05em
        }

        .mtv-summary-columns,
        .mtv-summary-values{
          display:grid;
          grid-template-columns:repeat(4,34px) minmax(105px,1fr);
          gap:3px;
          text-align:center
        }

        .mtv-summary-columns span,
        .mtv-summary-values span{
          display:flex;
          align-items:center;
          justify-content:center
        }

        .mtv-summary-row{
          gap:8px;
          min-height:26px;
          padding:0 9px;
          border-top:1px solid rgba(255,255,255,.08)
        }

        .mtv-summary-total{
          background:rgba(255,255,255,.07);
          font-weight:800
        }

        .mtv-summary-values span:last-child{
          justify-content:flex-end;
          padding-right:7px
        }

        .mtv-summary-branch{
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis
        }

        .mtv-summary-total .mtv-summary-values span:last-child,
        .mtv-summary-row .mtv-summary-values span:last-child{
          font-variant-numeric:tabular-nums
        }

        .mtv-table-scroll{overflow-x:auto}
        .mtv-table{width:100%;border-collapse:collapse;table-layout:auto}
        .mtv-table-header{background:#f7f9fa}
        .mtv-table th{padding:10px 12px;text-align:left;font-size:10px;font-weight:800;letter-spacing:.05em;color:#66788a;border-bottom:1px solid #dfe5ea;white-space:nowrap}
        .mtv-cell{padding:9px 12px;border-bottom:1px solid #edf0f2;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .mtv-name-cell{font-weight:650;max-width:220px}
        .mtv-time-cell,.mtv-status-cell,.mtv-value-cell{text-align:center}
        .mtv-value-cell{font-variant-numeric:tabular-nums;font-weight:650}
        .mtv-result-cell{font-weight:650}
        .mtv-row-confirmed{background:#f7fcf8}
        .mtv-row-unconfirmed{background:#fffdf6}
        .mtv-row-unassigned{background:#fff8f8}
        .mtv-tick,.mtv-cross{display:inline-flex;align-items:center;justify-content:center}
        .mtv-tick{color:#16834b}.mtv-cross{color:#bd4a4a}
        .mtv-branch-section{margin:0 14px 12px;background:#fff;border:1px solid #dfe5ea;border-radius:8px;overflow:hidden}
        .mtv-branch-title{width:100%;border:0;background:#fff;padding:11px 14px;display:flex;align-items:center;gap:9px;text-align:left;font-weight:750;color:#172033;cursor:pointer}
        .mtv-branch-title:hover{background:#f8fafb}
        .mtv-branch-count{margin-left:auto;font-size:11px;color:#748496;font-weight:650}
      `}</style>

      <div className="mtv-top-card">
        <div className="mtv-hero">
          <div className="mtv-hero-title-block">
            <h1>Marketing TV</h1>
            <div className="mtv-hero-date">{formatDisplayDate(selectedDate)}</div>
          </div>
          <SummaryTable appointments={visibleAppointments} />
        </div>
      </div>

      {error && <div className="mtv-error">{error}</div>}

      <div className="mtv-controls">
        <div className="mtv-date-control">
          <CalendarDays size={16} />
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        </div>
        <button type="button" className="mtv-refresh" onClick={() => loadAppointments(selectedDate)} disabled={loading}>
          <RefreshCw size={15} className={loading ? "mtv-spin" : ""} />
          Refresh
        </button>
        <div className="mtv-tabs">
          <button type="button" className={activeTab === "mastersheet" ? "active" : ""} onClick={() => setActiveTab("mastersheet")}>Mastersheet</button>
          <button type="button" className={activeTab === "handover" ? "active" : ""} onClick={() => setActiveTab("handover")}>Handover</button>
        </div>
        {lastUpdated && <div className="mtv-last-updated">Updated {lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>}
      </div>

      {loading && appointments.length === 0 ? (
        <div className="mtv-loading">Loading appointments...</div>
      ) : visibleGrouped.length === 0 ? (
        <div className="mtv-empty">No appointments for this view.</div>
      ) : (
        visibleGrouped.map(({ branch, rows }) => (
          <BranchSection
            key={branch}
            branch={branch}
            appointments={rows}
            onSelect={onSelectAppointment}
            repNameByEmail={repNameByEmail}
          />
        ))
      )}
    </section>
  )
}

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
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
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

function getDatePart(value) {
  if (!value) return ""
  return String(value).slice(0, 10)
}

function formatTime(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  }
  return String(value).slice(0, 5)
}

function display(value, fallback = "—") {
  const text = String(value ?? "").trim()
  return text || fallback
}

function parseMoney(value) {
  if (value === null || value === undefined || value === "") return 0
  const cleaned = String(value).replace(/[^0-9.-]/g, "")
  const number = Number(cleaned)
  return Number.isFinite(number) ? number : 0
}

function money(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function countTrue(rows, field) {
  return rows.reduce((total, row) => total + (row[field] === true ? 1 : 0), 0)
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

  const total = useMemo(
    () => ({
      h: countTrue(appointments, "cps_h"),
      c: countTrue(appointments, "cps_c"),
      p: countTrue(appointments, "cps_p"),
      s: countTrue(appointments, "cps_s"),
      value: appointments.reduce((sum, row) => sum + parseMoney(row.price_left), 0),
    }),
    [appointments]
  )

  return (
    <div className="mtv-summary-wrap">
      <div className="mtv-summary-title">Branch</div>
      <div className="mtv-summary-grid mtv-summary-head">
        <span>H</span>
        <span>C</span>
        <span>P</span>
        <span>S</span>
        <span>£</span>
      </div>

      <div className="mtv-summary-row mtv-summary-total">
        <span>Total</span>
        <div className="mtv-summary-values">
          <span>{total.h}</span>
          <span>{total.c}</span>
          <span>{total.p}</span>
          <span>{total.s}</span>
          <span>{money(total.value)}</span>
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
              <span>{money(rows.reduce((sum, row) => sum + parseMoney(row.price_left), 0))}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatusTick({ value }) {
  if (value === true) {
    return <span className="mtv-tick"><Check size={13} /></span>
  }
  return <span className="mtv-cross"><X size={13} /></span>
}

function AppointmentRow({ appointment, onSelect }) {
  return (
    <button
      type="button"
      className="mtv-appointment-row"
      onClick={() => onSelect?.(appointment)}
    >
      <div className="mtv-cell mtv-name-cell" title={appointment.name || "Unnamed customer"}>
        {display(appointment.name, "Unnamed customer")}
      </div>
      <div className="mtv-cell">{display(appointment.branch)}</div>
      <div className="mtv-cell">{display(appointment.rep_allocated)}</div>
      <div className="mtv-cell mtv-time-cell">{formatTime(appointment.appointment_date)}</div>
      <div className="mtv-cell">{display(appointment.postcode)}</div>
      <div className="mtv-cell">{display(appointment.product)}</div>
      <div className="mtv-cell">{display(appointment.lead_source)}</div>
      <div className="mtv-cell"><StatusTick value={Boolean(appointment.rep_confirmed_time)} /></div>
      <div className="mtv-cell"><StatusTick value={Boolean(appointment.was_picked_up || appointment.pickup_rep)} /></div>
      <div className="mtv-cell mtv-result-cell">{display(appointment.result)}</div>
      <div className="mtv-cell">{appointment.epvs_calculation ? "✓" : "—"}</div>
    </button>
  )
}

function BranchSection({ branch, appointments, onSelect }) {
  const [open, setOpen] = useState(true)

  const sorted = [...appointments].sort((a, b) => {
    const aTime = new Date(a.appointment_date || 0).getTime()
    const bTime = new Date(b.appointment_date || 0).getTime()
    return aTime - bTime
  })

  return (
    <section className="mtv-branch-section">
      <button type="button" className="mtv-branch-title" onClick={() => setOpen((value) => !value)}>
        <span>{branch}</span>
        <span className="mtv-branch-count">{appointments.length}</span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {open && (
        <div className="mtv-table-scroll">
          <div className="mtv-table">
            <div className="mtv-table-header">
              <span>NAME</span>
              <span>BRANCH</span>
              <span>REP</span>
              <span>TIME</span>
              <span>POSTCODE</span>
              <span>MEASURE</span>
              <span>LEAD SOURCE</span>
              <span>REP</span>
              <span>PICKUP</span>
              <span>RESULT</span>
              <span>SURVEY</span>
            </div>
            {sorted.map((appointment) => (
              <AppointmentRow
                key={appointment.appointment_row_id}
                appointment={appointment}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export default function MarketingTV({ onSelectAppointment }) {
  const [selectedDate, setSelectedDate] = useState(formatDateForInput(new Date()))
  const [appointments, setAppointments] = useState([])
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
      const start = `${date}T00:00:00`
      const endDate = new Date(`${date}T00:00:00`)
      endDate.setDate(endDate.getDate() + 1)
      const end = endDate.toISOString()

      const { data, error: supabaseError } = await supabase
        .from("appointments")
        .select("*")
        .gte("appointment_date", start)
        .lt("appointment_date", end)
        .order("appointment_date", { ascending: true })

      if (supabaseError) throw supabaseError

      setAppointments(data || [])
      setLastUpdated(new Date())
    } catch (err) {
      console.error("Error loading Marketing TV appointments:", err)
      setError(err?.message || "Unable to load appointments.")
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAppointments(selectedDate)
  }, [selectedDate])

  useEffect(() => {
    const interval = setInterval(() => loadAppointments(selectedDate), 60 * 1000)
    return () => clearInterval(interval)
  }, [selectedDate])

  const grouped = useMemo(() => {
    const groups = {}
    appointments.forEach((appointment) => {
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
  }, [appointments])

  const today = formatDateForInput(new Date())

  return (
    <section className="marketing-tv-page">
      <style>{`
        .marketing-tv-page {
          margin: -24px;
          min-height: calc(100vh - 90px);
          background: #f5f6f8;
          color: #172033;
          font-family: Inter, Arial, sans-serif;
        }
        .mtv-hero {
          background: #00304b;
          color: #fff;
          min-height: 132px;
          padding: 26px 48px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 28px;
        }
        .mtv-hero h1 {
          margin: 0;
          font-size: clamp(30px, 3.2vw, 52px);
          line-height: 1;
          font-weight: 700;
          letter-spacing: -1.5px;
        }
        .mtv-summary-wrap {
          width: min(440px, 55vw);
          font-size: 11px;
          background: rgba(255,255,255,.03);
          border-top: 1px solid rgba(255,255,255,.08);
          border-left: 1px solid rgba(255,255,255,.05);
        }
        .mtv-summary-title {
          position: absolute;
          margin-left: -44px;
          margin-top: 3px;
          font-size: 10px;
          color: #fff;
          opacity: .9;
        }
        .mtv-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 28px) minmax(75px, 1fr);
          justify-content: end;
          gap: 4px;
          text-align: right;
        }
        .mtv-summary-head {
          height: 18px;
          align-items: center;
          padding: 0 8px;
          color: #cbd8df;
          background: rgba(255,255,255,.035);
        }
        .mtv-summary-row {
          display: grid;
          grid-template-columns: minmax(110px, 1fr) minmax(215px, 1fr);
          gap: 10px;
          align-items: center;
          min-height: 23px;
          padding: 0 8px;
          border-top: 1px solid rgba(255,255,255,.08);
        }
        .mtv-summary-total {
          background: rgba(255,255,255,.045);
          font-weight: 700;
        }
        .mtv-summary-values {
          display: grid;
          grid-template-columns: repeat(4, 28px) minmax(75px, 1fr);
          gap: 4px;
          text-align: right;
        }
        .mtv-summary-branch { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mtv-controls-wrap {
          padding: 12px 18px 0;
        }
        .mtv-controls {
          background: #fff;
          border: 1px solid #e1e5ea;
          border-radius: 8px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .mtv-date-control {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #e1e5ea;
          border-radius: 6px;
          padding: 7px 10px;
          background: #fff;
          color: #475569;
          font-size: 12px;
        }
        .mtv-date-control input {
          border: 0;
          outline: 0;
          font: inherit;
          color: #475569;
          background: transparent;
        }
        .mtv-today-button {
          border: 0;
          border-radius: 6px;
          background: #2d9bf0;
          color: #fff;
          padding: 8px 30px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .mtv-main {
          margin: 8px 18px 24px;
          background: #fff;
          border: 1px solid #e1e5ea;
          border-radius: 8px;
          overflow: hidden;
        }
        .mtv-tabs {
          height: 40px;
          display: flex;
          align-items: flex-end;
          gap: 28px;
          padding: 0 18px;
          border-bottom: 1px solid #e5e7eb;
        }
        .mtv-tab {
          border: 0;
          background: transparent;
          padding: 0 0 9px;
          font-size: 10px;
          color: #64748b;
          cursor: pointer;
          position: relative;
        }
        .mtv-tab.active { color: #172033; font-weight: 700; }
        .mtv-tab.active:after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: -1px;
          height: 2px;
          background: #2698ed;
        }
        .mtv-content { padding: 10px 18px 22px; }
        .mtv-date-title {
          color: #2398ed;
          font-size: 11px;
          font-weight: 800;
          margin: 0 0 12px;
        }
        .mtv-toolbar {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 4px;
        }
        .mtv-refresh {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid #e2e6ea;
          background: #f8f9fa;
          color: #64748b;
          border-radius: 5px;
          padding: 6px 9px;
          font-size: 10px;
          cursor: pointer;
        }
        .mtv-refresh:disabled { opacity: .55; cursor: default; }
        .mtv-branch-section { margin-top: 12px; }
        .mtv-branch-title {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          border: 0;
          background: transparent;
          color: #2398ed;
          text-align: left;
          font-size: 17px;
          font-weight: 800;
          padding: 0 0 7px;
          cursor: pointer;
        }
        .mtv-branch-count {
          font-size: 10px;
          font-weight: 700;
          color: #94a3b8;
          margin-left: 2px;
        }
        .mtv-table-scroll { overflow-x: auto; }
        .mtv-table { min-width: 1080px; }
        .mtv-table-header, .mtv-appointment-row {
          display: grid;
          grid-template-columns: minmax(175px, 1.55fr) 58px minmax(105px, 1fr) 54px 72px minmax(85px, .9fr) minmax(105px, 1.05fr) 38px 48px minmax(85px, .9fr) 50px;
          gap: 7px;
          align-items: center;
        }
        .mtv-table-header {
          color: #64748b;
          font-size: 7px;
          font-weight: 800;
          padding: 0 4px 6px;
          border-bottom: 1px solid #e7eaee;
        }
        .mtv-appointment-row {
          width: 100%;
          border: 0;
          border-bottom: 1px solid #edf0f2;
          background: #fff;
          padding: 7px 4px;
          text-align: left;
          color: #172033;
          font: inherit;
          font-size: 9px;
          cursor: pointer;
        }
        .mtv-appointment-row:nth-child(even) { background: #fafafa; }
        .mtv-appointment-row:hover { background: #f2f8fd; }
        .mtv-cell { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .mtv-name-cell { font-weight: 700; }
        .mtv-time-cell { font-weight: 600; }
        .mtv-result-cell { font-weight: 600; }
        .mtv-tick, .mtv-cross { display: inline-flex; align-items: center; justify-content: center; }
        .mtv-tick { color: #249cf1; }
        .mtv-cross { color: #b7bdc5; }
        .mtv-empty {
          padding: 70px 20px;
          text-align: center;
          color: #94a3b8;
          font-size: 13px;
        }
        .mtv-error {
          margin: 10px 18px 0;
          padding: 10px 12px;
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #991b1b;
          border-radius: 7px;
          font-size: 12px;
        }
        .mtv-placeholder {
          min-height: 400px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          font-size: 13px;
        }
        .mtv-last-updated {
          padding: 0 18px 18px;
          color: #a1aab5;
          font-size: 9px;
        }
        @media (max-width: 850px) {
          .marketing-tv-page { margin: -16px; }
          .mtv-hero { padding: 22px 24px; align-items: flex-start; flex-direction: column; }
          .mtv-summary-wrap { width: 100%; }
          .mtv-summary-title { display: none; }
        }
      `}</style>

      <div className="mtv-hero">
        <h1>Marketing TV</h1>
        <SummaryTable appointments={appointments} />
      </div>

      <div className="mtv-controls-wrap">
        <div className="mtv-controls">
          <label className="mtv-date-control">
            <CalendarDays size={13} />
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="mtv-today-button"
            onClick={() => setSelectedDate(today)}
          >
            <Clock3 size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />
            Today
          </button>
        </div>
      </div>

      {error && <div className="mtv-error">{error}</div>}

      <div className="mtv-main">
        <div className="mtv-tabs">
          <button className={`mtv-tab ${activeTab === "mastersheet" ? "active" : ""}`} onClick={() => setActiveTab("mastersheet")}>
            Mastersheet
          </button>
          <button className={`mtv-tab ${activeTab === "handover" ? "active" : ""}`} onClick={() => setActiveTab("handover")}>
            Handover
          </button>
          <button className={`mtv-tab ${activeTab === "sales-schedule" ? "active" : ""}`} onClick={() => setActiveTab("sales-schedule")}>
            Sales Schedule
          </button>
        </div>

        {activeTab === "mastersheet" ? (
          <div className="mtv-content">
            <div className="mtv-toolbar">
              <button type="button" className="mtv-refresh" onClick={() => loadAppointments()} disabled={loading}>
                <RefreshCw size={12} />
                {loading ? "Loading" : "Refresh"}
              </button>
            </div>

            <div className="mtv-date-title">
              {loading ? "Loading..." : `${appointments.length} appointments · ${formatDisplayDate(selectedDate)}`}
            </div>

            {loading ? (
              <div className="mtv-empty">Loading appointments...</div>
            ) : grouped.length === 0 ? (
              <div className="mtv-empty">No appointments found for {formatDisplayDate(selectedDate)}.</div>
            ) : (
              grouped.map(({ branch, rows }) => (
                <BranchSection
                  key={branch}
                  branch={branch}
                  appointments={rows}
                  onSelect={onSelectAppointment}
                />
              ))
            )}
          </div>
        ) : (
          <div className="mtv-placeholder">
            {activeTab === "handover" ? "Handover view coming soon" : "Sales Schedule coming soon"}
          </div>
        )}

        {lastUpdated && (
          <div className="mtv-last-updated">
            Last updated {lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · Auto-refreshes every 60 seconds
          </div>
        )}
      </div>
    </section>
  )
}

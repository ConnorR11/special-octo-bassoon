import React, { useEffect, useMemo, useState } from "lucide-react"
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

  if (match) {
    return `${match[1]}:${match[2]}`
  }

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

function sortBranches(rows) {
  return [
    ...new Set(
      rows.map((row) => display(row.branch, "Unassigned"))
    ),
  ].sort((a, b) => {
    if (a === "Unassigned") return 1
    if (b === "Unassigned") return -1

    return a.localeCompare(b)
  })
}

function SummaryTable({ appointments }) {
  const branches = useMemo(
    () => sortBranches(appointments),
    [appointments]
  )

  return (
    <div className="mtv-summary-wrap">
      <div className="mtv-summary-header">
        <div>BRANCH</div>

        <div className="mtv-summary-columns">
          <span>H</span>
          <span>C</span>
          <span>P</span>
          <span>S</span>
          <span>VALUE</span>
        </div>
      </div>

      <div className="mtv-summary-row mtv-summary-total">
        <span>Total</span>

        <div className="mtv-summary-values">
          <span>{countTrue(appointments, "cps_h")}</span>
          <span>{countTrue(appointments, "cps_c")}</span>
          <span>{countTrue(appointments, "cps_p")}</span>
          <span>{countTrue(appointments, "cps_s")}</span>
          <span className="mtv-coming-soon">Coming soon</span>
        </div>
      </div>

      {branches.map((branch) => {
        const rows = appointments.filter(
          (row) =>
            display(row.branch, "Unassigned") === branch
        )

        return (
          <div
            className="mtv-summary-row"
            key={branch}
          >
            <span className="mtv-summary-branch">
              {branch}
            </span>

            <div className="mtv-summary-values">
              <span>{countTrue(rows, "cps_h")}</span>
              <span>{countTrue(rows, "cps_c")}</span>
              <span>{countTrue(rows, "cps_p")}</span>
              <span>{countTrue(rows, "cps_s")}</span>
              <span className="mtv-coming-soon">
                Coming soon
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatusTick({ value }) {
  return value ? (
    <span className="mtv-tick">
      <Check size={13} />
    </span>
  ) : (
    <span className="mtv-cross">
      <X size={13} />
    </span>
  )
}

function AppointmentRow({
  appointment,
  onSelect,
  repNameByEmail,
}) {
  const repEmail = appointment.rep_allocated

  const repName =
    repNameByEmail[normaliseEmail(repEmail)] ||
    repEmail

  const hasRep = Boolean(
    String(repEmail ?? "").trim()
  )

  const repConfirmed = Boolean(
    appointment.rep_confirmed_time
  )

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
      <td
        className="mtv-cell mtv-name-cell"
        title={
          appointment.name ||
          "Unnamed customer"
        }
      >
        {display(
          appointment.name,
          "Unnamed customer"
        )}
      </td>

      <td
        className="mtv-cell"
        title={display(appointment.branch)}
      >
        {display(appointment.branch)}
      </td>

      <td
        className="mtv-cell"
        title={display(repName)}
      >
        {display(repName)}
      </td>

      <td className="mtv-cell mtv-time-cell">
        {formatTime(
          appointment.appointment_date
        )}
      </td>

      <td className="mtv-cell">
        {display(appointment.postcode)}
      </td>

      <td className="mtv-cell">
        {display(appointment.product)}
      </td>

      <td className="mtv-cell">
        {display(appointment.lead_source)}
      </td>

      <td className="mtv-cell mtv-status-cell">
        <StatusTick
          value={Boolean(
            appointment.was_picked_up ||
            appointment.pickup_rep
          )}
        />
      </td>

      <td className="mtv-cell mtv-result-cell">
        {display(appointment.result)}
      </td>

      <td className="mtv-cell mtv-status-cell">
        {appointment.epvs_calculation
          ? "✓"
          : "—"}
      </td>
    </tr>
  )
}

function BranchSection({
  branch,
  appointments,
  onSelect,
  repNameByEmail,
}) {
  const [open, setOpen] = useState(true)

  const sorted = [...appointments].sort(
    (a, b) =>
      String(a.appointment_date || "").localeCompare(
        String(b.appointment_date || "")
      )
  )

  return (
    <section className="mtv-branch-section">
      <button
        type="button"
        className="mtv-branch-title"
        onClick={() =>
          setOpen((value) => !value)
        }
      >
        <span>{branch}</span>

        <span className="mtv-branch-count">
          {appointments.length}
        </span>

        {open ? (
          <ChevronUp size={18} />
        ) : (
          <ChevronDown size={18} />
        )}
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
                <th>SURVEY</th>
              </tr>
            </thead>

            <tbody>
              {sorted.map((appointment) => (
                <AppointmentRow
                  key={
                    appointment.appointment_row_id
                  }
                  appointment={appointment}
                  onSelect={onSelect}
                  repNameByEmail={
                    repNameByEmail
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function MarketingTV({
  onSelectAppointment,
}) {
  const [selectedDate, setSelectedDate] =
    useState(
      formatDateForInput(new Date())
    )

  const [appointments, setAppointments] =
    useState([])

  const [profiles, setProfiles] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState("")

  const [activeTab, setActiveTab] =
    useState("mastersheet")

  const [lastUpdated, setLastUpdated] =
    useState(null)

  async function loadAppointments(
    date = selectedDate
  ) {
    if (!supabase) {
      setError(
        "Supabase is not configured. Check your environment variables."
      )

      setLoading(false)

      return
    }

    setLoading(true)
    setError("")

    try {
      const endDate = new Date(
        `${date}T00:00:00Z`
      )

      endDate.setUTCDate(
        endDate.getUTCDate() + 1
      )

      const nextDate = `${endDate.getUTCFullYear()}-${String(
        endDate.getUTCMonth() + 1
      ).padStart(2, "0")}-${String(
        endDate.getUTCDate()
      ).padStart(2, "0")}`

      const [
        appointmentsResult,
        profilesResult,
      ] = await Promise.all([
        supabase
          .from("appointments")
          .select("*")
          .gte(
            "appointment_date",
            `${date}T00:00:00.000Z`
          )
          .lt(
            "appointment_date",
            `${nextDate}T00:00:00.000Z`
          )
          .order(
            "appointment_date",
            { ascending: true }
          ),

        supabase
          .from("profiles")
          .select(
            "email, full_name"
          )
          .order(
            "full_name",
            { ascending: true }
          ),
      ])

      if (appointmentsResult.error) {
        throw appointmentsResult.error
      }

      if (profilesResult.error) {
        throw profilesResult.error
      }

      setAppointments(
        appointmentsResult.data || []
      )

      setProfiles(
        profilesResult.data || []
      )

      setLastUpdated(new Date())
    } catch (err) {
      console.error(
        "Error loading Marketing TV appointments:",
        err
      )

      setError(
        err?.message ||
          "Unable to load appointments."
      )

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

  const today =
    formatDateForInput(new Date())

  const repNameByEmail = useMemo(
    () =>
      profiles.reduce(
        (map, profile) => {
          const email =
            normaliseEmail(
              profile.email
            )

          const name =
            String(
              profile.full_name ?? ""
            ).trim()

          if (email && name) {
            map[email] = name
          }

          return map
        },
        {}
      ),
    [profiles]
  )

  /*
   * MARKETING TV LOGIC
   *
   * Mastersheet:
   * Show an appointment when C OR S is true.
   *
   * Handover:
   * Show an appointment when neither C nor S is true.
   *
   * We deliberately do NOT remove duplicates.
   * If two appointment records exist, both remain visible.
   */
  const visibleAppointments = useMemo(() => {
    if (activeTab === "mastersheet") {
      return appointments.filter(
        (appointment) =>
          isTrueValue(
            appointment.cps_c
          ) ||
          isTrueValue(
            appointment.cps_s
          )
      )
    }

    if (activeTab === "handover") {
      return appointments.filter(
        (appointment) =>
          !isTrueValue(
            appointment.cps_c
          ) &&
          !isTrueValue(
            appointment.cps_s
          )
      )
    }

    return []
  }, [
    appointments,
    activeTab,
  ])

  const visibleGrouped = useMemo(() => {
    const groups = {}

    visibleAppointments.forEach(
      (appointment) => {
        const branch = display(
          appointment.branch,
          "Unassigned"
        )

        if (!groups[branch]) {
          groups[branch] = []
        }

        groups[branch].push(
          appointment
        )
      }
    )

    return Object.entries(groups)
      .sort(([a], [b]) => {
        if (a === "Unassigned") return 1
        if (b === "Unassigned") return -1

        return a.localeCompare(b)
      })
      .map(
        ([branch, rows]) => ({
          branch,
          rows,
        })
      )
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

        .mtv-hero-title-block{
          min-width:0
        }

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

        .mtv-coming-soon{
          color:#b9cbd4;
          font-weight:600;
          font-size:10px
        }

        .mtv-controls-wrap{
          padding:10px 14px;
          background:#fff;
          border-top:1px solid #e6eaee
        }

        .mtv-controls{
          display:flex;
          align-items:center;
          gap:8px
        }

        .mtv-date-control{
          display:inline-flex;
          align-items:center;
          gap:7px;
          border:1px solid #e1e5ea;
          border-radius:6px;
          padding:6px 9px;
          background:#fff;
          color:#475569;
          font-size:11px
        }

        .mtv-date-label{
          font-size:10px;
          font-weight:700;
          color:#64748b
        }

        .mtv-date-control input{
          border:0;
          outline:0;
          font:inherit;
          color:#475569;
          background:transparent
        }

        .mtv-today-button{
          border:0;
          border-radius:6px;
          background:#2d9bf0;
          color:#fff;
          padding:7px 24px;
          font-size:11px;
          font-weight:700;
          cursor:pointer
        }

        .mtv-main{
          margin:0 14px 20px;
          background:#fff;
          border:1px solid #e1e5ea;
          border-radius:7px;
          overflow:hidden
        }

        .mtv-tabs{
          height:38px;
          display:flex;
          align-items:flex-end;
          gap:24px;
          padding:0 16px;
          border-bottom:1px solid #e5e7eb
        }

        .mtv-tab{
          border:0;
          background:transparent;
          padding:0 0 8px;
          font-size:10px;
          color:#64748b;
          cursor:pointer;
          position:relative
        }

        .mtv-tab.active{
          color:#172033;
          font-weight:700
        }

        .mtv-tab.active:after{
          content:"";
          position:absolute;
          left:0;
          right:0;
          bottom:-1px;
          height:2px;
          background:#2698ed
        }

        .mtv-content{
          padding:8px 10px 14px
        }

        .mtv-date-title{
          color:#2398ed;
          font-size:13px;
          font-weight:800;
          margin:0 0 9px
        }

        .mtv-toolbar{
          display:flex;
          justify-content:flex-end;
          margin-bottom:3px
        }

        .mtv-refresh{
          display:inline-flex;
          align-items:center;
          gap:5px;
          border:1px solid #e2e6ea;
          background:#f8f9fa;
          color:#64748b;
          border-radius:5px;
          padding:5px 8px;
          font-size:9px;
          cursor:pointer
        }

        .mtv-refresh:disabled{
          opacity:.55;
          cursor:default
        }

        .mtv-branch-section{
          margin-top:10px
        }

        .mtv-branch-title{
          width:100%;
          display:flex;
          align-items:center;
          gap:7px;
          border:0;
          background:transparent;
          color:#2398ed;
          text-align:left;
          font-size:18px;
          font-weight:800;
          padding:0 0 4px;
          cursor:pointer
        }

        .mtv-branch-count{
          font-size:9px;
          font-weight:700;
          color:#94a3b8;
          margin-left:1px
        }

        .mtv-table-scroll{
          width:100%;
          overflow-x:auto;
          border:1px solid #e5e9ee;
          border-radius:5px;
          background:#fff
        }

        .mtv-table{
          width:100%;
          min-width:0;
          border-collapse:separate;
          border-spacing:0;
          table-layout:fixed
        }

        .mtv-table th:nth-child(1),
        .mtv-table td:nth-child(1){
          width:18%
        }

        .mtv-table th:nth-child(2),
        .mtv-table td:nth-child(2){
          width:10%
        }

        .mtv-table th:nth-child(3),
        .mtv-table td:nth-child(3){
          width:14%
        }

        .mtv-table th:nth-child(4),
        .mtv-table td:nth-child(4){
          width:7%
        }

        .mtv-table th:nth-child(5),
        .mtv-table td:nth-child(5){
          width:9%
        }

        .mtv-table th:nth-child(6),
        .mtv-table td:nth-child(6){
          width:8%
        }

        .mtv-table th:nth-child(7),
        .mtv-table td:nth-child(7){
          width:14%
        }

        .mtv-table th:nth-child(8),
        .mtv-table td:nth-child(8){
          width:5%
        }

        .mtv-table th:nth-child(9),
        .mtv-table td:nth-child(9){
          width:8%
        }

        .mtv-table th:nth-child(10),
        .mtv-table td:nth-child(10){
          width:7%
        }

        .mtv-table-header th{
          padding:6px 8px;
          background:#f7f9fb;
          border-bottom:1px solid #dfe5ea;
          color:#64748b;
          font-size:8px;
          font-weight:800;
          line-height:1;
          letter-spacing:.04em;
          text-align:left;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis
        }

        .mtv-table-header th:first-child{
          padding-left:10px
        }

        .mtv-table-header th:last-child{
          padding-right:10px
        }

        .mtv-appointment-row{
          cursor:pointer
        }

        .mtv-appointment-row td{
          padding:7px 8px;
          border-bottom:1px solid #edf0f3;
          color:#172033;
          font-size:12px;
          line-height:1.15;
          white-space:nowrap;
          vertical-align:middle;
          overflow:hidden;
          text-overflow:ellipsis
        }

        .mtv-appointment-row td:first-child{
          padding-left:10px
        }

        .mtv-appointment-row td:last-child{
          padding-right:10px
        }

        .mtv-appointment-row:nth-child(even) td{
          background:#fbfcfd
        }

        /*
         * SUBTLE REP STATUS ROW COLOURS
         *
         * No rep assigned = light red
         * Rep assigned but not confirmed = light orange
         * Rep assigned and confirmed = subtle HomeShield blue
         *
         * The text itself remains the normal dark colour for readability.
         */
        .mtv-appointment-row.mtv-row-unassigned td{
          background:#fff4f4
        }

        .mtv-appointment-row.mtv-row-unconfirmed td{
          background:#fff8ee
        }

        .mtv-appointment-row.mtv-row-confirmed td{
          background:#eef8ff
        }

        .mtv-appointment-row:hover td{
          background:#eaf5ff
        }

        .mtv-cell{
          max-width:none
        }

        .mtv-name-cell{
          font-weight:700
        }

        .mtv-time-cell{
          font-weight:700
        }

        .mtv-result-cell{
          font-weight:600
        }

        .mtv-status-cell{
          text-align:center
        }

        .mtv-tick,
        .mtv-cross{
          display:inline-flex;
          width:18px;
          height:18px;
          align-items:center;
          justify-content:center;
          border-radius:50%
        }

        .mtv-tick{
          color:#249cf1;
          background:#eaf6ff
        }

        .mtv-cross{
          color:#b7bdc5;
          background:#f3f5f7
        }

        .mtv-empty{
          padding:60px 20px;
          text-align:center;
          color:#94a3b8;
          font-size:12px
        }

        .mtv-error{
          margin:8px 14px 0;
          padding:9px 11px;
          border:1px solid #fecaca;
          background:#fef2f2;
          color:#991b1b;
          border-radius:6px;
          font-size:11px
        }

        .mtv-placeholder{
          min-height:340px;
          display:flex;
          align-items:center;
          justify-content:center;
          color:#94a3b8;
          font-size:12px
        }

        .mtv-last-updated{
          padding:0 14px 14px;
          color:#a1aab5;
          font-size:8px
        }

        @media(max-width:1100px){
          .mtv-hero{
            align-items:flex-start;
            flex-direction:column;
            gap:16px
          }

          .mtv-summary-wrap{
            width:100%
          }
        }

        @media(max-width:850px){
          .marketing-tv-page{
            margin:-16px
          }

          .mtv-top-card{
            margin:8px 10px 7px
          }

          .mtv-main{
            margin:0 10px 16px
          }

          .mtv-hero{
            padding:18px
          }

          .mtv-controls-wrap{
            padding:10px 12px
          }

          .mtv-date-label{
            display:none
          }

          .mtv-table{
            min-width:900px
          }
        }
      `}</style>

      <div className="mtv-top-card">
        <div className="mtv-hero">
          <div className="mtv-hero-title-block">
            <h1>Marketing TV</h1>

            <div className="mtv-hero-date">
              {formatDisplayDate(
                selectedDate
              )}
            </div>
          </div>

          <SummaryTable
            appointments={appointments}
          />
        </div>

        <div className="mtv-controls-wrap">
          <div className="mtv-controls">
            <span className="mtv-date-label">
              Viewing date
            </span>

            <label className="mtv-date-control">
              <CalendarDays size={14} />

              <input
                type="date"
                value={selectedDate}
                onChange={(event) =>
                  setSelectedDate(
                    event.target.value
                  )
                }
              />
            </label>

            <button
              type="button"
              className="mtv-today-button"
              onClick={() =>
                setSelectedDate(today)
              }
            >
              <Clock3
                size={13}
                style={{
                  verticalAlign: "-2px",
                  marginRight: 5,
                }}
              />

              Today
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mtv-error">
          {error}
        </div>
      )}

      <div className="mtv-main">
        <div className="mtv-tabs">
          <button
            className={`mtv-tab ${
              activeTab === "mastersheet"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActiveTab(
                "mastersheet"
              )
            }
          >
            Mastersheet
          </button>

          <button
            className={`mtv-tab ${
              activeTab === "handover"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActiveTab("handover")
            }
          >
            Handover
          </button>

          <button
            className={`mtv-tab ${
              activeTab ===
              "sales-schedule"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActiveTab(
                "sales-schedule"
              )
            }
          >
            Sales Schedule
          </button>
        </div>

        {activeTab === "mastersheet" ||
        activeTab === "handover" ? (
          <div className="mtv-content">
            <div className="mtv-toolbar">
              <button
                type="button"
                className="mtv-refresh"
                onClick={() =>
                  loadAppointments()
                }
                disabled={loading}
              >
                <RefreshCw size={12} />

                {loading
                  ? "Loading"
                  : "Refresh"}
              </button>
            </div>

            <div className="mtv-date-title">
              {loading
                ? "Loading..."
                : `${visibleAppointments.length} appointments · ${formatDisplayDate(
                    selectedDate
                  )}`}
            </div>

            {loading ? (
              <div className="mtv-empty">
                Loading appointments...
              </div>
            ) : visibleGrouped.length ===
              0 ? (
              <div className="mtv-empty">
                No appointments found for{" "}
                {formatDisplayDate(
                  selectedDate
                )}
                .
              </div>
            ) : (
              visibleGrouped.map(
                ({
                  branch,
                  rows,
                }) => (
                  <BranchSection
                    key={branch}
                    branch={branch}
                    appointments={rows}
                    onSelect={
                      onSelectAppointment
                    }
                    repNameByEmail={
                      repNameByEmail
                    }
                  />
                )
              )
            )}
          </div>
        ) : (
          <div className="mtv-placeholder">
            Sales Schedule coming soon
          </div>
        )}

        {lastUpdated && (
          <div className="mtv-last-updated">
            Last updated{" "}
            {lastUpdated.toLocaleTimeString(
              "en-GB",
              {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }
            )}{" "}
            · Auto-refreshes every 60 seconds
          </div>
        )}
      </div>
    </section>
  )
}
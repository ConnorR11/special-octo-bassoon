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


/* =========================================================
   DATE / DISPLAY HELPERS
========================================================= */

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


/* =========================================================
   COUNT HELPERS
========================================================= */

function countTrue(rows, field) {
  return rows.reduce(
    (total, row) => total + (row[field] === true ? 1 : 0),
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


/* =========================================================
   SUMMARY TABLE
========================================================= */

/*
  IMPORTANT:

  This summary is deliberately based on ALL appointments
  loaded for the selected date.

  It does NOT use visibleAppointments.

  Therefore changing between:
    - Mastersheet
    - Handover
    - Sales Schedule

  will NOT change the numbers in this summary.
*/

function SummaryTable({ appointments }) {
  const branches = useMemo(
    () => sortBranches(appointments),
    [appointments]
  )

  return (
    <div className="mtv-summary-wrap">

      {/* Header */}
      <div className="mtv-summary-header">

        <div className="mtv-summary-branch-heading">
          BRANCH
        </div>

        <div className="mtv-summary-columns">
          <span>H</span>
          <span>C</span>
          <span>P</span>
          <span>S</span>
          <span className="mtv-summary-value-heading">
            VALUE
          </span>
        </div>

      </div>


      {/* Total */}
      <div className="mtv-summary-row mtv-summary-total">

        <span className="mtv-summary-branch">
          Total
        </span>

        <div className="mtv-summary-values">

          <span>
            {countTrue(appointments, "cps_h")}
          </span>

          <span>
            {countTrue(appointments, "cps_c")}
          </span>

          <span>
            {countTrue(appointments, "cps_p")}
          </span>

          <span>
            {countTrue(appointments, "cps_s")}
          </span>

          <span className="mtv-coming-soon">
            Coming soon
          </span>

        </div>

      </div>


      {/* Branch rows */}
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

              <span>
                {countTrue(rows, "cps_h")}
              </span>

              <span>
                {countTrue(rows, "cps_c")}
              </span>

              <span>
                {countTrue(rows, "cps_p")}
              </span>

              <span>
                {countTrue(rows, "cps_s")}
              </span>

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


/* =========================================================
   STATUS ICON
========================================================= */

function StatusTick({ value }) {
  if (value === true) {
    return (
      <span className="mtv-tick">
        <Check size={13} />
      </span>
    )
  }

  return (
    <span className="mtv-cross">
      <X size={13} />
    </span>
  )
}


/* =========================================================
   APPOINTMENT ROW
========================================================= */

function AppointmentRow({ appointment, onSelect }) {
  return (
    <tr
      className="mtv-appointment-row"
      onClick={() => onSelect?.(appointment)}
    >

      <td
        className="mtv-cell mtv-name-cell"
        title={appointment.name || "Unnamed customer"}
      >
        {display(
          appointment.name,
          "Unnamed customer"
        )}
      </td>

      <td className="mtv-cell">
        {display(appointment.branch)}
      </td>

      <td className="mtv-cell">
        {display(appointment.rep_allocated)}
      </td>

      <td className="mtv-cell mtv-time-cell">
        {formatTime(appointment.appointment_date)}
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
            appointment.rep_confirmed_time
          )}
        />
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


/* =========================================================
   BRANCH SECTION
========================================================= */

function BranchSection({
  branch,
  appointments,
  onSelect,
}) {
  const [open, setOpen] = useState(true)

  const sorted = [...appointments].sort(
    (a, b) => {
      const aTime = new Date(
        a.appointment_date || 0
      ).getTime()

      const bTime = new Date(
        b.appointment_date || 0
      ).getTime()

      return aTime - bTime
    }
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

        <span>
          {branch}
        </span>

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
                <th>REP</th>
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
                />
              ))}

            </tbody>

          </table>

        </div>
      )}

    </section>
  )
}


/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function MarketingTV({
  onSelectAppointment,
}) {

  const [selectedDate, setSelectedDate] =
    useState(
      formatDateForInput(new Date())
    )

  const [appointments, setAppointments] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState("")

  const [activeTab, setActiveTab] =
    useState("mastersheet")

  const [lastUpdated, setLastUpdated] =
    useState(null)


  /* =======================================================
     LOAD APPOINTMENTS
  ======================================================= */

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

      /*
        IMPORTANT:

        Keep both boundaries based on the selected
        calendar date.

        Previously the end date was converted with
        toISOString(), which can shift the boundary
        because of UTC conversion.
      */

      const startDate = new Date(
        `${date}T00:00:00`
      )

      const endDate = new Date(
        `${date}T00:00:00`
      )

      endDate.setDate(
        endDate.getDate() + 1
      )


      /*
        Convert both to the same format.

        This gives us:
          selected date 00:00
          next date 00:00
      */

      const start =
        `${date}T00:00:00`

      const nextDate =
        formatDateForInput(endDate)

      const end =
        `${nextDate}T00:00:00`


      const {
        data,
        error: supabaseError,
      } = await supabase

        .from("appointments")

        .select("*")

        .gte(
          "appointment_date",
          start
        )

        .lt(
          "appointment_date",
          end
        )

        .order(
          "appointment_date",
          {
            ascending: true,
          }
        )


      if (supabaseError) {
        throw supabaseError
      }


      setAppointments(data || [])

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

    } finally {

      setLoading(false)

    }
  }


  /* =======================================================
     LOAD WHEN DATE CHANGES
  ======================================================= */

  useEffect(() => {

    loadAppointments(selectedDate)

  }, [selectedDate])


  /* =======================================================
     AUTO REFRESH
  ======================================================= */

  useEffect(() => {

    const interval = setInterval(
      () =>
        loadAppointments(selectedDate),
      60 * 1000
    )

    return () =>
      clearInterval(interval)

  }, [selectedDate])


  /* =======================================================
     TODAY
  ======================================================= */

  const today =
    formatDateForInput(new Date())


  /* =======================================================
     TAB FILTERING
  =======================================================

     IMPORTANT:

     The summary does NOT use this.

     These filters only control what appears
     in the main table.
  ======================================================= */

  const visibleAppointments = useMemo(() => {

    if (activeTab === "mastersheet") {

      return appointments.filter(
        (appointment) =>
          appointment.cps_c === true
      )
    }


    if (activeTab === "handover") {

      /*
        Deliberately use !== true.

        This means Handover includes:

          false
          null
          undefined
          ""
          0
          any other value that isn't boolean true

        So only a genuine boolean TRUE in cps_c
        is excluded.
      */

      return appointments.filter(
        (appointment) =>
          appointment.cps_c !== true
      )
    }


    return []

  }, [
    appointments,
    activeTab,
  ])


  /* =======================================================
     GROUP VISIBLE APPOINTMENTS BY BRANCH
  ======================================================= */

  const visibleGrouped = useMemo(() => {

    const groups = {}


    visibleAppointments.forEach(
      (appointment) => {

        const branch =
          display(
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

        if (a === "Unassigned")
          return 1

        if (b === "Unassigned")
          return -1

        return a.localeCompare(b)

      })

      .map(
        ([branch, rows]) => ({
          branch,
          rows,
        })
      )

  }, [visibleAppointments])


  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <section className="marketing-tv-page">

      <style>{`

        /* =================================================
           PAGE
        ================================================= */

        .marketing-tv-page {
          margin: -24px;
          min-height: calc(100vh - 90px);
          background: #f5f6f8;
          color: #172033;
          font-family: Inter, Arial, sans-serif;
        }


        /* =================================================
           TOP CARD
        ================================================= */

        .mtv-top-card {
          margin: 14px 18px 10px;
          background: #fff;
          border: 1px solid #dfe5ea;
          border-radius: 10px;
          overflow: hidden;
          box-shadow:
            0 1px 2px rgba(
              15,
              23,
              42,
              .04
            );
        }


        /* =================================================
           HERO
        ================================================= */

        .mtv-hero {
          background: #00304b;
          color: #fff;
          min-height: 128px;
          padding: 24px 30px 22px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          gap: 34px;
        }


        .mtv-hero-title-block {
          min-width: 0;
        }


        .mtv-hero h1 {
          margin: 0;
          font-size:
            clamp(
              30px,
              3.2vw,
              52px
            );
          line-height: 1;
          font-weight: 700;
          letter-spacing: -1.5px;
        }


        .mtv-hero-date {
          margin-top: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #b8cfdb;
        }


        /* =================================================
           SUMMARY
        ================================================= */

        .mtv-summary-wrap {
          width:
            min(
              585px,
              58vw
            );

          font-size: 12px;

          background:
            rgba(
              255,
              255,
              255,
              .025
            );

          border-radius: 6px;
          overflow: hidden;
        }


        .mtv-summary-header {
          display: grid;

          grid-template-columns:
            minmax(150px, 1fr)
            minmax(330px, 1fr);

          align-items: center;

          min-height: 28px;

          padding:
            0 10px;

          color: #d7e3e9;

          font-size: 11px;
          font-weight: 800;
          letter-spacing: .05em;
        }


        .mtv-summary-branch-heading {
          text-align: left;
        }


        .mtv-summary-columns {
          display: grid;

          grid-template-columns:
            repeat(4, 36px)
            minmax(115px, 1fr);

          gap: 4px;

          text-align: center;
        }


        .mtv-summary-columns span {
          display: flex;
          align-items: center;
          justify-content: center;
        }


        .mtv-summary-value-heading {
          justify-content: flex-end !important;
          padding-right: 8px;
        }


        .mtv-summary-row {
          display: grid;

          grid-template-columns:
            minmax(150px, 1fr)
            minmax(330px, 1fr);

          gap: 10px;

          align-items: center;

          min-height: 28px;

          padding:
            0 10px;

          border-top:
            1px solid
            rgba(
              255,
              255,
              255,
              .08
            );
        }


        .mtv-summary-total {
          background:
            rgba(
              255,
              255,
              255,
              .07
            );

          font-weight: 800;
        }


        .mtv-summary-values {
          display: grid;

          grid-template-columns:
            repeat(4, 36px)
            minmax(115px, 1fr);

          gap: 4px;

          text-align: center;
        }


        .mtv-summary-values span {
          display: flex;
          align-items: center;
          justify-content: center;

          min-width: 0;
        }


        .mtv-summary-values span:last-child {
          justify-content: flex-end;
          padding-right: 8px;
        }


        .mtv-summary-branch {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }


        .mtv-coming-soon {
          color: #b9cbd4;
          font-weight: 600;
          font-size: 11px;
        }


        /* =================================================
           CONTROLS
        ================================================= */

        .mtv-controls-wrap {
          padding: 12px 18px;
          background: #fff;
          border-top:
            1px solid #e6eaee;
        }


        .mtv-controls {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 10px;
        }


        .mtv-date-control {
          display: inline-flex;
          align-items: center;
          gap: 8px;

          border:
            1px solid #e1e5ea;

          border-radius: 6px;

          padding:
            7px 10px;

          background: #fff;

          color: #475569;

          font-size: 12px;
        }


        .mtv-date-label {
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          margin-right: 2px;
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

          padding:
            8px 30px;

          font-size: 12px;
          font-weight: 700;

          cursor: pointer;
        }


        /* =================================================
           MAIN
        ================================================= */

        .mtv-main {
          margin:
            0 18px 24px;

          background: #fff;

          border:
            1px solid #e1e5ea;

          border-radius: 8px;

          overflow: hidden;
        }


        /* =================================================
           TABS
        ================================================= */

        .mtv-tabs {
          height: 42px;

          display: flex;
          align-items: flex-end;

          gap: 28px;

          padding:
            0 18px;

          border-bottom:
            1px solid #e5e7eb;
        }


        .mtv-tab {
          border: 0;
          background: transparent;

          padding:
            0 0 9px;

          font-size: 10px;
          color: #64748b;

          cursor: pointer;

          position: relative;
        }


        .mtv-tab.active {
          color: #172033;
          font-weight: 700;
        }


        .mtv-tab.active:after {
          content: "";

          position: absolute;

          left: 0;
          right: 0;
          bottom: -1px;

          height: 2px;

          background: #2698ed;
        }


        /* =================================================
           CONTENT
        ================================================= */

        .mtv-content {
          padding:
            10px 14px 18px;
        }


        .mtv-date-title {
          color: #2398ed;

          font-size: 14px;
          font-weight: 800;

          margin:
            0 0 12px;
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

          border:
            1px solid #e2e6ea;

          background: #f8f9fa;

          color: #64748b;

          border-radius: 5px;

          padding:
            6px 9px;

          font-size: 10px;

          cursor: pointer;
        }


        .mtv-refresh:disabled {
          opacity: .55;
          cursor: default;
        }


        /* =================================================
           BRANCH
        ================================================= */

        .mtv-branch-section {
          margin-top: 12px;
        }


        .mtv-branch-title {
          width: 100%;

          display: flex;
          align-items: center;

          gap: 8px;

          border: 0;
          background: transparent;

          color: #2398ed;

          text-align: left;

          font-size: 20px;
          font-weight: 800;

          padding:
            0 0 5px;

          cursor: pointer;
        }


        .mtv-branch-count {
          font-size: 10px;
          font-weight: 700;

          color: #94a3b8;

          margin-left: 2px;
        }


        /* =================================================
           TABLE
        ================================================= */

        .mtv-table-scroll {
          width: 100%;

          overflow-x: auto;

          border:
            1px solid #e5e9ee;

          border-radius: 6px;

          background: #fff;
        }


        .mtv-table {
          width: 100%;

          min-width: 980px;

          border-collapse:
            separate;

          border-spacing: 0;

          table-layout: auto;
        }


        .mtv-table-header th {
          padding:
            7px 10px;

          background: #f7f9fb;

          border-bottom:
            1px solid #dfe5ea;

          color: #64748b;

          font-size: 9px;
          font-weight: 800;

          line-height: 1;

          letter-spacing: .04em;

          text-align: left;

          white-space: nowrap;
        }


        .mtv-table-header th:first-child {
          padding-left: 12px;
        }


        .mtv-table-header th:last-child {
          padding-right: 12px;
        }


        .mtv-appointment-row {
          cursor: pointer;
        }


        .mtv-appointment-row td {
          padding:
            8px 10px;

          border-bottom:
            1px solid #edf0f3;

          color: #172033;

          font-size: 13px;

          line-height: 1.15;

          white-space: nowrap;

          vertical-align: middle;
        }


        .mtv-appointment-row td:first-child {
          padding-left: 12px;
        }


        .mtv-appointment-row td:last-child {
          padding-right: 12px;
        }


        .mtv-appointment-row:nth-child(even) td {
          background: #fbfcfd;
        }


        .mtv-appointment-row:hover td {
          background: #eef7ff;
        }


        .mtv-cell {
          max-width: 280px;

          overflow: hidden;

          text-overflow: ellipsis;
        }


        .mtv-name-cell {
          font-weight: 700;
          max-width: 240px;
        }


        .mtv-time-cell {
          font-weight: 700;
        }


        .mtv-result-cell {
          font-weight: 600;
        }


        .mtv-status-cell {
          width: 1%;
          text-align: center;
        }


        /* =================================================
           STATUS ICONS
        ================================================= */

        .mtv-tick,
        .mtv-cross {
          display: inline-flex;

          width: 20px;
          height: 20px;

          align-items: center;
          justify-content: center;

          border-radius: 50%;
        }


        .mtv-tick {
          color: #249cf1;
          background: #eaf6ff;
        }


        .mtv-cross {
          color: #b7bdc5;
          background: #f3f5f7;
        }


        /* =================================================
           EMPTY / ERROR
        ================================================= */

        .mtv-empty {
          padding:
            70px 20px;

          text-align: center;

          color: #94a3b8;

          font-size: 13px;
        }


        .mtv-error {
          margin:
            10px 18px 0;

          padding:
            10px 12px;

          border:
            1px solid #fecaca;

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
          padding:
            0 18px 18px;

          color: #a1aab5;

          font-size: 9px;
        }


        /* =================================================
           MOBILE
        ================================================= */

        @media (max-width: 850px) {

          .marketing-tv-page {
            margin: -16px;
          }


          .mtv-top-card {
            margin:
              10px 12px 8px;
          }


          .mtv-hero {
            padding:
              22px 22px;

            align-items: flex-start;

            flex-direction: column;

            gap: 18px;
          }


          .mtv-summary-wrap {
            width: 100%;
          }


          .mtv-controls-wrap {
            padding:
              11px 14px;
          }


          .mtv-date-label {
            display: none;
          }

        }

      `}</style>


      {/* =====================================================
          TOP CARD
      ===================================================== */}

      <div className="mtv-top-card">

        <div className="mtv-hero">

          <div className="mtv-hero-title-block">

            <h1>
              Marketing TV
            </h1>

            <div className="mtv-hero-date">
              {formatDisplayDate(
                selectedDate
              )}
            </div>

          </div>


          {/*

            IMPORTANT:

            This receives `appointments`,
            NOT `visibleAppointments`.

            Therefore the summary is independent
            of the selected tab.

          */}

          <SummaryTable
            appointments={appointments}
          />

        </div>


        {/* =================================================
            DATE CONTROLS
        ================================================= */}

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


      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="mtv-error">
          {error}
        </div>
      )}


      {/* =====================================================
          MAIN CARD
      ===================================================== */}

      <div className="mtv-main">


        {/* ===================================================
            TABS
        =================================================== */}

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
              setActiveTab(
                "handover"
              )
            }
          >
            Handover
          </button>


          <button
            className={`mtv-tab ${
              activeTab === "sales-schedule"
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


        {/* ===================================================
            MASTER / HANDOVER
        =================================================== */}

        {activeTab === "mastersheet" ||
        activeTab === "handover" ? (

          <div className="mtv-content">


            {/* =================================================
                REFRESH
            ================================================= */}

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


            {/* =================================================
                DATE / COUNT
            ================================================= */}

            <div className="mtv-date-title">

              {loading
                ? "Loading..."
                : `${visibleAppointments.length} appointments · ${formatDisplayDate(
                    selectedDate
                  )}`}

            </div>


            {/* =================================================
                LOADING
            ================================================= */}

            {loading ? (

              <div className="mtv-empty">
                Loading appointments...
              </div>


            ) : visibleGrouped.length === 0 ? (

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
                  />

                )
              )

            )}

          </div>


        ) : (

          /* =================================================
             SALES SCHEDULE
          ================================================= */

          <div className="mtv-placeholder">
            Sales Schedule coming soon
          </div>

        )}


        {/* ===================================================
            LAST UPDATED
        =================================================== */}

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
            )}

            {" "}· Auto-refreshes every 60 seconds

          </div>

        )}

      </div>

    </section>
  )
}
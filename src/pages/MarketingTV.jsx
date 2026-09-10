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
   DATE / TIME HELPERS
   ========================================================= */

function getLondonOffsetMinutes(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    timeZoneName: "longOffset",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date)

  const offset = parts.find(
    (part) => part.type === "timeZoneName"
  )?.value

  if (!offset || offset === "GMT") {
    return 0
  }

  const match = offset.match(
    /GMT([+-])(\d{2}):?(\d{2})?/
  )

  if (!match) {
    return 0
  }

  const hours = Number(match[2] || 0)
  const minutes = Number(match[3] || 0)

  return (
    (match[1] === "+" ? 1 : -1) *
    (hours * 60 + minutes)
  )
}

function getLondonDayBounds(dateString) {
  const [year, month, day] = dateString
    .split("-")
    .map(Number)

  /*
   * Use midday to determine the correct UK offset
   * for the selected calendar day.
   */
  const selectedNoonUtc = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      12,
      0,
      0
    )
  )

  const selectedOffsetMinutes =
    getLondonOffsetMinutes(selectedNoonUtc)

  /*
   * Start of selected day in London,
   * converted to UTC.
   */
  const startUtc = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      0,
      0,
      0
    ) -
      selectedOffsetMinutes *
        60 *
        1000
  )

  /*
   * Calculate the next calendar day.
   */
  const nextDay = new Date(
    Date.UTC(
      year,
      month - 1,
      day + 1,
      12,
      0,
      0
    )
  )

  const nextOffsetMinutes =
    getLondonOffsetMinutes(nextDay)

  /*
   * Start of next day in London,
   * converted to UTC.
   */
  const endUtc = new Date(
    Date.UTC(
      nextDay.getUTCFullYear(),
      nextDay.getUTCMonth(),
      nextDay.getUTCDate(),
      0,
      0,
      0
    ) -
      nextOffsetMinutes *
        60 *
        1000
  )

  return {
    start: startUtc.toISOString(),
    end: endUtc.toISOString(),
  }
}

function formatDateForInput(date) {
  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(date)

  const values = {}

  parts.forEach((part) => {
    if (part.type !== "literal") {
      values[part.type] = part.value
    }
  })

  return `${values.year}-${values.month}-${values.day}`
}

function formatDisplayDate(value) {
  if (!value) return "—"

  const date = new Date(
    `${value}T12:00:00`
  )

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/London",
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
      timeZone: "Europe/London",
    })
  }

  return String(value).slice(0, 5)
}

/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function display(value, fallback = "—") {
  const text = String(value ?? "").trim()
  return text || fallback
}

function parseMoney(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0
  }

  const cleaned = String(value).replace(
    /[^0-9.-]/g,
    ""
  )

  const number = Number(cleaned)

  return Number.isFinite(number)
    ? number
    : 0
}

function money(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function countTrue(rows, field) {
  return rows.reduce(
    (total, row) =>
      total +
      (row[field] === true ? 1 : 0),
    0
  )
}

function sortBranches(rows) {
  return [
    ...new Set(
      rows.map((row) =>
        display(
          row.branch,
          "Unassigned"
        )
      )
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

function SummaryTable({ appointments }) {
  const branches = useMemo(
    () => sortBranches(appointments),
    [appointments]
  )

  const total = useMemo(
    () => ({
      h: countTrue(
        appointments,
        "cps_h"
      ),

      c: countTrue(
        appointments,
        "cps_c"
      ),

      p: countTrue(
        appointments,
        "cps_p"
      ),

      s: countTrue(
        appointments,
        "cps_s"
      ),

      value: appointments.reduce(
        (sum, row) =>
          sum +
          parseMoney(
            row.price_left
          ),
        0
      ),
    }),
    [appointments]
  )

  return (
    <div className="mtv-summary-wrap">
      <div className="mtv-summary-title">
        Branch
      </div>

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
          <span>
            {money(total.value)}
          </span>
        </div>
      </div>

      {branches.map((branch) => {
        const rows =
          appointments.filter(
            (row) =>
              display(
                row.branch,
                "Unassigned"
              ) === branch
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
                {countTrue(
                  rows,
                  "cps_h"
                )}
              </span>

              <span>
                {countTrue(
                  rows,
                  "cps_c"
                )}
              </span>

              <span>
                {countTrue(
                  rows,
                  "cps_p"
                )}
              </span>

              <span>
                {countTrue(
                  rows,
                  "cps_s"
                )}
              </span>

              <span>
                {money(
                  rows.reduce(
                    (sum, row) =>
                      sum +
                      parseMoney(
                        row.price_left
                      ),
                    0
                  )
                )}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* =========================================================
   STATUS
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

function AppointmentRow({
  appointment,
  onSelect,
}) {
  return (
    <tr
      className="mtv-appointment-row"
      onClick={() =>
        onSelect?.(appointment)
      }
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

      <td className="mtv-cell">
        {display(
          appointment.branch
        )}
      </td>

      <td className="mtv-cell">
        {display(
          appointment.rep_allocated
        )}
      </td>

      <td className="mtv-cell mtv-time-cell">
        {formatTime(
          appointment.appointment_date
        )}
      </td>

      <td className="mtv-cell">
        {display(
          appointment.postcode
        )}
      </td>

      <td className="mtv-cell">
        {display(
          appointment.product
        )}
      </td>

      <td className="mtv-cell">
        {display(
          appointment.lead_source
        )}
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
        {display(
          appointment.result
        )}
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
  const [open, setOpen] =
    useState(true)

  const sorted = [
    ...appointments,
  ].sort((a, b) => {
    const aTime = new Date(
      a.appointment_date || 0
    ).getTime()

    const bTime = new Date(
      b.appointment_date || 0
    ).getTime()

    return aTime - bTime
  })

  return (
    <section className="mtv-branch-section">
      <button
        type="button"
        className="mtv-branch-title"
        onClick={() =>
          setOpen(
            (value) => !value
          )
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
                <th>REP</th>
                <th>PICKUP</th>
                <th>RESULT</th>
                <th>SURVEY</th>
              </tr>
            </thead>

            <tbody>
              {sorted.map(
                (appointment) => (
                  <AppointmentRow
                    key={
                      appointment.appointment_row_id
                    }
                    appointment={
                      appointment
                    }
                    onSelect={
                      onSelect
                    }
                  />
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/* =========================================================
   MAIN MARKETING TV
   ========================================================= */

export default function MarketingTV({
  onSelectAppointment,
}) {
  const [selectedDate, setSelectedDate] =
    useState(
      formatDateForInput(
        new Date()
      )
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
       * Convert the selected UK calendar date
       * into exact UTC boundaries.
       */
      const {
        start,
        end,
      } = getLondonDayBounds(date)

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

      setAppointments(
        data || []
      )

      setLastUpdated(
        new Date()
      )
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
    loadAppointments(
      selectedDate
    )
  }, [selectedDate])

  /* =======================================================
     AUTO REFRESH
     ======================================================= */

  useEffect(() => {
    const interval =
      setInterval(
        () =>
          loadAppointments(
            selectedDate
          ),
        60 * 1000
      )

    return () =>
      clearInterval(interval)
  }, [selectedDate])

  const today =
    formatDateForInput(
      new Date()
    )

  /* =======================================================
     TAB FILTERING
     =======================================================

     Mastersheet:
       CPS C is TRUE

     Handover:
       CPS C is anything other than TRUE.

     This deliberately includes:
       false
       null
       ""
       undefined
       any other non-true value
  */

  const visibleAppointments =
    useMemo(() => {
      if (
        activeTab ===
        "mastersheet"
      ) {
        return appointments.filter(
          (appointment) =>
            appointment.cps_c ===
            true
        )
      }

      if (
        activeTab ===
        "handover"
      ) {
        return appointments.filter(
          (appointment) =>
            appointment.cps_c !==
            true
        )
      }

      return []
    }, [
      appointments,
      activeTab,
    ])

  /* =======================================================
     GROUP BY BRANCH
     ======================================================= */

  const visibleGrouped =
    useMemo(() => {
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

      return Object.entries(
        groups
      )
        .sort(
          ([a], [b]) => {
            if (
              a ===
              "Unassigned"
            )
              return 1

            if (
              b ===
              "Unassigned"
            )
              return -1

            return a.localeCompare(
              b
            )
          }
        )
        .map(
          ([branch, rows]) => ({
            branch,
            rows,
          })
        )
    }, [
      visibleAppointments,
    ])

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

        .mtv-top-card {
          margin: 14px 18px 10px;
          background: #fff;
          border: 1px solid #dfe5ea;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
        }

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
          font-size: clamp(30px, 3.2vw, 52px);
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

        .mtv-summary-wrap {
          width: min(500px, 52vw);
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

        .mtv-summary-branch {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mtv-controls-wrap {
          padding: 12px 18px;
          background: #fff;
          border-top: 1px solid #e6eaee;
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
          border: 1px solid #e1e5ea;
          border-radius: 6px;
          padding: 7px 10px;
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
          padding: 8px 30px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .mtv-main {
          margin: 0 18px 24px;
          background: #fff;
          border: 1px solid #e1e5ea;
          border-radius: 8px;
          overflow: hidden;
        }

        .mtv-tabs {
          height: 42px;
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

        .mtv-content {
          padding: 10px 14px 18px;
        }

        .mtv-date-title {
          color: #2398ed;
          font-size: 14px;
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

        .mtv-refresh:disabled {
          opacity: .55;
          cursor: default;
        }

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
          padding: 0 0 5px;
          cursor: pointer;
        }

        .mtv-branch-count {
          font-size: 10px;
          font-weight: 700;
          color: #94a3b8;
          margin-left: 2px;
        }

        .mtv-table-scroll {
          width: 100%;
          overflow-x: auto;
          border: 1px solid #e5e9ee;
          border-radius: 6px;
          background: #fff;
        }

        .mtv-table {
          width: 100%;
          min-width: 980px;
          border-collapse: separate;
          border-spacing: 0;
          table-layout: auto;
        }

        .mtv-table-header th {
          padding: 7px 10px;
          background: #f7f9fb;
          border-bottom: 1px solid #dfe5ea;
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
          padding: 8px 10px;
          border-bottom: 1px solid #edf0f3;
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
          .marketing-tv-page {
            margin: -16px;
          }

          .mtv-top-card {
            margin: 10px 12px 8px;
          }

          .mtv-hero {
            padding: 22px 22px;
            align-items: flex-start;
            flex-direction: column;
            gap: 18px;
          }

          .mtv-summary-wrap {
            width: 100%;
          }

          .mtv-controls-wrap {
            padding: 11px 14px;
          }

          .mtv-date-label {
            display: none;
          }

          .mtv-summary-title {
            display: none;
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
                setSelectedDate(
                  today
                )
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
              activeTab ===
              "mastersheet"
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
              activeTab ===
              "handover"
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

        {activeTab ===
          "mastersheet" ||
        activeTab ===
          "handover" ? (
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
                timeZone:
                  "Europe/London",
              }
            )}{" "}
            · Auto-refreshes every 60 seconds
          </div>
        )}
      </div>
    </section>
  )
}
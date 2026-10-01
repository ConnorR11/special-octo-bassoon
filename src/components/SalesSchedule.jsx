import React, { useEffect, useMemo, useState } from "react"
import { Car, ChevronDown, ChevronRight } from "lucide-react"
import { supabase } from "../lib/supabase"

const DAY_START_MINUTES = 9 * 60
const DAY_END_MINUTES = 22 * 60
const APPOINTMENT_DURATION_MINUTES = 120

// Sales-specific travel table
const TRAVEL_TABLE = "sales_schedule_travel_times"

// Sales-specific travel API
const TRAVEL_API = "/api/sales-travel-time"

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function formatTime(value) {
  if (!value) return "—"

  const text = String(value).trim()

  const match = text.match(/[T ](\d{2}):(\d{2})/)

  if (match) {
    return `${match[1]}:${match[2]}`
  }

  const timeMatch = text.match(/^(\d{2}):(\d{2})/)

  return timeMatch
    ? `${timeMatch[1]}:${timeMatch[2]}`
    : text.slice(0, 5)
}

function getMinutes(value) {
  const text = String(value ?? "").trim()

  const match = text.match(/[T ](\d{2}):(\d{2})/)

  if (!match) return null

  return Number(match[1]) * 60 + Number(match[2])
}

function normaliseEmail(value) {
  return String(value ?? "").trim().toLowerCase()
}

function display(value, fallback = "—") {
  const text = String(value ?? "").trim()
  return text || fallback
}

function isSold(appointment) {
  return (
    String(appointment?.result ?? "")
      .trim()
      .toLowerCase() === "sold"
  )
}

function getNetValue(appointment) {
  const deal = Array.isArray(appointment?.deals)
    ? appointment.deals[0]
    : appointment?.deals

  const value = Number(deal?.net_value)

  return Number.isFinite(value) ? value : null
}

function formatCurrency(value) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return ""
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function branchName(value) {
  return String(value ?? "").trim() || "Unassigned Branch"
}

function formatTimeFromMinutes(minutes) {
  const safe = Math.max(
    0,
    Math.min(minutes, 23 * 60 + 59)
  )

  const hours = Math.floor(safe / 60)
  const mins = safe % 60

  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(
    2,
    "0"
  )}`
}

function appointmentId(appointment) {
  return String(
    appointment?.appointment_row_id ||
      appointment?.id ||
      ""
  ).trim()
}

function getAppointmentLocation(appointment) {
  const address = display(
    appointment?.address ||
      appointment?.property_address ||
      appointment?.address_line_1 ||
      appointment?.street_address,
    ""
  )

  const postcode = display(
    appointment?.postcode ||
      appointment?.post_code,
    ""
  )

  return [address, postcode]
    .filter(Boolean)
    .join(", ")
}

function getTodayInLondon() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

// ------------------------------------------------------------
// Appointment positioning
// ------------------------------------------------------------

function getPosition(appointment) {
  const start = getMinutes(
    appointment?.appointment_date
  )

  if (start === null) {
    return {
      left: 0,
      width: 100,
      hidden: false,
    }
  }

  const end =
    start + APPOINTMENT_DURATION_MINUTES

  if (
    end <= DAY_START_MINUTES ||
    start >= DAY_END_MINUTES
  ) {
    return {
      left: 0,
      width: 0,
      hidden: true,
    }
  }

  const visibleStart = Math.max(
    start,
    DAY_START_MINUTES
  )

  const visibleEnd = Math.min(
    end,
    DAY_END_MINUTES
  )

  const total =
    DAY_END_MINUTES - DAY_START_MINUTES

  return {
    left:
      ((visibleStart - DAY_START_MINUTES) /
        total) *
      100,

    width:
      ((visibleEnd - visibleStart) / total) *
      100,

    hidden: false,
  }
}

// ------------------------------------------------------------
// Appointment card
// ------------------------------------------------------------

function AppointmentCard({
  appointment,
  onSelect,
}) {
  const sold = isSold(appointment)

  const position = getPosition(appointment)

  if (position.hidden) return null

  const start =
    getMinutes(appointment.appointment_date) ??
    DAY_START_MINUTES

  return (
    <button
      type="button"
      className={`sales-schedule-appointment ${
        sold ? "sales-schedule-sold" : ""
      }`}
      style={{
        left: `${position.left}%`,
        width: `${position.width}%`,
      }}
      onClick={() =>
        onSelect?.(appointment)
      }
      title={`${formatTime(
        appointment.appointment_date
      )} – ${display(
        appointment.name,
        "Unnamed customer"
      )}`}
    >
      <div className="sales-schedule-time">
        {formatTime(
          appointment.appointment_date
        )}{" "}
        –{" "}
        {formatTimeFromMinutes(
          start + APPOINTMENT_DURATION_MINUTES
        )}
      </div>

      <div className="sales-schedule-customer">
        {display(
          appointment.name,
          "Unnamed customer"
        )}
      </div>

      <div className="sales-schedule-meta">
        <span>
          {display(appointment.postcode)}
        </span>

        <span>
          {display(appointment.product)}
        </span>
      </div>
    </button>
  )
}

// ------------------------------------------------------------
// Timeline grid
// ------------------------------------------------------------

function TimelineGrid() {
  const hours = []

  for (
    let m = DAY_START_MINUTES;
    m <= DAY_END_MINUTES;
    m += 60
  ) {
    hours.push(m)
  }

  return (
    <div className="sales-schedule-timeline-lines">
      {hours.map((m) => (
        <div
          key={m}
          className="sales-schedule-hour-line"
          style={{
            left: `${
              ((m - DAY_START_MINUTES) /
                (DAY_END_MINUTES -
                  DAY_START_MINUTES)) *
              100
            }%`,
          }}
        />
      ))}
    </div>
  )
}

// ------------------------------------------------------------
// Travel block
// ------------------------------------------------------------

function TravelBlock({
  travel,
  fromAppointment,
  toAppointment,
}) {
  if (!travel) return null

  const from = getMinutes(
    fromAppointment?.appointment_date
  )

  const next = getMinutes(
    toAppointment?.appointment_date
  )

  if (from === null || next === null) {
    return null
  }

  const travelStart =
    from + APPOINTMENT_DURATION_MINUTES

  const travelEnd =
    travelStart + travel.durationMinutes

  const overlapsNextAppointment =
    travelEnd > next

  if (
    travelStart >= DAY_END_MINUTES ||
    travelEnd <= DAY_START_MINUTES
  ) {
    return null
  }

  const total =
    DAY_END_MINUTES - DAY_START_MINUTES

  const visibleStart = Math.max(
    travelStart,
    DAY_START_MINUTES
  )

  const visibleEnd = Math.min(
    travelEnd,
    DAY_END_MINUTES
  )

  const left =
    ((visibleStart - DAY_START_MINUTES) /
      total) *
    100

  const width =
    ((visibleEnd - visibleStart) / total) *
    100

  if (width <= 0) return null

  const statusClass =
    overlapsNextAppointment
      ? "sales-schedule-travel-overlap"
      : "sales-schedule-travel-clear"

  return (
    <div
      className={`sales-schedule-travel ${statusClass}`}
      style={{
        left: `${left}%`,
        width: `${width}%`,
      }}
      title={`Travel: ${
        travel.durationMinutes
      } min${
        travel.distanceMiles != null
          ? ` • ${travel.distanceMiles.toFixed(
              1
            )} miles`
          : ""
      }${
        overlapsNextAppointment
          ? " • overlaps next appointment"
          : " • clear"
      }`}
    >
      <Car size={11} />

      <span>
        {travel.durationMinutes} min
      </span>
    </div>
  )
}

// ------------------------------------------------------------
// Main component
// ------------------------------------------------------------

export default function SalesSchedule({
  selectedDate,
  onSelectAppointment,
}) {
  const [reps, setReps] = useState([])
  const [appointments, setAppointments] =
    useState([])

  const [travelTimes, setTravelTimes] =
    useState({})

  const [loading, setLoading] =
    useState(true)

  const [error, setError] = useState("")

  // ----------------------------------------------------------
  // Branch collapse state
  // ----------------------------------------------------------

  const [collapsedBranches, setCollapsedBranches] =
    useState({})

  const isHistoricalDate =
    selectedDate < getTodayInLondon()

  // ----------------------------------------------------------
  // Toggle branch
  // ----------------------------------------------------------

  function toggleBranch(branch) {
    setCollapsedBranches((current) => ({
      ...current,
      [branch]: !current[branch],
    }))
  }

  // ----------------------------------------------------------
  // Load schedule
  // ----------------------------------------------------------

  async function loadSchedule() {
    if (!supabase) {
      setError(
        "Supabase is not configured."
      )

      setLoading(false)

      return
    }

    setLoading(true)
    setError("")

    try {
      const endDate = new Date(
        `${selectedDate}T00:00:00Z`
      )

      endDate.setUTCDate(
        endDate.getUTCDate() + 1
      )

      const nextDate =
        endDate.toISOString().slice(0, 10)

      const [
        profilesResult,
        appointmentsResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, full_name, display_name, email, active, role, branch"
          )
          .eq("active", true)
          .eq("role", "Sales Rep")
          .order("full_name", {
            ascending: true,
          }),

        supabase
          .from("appointments")
          .select(
            "*, deals(net_value)"
          )
          .gte(
            "appointment_date",
            `${selectedDate}T00:00:00.000Z`
          )
          .lt(
            "appointment_date",
            `${nextDate}T00:00:00.000Z`
          )
          .order("appointment_date", {
            ascending: true,
          }),
      ])

      if (profilesResult.error) {
        throw profilesResult.error
      }

      if (appointmentsResult.error) {
        throw appointmentsResult.error
      }

      setReps(
        profilesResult.data || []
      )

      setAppointments(
        appointmentsResult.data || []
      )
    } catch (err) {
      console.error(
        "Error loading Sales Schedule:",
        err
      )

      setError(
        err?.message ||
          "Unable to load Sales Schedule."
      )

      setReps([])
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }

  // ----------------------------------------------------------
  // Refresh schedule
  // ----------------------------------------------------------

  useEffect(() => {
    loadSchedule()

    const interval = setInterval(
      loadSchedule,
      60000
    )

    return () =>
      clearInterval(interval)
  }, [selectedDate])

  // ----------------------------------------------------------
  // Appointments by rep
  // ----------------------------------------------------------

  const appointmentsByRep = useMemo(() => {
    const map = new Map()

    reps.forEach((rep) => {
      map.set(
        normaliseEmail(rep.email),
        []
      )
    })

    appointments.forEach(
      (appointment) => {
        const email =
          normaliseEmail(
            appointment.rep_allocated
          )

        if (map.has(email)) {
          map
            .get(email)
            .push(appointment)
        }
      }
    )

    map.forEach((items) => {
      items.sort(
        (a, b) =>
          (getMinutes(
            a.appointment_date
          ) ?? 9999) -
          (getMinutes(
            b.appointment_date
          ) ?? 9999)
      )
    })

    return map
  }, [reps, appointments])

  // ----------------------------------------------------------
  // Branch groups
  // ----------------------------------------------------------

  const branchGroups = useMemo(() => {
    const groups = new Map()

    reps.forEach((rep) => {
      const branch = branchName(
        rep.branch
      )

      if (!groups.has(branch)) {
        groups.set(branch, [])
      }

      groups.get(branch).push(rep)
    })

    return Array.from(
      groups.entries()
    )
      .sort(
        ([a], [b]) =>
          a === "Unassigned Branch"
            ? 1
            : b === "Unassigned Branch"
            ? -1
            : a.localeCompare(b)
      )
      .map(
        ([branch, items]) => [
          branch,
          items.sort((a, b) =>
            display(
              a.display_name ||
                a.full_name,
              a.email
            ).localeCompare(
              display(
                b.display_name ||
                  b.full_name,
                b.email
              )
            )
          ),
        ]
      )
  }, [reps])

  // ----------------------------------------------------------
  // Unassigned appointments
  // ----------------------------------------------------------

  const unassigned = useMemo(
    () =>
      appointments.filter(
        (a) =>
          !normaliseEmail(
            a.rep_allocated
          )
      ),
    [appointments]
  )

  // ----------------------------------------------------------
  // Calculate / load travel
  // ----------------------------------------------------------

  useEffect(() => {
    let cancelled = false

    async function calculateTravelTimes() {
      if (!appointments.length) {
        setTravelTimes({})
        return
      }

      const requests = []

      appointmentsByRep.forEach(
        (items) => {
          for (
            let i = 0;
            i < items.length - 1;
            i += 1
          ) {
            requests.push({
              from: items[i],
              to: items[i + 1],
            })
          }
        }
      )

      if (!requests.length) {
        setTravelTimes({})
        return
      }

      let saved = []

      const result =
        await supabase
          .from(TRAVEL_TABLE)
          .select(
            "from_appointment_id, to_appointment_id, duration_minutes, distance_miles, origin, destination"
          )
          .eq(
            "travel_date",
            selectedDate
          )

      if (result.error) {
        console.error(
          "Unable to load saved Sales Travel Times:",
          result.error
        )
      } else {
        saved =
          result.data || []
      }

      const resolved = {}

      for (const request of requests) {
        if (cancelled) break

        const fromId =
          appointmentId(request.from)

        const toId =
          appointmentId(request.to)

        const origin =
          getAppointmentLocation(
            request.from
          )

        const destination =
          getAppointmentLocation(
            request.to
          )

        if (
          !fromId ||
          !toId ||
          !origin ||
          !destination
        ) {
          continue
        }

        // Use the appointment IDs as the stable journey key.
        // Address formatting can change without changing the journey.
        const key = [
          fromId,
          toId,
        ].join("|")

        const existing =
          saved.find(
            (row) =>
              String(row.from_appointment_id || "") ===
                String(fromId) &&
              String(row.to_appointment_id || "") ===
                String(toId)
          )

        if (existing) {
          resolved[key] = {
            durationMinutes:
              Number(
                existing.duration_minutes
              ) || null,

            distanceMiles:
              existing.distance_miles ==
              null
                ? null
                : Number(
                    existing.distance_miles
                  ),

            cached: true,
          }

          continue
        }

        try {
          const response =
            await fetch(
              TRAVEL_API,
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body: JSON.stringify({
                  origin,
                  destination,

                  fromAppointmentId:
                    fromId,

                  toAppointmentId:
                    toId,

                  travelDate:
                    selectedDate,

                  // Identifies this as
                  // Sales Travel Times
                  eventType:
                    "sales_travel_time",
                }),
              }
            )

          const data =
            await response
              .json()
              .catch(() => ({}))

          if (!response.ok) {
            throw new Error(
              data?.error ||
                "Unable to calculate Sales Travel Time"
            )
          }

          const travelResult = {
            durationMinutes:
              Number(
                data?.durationMinutes
              ) || null,

            distanceMiles:
              Number.isFinite(
                Number(
                  data?.distanceMiles
                )
              )
                ? Number(
                    data.distanceMiles
                  )
                : null,

            cached: Boolean(
              data?.cached
            ),
          }

          resolved[key] =
            travelResult

          // Save historical travel
          // calculations
          if (
            isHistoricalDate &&
            travelResult.durationMinutes
          ) {
            const saveResult =
              await supabase
                .from(TRAVEL_TABLE)
                .upsert(
                  {
                    from_appointment_id:
                      fromId,

                    to_appointment_id:
                      toId,

                    travel_date:
                      selectedDate,

                    origin,

                    destination,

                    duration_minutes:
                      travelResult.durationMinutes,

                    distance_miles:
                      travelResult.distanceMiles,

                    source:
                      "openrouteservice",

                    updated_at:
                      new Date().toISOString(),
                  },
                  {
                    onConflict:
                      "from_appointment_id,to_appointment_id,travel_date",
                  }
                )

            if (saveResult.error) {
              console.error(
                "Unable to save historical Sales Travel Time:",
                saveResult.error
              )
            }
          }
        } catch (err) {
          console.error(
            "Sales Travel Time calculation failed:",
            err
          )

          resolved[key] = null
        }
      }

      if (!cancelled) {
        setTravelTimes(resolved)
      }
    }

    calculateTravelTimes()

    return () => {
      cancelled = true
    }
  }, [
    appointmentsByRep,
    selectedDate,
    isHistoricalDate,
  ])

  // ----------------------------------------------------------
  // Get travel
  // ----------------------------------------------------------

  function getTravel(from, to) {
    const key = [
      appointmentId(from),
      appointmentId(to),
    ].join("|")

    return travelTimes[key]
  }

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <section className="sales-schedule-wrap">
      <style>{`
        .sales-schedule-wrap {
          width: 100%;
          margin-top: 4px;
          color: #172033;
        }

        .sales-schedule-card {
          width: 100%;
          background: #fff;
          border: 1px solid #dfe4e8;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(15,23,42,.04);
        }

        .sales-schedule-error {
          padding: 10px 16px;
          background: #fff4f4;
          color: #b42318;
          font-size: 11px;
        }

        .sales-schedule-scroll {
          width: 100%;
          overflow-x: auto;
        }

        .sales-schedule-header,
        .sales-schedule-row {
          display: grid;
          grid-template-columns: 220px minmax(620px, 1fr);
          min-width: 840px;
        }

        .sales-schedule-header {
          background: #f1f3f5;
          border-bottom: 3px solid #26395d;
          color: #52606d;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          min-height: 34px;
        }

        .sales-schedule-header > div {
          padding: 0 20px;
          display: flex;
          align-items: center;
        }

        /* --------------------------------------------------
           BRANCH HEADER
           -------------------------------------------------- */

        .sales-schedule-branch {
          width: 100%;
          min-width: 840px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0;
          background: #e9edf1;
          border-top: 1px solid #d4dbe1;
          border-bottom: 1px solid #d4dbe1;
          color: #26395d;
          font-size: 13px;
          font-weight: 800;
        }

        .sales-schedule-branch-button {
          width: 100%;
          min-height: 42px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border: 0;
          background: transparent;
          color: inherit;
          font: inherit;
          text-align: left;
          cursor: pointer;
        }

        .sales-schedule-branch-button:hover {
          background: #e2e7eb;
        }

        .sales-schedule-branch-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          flex: 0 0 16px;
          color: #52606d;
        }

        .sales-schedule-branch-name {
          min-width: 0;
          flex: 0 0 auto;
        }

        .sales-schedule-branch-count {
          font-size: 10px;
          color: #7a8794;
          font-weight: 700;
        }

        /* --------------------------------------------------
           REP ROW
           -------------------------------------------------- */

        .sales-schedule-row {
          min-height: 118px;
          border-bottom: 1px solid #d8dde2;
        }

        .sales-schedule-rep {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 16px 20px;
          background: #f8f9fa;
          border-right: 1px solid #d8dde2;
        }

        .sales-schedule-rep-name {
          font-size: 15px;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sales-schedule-rep-email {
          margin-top: 5px;
          font-size: 10px;
          color: #7a8794;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* --------------------------------------------------
           TIMELINE
           -------------------------------------------------- */

        .sales-schedule-timeline {
          position: relative;
          min-width: 620px;
          min-height: 118px;
          overflow: visible;
        }

        .sales-schedule-timeline-lines {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .sales-schedule-hour-line {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background: #e5e9ed;
        }

        .sales-schedule-appointments {
          position: absolute;
          inset: 0;

          background:
            repeating-linear-gradient(
              to right,
              transparent 0,
              transparent calc(100% / 13 - 1px),
              #edf0f2 calc(100% / 13 - 1px),
              #edf0f2 calc(100% / 13)
            );
        }

        /* --------------------------------------------------
           APPOINTMENT CARD
           -------------------------------------------------- */

        .sales-schedule-appointment {
          position: absolute;

          top: 16px;
          height: calc(100% - 32px);

          display: flex;
          min-width: 54px;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          text-align: left;

          padding: 7px 9px;

          border: 1px solid #c7d1d9;
          border-radius: 8px;
          background: #eef4f8;
          color: #27303b;

          box-sizing: border-box;
          cursor: pointer;
          overflow: hidden;
          z-index: 2;
        }

        .sales-schedule-appointment:hover {
          border-color: #8da4b5;
          box-shadow:
            0 3px 8px rgba(15,23,42,.12);
        }

        .sales-schedule-sold {
          background: #eaf4e5;
          border-color: #c8dbc1;
        }

        .sales-schedule-time {
          width: 100%;
          font-size: 9px;
          font-weight: 800;
          color: #4b5563;
          white-space: nowrap;
          overflow: hidden;
        }

        .sales-schedule-customer {
          width: 100%;
          font-size: 12px;
          font-weight: 750;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 1px;
        }

        .sales-schedule-meta {
          display: flex;
          width: 100%;
          justify-content: space-between;
          gap: 6px;
          margin-top: 3px;
          font-size: 8px;
          color: #687580;
        }

        .sales-schedule-meta span {
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sales-schedule-meta span:last-child {
          font-weight: 700;
        }

        /* --------------------------------------------------
           TRAVEL
           -------------------------------------------------- */

        .sales-schedule-travel {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          height: 28px;
          min-width: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 0 6px;
          border: 1px dashed;
          border-radius: 5px;
          font-size: 8px;
          font-weight: 800;
          z-index: 3;
          overflow: hidden;
          box-sizing: border-box;
        }

        .sales-schedule-travel-clear {
          background: #ecfdf3;
          color: #16803a;
          border-color: #8ed2a5;
        }

        .sales-schedule-travel-overlap {
          background: #fff0f0;
          color: #c62828;
          border-color: #e59a9a;
        }

        .sales-schedule-no-appointments {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #9aa4ad;
          font-size: 11px;
          font-weight: 600;
        }

        .sales-schedule-empty {
          padding: 28px;
          text-align: center;
          color: #7b8792;
          font-size: 12px;
        }

        .sales-schedule-spin {
          animation: salesScheduleSpin .8s linear infinite;
        }

        @keyframes salesScheduleSpin {
          to {
            transform: rotate(360deg);
          }
        }

        @media(max-width:700px) {
          .sales-schedule-header,
          .sales-schedule-row {
            grid-template-columns:
              145px minmax(620px, 1fr);

            min-width: 765px;
          }

          .sales-schedule-branch {
            min-width: 765px;
          }

          .sales-schedule-row {
            min-height: 108px;
          }

          .sales-schedule-rep {
            padding: 12px;
          }

          .sales-schedule-rep-name {
            font-size: 13px;
          }

          .sales-schedule-timeline {
            min-height: 108px;
          }

          .sales-schedule-appointment {
            top: 12px;
            height: calc(100% - 24px);
            padding: 6px 8px;
          }

          .sales-schedule-customer {
            font-size: 11px;
          }

          .sales-schedule-meta {
            font-size: 7px;
          }

          .sales-schedule-travel {
            height: 24px;
            font-size: 7px;
          }
        }
      `}</style>

      <div className="sales-schedule-card">

        {error && (
          <div className="sales-schedule-error">
            {error}
          </div>
        )}

        <div className="sales-schedule-scroll">
          <div>

            {/* TIME HEADER */}

            <div className="sales-schedule-header">
              <div>
                SALES REP
              </div>

              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "34px",
                  padding: 0,
                }}
              >
                {Array.from(
                  { length: 14 },
                  (_, index) =>
                    DAY_START_MINUTES +
                    index * 60
                ).map((minutes) => {
                  const left =
                    ((minutes -
                      DAY_START_MINUTES) /
                      (DAY_END_MINUTES -
                        DAY_START_MINUTES)) *
                    100

                  return (
                    <span
                      key={minutes}
                      style={{
                        position:
                          "absolute",
                        left: `${left}%`,
                        top: "50%",
                        transform:
                          "translate(-50%, -50%)",
                        fontSize: "9px",
                        fontWeight: 700,
                        color: "#52606d",
                        whiteSpace:
                          "nowrap",
                      }}
                    >
                      {formatTimeFromMinutes(
                        minutes
                      )}
                    </span>
                  )
                })}
              </div>
            </div>

            {loading ? (
              <div className="sales-schedule-empty">
                Loading sales schedule...
              </div>
            ) : reps.length === 0 ? (
              <div className="sales-schedule-empty">
                No active Sales Rep profiles found.
              </div>
            ) : (
              <>
                {branchGroups.map(
                  ([branch, branchReps]) => {
                    const collapsed =
                      Boolean(
                        collapsedBranches[
                          branch
                        ]
                      )

                    return (
                      <React.Fragment
                        key={branch}
                      >

                        {/* BRANCH HEADER */}

                        <div className="sales-schedule-branch">
                          <button
                            type="button"
                            className="sales-schedule-branch-button"
                            onClick={() =>
                              toggleBranch(
                                branch
                              )
                            }
                            aria-expanded={
                              !collapsed
                            }
                          >
                            <span className="sales-schedule-branch-icon">
                              {collapsed ? (
                                <ChevronRight
                                  size={16}
                                  strokeWidth={2.5}
                                />
                              ) : (
                                <ChevronDown
                                  size={16}
                                  strokeWidth={2.5}
                                />
                              )}
                            </span>

                            <span className="sales-schedule-branch-name">
                              {branch}
                            </span>

                            <span className="sales-schedule-branch-count">
                              {branchReps.length}{" "}
                              {branchReps.length ===
                              1
                                ? "rep"
                                : "reps"}
                            </span>
                          </button>
                        </div>

                        {/* BRANCH CONTENT */}

                        {!collapsed &&
                          branchReps.map(
                            (rep) => {
                              const items =
                                appointmentsByRep.get(
                                  normaliseEmail(
                                    rep.email
                                  )
                                ) || []

                              return (
                                <div
                                  className="sales-schedule-row"
                                  key={
                                    rep.id ||
                                    rep.email
                                  }
                                >

                                  {/* SALES REP */}

                                  <div className="sales-schedule-rep">
                                    <div className="sales-schedule-rep-name">
                                      {display(
                                        rep.display_name ||
                                          rep.full_name,
                                        rep.email
                                      )}
                                    </div>

                                    {rep.email && (
                                      <div className="sales-schedule-rep-email">
                                        {
                                          rep.email
                                        }
                                      </div>
                                    )}
                                  </div>

                                  {/* TIMELINE */}

                                  <div className="sales-schedule-timeline">
                                    <TimelineGrid />

                                    <div className="sales-schedule-appointments">

                                      {items.length ? (
                                        items.map(
                                          (
                                            appointment,
                                            index
                                          ) => {
                                            const next =
                                              items[
                                                index +
                                                  1
                                              ]

                                            const travel =
                                              next
                                                ? getTravel(
                                                    appointment,
                                                    next
                                                  )
                                                : null

                                            return (
                                              <React.Fragment
                                                key={appointmentId(
                                                  appointment
                                                )}
                                              >

                                                {next &&
                                                  travel && (
                                                    <TravelBlock
                                                      travel={
                                                        travel
                                                      }
                                                      fromAppointment={
                                                        appointment
                                                      }
                                                      toAppointment={
                                                        next
                                                      }
                                                    />
                                                  )}

                                                <AppointmentCard
                                                  appointment={
                                                    appointment
                                                  }
                                                  onSelect={
                                                    onSelectAppointment
                                                  }
                                                />

                                              </React.Fragment>
                                            )
                                          }
                                        )
                                      ) : (
                                        <span className="sales-schedule-no-appointments">
                                          No appointments
                                        </span>
                                      )}

                                    </div>
                                  </div>

                                </div>
                              )
                            }
                          )}
                      </React.Fragment>
                    )
                  }
                )}

                {/* UNASSIGNED */}

                {unassigned.length > 0 && (
                  <>
                    <div className="sales-schedule-branch">
                      <button
                        type="button"
                        className="sales-schedule-branch-button"
                        onClick={() =>
                          toggleBranch(
                            "Unassigned"
                          )
                        }
                        aria-expanded={
                          !collapsedBranches[
                            "Unassigned"
                          ]
                        }
                      >
                        <span className="sales-schedule-branch-icon">
                          {collapsedBranches[
                            "Unassigned"
                          ] ? (
                            <ChevronRight
                              size={16}
                              strokeWidth={2.5}
                            />
                          ) : (
                            <ChevronDown
                              size={16}
                              strokeWidth={2.5}
                            />
                          )}
                        </span>

                        <span className="sales-schedule-branch-name">
                          Unassigned
                        </span>

                        <span className="sales-schedule-branch-count">
                          {unassigned.length}{" "}
                          {unassigned.length ===
                          1
                            ? "appointment"
                            : "appointments"}
                        </span>
                      </button>
                    </div>

                    {!collapsedBranches[
                      "Unassigned"
                    ] && (
                      <div className="sales-schedule-row">

                        <div className="sales-schedule-rep">
                          <div className="sales-schedule-rep-name">
                            Unassigned
                          </div>
                        </div>

                        <div className="sales-schedule-timeline">
                          <TimelineGrid />

                          <div className="sales-schedule-appointments">
                            {unassigned.map(
                              (appointment) => (
                                <AppointmentCard
                                  key={appointmentId(
                                    appointment
                                  )}
                                  appointment={
                                    appointment
                                  }
                                  onSelect={
                                    onSelectAppointment
                                  }
                                />
                              )
                            )}
                          </div>
                        </div>

                      </div>
                    )}
                  </>
                )}
              </>
            )}

          </div>
        </div>
      </div>
    </section>
  )
}

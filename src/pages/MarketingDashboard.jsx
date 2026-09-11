import React, { useEffect, useMemo, useState } from "react"
import {
  Megaphone,
  Target,
  Phone,
  CalendarDays,
  Users,
  RefreshCw,
  AlertCircle,
  BriefcaseBusiness,
  Filter,
  X,
  Clock,
  MapPin,
} from "lucide-react"
import Stat from "../components/Stat"
import { supabase } from "../lib/supabase"


/* =========================================================
   DATE HELPERS
========================================================= */

function getLondonDayBounds() {
  const now = new Date()

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)

  const values = {}

  parts.forEach((part) => {
    if (part.type !== "literal") {
      values[part.type] = part.value
    }
  })

  function londonOffsetMinutes(date) {
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

  function londonMidnightUtc(year, month, day) {
    const approximate = new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        0,
        0,
        0
      )
    )

    const offset = londonOffsetMinutes(approximate)

    return new Date(
      approximate.getTime() -
        offset * 60 * 1000
    )
  }

  const start = londonMidnightUtc(
    values.year,
    values.month,
    values.day
  )

  const nextDay = new Date(
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day) + 1
    )
  )

  const end = londonMidnightUtc(
    nextDay.getUTCFullYear(),
    String(
      nextDay.getUTCMonth() + 1
    ).padStart(2, "0"),
    String(
      nextDay.getUTCDate()
    ).padStart(2, "0")
  )

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}


/* =========================================================
   GENERAL HELPERS
========================================================= */

function formatPercent(value) {
  return Number.isFinite(value)
    ? `${value.toFixed(1)}%`
    : "0%"
}


function displayValue(
  value,
  fallback = "Unassigned"
) {
  return (
    String(value || "").trim() ||
    fallback
  )
}


/* =========================================================
   POSTCODE GROUPING
========================================================= */

/*
  Examples:

  G1 1AA      → G
  G20 8AB     → G

  EH1 1AA     → EH
  EH12 5AB    → EH

  FK1 2AB     → FK
  PA10 1AA    → PA
  ML3 0AA     → ML
  KA1 1AA     → KA
  DG1 2AA     → DG

  The first postcode letters are extracted rather than
  simply taking the first two characters. This is important
  because G is the only Scottish postcode area beginning with
  a single letter.
*/

function getPostcodeGroup(postcode) {
  const value = String(
    postcode || ""
  )
    .trim()
    .toUpperCase()

  if (!value) {
    return "Unknown"
  }

  /*
    Remove spaces and everything after the postcode area
    isn't required. We only need the outward postcode.
  */

  const outward = value.split(/\s+/)[0]

  /*
    G is the only Scottish postcode area with a
    single-letter postcode district.
  */

  if (outward.startsWith("G")) {
    return "G"
  }

  /*
    Scottish / UK postcode areas are generally represented
    by one or two letters.

    Examples:
      EH
      FK
      PA
      ML
      KA
      DG
  */

  const match = outward.match(
    /^[A-Z]{2}/
  )

  if (match) {
    return match[0]
  }

  /*
    Fallback for unusual / incomplete postcodes.
  */

  const singleLetter =
    outward.match(/^[A-Z]/)

  if (singleLetter) {
    return singleLetter[0]
  }

  return "Unknown"
}


/* =========================================================
   BREAKDOWN
========================================================= */

function buildBreakdown(
  appointments,
  getValue
) {
  const counts = {}

  appointments.forEach(
    (appointment) => {
      const value =
        getValue(appointment)

      counts[value] =
        (counts[value] || 0) + 1
    }
  )

  return Object.entries(counts)
    .map(
      ([name, count]) => ({
        name,
        count,
      })
    )
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.name.localeCompare(b.name)
    )
}


/* =========================================================
   DATE FORMAT
========================================================= */

function formatDateTime(value) {
  if (!value) {
    return "—"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return date.toLocaleString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }
  )
}


/* =========================================================
   BREAKDOWN CARD
========================================================= */

function BreakdownCard({
  title,
  description,
  icon,
  rows,
  total,
  selectedValue,
  onSelect,
  emptyText,
}) {
  return (
    <div
      className="card"
      style={{
        height: "100%",
      }}
    >

      <div
        className="card-head"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 4,
        }}
      >

        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f1f5f9",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>

        <div
          style={{
            minWidth: 0,
          }}
        >

          <h2
            style={{
              margin: 0,
              fontSize: 18,
            }}
          >
            {title}
          </h2>

          <p
            style={{
              margin: "4px 0 0",
              color: "#64748b",
              fontSize: 13,
            }}
          >
            {description}
          </p>

        </div>

      </div>


      {rows.length === 0 ? (

        <div
          style={{
            padding: "30px 10px",
            textAlign: "center",
            color: "#64748b",
            fontSize: 14,
          }}
        >
          {emptyText}
        </div>

      ) : (

        <div
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >

          {rows.map(
            (item, index) => {

              const percentage =
                total > 0
                  ? (item.count / total) * 100
                  : 0

              const selected =
                selectedValue === item.name

              return (

                <button
                  key={item.name}
                  type="button"
                  onClick={() =>
                    onSelect(item.name)
                  }
                  title={`Filter by ${item.name}`}
                  style={{
                    appearance: "none",
                    border: 0,
                    background:
                      selected
                        ? "#f1f5f9"
                        : "transparent",
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                    padding:
                      "13px 9px",
                    borderRadius: 8,
                    borderBottom:
                      index ===
                      rows.length - 1
                        ? "none"
                        : "1px solid #eef2f7",
                  }}
                >

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(0,1fr) auto auto",
                      gap: 10,
                      alignItems:
                        "center",
                      marginBottom: 7,
                    }}
                  >

                    <div
                      style={{
                        minWidth: 0,
                        fontWeight:
                          selected
                            ? 700
                            : 600,
                        overflow:
                          "hidden",
                        textOverflow:
                          "ellipsis",
                        whiteSpace:
                          "nowrap",
                      }}
                      title={item.name}
                    >
                      {item.name}
                    </div>

                    <div
                      style={{
                        fontWeight: 700,
                        minWidth: 24,
                        textAlign:
                          "right",
                      }}
                    >
                      {item.count}
                    </div>

                    <div
                      style={{
                        color:
                          "#64748b",
                        fontSize: 12,
                        minWidth: 48,
                        textAlign:
                          "right",
                      }}
                    >
                      {formatPercent(
                        percentage
                      )}
                    </div>

                  </div>


                  <div
                    style={{
                      height: 7,
                      background:
                        "#eef2f7",
                      borderRadius: 99,
                      overflow:
                        "hidden",
                    }}
                  >

                    <div
                      style={{
                        width:
                          `${percentage}%`,
                        minWidth:
                          item.count > 0
                            ? 4
                            : 0,
                        height: "100%",
                        background:
                          selected
                            ? "#0f172a"
                            : "#172554",
                        borderRadius:
                          99,
                      }}
                    />

                  </div>

                </button>

              )
            }
          )}


          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              padding:
                "13px 9px 0",
              marginTop: 2,
              borderTop:
                "1px solid #e2e8f0",
              fontWeight: 700,
            }}
          >

            <span>
              Total
            </span>

            <span>
              {total} · 100%
            </span>

          </div>

        </div>

      )}

    </div>
  )
}


/* =========================================================
   FILTER PILL
========================================================= */

function FilterPill({
  label,
  value,
  onClear,
}) {
  if (!value) {
    return null
  }

  return (

    <div
      style={{
        display:
          "inline-flex",
        alignItems:
          "center",
        gap: 7,
        padding:
          "7px 10px",
        borderRadius: 999,
        background:
          "#eef2ff",
        color:
          "#1e293b",
        fontSize: 13,
        fontWeight: 600,
      }}
    >

      <span>
        {label}: {value}
      </span>

      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${label} filter`}
        style={{
          border: 0,
          background:
            "transparent",
          padding: 0,
          display: "flex",
          cursor: "pointer",
          color: "#64748b",
        }}
      >
        <X size={14} />
      </button>

    </div>
  )
}


/* =========================================================
   APPOINTMENT ROW
========================================================= */

function AppointmentRow({
  appointment,
  onClick,
}) {
  return (

    <button
      type="button"
      onClick={() =>
        onClick?.(appointment)
      }
      style={{
        appearance: "none",
        border: 0,
        background:
          "transparent",
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        font: "inherit",
        color: "inherit",
        display: "grid",
        gridTemplateColumns:
          "minmax(180px,1.4fr) minmax(120px,1fr) minmax(110px,1fr) minmax(130px,1fr) minmax(130px,1fr)",
        gap: 16,
        alignItems: "center",
        padding:
          "14px 0",
        borderBottom:
          "1px solid #eef2f7",
      }}
    >

      <div
        style={{
          minWidth: 0,
        }}
      >

        <div
          style={{
            fontWeight: 700,
            overflow:
              "hidden",
            textOverflow:
              "ellipsis",
            whiteSpace:
              "nowrap",
          }}
          title={
            appointment?.name ||
            "Unnamed customer"
          }
        >
          {appointment?.name ||
            "Unnamed customer"}
        </div>

        <div
          style={{
            display: "flex",
            alignItems:
              "center",
            gap: 5,
            color:
              "#64748b",
            fontSize: 12,
            marginTop: 4,
          }}
        >
          <Clock size={12} />

          Submitted{" "}
          {formatDateTime(
            appointment?.submission_date
          )}
        </div>

      </div>


      <div
        style={{
          minWidth: 0,
        }}
      >

        <div
          style={{
            fontSize: 12,
            color: "#94a3b8",
            marginBottom: 4,
          }}
        >
          Canvasser
        </div>

        <div
          style={{
            fontWeight: 600,
            overflow:
              "hidden",
            textOverflow:
              "ellipsis",
            whiteSpace:
              "nowrap",
          }}
        >
          {displayValue(
            appointment?.canvasser
          )}
        </div>

      </div>


      <div
        style={{
          minWidth: 0,
        }}
      >

        <div
          style={{
            fontSize: 12,
            color: "#94a3b8",
            marginBottom: 4,
          }}
        >
          Job Type
        </div>

        <div
          style={{
            fontWeight: 600,
            overflow:
              "hidden",
            textOverflow:
              "ellipsis",
            whiteSpace:
              "nowrap",
          }}
        >
          {displayValue(
            appointment?.job_type
          )}
        </div>

      </div>


      <div
        style={{
          minWidth: 0,
        }}
      >

        <div
          style={{
            fontSize: 12,
            color: "#94a3b8",
            marginBottom: 4,
          }}
        >
          Lead Source
        </div>

        <div
          style={{
            fontWeight: 600,
            overflow:
              "hidden",
            textOverflow:
              "ellipsis",
            whiteSpace:
              "nowrap",
          }}
        >
          {displayValue(
            appointment?.lead_source
          )}
        </div>

      </div>


      <div
        style={{
          minWidth: 0,
        }}
      >

        <div
          style={{
            fontSize: 12,
            color: "#94a3b8",
            marginBottom: 4,
          }}
        >
          Appointment
        </div>

        <div
          style={{
            fontWeight: 600,
            display: "flex",
            alignItems:
              "center",
            gap: 5,
            overflow:
              "hidden",
            textOverflow:
              "ellipsis",
            whiteSpace:
              "nowrap",
          }}
          title={formatDateTime(
            appointment?.appointment_date
          )}
        >
          <CalendarDays size={13} />

          {formatDateTime(
            appointment?.appointment_date
          )}
        </div>

      </div>

    </button>
  )
}


/* =========================================================
   MARKETING DASHBOARD
========================================================= */

export default function MarketingDashboard({
  onSelectAppointment,
}) {

  const [appointments, setAppointments] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState("")

  const [lastUpdated, setLastUpdated] =
    useState(null)


  const [filters, setFilters] =
    useState({
      canvasser: "",
      jobType: "",
      leadSource: "",
      postcode: "",
    })


  /* =======================================================
     LOAD TODAY'S APPOINTMENTS
  ======================================================= */

  async function loadTodaysAppointments() {

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

        Today's records are determined ONLY by
        submission_date.

        appointment_date is displayed but is not
        used to determine whether a record belongs
        to today.
      */

      const {
        start,
        end,
      } = getLondonDayBounds()


      const {
        data,
        error: supabaseError,
      } =
        await supabase
          .from("appointments")
          .select("*")
          .gte(
            "submission_date",
            start
          )
          .lt(
            "submission_date",
            end
          )
          .order(
            "submission_date",
            {
              ascending: false,
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
        "Error loading today's marketing appointments:",
        err
      )

      setError(
        err?.message ||
        "Unable to load today's appointments."
      )

      setAppointments([])

    } finally {

      setLoading(false)

    }
  }


  /* =======================================================
     INITIAL LOAD / AUTO REFRESH
  ======================================================= */

  useEffect(() => {

    loadTodaysAppointments()

    const interval =
      setInterval(
        loadTodaysAppointments,
        60 * 1000
      )

    return () =>
      clearInterval(interval)

  }, [])


  /* =======================================================
     BREAKDOWNS
  ======================================================= */

  const canvasserBreakdown =
    useMemo(
      () =>
        buildBreakdown(
          appointments,
          (appointment) =>
            displayValue(
              appointment?.canvasser
            )
        ),
      [appointments]
    )


  const jobTypeBreakdown =
    useMemo(
      () =>
        buildBreakdown(
          appointments,
          (appointment) =>
            displayValue(
              appointment?.job_type
            )
        ),
      [appointments]
    )


  const leadSourceBreakdown =
    useMemo(
      () =>
        buildBreakdown(
          appointments,
          (appointment) =>
            displayValue(
              appointment?.lead_source
            )
        ),
      [appointments]
    )


  /*
    NEW:

    Postcodes are grouped into postcode areas.

    G1 / G2 / G3 / G20 etc → G
    EH1 / EH11 etc → EH
    PA1 / PA10 etc → PA
  */

  const postcodeBreakdown =
    useMemo(
      () =>
        buildBreakdown(
          appointments,
          (appointment) =>
            getPostcodeGroup(
              appointment?.postcode
            )
        ),
      [appointments]
    )


  /* =======================================================
     FILTERED APPOINTMENTS
  ======================================================= */

  const filteredAppointments =
    useMemo(() => {

      return appointments.filter(
        (appointment) => {

          const canvasser =
            displayValue(
              appointment?.canvasser
            )

          const jobType =
            displayValue(
              appointment?.job_type
            )

          const leadSource =
            displayValue(
              appointment?.lead_source
            )

          const postcode =
            getPostcodeGroup(
              appointment?.postcode
            )


          return (

            (
              !filters.canvasser ||
              canvasser ===
                filters.canvasser
            )

            &&

            (
              !filters.jobType ||
              jobType ===
                filters.jobType
            )

            &&

            (
              !filters.leadSource ||
              leadSource ===
                filters.leadSource
            )

            &&

            (
              !filters.postcode ||
              postcode ===
                filters.postcode
            )

          )
        }
      )

    }, [
      appointments,
      filters,
    ])


  /* =======================================================
     SUMMARY VALUES
  ======================================================= */

  const totalAppointments =
    appointments.length

  const filteredTotal =
    filteredAppointments.length

  const topCanvasser =
    canvasserBreakdown[0]


  const hasFilters =
    Boolean(
      filters.canvasser ||
      filters.jobType ||
      filters.leadSource ||
      filters.postcode
    )


  /* =======================================================
     FILTER HELPERS
  ======================================================= */

  function setFilter(
    key,
    value
  ) {

    setFilters(
      (current) => ({
        ...current,
        [key]:
          current[key] === value
            ? ""
            : value,
      })
    )
  }


  function clearFilters() {

    setFilters({
      canvasser: "",
      jobType: "",
      leadSource: "",
      postcode: "",
    })

  }


  /* =======================================================
     RENDER
  ======================================================= */

  return (

    <section>

      {/* ===================================================
          HEADER
      =================================================== */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "flex-start",
          gap: 16,
          marginBottom: 20,
        }}
      >

        <div>

          <div
            style={{
              display: "flex",
              alignItems:
                "center",
              gap: 10,
            }}
          >

            <Megaphone size={22} />

            <h1
              style={{
                margin: 0,
                fontSize: 24,
              }}
            >
              Marketing Dashboard
            </h1>

          </div>

          <p
            style={{
              margin:
                "6px 0 0",
              color:
                "#64748b",
            }}
          >
            Appointments submitted today,
            with performance by canvasser,
            job type, lead source and postcode.
          </p>

        </div>


        <button
          type="button"
          onClick={
            loadTodaysAppointments
          }
          disabled={loading}
          style={{
            border:
              "1px solid #d7dee8",
            background:
              "#fff",
            color:
              "#334155",
            borderRadius: 8,
            padding:
              "10px 14px",
            display:
              "inline-flex",
            alignItems:
              "center",
            gap: 8,
            cursor:
              loading
                ? "default"
                : "pointer",
            opacity:
              loading
                ? 0.7
                : 1,
          }}
        >

          <RefreshCw size={16} />

          Refresh

        </button>

      </div>


      {/* ===================================================
          ERROR
      =================================================== */}

      {error && (

        <div
          style={{
            display: "flex",
            alignItems:
              "center",
            gap: 10,
            padding: 14,
            marginBottom: 20,
            borderRadius: 10,
            background:
              "#fef2f2",
            color:
              "#991b1b",
            border:
              "1px solid #fecaca",
          }}
        >

          <AlertCircle size={18} />

          <span>
            {error}
          </span>

        </div>

      )}


      {/* ===================================================
          STATS
      =================================================== */}

      <div className="stats">

        <Stat
          icon={
            <CalendarDays
              size={20}
            />
          }
          label="Appointments Today"
          value={
            loading
              ? "..."
              : totalAppointments
          }
        />

        <Stat
          icon={
            <Users
              size={20}
            />
          }
          label="Active Canvassers"
          value={
            loading
              ? "..."
              : canvasserBreakdown.length
          }
        />

        <Stat
          icon={
            <Target
              size={20}
            />
          }
          label="Top Canvasser"
          value={
            loading
              ? "..."
              : topCanvasser?.name ||
                "—"
          }
        />

        <Stat
          icon={
            <Phone
              size={20}
            />
          }
          label="Top Canvasser Appointments"
          value={
            loading
              ? "..."
              : topCanvasser?.count ||
                0
          }
        />

      </div>


      {/* ===================================================
          BREAKDOWN CARDS
      =================================================== */}

      <div
        style={{
          display:
            "grid",

          /*
            Four cards now instead of three.
          */

          gridTemplateColumns:
            "repeat(4, minmax(0, 1fr))",

          gap: 20,

          marginTop: 20,

          alignItems:
            "stretch",
        }}
      >

        {/* CANVASSER */}

        <BreakdownCard
          title="By Canvasser"
          description="Click a canvasser to filter"
          icon={
            <Users size={18} />
          }
          rows={
            canvasserBreakdown
          }
          total={
            totalAppointments
          }
          selectedValue={
            filters.canvasser
          }
          onSelect={
            (value) =>
              setFilter(
                "canvasser",
                value
              )
          }
          emptyText={
            "No appointments have been generated today."
          }
        />


        {/* JOB TYPE */}

        <BreakdownCard
          title="By Job Type"
          description="Click a job type to filter"
          icon={
            <BriefcaseBusiness
              size={18}
            />
          }
          rows={
            jobTypeBreakdown
          }
          total={
            totalAppointments
          }
          selectedValue={
            filters.jobType
          }
          onSelect={
            (value) =>
              setFilter(
                "jobType",
                value
              )
          }
          emptyText={
            "No job type data available today."
          }
        />


        {/* LEAD SOURCE */}

        <BreakdownCard
          title="By Lead Source"
          description="Click a source to filter"
          icon={
            <Filter size={18} />
          }
          rows={
            leadSourceBreakdown
          }
          total={
            totalAppointments
          }
          selectedValue={
            filters.leadSource
          }
          onSelect={
            (value) =>
              setFilter(
                "leadSource",
                value
              )
          }
          emptyText={
            "No lead source data available today."
          }
        />


        {/* POSTCODE */}

        <BreakdownCard
          title="By Postcode"
          description="Grouped by postcode area"
          icon={
            <MapPin size={18} />
          }
          rows={
            postcodeBreakdown
          }
          total={
            totalAppointments
          }
          selectedValue={
            filters.postcode
          }
          onSelect={
            (value) =>
              setFilter(
                "postcode",
                value
              )
          }
          emptyText={
            "No postcode data available today."
          }
        />

      </div>


      {/* ===================================================
          ACTIVE FILTERS
      =================================================== */}

      {hasFilters && (

        <div
          className="card"
          style={{
            marginTop: 20,
            padding: 16,
          }}
        >

          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              gap: 16,
              flexWrap:
                "wrap",
            }}
          >

            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap: 10,
                flexWrap:
                  "wrap",
              }}
            >

              <span
                style={{
                  fontWeight: 700,
                }}
              >
                Active filters
              </span>


              <FilterPill
                label="Canvasser"
                value={
                  filters.canvasser
                }
                onClear={() =>
                  setFilter(
                    "canvasser",
                    filters.canvasser
                  )
                }
              />


              <FilterPill
                label="Job Type"
                value={
                  filters.jobType
                }
                onClear={() =>
                  setFilter(
                    "jobType",
                    filters.jobType
                  )
                }
              />


              <FilterPill
                label="Lead Source"
                value={
                  filters.leadSource
                }
                onClear={() =>
                  setFilter(
                    "leadSource",
                    filters.leadSource
                  )
                }
              />


              <FilterPill
                label="Postcode"
                value={
                  filters.postcode
                }
                onClear={() =>
                  setFilter(
                    "postcode",
                    filters.postcode
                  )
                }
              />

            </div>


            <button
              type="button"
              onClick={
                clearFilters
              }
              style={{
                border:
                  "1px solid #d7dee8",
                background:
                  "#fff",
                color:
                  "#334155",
                borderRadius: 8,
                padding:
                  "8px 12px",
                cursor:
                  "pointer",
                display:
                  "inline-flex",
                alignItems:
                  "center",
                gap: 7,
              }}
            >

              <X size={15} />

              Clear filters

            </button>

          </div>

        </div>

      )}


      {/* ===================================================
          APPOINTMENTS
      =================================================== */}

      <div
        className="card"
        style={{
          marginTop: 20,
        }}
      >

        <div
          className="card-head"
          style={{
            display:
              "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: 16,
            flexWrap:
              "wrap",
          }}
        >

          <div>

            <h2
              style={{
                margin: 0,
              }}
            >
              {hasFilters
                ? "Filtered Appointments"
                : "Today's Appointments"}
            </h2>

            <p
              style={{
                margin:
                  "4px 0 0",
                color:
                  "#64748b",
                fontSize: 13,
              }}
            >

              {hasFilters
                ? `${filteredTotal} of ${totalAppointments} appointments match the selected filters.`
                : "Every appointment submitted today. Appointment date is shown for context."}

            </p>

          </div>


          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            {loading
              ? "..."
              : filteredTotal}
          </div>

        </div>


        {/* LOADING */}

        {loading ? (

          <div
            style={{
              padding:
                "35px 0",
              textAlign:
                "center",
              color:
                "#64748b",
            }}
          >
            Loading today's
            appointments...
          </div>

        ) : filteredAppointments.length === 0 ? (

          <div
            style={{
              padding:
                "35px 0",
              textAlign:
                "center",
              color:
                "#64748b",
            }}
          >

            {hasFilters
              ? "No appointments match the selected filters."
              : "No appointments have been generated today."}

          </div>

        ) : (

          <div
            style={{
              overflowX:
                "auto",
            }}
          >

            <div
              style={{
                minWidth: 850,
              }}
            >

              {/* TABLE HEADER */}

              <div
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "minmax(180px,1.4fr) minmax(120px,1fr) minmax(110px,1fr) minmax(130px,1fr) minmax(130px,1fr)",

                  gap: 16,

                  padding:
                    "0 0 10px",

                  borderBottom:
                    "1px solid #e2e8f0",

                  color:
                    "#94a3b8",

                  fontSize: 11,

                  fontWeight: 700,

                  textTransform:
                    "uppercase",

                  letterSpacing:
                    "0.04em",
                }}
              >

                <div>
                  Customer
                </div>

                <div>
                  Canvasser
                </div>

                <div>
                  Job Type
                </div>

                <div>
                  Lead Source
                </div>

                <div>
                  Appointment
                </div>

              </div>


              {/* ROWS */}

              {filteredAppointments.map(
                (appointment) => (

                  <AppointmentRow
                    key={
                      appointment.appointment_row_id ||
                      `${appointment.name}-${appointment.submission_date}`
                    }
                    appointment={
                      appointment
                    }
                    onClick={
                      onSelectAppointment
                    }
                  />

                )
              )}

            </div>

          </div>

        )}

      </div>


      {/* ===================================================
          LAST UPDATED
      =================================================== */}

      {lastUpdated && (

        <div
          style={{
            marginTop: 16,
            color:
              "#94a3b8",
            fontSize: 12,
          }}
        >

          Last updated{" "}

          {lastUpdated.toLocaleTimeString(
            "en-GB",
            {
              hour:
                "2-digit",
              minute:
                "2-digit",
              second:
                "2-digit",
            }
          )}

          {" · "}

          Auto-refreshes
          every 60 seconds

        </div>

      )}

    </section>
  )
}
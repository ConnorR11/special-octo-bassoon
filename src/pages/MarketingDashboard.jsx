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
} from "lucide-react"
import Stat from "../components/Stat"
import { supabase } from "../lib/supabase"

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
    if (part.type !== "literal") values[part.type] = part.value
  })

  function londonOffsetMinutes(date) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      timeZoneName: "longOffset",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(date)

    const offset = parts.find((part) => part.type === "timeZoneName")?.value
    if (!offset || offset === "GMT") return 0

    const match = offset.match(/GMT([+-])(\d{2}):?(\d{2})?/)
    if (!match) return 0

    const hours = Number(match[2] || 0)
    const minutes = Number(match[3] || 0)
    return (match[1] === "+" ? 1 : -1) * (hours * 60 + minutes)
  }

  function londonMidnightUtc(year, month, day) {
    const approximate = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), 0, 0, 0)
    )
    const offset = londonOffsetMinutes(approximate)
    return new Date(approximate.getTime() - offset * 60 * 1000)
  }

  const start = londonMidnightUtc(values.year, values.month, values.day)
  const nextDay = new Date(
    Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + 1)
  )

  const end = londonMidnightUtc(
    nextDay.getUTCFullYear(),
    String(nextDay.getUTCMonth() + 1).padStart(2, "0"),
    String(nextDay.getUTCDate()).padStart(2, "0")
  )

  return { start: start.toISOString(), end: end.toISOString() }
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : "0%"
}

function buildBreakdown(appointments, field) {
  const counts = {}

  appointments.forEach((appointment) => {
    const value = String(appointment?.[field] || "").trim() || "Unassigned"
    counts[value] = (counts[value] || 0) + 1
  })

  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

function BreakdownCard({ title, description, icon, rows, total, emptyText }) {
  const topCount = rows[0]?.count || 0

  return (
    <div className="card" style={{ height: "100%" }}>
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
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
            {description}
          </p>
        </div>
      </div>

      {total > 0 && rows.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            margin: "18px 0 10px",
            padding: "9px 11px",
            background: "#f8fafc",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <span style={{ color: "#64748b" }}>Total today</span>
          <strong>{total}</strong>
        </div>
      )}

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
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((item, index) => {
            const percentage = total > 0 ? (item.count / total) * 100 : 0
            const isTop = index === 0 && item.count === topCount

            return (
              <div
                key={item.name}
                style={{
                  padding: "13px 0",
                  borderBottom:
                    index === rows.length - 1 ? "none" : "1px solid #eef2f7",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto auto",
                    gap: 10,
                    alignItems: "center",
                    marginBottom: 7,
                  }}
                >
                  <div
                    style={{
                      minWidth: 0,
                      fontWeight: isTop ? 700 : 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={item.name}
                  >
                    {item.name}
                  </div>
                  <div style={{ fontWeight: 700, minWidth: 24, textAlign: "right" }}>
                    {item.count}
                  </div>
                  <div
                    style={{
                      color: "#64748b",
                      fontSize: 12,
                      minWidth: 48,
                      textAlign: "right",
                    }}
                  >
                    {formatPercent(percentage)}
                  </div>
                </div>

                <div
                  style={{
                    height: 7,
                    background: "#eef2f7",
                    borderRadius: 99,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${percentage}%`,
                      minWidth: item.count > 0 ? 4 : 0,
                      height: "100%",
                      background: "#172554",
                      borderRadius: 99,
                    }}
                  />
                </div>
              </div>
            )
          })}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: 13,
              marginTop: 2,
              borderTop: "1px solid #e2e8f0",
              fontWeight: 700,
            }}
          >
            <span>Total</span>
            <span>{total} · 100%</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MarketingDashboard() {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastUpdated, setLastUpdated] = useState(null)

  async function loadTodaysAppointments() {
    if (!supabase) {
      setError("Supabase is not configured. Check your environment variables.")
      setLoading(false)
      return
    }

    setLoading(true)
    setError("")

    try {
      // IMPORTANT: today's appointments are determined ONLY by submission_date.
      // appointment_date is deliberately not used anywhere in this dashboard.
      const { start, end } = getLondonDayBounds()

      const { data, error: supabaseError } = await supabase
        .from("appointments")
        .select("canvasser, job_type, lead_source, submission_date")
        .gte("submission_date", start)
        .lt("submission_date", end)

      if (supabaseError) throw supabaseError

      setAppointments(data || [])
      setLastUpdated(new Date())
    } catch (err) {
      console.error("Error loading today's marketing appointments:", err)
      setError(err?.message || "Unable to load today's appointments.")
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTodaysAppointments()
    const interval = setInterval(loadTodaysAppointments, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const canvasserBreakdown = useMemo(
    () => buildBreakdown(appointments, "canvasser"),
    [appointments]
  )

  const jobTypeBreakdown = useMemo(
    () => buildBreakdown(appointments, "job_type"),
    [appointments]
  )

  const leadSourceBreakdown = useMemo(
    () => buildBreakdown(appointments, "lead_source"),
    [appointments]
  )

  const totalAppointments = appointments.length
  const topCanvasser = canvasserBreakdown[0]
  const topJobType = jobTypeBreakdown[0]
  const topLeadSource = leadSourceBreakdown[0]

  return (
    <section>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Megaphone size={22} />
            <h1 style={{ margin: 0, fontSize: 24 }}>Marketing Dashboard</h1>
          </div>
          <p style={{ margin: "6px 0 0", color: "#64748b" }}>
            Appointments submitted today, with a breakdown by canvasser, job type and lead source.
          </p>
        </div>

        <button
          type="button"
          onClick={loadTodaysAppointments}
          disabled={loading}
          style={{
            border: "1px solid #d7dee8",
            background: "#fff",
            color: "#334155",
            borderRadius: 8,
            padding: "10px 14px",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 14,
            marginBottom: 20,
            borderRadius: 10,
            background: "#fef2f2",
            color: "#991b1b",
            border: "1px solid #fecaca",
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="stats">
        <Stat
          icon={<CalendarDays size={20} />}
          label="Appointments Today"
          value={loading ? "..." : totalAppointments}
        />
        <Stat
          icon={<Users size={20} />}
          label="Active Canvassers"
          value={loading ? "..." : canvasserBreakdown.length}
        />
        <Stat
          icon={<Target size={20} />}
          label="Top Canvasser"
          value={loading ? "..." : topCanvasser?.name || "—"}
        />
        <Stat
          icon={<Phone size={20} />}
          label="Top Canvasser Appointments"
          value={loading ? "..." : topCanvasser?.count || 0}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 20,
          marginTop: 20,
          alignItems: "stretch",
        }}
      >
        <BreakdownCard
          title="By Canvasser"
          description="Who generated today's appointments"
          icon={<Users size={18} />}
          rows={canvasserBreakdown}
          total={totalAppointments}
          emptyText="No appointments have been generated today."
        />

        <BreakdownCard
          title="By Job Type"
          description="What types of jobs were generated"
          icon={<BriefcaseBusiness size={18} />}
          rows={jobTypeBreakdown}
          total={totalAppointments}
          emptyText="No job type data available today."
        />

        <BreakdownCard
          title="By Lead Source"
          description="Where today's appointments came from"
          icon={<Filter size={18} />}
          rows={leadSourceBreakdown}
          total={totalAppointments}
          emptyText="No lead source data available today."
        />
      </div>

      {totalAppointments > 0 && (
        <div className="grid2" style={{ marginTop: 20 }}>
          <div className="card">
            <div className="card-head">
              <h2 style={{ margin: 0 }}>Quick Insights</h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              <div
                style={{
                  padding: 14,
                  borderRadius: 9,
                  background: "#f8fafc",
                }}
              >
                <div style={{ color: "#64748b", fontSize: 12, marginBottom: 5 }}>
                  Leading Canvasser
                </div>
                <div style={{ fontWeight: 700 }}>{topCanvasser?.name || "—"}</div>
                <div style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>
                  {topCanvasser?.count || 0} appointments
                  {topCanvasser && ` · ${formatPercent((topCanvasser.count / totalAppointments) * 100)}`}
                </div>
              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 9,
                  background: "#f8fafc",
                }}
              >
                <div style={{ color: "#64748b", fontSize: 12, marginBottom: 5 }}>
                  Leading Job Type
                </div>
                <div style={{ fontWeight: 700 }}>{topJobType?.name || "—"}</div>
                <div style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>
                  {topJobType?.count || 0} appointments
                  {topJobType && ` · ${formatPercent((topJobType.count / totalAppointments) * 100)}`}
                </div>
              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 9,
                  background: "#f8fafc",
                }}
              >
                <div style={{ color: "#64748b", fontSize: 12, marginBottom: 5 }}>
                  Leading Lead Source
                </div>
                <div style={{ fontWeight: 700 }}>{topLeadSource?.name || "—"}</div>
                <div style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>
                  {topLeadSource?.count || 0} appointments
                  {topLeadSource && ` · ${formatPercent((topLeadSource.count / totalAppointments) * 100)}`}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {lastUpdated && (
        <div style={{ marginTop: 16, color: "#94a3b8", fontSize: 12 }}>
          Last updated {lastUpdated.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
          {" · "}
          Auto-refreshes every 60 seconds
        </div>
      )}
    </section>
  )
}

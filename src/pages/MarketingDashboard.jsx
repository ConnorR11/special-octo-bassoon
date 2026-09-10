import React, { useEffect, useMemo, useState } from "react"
import {
  Megaphone,
  Target,
  Phone,
  CalendarDays,
  Users,
  RefreshCw,
  AlertCircle,
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
      // IMPORTANT: "today" is determined by submission_date, not appointment_date.
      const { start, end } = getLondonDayBounds()

      const { data, error: supabaseError } = await supabase
        .from("appointments")
        .select("canvasser, submission_date")
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

  const canvasserBreakdown = useMemo(() => {
    const counts = {}

    appointments.forEach((appointment) => {
      const name = String(appointment?.canvasser || "").trim() || "Unassigned"
      counts[name] = (counts[name] || 0) + 1
    })

    return Object.entries(counts)
      .map(([canvasser, count]) => ({ canvasser, count }))
      .sort((a, b) => b.count - a.count || a.canvasser.localeCompare(b.canvasser))
  }, [appointments])

  const totalAppointments = appointments.length
  const topCanvasser = canvasserBreakdown[0]

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
            Appointments generated today, grouped by canvasser.
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
          label="Appointments Generated Today"
          value={loading ? "..." : totalAppointments}
        />
        <Stat
          icon={<Users size={20} />}
          label="Canvassers"
          value={loading ? "..." : canvasserBreakdown.length}
        />
        <Stat
          icon={<Target size={20} />}
          label="Top Canvasser"
          value={loading ? "..." : topCanvasser?.canvasser || "—"}
        />
        <Stat
          icon={<Phone size={20} />}
          label="Top Canvasser Appointments"
          value={loading ? "..." : topCanvasser?.count || 0}
        />
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div
          className="card-head"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Today's Appointments</h2>
            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
              Based on submission date, not appointment date.
            </p>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {loading ? "..." : totalAppointments}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "30px 0", textAlign: "center", color: "#64748b" }}>
            Loading today's appointments...
          </div>
        ) : canvasserBreakdown.length === 0 ? (
          <div style={{ padding: "30px 0", textAlign: "center", color: "#64748b" }}>
            No appointments have been generated today.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {canvasserBreakdown.map((item) => {
              const percentage = totalAppointments > 0
                ? (item.count / totalAppointments) * 100
                : 0

              return (
                <div
                  key={item.canvasser}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(160px, 1fr) 90px 90px",
                    gap: 16,
                    alignItems: "center",
                    padding: "15px 0",
                    borderBottom: "1px solid #eef2f7",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 7 }}>
                      {item.canvasser}
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
                          height: "100%",
                          background: "#172554",
                          borderRadius: 99,
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontWeight: 700 }}>
                    {item.count}
                  </div>
                  <div style={{ textAlign: "right", color: "#64748b", fontSize: 14 }}>
                    {formatPercent(percentage)}
                  </div>
                </div>
              )
            })}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(160px, 1fr) 90px 90px",
                gap: 16,
                padding: "15px 0 0",
                fontWeight: 700,
              }}
            >
              <div>Total</div>
              <div style={{ textAlign: "right" }}>{totalAppointments}</div>
              <div style={{ textAlign: "right" }}>100%</div>
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
          </div>
        )}
      </div>

      <div className="grid2" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="card-head"><h2>Leads</h2></div>
          <div className="empty" style={{ padding: 20 }}>
            Lead metrics can be added here.
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Calls</h2></div>
          <div className="empty" style={{ padding: 20 }}>
            Call metrics can be added here.
          </div>
        </div>
      </div>
    </section>
  )
}

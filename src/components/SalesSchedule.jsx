import React, { useEffect, useMemo, useState } from "react"
import { CalendarDays, RefreshCw } from "lucide-react"
import { supabase } from "../lib/supabase"

function formatTime(value) {
  if (!value) return "—"
  const text = String(value).trim()
  const match = text.match(/[T ](\d{2}):(\d{2})/)
  if (match) return `${match[1]}:${match[2]}`
  const timeMatch = text.match(/^(\d{2}):(\d{2})/)
  return timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : text.slice(0, 5)
}

function normaliseEmail(value) {
  return String(value ?? "").trim().toLowerCase()
}

function display(value, fallback = "—") {
  const text = String(value ?? "").trim()
  return text || fallback
}

function isSold(appointment) {
  return String(appointment?.result ?? "").trim().toLowerCase() === "sold"
}

function getNetValue(appointment) {
  const deal = Array.isArray(appointment?.deals) ? appointment.deals[0] : appointment?.deals
  const value = Number(deal?.net_value)
  return Number.isFinite(value) ? value : null
}

function formatCurrency(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return ""
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number(value))
}

function dateOnly(value) {
  return String(value || "").slice(0, 10)
}

function AppointmentCard({ appointment, onSelect }) {
  const sold = isSold(appointment)
  const netValue = getNetValue(appointment)
  return <button type="button" className={`sales-schedule-appointment ${sold ? "sales-schedule-sold" : ""}`} onClick={() => onSelect?.(appointment)}>
    <div className="sales-schedule-time">{formatTime(appointment.appointment_date)}</div>
    <div className="sales-schedule-customer">{display(appointment.name, "Unnamed customer")}</div>
    <div className="sales-schedule-meta">
      <span>{display(appointment.postcode)}</span>
      <span>{display(appointment.product)}</span>
    </div>
    <div className="sales-schedule-meta">
      <span>{display(appointment.branch)}</span>
      <span>{sold ? (netValue === null ? "SOLD" : formatCurrency(netValue)) : display(appointment.result, "Booked")}</span>
    </div>
  </button>
}

export default function SalesSchedule({ selectedDate, onSelectAppointment }) {
  const [reps, setReps] = useState([])
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function loadSchedule() {
    if (!supabase) {
      setError("Supabase is not configured.")
      setLoading(false)
      return
    }

    setLoading(true)
    setError("")

    try {
      const endDate = new Date(`${selectedDate}T00:00:00Z`)
      endDate.setUTCDate(endDate.getUTCDate() + 1)
      const nextDate = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, "0")}-${String(endDate.getUTCDate()).padStart(2, "0")}`

      const [profilesResult, appointmentsResult] = await Promise.all([
        supabase.from("profiles").select("id, full_name, display_name, email, active, role").eq("active", true).eq("role", "Sales Rep").order("full_name", { ascending: true }),
        supabase.from("appointments").select("*, deals(net_value)").gte("appointment_date", `${selectedDate}T00:00:00.000Z`).lt("appointment_date", `${nextDate}T00:00:00.000Z`).order("appointment_date", { ascending: true }),
      ])

      if (profilesResult.error) throw profilesResult.error
      if (appointmentsResult.error) throw appointmentsResult.error

      setReps(profilesResult.data || [])
      setAppointments(appointmentsResult.data || [])
    } catch (err) {
      console.error("Error loading Sales Schedule:", err)
      setError(err?.message || "Unable to load Sales Schedule.")
      setReps([])
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSchedule()
    const interval = setInterval(loadSchedule, 60000)
    return () => clearInterval(interval)
  }, [selectedDate])

  const appointmentsByRep = useMemo(() => {
    const map = new Map()
    reps.forEach((rep) => map.set(normaliseEmail(rep.email), []))
    appointments.forEach((appointment) => {
      const email = normaliseEmail(appointment.rep_allocated)
      if (!map.has(email)) return
      map.get(email).push(appointment)
    })
    return map
  }, [reps, appointments])

  const unassigned = useMemo(() => appointments.filter((appointment) => !normaliseEmail(appointment.rep_allocated)), [appointments])

  return <section className="sales-schedule-wrap">
    <div className="sales-schedule-card">
      <div className="sales-schedule-heading">
        <div className="sales-schedule-title-wrap">
          <CalendarDays size={19} />
          <div>
            <h2>Sales Schedule</h2>
            <p>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </div>
        <button type="button" className="sales-schedule-refresh" onClick={loadSchedule} disabled={loading}><RefreshCw size={13} className={loading ? "sales-schedule-spin" : ""}/>Refresh</button>
      </div>

      {error && <div className="sales-schedule-error">{error}</div>}

      <div className="sales-schedule-grid">
        <div className="sales-schedule-header">
          <div>SALES REP</div>
          <div>APPOINTMENTS</div>
        </div>

        {loading ? <div className="sales-schedule-empty">Loading sales schedule...</div> : reps.length === 0 ? <div className="sales-schedule-empty">No active Sales Rep profiles found.</div> : <>
          {reps.map((rep) => {
            const repAppointments = appointmentsByRep.get(normaliseEmail(rep.email)) || []
            const name = display(rep.display_name || rep.full_name, rep.email)
            return <div className="sales-schedule-row" key={rep.id || rep.email}>
              <div className="sales-schedule-rep">
                <div className="sales-schedule-rep-name">{name}</div>
                {rep.email && <div className="sales-schedule-rep-email">{rep.email}</div>}
              </div>
              <div className="sales-schedule-day">
                {repAppointments.length ? repAppointments.map((appointment) => <AppointmentCard key={appointment.appointment_row_id || appointment.id} appointment={appointment} onSelect={onSelectAppointment}/>) : <span className="sales-schedule-no-appointments">No appointments</span>}
              </div>
            </div>
          })}

          {unassigned.length > 0 && <div className="sales-schedule-row sales-schedule-unassigned-row">
            <div className="sales-schedule-rep"><div className="sales-schedule-rep-name">Unassigned</div></div>
            <div className="sales-schedule-day">{unassigned.map((appointment) => <AppointmentCard key={appointment.appointment_row_id || appointment.id} appointment={appointment} onSelect={onSelectAppointment}/>)}</div>
          </div>}
        </>}
      </div>
    </div>
  </section>
}

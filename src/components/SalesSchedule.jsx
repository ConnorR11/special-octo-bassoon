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

function branchName(value) {
  return String(value ?? "").trim() || "Unassigned Branch"
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
        supabase.from("profiles").select("id, full_name, display_name, email, active, role, branch").eq("active", true).eq("role", "Sales Rep").order("full_name", { ascending: true }),
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

  const branchGroups = useMemo(() => {
    const groups = new Map()
    reps.forEach((rep) => {
      const branch = branchName(rep.branch)
      if (!groups.has(branch)) groups.set(branch, [])
      groups.get(branch).push(rep)
    })

    return Array.from(groups.entries())
      .sort(([a], [b]) => {
        if (a === "Unassigned Branch") return 1
        if (b === "Unassigned Branch") return -1
        return a.localeCompare(b)
      })
      .map(([branch, branchReps]) => [branch, branchReps.sort((a, b) => display(a.display_name || a.full_name, a.email).localeCompare(display(b.display_name || b.full_name, b.email)))])
  }, [reps])

  const unassigned = useMemo(() => appointments.filter((appointment) => !normaliseEmail(appointment.rep_allocated)), [appointments])

  return <section className="sales-schedule-wrap">
    <style>{`
      .sales-schedule-wrap{width:100%;min-width:0;margin-top:4px;color:#172033}
      .sales-schedule-card{width:100%;min-width:0;background:#fff;border:1px solid #dfe4e8;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.04)}
      .sales-schedule-heading{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 18px;background:#fff;border-bottom:1px solid #e1e5e9}
      .sales-schedule-title-wrap{display:flex;align-items:center;gap:10px;color:#172033;min-width:0}
      .sales-schedule-title-wrap svg{color:#263a5e;flex:0 0 auto}
      .sales-schedule-title-wrap h2{margin:0;font-size:20px;line-height:1.15;font-weight:800;letter-spacing:-.3px}
      .sales-schedule-title-wrap p{margin:4px 0 0;font-size:11px;color:#64748b;font-weight:600}
      .sales-schedule-refresh{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid #dbe1e6;background:#f8fafb;color:#64748b;border-radius:7px;padding:7px 10px;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap}
      .sales-schedule-refresh:hover{background:#f1f5f8}
      .sales-schedule-refresh:disabled{opacity:.55;cursor:default}
      .sales-schedule-error{padding:10px 16px;background:#fff4f4;color:#b42318;border-bottom:1px solid #f0cccc;font-size:11px}
      .sales-schedule-grid{width:100%;min-width:0;border-top:0}
      .sales-schedule-header{display:grid;grid-template-columns:220px minmax(0,1fr);min-width:0;background:#f1f3f5;border-bottom:3px solid #26395d;color:#52606d;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
      .sales-schedule-header>div{padding:11px 20px;min-width:0}
      .sales-schedule-header>div+div{border-left:1px solid #d9dee3}
      .sales-schedule-branch{display:flex;align-items:center;gap:8px;padding:11px 20px;background:#e9edf1;border-top:1px solid #d4dbe1;border-bottom:1px solid #d4dbe1;color:#26395d;font-size:13px;font-weight:800;letter-spacing:.01em}
      .sales-schedule-branch-count{font-size:10px;font-weight:700;color:#7a8794}
      .sales-schedule-row{display:grid;grid-template-columns:220px minmax(0,1fr);min-width:0;min-height:118px;border-bottom:1px solid #d8dde2;background:#fff}
      .sales-schedule-row:last-child{border-bottom:0}
      .sales-schedule-rep{min-width:0;display:flex;flex-direction:column;justify-content:center;padding:16px 20px;background:#f8f9fa;border-right:1px solid #d8dde2}
      .sales-schedule-rep-name{font-size:15px;line-height:1.25;font-weight:700;color:#27303b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .sales-schedule-rep-email{margin-top:5px;font-size:10px;line-height:1.2;color:#7a8794;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .sales-schedule-day{min-width:0;display:grid;grid-auto-flow:column;grid-auto-columns:220px;align-items:stretch;gap:10px;overflow-x:auto;overflow-y:hidden;padding:10px;background:#fff;-webkit-overflow-scrolling:touch}
      .sales-schedule-day::-webkit-scrollbar{height:6px}
      .sales-schedule-day::-webkit-scrollbar-thumb{background:#cbd3db;border-radius:8px}
      .sales-schedule-appointment{display:flex;min-width:0;width:220px;height:100%;min-height:94px;box-sizing:border-box;flex-direction:column;align-items:flex-start;justify-content:center;text-align:left;padding:12px 13px;border:1px solid #d3dbe2;border-radius:9px;background:#fff;color:#27303b;box-shadow:0 1px 2px rgba(15,23,42,.04);cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .15s}
      .sales-schedule-appointment:hover{border-color:#9db1c2;box-shadow:0 3px 8px rgba(15,23,42,.08);transform:translateY(-1px)}
      .sales-schedule-sold{background:#eaf4e5;border-color:#c8dbc1}
      .sales-schedule-time{font-size:10px;line-height:1.2;font-weight:800;color:#4b5563;margin-bottom:4px}
      .sales-schedule-customer{width:100%;font-size:14px;line-height:1.25;font-weight:750;color:#263238;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .sales-schedule-meta{display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;margin-top:5px;font-size:10px;line-height:1.2;color:#687580}
      .sales-schedule-meta span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .sales-schedule-meta span:last-child{font-weight:700;text-align:right}
      .sales-schedule-sold .sales-schedule-meta span:last-child{color:#3f6840}
      .sales-schedule-no-appointments{align-self:center;padding-left:4px;color:#9aa4ad;font-size:11px;font-weight:600}
      .sales-schedule-empty{padding:28px 20px;text-align:center;color:#7b8792;font-size:12px}
      .sales-schedule-unassigned-row .sales-schedule-rep{background:#f3f5f7}
      .sales-schedule-spin{animation:salesScheduleSpin .8s linear infinite}
      @keyframes salesScheduleSpin{to{transform:rotate(360deg)}}

      @media (max-width:700px){
        .sales-schedule-wrap{margin-top:2px}
        .sales-schedule-card{border-radius:9px}
        .sales-schedule-heading{padding:12px 12px}
        .sales-schedule-title-wrap h2{font-size:17px}
        .sales-schedule-title-wrap p{font-size:10px}
        .sales-schedule-header{grid-template-columns:145px minmax(0,1fr);font-size:8px}
        .sales-schedule-header>div{padding:9px 12px}
        .sales-schedule-branch{padding:9px 12px;font-size:11px}
        .sales-schedule-branch-count{font-size:9px}
        .sales-schedule-row{grid-template-columns:145px minmax(0,1fr);min-height:108px}
        .sales-schedule-rep{padding:12px 12px}
        .sales-schedule-rep-name{font-size:13px}
        .sales-schedule-rep-email{font-size:9px;margin-top:4px}
        .sales-schedule-day{grid-auto-columns:190px;gap:8px;padding:8px}
        .sales-schedule-appointment{width:190px;min-height:90px;padding:10px 11px;border-radius:8px}
        .sales-schedule-customer{font-size:13px}
        .sales-schedule-meta{font-size:9px;margin-top:4px}
        .sales-schedule-time{font-size:9px}
        .sales-schedule-no-appointments{font-size:10px}
      }
    `}</style>
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
          {branchGroups.map(([branch, branchReps]) => <React.Fragment key={branch}>
            <div className="sales-schedule-branch">
              <span>{branch}</span>
              <span className="sales-schedule-branch-count">{branchReps.length} {branchReps.length === 1 ? "rep" : "reps"}</span>
            </div>
            {branchReps.map((rep) => {
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
          </React.Fragment>)}

          {unassigned.length > 0 && <React.Fragment>
            <div className="sales-schedule-branch"><span>Unassigned</span></div>
            <div className="sales-schedule-row sales-schedule-unassigned-row">
              <div className="sales-schedule-rep"><div className="sales-schedule-rep-name">Unassigned</div></div>
              <div className="sales-schedule-day">{unassigned.map((appointment) => <AppointmentCard key={appointment.appointment_row_id || appointment.id} appointment={appointment} onSelect={onSelectAppointment}/>)}</div>
            </div>
          </React.Fragment>}
        </>}
      </div>
    </div>
  </section>
}

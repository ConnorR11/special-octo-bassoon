import React, { useEffect, useMemo, useState } from "react"
import { CalendarDays, Download, Filter, ChevronDown } from "lucide-react"
import { supabase } from "../lib/supabase"

function londonToday() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function shiftDate(value, days) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function startOfWeek(value) {
  const date = new Date(`${value}T12:00:00`)
  const day = date.getDay()
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function isTrue(value) {
  if (value === true) return true
  if (typeof value === "string") return ["true", "t", "1", "yes", "y"].includes(value.trim().toLowerCase())
  return value === 1
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0
  const parsed = Number(String(value).replace(/£/g, "").replace(/,/g, "").replace(/%/g, "").trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function display(value, fallback = "Unassigned") {
  const text = String(value ?? "").trim()
  return text || fallback
}

function normaliseEmail(value) {
  return String(value ?? "").trim().toLowerCase()
}

function getDealValue(appointment) {
  const deals = appointment?.deals
  const deal = Array.isArray(deals) ? deals[0] : deals
  return toNumber(deal?.net_value ?? appointment?.net_value ?? 0)
}

function makeStats(rows) {
  return rows.reduce((stats, row) => {
    if (isTrue(row.cps_h)) stats.h += 1
    if (isTrue(row.cps_c)) stats.c += 1
    if (isTrue(row.cps_p)) stats.p += 1
    if (isTrue(row.cps_s)) {
      stats.s += 1
      stats.net += getDealValue(row)
    }
    return stats
  }, { h: 0, c: 0, p: 0, s: 0, net: 0 })
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(toNumber(value))
}

function formatPercent(value) {
  return `${toNumber(value).toFixed(1)}%`
}

function csvEscape(value) {
  const text = String(value ?? "")
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export default function CanvasserKPI() {
  const today = londonToday()
  const [startDate, setStartDate] = useState(startOfWeek(today))
  const [endDate, setEndDate] = useState(today)
  const [appointments, setAppointments] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)
  const [canvasserFilter, setCanvasserFilter] = useState("all")

  async function loadData() {
    if (!supabase) {
      setError("Supabase is not configured. Check your environment variables.")
      setLoading(false)
      return
    }
    if (!startDate || !endDate) return
    if (startDate > endDate) {
      setError("Start date must be before or equal to the end date.")
      setAppointments([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError("")
    try {
      const start = new Date(`${startDate}T00:00:00`)
      const endExclusive = new Date(`${shiftDate(endDate, 1)}T00:00:00`)
      const [appointmentsResult, profilesResult] = await Promise.all([
        supabase.from("appointments").select("*, deals(net_value)").gte("appointment_date", start.toISOString()).lt("appointment_date", endExclusive.toISOString()).order("appointment_date", { ascending: true }),
        supabase.from("profiles").select("email, full_name, display_name").order("full_name", { ascending: true }),
      ])
      if (appointmentsResult.error) throw appointmentsResult.error
      if (profilesResult.error) throw profilesResult.error
      setAppointments(appointmentsResult.data || [])
      setProfiles(profilesResult.data || [])
    } catch (err) {
      console.error("Error loading canvasser KPI data:", err)
      setError(err?.message || "Unable to load canvasser KPI data.")
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [startDate, endDate])

  const nameByEmail = useMemo(() => profiles.reduce((map, profile) => {
    const email = normaliseEmail(profile.email)
    const name = String(profile.display_name || profile.full_name || "").trim()
    if (email && name) map[email] = name
    return map
  }, {}), [profiles])

  const allRows = useMemo(() => {
    const grouped = new Map()
    appointments.forEach((appointment) => {
      const email = normaliseEmail(appointment.canvasser)
      const key = email || "unassigned"
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key).push(appointment)
    })
    return Array.from(grouped.entries()).map(([key, rows]) => {
      const stats = makeStats(rows)
      return { name: key === "unassigned" ? "Unassigned" : (nameByEmail[key] || display(rows[0]?.canvasser)), ...stats, hToP: stats.h > 0 ? (stats.p / stats.h) * 100 : 0 }
    }).sort((a, b) => b.net - a.net || b.s - a.s || b.hToP - a.hToP || a.name.localeCompare(b.name))
  }, [appointments, nameByEmail])

  const rows = useMemo(() => canvasserFilter === "all" ? allRows : allRows.filter((row) => row.name === canvasserFilter), [allRows, canvasserFilter])
  const totals = useMemo(() => makeStats(appointments), [appointments])

  function downloadCsv() {
    const header = ["Name", "H", "C", "P", "S", "NET", "H TO P"]
    const data = rows.map((row) => [row.name, row.h, row.c, row.p, row.s, row.net.toFixed(2), formatPercent(row.hToP)])
    const csv = [header, ...data].map((line) => line.map(csvEscape).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `canvasser-results-${startDate}-to-${endDate}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return <section className="canvasser-kpi-page">
    <style>{`
      .canvasser-kpi-page{margin:-24px;min-height:calc(100vh - 90px);padding:10px 14px 24px;background:#fff;color:#111;font-family:Inter,Arial,sans-serif}
      .ckpi-card{background:#fff;border:1px solid #e5e7eb;border-radius:9px;overflow:visible}
      .ckpi-hero{min-height:126px;padding:18px 54px;display:grid;grid-template-columns:1fr 460px;align-items:center;gap:35px}
      .ckpi-title{font-size:47px;line-height:1;font-weight:700;letter-spacing:-1.8px;margin:0}
      .ckpi-date-grid{display:grid;gap:12px}
      .ckpi-date-field label{display:block;font-size:11px;font-weight:700;margin:0 0 7px;color:#111}
      .ckpi-date-wrap{position:relative}
      .ckpi-date-icon{position:absolute;left:10px;top:9px;color:#666;pointer-events:none}
      .ckpi-date-input{height:34px;width:100%;box-sizing:border-box;border:0;border-radius:7px;background:#eee;color:#333;padding:0 11px 0 34px;font:12px Inter,Arial,sans-serif;outline:none}
      .ckpi-date-input:focus{box-shadow:0 0 0 2px rgba(45,155,240,.18)}
      .ckpi-results{margin-top:20px;padding:13px 27px 19px;overflow:visible}
      .ckpi-toolbar{height:42px;display:flex;justify-content:flex-end;align-items:center}
      .ckpi-download{display:inline-flex;align-items:center;gap:7px;border:0;border-radius:7px;background:#0789e8;color:#fff;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer}
      .ckpi-download:hover{background:#087ed3}.ckpi-download:disabled{opacity:.55;cursor:default}
      .ckpi-summary-head,.ckpi-summary-row,.ckpi-table-head,.ckpi-table-row{display:grid;grid-template-columns:minmax(300px,1fr) 65px 65px 65px 65px 120px 100px;align-items:center}
      .ckpi-summary-head{height:25px;font-size:8px;color:#222;text-align:center}.ckpi-summary-head>div:first-child{text-align:left}
      .ckpi-summary-row{min-height:36px;background:#f7f7f7;font-size:12px}.ckpi-summary-row>div{padding:0 7px;text-align:center}.ckpi-summary-row>div:first-child{text-align:left}
      .ckpi-filter-bar{height:62px;display:flex;justify-content:flex-end;align-items:center}.ckpi-filter-wrap{position:relative}
      .ckpi-filter-button{display:inline-flex;align-items:center;gap:10px;border:0;border-radius:7px;background:#f0f0f0;color:#9b9b9b;padding:9px 11px;font-size:12px;font-weight:600;cursor:pointer;min-width:114px;justify-content:center}.ckpi-filter-button.active{color:#555}
      .ckpi-filter-menu{position:absolute;right:0;top:42px;z-index:20;width:230px;padding:12px;background:#fff;border:1px solid #e0e4e8;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12)}
      .ckpi-filter-menu label{display:block;font-size:10px;font-weight:700;color:#667085;margin-bottom:6px}.ckpi-filter-menu select{width:100%;height:34px;border:1px solid #dfe3e8;border-radius:6px;background:#fff;padding:0 8px;font-size:12px;outline:none}
      .ckpi-table{overflow:hidden;border-radius:2px}.ckpi-table-head{min-height:31px;font-size:8px;color:#555;font-weight:700}.ckpi-table-head>div:not(:first-child){text-align:center}
      .ckpi-table-row{min-height:38px;font-size:12px}.ckpi-table-row:nth-child(even){background:#f7f7f7}.ckpi-table-row:nth-child(odd){background:#fff}.ckpi-table-row>div{padding:0 7px;min-width:0}.ckpi-table-row>div:not(:first-child){text-align:center}
      .ckpi-name{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ckpi-empty,.ckpi-loading{text-align:center;color:#8a8f98;font-size:12px;background:#fafafa;padding:34px 10px}.ckpi-error{margin:8px 0;padding:9px 12px;border-radius:6px;background:#fff2f2;color:#b42318;font-size:11px}
      @media(max-width:850px){.ckpi-hero{grid-template-columns:1fr;padding:20px 24px}.ckpi-title{font-size:36px}.ckpi-summary-head,.ckpi-summary-row,.ckpi-table-head,.ckpi-table-row{grid-template-columns:minmax(180px,1fr) 48px 48px 48px 48px 90px 75px}.ckpi-results{padding:10px 12px 16px}}
      @media(max-width:600px){.ckpi-title{font-size:31px}.ckpi-results{overflow-x:auto}.ckpi-summary-head,.ckpi-summary-row,.ckpi-table-head,.ckpi-table-row{min-width:650px}.ckpi-hero{padding:18px}.ckpi-results{padding:10px}}
    `}</style>

    <div className="ckpi-card">
      <div className="ckpi-hero">
        <h1 className="ckpi-title">Canvasser Results</h1>
        <div className="ckpi-date-grid">
          <div className="ckpi-date-field"><label htmlFor="canvasser-start-date">Start Date</label><div className="ckpi-date-wrap"><CalendarDays className="ckpi-date-icon" size={15} /><input id="canvasser-start-date" className="ckpi-date-input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div></div>
          <div className="ckpi-date-field"><label htmlFor="canvasser-end-date">End Date</label><div className="ckpi-date-wrap"><CalendarDays className="ckpi-date-icon" size={15} /><input id="canvasser-end-date" className="ckpi-date-input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div></div>
        </div>
      </div>
    </div>

    <div className="ckpi-card ckpi-results">
      <div className="ckpi-toolbar"><button type="button" className="ckpi-download" onClick={downloadCsv} disabled={loading || !rows.length}><Download size={15} /> Download</button></div>
      {error && <div className="ckpi-error">{error}</div>}
      <div className="ckpi-summary-head"><div /><div>H</div><div>C</div><div>P</div><div>S</div><div>NET</div><div>H TO P</div></div>
      <div className="ckpi-summary-row"><div>Total</div><div>N/A</div><div>N/A</div><div>N/A</div><div>{totals.s}</div><div>{formatCurrency(totals.net)}</div><div>N/A</div></div>
      <div className="ckpi-filter-bar"><div className="ckpi-filter-wrap"><button type="button" className={`ckpi-filter-button ${canvasserFilter !== "all" ? "active" : ""}`} onClick={() => setFilterOpen((value) => !value)}><Filter size={13} /> Filter <ChevronDown size={13} /></button>{filterOpen && <div className="ckpi-filter-menu"><label htmlFor="canvasser-filter">Canvasser</label><select id="canvasser-filter" value={canvasserFilter} onChange={(event) => { setCanvasserFilter(event.target.value); setFilterOpen(false) }}><option value="all">All Canvassers</option>{allRows.map((row) => <option key={row.name} value={row.name}>{row.name}</option>)}</select></div>}</div></div>
      <div className="ckpi-table">
        <div className="ckpi-table-head"><div>NAME</div><div>H</div><div>C</div><div>P</div><div>S</div><div>NET</div><div>H TO P</div></div>
        {loading ? <div className="ckpi-loading">Loading canvasser results…</div> : rows.length ? rows.map((row) => <div className="ckpi-table-row" key={row.name}><div className="ckpi-name">{row.name}</div><div>{row.h}</div><div>{row.c}</div><div>{row.p}</div><div>{row.s}</div><div>{formatCurrency(row.net)}</div><div>{formatPercent(row.hToP)}</div></div>) : <div className="ckpi-empty">No canvasser results found for the selected dates.</div>}
      </div>
    </div>
  </section>
}

import React, { useEffect, useMemo, useState } from "react"
import { BarChart3, CalendarDays, RefreshCw, Target, TrendingUp } from "lucide-react"
import { supabase } from "../lib/supabase"

const BUCKETS = [
  ["same-day", "Same day", -Infinity, 1],
  ["1-day", "1 day", 1, 2],
  ["2-3-days", "2–3 days", 2, 4],
  ["4-7-days", "4–7 days", 4, 8],
  ["8-14-days", "8–14 days", 8, 15],
  ["15-plus", "15+ days", 15, Infinity],
]

const pct = (n) => `${n.toFixed(1)}%`
const truthy = (v) => v === true || v === 1 || ["true", "t", "1", "yes", "y"].includes(String(v ?? "").trim().toLowerCase())
const leadTime = (r) => {
  const a = new Date(r.submission_date), b = new Date(r.appointment_date)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  return (b - a) / 86400000
}
const bucketFor = (days) => BUCKETS.find(([, , min, max]) => days >= min && days < max)

function Metric({ icon, label, value, detail }) {
  return <div className="aq-metric"><div className="aq-icon">{icon}</div><div className="aq-label">{label}</div><div className="aq-value">{value}</div><div className="aq-detail">{detail}</div></div>
}

export default function AppointmentQuality() {
  const [data, setData] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(""), [updated, setUpdated] = useState(null)

  async function load() {
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return }
    setLoading(true); setError("")
    const { data: rows, error: e } = await supabase.from("appointments").select("appointment_row_id,submission_date,appointment_date,cps_p").not("submission_date", "is", null).not("appointment_date", "is", null)
    if (e) { setError(e.message); setData([]) } else { setData(rows || []); setUpdated(new Date()) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const analysis = useMemo(() => {
    const rows = data.map(r => ({ ...r, days: leadTime(r) })).map(r => ({ ...r, bucket: r.days == null ? null : bucketFor(r.days), pitched: truthy(r.cps_p) })).filter(r => r.bucket)
    const buckets = BUCKETS.map(([key, label]) => { const x = rows.filter(r => r.bucket[0] === key), p = x.filter(r => r.pitched).length; return { key, label, total: x.length, pitched: p, rate: x.length ? p / x.length * 100 : 0 } })
    const pitched = rows.filter(r => r.pitched).length
    const best = buckets.filter(b => b.total).sort((a, b) => b.rate - a.rate)[0]
    return { rows, buckets, pitched, overall: rows.length ? pitched / rows.length * 100 : 0, best }
  }, [data])

  const max = Math.max(...analysis.buckets.map(b => b.rate), 1)

  return <section className="appointment-quality-page"><style>{`
    .appointment-quality-page{padding:24px;min-height:calc(100vh - 80px);background:#f5f7fa;color:#172033;font-family:Inter,Arial,sans-serif}
    .aq-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:24px}.aq-title{display:flex;gap:12px;align-items:center}.aq-icon{width:40px;height:40px;border-radius:9px;background:#eaf6ff;color:#1688d4;display:flex;align-items:center;justify-content:center}.aq-head h1{margin:0;font-size:28px;letter-spacing:-.7px}.aq-head p{margin:5px 0 0;color:#64748b;font-size:14px}.aq-refresh{border:1px solid #d7dee8;background:#fff;color:#334155;border-radius:8px;padding:9px 13px;display:inline-flex;align-items:center;gap:7px;cursor:pointer}.aq-refresh:disabled{opacity:.6}
    .aq-error{padding:12px 14px;margin-bottom:20px;border:1px solid #fecaca;background:#fef2f2;color:#991b1b;border-radius:9px}.aq-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px}.aq-metric,.aq-card{background:#fff;border:1px solid #e1e6ec;border-radius:10px}.aq-metric{padding:18px}.aq-metric .aq-icon{width:30px;height:30px;background:#f1f5f9;color:#334155;margin-bottom:10px}.aq-label{font-size:12px;color:#64748b;font-weight:600}.aq-value{font-size:25px;font-weight:750;margin-top:3px}.aq-detail{font-size:12px;color:#94a3b8;margin-top:3px}.aq-card{padding:20px;margin-bottom:20px}.aq-card h2{margin:0;font-size:18px}.aq-card p{margin:5px 0 20px;color:#64748b;font-size:13px}.aq-chart{display:flex;flex-direction:column;gap:14px}.aq-row{display:grid;grid-template-columns:90px 1fr 70px;gap:14px;align-items:center}.aq-row-label{font-size:13px;font-weight:650}.aq-track{height:30px;background:#eef2f7;border-radius:6px;overflow:hidden}.aq-bar{height:100%;background:#2698ed;border-radius:6px}.aq-rate{text-align:right;font-weight:750}.aq-table{width:100%;border-collapse:collapse}.aq-table th{text-align:left;padding:9px;color:#94a3b8;font-size:10px;text-transform:uppercase;border-bottom:1px solid #e2e8f0}.aq-table td{padding:12px 9px;border-bottom:1px solid #eef2f7;font-size:13px}.aq-num{text-align:right}.aq-best{background:#f8fbff}.aq-note{margin-top:14px;color:#94a3b8;font-size:11px}.aq-empty{padding:40px;text-align:center;color:#94a3b8}
    @media(max-width:750px){.appointment-quality-page{padding:16px}.aq-head{flex-direction:column}.aq-metrics{grid-template-columns:1fr}.aq-row{grid-template-columns:70px 1fr 60px}.aq-card{overflow-x:auto}.aq-table{min-width:500px}}
  `}</style>
    <div className="aq-head"><div><div className="aq-title"><div className="aq-icon"><BarChart3 size={20}/></div><div><h1>Appointment Quality</h1><p>How the time between booking and appointment affects the pitch rate.</p></div></div></div><button className="aq-refresh" onClick={load} disabled={loading}><RefreshCw size={15}/>{loading ? "Loading" : "Refresh"}</button></div>
    {error && <div className="aq-error">{error}</div>}
    <div className="aq-metrics"><Metric icon={<CalendarDays size={16}/>} label="Appointments analysed" value={loading ? "…" : analysis.rows.length} detail="Valid booking and appointment dates"/><Metric icon={<Target size={16}/>} label="Overall pitch rate" value={loading ? "…" : pct(analysis.overall)} detail={`${analysis.pitched} pitched appointments`}/><Metric icon={<TrendingUp size={16}/>} label="Best booking window" value={loading ? "…" : analysis.best?.label || "—"} detail={analysis.best ? `${pct(analysis.best.rate)} pitch rate` : "Not enough data"}/></div>
    <div className="aq-card"><h2>Pitch rate by booking lead time</h2><p>Percentage of appointments pitched, grouped by how far in advance they were booked.</p>{loading ? <div className="aq-empty">Loading appointment data…</div> : analysis.rows.length === 0 ? <div className="aq-empty">No valid appointment data found.</div> : <div className="aq-chart">{analysis.buckets.map(b => <div className="aq-row" key={b.key}><div className="aq-row-label">{b.label}</div><div className="aq-track"><div className="aq-bar" style={{width:b.total ? `${b.rate / max * 100}%` : "0%"}}/></div><div className="aq-rate">{b.total ? pct(b.rate) : "—"}</div></div>)}</div>}</div>
    <div className="aq-card"><h2>Detailed breakdown</h2><p>Appointment volume alongside pitch rate.</p><table className="aq-table"><thead><tr><th>Booking lead time</th><th className="aq-num">Appointments</th><th className="aq-num">Pitched</th><th className="aq-num">Pitch rate</th></tr></thead><tbody>{analysis.buckets.map(b => <tr key={b.key} className={analysis.best?.key === b.key ? "aq-best" : ""}><td>{b.label}</td><td className="aq-num">{b.total}</td><td className="aq-num">{b.pitched}</td><td className="aq-num"><strong>{b.total ? pct(b.rate) : "—"}</strong></td></tr>)}</tbody></table><div className="aq-note">Lead time = appointment_date minus submission_date. Pitch rate uses cps_p. Datetimes are compared as stored; display timezone formatting does not affect the calculation.</div></div>
    {updated && <div style={{color:"#94a3b8",fontSize:11}}>Last updated {updated.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</div>}
  </section>
}

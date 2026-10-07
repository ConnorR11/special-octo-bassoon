import React, { useEffect, useMemo, useState } from "react"
import { Search, RefreshCw, Save, Check, X, ChevronLeft, ChevronRight } from "lucide-react"
import { supabase } from "../lib/supabase"

function normalise(value) { return String(value ?? "").trim().toLowerCase() }
function isSolarAppointment(a) {
  if (!a) return false
  if (a.epvs_calculation) return true
  return [a.product, a.job_type].some((v) => normalise(v).includes("solar"))
}
function formatDateTime(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
}

const PAGE_SIZE = 50

export default function OpenSolarIds({ embedded = false }) {
  const [appointments, setAppointments] = useState([])
  const [drafts, setDrafts] = useState({})
  const [search, setSearch] = useState("")
  const [hideWithOpenSolarId, setHideWithOpenSolarId] = useState(false)
  const [page, setPage] = useState(0)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [savedId, setSavedId] = useState(null)
  const [error, setError] = useState("")

  async function loadAppointments(targetPage = page) {
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return }
    setLoading(true); setError("")
    try {
      const from = targetPage * PAGE_SIZE
      const to = from + PAGE_SIZE

      let query = supabase
        .from("appointments")
        .select("appointment_row_id,name,postcode,appointment_date,product,job_type,open_solar_id,epvs_calculation")
        .gte("appointment_date", "2026-01-01T00:00:00")
        .or("product.ilike.%solar%,job_type.ilike.%solar%")
        .order("appointment_date", { ascending: false })

      const searchTerm = normalise(search).replace(/[(),]/g, "")
      if (searchTerm) {
        const searchFilters = [
          "name.ilike.%" + searchTerm + "%",
          "postcode.ilike.%" + searchTerm + "%",
          "product.ilike.%" + searchTerm + "%",
          "job_type.ilike.%" + searchTerm + "%"
        ]
        if (/^\d+$/.test(searchTerm)) searchFilters.push("open_solar_id.eq." + searchTerm)
        query = query.or(searchFilters.join(","))
      }
      if (hideWithOpenSolarId) query = query.is("open_solar_id", null)

      query = query.range(from, to)

      const { data, error: queryError } = await query
      if (queryError) throw queryError

      const rows = data || []
      const solar = rows.slice(0, PAGE_SIZE)
      setAppointments(solar)
      setHasNextPage(rows.length > PAGE_SIZE)
      setPage(targetPage)
      setDrafts(Object.fromEntries(solar.map((a) => [a.appointment_row_id, a.open_solar_id ?? ""])))
    } catch (err) { setError(err?.message || "Unable to load solar appointments."); setAppointments([]); setDrafts({}); setHasNextPage(false) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadAppointments(0) }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => loadAppointments(0), 250)
    return () => window.clearTimeout(timer)
  }, [search, hideWithOpenSolarId])

  async function saveOpenSolarId(appointment) {
    const id = appointment.appointment_row_id
    const value = String(drafts[id] ?? "").trim()
    setSavingId(id); setSavedId(null); setError("")
    try {
      const { error: updateError } = await supabase.from("appointments").update({ open_solar_id: value || null }).eq("appointment_row_id", id)
      if (updateError) throw updateError
      setAppointments((current) => current.map((item) => item.appointment_row_id === id ? { ...item, open_solar_id: value || null } : item))
      setDrafts((current) => ({ ...current, [id]: value }))
      setSavedId(id)
      window.setTimeout(() => setSavedId((current) => current === id ? null : current), 1800)
    } catch (err) { setError(err?.message || "Unable to update OpenSolar ID.") }
    finally { setSavingId(null) }
  }

  function resetDraft(a) { setDrafts((current) => ({ ...current, [a.appointment_row_id]: a.open_solar_id ?? "" })) }

  const filteredAppointments = useMemo(() => appointments, [appointments])

  return (
    <section className={`open-solar-page ${embedded ? "open-solar-embedded" : ""}`}>
      <style>{`
        .open-solar-page{min-height:100%;padding:28px 32px 40px;background:#f5f7fa;color:#0f172a;box-sizing:border-box}.open-solar-page.open-solar-embedded{padding:0;background:transparent;min-height:auto}.open-solar-page.open-solar-embedded .open-solar-container{max-width:none}
        .open-solar-container{max-width:1500px;margin:0 auto}.open-solar-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:18px}
        .open-solar-eyebrow{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#0877bd;margin-bottom:6px}.open-solar-heading{margin:0;font-size:30px;line-height:1.1;font-weight:750}
        .open-solar-subtitle{margin:6px 0 0;color:#64748b;font-size:13px}.open-solar-refresh{height:38px;padding:0 13px;border:1px solid #d7dee7;border-radius:8px;background:#fff;color:#475569;font-weight:700;font-size:12px;display:inline-flex;align-items:center;gap:7px;cursor:pointer}
        .open-solar-controls{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}.open-solar-control-right{display:flex;align-items:center;gap:12px}.open-solar-toggle{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 11px;border:1px solid #d7dee7;border-radius:8px;background:#fff;color:#475569;font-size:11px;font-weight:700;white-space:nowrap;cursor:pointer}.open-solar-toggle input{margin:0}.open-solar-search{display:flex;align-items:center;gap:7px;height:38px;padding:0 11px;border:1px solid #d7dee7;border-radius:8px;background:#fff;min-width:300px}
        .open-solar-search input{border:0;outline:0;background:transparent;width:100%;font:inherit;font-size:12px}.open-solar-count{font-size:12px;color:#64748b;font-weight:600}
        .open-solar-panel{background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 2px 10px rgba(15,23,42,.05);overflow:hidden}.open-solar-table-wrap{overflow-x:auto}
        .open-solar-table{width:100%;border-collapse:collapse;font-size:12px}.open-solar-table th{background:#575757;color:#fff;padding:11px 12px;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}
        .open-solar-table td{padding:10px 12px;border-top:1px solid #e8edf2;color:#334155;white-space:nowrap}.open-solar-name{font-weight:750;color:#0f172a}
        .open-solar-input{width:260px;height:34px;padding:0 9px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#0f172a;font:inherit;font-size:12px;box-sizing:border-box}.open-solar-input:focus{outline:none;border-color:#0877bd}
        .open-solar-actions{display:flex;align-items:center;gap:6px}.open-solar-save,.open-solar-cancel{height:32px;padding:0 10px;border-radius:7px;font-size:11px;font-weight:750;display:inline-flex;align-items:center;gap:5px;cursor:pointer}
        .open-solar-save{border:1px solid #0877bd;background:#0877bd;color:#fff}.open-solar-cancel{border:1px solid #d7dee7;background:#fff;color:#475569}.open-solar-saved{font-size:11px;color:#15803d;font-weight:700;display:inline-flex;align-items:center;gap:4px}
        .open-solar-empty{text-align:center;padding:42px 20px;color:#64748b}.open-solar-error{margin-bottom:12px;padding:11px 13px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:12px}
        .open-solar-pagination{display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;border-top:1px solid #e8edf2;background:#fff}.open-solar-page-btn{height:32px;padding:0 10px;border:1px solid #d7dee7;border-radius:7px;background:#fff;color:#475569;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:5px;cursor:pointer}.open-solar-page-btn:disabled{opacity:.45;cursor:not-allowed}.open-solar-page-number{font-size:11px;color:#64748b;font-weight:700;min-width:70px;text-align:center}
        @media(max-width:800px){.open-solar-page{padding:20px 14px}.open-solar-header,.open-solar-controls{flex-direction:column;align-items:stretch}.open-solar-control-right{flex-direction:column;align-items:stretch}.open-solar-search{min-width:0}}
      `}</style>
      <div className="open-solar-container">
        <div className="open-solar-header"><div><div className="open-solar-eyebrow">Administration</div><h1 className="open-solar-heading">OpenSolar IDs</h1><p className="open-solar-subtitle">Update the OpenSolar project ID for solar appointments.</p></div>
          <button type="button" className="open-solar-refresh" onClick={() => loadAppointments(page)} disabled={loading}><RefreshCw size={14}/>{loading ? "Loading..." : "Refresh"}</button>
        </div>
        {error && <div className="open-solar-error">{error}</div>}
        <div className="open-solar-controls"><div className="open-solar-count">{filteredAppointments.length} solar appointments on this page</div><div className="open-solar-control-right"><label className="open-solar-toggle"><input type="checkbox" checked={hideWithOpenSolarId} onChange={(event) => setHideWithOpenSolarId(event.target.checked)}/><span>Hide jobs with OpenSolar ID</span></label><div className="open-solar-search"><Search size={14}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search appointment, postcode or OpenSolar ID"/></div></div></div>
        <div className="open-solar-panel"><div className="open-solar-table-wrap"><table className="open-solar-table"><thead><tr><th>Appointment</th><th>Appointment Date & Time</th><th>Postcode</th><th>OpenSolar ID</th><th>Action</th></tr></thead><tbody>
          {loading ? <tr><td colSpan="5" className="open-solar-empty">Loading solar appointments...</td></tr> : filteredAppointments.length === 0 ? <tr><td colSpan="5" className="open-solar-empty">No solar appointments found.</td></tr> : filteredAppointments.map((appointment) => {
            const id = appointment.appointment_row_id; const draft = String(drafts[id] ?? ""); const original = String(appointment.open_solar_id ?? ""); const changed = draft !== original; const saving = savingId === id; const saved = savedId === id
            return <tr key={id}><td className="open-solar-name">{appointment.name || "—"}</td><td>{formatDateTime(appointment.appointment_date)}</td><td>{appointment.postcode || "—"}</td><td>
              <input className="open-solar-input" value={draft} onChange={(event) => setDrafts((current) => ({ ...current, [id]: event.target.value }))} placeholder="Enter OpenSolar ID" disabled={saving} onKeyDown={(event) => { if (event.key === "Enter" && changed) saveOpenSolarId(appointment); if (event.key === "Escape") resetDraft(appointment) }}/>
            </td><td><div className="open-solar-actions"><button type="button" className="open-solar-save" onClick={() => saveOpenSolarId(appointment)} disabled={!changed || saving}><Save size={13}/>{saving ? "Saving..." : "Save"}</button><button type="button" className="open-solar-cancel" onClick={() => resetDraft(appointment)} disabled={!changed || saving}><X size={13}/>Reset</button>{saved && <span className="open-solar-saved"><Check size={13}/>Saved</span>}</div></td></tr>
          })}
        </tbody></table></div>
        <div className="open-solar-pagination"><button type="button" className="open-solar-page-btn" onClick={() => loadAppointments(page - 1)} disabled={loading || page === 0}><ChevronLeft size={14}/>Previous</button><span className="open-solar-page-number">Page {page + 1}</span><button type="button" className="open-solar-page-btn" onClick={() => loadAppointments(page + 1)} disabled={loading || !hasNextPage}>Next<ChevronRight size={14}/></button></div>
        </div>
      </div>
    </section>
  )
}
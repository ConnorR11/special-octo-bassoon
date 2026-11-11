import React, { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw, Search, Sun, FileCheck, ClipboardCheck, CalendarDays, HardHat, Zap, ChevronRight, AlertCircle } from "lucide-react"
import { supabase } from "../lib/supabase"

const PAGE_SIZE = 50
const panel = { background: "#fff", border: "1px solid #e1e7ee", borderRadius: 12, boxShadow: "0 2px 8px rgba(15,23,42,.04)" }
const th = { padding: "11px 13px", textAlign: "left", color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: ".04em", borderBottom: "1px solid #e8edf2", whiteSpace: "nowrap" }
const td = { padding: "12px 13px", borderBottom: "1px solid #edf1f5", fontSize: 12, verticalAlign: "middle" }

function dateLabel(value) {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}
function money(value) {
  const n = Number(value)
  return Number.isFinite(n) && n ? n.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }) : "—"
}
function isSolar(deal) {
  return /solar|photovoltaic|\bpv\b/i.test(String(deal.product || "") + " " + String(deal.pipedrive_data?.product || ""))
}
function progressFor(deal, docs, answers, epvs, appointment) {
  const signed = Boolean(appointment?.customer_signed_at || (appointment?.signature_path && appointment?.express_fit_signature_path && appointment?.seg_disclaimer_signature_path))
  const hasPhotos = docs.some(d => d.category === "survey_photos" || d.category === "survey_video")
  const hasBill = docs.some(d => d.category === "electricity_bill_epvs_waiver")
  const hasPdf = docs.some(d => d.category === "survey_pdf")
  const answered = Object.values(answers || {}).filter(v => String(v ?? "").trim()).length
  const surveyStarted = hasPhotos || hasPdf || answered > 0
  const epvsSubmitted = Boolean(epvs)
  const epvsStatus = String(epvs?.status || "").trim().toLowerCase()
  const validated = epvsStatus.includes("validat") || epvsStatus === "registered"
  const cells = [
    { key:"survey", state:hasPhotos && hasPdf ? "done" : surveyStarted ? "partial" : "empty", detail:`${docs.length} files · ${answered} answers` },
    { key:"opensolar", state:signed ? "done" : "empty", detail:signed ? dateLabel(appointment?.customer_signed_at) : "No signature recorded" },
    { key:"bill", state:hasBill ? "done" : "empty", detail:hasBill ? "Uploaded" : "Not uploaded" },
    { key:"hies", state:"unknown", detail:"No linked CRM record" },
    { key:"epvs", state:epvsSubmitted ? "done" : "empty", detail:epvs?.status || "No linked submission" },
    { key:"validated", state:validated ? "done" : epvsSubmitted ? "partial" : "empty", detail:epvs?.status || "Not submitted" },
    { key:"product", state:"unknown", detail:"No structured order record" },
    { key:"scaffold", state:"unknown", detail:"No structured booking record" },
    { key:"confirmation", state:"unknown", detail:"No email event linked" },
  ]
  let current = "Awaiting survey information"
  if (signed) current = "OpenSolar signed"
  if (surveyStarted) current = hasPhotos && hasPdf && hasBill ? "Survey information recorded" : "Survey information in progress"
  if (epvsSubmitted) current = validated ? "EPVS validated" : "EPVS submitted"
  if (deal.installation_start_date) current = "Installation scheduled"
  if (deal.installation_roof_start_date || deal.installation_electrics_start_date) current = "Installation in progress"
  if (deal.remedial_start_date) current = "Remedial work recorded"
  return { current, cells, hasContract:signed, hasSurveyData:surveyStarted, surveyComplete:hasPhotos && hasPdf && hasBill, epvsComplete:epvsSubmitted, installationScheduled:Boolean(deal.installation_start_date), roofStarted:Boolean(deal.installation_roof_start_date || deal.installation_electrics_start_date) }
}

export default function SolarPipeline({ onSelectDeal }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [branch, setBranch] = useState("all")
  const [progressFilter, setProgressFilter] = useState("all")
  const [page, setPage] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(null)

  const load = useCallback(async () => {
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return }
    setLoading(true); setError("")
    try {
      const { data: deals, error: dealError } = await supabase.from("deals")
        .select("id,pipedrive_deal_id,contract_number,customer_name,phone,email,address,postcode,product,pipedrive_data,deal_value,net_value,balance_outstanding,salesperson,salesperson_name,sale_date,status,installation_start_date,fit_team_1,appointment_row_id,branch,installation_roof_start_date,installation_roof_team,installation_electrics_start_date,installation_electrics_team,remedial_start_date,remedial_fit_team")
        .order("sale_date", { ascending: false }).limit(2000)
      if (dealError) throw dealError
      const solarDeals = (deals || []).filter(deal => isSolar(deal) && Number(deal.balance_outstanding) > 0)
      const ids = solarDeals.map(d => String(d.id))
      const appointmentIds = [...new Set(solarDeals.map(d => String(d.appointment_row_id || "")).filter(Boolean))]
      const [docsResult, answersResult, epvsResult, appointmentsResult] = await Promise.all([
        ids.length ? supabase.from("deal_documents").select("deal_id,category,file_name,created_at").in("deal_id", ids) : Promise.resolve({ data: [], error: null }),
        ids.length ? supabase.from("deal_survey_answers").select("deal_id,answers,updated_at").in("deal_id", ids) : Promise.resolve({ data: [], error: null }),
        ids.length ? supabase.from("epvs_submissions").select("linked_deal_id,status,epvs_created_at,last_activity_at").in("linked_deal_id", ids) : Promise.resolve({ data: [], error: null }),
        appointmentIds.length ? supabase.from("appointments").select("appointment_row_id,contract_number,signature_path,express_fit_signature_path,seg_disclaimer_signature_path,customer_signed_at,branch").in("appointment_row_id", appointmentIds) : Promise.resolve({ data: [], error: null }),
      ])
      for (const result of [docsResult, answersResult, epvsResult, appointmentsResult]) if (result.error) throw result.error
      const byDeal = new Map()
      for (const doc of docsResult.data || []) { const id = String(doc.deal_id); if (!byDeal.has(id)) byDeal.set(id, []); byDeal.get(id).push(doc) }
      const answerByDeal = new Map((answersResult.data || []).map(x => [String(x.deal_id), x.answers || {}]))
      const epvsByDeal = new Map()
      for (const item of epvsResult.data || []) {
        const id = String(item.linked_deal_id)
        const existing = epvsByDeal.get(id)
        if (!existing || String(item.last_activity_at || item.epvs_created_at || "") > String(existing.last_activity_at || existing.epvs_created_at || "")) epvsByDeal.set(id, item)
      }
      const appointmentById = new Map((appointmentsResult.data || []).map(x => [String(x.appointment_row_id), x]))
      const mapped = solarDeals.map(deal => {
        const docs = byDeal.get(String(deal.id)) || []
        const answers = answerByDeal.get(String(deal.id)) || {}
        const epvs = epvsByDeal.get(String(deal.id)) || null
        const appointment = appointmentById.get(String(deal.appointment_row_id || "")) || null
        const progress = progressFor(deal, docs, answers, epvs, appointment)
        return { ...deal, docs, answers, epvs, appointment, progress, branch: deal.branch || appointment?.branch || "Unassigned" }
      })
      setRows(mapped)
      setLastUpdated(new Date())
    } catch (e) {
      console.error("Unable to load solar pipeline:", e)
      setError(e?.message || "Unable to load Solar Pipeline.")
    } finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const branches = useMemo(() => [...new Set(rows.map(r => r.branch).filter(Boolean))].sort(), [rows])
  const filtered = useMemo(() => rows.filter(row => {
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || [row.customer_name, row.postcode, row.address, row.contract_number, row.salesperson_name, row.salesperson].some(v => String(v || "").toLowerCase().includes(q))
    return matchesSearch && (branch === "all" || row.branch === branch) && (progressFilter === "all" || row.progress.current === progressFilter)
  }), [rows, search, branch, progressFilter])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totals = useMemo(() => ({
    jobs: rows.length,
    value: rows.reduce((sum, r) => sum + (Number(r.balance_outstanding) || 0), 0),
    scheduled: rows.filter(r => r.progress.installationScheduled).length,
    onSite: rows.filter(r => r.progress.roofStarted).length,
    awaitingSurvey: rows.filter(r => !r.progress.surveyComplete).length,
  }), [rows])

  return <section style={{ padding: "24px 28px 40px", color: "#17212b", minHeight: "100%", background: "#f6f8fb", boxSizing: "border-box" }}>
    <div style={{ maxWidth: 1600, margin: "0 auto" }}>
      <div style={{ background: "linear-gradient(110deg,#142f55,#245b91)", borderRadius: 14, padding: "22px 25px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, boxShadow: "0 8px 22px rgba(15,35,65,.16)", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(255,255,255,.13)", border: "1px solid rgba(255,255,255,.2)", display: "grid", placeItems: "center" }}><Sun size={24}/></div>
          <div><div style={{ fontSize: 10, letterSpacing: ".12em", fontWeight: 800, opacity: .8 }}>HOMESHIELD · WORK IN PROGRESS</div><h1 style={{ margin: "4px 0", fontSize: 25 }}>Solar Pipeline</h1><div style={{ fontSize: 12, opacity: .85 }}>Live progress for solar jobs with money still outstanding, based on CRM records and linked evidence — independent of Pipedrive stages.</div></div>
        </div>
        <button onClick={() => { setRefreshing(true); load() }} disabled={loading} style={{ height: 38, border: "1px solid rgba(255,255,255,.35)", borderRadius: 8, background: "rgba(255,255,255,.12)", color: "#fff", padding: "0 13px", display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", fontWeight: 700, fontSize: 11 }}><RefreshCw size={14}/> Refresh</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 12, marginBottom: 16 }}>
        {[
          ["Solar jobs", totals.jobs, Sun], ["Outstanding balance", money(totals.value), Zap], ["Installation scheduled", totals.scheduled, CalendarDays], ["Installation activity", totals.onSite, HardHat], ["Survey incomplete", totals.awaitingSurvey, ClipboardCheck],
        ].map(([label, value, Icon]) => <div key={label} style={{ ...panel, padding: 16 }}><div style={{ color: "#64748b", fontSize: 11 }}>{label}</div><div style={{ marginTop: 7, fontSize: 24, fontWeight: 800, color: "#122d50" }}>{value}</div></div>)}
      </div>

      <div style={{ ...panel, padding: 14, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 9, marginBottom: 14 }}>
        <div style={{ position: "relative", flex: "1 1 260px" }}><Search size={15} style={{ position: "absolute", left: 11, top: 12, color: "#64748b" }}/><input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="Search customer, postcode, address, contract…" style={{ height: 38, width: "100%", boxSizing: "border-box", border: "1px solid #d8e0e8", borderRadius: 8, padding: "0 12px 0 34px", fontSize: 12 }}/></div>
        <select value={branch} onChange={e => { setBranch(e.target.value); setPage(0) }} style={{ height: 38, minWidth: 155, border: "1px solid #d8e0e8", borderRadius: 8, padding: "0 10px", background: "#fff", fontSize: 12 }}><option value="all">All branches</option>{branches.map(b => <option key={b}>{b}</option>)}</select>
        <select value={progressFilter} onChange={e => { setProgressFilter(e.target.value); setPage(0) }} style={{ height: 38, minWidth: 210, border: "1px solid #d8e0e8", borderRadius: 8, padding: "0 10px", background: "#fff", fontSize: 12 }}><option value="all">All progress</option>{[...new Set(rows.map(r => r.progress.current))].sort().map(s => <option key={s}>{s}</option>)}</select>
        <div style={{ color: "#64748b", fontSize: 11, marginLeft: "auto" }}>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}</div>
      </div>

      <div style={{ ...panel, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e8edf2" }}><strong style={{ fontSize: 13 }}>Solar jobs</strong><span style={{ color: "#64748b", fontSize: 11 }}>{filtered.length.toLocaleString("en-GB")} jobs · Page {Math.min(page + 1, pages)} of {pages}</span></div>
        {error && <div style={{ margin: 14, padding: 12, borderRadius: 8, background: "#fff1f2", color: "#b42318", fontSize: 12 }}><AlertCircle size={14} style={{ verticalAlign: "middle", marginRight: 6 }}/>{error}</div>}
        {loading ? <div style={{ padding: 35, textAlign: "center", color: "#64748b", fontSize: 12 }}>Loading solar jobs…</div> : visible.length === 0 ? <div style={{ padding: 35, textAlign: "center", color: "#64748b", fontSize: 12 }}>No solar jobs match these filters.</div> : <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 1800, borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={{ ...th, position:"sticky", left:0, zIndex:3, background:"#f8fafc", minWidth:230 }}>Solar installation tracker</th>
              {["Survey docs / photos","OpenSolar signed","Bill / EPVS waiver","HIES registration","EPVS submitted","EPVS validated","Product ordered","Scaffolding booked","Installation confirmation"].map(label => <th key={label} style={{ ...th, minWidth:130, whiteSpace:"normal", lineHeight:1.35 }}>{label}</th>)}
              <th style={th}>Outstanding balance</th>
            </tr></thead>
            <tbody>{visible.map(row => <tr key={row.id} onClick={() => onSelectDeal?.(row)} style={{ cursor:onSelectDeal ? "pointer" : "default" }}>
              <td style={{ ...td, position:"sticky", left:0, zIndex:1, background:"#fff", minWidth:230 }}>
                <div style={{ fontWeight:750, color:"#122d50" }}>{row.customer_name || "Unnamed customer"}</div>
                <div style={{ color:"#64748b", marginTop:3 }}>{row.postcode || "No postcode"} · {row.contract_number || "No contract ref"}</div>
                <div style={{ color:"#64748b", fontSize:10, marginTop:3 }}>{row.salesperson_name || row.salesperson || "—"} · {row.branch}</div>
              </td>
              {row.progress.cells.map(cell => <td key={cell.key} style={{ ...td, padding:0, minWidth:130 }}>
                <div title={cell.detail} style={{ minHeight:54, boxSizing:"border-box", padding:"9px 8px", display:"flex", flexDirection:"column", justifyContent:"center", gap:4, background:cell.state==="done" ? "#00b050" : cell.state==="partial" ? "#ffc000" : cell.state==="unknown" ? "#e5e7eb" : "#fff", color:cell.state==="done" ? "#064e2b" : cell.state==="partial" ? "#713f12" : "#475569" }}>
                  <strong style={{ fontSize:11 }}>{cell.state==="done" ? "Yes" : cell.state==="partial" ? "In progress" : cell.state==="unknown" ? "Not tracked" : "No"}</strong>
                  <span style={{ fontSize:9, lineHeight:1.3 }}>{cell.detail}</span>
                </div>
              </td>)}
              <td style={{ ...td, fontWeight:750, color:"#b45309", whiteSpace:"nowrap" }}>{money(row.balance_outstanding)}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        <div style={{ padding: 12, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, borderTop: "1px solid #e8edf2" }}>
          <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} style={{ height: 32, padding: "0 11px", border: "1px solid #d8e0e8", borderRadius: 7, background: "#fff", cursor: page === 0 ? "not-allowed" : "pointer" }}>Previous</button><span style={{ fontSize: 11, color: "#64748b" }}>Page {page + 1} of {pages}</span><button disabled={page + 1 >= pages} onClick={() => setPage(p => Math.min(pages - 1, p + 1))} style={{ height: 32, padding: "0 11px", border: "1px solid #d8e0e8", borderRadius: 7, background: "#fff", cursor: page + 1 >= pages ? "not-allowed" : "pointer" }}>Next</button>
        </div>
      </div>
      <div style={{ marginTop: 10, color: "#64748b", fontSize: 10 }}>Green = completed evidence · Amber = partially recorded / in progress · Grey = no structured CRM record yet · White = not recorded. Progress is based on CRM data, not Pipedrive stages.</div>
    </div>
  </section>
}

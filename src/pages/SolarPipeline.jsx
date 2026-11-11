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
  const hasContract = Boolean(appointment?.contract_number && appointment?.signature_path && appointment?.express_fit_signature_path && appointment?.seg_disclaimer_signature_path)
  const hasSurveyVideo = docs.some(d => d.category === "survey_video")
  const hasBill = docs.some(d => d.category === "electricity_bill_epvs_waiver")
  const hasSurveyPdf = docs.some(d => d.category === "survey_pdf")
  const answered = Object.values(answers || {}).filter(v => String(v ?? "").trim()).length
  const hasSurveyData = answered > 0 || docs.some(d => d.category === "survey_photos")
  const surveyComplete = hasSurveyVideo && hasBill && hasSurveyPdf && answered >= 27
  const epvsComplete = Boolean(epvs)
  const installationScheduled = Boolean(deal.installation_start_date)
  const roofStarted = Boolean(deal.installation_roof_start_date)
  const electricsStarted = Boolean(deal.installation_electrics_start_date)
  const remedialStarted = Boolean(deal.remedial_start_date)
  let current = "Awaiting contract information"
  if (hasContract) current = "Contract signed"
  if (hasSurveyData) current = surveyComplete ? "Survey information complete" : "Survey in progress"
  if (epvsComplete) current = "EPVS submitted"
  if (installationScheduled) current = "Installation scheduled"
  if (roofStarted || electricsStarted) current = "Installation in progress"
  if (remedialStarted) current = "Remedial work recorded"
  const milestones = [
    { label: "Contract", done: hasContract, detail: hasContract ? dateLabel(appointment.customer_signed_at) : "Awaiting signatures" },
    { label: "Survey", done: surveyComplete, detail: surveyComplete ? "Required survey data present" : `${answered}/27 answers · ${docs.length} files` },
    { label: "EPVS", done: epvsComplete, detail: epvs ? (epvs.status || "Submission linked") : "No linked submission" },
    { label: "Installation", done: installationScheduled, detail: installationScheduled ? dateLabel(deal.installation_start_date) : "No start date recorded" },
    { label: "On site", done: roofStarted || electricsStarted, detail: roofStarted ? `Roof ${dateLabel(deal.installation_roof_start_date)}` : electricsStarted ? `Electrics ${dateLabel(deal.installation_electrics_start_date)}` : "No installation activity recorded" },
  ]
  return { current, milestones, hasContract, hasSurveyData, surveyComplete, epvsComplete, installationScheduled, roofStarted: roofStarted || electricsStarted }
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
        .select("id,pipedrive_deal_id,contract_number,customer_name,phone,email,address,postcode,product,deal_value,net_value,salesperson,salesperson_name,sale_date,status,installation_start_date,fit_team_1,appointment_row_id,branch,installation_roof_start_date,installation_roof_team,installation_electrics_start_date,installation_electrics_team,remedial_start_date,remedial_fit_team")
        .order("sale_date", { ascending: false }).limit(2000)
      if (dealError) throw dealError
      const solarDeals = (deals || []).filter(isSolar)
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
    value: rows.reduce((sum, r) => sum + (Number(r.net_value ?? r.deal_value) || 0), 0),
    scheduled: rows.filter(r => r.progress.installationScheduled).length,
    onSite: rows.filter(r => r.progress.roofStarted).length,
    awaitingSurvey: rows.filter(r => !r.progress.surveyComplete).length,
  }), [rows])

  return <section style={{ padding: "24px 28px 40px", color: "#17212b", minHeight: "100%", background: "#f6f8fb", boxSizing: "border-box" }}>
    <div style={{ maxWidth: 1600, margin: "0 auto" }}>
      <div style={{ background: "linear-gradient(110deg,#142f55,#245b91)", borderRadius: 14, padding: "22px 25px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, boxShadow: "0 8px 22px rgba(15,35,65,.16)", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(255,255,255,.13)", border: "1px solid rgba(255,255,255,.2)", display: "grid", placeItems: "center" }}><Sun size={24}/></div>
          <div><div style={{ fontSize: 10, letterSpacing: ".12em", fontWeight: 800, opacity: .8 }}>HOMESHIELD · WORK IN PROGRESS</div><h1 style={{ margin: "4px 0", fontSize: 25 }}>Solar Pipeline</h1><div style={{ fontSize: 12, opacity: .85 }}>Live progress from CRM records, documents and linked systems — independent of Pipedrive stages.</div></div>
        </div>
        <button onClick={() => { setRefreshing(true); load() }} disabled={loading} style={{ height: 38, border: "1px solid rgba(255,255,255,.35)", borderRadius: 8, background: "rgba(255,255,255,.12)", color: "#fff", padding: "0 13px", display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", fontWeight: 700, fontSize: 11 }}><RefreshCw size={14}/> Refresh</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 12, marginBottom: 16 }}>
        {[
          ["Solar jobs", totals.jobs, Sun], ["Net value", money(totals.value), Zap], ["Installation scheduled", totals.scheduled, CalendarDays], ["Installation activity", totals.onSite, HardHat], ["Survey incomplete", totals.awaitingSurvey, ClipboardCheck],
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
          <table style={{ width: "100%", minWidth: 1160, borderCollapse: "collapse" }}>
            <thead><tr>{["Customer / Contract","Branch","Sold","Salesperson","Value","Current progress","Evidence milestones","Installation"].map(x => <th key={x} style={th}>{x}</th>)}<th style={th}></th></tr></thead>
            <tbody>{visible.map(row => <tr key={row.id} onClick={() => onSelectDeal?.(row)} style={{ cursor: onSelectDeal ? "pointer" : "default" }} onMouseEnter={e => e.currentTarget.style.background = "#f7fbff"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
              <td style={td}><div style={{ fontWeight: 750, color: "#122d50" }}>{row.customer_name || "Unnamed customer"}</div><div style={{ color: "#64748b", marginTop: 3 }}>{row.contract_number || "No contract ref"} · {row.postcode || "No postcode"}</div></td>
              <td style={td}>{row.branch}</td><td style={td}>{dateLabel(row.sale_date)}</td><td style={td}>{row.salesperson_name || row.salesperson || "—"}</td><td style={td}>{money(row.net_value ?? row.deal_value)}</td>
              <td style={td}><span style={{ display: "inline-flex", padding: "5px 8px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, fontSize: 10 }}>{row.progress.current}</span></td>
              <td style={td}><div style={{ display: "flex", gap: 4, minWidth: 170 }}>{row.progress.milestones.map(m => <span key={m.label} title={`${m.label}: ${m.detail}`} style={{ height: 7, flex: 1, borderRadius: 8, background: m.done ? "#16a34a" : "#dbe2ea" }}/>)}</div><div style={{ color: "#64748b", fontSize: 10, marginTop: 5 }}>{row.progress.milestones.filter(m => m.done).length}/5 evidence milestones recorded</div></td>
              <td style={td}><div>{dateLabel(row.installation_start_date)}</div><div style={{ color: "#64748b", fontSize: 10, marginTop: 3 }}>{row.fit_team_1 || row.installation_roof_team || row.installation_electrics_team || "No team recorded"}</div></td>
              <td style={td}><ChevronRight size={16} color="#0d9488"/></td>
            </tr>)}</tbody>
          </table>
        </div>}
        <div style={{ padding: 12, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, borderTop: "1px solid #e8edf2" }}>
          <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} style={{ height: 32, padding: "0 11px", border: "1px solid #d8e0e8", borderRadius: 7, background: "#fff", cursor: page === 0 ? "not-allowed" : "pointer" }}>Previous</button><span style={{ fontSize: 11, color: "#64748b" }}>Page {page + 1} of {pages}</span><button disabled={page + 1 >= pages} onClick={() => setPage(p => Math.min(pages - 1, p + 1))} style={{ height: 32, padding: "0 11px", border: "1px solid #d8e0e8", borderRadius: 7, background: "#fff", cursor: page + 1 >= pages ? "not-allowed" : "pointer" }}>Next</button>
        </div>
      </div>
      <div style={{ marginTop: 10, color: "#64748b", fontSize: 10 }}>Progress is calculated from linked CRM records, uploaded documents, survey answers, EPVS submissions and installation activity. It does not use Pipedrive stage labels.</div>
    </div>
  </section>
}

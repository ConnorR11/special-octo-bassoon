import React, { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw, Search, Sun, FileCheck, ClipboardCheck, CalendarDays, HardHat, Zap, ChevronRight, AlertCircle } from "lucide-react"
import { supabase } from "../lib/supabase"

const PAGE_SIZE = 50
const SURVEY_PHOTO_SECTIONS = ["Front of Property","Rear of Property","Side of Property","Close Up of Consumer Unit","Close Up of Electricity Meter","Close Up of Cut Out","Wide Of Consumer Unit","Loft Access Point","Loft Roof Truss","Internal DC Route","External DC Route","Proposed Inverter Location","Proposed Battery Location","Proposed Canopy Location","Proposed Panel Layout","Alternative Roof Elevations","Existing Solar Equipment","Existing EV Charger","High Electrical Usage Items","Shading Issues"]

const panel = { background: "#fff", border: "1px solid #e1e7ee", borderRadius: 12, boxShadow: "0 2px 8px rgba(15,23,42,.04)" }
const th = { padding: "11px 13px", textAlign: "left", color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: ".04em", borderBottom: "1px solid #e8edf2", whiteSpace: "nowrap" }
const td = { padding: "8px 9px", borderBottom: "1px solid #edf1f5", borderRight:"1px solid #edf1f5", fontSize: 12, verticalAlign: "middle" }
function StatusPill({state,label,detail}) { const styles = state==="done" ? {background:"#e3f3e5",color:"#16803c"} : state==="partial" ? {background:"#fff2cf",color:"#946200"} : state==="empty" ? {background:"#ffe5e5",color:"#d93030"} : {background:"#e9f0f4",color:"#28719a"}; return <span title={detail} style={{display:"inline-flex",alignItems:"center",padding:"4px 8px",borderRadius:20,fontSize:10,fontWeight:650,whiteSpace:"nowrap",...styles}}>{label}</span> }

function dateLabel(value) {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}
function dateTimeLabel(value) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) }
function money(value) {
  const n = Number(value)
  return Number.isFinite(n) && n ? n.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }) : "—"
}
function isSolar(deal) {
  return /solar|photovoltaic|\bpv\b/i.test(String(deal.product || "") + " " + String(deal.pipedrive_data?.product || ""))
}
function progressFor(deal, docs, answers, epvs, appointment, units) {
  const signed = Boolean(appointment?.customer_signed_at || (appointment?.signature_path && appointment?.express_fit_signature_path && appointment?.seg_disclaimer_signature_path))
  const videoComplete = docs.some(d => d.category === "survey_video")
  const billComplete = docs.some(d => d.category === "electricity_bill_epvs_waiver")
  const answeredCount = Object.values(answers || {}).filter(v => String(v ?? "").trim()).length
  const checklistComplete = answeredCount === 27
  const checklistStarted = answeredCount > 0
  const savedPhotoSections = new Set(docs.filter(d => d.category === "survey_photos").map(d => d.survey_section || "Front of Property"))
  const photoSectionsComplete = SURVEY_PHOTO_SECTIONS.filter(section => savedPhotoSections.has(section)).length
  const photosComplete = photoSectionsComplete === SURVEY_PHOTO_SECTIONS.length
  const hasPhotos = photoSectionsComplete > 0
  const surveyStarted = videoComplete || billComplete || checklistStarted || hasPhotos
  const epvsSubmitted = Boolean(epvs)
  const epvsStatus = String(epvs?.status || "").trim().toLowerCase()
  const validated = epvsStatus.includes("validat") || epvsStatus === "registered"
  const orderedUnits = units.filter(unit => unit.ordered_date || unit.supplier)
  const orderDate = orderedUnits.map(unit => unit.ordered_date).filter(Boolean).sort().at(-1)
  const supplier = [...new Set(orderedUnits.map(unit => unit.supplier).filter(Boolean))].join(", ")
  const installDate = deal.installation_start_date || deal.installation_roof_start_date || deal.installation_electrics_start_date
  const installBooked = Boolean(installDate)
  const installComplete = Boolean(deal.installation_electrics_start_date && deal.installation_roof_start_date)
  const balanceStatus = Number(deal.balance_outstanding) <= 0 ? "Paid" : deal.estimated_payment_date ? (new Date(deal.estimated_payment_date) > new Date() ? "Future" : "Outstanding") : "Outstanding"
  const cells = [
    { key:"survey", state:videoComplete && billComplete && checklistComplete && photosComplete ? "done" : surveyStarted ? "partial" : "empty", detail:`Video ${videoComplete ? "✓" : "✗"} · Bill ${billComplete ? "✓" : "✗"} · Checklist ${answeredCount}/27 · Photos ${photoSectionsComplete}/20`, parts:[{label:"Video",complete:videoComplete,partial:false},{label:"Electricity bill",complete:billComplete,partial:false},{label:"Checklist",complete:checklistComplete,partial:checklistStarted,count:`${answeredCount}/27`},{label:"Photos",complete:photosComplete,partial:hasPhotos,count:`${photoSectionsComplete}/20`}] },
    { key:"opensolar", state:signed ? "done" : "empty", detail:signed ? dateLabel(appointment?.customer_signed_at) : "No signature recorded" },
    { key:"bill", state:billComplete ? "done" : "empty", detail:billComplete ? "Uploaded" : "Not uploaded" },
    { key:"hies", state:"unknown", detail:"No linked CRM record" },
    { key:"epvs", state:epvsSubmitted ? (validated ? "done" : "partial") : "empty", detail:epvs?.status || "No linked submission", submittedAt:epvs?.epvs_created_at, updatedAt:epvs?.epvs_updated_at || epvs?.last_activity_at, reference:epvs?.epvs_validation_id, validationStatusId:epvs?.validation_status_id, lastActivityType:epvs?.raw_payload?.last_activity_type },
    { key:"validated", state:validated ? "done" : epvsSubmitted ? "partial" : "empty", detail:epvs?.status || "Not submitted" },
    { key:"product", state:orderedUnits.length ? "done" : "empty", detail:orderedUnits.length ? `${orderedUnits.length} units · ${supplier || "Supplier not recorded"} · ${dateLabel(orderDate)}` : "Not ordered" },
    { key:"scaffold", state:"unknown", detail:"No structured booking record" },
    { key:"confirmation", state:installComplete ? "done" : installBooked ? "partial" : "empty", detail:installComplete ? "Installation dates recorded" : installBooked ? dateLabel(installDate) : "No installation date" },
  ]
  let current = "Awaiting survey information"
  if (signed) current = "OpenSolar signed"
  if (surveyStarted) current = videoComplete && billComplete && checklistComplete && photosComplete ? "Survey complete" : "Survey information in progress"
  if (epvsSubmitted) current = validated ? "EPVS validated" : "EPVS submitted"
  if (deal.installation_start_date) current = "Installation scheduled"
  if (deal.installation_roof_start_date || deal.installation_electrics_start_date) current = "Installation in progress"
  if (deal.remedial_start_date) current = "Remedial work recorded"
  return { current, cells, balanceStatus, installDate, jobType:appointment?.job_type || appointment?.product || deal.product || "—", stage:deal.pipedrive_stage || "—", hasContract:signed, hasSurveyData:surveyStarted, surveyComplete:videoComplete && billComplete && checklistComplete && photosComplete, epvsComplete:epvsSubmitted, installationScheduled:Boolean(deal.installation_start_date), roofStarted:Boolean(deal.installation_roof_start_date || deal.installation_electrics_start_date) }
}

export default function SolarPipeline({ onSelectDeal }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [branch, setBranch] = useState("all")
  const [progressFilter, setProgressFilter] = useState("all")
  const [stageFilter, setStageFilter] = useState("all")
  const [balanceFilter, setBalanceFilter] = useState("all")
  const [page, setPage] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(null)

  const load = useCallback(async () => {
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return }
    setLoading(true); setError("")
    try {
      const { data: deals, error: dealError } = await supabase.from("deals")
        .select("id,pipedrive_deal_id,contract_number,customer_name,phone,email,address,postcode,product,pipedrive_data,deal_value,net_value,balance_outstanding,salesperson,salesperson_name,sale_date,status,pipedrive_stage,estimated_payment_date,installation_start_date,fit_team_1,appointment_row_id,branch,installation_roof_start_date,installation_roof_team,installation_electrics_start_date,installation_electrics_team,remedial_start_date,remedial_fit_team")
        .order("sale_date", { ascending: false }).limit(2000)
      if (dealError) throw dealError
      const solarDeals = (deals || []).filter(deal => isSolar(deal) && Number(deal.balance_outstanding) > 0 && !/customer\s+cancelled|decline/i.test(String(deal.status || "") + " " + String(deal.pipedrive_stage || "") + " " + String(deal.pipedrive_data?.status || "") + " " + String(deal.pipedrive_data?.stage || "")))
      const ids = solarDeals.map(d => String(d.id))
      const appointmentIds = [...new Set(solarDeals.map(d => String(d.appointment_row_id || "")).filter(Boolean))]
      const [docsResult, answersResult, epvsResult, appointmentsResult, unitsResult] = await Promise.all([
        ids.length ? supabase.from("deal_documents").select("deal_id,category,file_name,survey_section,created_at").in("deal_id", ids) : Promise.resolve({ data: [], error: null }),
        ids.length ? supabase.from("deal_survey_answers").select("deal_id,answers,updated_at").in("deal_id", ids) : Promise.resolve({ data: [], error: null }),
        ids.length ? supabase.from("epvs_submissions").select("linked_deal_id,status,epvs_validation_id,validation_status_id,epvs_created_at,epvs_updated_at,last_activity_at,raw_payload").in("linked_deal_id", ids) : Promise.resolve({ data: [], error: null }),
        appointmentIds.length ? supabase.from("appointments").select("appointment_row_id,contract_number,signature_path,express_fit_signature_path,seg_disclaimer_signature_path,customer_signed_at,branch,job_type,product").in("appointment_row_id", appointmentIds) : Promise.resolve({ data: [], error: null }),
        ids.length ? supabase.from("units").select("UUID,appointment_id,contract_number,supplier,ordered_date,unit_type").in("contract_number", solarDeals.map(d => d.contract_number).filter(Boolean)) : Promise.resolve({ data: [], error: null }),
      ])
      for (const result of [docsResult, answersResult, epvsResult, appointmentsResult, unitsResult]) if (result.error) throw result.error
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
        const units = (unitsResult.data || []).filter(u => (deal.contract_number && u.contract_number === deal.contract_number) || (deal.appointment_row_id && u.appointment_id === deal.appointment_row_id))
        const progress = progressFor(deal, docs, answers, epvs, appointment, units)
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
    return matchesSearch && (branch === "all" || row.branch === branch) && (progressFilter === "all" || row.progress.current === progressFilter) && (stageFilter === "all" || row.progress.stage === stageFilter) && (balanceFilter === "all" || row.progress.balanceStatus === balanceFilter)
  }), [rows, search, branch, progressFilter])
  const stages = useMemo(() => [...new Set(rows.map(r => r.progress.stage).filter(Boolean))].sort(), [rows])
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
        <select value={stageFilter} onChange={e => { setStageFilter(e.target.value); setPage(0) }} style={{ height: 38, minWidth: 170, border: "1px solid #d8e0e8", borderRadius: 8, padding: "0 10px", background: "#fff", fontSize: 12 }}><option value="all">All Pipedrive stages</option>{stages.map(v => <option key={v}>{v}</option>)}</select>
        <select value={balanceFilter} onChange={e => { setBalanceFilter(e.target.value); setPage(0) }} style={{ height: 38, minWidth: 140, border: "1px solid #d8e0e8", borderRadius: 8, padding: "0 10px", background: "#fff", fontSize: 12 }}><option value="all">All balances</option><option>Outstanding</option><option>Future</option><option>Paid</option></select>
        <select value={progressFilter} onChange={e => { setProgressFilter(e.target.value); setPage(0) }} style={{ height: 38, minWidth: 210, border: "1px solid #d8e0e8", borderRadius: 8, padding: "0 10px", background: "#fff", fontSize: 12 }}><option value="all">All progress</option>{[...new Set(rows.map(r => r.progress.current))].sort().map(s => <option key={s}>{s}</option>)}</select>
        <div style={{ color: "#64748b", fontSize: 11, marginLeft: "auto" }}>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}</div>
      </div>

      <div style={{ ...panel, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e8edf2" }}><strong style={{ fontSize: 13 }}>Solar jobs</strong><span style={{ color: "#64748b", fontSize: 11 }}>{filtered.length.toLocaleString("en-GB")} jobs · Page {Math.min(page + 1, pages)} of {pages}</span></div>
        {error && <div style={{ margin: 14, padding: 12, borderRadius: 8, background: "#fff1f2", color: "#b42318", fontSize: 12 }}><AlertCircle size={14} style={{ verticalAlign: "middle", marginRight: 6 }}/>{error}</div>}
        {loading ? <div style={{ padding: 35, textAlign: "center", color: "#64748b", fontSize: 12 }}>Loading solar jobs…</div> : visible.length === 0 ? <div style={{ padding: 35, textAlign: "center", color: "#64748b", fontSize: 12 }}>No solar jobs match these filters.</div> : <div style={{ overflowX: "auto" }}>
          <table style={{ width:"100%", minWidth:1850, borderCollapse:"collapse", tableLayout:"fixed" }}>
            <thead><tr>
              <th style={{...th,position:"sticky",left:0,zIndex:3,background:"#f8fafc",minWidth:260,width:260}}>Date / Name / Contract Number</th>
              {["Survey","EPVS","Ordered","Scaff","DNO","Install","Balance","Stage"].map(label=><th key={label} style={{...th,minWidth:125,whiteSpace:"normal"}}>{label}</th>)}
            </tr></thead>
            <tbody>{visible.map(row=><tr key={row.id} onClick={()=>onSelectDeal?.(row)} style={{cursor:onSelectDeal?"pointer":"default"}}>
              <td style={{...td,position:"sticky",left:0,zIndex:1,background:"#fff",minWidth:260}}>
                <div style={{fontSize:10,color:"#64748b"}}>{dateLabel(row.sale_date)}</div>
                <div style={{fontWeight:700,color:"#172b4d",marginTop:3}}>{row.customer_name||"Unnamed customer"}</div>
                <div style={{fontSize:10,color:"#64748b",marginTop:3}}>{row.contract_number||"No contract number"}</div>
              </td>
              {row.progress.cells.filter(c=>["survey","epvs","product","scaffold","confirmation"].includes(c.key)).map(cell=><td key={cell.key} style={td}>{cell.key==="survey" ? <div style={{display:"grid",gap:5,minWidth:130}}>{cell.parts.map(part=><div key={part.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:5}}><span style={{fontSize:9,color:"#475569"}}>{part.label}</span><StatusPill state={part.complete?"done":part.partial?"partial":"empty"} label={part.count || (part.complete?"Complete":"Missing")}/></div>)}</div> : cell.key==="epvs" ? <div style={{display:"grid",gap:5,minWidth:145}}><StatusPill state={cell.state} label={row.epvs?.status || "Not Submitted"}/>{row.epvs && <><div style={{fontSize:9,color:"#475569"}}>Submitted: {dateTimeLabel(cell.submittedAt)}</div><div style={{fontSize:9,color:"#475569"}}>Last updated: {dateTimeLabel(cell.updatedAt)}</div>{cell.reference && <div style={{fontSize:9,color:"#64748b"}}>EPVS ref: {cell.reference}</div>}{cell.lastActivityType && <div style={{fontSize:9,color:"#64748b"}}>{cell.lastActivityType}</div>}</>}</div> : <StatusPill state={cell.state} label={cell.key==="product"?(cell.state==="done"?"Ordered":"Not Ordered"):cell.key==="scaffold"?"Not Tracked":(cell.state==="done"?"Complete":cell.state==="partial"?"Booked":"Not Booked")} detail={cell.detail}/>}</td>)}
              <td style={td}><StatusPill state="unknown" label="Not Tracked" detail="No DNO workflow is linked yet"/></td>
              <td style={td}><StatusPill state={row.progress.installationScheduled?"done":"empty"} label={row.progress.installationScheduled?"Booked":"Not Booked"} detail={row.progress.installDate?dateLabel(row.progress.installDate):"No installation date"}/></td>
              <td style={td}><StatusPill state={row.progress.balanceStatus==="Paid"?"done":row.progress.balanceStatus==="Future"?"partial":"empty"} label={row.progress.balanceStatus} detail={row.progress.balanceStatus==="Future"?dateLabel(row.estimated_payment_date):money(row.balance_outstanding)}/></td>
              <td style={{...td,whiteSpace:"nowrap"}}>{row.progress.stage}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        <div style={{ padding: 12, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, borderTop: "1px solid #e8edf2" }}>
          <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} style={{ height: 32, padding: "0 11px", border: "1px solid #d8e0e8", borderRadius: 7, background: "#fff", cursor: page === 0 ? "not-allowed" : "pointer" }}>Previous</button><span style={{ fontSize: 11, color: "#64748b" }}>Page {page + 1} of {pages}</span><button disabled={page + 1 >= pages} onClick={() => setPage(p => Math.min(pages - 1, p + 1))} style={{ height: 32, padding: "0 11px", border: "1px solid #d8e0e8", borderRadius: 7, background: "#fff", cursor: page + 1 >= pages ? "not-allowed" : "pointer" }}>Next</button>
        </div>
      </div>
      <div style={{ marginTop: 10, color: "#64748b", fontSize: 10 }}>Green = completed · Amber = pending / in progress · Red = missing / outstanding · Blue-grey = not tracked. Pipedrive stage is displayed for reference only; it does not drive operational statuses.</div>
    </div>
  </section>
}

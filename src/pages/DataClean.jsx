import React, { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Database,
  RefreshCw,
  Search,
} from "lucide-react"
import { supabase } from "../lib/supabase"

const ISSUE_DEFINITIONS = [
  ["missing_name","Missing customer name","Appointments where the customer name has not been populated.","Missing information","high"],
  ["missing_email","Missing customer email","Appointments without a customer email address.","Missing information","high"],
  ["invalid_email","Invalid email address","Customer email addresses that do not appear to contain a valid email format.","Invalid data","medium"],
  ["missing_phone","Missing phone number","Appointments without a primary customer telephone number.","Missing information","high"],
  ["missing_postcode","Missing postcode","Appointments where no postcode has been recorded.","Missing information","high"],
  ["missing_address","Missing address","Appointments without an address.","Missing information","medium"],
  ["missing_branch","Missing branch","Appointments that have not been allocated to a branch.","Missing information","high"],
  ["missing_rep","Missing sales rep","Appointments without an allocated sales representative.","Missing information","high"],
  ["missing_appointment_date","Missing appointment date","Appointments without an appointment date.","Missing information","critical"],
  ["missing_result","Missing result","Appointments where no result or status has been recorded.","Missing information","medium"],
  ["missing_arrival","Missing rep arrival time","Resulted appointments where the rep arrival time has not been recorded.","Missing information","medium"],
  ["missing_result_updated","Missing result updated time","Resulted appointments where the result timestamp has not been recorded.","Missing information","medium"],
  ["result_before_arrival","Result before arrival","Appointments where the result timestamp is earlier than the rep arrival time.","Invalid data","critical"],
].map(([id,name,description,category,severity]) => ({id,name,description,category,severity}))

function hasValue(value) { return String(value ?? "").trim() !== "" }
function emailValue(row) { return row?.email_address || row?.email || "" }
function phoneValue(row) { return row?.phone_number_1 || row?.phone || "" }
function resultValue(row) { return row?.result || row?.status || "" }
function validEmail(value) { const email=String(value||"").trim(); return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) }
function formatNumber(value) { return new Intl.NumberFormat("en-GB").format(Number(value||0)) }
function formatDate(value) {
  if (!value) return "—"
  const d=new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})
}
function getIssueRows(id,rows) {
  switch(id) {
    case "missing_name": return rows.filter(r=>!hasValue(r.name))
    case "missing_email": return rows.filter(r=>!hasValue(emailValue(r)))
    case "invalid_email": return rows.filter(r=>hasValue(emailValue(r))&&!validEmail(emailValue(r)))
    case "missing_phone": return rows.filter(r=>!hasValue(phoneValue(r)))
    case "missing_postcode": return rows.filter(r=>!hasValue(r.postcode))
    case "missing_address": return rows.filter(r=>!hasValue(r.address))
    case "missing_branch": return rows.filter(r=>!hasValue(r.branch))
    case "missing_rep": return rows.filter(r=>!hasValue(r.rep_allocated))
    case "missing_appointment_date": return rows.filter(r=>!hasValue(r.appointment_date))
    case "missing_result": return rows.filter(r=>!hasValue(resultValue(r)))
    case "missing_arrival": return rows.filter(r=>hasValue(resultValue(r))&&!hasValue(r.rep_arrival_time))
    case "missing_result_updated": return rows.filter(r=>hasValue(resultValue(r))&&!hasValue(r.result_updated))
    case "result_before_arrival": return rows.filter(r=>{
      if(!r.rep_arrival_time||!r.result_updated)return false
      const a=new Date(r.rep_arrival_time), b=new Date(r.result_updated)
      return !Number.isNaN(a.getTime())&&!Number.isNaN(b.getTime())&&b<a
    })
    default:return []
  }
}
function severityLabel(v){return v==="critical"?"Critical":v==="high"?"High":"Review"}
function severityStyle(v){
  if(v==="critical")return{background:"#fee2e2",color:"#b91c1c"}
  if(v==="high")return{background:"#fff7ed",color:"#c2410c"}
  return{background:"#fefce8",color:"#a16207"}
}

export default function DataClean({ onOpenAppointment }) {
  const [rows,setRows]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState("")
  const [search,setSearch]=useState("")
  const [selectedIssue,setSelectedIssue]=useState(null)
  const [expanded,setExpanded]=useState({"Missing information":true,"Invalid data":true})

  async function loadData(){
    if(!supabase){setError("Supabase is not configured.");setLoading(false);return}
    setLoading(true);setError("")
    try{
      const {data,error:queryError}=await supabase.from("appointments")
        .select("appointment_row_id,name,phone_number_1,email_address,postcode,address,appointment_date,product,job_type,branch,rep_allocated,result,status,rep_arrival_time,result_updated")
        .order("appointment_date",{ascending:false,nullsFirst:false})
      if(queryError)throw queryError
      setRows(data||[])
    }catch(err){
      console.error("Data Clean load error:",err)
      setError(err?.message||"Unable to load appointment data.")
      setRows([])
    }finally{setLoading(false)}
  }

  useEffect(()=>{loadData()},[])

  const issueResults=useMemo(()=>Object.fromEntries(ISSUE_DEFINITIONS.map(i=>[i.id,getIssueRows(i.id,rows)])),[rows])
  const counts=useMemo(()=>Object.fromEntries(ISSUE_DEFINITIONS.map(i=>[i.id,issueResults[i.id]?.length||0])),[issueResults])
  const totalIssues=useMemo(()=>Object.values(counts).reduce((a,b)=>a+b,0),[counts])
  const critical=useMemo(()=>ISSUE_DEFINITIONS.filter(i=>i.severity==="critical").reduce((a,i)=>a+(counts[i.id]||0),0),[counts])
  const high=useMemo(()=>ISSUE_DEFINITIONS.filter(i=>i.severity==="high").reduce((a,i)=>a+(counts[i.id]||0),0),[counts])

  const filteredIssues=useMemo(()=>{
    const term=search.trim().toLowerCase()
    return term ? ISSUE_DEFINITIONS.filter(i=>`${i.name} ${i.description} ${i.category}`.toLowerCase().includes(term)) : ISSUE_DEFINITIONS
  },[search])
  const groups=useMemo(()=>{
    const out={}
    filteredIssues.forEach(i=>(out[i.category] ||= []).push(i))
    return out
  },[filteredIssues])

  const affected=selectedIssue ? issueResults[selectedIssue.id]||[] : []
  const filteredAffected=useMemo(()=>{
    const term=search.trim().toLowerCase()
    if(!term)return affected
    return affected.filter(r=>[r.name,r.postcode,r.branch,r.rep_allocated,emailValue(r),phoneValue(r),r.appointment_row_id].some(v=>String(v||"").toLowerCase().includes(term)))
  },[affected,search])

  return <section className="data-clean-page">
    <style>{styles}</style>
    <div className="data-clean-header">
      <div><div className="data-clean-eyebrow">Administration</div><h1>Data Clean</h1><p>Review common data-quality issues across the CRM.</p></div>
      <button className="data-clean-refresh" onClick={loadData} disabled={loading}><RefreshCw size={14} className={loading?"data-clean-spin":""}/>Refresh</button>
    </div>
    {error&&<div className="data-clean-error"><CircleAlert size={16}/>{error}</div>}

    <div className="data-clean-stats">
      <Stat icon={Database} label="Appointments checked" value={rows.length}/>
      <Stat icon={AlertTriangle} label="Issues found" value={totalIssues} cls="warning"/>
      <Stat icon={CircleAlert} label="Critical issues" value={critical} cls="critical"/>
      <Stat icon={AlertTriangle} label="High priority" value={high} cls="high"/>
    </div>

    {selectedIssue ? <div className="data-clean-detail">
      <div className="data-clean-detail-header">
        <div>
          <button className="data-clean-back" onClick={()=>{setSelectedIssue(null);setSearch("")}}>← All data issues</button>
          <div className="data-clean-detail-title-row"><h2>{selectedIssue.name}</h2><span className="data-clean-severity" style={severityStyle(selectedIssue.severity)}>{severityLabel(selectedIssue.severity)}</span></div>
          <p>{selectedIssue.description}</p>
        </div>
        <div className="data-clean-detail-count">{formatNumber(affected.length)}<span>records</span></div>
      </div>
      <div className="data-clean-toolbar"><div className="data-clean-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search affected records..."/></div></div>
      {filteredAffected.length===0 ? <div className="data-clean-empty"><CheckCircle2 size={28}/><strong>No matching records</strong><span>This issue currently has no matching records.</span></div> :
      <div className="data-clean-table-wrap"><table className="data-clean-table"><thead><tr><th>Customer</th><th>Appointment</th><th>Postcode</th><th>Branch</th><th>Sales Rep</th><th>Email</th><th></th></tr></thead><tbody>
        {filteredAffected.slice(0,250).map(r=><tr key={r.appointment_row_id}>
          <td><strong>{r.name||"Unnamed customer"}</strong><small>{r.appointment_row_id}</small></td>
          <td>{formatDate(r.appointment_date)}</td><td>{r.postcode||"—"}</td><td>{r.branch||"—"}</td><td>{r.rep_allocated||"—"}</td><td>{emailValue(r)||"—"}</td>
          <td><button className="data-clean-open" onClick={()=>onOpenAppointment?.(r)}>Open</button></td>
        </tr>)}
      </tbody></table></div>}
      {filteredAffected.length>250&&<div className="data-clean-limit">Showing the first 250 matching records.</div>}
    </div> :
    <div className="data-clean-content">
      <div className="data-clean-toolbar"><div className="data-clean-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search data issues..."/></div><div className="data-clean-summary">{filteredIssues.filter(i=>counts[i.id]>0).length} issue types found</div></div>
      <div>
        {Object.entries(groups).map(([category,items])=><div className="data-clean-category" key={category}>
          <button className="data-clean-category-header" onClick={()=>setExpanded(c=>({...c,[category]:!c[category]}))}><div className="data-clean-category-left">{expanded[category]?<ChevronDown size={16}/>:<ChevronRight size={16}/>}<span>{category}</span></div><span className="data-clean-category-count">{formatNumber(items.reduce((a,i)=>a+(counts[i.id]||0),0))}</span></button>
          {expanded[category]&&<div className="data-clean-issues">{items.map(issue=>{
            const count=counts[issue.id]||0
            return <button className={`data-clean-issue ${count===0?"clear":""}`} key={issue.id} disabled={!count} onClick={()=>{if(count){setSelectedIssue(issue);setSearch("")}}}>
              <div className="data-clean-issue-icon">{count===0?<CheckCircle2 size={17}/>:<AlertTriangle size={17}/>}</div>
              <div className="data-clean-issue-main"><div className="data-clean-issue-name">{issue.name}{count>0&&<span className="data-clean-severity" style={severityStyle(issue.severity)}>{severityLabel(issue.severity)}</span>}</div><div className="data-clean-issue-description">{issue.description}</div></div>
              <div className="data-clean-issue-count">{formatNumber(count)}</div>{count>0&&<ChevronRight size={17} className="data-clean-issue-arrow"/>}
            </button>
          })}</div>}
        </div>)}
      </div>
    </div>}
  </section>
}

function Stat({icon:Icon,label,value,cls=""}){return <div className="data-clean-stat"><div className={`data-clean-stat-icon ${cls}`}><Icon size={17}/></div><div><div className="data-clean-stat-label">{label}</div><div className="data-clean-stat-value">{formatNumber(value)}</div></div></div>}

const styles=`.data-clean-page{min-height:calc(100vh - 90px);padding:28px 32px 50px;background:#f5f7fa;color:#172033;box-sizing:border-box;font-family:Inter,Arial,sans-serif}
.data-clean-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:22px}
.data-clean-eyebrow{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:7px}
.data-clean-header h1{margin:0;font-size:30px;line-height:1.1;color:#0f172a}
.data-clean-header p{margin:8px 0 0;font-size:13px;color:#64748b}
.data-clean-refresh{height:36px;padding:0 13px;border:1px solid #d7dee7;border-radius:8px;background:#fff;color:#334155;display:inline-flex;align-items:center;gap:7px;font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.data-clean-refresh:disabled{opacity:.6;cursor:default}.data-clean-spin{animation:data-clean-spin 1s linear infinite}@keyframes data-clean-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.data-clean-error{display:flex;align-items:center;gap:9px;padding:13px 15px;margin-bottom:16px;border:1px solid #fecaca;background:#fff1f2;color:#b91c1c;border-radius:9px;font-size:12px}
.data-clean-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:16px}
.data-clean-stat{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #dfe5ec;border-radius:11px;padding:16px}
.data-clean-stat-icon{width:35px;height:35px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:#eff6ff;color:#0877bd;flex:0 0 auto}
.data-clean-stat-icon.warning{background:#fff7ed;color:#c2410c}.data-clean-stat-icon.critical{background:#fee2e2;color:#b91c1c}.data-clean-stat-icon.high{background:#fefce8;color:#a16207}
.data-clean-stat-label{font-size:9px;font-weight:800;color:#7b8797;text-transform:uppercase;letter-spacing:.05em}.data-clean-stat-value{margin-top:4px;font-size:23px;font-weight:750;color:#0f172a}
.data-clean-content,.data-clean-detail{background:#fff;border:1px solid #dfe5ec;border-radius:12px;overflow:hidden}
.data-clean-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 15px;border-bottom:1px solid #e6eaf0;background:#fafbfc}
.data-clean-search{width:min(420px,100%);height:36px;display:flex;align-items:center;gap:8px;padding:0 11px;box-sizing:border-box;border:1px solid #d7dee7;border-radius:7px;background:#fff;color:#94a3b8}
.data-clean-search input{width:100%;border:0;outline:0;background:transparent;font:inherit;font-size:12px;color:#172033}.data-clean-summary{font-size:11px;color:#64748b}
.data-clean-category{border-bottom:1px solid #e7ebf0}.data-clean-category:last-child{border-bottom:0}.data-clean-category-header{width:100%;height:48px;padding:0 17px;display:flex;align-items:center;justify-content:space-between;border:0;background:#fff;cursor:pointer;font:inherit}
.data-clean-category-left{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:750;color:#334155}.data-clean-category-count{min-width:30px;padding:3px 7px;border-radius:12px;background:#f1f5f9;color:#64748b;font-size:10px;font-weight:700}
.data-clean-issues{border-top:1px solid #f0f2f5}.data-clean-issue{width:100%;min-height:67px;padding:10px 17px;display:flex;align-items:center;gap:13px;border:0;border-bottom:1px solid #f0f2f5;background:#fff;text-align:left;cursor:pointer;font:inherit}.data-clean-issue:last-child{border-bottom:0}.data-clean-issue:hover:not(:disabled){background:#fafcff}.data-clean-issue:disabled{cursor:default}
.data-clean-issue-icon{width:31px;height:31px;display:flex;align-items:center;justify-content:center;border-radius:7px;background:#fff7ed;color:#c2410c;flex:0 0 auto}.data-clean-issue.clear .data-clean-issue-icon{background:#f0fdf4;color:#16a34a}
.data-clean-issue-main{flex:1;min-width:0}.data-clean-issue-name{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:#1e293b}.data-clean-issue-description{margin-top:4px;font-size:10px;color:#64748b}
.data-clean-severity{display:inline-flex;align-items:center;padding:3px 6px;border-radius:5px;font-size:8px;line-height:1;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.data-clean-issue-count{min-width:50px;text-align:right;font-size:13px;font-weight:750;color:#334155}.data-clean-issue-arrow{color:#94a3b8}
.data-clean-detail-header{padding:20px;display:flex;align-items:flex-start;justify-content:space-between;gap:20px;border-bottom:1px solid #e6eaf0}.data-clean-back{padding:0;margin-bottom:12px;border:0;background:transparent;color:#0877bd;font:inherit;font-size:11px;font-weight:700;cursor:pointer}
.data-clean-detail-title-row{display:flex;align-items:center;gap:9px}.data-clean-detail-title-row h2{margin:0;font-size:19px;color:#0f172a}.data-clean-detail-header p{margin:7px 0 0;color:#64748b;font-size:11px}
.data-clean-detail-count{font-size:25px;font-weight:750;color:#0f172a;text-align:right}.data-clean-detail-count span{display:block;margin-top:2px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8}
.data-clean-table-wrap{overflow-x:auto}.data-clean-table{width:100%;border-collapse:collapse}.data-clean-table th{padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e5e9ef;text-align:left;color:#7b8797;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap}
.data-clean-table td{padding:12px 14px;border-bottom:1px solid #edf0f3;color:#475569;font-size:10px;white-space:nowrap}.data-clean-table td strong{display:block;color:#1e293b;font-size:11px}.data-clean-table td small{display:block;margin-top:3px;color:#94a3b8;font-size:8px}
.data-clean-open{padding:5px 9px;border:1px solid #d7dee7;border-radius:5px;background:#fff;color:#0877bd;font:inherit;font-size:9px;font-weight:700;cursor:pointer}.data-clean-open:hover{background:#f0f8ff}.data-clean-limit{padding:11px 15px;background:#fafbfc;border-top:1px solid #e6eaf0;color:#64748b;text-align:center;font-size:10px}
.data-clean-empty{min-height:280px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#16a34a;gap:8px}.data-clean-empty strong{color:#334155;font-size:13px}.data-clean-empty span{color:#64748b;font-size:10px}
@media(max-width:1000px){.data-clean-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.data-clean-page{padding:22px 16px 35px}.data-clean-stats{grid-template-columns:1fr}.data-clean-toolbar{align-items:stretch;flex-direction:column}.data-clean-search{width:100%}}`

import React, { useCallback, useEffect, useState } from "react"
import { RefreshCw, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { supabase } from "../lib/supabase"

const PAGE_SIZE = 50
const nameOf = lead => [lead.salutations, lead.first_name, lead.last_name].map(v => String(v || "").trim()).filter(Boolean).join(" ") || "Unnamed lead"
const dateValue = value => {
  if (!value) return null
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime()
  const match = String(value).match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/)
  if (!match) return null
  const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3])
  return new Date(year, Number(match[2]) - 1, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0)).getTime()
}
const formatDate = value => value ? new Date(value).toLocaleString("en-GB", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) : "—"
const attemptsOf = lead => {
  const value = Number(lead.call_count ?? lead.call_counter ?? 0)
  return Number.isFinite(value) ? value : 0
}

export default function LeadToCall() {
  const [leads, setLeads] = useState([])
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [counts, setCounts] = useState({ total:0, callbacks:0, rework:0, fresh:0, no_contact:0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [updatedAt, setUpdatedAt] = useState(null)

  const load = useCallback(async () => {
    if (!supabase) { setError("Supabase is not configured."); return }
    setLoading(true)
    setError("")
    try {
      const { data, error: rpcError } = await supabase.rpc("get_lead_to_call_page", {
        p_page: page,
        p_page_size: PAGE_SIZE,
        p_search: search.trim(),
      })
      if (rpcError) throw rpcError
      const result = Array.isArray(data) ? data[0] : data
      setLeads((result?.rows || []).map(lead => ({
        ...lead,
        isRework: Boolean(lead.is_rework),
        latestAppointmentDate: lead.latest_appointment_date || null,
        latestAppointmentResult: lead.latest_appointment_result || "",
        attempts: attemptsOf(lead),
      })))
      setCounts(result?.counts || { total:0, callbacks:0, rework:0, fresh:0, no_contact:0 })
      setUpdatedAt(Date.now())
    } catch (err) {
      console.error("Lead To Call load failed", err)
      setError(err?.message || "Unable to load the calling queue.")
      setLeads([])
      setCounts({ total:0, callbacks:0, rework:0, fresh:0, no_contact:0 })
    } finally { setLoading(false) }
  }, [page, search])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search])

  const totalPages = Math.max(1, Math.ceil((counts.total || 0) / PAGE_SIZE))
  const panel = { background:"#fff", border:"1px solid #e2e8f0", borderRadius:12 }
  const small = { fontSize:11, color:"#64748b" }

  return <div style={{ maxWidth:1500, margin:"0 auto" }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap", marginBottom:18 }}>
      <div><h1 style={{ margin:0, fontSize:24, color:"#0f172a" }}>Lead To Call</h1><div style={{ ...small, marginTop:5 }}>One prioritised queue showing the next eligible leads for the canvassing team.</div></div>
      <button type="button" onClick={load} disabled={loading} style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"9px 13px", border:"1px solid #cbd5e1", borderRadius:8, background:"#fff", cursor:"pointer", fontWeight:650 }}><RefreshCw size={14}/>{loading ? "Refreshing…" : "Refresh queue"}</button>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:10, marginBottom:16 }}>
      {[[ "Callbacks due",counts.callbacks],[ "Rework",counts.rework],[ "Fresh leads",counts.fresh],[ "No Contact ready",counts.no_contact]].map(([label,value])=><div key={label} style={{ ...panel, padding:"13px 15px" }}><div style={small}>{label}</div><div style={{ fontSize:24, fontWeight:800, color:"#0f172a", marginTop:4 }}>{Number(value || 0).toLocaleString("en-GB")}</div></div>)}
    </div>
    <div style={{ ...panel, padding:12, marginBottom:12, display:"flex", alignItems:"center", gap:9 }}>
      <Search size={16} color="#64748b"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, postcode, phone or source…" style={{ border:0, outline:0, flex:1, minWidth:120, fontSize:13, background:"transparent"}}/>
      <span style={small}>{(counts.total || 0).toLocaleString("en-GB")} in queue</span>
    </div>
    {error && <div role="alert" style={{ ...panel, padding:13, color:"#b91c1c", marginBottom:12 }}>{error}</div>}
    <div style={{ ...panel, overflow:"hidden" }}>
      <div style={{ padding:"12px 15px", borderBottom:"1px solid #e2e8f0", display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}><strong style={{ fontSize:13 }}>Next leads to phone</strong><span style={small}>Callbacks → Rework → Fresh → No Contact (2-hour gap, max 15 attempts)</span></div>
      {loading ? <div style={{ padding:36, textAlign:"center", color:"#64748b" }}>Loading calling queue…</div> : leads.length === 0 ? <div style={{ padding:36, textAlign:"center", color:"#64748b" }}>No eligible leads to call right now.</div> :
        <div style={{ overflowX:"auto" }}><table style={{ width:"100%", borderCollapse:"collapse", minWidth:900, fontSize:12, color:"#334155" }}>
          <thead><tr style={{ background:"#f8fafc", textAlign:"left" }}>{["Received","Customer","Postcode","Source","Latest appointment","Appointment result","Disposition","Callback date/time","Last called","Attempts"].map(label=><th key={label} style={{ padding:"10px 12px", borderBottom:"1px solid #e2e8f0", whiteSpace:"nowrap" }}>{label}</th>)}</tr></thead>
          <tbody>{leads.map((lead,index)=><tr key={lead.delete_row_id} style={{ background:lead.queue_type==="Callback due"?"#fff4d6":lead.queue_type==="Fresh lead"?"#f3e8ff":lead.isRework?"#eaf3ff":index%2?"#f8fafc":"#ffffff" }}>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6", whiteSpace:"nowrap" }}>{formatDate(lead.received_date_time)}</td>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6", fontWeight:750, color:"#0f172a", whiteSpace:"nowrap" }}>{nameOf(lead)}</td>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6" }}>{lead.postcode||"—"}</td>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6" }}>{lead.lead_source||"Unknown"}</td>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6", whiteSpace:"nowrap" }}>{lead.latestAppointmentDate ? formatDate(lead.latestAppointmentDate) : "—"}</td>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6", whiteSpace:"nowrap" }}>{lead.latestAppointmentResult || (lead.latestAppointmentDate ? "No result" : "—")}</td>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6", whiteSpace:"nowrap" }}>{lead.disposition||"Fresh"}</td>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6", whiteSpace:"nowrap" }}>{lead.callback_date_time ? formatDate(dateValue(lead.callback_date_time)) : "—"}</td>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6", whiteSpace:"nowrap" }}>{lead.last_time_called ? formatDate(dateValue(lead.last_time_called)) : lead.last_called_at ? formatDate(lead.last_called_at) : "Never"}</td>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6", textAlign:"center" }}>{lead.attempts}</td>
          </tr>)}</tbody>
        </table></div>}
      <div style={{ padding:"12px 15px", borderTop:"1px solid #e2e8f0", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
        <span style={small}>Showing {counts.total ? ((page-1)*PAGE_SIZE)+1 : 0}–{Math.min(page*PAGE_SIZE,counts.total)} of {(counts.total||0).toLocaleString("en-GB")} leads · Page {page} of {totalPages}</span>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button type="button" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={loading || page<=1} style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"7px 11px", border:"1px solid #cbd5e1", borderRadius:7, background:"#fff", cursor:page<=1?"not-allowed":"pointer", opacity:page<=1?.45:1 }}><ChevronLeft size={15}/>Previous</button>
          <button type="button" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={loading || page>=totalPages} style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"7px 11px", border:"1px solid #cbd5e1", borderRadius:7, background:"#fff", cursor:page>=totalPages?"not-allowed":"pointer", opacity:page>=totalPages?.45:1 }}>Next<ChevronRight size={15}/></button>
        </div>
      </div>
    </div>
    <div style={{ ...small, marginTop:10 }}>Queue refreshes when you press Refresh. Last refreshed: {updatedAt ? formatDate(updatedAt) : "—"}. Future appointments, PM, PM DNH and SOLD results, excluded hotkey statuses, and leads with 15 call attempts are omitted. Past appointments without one of those results are classified as Rework.</div>
  </div>
}

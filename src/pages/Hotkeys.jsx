import React, { useCallback, useEffect, useState } from "react"
import { RefreshCw, Search, Phone, MapPin, CalendarDays, Tag } from "lucide-react"
import { supabase } from "../lib/supabase"

const PAGE_SIZE = 50
const FIELDS = "delete_row_id,marketing_row_id,first_name,last_name,salutations,primary_phone_number,secondary_phone_number,postcode,lead_source,received_date_time,hotkey_status,disposition"

function displayName(lead) {
  return [lead.salutations, lead.first_name, lead.last_name].map(value => String(value || "").trim()).filter(Boolean).join(" ") || "Unnamed lead"
}

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function Hotkeys() {
  const [leads, setLeads] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const loadLeads = useCallback(async (pageNumber = page) => {
    if (!supabase) { setError("Supabase is not configured."); return }
    setLoading(true)
    setError("")
    try {
      let query = supabase.from("leads").select(FIELDS, { count: "exact" })
        .not("hotkey_status", "is", null)
        .neq("hotkey_status", "")
        .order("received_date_time", { ascending: false, nullsFirst: false })
        .range(pageNumber * PAGE_SIZE, pageNumber * PAGE_SIZE + PAGE_SIZE - 1)

      const term = search.trim()
      if (term) {
        const safeTerm = term.replace(/[%_]/g, "\\$&").replace(/,/g, "\\,")
        query = query.or(`first_name.ilike.%${safeTerm}%,last_name.ilike.%${safeTerm}%,postcode.ilike.%${safeTerm}%,primary_phone_number.ilike.%${safeTerm}%,lead_source.ilike.%${safeTerm}%,hotkey_status.ilike.%${safeTerm}%,disposition.ilike.%${safeTerm}%`)
      }
      const { data, count, error: queryError } = await query
      if (queryError) throw queryError
      setLeads(data || [])
      setTotal(Number(count || 0))
    } catch (err) {
      console.error("Unable to load hotkey leads:", err)
      setError(err?.message || "Unable to load hotkey leads.")
      setLeads([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { loadLeads(page) }, [loadLeads])

  function updateSearch(value) {
    setSearch(value)
    setPage(0)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <section>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, flexWrap:"wrap", marginBottom:20 }}>
        <div>
          <h2 style={{ margin:0, color:"#17324d", fontSize:24 }}>Hotkeys</h2>
          <p style={{ margin:"6px 0 0", color:"#64748b" }}>Leads with a hotkey status assigned.</p>
        </div>
        <button type="button" onClick={() => loadLeads(page)} disabled={loading} style={{ border:"1px solid #d7dee8", background:"#fff", color:"#334155", borderRadius:8, padding:"10px 14px", display:"inline-flex", alignItems:"center", gap:8, cursor:"pointer" }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap", marginBottom:14 }}>
        <div style={{ position:"relative", flex:"1 1 280px", maxWidth:440 }}>
          <Search size={16} style={{ position:"absolute", left:12, top:12, color:"#94a3b8" }} />
          <input value={search} onChange={event => updateSearch(event.target.value)} placeholder="Search name, postcode, phone, source or status…" style={{ width:"100%", boxSizing:"border-box", padding:"10px 12px 10px 36px", border:"1px solid #d7dee8", borderRadius:9, font:"inherit" }} />
        </div>
        <div style={{ color:"#64748b", fontSize:13, fontWeight:700 }}>{total.toLocaleString("en-GB")} leads</div>
      </div>

      {error && <div role="alert" style={{ padding:14, marginBottom:14, border:"1px solid #fecaca", background:"#fff6f6", color:"#991b1b", borderRadius:9 }}>{error}</div>}

      <div style={{ background:"#fff", border:"1px solid #e4e9ef", borderRadius:12, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:850, fontSize:13 }}>
            <thead>
              <tr style={{ background:"#f8fafc", color:"#64748b", textAlign:"left" }}>
                {["Lead","Contact","Postcode","Lead Source","Hotkey Status","Disposition","Received"].map(label => <th key={label} style={{ padding:"13px 14px", fontSize:11, textTransform:"uppercase", letterSpacing:".04em", whiteSpace:"nowrap" }}>{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} style={{ padding:36, textAlign:"center", color:"#64748b" }}>Loading hotkey leads…</td></tr>
                : leads.length === 0 ? <tr><td colSpan={7} style={{ padding:36, textAlign:"center", color:"#64748b" }}>No leads found with a hotkey status.</td></tr>
                : leads.map((lead, index) => <tr key={lead.delete_row_id || lead.marketing_row_id || index} style={{ borderTop:"1px solid #edf1f5" }}>
                  <td style={{ padding:"13px 14px", color:"#17324d", fontWeight:800 }}>{displayName(lead)}</td>
                  <td style={{ padding:"13px 14px", whiteSpace:"nowrap", color:"#475569" }}><span style={{ display:"inline-flex", alignItems:"center", gap:6 }}><Phone size={13}/>{lead.primary_phone_number || lead.secondary_phone_number || "—"}</span></td>
                  <td style={{ padding:"13px 14px", whiteSpace:"nowrap", color:"#475569" }}><span style={{ display:"inline-flex", alignItems:"center", gap:6 }}><MapPin size={13}/>{lead.postcode || "—"}</span></td>
                  <td style={{ padding:"13px 14px", color:"#475569" }}>{lead.lead_source || "—"}</td>
                  <td style={{ padding:"13px 14px" }}><span style={{ display:"inline-flex", alignItems:"center", gap:6, borderRadius:999, padding:"5px 9px", background:"#eef6ff", color:"#1d4ed8", fontWeight:800, whiteSpace:"nowrap" }}><Tag size={12}/>{lead.hotkey_status}</span></td>
                  <td style={{ padding:"13px 14px", color:"#475569" }}>{lead.disposition || "—"}</td>
                  <td style={{ padding:"13px 14px", color:"#64748b", whiteSpace:"nowrap" }}><span style={{ display:"inline-flex", alignItems:"center", gap:6 }}><CalendarDays size={13}/>{formatDate(lead.received_date_time)}</span></td>
                </tr>)}
            </tbody>
          </table>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, padding:"12px 14px", borderTop:"1px solid #edf1f5", color:"#64748b", fontSize:12 }}>
          <span>Showing {total === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString("en-GB")}</span>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button type="button" disabled={page === 0 || loading} onClick={() => setPage(current => Math.max(0, current - 1))} style={{ border:"1px solid #d7dee8", borderRadius:7, background:"#fff", padding:"7px 11px", color:"#334155", cursor:page === 0 ? "default" : "pointer", opacity:page === 0 ? .45 : 1 }}>Previous</button>
            <span>Page {page + 1} of {totalPages}</span>
            <button type="button" disabled={page + 1 >= totalPages || loading} onClick={() => setPage(current => current + 1)} style={{ border:"1px solid #d7dee8", borderRadius:7, background:"#fff", padding:"7px 11px", color:"#334155", cursor:page + 1 >= totalPages ? "default" : "pointer", opacity:page + 1 >= totalPages ? .45 : 1 }}>Next</button>
          </div>
        </div>
      </div>
    </section>
  )
}

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Phone, RefreshCw, Search, Clock3, MapPin, CalendarDays } from "lucide-react"
import { supabase } from "../lib/supabase"

const FIELDS = "delete_row_id,marketing_row_id,salutations,first_name,last_name,postcode,primary_phone_number,secondary_phone_number,lead_source,received_date_time,disposition,callback_date_time,last_time_called,last_called_at,call_count,call_counter,last_call_note"
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [updatedAt, setUpdatedAt] = useState(null)

  const load = useCallback(async () => {
    if (!supabase) { setError("Supabase is not configured."); return }
    setLoading(true)
    setError("")
    try {
      const cutoff = new Date()
      cutoff.setMonth(cutoff.getMonth() - 6)
      const { data, error: leadError } = await supabase.from("leads").select(FIELDS)
        .gte("received_date_time", cutoff.toISOString())
        .or('hotkey_status.is.null,hotkey_status.not.in.("Return Accepted","Return Open")')
        .or('disposition.is.null,disposition.eq.,disposition.eq."No Contact",disposition.ilike.*Call Back*,disposition.ilike.*Callback*')
        .order("received_date_time", { ascending: false, nullsFirst: false })
        .range(0, 9999)
      if (leadError) throw leadError
      const rows = data || []
      const ids = [...new Set(rows.map(row => row.marketing_row_id).filter(Boolean))]
      const appointmentState = new Map()
      for (let i = 0; i < ids.length; i += 500) {
        const { data: appointments, error: appointmentError } = await supabase.from("appointments")
          .select("marketing_row_id,appointment_date,result")
          .in("marketing_row_id", ids.slice(i, i + 500))
          .not("appointment_date", "is", null)
        if (appointmentError) throw appointmentError
        ;(appointments || []).forEach(appointment => {
          const key = appointment.marketing_row_id
          const appointmentTime = dateValue(appointment.appointment_date)
          if (appointmentTime === null) return
          const existing = appointmentState.get(key)
          if (!existing || appointmentTime > existing.appointmentTime) {
            const result = String(appointment.result || "").trim()
            appointmentState.set(key, {
              appointmentDate: appointment.appointment_date,
              appointmentTime,
              appointmentResult: result,
              hasFuture: appointmentTime > Date.now(),
              hasRework: appointmentTime <= Date.now() && !["PM", "PM DNH", "SOLD"].includes(result.toUpperCase()),
            })
          }
        })
      }
      const now = Date.now()
      const eligible = rows.filter(lead => {
        const appointment = lead.marketing_row_id ? appointmentState.get(lead.marketing_row_id) : null
        if (appointment?.hasFuture) return false
        const isRework = Boolean(appointment?.hasRework)
        const disposition = String(lead.disposition || "").trim().toLowerCase()
        const attempts = attemptsOf(lead)
        if (attempts >= 15) return false
        if (isRework && disposition !== "no contact" && !disposition.includes("call back") && !disposition.includes("callback")) return true
        if (disposition.includes("call back") || disposition.includes("callback")) {
          const callbackAt = dateValue(lead.callback_date_time)
          return callbackAt !== null && callbackAt <= now
        }
        if (!disposition) {
          return !lead.last_time_called && !lead.last_called_at
        }
        if (disposition === "no contact") {
          const lastCall = dateValue(lead.last_time_called) ?? (lead.last_called_at ? new Date(lead.last_called_at).getTime() : null)
          return lastCall !== null && lastCall <= now - 2 * 60 * 60 * 1000
        }
        return false
      })
      setLeads(eligible.map(lead => { const appointment = lead.marketing_row_id ? appointmentState.get(lead.marketing_row_id) : null; return { ...lead, isRework: Boolean(appointment?.hasRework), latestAppointmentDate: appointment?.appointmentDate || null, latestAppointmentResult: appointment?.appointmentResult || "" } }))
      setUpdatedAt(Date.now())
    } catch (err) {
      console.error("Lead To Call load failed", err)
      setError(err?.message || "Unable to load the calling queue.")
      setLeads([])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const queue = useMemo(() => {
    const now = Date.now()
    const prepared = leads.map(lead => {
      const disposition = String(lead.disposition || "").trim().toLowerCase()
      const callbackAt = dateValue(lead.callback_date_time)
      const isCallback = disposition.includes("call back") || disposition.includes("callback")
      const isFresh = !disposition
      const lastCallAt = dateValue(lead.last_time_called) ?? (lead.last_called_at ? new Date(lead.last_called_at).getTime() : null)
      return { ...lead, priority: isCallback ? 0 : isFresh ? 1 : lead.isRework ? 2 : lead.disposition?.trim().toLowerCase() === "no contact" ? 3 : 4, callbackAt, lastCallAt, attempts: attemptsOf(lead), queueType: isCallback ? "Callback due" : lead.disposition?.trim().toLowerCase() === "no contact" ? "No Contact" : lead.isRework ? "Rework" : isFresh ? "Fresh lead" : "No Contact" }
    }).filter(lead => {
      const term = search.trim().toLowerCase()
      return !term || [nameOf(lead), lead.postcode, lead.primary_phone_number, lead.secondary_phone_number, lead.lead_source].some(v => String(v || "").toLowerCase().includes(term))
    })
    return prepared.sort((a, b) => a.priority - b.priority ||
      (a.priority === 0 ? a.callbackAt - b.callbackAt : a.priority === 1 ? new Date(b.received_date_time || 0) - new Date(a.received_date_time || 0) : (a.lastCallAt || 0) - (b.lastCallAt || 0)))
  }, [leads, search])

  const counts = useMemo(() => ({
    callbacks: leads.filter(l => String(l.disposition || "").toLowerCase().includes("call back") || String(l.disposition || "").toLowerCase().includes("callback")).length,
    rework: leads.filter(l => l.isRework && !String(l.disposition || "").toLowerCase().includes("call back") && String(l.disposition || "").trim().toLowerCase() !== "no contact").length,
    fresh: leads.filter(l => !l.isRework && !String(l.disposition || "").trim()).length,
    noContact: leads.filter(l => String(l.disposition || "").trim().toLowerCase() === "no contact").length,
  }), [leads])

  const panel = { background:"#fff", border:"1px solid #e2e8f0", borderRadius:12 }
  const small = { fontSize:11, color:"#64748b" }

  return <div style={{ maxWidth:1500, margin:"0 auto" }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap", marginBottom:18 }}>
      <div><h1 style={{ margin:0, fontSize:24, color:"#0f172a" }}>Lead To Call</h1><div style={{ ...small, marginTop:5 }}>One prioritised queue showing the next eligible leads for the canvassing team.</div></div>
      <button type="button" onClick={load} disabled={loading} style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"9px 13px", border:"1px solid #cbd5e1", borderRadius:8, background:"#fff", cursor:"pointer", fontWeight:650 }}><RefreshCw size={14}/>{loading ? "Refreshing…" : "Refresh queue"}</button>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:10, marginBottom:16 }}>
      {[["Callbacks due",counts.callbacks],["Rework",counts.rework],["Fresh leads",counts.fresh],["No Contact ready",counts.noContact]].map(([label,value])=><div key={label} style={{ ...panel, padding:"13px 15px" }}><div style={small}>{label}</div><div style={{ fontSize:24, fontWeight:800, color:"#0f172a", marginTop:4 }}>{value.toLocaleString("en-GB")}</div></div>)}
    </div>
    <div style={{ ...panel, padding:12, marginBottom:12, display:"flex", alignItems:"center", gap:9 }}>
      <Search size={16} color="#64748b"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, postcode, phone or source…" style={{ border:0, outline:0, flex:1, minWidth:120, fontSize:13, background:"transparent" }}/>
      <span style={small}>{queue.length.toLocaleString("en-GB")} in queue</span>
    </div>
    {error && <div role="alert" style={{ ...panel, padding:13, color:"#b91c1c", marginBottom:12 }}>{error}</div>}
    <div style={{ ...panel, overflow:"hidden" }}>
      <div style={{ padding:"12px 15px", borderBottom:"1px solid #e2e8f0", display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}><strong style={{ fontSize:13 }}>Next leads to phone</strong><span style={small}>Callbacks → Rework → Fresh → No Contact (2-hour gap, max 15 attempts)</span></div>
      {loading ? <div style={{ padding:36, textAlign:"center", color:"#64748b" }}>Loading calling queue…</div> : queue.length === 0 ? <div style={{ padding:36, textAlign:"center", color:"#64748b" }}>No eligible leads to call right now.</div> :
        <div style={{ overflowX:"auto" }}><table style={{ width:"100%", borderCollapse:"collapse", minWidth:900, fontSize:12, color:"#334155" }}>
          <thead><tr style={{ background:"#f8fafc", textAlign:"left" }}>{["#","Customer","Postcode","Phone","Source","Latest appointment","Appointment result","Disposition","Callback date/time","Received","Last called","Attempts","Action"].map(label=><th key={label} style={{ padding:"10px 12px", borderBottom:"1px solid #e2e8f0", whiteSpace:"nowrap" }}>{label}</th>)}</tr></thead>
          <tbody>{queue.map((lead,index)=><tr key={lead.delete_row_id} style={{ background:lead.priority===0?"#fff4d6":lead.priority===1?"#f3e8ff":lead.priority===2?"#eaf3ff":index%2?"#f8fafc":"#ffffff" }}>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6" }}>{index+1}</td>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6", fontWeight:750, color:"#0f172a", whiteSpace:"nowrap" }}>{nameOf(lead)}</td>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6" }}>{lead.postcode||"—"}</td>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6", whiteSpace:"nowrap" }}>{lead.primary_phone_number||lead.secondary_phone_number||"—"}</td>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6" }}>{lead.lead_source||"Unknown"}</td>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6", whiteSpace:"nowrap" }}>{lead.latestAppointmentDate ? formatDate(dateValue(lead.latestAppointmentDate)) : "—"}</td>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6", whiteSpace:"nowrap" }}>{lead.latestAppointmentResult || (lead.latestAppointmentDate ? "No result" : "—")}</td>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6", whiteSpace:"nowrap" }}>{lead.disposition||"Fresh"}</td>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6", whiteSpace:"nowrap" }}>{lead.callback_date_time ? formatDate(dateValue(lead.callback_date_time)) : "—"}</td>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6", whiteSpace:"nowrap" }}>{formatDate(lead.received_date_time)}</td>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6", whiteSpace:"nowrap" }}>{lead.last_time_called ? formatDate(dateValue(lead.last_time_called)) : lead.last_called_at ? formatDate(lead.last_called_at) : "Never"}</td>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6", textAlign:"center" }}>{lead.attempts}</td>
            <td style={{ padding:"11px 12px", borderBottom:"1px solid #eef2f6" }}><a href={lead.primary_phone_number ? `tel:${lead.primary_phone_number}` : lead.secondary_phone_number ? `tel:${lead.secondary_phone_number}` : undefined} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"7px 10px", borderRadius:7, background:"#0f766e", color:"#fff", textDecoration:"none", fontWeight:750, opacity:lead.primary_phone_number||lead.secondary_phone_number?1:.45, pointerEvents:lead.primary_phone_number||lead.secondary_phone_number?"auto":"none" }}><Phone size={13}/>Call</a></td>
          </tr>)}</tbody>
        </table></div>}
    </div>
    <div style={{ ...small, marginTop:10 }}>Queue refreshes when you press Refresh. Last refreshed: {updatedAt ? formatDate(updatedAt) : "—"}. Future appointments, PM, PM DNH and SOLD results, excluded hotkey statuses, and leads with 15 call attempts are omitted. Past appointments without one of those results are classified as Rework.</div>
  </div>
}

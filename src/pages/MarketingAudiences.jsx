import React, { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"

const input = { border:"1px solid #cbd5e1", borderRadius:7, padding:"9px 10px", fontSize:13, width:"100%", boxSizing:"border-box", background:"#fff", color:"#0f172a" }
const button = { border:0, borderRadius:7, padding:"9px 13px", background:"#0f766e", color:"#fff", fontWeight:700, cursor:"pointer" }
const blank = { name:"", description:"", introducer:"", disposition:"", postcode:"", emailOnly:false, mobileOnly:false, receivedFrom:"", receivedTo:"" }

export default function MarketingAudiences() {
  const [audiences,setAudiences]=useState([])
  const [noContactBreakdown,setNoContactBreakdown]=useState([])
  const [noContactSummary,setNoContactSummary]=useState(null)
  const [noContactStatsLoading,setNoContactStatsLoading]=useState(true)
  const [draft,setDraft]=useState(blank)
  const [editing,setEditing]=useState(null)
  const [count,setCount]=useState(null)
  const [sample,setSample]=useState([])
  const [loading,setLoading]=useState(true)
  const [previewLoading,setPreviewLoading]=useState(false)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState("")
  const [success,setSuccess]=useState("")

  async function loadAudiences() {
    setLoading(true); setError("")
    const {data,error}=await supabase.from("marketing_audiences").select("*").order("updated_at",{ascending:false})
    if(error)setError(error.message); else setAudiences(data||[])
    const stats = await supabase.from("marketing_no_contact_audience_breakdown").select("lead_type,total_leads,uk_mobile_numbers,email_addresses").order("total_leads",{ascending:false})
    if(!stats.error)setNoContactBreakdown(stats.data||[]); else setError(stats.error.message)
    const summary = await supabase.from("marketing_no_contact_audience_summary").select("total_leads,unique_uk_mobile_numbers,unique_email_addresses").single()
    if(!summary.error)setNoContactSummary(summary.data); else setError(summary.error.message)
    setNoContactStatsLoading(false)
    setLoading(false)
  }
  useEffect(()=>{loadAudiences()},[])

  const filters=useMemo(()=>({
    introducer:draft.introducer.trim(), disposition:draft.disposition.trim(), postcode:draft.postcode.trim(),
    emailOnly:draft.emailOnly, mobileOnly:draft.mobileOnly, receivedFrom:draft.receivedFrom, receivedTo:draft.receivedTo
  }),[draft])

  async function preview(next=filters) {
    setPreviewLoading(true);setError("")
    let q=supabase.from("leads").select("delete_row_id,first_name,last_name,email,primary_phone_number,postcode,introducer,disposition,received_date_time",{count:"exact"})
    if(next.introducer)q=q.ilike("introducer",next.introducer)
    if(next.disposition)q=q.ilike("disposition",next.disposition)
    if(next.postcode)q=q.ilike("postcode",next.postcode+"%")
    if(next.emailOnly)q=q.not("email","is",null).neq("email","")
    if(next.mobileOnly)q=q.not("primary_phone_number","is",null).neq("primary_phone_number","")
    if(next.receivedFrom)q=q.gte("received_date_time",next.receivedFrom+"T00:00:00")
    if(next.receivedTo)q=q.lt("received_date_time",new Date(new Date(next.receivedTo+"T00:00:00").getTime()+86400000).toISOString())
    const {data,count,error}=await q.order("received_date_time",{ascending:false}).limit(8)
    if(error)setError(error.message);else{setCount(count||0);setSample(data||[])}
    setPreviewLoading(false)
  }

  function startNew(){setEditing(null);setDraft(blank);setCount(null);setSample([]);setSuccess("");setError("")}
  function editAudience(a){setEditing(a.id);setDraft({...blank,...a.filters,name:a.name,description:a.description||""});setSuccess("");setError("");preview(a.filters||{})}
  async function save(){
    if(!draft.name.trim()){setError("Give this audience a name.");return}
    setSaving(true);setError("");setSuccess("")
    const payload={name:draft.name.trim(),description:draft.description.trim()||null,source_table:"leads",filters,updated_at:new Date().toISOString()}
    const result=editing
      ? await supabase.from("marketing_audiences").update(payload).eq("id",editing).select().single()
      : await supabase.from("marketing_audiences").insert({...payload,created_by:(await supabase.auth.getUser()).data?.user?.id||null}).select().single()
    if(result.error)setError(result.error.message)
    else{setSuccess("Audience saved.");await loadAudiences();setEditing(result.data.id)}
    setSaving(false)
  }
  async function remove(a){
    if(!window.confirm("Delete the audience “"+a.name+"”?"))return
    const {error}=await supabase.from("marketing_audiences").delete().eq("id",a.id)
    if(error)setError(error.message);else{setAudiences(v=>v.filter(x=>x.id!==a.id));if(editing===a.id)startNew()}
  }
  const set=(key,value)=>setDraft(v=>({...v,[key]:value}))

  return <section style={{maxWidth:1400,margin:"0 auto",color:"#0f172a"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:22}}>
      <div><h1 style={{fontSize:24,margin:0}}>Marketing audiences</h1><p style={{margin:"6px 0 0",color:"#64748b",fontSize:13}}>Build and save live segments from your existing CRM leads.</p></div>
      <button style={button} onClick={startNew}>+ Create audience</button>
    </div>
    {error&&<div style={{padding:12,background:"#fef2f2",color:"#991b1b",borderRadius:8,marginBottom:12}}>{error}</div>}
    {success&&<div style={{padding:12,background:"#ecfdf5",color:"#065f46",borderRadius:8,marginBottom:12}}>{success}</div>}
    <div style={{display:"grid",gridTemplateColumns:"minmax(280px, .8fr) minmax(420px,1.2fr)",gap:18,alignItems:"start"}}>
      <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:17}}>
        <h2 style={{fontSize:16,margin:"0 0 14px"}}>Saved audiences</h2>
        {loading?<p style={{color:"#64748b"}}>Loading…</p>:audiences.length===0?<p style={{color:"#64748b",fontSize:13}}>No audiences saved yet. Create your first segment.</p>:audiences.map(a=><div key={a.id} style={{padding:"13px 0",borderTop:"1px solid #edf2f7"}}>
          {a.filters?.audienceType === "no_contact_all_sources" ? <div style={{width:"100%"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
              <div><strong style={{fontSize:15,color:"#0f172a"}}>{a.name}</strong><p style={{fontSize:12,color:"#64748b",margin:"5px 0 0"}}>{a.description}</p></div>
              <button onClick={()=>remove(a)} title="Delete audience" style={{border:0,background:"transparent",color:"#b91c1c",cursor:"pointer"}}>Delete</button>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,margin:"12px 0"}}>
              {["All lead sources","Last 2 years","Disposition: No Contact","Excludes Return Accepted","Excludes Return Open"].map(x=><span key={x} style={{fontSize:10,padding:"5px 7px",borderRadius:20,background:"#f1f5f9",color:"#334155"}}>{x}</span>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:7,marginBottom:12}}>
              <div style={{background:"#f0fdfa",borderRadius:8,padding:9}}><div style={{fontSize:10,color:"#64748b"}}>Total leads</div><strong style={{fontSize:19,color:"#134e4a"}}>{noContactStatsLoading?"…":Number(noContactSummary?.total_leads||0).toLocaleString("en-GB")}</strong></div>
              <div style={{background:"#f8fafc",borderRadius:8,padding:9}}><div style={{fontSize:10,color:"#64748b"}}>UK mobiles</div><strong style={{fontSize:19}}>{noContactStatsLoading?"…":Number(noContactSummary?.unique_uk_mobile_numbers||0).toLocaleString("en-GB")}</strong></div>
              <div style={{background:"#f8fafc",borderRadius:8,padding:9}}><div style={{fontSize:10,color:"#64748b"}}>Emails</div><strong style={{fontSize:19}}>{noContactStatsLoading?"…":Number(noContactSummary?.unique_email_addresses||0).toLocaleString("en-GB")}</strong></div>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr>{["Lead type","Total","UK mobiles","Emails"].map(x=><th key={x} style={{textAlign:x==="Lead type"?"left":"right",padding:"7px 5px",borderBottom:"1px solid #e2e8f0",color:"#64748b",whiteSpace:"nowrap"}}>{x}</th>)}</tr></thead>
                <tbody>{noContactBreakdown.map(x=><tr key={x.lead_type}><td style={{padding:"7px 5px",borderBottom:"1px solid #f1f5f9"}}>{x.lead_type}</td><td style={{textAlign:"right",padding:"7px 5px",borderBottom:"1px solid #f1f5f9"}}>{Number(x.total_leads).toLocaleString("en-GB")}</td><td style={{textAlign:"right",padding:"7px 5px",borderBottom:"1px solid #f1f5f9"}}>{Number(x.uk_mobile_numbers).toLocaleString("en-GB")}</td><td style={{textAlign:"right",padding:"7px 5px",borderBottom:"1px solid #f1f5f9"}}>{Number(x.email_addresses).toLocaleString("en-GB")}</td></tr>)}</tbody>
              </table>
            </div>
          </div> : <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
            <button onClick={()=>editAudience(a)} style={{border:0,background:"transparent",textAlign:"left",padding:0,cursor:"pointer",minWidth:0}}><strong style={{display:"block",fontSize:13,color:"#0f172a"}}>{a.name}</strong><span style={{display:"block",fontSize:11,color:"#64748b",marginTop:3}}>{a.description||"No description"}</span></button>
            <button onClick={()=>remove(a)} title="Delete audience" style={{border:0,background:"transparent",color:"#b91c1c",cursor:"pointer"}}>Delete</button>
          </div>}
        </div>)}
      </div>
      <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:17}}>
        <h2 style={{fontSize:16,margin:"0 0 14px"}}>{editing?"Edit audience":"Create audience"}</h2>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <label style={{fontSize:12,fontWeight:650}}>Audience name<input value={draft.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Glasgow solar leads" style={{...input,marginTop:5}}/></label>
          <label style={{fontSize:12,fontWeight:650}}>Description<input value={draft.description} onChange={e=>set("description",e.target.value)} placeholder="Optional" style={{...input,marginTop:5}}/></label>
          <label style={{fontSize:12,fontWeight:650}}>Introducer<input value={draft.introducer} onChange={e=>set("introducer",e.target.value)} placeholder="Exact introducer" style={{...input,marginTop:5}}/></label>
          <label style={{fontSize:12,fontWeight:650}}>Lead disposition<input value={draft.disposition} onChange={e=>set("disposition",e.target.value)} placeholder="Exact disposition" style={{...input,marginTop:5}}/></label>
          <label style={{fontSize:12,fontWeight:650}}>Postcode starts with<input value={draft.postcode} onChange={e=>set("postcode",e.target.value.toUpperCase())} placeholder="e.g. G, ML, EH" style={{...input,marginTop:5}}/></label>
          <div style={{fontSize:12,fontWeight:650}}>Received date range<div style={{display:"flex",gap:6,marginTop:5}}><input type="date" value={draft.receivedFrom} onChange={e=>set("receivedFrom",e.target.value)} style={input}/><input type="date" value={draft.receivedTo} onChange={e=>set("receivedTo",e.target.value)} style={input}/></div></div>
        </div>
        <div style={{display:"flex",gap:18,flexWrap:"wrap",margin:"14px 0",fontSize:13}}>
          <label><input type="checkbox" checked={draft.emailOnly} onChange={e=>set("emailOnly",e.target.checked)}/> Has email address</label>
          <label><input type="checkbox" checked={draft.mobileOnly} onChange={e=>set("mobileOnly",e.target.checked)}/> Has mobile number</label>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button style={button} disabled={previewLoading} onClick={()=>preview()}>{previewLoading?"Checking…":"Preview audience"}</button>
          <button style={{...button,background:"#1e293b"}} disabled={saving} onClick={save}>{saving?"Saving…":"Save audience"}</button>
          <button style={{...button,background:"#e2e8f0",color:"#334155"}} onClick={startNew}>Clear</button>
        </div>
        {count!==null&&<div style={{marginTop:17,padding:14,background:"#f0fdfa",borderRadius:9}}>
          <div style={{fontSize:11,color:"#0f766e",fontWeight:700,textTransform:"uppercase"}}>Estimated audience size</div><div style={{fontSize:27,fontWeight:800,color:"#134e4a",marginTop:2}}>{count.toLocaleString("en-GB")}</div><div style={{fontSize:11,color:"#64748b"}}>Live count from matching CRM leads. Preview shows up to 8 examples.</div>
        </div>}
        {sample.length>0&&<div style={{marginTop:12,overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Name","Email","Postcode","Introducer"].map(x=><th key={x} style={{textAlign:"left",padding:7,borderBottom:"1px solid #e2e8f0",color:"#64748b"}}>{x}</th>)}</tr></thead><tbody>{sample.map(x=><tr key={x.delete_row_id}><td style={{padding:7,borderBottom:"1px solid #f1f5f9"}}>{[x.first_name,x.last_name].filter(Boolean).join(" ")||"—"}</td><td style={{padding:7,borderBottom:"1px solid #f1f5f9"}}>{x.email||"—"}</td><td style={{padding:7,borderBottom:"1px solid #f1f5f9"}}>{x.postcode||"—"}</td><td style={{padding:7,borderBottom:"1px solid #f1f5f9"}}>{x.introducer||"—"}</td></tr>)}</tbody></table></div>}
      </div>
    </div>
    <p style={{fontSize:11,color:"#64748b",marginTop:14}}>Audience building only at this stage. No messages are sent and no sending provider is connected.</p>
  </section>
}

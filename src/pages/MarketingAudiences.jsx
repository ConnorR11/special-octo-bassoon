import React, { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"


export default function MarketingAudiences() {
  const [audiences,setAudiences]=useState([])
  const [noContactBreakdown,setNoContactBreakdown]=useState({})
  const [noContactSummary,setNoContactSummary]=useState({})
  const [noContactStatsLoading,setNoContactStatsLoading]=useState(true)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState("")

  async function loadAudiences() {
    setLoading(true); setError("")
    const {data,error}=await supabase.from("marketing_audiences").select("*").order("updated_at",{ascending:false})
    if(error)setError(error.message); else setAudiences(data||[])
    const stats = await supabase.from("marketing_no_contact_age_breakdown").select("age_band,lead_type,total_leads,uk_mobile_numbers,email_addresses").order("total_leads",{ascending:false})
    if(!stats.error)setNoContactBreakdown((stats.data||[]).reduce((acc,row)=>({...acc,[row.age_band]:[...(acc[row.age_band]||[]),row]}),{})); else setError(stats.error.message)
    const summary = await supabase.from("marketing_no_contact_age_summary").select("age_band,total_leads,unique_uk_mobile_numbers,unique_email_addresses")
    if(!summary.error)setNoContactSummary((summary.data||[]).reduce((acc,row)=>({...acc,[row.age_band]:row}),{})); else setError(summary.error.message)
    setNoContactStatsLoading(false)
    setLoading(false)
  }
  useEffect(()=>{loadAudiences()},[])

  async function remove(a){
    if(!window.confirm("Delete the audience “"+a.name+"”?"))return
    const {error}=await supabase.from("marketing_audiences").delete().eq("id",a.id)
    if(error)setError(error.message);else setAudiences(v=>v.filter(x=>x.id!==a.id))
  }

  return <section style={{maxWidth:1400,margin:"0 auto",color:"#0f172a"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:22}}>
      <div><h1 style={{fontSize:24,margin:0}}>Marketing audiences</h1><p style={{margin:"6px 0 0",color:"#64748b",fontSize:13}}>Build and save live segments from your existing CRM leads.</p></div>
    </div>
    {error&&<div style={{padding:12,background:"#fef2f2",color:"#991b1b",borderRadius:8,marginBottom:12}}>{error}</div>}
      <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:17}}>
        <h2 style={{fontSize:16,margin:"0 0 14px"}}>Saved audiences</h2>
        {loading?<p style={{color:"#64748b"}}>Loading…</p>:audiences.length===0?<p style={{color:"#64748b",fontSize:13}}>No audiences saved yet. Create your first segment.</p>:audiences.map(a=><div key={a.id} style={{margin:"14px 0",border:"1px solid #cbd5e1",borderRadius:14,overflow:"hidden",background:"#fff",boxShadow:"0 3px 10px rgba(15,35,65,0.07)"}}>
          {a.filters?.audienceType === "no_contact_age_band" ? <div style={{width:"100%"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,background:"#12345a",padding:"15px 18px"}}>
              <div><strong style={{fontSize:16,color:"#fff",display:"block"}}>{a.name}</strong><p style={{fontSize:12,color:"#d7e3f1",margin:"5px 0 0"}}>{a.description}</p></div>
              <button onClick={()=>remove(a)} title="Delete audience" style={{border:"1px solid rgba(255,255,255,.35)",borderRadius:7,background:"rgba(255,255,255,.08)",color:"#fff",padding:"6px 10px",cursor:"pointer",flexShrink:0}}>Delete</button>
            </div>
            <div style={{padding:"15px 17px 17px"}}>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,margin:"0 0 12px"}}>
              {["All lead sources",(a.filters.ageBand==="0_6"?"Last 6 months":a.filters.ageBand==="6_12"?"6–12 months ago":"12–24 months ago"),"Disposition: No Contact","Excludes Return Accepted","Excludes Return Open","Excludes leads with booked appointments"].map(x=><span key={x} style={{fontSize:10,padding:"5px 7px",borderRadius:20,background:"#f1f5f9",color:"#334155"}}>{x}</span>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:7,marginBottom:12}}>
              <div style={{background:"#f0fdfa",borderRadius:8,padding:9}}><div style={{fontSize:10,color:"#64748b"}}>Total leads</div><strong style={{fontSize:19,color:"#134e4a"}}>{noContactStatsLoading?"…":Number(noContactSummary[a.filters.ageBand]?.total_leads||0).toLocaleString("en-GB")}</strong></div>
              <div style={{background:"#f8fafc",borderRadius:8,padding:9}}><div style={{fontSize:10,color:"#64748b"}}>UK mobiles</div><strong style={{fontSize:19}}>{noContactStatsLoading?"…":Number(noContactSummary[a.filters.ageBand]?.unique_uk_mobile_numbers||0).toLocaleString("en-GB")}</strong></div>
              <div style={{background:"#f8fafc",borderRadius:8,padding:9}}><div style={{fontSize:10,color:"#64748b"}}>Emails</div><strong style={{fontSize:19}}>{noContactStatsLoading?"…":Number(noContactSummary[a.filters.ageBand]?.unique_email_addresses||0).toLocaleString("en-GB")}</strong></div>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr>{["Lead type","Total","UK mobiles","Emails"].map(x=><th key={x} style={{textAlign:x==="Lead type"?"left":"right",padding:"7px 5px",borderBottom:"1px solid #e2e8f0",color:"#64748b",whiteSpace:"nowrap"}}>{x}</th>)}</tr></thead>
                <tbody>{(noContactBreakdown[a.filters.ageBand]||[]).map(x=><tr key={x.lead_type}><td style={{padding:"7px 5px",borderBottom:"1px solid #f1f5f9"}}>{x.lead_type}</td><td style={{textAlign:"right",padding:"7px 5px",borderBottom:"1px solid #f1f5f9"}}>{Number(x.total_leads).toLocaleString("en-GB")}</td><td style={{textAlign:"right",padding:"7px 5px",borderBottom:"1px solid #f1f5f9"}}>{Number(x.uk_mobile_numbers).toLocaleString("en-GB")}</td><td style={{textAlign:"right",padding:"7px 5px",borderBottom:"1px solid #f1f5f9"}}>{Number(x.email_addresses).toLocaleString("en-GB")}</td></tr>)}</tbody>
              </table>
            </div>
            </div>
          </div> : <div style={{display:"flex",justifyContent:"space-between",gap:8,padding:14}}>
            <div><strong style={{display:"block",fontSize:13,color:"#0f172a"}}>{a.name}</strong><span style={{display:"block",fontSize:11,color:"#64748b",marginTop:3}}>{a.description||"No description"}</span></div>
            <button onClick={()=>remove(a)} title="Delete audience" style={{border:0,background:"transparent",color:"#b91c1c",cursor:"pointer"}}>Delete</button>
          </div>}
        </div>)}
      </div>
    <p style={{fontSize:11,color:"#64748b",marginTop:14}}>These are saved audience segments only. No messages are sent from this page.</p>
  </section>
}

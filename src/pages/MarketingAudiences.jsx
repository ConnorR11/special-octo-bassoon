import React, { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"


export default function MarketingAudiences() {
  const [audiences,setAudiences]=useState([])
  const [loading,setLoading]=useState(true)
  const [refreshing,setRefreshing]=useState(false)
  const [error,setError]=useState("")

  async function loadAudiences() {
    setLoading(true); setError("")
    const {data,error}=await supabase.from("marketing_audiences").select("*").order("updated_at",{ascending:false})
    if(error)setError(error.message); else setAudiences(data||[])
    setLoading(false)
  }
  useEffect(()=>{loadAudiences()},[])

  async function refreshAggregations(){
    setRefreshing(true);setError("")
    const {error}=await supabase.rpc("refresh_marketing_audience_aggregations")
    if(error)setError(error.message)
    else await loadAudiences()
    setRefreshing(false)
  }

  const noContactAudiences = audiences.filter(a => a.filters?.audienceType === "no_contact_age_band")
  const otherAudiences = audiences.filter(a => a.filters?.audienceType !== "no_contact_age_band")
  const ageBandLabel = band => band === "0_6" ? "0 to 6 months" : band === "6_12" ? "6 to 12 months" : "12 to 24 months"

  return <section style={{maxWidth:1400,margin:"0 auto",color:"#0f172a"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:22}}>
      <div><h1 style={{fontSize:24,margin:0}}>Marketing audiences</h1><p style={{margin:"6px 0 0",color:"#64748b",fontSize:13}}>Saved audience segments and their latest aggregated reach.</p></div>
      <button onClick={refreshAggregations} disabled={refreshing||loading} style={{border:0,borderRadius:8,padding:"10px 14px",background:refreshing?"#94a3b8":"#12345a",color:"#fff",fontWeight:700,cursor:refreshing||loading?"default":"pointer"}}>{refreshing?"Refreshing…":"Refresh audience figures"}</button>
    </div>
    {error&&<div style={{padding:12,background:"#fef2f2",color:"#991b1b",borderRadius:8,marginBottom:12}}>{error}</div>}
    <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:17}}>
      <h2 style={{fontSize:16,margin:"0 0 14px"}}>Saved audiences</h2>
      {loading?<p style={{color:"#64748b"}}>Loading…</p>:audiences.length===0?<p style={{color:"#64748b",fontSize:13}}>No audiences saved yet.</p>:<>
        {noContactAudiences.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14,alignItems:"start",margin:"14px 0"}}>
          {noContactAudiences.sort((a,b) => (["0_6","6_12","12_24"].indexOf(a.filters?.ageBand)-["0_6","6_12","12_24"].indexOf(b.filters?.ageBand))).map(a=><div key={a.id} style={{minWidth:0,border:"1px solid #cbd5e1",borderRadius:14,overflow:"hidden",background:"#fff",boxShadow:"0 3px 10px rgba(15,35,65,0.07)"}}>
            <div style={{background:"#12345a",padding:"13px 15px"}}>
              <strong style={{fontSize:15,color:"#fff",display:"block"}}>{ageBandLabel(a.filters?.ageBand)}</strong>
              <span style={{fontSize:10,color:"#d7e3f1"}}>No Contact audience</span>
            </div>
            <div style={{padding:12}}>
              <div style={{fontSize:10,color:"#64748b",marginBottom:9}}>Last calculated: {a.aggregated_at?new Date(a.aggregated_at).toLocaleString("en-GB"):"Not yet calculated"}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,margin:"0 0 10px"}}>
                {["All lead sources","Disposition: No Contact","Excludes Return Accepted","Excludes Return Open","Excludes booked appointments"].map(x=><span key={x} style={{fontSize:9,padding:"4px 6px",borderRadius:20,background:"#f1f5f9",color:"#334155"}}>{x}</span>)}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:6,marginBottom:10}}>
                <div style={{background:"#f0fdfa",borderRadius:8,padding:9}}><div style={{fontSize:10,color:"#64748b"}}>Total leads</div><strong style={{fontSize:21,color:"#134e4a"}}>{Number(a.aggregation?.total_leads||0).toLocaleString("en-GB")}</strong></div>
                <div style={{background:"#f8fafc",borderRadius:8,padding:9}}><div style={{fontSize:10,color:"#64748b"}}>UK mobiles</div><strong style={{fontSize:19}}>{Number(a.aggregation?.unique_uk_mobile_numbers||0).toLocaleString("en-GB")}</strong></div>
                <div style={{background:"#f8fafc",borderRadius:8,padding:9}}><div style={{fontSize:10,color:"#64748b"}}>Emails</div><strong style={{fontSize:19}}>{Number(a.aggregation?.unique_email_addresses||0).toLocaleString("en-GB")}</strong></div>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
                  <thead><tr>{["Lead type","Total","Mobiles","Emails"].map(x=><th key={x} style={{textAlign:x==="Lead type"?"left":"right",padding:"6px 3px",borderBottom:"1px solid #e2e8f0",color:"#64748b",whiteSpace:"nowrap"}}>{x}</th>)}</tr></thead>
                  <tbody>{(a.aggregation?.lead_types||[]).map(x=><tr key={x.name}><td style={{padding:"6px 3px",borderBottom:"1px solid #f1f5f9",overflowWrap:"anywhere"}}>{x.name}</td><td style={{textAlign:"right",padding:"6px 3px",borderBottom:"1px solid #f1f5f9"}}>{Number(x.total).toLocaleString("en-GB")}</td><td style={{textAlign:"right",padding:"6px 3px",borderBottom:"1px solid #f1f5f9"}}>{Number(x.mobiles).toLocaleString("en-GB")}</td><td style={{textAlign:"right",padding:"6px 3px",borderBottom:"1px solid #f1f5f9"}}>{Number(x.emails).toLocaleString("en-GB")}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          </div>)}
        </div>}
        {otherAudiences.map(a=><div key={a.id} style={{margin:"14px 0",border:"1px solid #cbd5e1",borderRadius:14,padding:14}}>
          <strong style={{display:"block",fontSize:13,color:"#0f172a"}}>{a.name}</strong>
          <span style={{display:"block",fontSize:11,color:"#64748b",marginTop:3}}>{a.description||"No description"}</span>
        </div>)}
      </>}
    </div>
    <p style={{fontSize:11,color:"#64748b",marginTop:14}}>Audience totals and lead-type breakdowns are stored directly on each saved audience record. No messages are sent from this page.</p>
  </section>
}

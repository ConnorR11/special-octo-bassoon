import React, { useEffect, useMemo, useState } from "react"
import { ChevronRight, Download, MapPin, PoundSterling, Search, UserRound, X } from "lucide-react"
import * as XLSX from "xlsx"
import { supabase } from "../lib/supabase"
import { formatDate, getInitials, money } from "../utils/formatters"

function getRepName(deal) { return deal?.salesperson || deal?.sales_rep || deal?.rep_name || deal?.rep_allocated || "Unallocated" }
function getBranchName(deal) { return deal?.branch || deal?.branch_name || "Unallocated" }
function getNetSalesValue(deal) { const value=deal?.net_value; const parsed=Number(String(value??"").replace(/[^0-9.-]/g,"")); return Number.isFinite(parsed)?parsed:0 }
function getSurveyCosting(deal) { const value=deal?.survey_costing; if(value===null||value===undefined||value==="")return null; const parsed=Number(String(value).replace(/[^0-9.-]/g,"")); return Number.isFinite(parsed)?parsed:null }
function getCommission(deal) { const value=deal?.estimated_commission_due; if(value===null||value===undefined||value==="")return null; const parsed=Number(String(value).replace(/[^0-9.-]/g,"")); return Number.isFinite(parsed)?parsed:null }
function getAdminFee(deal) { const value=Number(deal?.admin_fee_amount); if(value===299||value===399)return 199; return "query" }
function getCommissionDate(deal, source="commission") {
  const start=source==="admin" ? deal?.admin_fee_received_date : deal?.installation_start_date
  if(!start)return null
  const parts=String(start).slice(0,10).split("-").map(Number)
  if(parts.length!==3||parts.some(Number.isNaN))return null
  const date=new Date(Date.UTC(parts[0],parts[1]-1,parts[2]+14)); if(Number.isNaN(date.getTime()))return null
  const day=date.getUTCDay(); const daysUntilNextMonday=day===1?7:(8-day)%7||7
  date.setUTCDate(date.getUTCDate()+daysUntilNextMonday)
  return date.toISOString().slice(0,10)
}
const columns=".65fr .95fr 1.55fr 1.25fr 1fr .9fr 1fr 1.1fr .95fr 30px"
function DealRow({deal,setSelected,type}) {
  const isAdmin=type==="ADMIN", customer=deal?.customer_name||deal?.name||"Unnamed customer", paymentDate=getCommissionDate(deal,isAdmin?"admin":"commission"), surveyCosting=getSurveyCosting(deal), commission=getCommission(deal), adminFee=getAdminFee(deal)
  return <button type="button" onClick={()=>setSelected?.(deal)} style={{width:"100%",display:"grid",gridTemplateColumns:columns,gap:12,alignItems:"center",padding:"13px 14px",border:0,borderBottom:"1px solid #eef1f3",background:"#fff",textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}>
    <div><span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"4px 7px",borderRadius:5,background:isAdmin?"#fff1e8":"#e8f4fd",color:isAdmin?"#c45b18":"#1676b8",fontSize:9,fontWeight:800}}>{type}</span></div>
    <div style={{fontSize:10,fontWeight:700,color:paymentDate?"#263645":"#a0a8ae",whiteSpace:"nowrap"}}>{paymentDate?formatDate(paymentDate):"Not Booked"}</div>
    <div style={{display:"flex",alignItems:"center",gap:9,minWidth:0}}><div style={{width:30,height:30,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:"#e8f4fd",color:"#1676b8",fontSize:9,fontWeight:800}}>{getInitials(customer)}</div><div style={{minWidth:0}}><div style={{fontSize:11,fontWeight:700,color:"#263645",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{customer}</div></div></div>
    <div style={{fontSize:10,color:"#53616b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{deal?.contract_number||deal?.product||"—"}</div>
    <div style={{display:"flex",alignItems:"center",gap:5,color:isAdmin?"#a0a8ae":"#263645",fontSize:10}}>{!isAdmin&&<PoundSterling size={13}/>}<strong>{isAdmin?"—":money(getNetSalesValue(deal))}</strong></div>
    <div style={{fontSize:10,color:isAdmin?"#a0a8ae":surveyCosting===null?"#a0a8ae":"#263645",fontWeight:!isAdmin&&surveyCosting!==null?700:400}}>{isAdmin?"—":surveyCosting===null?"—":surveyCosting.toLocaleString("en-GB")}</div>
    <div style={{display:"flex",alignItems:"center",gap:5,color:"#66737d",fontSize:10}}><MapPin size={13}/><span>{getBranchName(deal)}</span></div>
    <div style={{display:"flex",alignItems:"center",gap:6,color:"#53616b",fontSize:10,minWidth:0}}><UserRound size={13}/><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{getRepName(deal)}</span></div>
    <div style={{fontSize:11,fontWeight:800,color:isAdmin?(adminFee==="query"?"#c45b18":"#1676b8"):commission===null?"#a0a8ae":"#1676b8"}}>{isAdmin?(adminFee==="query"?"query":money(adminFee)):commission===null?"—":money(commission)}</div>
    <div style={{display:"flex",justifyContent:"flex-end",color:"#9aa5ad"}}><ChevronRight size={17}/></div>
  </button>
}
export default function SalesCommission({deals=[],loading=false,setSelected,permissionLevel=0}) {
  const [adminDeals,setAdminDeals]=useState([]),[adminLoading,setAdminLoading]=useState(false),[query,setQuery]=useState(""),[rep,setRep]=useState("all"),[branch,setBranch]=useState("all"),[commissionDate,setCommissionDate]=useState("all")
  useEffect(()=>{let cancelled=false;async function loadAdmin(){if(!supabase)return;setAdminLoading(true);const {data,error}=await supabase.from("deals").select("*").is("admin_fee_paid_out_date",null).not("pipedrive_stage","in","(Decline,Customer Cancelled)").gte("sale_date","2025-01-01").not("admin_fee_received_date","is",null).order("admin_fee_received_date",{ascending:true});if(cancelled)return;if(error){console.error("Error loading admin fee deals:",error);setAdminDeals([])}else setAdminDeals(data||[]);setAdminLoading(false)}loadAdmin();return()=>{cancelled=true}},[])
  const reps=useMemo(()=>Array.from(new Set([...deals,...adminDeals].map(getRepName))).sort((a,b)=>a.localeCompare(b)),[deals,adminDeals])
  const branches=useMemo(()=>Array.from(new Set([...deals,...adminDeals].map(getBranchName))).sort((a,b)=>a.localeCompare(b)),[deals,adminDeals])
  const combined=useMemo(()=>[...deals.filter(deal=>getNetSalesValue(deal)!==0).map(deal=>({deal,type:"COMMS"})),...adminDeals.map(deal=>({deal,type:"ADMIN"}))],[deals,adminDeals])
  const commissionDates=useMemo(()=>Array.from(new Set(combined.map(({deal,type})=>getCommissionDate(deal,type==="ADMIN"?"admin":"commission")).filter(Boolean))).sort((a,b)=>new Date(a)-new Date(b)),[combined])
  const filtered=useMemo(()=>{const search=query.trim().toLowerCase();return combined.filter(({deal,type})=>{const date=getCommissionDate(deal,type==="ADMIN"?"admin":"commission");if(rep!=="all"&&getRepName(deal)!==rep)return false;if(branch!=="all"&&getBranchName(deal)!==branch)return false;if(commissionDate!=="all"&&date!==commissionDate)return false;if(!search)return true;return [deal?.customer_name,deal?.name,deal?.contract_number,deal?.postcode,getRepName(deal),getBranchName(deal),type].filter(Boolean).join(" ").toLowerCase().includes(search)}).sort((a,b)=>{const ad=getCommissionDate(a.deal,a.type==="ADMIN"?"admin":"commission"),bd=getCommissionDate(b.deal,b.type==="ADMIN"?"admin":"commission");if(!ad&&!bd){const branchCompare=getBranchName(a.deal).localeCompare(getBranchName(b.deal));if(branchCompare)return branchCompare;const repCompare=getRepName(a.deal).localeCompare(getRepName(b.deal));if(repCompare)return repCompare;return a.type.localeCompare(b.type)}if(!ad)return 1;if(!bd)return -1;const dateCompare=ad.localeCompare(bd);if(dateCompare)return dateCompare;const branchCompare=getBranchName(a.deal).localeCompare(getBranchName(b.deal));if(branchCompare)return branchCompare;const repCompare=getRepName(a.deal).localeCompare(getRepName(b.deal));if(repCompare)return repCompare;return a.type.localeCompare(b.type)})},[combined,query,rep,branch,commissionDate])
  const totalCommission=filtered.reduce((total,{deal,type})=>total+(type==="COMMS"?(getCommission(deal)??0):0),0),totalAdmin=filtered.reduce((total,{deal,type})=>total+(type==="ADMIN"&&getAdminFee(deal)!=="query"?getAdminFee(deal):0),0),totalNetSalesValue=filtered.reduce((total,{deal,type})=>total+(type==="COMMS"?getNetSalesValue(deal):0),0)
  function handleExport() {
    const rows=filtered.map(({deal,type})=>({
      "Commission Date":(() => { const date=getCommissionDate(deal,type==="ADMIN"?"admin":"commission"); return date?formatDate(date):"Not Booked" })(),
      Type:type,
      "Pipedrive Deal ID":deal?.pipedrive_deal_id||"",
      Customer:deal?.customer_name||deal?.name||"Unnamed customer",
      "Contract Number":deal?.contract_number||"",
      "Net value":type==="COMMS"?getNetSalesValue(deal):null,
      "Admin fee taken":type==="ADMIN"?(deal?.admin_fee_amount??null):null,
      "Survey costing":type==="COMMS"?getSurveyCosting(deal):null,
      Branch:getBranchName(deal),
      Rep:getRepName(deal),
      "Sales Manager":deal?.sales_manager||deal?.primary_sales_manager||"",
      "Branch Manager":deal?.branch_manager||"",
      "Amount Due":type==="ADMIN"?(getAdminFee(deal)==="query"?"query":getAdminFee(deal)):(getCommission(deal)??null)
    }))
    const worksheet=XLSX.utils.json_to_sheet(rows)
    worksheet["!cols"]=[{wch:18},{wch:10},{wch:20},{wch:28},{wch:18},{wch:16},{wch:18},{wch:18},{wch:24},{wch:24},{wch:24},{wch:24},{wch:16}]
    const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,worksheet,"Commissions")
    const datePart=commissionDate!=="all"?commissionDate:new Date().toISOString().slice(0,10)
    XLSX.writeFile(workbook,`Commissions-${datePart}.xlsx`)
  }
  return <section>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",margin:"0 0 18px"}}><h1 style={{margin:0,fontSize:24,fontWeight:800,color:"#263645"}}>Commissions</h1>{Number(permissionLevel)>=4&&<button type="button" onClick={handleExport} style={{display:"inline-flex",alignItems:"center",gap:8,height:40,padding:"0 14px",border:0,borderRadius:8,background:"#1676b8",color:"#fff",fontSize:11,fontWeight:800,cursor:"pointer"}}><Download size={15}/>Export Excel</button>}</div>
    <div style={{display:"flex",alignItems:"stretch",gap:10,marginBottom:16}}>
      <div style={{position:"relative",flex:"1 1 300px",minWidth:160}}><Search size={17} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#94a3b8"}}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search customer, contract, rep or branch..." style={{width:"100%",height:46,boxSizing:"border-box",border:"1px solid #d7dee8",borderRadius:9,padding:"10px 38px",fontSize:12,outline:"none"}}/>{query&&<button type="button" onClick={()=>setQuery("")} style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",border:0,background:"transparent",cursor:"pointer",color:"#64748b"}}><X size={15}/></button>}</div>
      <select value={commissionDate} onChange={e=>setCommissionDate(e.target.value)} style={{height:46,minWidth:165,border:"1px solid #d7dee8",borderRadius:9,background:"#fff",padding:"0 10px",fontSize:11}}><option value="all">All payment dates</option>{commissionDates.map(date=><option key={date} value={date}>{formatDate(date)}</option>)}</select>
      <select value={rep} onChange={e=>setRep(e.target.value)} style={{height:46,minWidth:160,border:"1px solid #d7dee8",borderRadius:9,background:"#fff",padding:"0 10px",fontSize:11}}><option value="all">All sales reps</option>{reps.map(item=><option key={item}>{item}</option>)}</select>
      <select value={branch} onChange={e=>setBranch(e.target.value)} style={{height:46,minWidth:145,border:"1px solid #d7dee8",background:"#fff",borderRadius:9,padding:"0 10px",fontSize:11}}><option value="all">All branches</option>{branches.map(item=><option key={item}>{item}</option>)}</select>
      <div style={{display:"flex",gap:8,flex:"0 0 auto"}}><div style={{minWidth:95,padding:"6px 14px",border:"1px solid #d9e2e8",borderRadius:9,background:"#fff",display:"flex",flexDirection:"column",justifyContent:"center"}}><div style={{fontSize:9,fontWeight:700,color:"#7b8790",textTransform:"uppercase"}}>Items</div><div style={{fontSize:20,fontWeight:800,color:"#263645"}}>{filtered.length}</div></div><div style={{minWidth:135,padding:"6px 14px",border:"1px solid #cfe2ef",borderRadius:9,background:"#f7fbff",display:"flex",flexDirection:"column",justifyContent:"center"}}><div style={{fontSize:9,fontWeight:700,color:"#6d8495",textTransform:"uppercase"}}>Net Sales</div><div style={{fontSize:20,fontWeight:800,color:"#263645"}}>{money(totalNetSalesValue)}</div></div><div style={{minWidth:155,padding:"6px 14px",border:"1px solid #cfe2ef",borderRadius:9,background:"#f7fbff",display:"flex",flexDirection:"column",justifyContent:"center"}}><div style={{fontSize:9,fontWeight:700,color:"#6d8495",textTransform:"uppercase"}}>Commission</div><div style={{fontSize:20,fontWeight:800,color:"#1676b8"}}>{money(totalCommission)}</div></div><div style={{minWidth:120,padding:"6px 14px",border:"1px solid #f1dccb",borderRadius:9,background:"#fffaf6",display:"flex",flexDirection:"column",justifyContent:"center"}}><div style={{fontSize:9,fontWeight:700,color:"#9a765c",textTransform:"uppercase"}}>Admin</div><div style={{fontSize:20,fontWeight:800,color:"#c45b18"}}>{money(totalAdmin)}</div></div></div>
    </div>
    {(loading||adminLoading)?<div style={{padding:35,textAlign:"center",color:"#89939c",fontSize:11,border:"1px solid #e0e5e9",borderRadius:10,background:"#fff"}}>Loading commission data...</div>:!filtered.length?<div style={{padding:40,textAlign:"center",border:"1px solid #e0e5e9",borderRadius:10,background:"#fff",color:"#89939c",fontSize:11}}>No commission or admin records found.</div>:<div style={{border:"1px solid #e0e5e9",borderRadius:10,background:"#fff",overflow:"hidden"}}><div style={{display:"grid",gridTemplateColumns:columns,gap:12,alignItems:"center",padding:"10px 14px",background:"#f3f6f8",borderBottom:"1px solid #e0e5e9",color:"#687782",fontSize:9,fontWeight:800,textTransform:"uppercase"}}><div>Type</div><div>Commission Date</div><div>Customer</div><div>Contract Number</div><div>Net Value</div><div>Survey Costing</div><div>Branch</div><div>Rep</div><div>Amount Due</div><div/></div>{filtered.map(({deal,type})=><DealRow key={`${type}-${deal?.id||deal?.deal_id}`} deal={deal} type={type} setSelected={setSelected}/>)}</div>}
  </section>
}

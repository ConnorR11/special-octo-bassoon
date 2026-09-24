import React, { useMemo, useState } from "react"
import { ChevronRight, MapPin, PoundSterling, Search, UserRound, X } from "lucide-react"
import { formatDate, getInitials, money } from "../utils/formatters"

function getRepName(deal) { return deal?.salesperson || deal?.sales_rep || deal?.rep_name || deal?.rep_allocated || "Unallocated" }
function getBranchName(deal) { return deal?.branch || deal?.branch_name || "Unallocated" }
function getNetSalesValue(deal) {
  const value = deal?.net_value
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}
function getCommission(deal) {
  const value = deal?.estimated_commission_due
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}
function getCommissionDate(deal) {
  const installationStart = deal?.installation_start_date
  if (!installationStart) return null
  const parts = String(installationStart).slice(0, 10).split("-").map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 14))
  if (Number.isNaN(date.getTime())) return null
  const day = date.getUTCDay()
  const daysUntilNextMonday = day === 1 ? 7 : (8 - day) % 7 || 7
  date.setUTCDate(date.getUTCDate() + daysUntilNextMonday)
  return date.toISOString().slice(0, 10)
}

const columns = "1.65fr 1.2fr 1.05fr 1fr 1fr 1fr 30px"

function DealRow({ deal, setSelected }) {
  const customer = deal?.customer_name || deal?.name || "Unnamed customer"
  const commissionDate = getCommissionDate(deal)
  const commission = getCommission(deal)

  return <button type="button" onClick={() => setSelected?.(deal)} style={{width:"100%",display:"grid",gridTemplateColumns:columns,gap:12,alignItems:"center",padding:"13px 14px",border:0,borderBottom:"1px solid #eef1f3",background:"#fff",textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}>
    <div style={{display:"flex",alignItems:"center",gap:9,minWidth:0}}>
      <div style={{width:30,height:30,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:"#e8f4fd",color:"#1676b8",fontSize:9,fontWeight:800}}>{getInitials(customer)}</div>
      <div style={{minWidth:0}}>
        <div style={{fontSize:11,fontWeight:700,color:"#263645",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{customer}</div>
        <div style={{marginTop:3,fontSize:9,color:"#8a959d",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{deal?.contract_number || deal?.product || "No contract number"}</div>
      </div>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:6,color:"#53616b",fontSize:10,minWidth:0}}><UserRound size={13}/><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{getRepName(deal)}</span></div>
    <div style={{fontSize:10,color:commissionDate ? "#53616b" : "#a0a8ae",fontStyle:commissionDate ? "normal" : "italic"}}>{commissionDate ? formatDate(commissionDate) : "Not Started"}</div>
    <div style={{display:"flex",alignItems:"center",gap:5,color:"#263645",fontSize:10}}><PoundSterling size={13}/><strong>{money(getNetSalesValue(deal))}</strong></div>
    <div style={{fontSize:11,fontWeight:800,color:commission === null ? "#a0a8ae" : "#1676b8"}}>{commission === null ? "—" : money(commission)}</div>
    <div style={{display:"flex",alignItems:"center",gap:5,color:"#66737d",fontSize:10}}><MapPin size={13}/><span>{getBranchName(deal)}</span></div>
    <div style={{display:"flex",justifyContent:"flex-end",color:"#9aa5ad"}}><ChevronRight size={17}/></div>
  </button>
}

export default function SalesCommission({ deals=[], loading=false, setSelected }) {
  const [query,setQuery]=useState(""),[rep,setRep]=useState("all"),[branch,setBranch]=useState("all")
  const reps=useMemo(()=>Array.from(new Set(deals.map(getRepName))).sort((a,b)=>a.localeCompare(b)),[deals])
  const branches=useMemo(()=>Array.from(new Set(deals.map(getBranchName))).sort((a,b)=>a.localeCompare(b)),[deals])
  const filtered=useMemo(()=>{
    const search=query.trim().toLowerCase()
    return [...deals].filter(deal=>{
      if(rep!=="all"&&getRepName(deal)!==rep)return false
      if(branch!=="all"&&getBranchName(deal)!==branch)return false
      if(!search)return true
      return [deal?.customer_name,deal?.name,deal?.contract_number,deal?.postcode,getRepName(deal),getBranchName(deal)].filter(Boolean).join(" ").toLowerCase().includes(search)
    }).sort((a,b)=>{
      const ad=getCommissionDate(a), bd=getCommissionDate(b)
      if(!ad&&!bd)return getBranchName(a).localeCompare(getBranchName(b))
      if(!ad)return 1
      if(!bd)return -1
      const dateComparison = new Date(ad)-new Date(bd)
      if(dateComparison)return dateComparison
      const branchComparison=getBranchName(a).localeCompare(getBranchName(b))
      if(branchComparison)return branchComparison
      const customerA=a?.customer_name||a?.name||"Unnamed customer"
      const customerB=b?.customer_name||b?.name||"Unnamed customer"
      return customerA.localeCompare(customerB)
    })
  },[deals,query,rep,branch])
  const totalCommission=filtered.reduce((total,deal)=>total+(getCommission(deal) ?? 0),0)
  const totalNetSalesValue=filtered.reduce((total,deal)=>total+getNetSalesValue(deal),0)

  return <section>
    <div style={{display:"flex",alignItems:"stretch",gap:10,marginBottom:16}}>
      <div style={{position:"relative",flex:"1 1 360px",minWidth:180}}><Search size={17} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#94a3b8"}}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search customer, contract, rep or branch..." style={{width:"100%",height:46,boxSizing:"border-box",border:"1px solid #d7dee8",borderRadius:9,padding:"10px 38px",fontSize:12,outline:"none"}}/>{query&&<button type="button" onClick={()=>setQuery("")} style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",border:0,background:"transparent",cursor:"pointer",color:"#64748b"}}><X size={15}/></button>}</div>
      <select value={rep} onChange={e=>setRep(e.target.value)} style={{height:46,minWidth:160,border:"1px solid #d7dee8",borderRadius:9,background:"#fff",padding:"0 10px",fontSize:11}}><option value="all">All sales reps</option>{reps.map(item=><option key={item}>{item}</option>)}</select>
      <select value={branch} onChange={e=>setBranch(e.target.value)} style={{height:46,minWidth:145,border:"1px solid #d7dee8",borderRadius:9,background:"#fff",padding:"0 10px",fontSize:11}}><option value="all">All branches</option>{branches.map(item=><option key={item}>{item}</option>)}</select>
      <div style={{display:"flex",gap:8,flex:"0 0 auto"}}><div style={{minWidth:95,padding:"6px 14px",border:"1px solid #d9e2e8",borderRadius:9,background:"#fff",display:"flex",flexDirection:"column",justifyContent:"center"}}><div style={{fontSize:9,fontWeight:700,color:"#7b8790",textTransform:"uppercase"}}>Deals</div><div style={{fontSize:20,fontWeight:800,color:"#263645"}}>{filtered.length}</div></div><div style={{minWidth:135,padding:"6px 14px",border:"1px solid #cfe2ef",borderRadius:9,background:"#f7fbff",display:"flex",flexDirection:"column",justifyContent:"center"}}><div style={{fontSize:9,fontWeight:700,color:"#6d8495",textTransform:"uppercase"}}>Net Sales</div><div style={{fontSize:20,fontWeight:800,color:"#263645"}}>{money(totalNetSalesValue)}</div></div><div style={{minWidth:155,padding:"6px 14px",border:"1px solid #cfe2ef",borderRadius:9,background:"#f7fbff",display:"flex",flexDirection:"column",justifyContent:"center"}}><div style={{fontSize:9,fontWeight:700,color:"#6d8495",textTransform:"uppercase"}}>Estimated Commission</div><div style={{fontSize:20,fontWeight:800,color:"#1676b8"}}>{money(totalCommission)}</div></div></div>
    </div>
    {loading?<div style={{padding:35,textAlign:"center",color:"#89939c",fontSize:11,border:"1px solid #e0e5e9",borderRadius:10,background:"#fff"}}>Loading commission data...</div>:!filtered.length?<div style={{padding:40,textAlign:"center",border:"1px solid #e0e5e9",borderRadius:10,background:"#fff",color:"#89939c",fontSize:11}}>No commission records found.</div>:<div style={{border:"1px solid #e0e5e9",borderRadius:10,background:"#fff",overflow:"hidden"}}>
      <div style={{display:"grid",gridTemplateColumns:columns,gap:12,alignItems:"center",padding:"10px 14px",background:"#f3f6f8",borderBottom:"1px solid #e0e5e9",color:"#687782",fontSize:9,fontWeight:800,textTransform:"uppercase"}}><div>Customer</div><div>Sales Rep</div><div>Commission Date</div><div>Net Sales Value</div><div>Estimated Commission Due</div><div>Branch</div><div/></div>
      {filtered.map(deal=><DealRow key={deal?.id||deal?.deal_id} deal={deal} setSelected={setSelected}/>)}
    </div>}
  </section>
}

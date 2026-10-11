import React, { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw, Clock3, Users, Presentation } from "lucide-react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { supabase } from "../lib/supabase"

function secondsLabel(value) {
  const seconds = Math.max(0, Math.round(value || 0))
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`
}

export default function SalesPresenterUsage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [days, setDays] = useState("30")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const since = new Date()
      since.setDate(since.getDate() - Number(days))
      const { data, error: queryError } = await supabase.from("action_runs")
        .select("id,action_type,status,entity_type,entity_id,triggered_by,started_at,completed_at,input_data,output_data")
        .eq("action_type", "sales_presenter")
        .gte("started_at", since.toISOString())
        .order("started_at", { ascending: true })
        .limit(10000)
      if (queryError) throw queryError
      setEvents(data || [])
    } catch (e) { setError(e?.message || "Unable to load presenter usage.") }
    finally { setLoading(false) }
  }, [days])

  useEffect(() => { load() }, [load])

  const analytics = useMemo(() => {
    const sessions = []
    let active = null
    const ordered = [...events].sort((a,b)=>new Date(a.started_at)-new Date(b.started_at))
    for (const event of ordered) {
      const detail = event.input_data || {}
      const output = event.output_data || {}
      const kind = detail.event || output.event || "opened"
      const key = `${event.triggered_by || "unknown"}|${event.entity_id || "unknown"}`
      if (kind === "opened") {
        if (active) sessions.push(active)
        active = { key, user: event.triggered_by || "Unknown", appointment: event.entity_id, customer: detail.customer_name || "", start: new Date(event.started_at).getTime(), end: null, currentPage: 1, pageSeconds: {}, pagesSeen: new Set([1]), closed: false }
      } else if (active && active.key === key) {
        const now = new Date(event.started_at).getTime()
        if (active.currentPage) active.pageSeconds[active.currentPage] = (active.pageSeconds[active.currentPage] || 0) + Math.max(0, Math.min(3600, (now - active.lastEventTime) / 1000 || 0))
        active.lastEventTime = now
        if (kind === "page_changed") {
          active.currentPage = Number(detail.to_page || output.to_page || active.currentPage)
          active.pagesSeen.add(active.currentPage)
        } else if (kind === "closed") { active.end = now; active.closed = true; sessions.push(active); active = null }
      }
      if (active && !active.lastEventTime) active.lastEventTime = new Date(event.started_at).getTime()
    }
    if (active) { active.end = Date.now(); sessions.push(active) }
    const byPage = {}
    let totalSeconds = 0
    for (const session of sessions) {
      for (const [p, sec] of Object.entries(session.pageSeconds)) {
        byPage[p] ||= { page: Number(p), total: 0, sessions: 0 }
        byPage[p].total += sec; byPage[p].sessions++
        totalSeconds += sec
      }
    }
    let running = 0
    const chart = Object.values(byPage).sort((a,b)=>a.page-b.page).map(item => {
      running += item.total
      return { page: `Page ${item.page}`, pageNumber: item.page, totalSeconds: Math.round(item.total), cumulativeSeconds: Math.round(running), averageSeconds: Math.round(item.total / Math.max(1,item.sessions)), sessions: item.sessions }
    })
    const closedSessions = sessions.filter(s=>s.closed)
    const durations = closedSessions.map(s=>Object.values(s.pageSeconds).reduce((sum,n)=>sum+n,0))
    return { sessions, chart, totalSeconds, sessionCount:sessions.length, closedCount:closedSessions.length, averageSeconds:durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:0, users:new Set(sessions.map(s=>s.user)).size }
  }, [events])

  return <div style={{display:"grid",gap:18}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <div><h2 style={{margin:0,fontSize:20,color:"#0f172a"}}>Sales Presenter Usage</h2><p style={{margin:"5px 0 0",fontSize:12,color:"#64748b"}}>Page navigation and time spent, based on recorded presenter actions.</p></div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}><select value={days} onChange={e=>setDays(e.target.value)} style={control}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option></select><button onClick={load} style={refresh}><RefreshCw size={14}/>Refresh</button></div>
    </div>
    {error&&<div style={{padding:12,borderRadius:8,background:"#fef2f2",color:"#b91c1c",fontSize:13}}>{error}</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12}}>
      <Metric icon={<Presentation size={17}/>} label="Presenter sessions" value={analytics.sessionCount}/>
      <Metric icon={<Users size={17}/>} label="Team members" value={analytics.users}/>
      <Metric icon={<Clock3 size={17}/>} label="Average time per closed session" value={secondsLabel(analytics.averageSeconds)}/>
      <Metric icon={<Clock3 size={17}/>} label="Recorded page time" value={secondsLabel(analytics.totalSeconds)}/>
    </div>
    <section style={panel}><h3 style={heading}>Running total of time by page</h3><p style={sub}>Cumulative seconds recorded across presenter sessions, in page order. Average page time is shown in the table below.</p>{loading?<p>Loading usage…</p>:analytics.chart.length?<div style={{width:"100%",height:330}}><ResponsiveContainer><LineChart data={analytics.chart} margin={{top:12,right:24,left:8,bottom:8}}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="page"/><YAxis tickFormatter={secondsLabel}/><Tooltip formatter={(value,name)=>[secondsLabel(value),name==="cumulativeSeconds"?"Running total":"Time on page"]}/><Line type="monotone" dataKey="cumulativeSeconds" name="Running total" stroke="#0284c7" strokeWidth={3} dot={{r:3}} activeDot={{r:5}}/></LineChart></ResponsiveContainer></div>:<p style={sub}>No page-time data recorded in this period yet. Time tracking starts with presenter events logged by the updated CRM.</p>}</section>
    <section style={panel}><h3 style={heading}>Average time per page</h3><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr>{["Page","Total time","Average time","Recorded visits"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{analytics.chart.map(row=><tr key={row.pageNumber}><td style={td}>{row.page}</td><td style={td}>{secondsLabel(row.totalSeconds)}</td><td style={td}>{secondsLabel(row.averageSeconds)}</td><td style={td}>{row.sessions}</td></tr>)}</tbody></table></div></section>
    <section style={panel}><h3 style={heading}>Recent sessions</h3><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr>{["Customer / appointment","Team member","Opened","Status","Pages visited","Time recorded"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{analytics.sessions.slice().reverse().slice(0,100).map((s,i)=><tr key={i}><td style={td}>{s.customer||s.appointment||"Appointment"}</td><td style={td}>{s.user}</td><td style={td}>{new Date(s.start).toLocaleString("en-GB")}</td><td style={td}>{s.closed?"Closed":"Open / no close event"}</td><td style={td}>{s.pagesSeen.size}</td><td style={td}>{secondsLabel(Object.values(s.pageSeconds).reduce((a,b)=>a+b,0))}</td></tr>)}</tbody></table></div></section>
  </div>
}
function Metric({icon,label,value}) { return <div style={{border:"1px solid #e2e8f0",borderRadius:10,padding:15,background:"#fff"}}><div style={{display:"flex",gap:8,alignItems:"center",color:"#0284c7",fontSize:12,fontWeight:700}}>{icon}{label}</div><div style={{fontSize:25,fontWeight:800,color:"#0f172a",marginTop:9}}>{value}</div></div> }
const panel={border:"1px solid #e2e8f0",borderRadius:12,padding:16,background:"#fff"}
const heading={fontSize:15,margin:"0 0 6px",color:"#0f172a"}
const sub={fontSize:12,color:"#64748b",margin:"0 0 14px"}
const th={textAlign:"left",padding:"10px 8px",borderBottom:"1px solid #cbd5e1",color:"#475569",whiteSpace:"nowrap"}
const td={padding:"10px 8px",borderBottom:"1px solid #e2e8f0",color:"#334155"}
const control={padding:"8px 10px",border:"1px solid #cbd5e1",borderRadius:7,background:"#fff",fontSize:12}
const refresh={display:"inline-flex",gap:7,alignItems:"center",padding:"8px 11px",border:"1px solid #cbd5e1",borderRadius:7,background:"#fff",cursor:"pointer",fontSize:12}

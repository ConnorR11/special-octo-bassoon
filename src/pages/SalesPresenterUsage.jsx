import React, { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw, Clock3, Users, Presentation } from "lucide-react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts"
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
  const [selectedUser, setSelectedUser] = useState("all")

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

  const availableUsers = useMemo(() => [...new Set(events.map(event => event.triggered_by).filter(Boolean))].sort(), [events])

  const analytics = useMemo(() => {
    const sessions = []
    const activeSessions = new Map()
    const filteredEvents = selectedUser === "all" ? events : events.filter(event => event.triggered_by === selectedUser)
    const ordered = [...filteredEvents].sort((a,b)=>new Date(a.started_at)-new Date(b.started_at))
    for (const event of ordered) {
      const detail = event.input_data || {}
      const output = event.output_data || {}
      const kind = detail.event || output.event || "opened"
      const appointment = String(event.entity_id || "unknown")
      const user = event.triggered_by || "Unknown"
      const key = `${user}|${appointment}`
      const now = new Date(event.started_at).getTime()
      let active = activeSessions.get(key)
      if (kind === "opened") {
        if (active) {
          active.end = now
          sessions.push(active)
        }
        active = {
          key, appointment, user, customer: detail.customer_name || "", start: now, end: null,
          currentPage: 1, pageSeconds: {}, pagesSeen: new Set([1]), closed: false,
          lastEventTime: now, closePage: null
        }
        activeSessions.set(key, active)
        continue
      }
      if (!active) continue
      if (active.currentPage) {
        active.pageSeconds[active.currentPage] = (active.pageSeconds[active.currentPage] || 0) +
          Math.max(0, Math.min(3600, (now - active.lastEventTime) / 1000 || 0))
      }
      active.lastEventTime = now
      if (kind === "page_changed") {
        active.currentPage = Number(detail.to_page || output.to_page || active.currentPage)
        active.pagesSeen.add(active.currentPage)
      } else if (kind === "closed") {
        active.end = now
        active.closed = true
        active.closePage = active.currentPage
        sessions.push(active)
        activeSessions.delete(key)
      }
    }
    for (const [key, active] of activeSessions) {
      active.end = Date.now()
      sessions.push(active)
    }

    const byPage = {}
    const appointmentGroups = new Map()
    let totalSeconds = 0
    for (const session of sessions) {
      const appointmentKey = session.appointment
      if (!appointmentGroups.has(appointmentKey)) {
        appointmentGroups.set(appointmentKey, {
          key: `appointment_${appointmentGroups.size}`,
          appointment: appointmentKey,
          label: session.customer || `Appointment ${appointmentKey === "unknown" ? "unknown" : appointmentKey.slice(0, 8)}`,
          pageValues: {}
        })
      }
      const group = appointmentGroups.get(appointmentKey)
      if (!group.label || group.label.startsWith("Appointment ")) {
        if (session.customer) group.label = session.customer
      }
      let sessionRunning = 0
      for (const p of [...session.pagesSeen].sort((a,b)=>a-b)) {
        const sec = Number(session.pageSeconds[p] || 0)
        sessionRunning += sec
        byPage[p] ||= { page: `Page ${p}`, pageNumber: Number(p), total: 0, visits: 0, cumulativeTotal: 0, cumulativeVisits: 0, closeCount: 0 }
        byPage[p].total += sec
        byPage[p].visits++
        byPage[p].cumulativeTotal += sessionRunning
        byPage[p].cumulativeVisits++
        group.pageValues[p] ||= { total: 0, visits: 0 }
        group.pageValues[p].total += sessionRunning
        group.pageValues[p].visits++
        totalSeconds += sec
      }
      if (session.closed && session.closePage) byPage[session.closePage] && byPage[session.closePage].closeCount++
    }
    const appointments = [...appointmentGroups.values()].map(group => ({
      ...group,
      dataKey: group.key,
    }))
    const chart = Object.values(byPage).sort((a,b)=>a.pageNumber-b.pageNumber).map(item => {
      const row = {
        ...item,
        totalSeconds: Math.round(item.total),
        cumulativeSeconds: Math.round(item.cumulativeTotal / Math.max(1,item.cumulativeVisits)),
        averageSeconds: Math.round(item.total / Math.max(1,item.visits)),
        sessions: item.visits,
      }
      for (const appointment of appointments) {
        const value = appointment.pageValues[item.pageNumber]
        row[appointment.dataKey] = value ? Math.round(value.total / Math.max(1,value.visits)) : null
      }
      return row
    })
    const closedSessions = sessions.filter(s=>s.closed)
    const durations = closedSessions.map(s=>Object.values(s.pageSeconds).reduce((sum,n)=>sum+n,0))
    const fullSessions = sessions.filter(s=>s.pagesSeen.has(30))
    const fullDurations = fullSessions.map(s=>Object.values(s.pageSeconds).reduce((sum,n)=>sum+n,0))
    return {
      sessions, chart, appointments, totalSeconds, sessionCount:sessions.length,
      closedCount:closedSessions.length,
      averageSeconds:fullDurations.length ? fullDurations.reduce((a,b)=>a+b,0)/fullDurations.length :
        (durations.length ? durations.reduce((a,b)=>a+b,0)/durations.length : 0),
      users:new Set(sessions.map(s=>s.user)).size
    }
  }, [events, selectedUser])

  return <div style={{display:"grid",gap:18}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <div><h2 style={{margin:0,fontSize:20,color:"#0f172a"}}>Sales Presenter Usage</h2><p style={{margin:"5px 0 0",fontSize:12,color:"#64748b"}}>Page navigation and time spent, based on recorded presenter actions.</p></div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}><select aria-label="Filter by team member" value={selectedUser} onChange={e=>setSelectedUser(e.target.value)} style={control}><option value="all">All team members</option>{availableUsers.map(user=><option key={user} value={user}>{user}</option>)}</select><select value={days} onChange={e=>setDays(e.target.value)} style={control}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option></select><button onClick={load} style={refresh}><RefreshCw size={14}/>Refresh</button></div>
    </div>
    {error&&<div style={{padding:12,borderRadius:8,background:"#fef2f2",color:"#b91c1c",fontSize:13}}>{error}</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12}}>
      <Metric icon={<Presentation size={17}/>} label="Presenter sessions" value={analytics.sessionCount}/>
      <Metric icon={<Users size={17}/>} label="Team members" value={analytics.users}/>
      <Metric icon={<Clock3 size={17}/>} label="Average time through presenter" value={secondsLabel(analytics.averageSeconds)}/>
      <Metric icon={<Clock3 size={17}/>} label="Recorded page time" value={secondsLabel(analytics.totalSeconds)}/>
    </div>
    <section style={panel}><h3 style={heading}>Average time through the presenter</h3><p style={sub}>Each line represents a unique appointment and shows its average elapsed time to reach each page. Red markers show where the presenter was closed.</p>{loading?<p>Loading usage…</p>:analytics.chart.length?<div style={{width:"100%",height:330}}><ResponsiveContainer><LineChart data={analytics.chart} margin={{top:12,right:24,left:8,bottom:8}}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="page"/><YAxis tickFormatter={secondsLabel}/><Tooltip content={({active,payload,label})=>{if(!active||!payload?.length)return null;const point=payload[0]?.payload||{};return <div style={{background:"#fff",border:"1px solid #cbd5e1",borderRadius:8,padding:"10px 12px",boxShadow:"0 4px 14px rgba(15,23,42,.12)",fontSize:12,color:"#0f172a"}}><div style={{fontWeight:700,marginBottom:7}}>{label}</div><div style={{marginBottom:5}}>Total time on page: <b>{secondsLabel(point.totalSeconds)}</b></div><div>Average elapsed time to this page: <b>{secondsLabel(point.cumulativeSeconds)}</b></div>{point.openCount>0&&<div style={{color:"#16a34a",fontWeight:700,marginTop:5}}>Presenter opened: {point.openCount}</div>}{point.closeCount>0&&<div style={{color:"#dc2626",fontWeight:700,marginTop:3}}>Presenter closed: {point.closeCount}</div>}</div>}}/>{analytics.appointments.map((appointment,index)=><Line key={appointment.dataKey} type="monotone" dataKey={appointment.dataKey} name={appointment.label} connectNulls={false} stroke={["#0284c7","#16a34a","#9333ea","#ea580c","#db2777","#0891b2","#65a30d","#7c3aed"][index%8]} strokeWidth={2} dot={{r:2}} activeDot={{r:4}}/>)}<Scatter dataKey="closeMarker" name="Presenter closed" fill="#dc2626" shape={(props)=>props.payload.closeCount>0?<circle cx={props.cx} cy={props.cy} r={7} fill="#dc2626" stroke="#fff" strokeWidth={2}/>:null}/></LineChart></ResponsiveContainer></div>:<p style={sub}>No page-time data recorded in this period yet. Time tracking starts with presenter events logged by the updated CRM.</p>}</section>
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

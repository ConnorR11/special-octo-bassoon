import React from "react"
import { Menu, ChevronDown, ChevronRight } from "lucide-react"
import { supabase } from "../lib/supabase"

export default function IntegrationLogs({ setMobile }) {
  const [logs, setLogs] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [status, setStatus] = React.useState("all")
  const [provider, setProvider] = React.useState("all")
  const [expandedId, setExpandedId] = React.useState(null)
  const [runStats, setRunStats] = React.useState({ total: 0, success: 0, failed: 0, received: 0, ignored: 0 })
  const [chartLogs, setChartLogs] = React.useState([])

  React.useEffect(() => { loadLogs() }, [status, provider])
  React.useEffect(() => { loadStats(); loadChartLogs() }, [provider])

  async function loadLogs() {
    setLoading(true)
    let q = supabase.from("integration_event_logs").select("*").order("received_at", { ascending: false }).limit(200)
    if (status !== "all") q = q.eq("status", status)
    if (provider !== "all") q = q.eq("provider", provider)
    const { data, error } = await q
    setLogs(error ? [] : (data || []))
    setLoading(false)
  }

  async function loadStats() {
    const make = (s) => {
      let q = supabase.from("integration_event_logs").select("id", { count: "exact", head: true })
      if (s) q = q.eq("status", s)
      if (provider !== "all") q = q.eq("provider", provider)
      return q
    }
    const [total, success, failed, received, ignored] = await Promise.all([
      make(null), make("success"), make("failed"), make("received"), make("ignored")
    ])
    setRunStats({
      total: total.count || 0,
      success: success.count || 0,
      failed: failed.count || 0,
      received: received.count || 0,
      ignored: ignored.count || 0,
    })
  }

  async function loadChartLogs() {
    let q = supabase.from("integration_event_logs").select("received_at,status,provider").order("received_at", { ascending: true })
    if (provider !== "all") q = q.eq("provider", provider)
    const { data, error } = await q
    setChartLogs(error ? [] : (data || []))
  }

  const providers = [...new Set(logs.map((l) => l.provider).filter(Boolean))]
  const successRate = runStats.total ? (runStats.success / runStats.total) * 100 : 0

  const dailyData = React.useMemo(() => {
    const map = new Map()
    chartLogs.forEach((log) => {
      if (!log.received_at) return
      const d = new Date(log.received_at)
      if (Number.isNaN(d.getTime())) return
      const key = d.toISOString().slice(0, 10)
      if (!map.has(key)) map.set(key, { date: key, total: 0, success: 0 })
      const row = map.get(key)
      row.total++
      if (log.status === "success") row.success++
    })
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date)).map((row) => ({
      ...row,
      rate: row.total ? (row.success / row.total) * 100 : 0,
    }))
  }, [chartLogs])

  const chart = React.useMemo(() => {
    if (!dailyData.length) return null
    const width = 1000, height = 360, left = 62, right = 62, top = 28, bottom = 52
    const plotW = width - left - right, plotH = height - top - bottom
    const maxRuns = Math.max(1, ...dailyData.map((d) => d.total))
    const x = (i) => dailyData.length === 1 ? left + plotW / 2 : left + i / (dailyData.length - 1) * plotW
    const yRuns = (v) => top + plotH - v / maxRuns * plotH
    const yRate = (v) => top + plotH - v / 100 * plotH
    const points = dailyData.map((d, i) => ({ ...d, x: x(i), yRuns: yRuns(d.total), yRate: yRate(d.rate) }))
    const volumePath = points.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.yRuns.toFixed(1)}`).join(" ")
    const volumeArea = `${volumePath} L ${points.at(-1).x.toFixed(1)} ${top + plotH} L ${points[0].x.toFixed(1)} ${top + plotH} Z`
    const ratePath = points.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.yRate.toFixed(1)}`).join(" ")
    return { width, height, left, right, top, bottom, plotW, plotH, maxRuns, points, volumePath, volumeArea, ratePath, yRuns }
  }, [dailyData])

  function toggleRow(id) {
    setExpandedId((current) => current === id ? null : id)
  }

  return <div className="integration-logs-page">
    <style>{`
      .integration-logs-page{box-sizing:border-box;padding:28px;background:#f5f7fa;min-height:100vh;width:100%;color:#102a43}
      .integration-logs-container{max-width:1500px;margin:auto}
      .integration-logs-mobile-menu{display:none;position:fixed;top:12px;left:12px;z-index:1100;width:44px;height:44px;border:1px solid #d0d5dd;border-radius:9px;background:#fff;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.12)}
      .integration-logs-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:24px}
      .integration-logs-refresh,.integration-logs-select{padding:9px 12px;border:1px solid #d0d5dd;border-radius:8px;background:#fff}
      .integration-logs-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px}
      .integration-logs-stat,.integration-logs-chart-card,.integration-logs-table-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px}
      .integration-logs-stat-value{margin-top:6px;font-size:26px;font-weight:700}.integration-logs-stat-label{font-size:13px;color:#667085}.integration-logs-stat-sub{font-size:12px;color:#667085;margin-top:4px}.integration-logs-chart-card{margin-bottom:20px}
      .run-chart-wrap{width:100%;overflow-x:auto}.run-chart-svg{display:block;width:100%;min-width:680px}.run-chart-grid{stroke:#eaecf0;stroke-width:1}.run-chart-axis{fill:#667085;font-size:12px}.run-volume-fill{fill:#175cd3;fill-opacity:.13}.run-volume-line{fill:none;stroke:#175cd3;stroke-width:2.5}.run-rate-line{fill:none;stroke:#12b76a;stroke-width:3}.run-chart-dot{stroke:#fff;stroke-width:1.5}.run-chart-legend{display:flex;gap:20px;flex-wrap:wrap;margin-top:10px;font-size:12px;color:#475467}.legend-item{display:flex;align-items:center;gap:7px}.legend-dot{width:10px;height:10px;border-radius:50%;display:inline-block}
      .integration-logs-table-header{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:16px}.integration-logs-filters{display:flex;gap:8px}.integration-logs-table-wrap{overflow-x:auto}.integration-logs-table{width:100%;min-width:950px;border-collapse:collapse}.integration-logs-table th,.integration-logs-table td{text-align:left;padding:10px;border-bottom:1px solid #eee;font-size:13px;white-space:nowrap}.integration-logs-table th{font-size:12px;color:#667085}
      .integration-logs-row{cursor:pointer;transition:background .15s}.integration-logs-row:hover{background:#f8fafc}.integration-logs-row.expanded{background:#f8fafc}.integration-logs-chevron{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;margin-right:4px;color:#667085;vertical-align:middle}
      .integration-logs-detail-row td{padding:0 12px 16px 42px;background:#f8fafc;border-bottom:1px solid #e5e7eb;white-space:normal}.integration-logs-detail{display:grid;grid-template-columns:minmax(180px,1fr) minmax(180px,1fr);gap:14px;padding-top:4px}.integration-logs-detail-card{background:#fff;border:1px solid #e4e7ec;border-radius:9px;padding:12px}.integration-logs-detail-card.full{grid-column:1/-1}.integration-logs-detail-label{font-size:11px;font-weight:700;color:#667085;text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px}.integration-logs-detail-value{font-size:12px;color:#344054}.integration-logs-json{margin:0;padding:12px;background:#101828;color:#d0d5dd;border-radius:7px;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;white-space:pre-wrap;word-break:break-word;max-height:360px;overflow:auto}.integration-logs-error{color:#b42318}.integration-logs-empty{padding:50px;text-align:center;color:#667085}
      @media(max-width:900px){.integration-logs-page{padding:20px}.integration-logs-mobile-menu{display:flex}.integration-logs-header{padding-left:58px;flex-direction:column}.integration-logs-stats{grid-template-columns:repeat(2,1fr)}.integration-logs-detail{grid-template-columns:1fr}}
      @media(max-width:600px){.integration-logs-page{padding:14px}.integration-logs-header{padding-left:56px}.integration-logs-stats{gap:10px}.integration-logs-stat{padding:14px}.integration-logs-chart-card,.integration-logs-table-card{padding:14px}.integration-logs-filters{display:grid;grid-template-columns:1fr 1fr;width:100%}.integration-logs-select{width:100%}.integration-logs-detail-row td{padding-left:16px}}
    `}</style>

    {setMobile && <button className="integration-logs-mobile-menu" onClick={() => setMobile((v) => !v)} aria-label="Open menu"><Menu size={22}/></button>}

    <div className="integration-logs-container">
      <div className="integration-logs-header">
        <div><div style={{fontSize:12,fontWeight:700,color:"#667085",letterSpacing:1}}>ADMINISTRATION</div><h1 style={{margin:"5px 0 0",fontSize:28}}>API & Webhooks</h1><p style={{margin:"6px 0 0",color:"#667085"}}>Monitor API calls and webhook events across CRM integrations.</p></div>
        <button className="integration-logs-refresh" onClick={() => { loadLogs(); loadStats(); loadChartLogs() }}>Refresh</button>
      </div>

      <div className="integration-logs-stats"><Stat title="Total Runs" value={runStats.total.toLocaleString("en-GB")}/><Stat title="Successful" value={runStats.success.toLocaleString("en-GB")}/><Stat title="Failed" value={runStats.failed.toLocaleString("en-GB")}/><Stat title="Success Rate" value={`${successRate.toFixed(1)}%`} subtitle={`${runStats.received.toLocaleString("en-GB")} processing · ${runStats.ignored.toLocaleString("en-GB")} ignored`}/></div>

      <div className="integration-logs-chart-card">
        <div style={{display:"flex",justifyContent:"space-between",gap:16,marginBottom:14,flexWrap:"wrap"}}><div><h2 style={{margin:0,fontSize:18}}>Run Volume & Success Rate</h2><p style={{margin:"4px 0 0",color:"#667085",fontSize:13}}>Daily API run volume with daily success rate.</p></div><div style={{fontSize:13,color:"#667085"}}>Overall success rate: <strong>{successRate.toFixed(1)}%</strong></div></div>
        {!chart ? <div className="integration-logs-empty">No runs available to chart.</div> : <div className="run-chart-wrap"><svg className="run-chart-svg" viewBox={`0 0 ${chart.width} ${chart.height}`} preserveAspectRatio="none">{Array.from({length:6},(_,i)=>{const value=chart.maxRuns/5*i,y=chart.yRuns(value);return <g key={i}><line x1={chart.left} x2={chart.width-chart.right} y1={y} y2={y} className="run-chart-grid"/><text x={chart.left-10} y={y+4} textAnchor="end" className="run-chart-axis">{Math.round(value).toLocaleString("en-GB")}</text><text x={chart.width-chart.right+10} y={y+4} className="run-chart-axis">{Math.round(i*20)}%</text></g>})}<path d={chart.volumeArea} className="run-volume-fill"/><path d={chart.volumePath} className="run-volume-line"/><path d={chart.ratePath} className="run-rate-line"/>{chart.points.map(p=><g key={p.date}><circle cx={p.x} cy={p.yRuns} r="4" className="run-chart-dot" fill="#175cd3"><title>{p.date}: {p.total} runs</title></circle><circle cx={p.x} cy={p.yRate} r="4" className="run-chart-dot" fill="#12b76a"><title>{p.date}: {p.rate.toFixed(1)}% success rate</title></circle></g>)}{chart.points.map((p,i)=>(i===0||i===chart.points.length-1||i%Math.max(1,Math.ceil(chart.points.length/8))===0)?<text key={p.date} x={p.x} y={chart.height-16} textAnchor="middle" className="run-chart-axis">{new Date(`${p.date}T00:00:00`).toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}</text>:null)}</svg><div className="run-chart-legend"><span className="legend-item"><span className="legend-dot" style={{background:"#175cd3"}}/>Run volume</span><span className="legend-item"><span className="legend-dot" style={{background:"#12b76a"}}/>Success rate %</span><span>Blue area uses the left axis; green line uses the right 0–100% axis.</span></div></div>}
      </div>

      <div className="integration-logs-table-card">
        <div className="integration-logs-table-header"><div><h2 style={{margin:0,fontSize:18}}>Integration Activity</h2><p style={{margin:"4px 0 0",color:"#667085",fontSize:13}}>Latest inbound and outbound integration events. Click a run to inspect its details.</p></div><div className="integration-logs-filters"><select value={provider} onChange={e=>setProvider(e.target.value)} className="integration-logs-select"><option value="all">All Providers</option>{providers.map(p=><option key={p} value={p}>{p}</option>)}</select><select value={status} onChange={e=>setStatus(e.target.value)} className="integration-logs-select"><option value="all">All Statuses</option><option value="success">Success</option><option value="failed">Failed</option><option value="received">Processing</option><option value="ignored">Ignored</option></select></div></div>

        {loading ? <div className="integration-logs-empty">Loading integration activity…</div> : !logs.length ? <div className="integration-logs-empty">No integration events found.</div> : <div className="integration-logs-table-wrap"><table className="integration-logs-table"><thead><tr><th></th>{["Time","Provider","Integration","Direction","Event","External ID","Status","HTTP"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{logs.map(log => {
          const expanded = expandedId === log.id
          return <React.Fragment key={log.id}>
            <tr className={`integration-logs-row ${expanded ? "expanded" : ""}`} onClick={() => toggleRow(log.id)} aria-expanded={expanded}>
              <td><span className="integration-logs-chevron">{expanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}</span></td>
              <td>{formatDate(log.received_at)}</td><td>{log.provider||"—"}</td><td>{log.integration_name||"—"}</td><td>{log.direction||"—"}</td><td>{log.event_name||log.event_type||"—"}</td><td>{log.external_id||"—"}</td><td><StatusBadge status={log.status}/></td><td>{log.http_status||"—"}</td>
            </tr>
            {expanded && <tr className="integration-logs-detail-row"><td colSpan={9}><RunDetails log={log}/></td></tr>}
          </React.Fragment>
        })}</tbody></table></div>}
      </div>
    </div>
  </div>
}

function RunDetails({ log }) {
  return <div className="integration-logs-detail">
    <DetailCard label="Run ID" value={log.id || "—"}/>
    <DetailCard label="Event Type" value={log.event_type || "—"}/>
    <DetailCard label="Received" value={formatDate(log.received_at)}/>
    <DetailCard label="Processed" value={formatDate(log.processed_at)}/>
    {log.error_message && <div className="integration-logs-detail-card full"><div className="integration-logs-detail-label">Error</div><div className="integration-logs-detail-value integration-logs-error">{log.error_message}</div></div>}
    <JsonCard label="Payload" value={log.payload}/>
    <JsonCard label="Result" value={log.result}/>
  </div>
}

function DetailCard({ label, value }) { return <div className="integration-logs-detail-card"><div className="integration-logs-detail-label">{label}</div><div className="integration-logs-detail-value">{value}</div></div> }

function JsonCard({ label, value }) {
  const hasValue = value !== null && value !== undefined && value !== ""
  return <div className="integration-logs-detail-card"><div className="integration-logs-detail-label">{label}</div><pre className="integration-logs-json">{hasValue ? JSON.stringify(value, null, 2) : "No data recorded"}</pre></div>
}

function Stat({ title, value, subtitle = "" }) { return <div className="integration-logs-stat"><div className="integration-logs-stat-label">{title}</div><div className="integration-logs-stat-value">{value}</div>{subtitle && <div className="integration-logs-stat-sub">{subtitle}</div>}</div> }

function StatusBadge({ status }) {
  const labels = { success: "Success", failed: "Failed", received: "Processing", ignored: "Ignored" }
  return <span style={{display:"inline-flex",padding:"4px 8px",borderRadius:999,fontSize:12,fontWeight:700,background:status==="success"?"#ecfdf3":status==="failed"?"#fef3f2":status==="received"?"#fffaeb":"#f2f4f7",color:status==="success"?"#027a48":status==="failed"?"#b42318":status==="received"?"#b54708":"#475467"}}>{labels[status]||status||"Unknown"}</span>
}

function formatDate(value) { return value ? new Date(value).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : "—" }

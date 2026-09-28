import React from "react"
import { Menu } from "lucide-react"
import { supabase } from "../lib/supabase"

export default function IntegrationLogs({ setMobile }) {
  const [logs, setLogs] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [status, setStatus] = React.useState("all")
  const [provider, setProvider] = React.useState("all")
  const [runStats, setRunStats] = React.useState({ total: 0, success: 0, failed: 0, received: 0, ignored: 0, unknown: 0 })
  const [allChartLogs, setAllChartLogs] = React.useState([])

  React.useEffect(() => { loadLogs() }, [status, provider])
  React.useEffect(() => { loadRunStats(); loadChartLogs() }, [provider])

  async function loadLogs() {
    setLoading(true)
    let query = supabase.from("integration_event_logs").select("*").order("received_at", { ascending: false }).limit(200)
    if (status !== "all") query = query.eq("status", status)
    if (provider !== "all") query = query.eq("provider", provider)
    const { data, error } = await query
    if (error) { console.error("Error loading integration logs:", error); setLogs([]) } else setLogs(data || [])
    setLoading(false)
  }

  async function loadRunStats() {
    const statuses = ["success", "failed", "received", "ignored"]
    const baseQuery = () => {
      let query = supabase.from("integration_event_logs").select("id", { count: "exact", head: true })
      if (provider !== "all") query = query.eq("provider", provider)
      return query
    }
    try {
      const [totalResult, ...statusResults] = await Promise.all([baseQuery(), ...statuses.map((item) => { let query = supabase.from("integration_event_logs").select("id", { count: "exact", head: true }).eq("status", item); if (provider !== "all") query = query.eq("provider", provider); return query })])
      const total = totalResult.count || 0
      const success = statusResults[0].count || 0
      const failed = statusResults[1].count || 0
      const received = statusResults[2].count || 0
      const ignored = statusResults[3].count || 0
      setRunStats({ total, success, failed, received, ignored, unknown: Math.max(0, total - success - failed - received - ignored) })
    } catch (error) { console.error("Error loading integration run statistics:", error); setRunStats({ total: 0, success: 0, failed: 0, received: 0, ignored: 0, unknown: 0 }) }
  }

  async function loadChartLogs() {
    let query = supabase.from("integration_event_logs").select("received_at,status,provider").order("received_at", { ascending: true })
    if (provider !== "all") query = query.eq("provider", provider)
    const { data, error } = await query
    if (error) { console.error("Error loading chart data:", error); setAllChartLogs([]) } else setAllChartLogs(data || [])
  }

  const successful = runStats.success
  const failed = runStats.failed
  const received = runStats.received
  const ignored = runStats.ignored
  const totalRuns = runStats.total
  const successRate = totalRuns ? (successful / totalRuns) * 100 : 0
  const providers = [...new Set(logs.map((log) => log.provider).filter(Boolean))]

  const dailyData = React.useMemo(() => {
    const map = new Map()
    allChartLogs.forEach((log) => {
      if (!log.received_at) return
      const date = new Date(log.received_at)
      if (Number.isNaN(date.getTime())) return
      const key = date.toISOString().slice(0, 10)
      if (!map.has(key)) map.set(key, { date: key, success: 0, failed: 0, received: 0, ignored: 0, other: 0 })
      const row = map.get(key)
      if (log.status === "success") row.success++
      else if (log.status === "failed") row.failed++
      else if (log.status === "received") row.received++
      else if (log.status === "ignored") row.ignored++
      else row.other++
    })
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [allChartLogs])

  const areaChart = React.useMemo(() => {
    if (!dailyData.length) return null
    const width = 1000, height = 330, left = 62, right = 24, top = 24, bottom = 52
    const plotW = width - left - right, plotH = height - top - bottom
    const maxTotal = Math.max(1, ...dailyData.map((d) => d.success + d.failed + d.received + d.ignored + d.other))
    const yTicks = 5
    const x = (i) => dailyData.length === 1 ? left + plotW / 2 : left + (i / (dailyData.length - 1)) * plotW
    const y = (value) => top + plotH - (value / maxTotal) * plotH
    const points = dailyData.map((d, i) => ({ ...d, total: d.success + d.failed + d.received + d.ignored + d.other, x: x(i) }))
    const path = points.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${y(p.total).toFixed(1)}`).join(" ")
    const areaPath = `${path} L ${points[points.length - 1].x.toFixed(1)} ${(top + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(top + plotH).toFixed(1)} Z`
    return { width, height, left, right, top, bottom, plotW, plotH, maxTotal, yTicks, points, path, areaPath, y }
  }, [dailyData])

  return (
    <div className="integration-logs-page">
      <style>{`
        .integration-logs-page{box-sizing:border-box;padding:28px;background:#f5f7fa;min-height:100vh;width:100%;color:#102a43}.integration-logs-container{max-width:1500px;margin:0 auto}.integration-logs-mobile-menu{display:none;position:fixed;top:12px;left:12px;z-index:1100;width:44px;height:44px;border:1px solid #d0d5dd;border-radius:9px;background:#fff;color:#344054;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.12);cursor:pointer}.integration-logs-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:24px}.integration-logs-refresh{padding:9px 14px;border:1px solid #d0d5dd;border-radius:8px;background:#fff;cursor:pointer;white-space:nowrap}.integration-logs-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:20px}.integration-logs-stat{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px;min-width:0}.integration-logs-stat-label{font-size:13px;color:#667085}.integration-logs-stat-value{margin-top:6px;font-size:26px;font-weight:700}.integration-logs-stat-sub{margin-top:4px;font-size:12px;color:#667085}.integration-logs-stat-success{border-left:4px solid #12b76a}.integration-logs-stat-failed{border-left:4px solid #f04438}.integration-logs-stat-rate{border-left:4px solid #175cd3}.integration-logs-chart-card,.integration-logs-table-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px}.integration-logs-chart-card{margin-bottom:20px}.integration-logs-chart-header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px}.integration-logs-chart-title{margin:0;font-size:18px}.integration-logs-chart-description{margin:4px 0 0;color:#667085;font-size:13px}.integration-logs-chart-total{font-size:13px;color:#667085;white-space:nowrap}.run-area-wrap{width:100%;overflow-x:auto}.run-area-svg{display:block;width:100%;min-width:680px;height:auto}.run-area-grid{stroke:#eaecf0;stroke-width:1}.run-area-axis{fill:#667085;font-size:12px}.run-area-line{fill:none;stroke:#175cd3;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.run-area-fill{fill:#175cd3;fill-opacity:.14}.run-area-dot{fill:#175cd3}.run-area-tooltip{font-size:12px}.run-area-legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;font-size:12px;color:#475467}.run-area-legend-item{display:flex;align-items:center;gap:6px}.run-area-legend-dot{width:9px;height:9px;border-radius:50%;display:inline-block}.integration-logs-table-header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap}.integration-logs-filters{display:flex;gap:8px;flex-wrap:wrap}.integration-logs-select{padding:8px 10px;border:1px solid #d0d5dd;border-radius:8px;background:#fff}.integration-logs-table-wrap{overflow-x:auto}.integration-logs-table{width:100%;border-collapse:collapse;min-width:950px}.integration-logs-table th{text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#667085;white-space:nowrap}.integration-logs-table td{padding:12px 10px;border-bottom:1px solid #f2f4f7;font-size:13px;white-space:nowrap}.integration-logs-empty{padding:50px;text-align:center;color:#667085}@media(max-width:900px){.integration-logs-page{padding:20px}.integration-logs-mobile-menu{display:flex}.integration-logs-header{flex-direction:column;padding-left:58px;gap:14px}.integration-logs-refresh{align-self:flex-start}.integration-logs-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.integration-logs-page{padding:14px}.integration-logs-header{padding-left:56px}.integration-logs-stats{grid-template-columns:1fr 1fr;gap:10px}.integration-logs-stat{padding:14px}.integration-logs-stat-value{font-size:22px}.integration-logs-chart-card,.integration-logs-table-card{padding:14px}.integration-logs-chart-header{flex-direction:column;gap:4px}.integration-logs-filters{display:grid;grid-template-columns:1fr 1fr;width:100%}.integration-logs-select{width:100%;min-width:0}}
      `}</style>
      {setMobile && <button type="button" className="integration-logs-mobile-menu" onClick={() => setMobile((current) => !current)} aria-label="Open menu"><Menu size={22} /></button>}
      <div className="integration-logs-container">
        <div className="integration-logs-header"><div><div style={{ fontSize: 12, fontWeight: 700, color: "#667085", letterSpacing: 1, textTransform: "uppercase" }}>Administration</div><h1 style={{ margin: "5px 0 0", fontSize: 28 }}>API & Webhooks</h1><p style={{ margin: "6px 0 0", color: "#667085" }}>Monitor API calls and webhook events across CRM integrations.</p></div><button type="button" onClick={() => { loadLogs(); loadRunStats(); loadChartLogs() }} className="integration-logs-refresh">Refresh</button></div>
        <div className="integration-logs-stats"><Stat title="Total Runs" value={totalRuns.toLocaleString("en-GB")} /><Stat title="Successful" value={successful.toLocaleString("en-GB")} className="integration-logs-stat-success" /><Stat title="Failed" value={failed.toLocaleString("en-GB")} className="integration-logs-stat-failed" /><Stat title="Success Rate" value={`${successRate.toFixed(1)}%`} className="integration-logs-stat-rate" subtitle={`${received.toLocaleString("en-GB")} processing · ${ignored.toLocaleString("en-GB")} ignored`} /></div>
        <div className="integration-logs-chart-card">
          <div className="integration-logs-chart-header"><div><h2 className="integration-logs-chart-title">API Runs Over Time</h2><p className="integration-logs-chart-description">Total runs per day, with status breakdown.</p></div><div className="integration-logs-chart-total">{totalRuns.toLocaleString("en-GB")} total runs</div></div>
          {!areaChart ? <div className="integration-logs-empty">No runs available to chart.</div> : <div className="run-area-wrap"><svg className="run-area-svg" viewBox={`0 0 ${areaChart.width} ${areaChart.height}`} preserveAspectRatio="none">
            {Array.from({ length: areaChart.yTicks + 1 }, (_, i) => { const value = (areaChart.maxTotal / areaChart.yTicks) * i; const yy = areaChart.y(value); return <g key={`grid-${i}`}><line x1={areaChart.left} x2={areaChart.width - areaChart.right} y1={yy} y2={yy} className="run-area-grid" /><text x={areaChart.left - 10} y={yy + 4} textAnchor="end" className="run-area-axis">{Math.round(value).toLocaleString("en-GB")}</text></g> })}
            <path d={areaChart.areaPath} className="run-area-fill" /><path d={areaChart.path} className="run-area-line" />
            {areaChart.points.map((p, i) => <circle key={p.date} cx={p.x} cy={areaChart.y(p.total)} r="4" className="run-area-dot"><title>{p.date}: {p.total.toLocaleString("en-GB")} total runs — {p.success} success, {p.failed} failed, {p.received} processing, {p.ignored} ignored{p.other ? `, ${p.other} other` : ""}</title></circle>)}
            {areaChart.points.map((p, i) => (i === 0 || i === areaChart.points.length - 1 || i % Math.max(1, Math.ceil(areaChart.points.length / 8)) === 0) ? <text key={`x-${p.date}`} x={p.x} y={areaChart.height - 16} textAnchor="middle" className="run-area-axis">{new Date(`${p.date}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</text> : null)}
          </svg><div className="run-area-legend"><span className="run-area-legend-item"><span className="run-area-legend-dot" style={{ background: "#175cd3" }} />Total runs</span><span>Hover/tap points for the status breakdown</span></div></div>}
        </div>
        <div className="integration-logs-table-card"><div className="integration-logs-table-header"><div><h2 style={{ margin: 0, fontSize: 18 }}>Integration Activity</h2><p style={{ margin: "4px 0 0", color: "#667085", fontSize: 13 }}>Latest inbound and outbound integration events.</p></div><div className="integration-logs-filters"><select value={provider} onChange={(e) => setProvider(e.target.value)} className="integration-logs-select"><option value="all">All Providers</option>{providers.map((item) => <option key={item} value={item}>{item}</option>)}</select><select value={status} onChange={(e) => setStatus(e.target.value)} className="integration-logs-select"><option value="all">All Statuses</option><option value="success">Success</option><option value="failed">Failed</option><option value="received">Processing</option><option value="ignored">Ignored</option></select></div></div>{loading ? <div className="integration-logs-empty">Loading integration activity…</div> : logs.length === 0 ? <div className="integration-logs-empty">No integration events found.</div> : <div className="integration-logs-table-wrap"><table className="integration-logs-table"><thead><tr>{["Time", "Provider", "Integration", "Direction", "Event", "External ID", "Status", "HTTP"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td>{formatDate(log.received_at)}</td><td style={{ fontWeight: 600 }}>{log.provider || "—"}</td><td>{log.integration_name || "—"}</td><td>{log.direction || "—"}</td><td>{log.event_name || log.event_type || "—"}</td><td style={{ fontFamily: "monospace", fontSize: 12 }}>{log.external_id || "—"}</td><td><StatusBadge status={log.status} error={log.error_message} /></td><td>{log.http_status || "—"}</td></tr>)}</tbody></table></div>}</div>
      </div>
    </div>
  )
}

function Stat({ title, value, className = "", subtitle = "" }) { return <div className={`integration-logs-stat ${className}`}><div className="integration-logs-stat-label">{title}</div><div className="integration-logs-stat-value">{value}</div>{subtitle && <div className="integration-logs-stat-sub">{subtitle}</div>}</div> }
function StatusBadge({ status, error }) { const labels = { success: "Success", failed: "Failed", received: "Processing", ignored: "Ignored" }; return <span title={error || ""} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: status === "success" ? "#ecfdf3" : status === "failed" ? "#fef3f2" : status === "received" ? "#fffaeb" : "#f2f4f7", color: status === "success" ? "#027a48" : status === "failed" ? "#b42318" : status === "received" ? "#b54708" : "#475467" }}>{labels[status] || status || "Unknown"}</span> }
function formatDate(value) { if (!value) return "—"; return new Date(value).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) }

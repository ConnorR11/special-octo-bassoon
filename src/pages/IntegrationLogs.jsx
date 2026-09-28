import React from "react"
import { Menu } from "lucide-react"
import { supabase } from "../lib/supabase"

export default function IntegrationLogs({ setMobile }) {
  const [logs, setLogs] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [status, setStatus] = React.useState("all")
  const [provider, setProvider] = React.useState("all")

  React.useEffect(() => {
    loadLogs()
  }, [status, provider])

  async function loadLogs() {
    setLoading(true)
    let query = supabase
      .from("integration_event_logs")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(200)

    if (status !== "all") query = query.eq("status", status)
    if (provider !== "all") query = query.eq("provider", provider)

    const { data, error } = await query
    if (error) {
      console.error("Error loading integration logs:", error)
      setLogs([])
    } else {
      setLogs(data || [])
    }
    setLoading(false)
  }

  const successful = logs.filter((log) => log.status === "success").length
  const failed = logs.filter((log) => log.status === "failed").length
  const received = logs.filter((log) => log.status === "received").length
  const ignored = logs.filter((log) => log.status === "ignored").length
  const totalRuns = logs.length
  const successRate = totalRuns ? (successful / totalRuns) * 100 : 0
  const chartRows = [
    { label: "Success", count: successful, className: "run-bar-success" },
    { label: "Failed", count: failed, className: "run-bar-failed" },
    { label: "Processing", count: received, className: "run-bar-processing" },
    { label: "Ignored", count: ignored, className: "run-bar-ignored" },
  ]
  const chartMax = Math.max(1, ...chartRows.map((row) => row.count))

  const providers = [...new Set(logs.map((log) => log.provider).filter(Boolean))]

  return (
    <div className="integration-logs-page">
      <style>{`
        .integration-logs-page{box-sizing:border-box;padding:28px;background:#f5f7fa;min-height:100vh;width:100%;color:#102a43}
        .integration-logs-container{max-width:1500px;margin:0 auto}
        .integration-logs-mobile-menu{display:none;position:fixed;top:12px;left:12px;z-index:1100;width:44px;height:44px;border:1px solid #d0d5dd;border-radius:9px;background:#fff;color:#344054;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.12);cursor:pointer}
        .integration-logs-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:24px}
        .integration-logs-refresh{padding:9px 14px;border:1px solid #d0d5dd;border-radius:8px;background:#fff;cursor:pointer;white-space:nowrap}
        .integration-logs-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:20px}
        .integration-logs-stat{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px;min-width:0}
        .integration-logs-stat-label{font-size:13px;color:#667085}
        .integration-logs-stat-value{margin-top:6px;font-size:26px;font-weight:700}
        .integration-logs-stat-sub{margin-top:4px;font-size:12px;color:#667085}
        .integration-logs-stat-success{border-left:4px solid #12b76a}
        .integration-logs-stat-failed{border-left:4px solid #f04438}
        .integration-logs-stat-rate{border-left:4px solid #175cd3}
        .integration-logs-chart-card,.integration-logs-table-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px}
        .integration-logs-chart-card{margin-bottom:20px}
        .integration-logs-chart-header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px}
        .integration-logs-chart-title{margin:0;font-size:18px}
        .integration-logs-chart-description{margin:4px 0 0;color:#667085;font-size:13px}
        .integration-logs-chart-total{font-size:13px;color:#667085;white-space:nowrap}
        .run-chart{display:flex;flex-direction:column;gap:14px}
        .run-chart-row{display:grid;grid-template-columns:95px 1fr 55px;align-items:center;gap:12px}
        .run-chart-label{font-size:13px;font-weight:600}
        .run-chart-track{height:18px;background:#f2f4f7;border-radius:999px;overflow:hidden}
        .run-chart-bar{height:100%;min-width:0;border-radius:999px;transition:width .25s ease}
        .run-bar-success{background:#12b76a}.run-bar-failed{background:#f04438}.run-bar-processing{background:#f79009}.run-bar-ignored{background:#98a2b3}
        .run-chart-count{text-align:right;font-size:13px;font-weight:700}
        .integration-logs-table-header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap}
        .integration-logs-filters{display:flex;gap:8px;flex-wrap:wrap}
        .integration-logs-select{padding:8px 10px;border:1px solid #d0d5dd;border-radius:8px;background:#fff}
        .integration-logs-table-wrap{overflow-x:auto}
        .integration-logs-table{width:100%;border-collapse:collapse;min-width:950px}
        .integration-logs-table th{text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#667085;white-space:nowrap}
        .integration-logs-table td{padding:12px 10px;border-bottom:1px solid #f2f4f7;font-size:13px;white-space:nowrap}
        .integration-logs-empty{padding:50px;text-align:center;color:#667085}
        @media(max-width:900px){
          .integration-logs-page{padding:20px}
          .integration-logs-mobile-menu{display:flex}
          .integration-logs-header{flex-direction:column;padding-left:58px;gap:14px}
          .integration-logs-refresh{align-self:flex-start}
          .integration-logs-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
        }
        @media(max-width:600px){
          .integration-logs-page{padding:14px}
          .integration-logs-header{padding-left:56px}
          .integration-logs-stats{grid-template-columns:1fr 1fr;gap:10px}
          .integration-logs-stat{padding:14px}
          .integration-logs-stat-value{font-size:22px}
          .integration-logs-chart-card,.integration-logs-table-card{padding:14px}
          .integration-logs-chart-header{flex-direction:column;gap:4px}
          .run-chart-row{grid-template-columns:78px 1fr 42px;gap:8px}
          .run-chart-label,.run-chart-count{font-size:12px}
          .integration-logs-filters{display:grid;grid-template-columns:1fr 1fr;width:100%}
          .integration-logs-select{width:100%;min-width:0}
        }
      `}</style>

      {setMobile && <button type="button" className="integration-logs-mobile-menu" onClick={() => setMobile((current) => !current)} aria-label="Open menu"><Menu size={22} /></button>}

      <div className="integration-logs-container">
        <div className="integration-logs-header">
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#667085", letterSpacing: 1, textTransform: "uppercase" }}>Administration</div>
            <h1 style={{ margin: "5px 0 0", fontSize: 28 }}>API & Webhooks</h1>
            <p style={{ margin: "6px 0 0", color: "#667085" }}>Monitor API calls and webhook events across CRM integrations.</p>
          </div>
          <button type="button" onClick={loadLogs} className="integration-logs-refresh">Refresh</button>
        </div>

        <div className="integration-logs-stats">
          <Stat title="Total Runs" value={totalRuns} />
          <Stat title="Successful" value={successful} className="integration-logs-stat-success" />
          <Stat title="Failed" value={failed} className="integration-logs-stat-failed" />
          <Stat title="Success Rate" value={`${successRate.toFixed(1)}%`} className="integration-logs-stat-rate" subtitle={`${received} processing · ${ignored} ignored`} />
        </div>

        <div className="integration-logs-chart-card">
          <div className="integration-logs-chart-header">
            <div>
              <h2 className="integration-logs-chart-title">API Run Status</h2>
              <p className="integration-logs-chart-description">Total runs broken down by the status recorded in the integration event log.</p>
            </div>
            <div className="integration-logs-chart-total">{totalRuns.toLocaleString("en-GB")} total runs</div>
          </div>
          {totalRuns === 0 ? <div className="integration-logs-empty">No runs available to chart.</div> : (
            <div className="run-chart">
              {chartRows.map((row) => (
                <div className="run-chart-row" key={row.label}>
                  <div className="run-chart-label">{row.label}</div>
                  <div className="run-chart-track"><div className={`run-chart-bar ${row.className}`} style={{ width: `${(row.count / chartMax) * 100}%` }} /></div>
                  <div className="run-chart-count">{row.count.toLocaleString("en-GB")}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="integration-logs-table-card">
          <div className="integration-logs-table-header">
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Integration Activity</h2>
              <p style={{ margin: "4px 0 0", color: "#667085", fontSize: 13 }}>Latest inbound and outbound integration events.</p>
            </div>
            <div className="integration-logs-filters">
              <select value={provider} onChange={(e) => setProvider(e.target.value)} className="integration-logs-select">
                <option value="all">All Providers</option>
                {providers.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="integration-logs-select">
                <option value="all">All Statuses</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="received">Processing</option>
                <option value="ignored">Ignored</option>
              </select>
            </div>
          </div>

          {loading ? <div className="integration-logs-empty">Loading integration activity…</div> : logs.length === 0 ? <div className="integration-logs-empty">No integration events found.</div> : (
            <div className="integration-logs-table-wrap">
              <table className="integration-logs-table">
                <thead>
                  <tr>{["Time", "Provider", "Integration", "Direction", "Event", "External ID", "Status", "HTTP"].map((heading) => <th key={heading}>{heading}</th>)}</tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDate(log.received_at)}</td>
                      <td style={{ fontWeight: 600 }}>{log.provider || "—"}</td>
                      <td>{log.integration_name || "—"}</td>
                      <td>{log.direction || "—"}</td>
                      <td>{log.event_name || log.event_type || "—"}</td>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{log.external_id || "—"}</td>
                      <td><StatusBadge status={log.status} error={log.error_message} /></td>
                      <td>{log.http_status || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ title, value, className = "", subtitle = "" }) {
  return <div className={`integration-logs-stat ${className}`}><div className="integration-logs-stat-label">{title}</div><div className="integration-logs-stat-value">{value}</div>{subtitle && <div className="integration-logs-stat-sub">{subtitle}</div>}</div>
}

function StatusBadge({ status, error }) {
  const labels = { success: "Success", failed: "Failed", received: "Processing", ignored: "Ignored" }
  return <span title={error || ""} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: status === "success" ? "#ecfdf3" : status === "failed" ? "#fef3f2" : status === "received" ? "#fffaeb" : "#f2f4f7", color: status === "success" ? "#027a48" : status === "failed" ? "#b42318" : status === "received" ? "#b54708" : "#475467" }}>{labels[status] || status || "Unknown"}</span>
}

function formatDate(value) {
  if (!value) return "—"
  return new Date(value).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })
}

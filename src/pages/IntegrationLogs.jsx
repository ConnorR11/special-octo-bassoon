import React from "react"
import { supabase } from "../lib/supabase"

export default function IntegrationLogs() {
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

  const providers = [...new Set(logs.map((log) => log.provider).filter(Boolean))]

  return (
    <div style={{ padding: 28, background: "#f5f7fa", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1500, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#667085", letterSpacing: 1, textTransform: "uppercase" }}>Administration</div>
            <h1 style={{ margin: "5px 0 0", fontSize: 28, color: "#102a43" }}>API & Webhooks</h1>
            <p style={{ margin: "6px 0 0", color: "#667085" }}>Monitor API calls and webhook events across CRM integrations.</p>
          </div>
          <button type="button" onClick={loadLogs} style={{ padding: "9px 14px", border: "1px solid #d0d5dd", borderRadius: 8, background: "#fff", cursor: "pointer" }}>Refresh</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, marginBottom: 20 }}>
          <Stat title="Events" value={logs.length} />
          <Stat title="Successful" value={successful} />
          <Stat title="Failed" value={failed} />
          <Stat title="Processing" value={received} />
        </div>

        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Integration Activity</h2>
              <p style={{ margin: "4px 0 0", color: "#667085", fontSize: 13 }}>Latest inbound and outbound integration events.</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <select value={provider} onChange={(e) => setProvider(e.target.value)} style={selectStyle}>
                <option value="all">All Providers</option>
                {providers.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
                <option value="all">All Statuses</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="received">Processing</option>
                <option value="ignored">Ignored</option>
              </select>
            </div>
          </div>

          {loading ? <div style={emptyStyle}>Loading integration activity…</div> : logs.length === 0 ? <div style={emptyStyle}>No integration events found.</div> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 950 }}>
                <thead>
                  <tr>{["Time", "Provider", "Integration", "Direction", "Event", "External ID", "Status", "HTTP"].map((heading) => <th key={heading} style={thStyle}>{heading}</th>)}</tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td style={tdStyle}>{formatDate(log.received_at)}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{log.provider || "—"}</td>
                      <td style={tdStyle}>{log.integration_name || "—"}</td>
                      <td style={tdStyle}>{log.direction || "—"}</td>
                      <td style={tdStyle}>{log.event_name || log.event_type || "—"}</td>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{log.external_id || "—"}</td>
                      <td style={tdStyle}><StatusBadge status={log.status} error={log.error_message} /></td>
                      <td style={tdStyle}>{log.http_status || "—"}</td>
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

function Stat({ title, value }) {
  return <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18 }}><div style={{ fontSize: 13, color: "#667085" }}>{title}</div><div style={{ marginTop: 6, fontSize: 26, fontWeight: 700, color: "#102a43" }}>{value}</div></div>
}

function StatusBadge({ status, error }) {
  const labels = { success: "Success", failed: "Failed", received: "Processing", ignored: "Ignored" }
  return <span title={error || ""} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: status === "success" ? "#ecfdf3" : status === "failed" ? "#fef3f2" : status === "received" ? "#fffaeb" : "#f2f4f7", color: status === "success" ? "#027a48" : status === "failed" ? "#b42318" : status === "received" ? "#b54708" : "#475467" }}>{labels[status] || status || "Unknown"}</span>
}

function formatDate(value) {
  if (!value) return "—"
  return new Date(value).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })
}

const selectStyle = { padding: "8px 10px", border: "1px solid #d0d5dd", borderRadius: 8, background: "#fff" }
const thStyle = { textAlign: "left", padding: "10px", borderBottom: "1px solid #e5e7eb", fontSize: 12, color: "#667085", whiteSpace: "nowrap" }
const tdStyle = { padding: "12px 10px", borderBottom: "1px solid #f2f4f7", fontSize: 13, whiteSpace: "nowrap" }
const emptyStyle = { padding: 50, textAlign: "center", color: "#667085" }

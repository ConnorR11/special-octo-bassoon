import React from "react"
import { Phone, PhoneIncoming, PhoneOutgoing, RefreshCw, Search, X } from "lucide-react"
import { supabase } from "../lib/supabase"

const statusLabels = {
  initiated: "Initiated",
  ringing: "Ringing",
  connected: "Connected",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  rejected: "Rejected",
  no_answer: "No answer",
}

const statusStyles = {
  connected: { background: "#e9f7ef", color: "#177245" },
  completed: { background: "#e9f7ef", color: "#177245" },
  initiated: { background: "#eef4ff", color: "#315ea8" },
  ringing: { background: "#fff7e6", color: "#9a6700" },
  failed: { background: "#fff0f0", color: "#b42318" },
  cancelled: { background: "#f1f3f5", color: "#667085" },
  rejected: { background: "#fff0f0", color: "#b42318" },
  no_answer: { background: "#fff7e6", color: "#9a6700" },
}

function formatPhone(value) {
  if (!value) return "—"
  return value
}

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function formatDuration(seconds) {
  const total = Number(seconds)
  if (!Number.isFinite(total) || total < 0) return "—"
  const mins = Math.floor(total / 60)
  const secs = Math.round(total % 60)
  return mins > 0 ? `${mins}m ${String(secs).padStart(2, "0")}s` : `${secs}s`
}

function CallLog({ onClose }) {
  const [calls, setCalls] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [search, setSearch] = React.useState("")

  const loadCalls = React.useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError("")
    try {
      const { data, error: queryError } = await supabase
        .from("call_logs")
        .select("*, deals:deal_id(customer_name, contract_number, pipedrive_deal_id)")
        .order("started_at", { ascending: false })
        .limit(250)
      if (queryError) throw queryError
      setCalls(data || [])
    } catch (err) {
      console.error("Unable to load call log", err)
      setError(err?.message || "Unable to load call log.")
      setCalls([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { loadCalls() }, [loadCalls])

  const filteredCalls = React.useMemo(() => {
    const value = search.trim().toLowerCase()
    if (!value) return calls
    return calls.filter(call => [call.customer_name, call.customer_phone, call.to_number, call.from_number, call.deals?.contract_number].some(item => String(item || "").toLowerCase().includes(value)))
  }, [calls, search])

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10001, background: "#f5f7fa", overflow: "auto" }}>
      <div style={{ maxWidth: 1500, margin: "0 auto", padding: "28px 28px 50px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Phone size={24} color="#002d49" /><h1 style={{ margin: 0, color: "#002d49", fontSize: 28 }}>Call Log</h1></div>
            <p style={{ margin: "6px 0 0", color: "#667085", fontSize: 13 }}>Your CRM calls, linked to customers and deals where a matching phone number exists.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={loadCalls} disabled={loading} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid #d9e0e7", background: "#fff", borderRadius: 8, padding: "9px 12px", cursor: "pointer", color: "#334155" }}><RefreshCw size={15} />Refresh</button>
            <button type="button" onClick={onClose} aria-label="Close call log" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, border: "1px solid #d9e0e7", background: "#fff", borderRadius: 8, cursor: "pointer", color: "#334155" }}><X size={18} /></button>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e3e8ee", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: 14, borderBottom: "1px solid #edf0f3", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 420 }}><Search size={16} style={{ position: "absolute", left: 12, top: 11, color: "#98a2b3" }} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search customer, phone or contract" style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 34px", border: "1px solid #d9e0e7", borderRadius: 8, outline: "none", fontSize: 13 }} /></div>
            <span style={{ fontSize: 12, color: "#667085" }}>{filteredCalls.length} calls</span>
          </div>

          {error && <div style={{ margin: 14, padding: 12, borderRadius: 8, background: "#fff0f0", color: "#b42318", fontSize: 13 }}>{error}</div>}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead><tr style={{ background: "#f8fafc" }}>
                {['Date / time', 'Direction', 'Customer', 'Phone', 'Deal', 'Status', 'Duration'].map(label => <th key={label} style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, color: "#667085", fontWeight: 700, borderBottom: "1px solid #edf0f3" }}>{label}</th>)}
              </tr></thead>
              <tbody>
                {!loading && filteredCalls.length === 0 && <tr><td colSpan={7} style={{ padding: 50, textAlign: "center", color: "#98a2b3", fontSize: 13 }}>No calls have been logged yet.</td></tr>}
                {filteredCalls.map(call => {
                  const statusStyle = statusStyles[call.status] || statusStyles.initiated
                  const direction = String(call.direction || "outbound").toLowerCase()
                  return <tr key={call.id} style={{ borderBottom: "1px solid #f0f2f5" }}>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#344054", whiteSpace: "nowrap" }}>{formatDate(call.started_at)}</td>
                    <td style={{ padding: "12px 14px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475467" }}>{direction === "inbound" ? <PhoneIncoming size={14} /> : <PhoneOutgoing size={14} />}{direction === "inbound" ? "Inbound" : "Outbound"}</span></td>
                    <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: "#17324d" }}>{call.customer_name || "Unknown customer"}</td>
                    <td style={{ padding: "12px 14px", fontSize: 13, color: "#475467" }}>{formatPhone(call.customer_phone || call.to_number)}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#475467" }}>{call.deals?.contract_number || "—"}</td>
                    <td style={{ padding: "12px 14px" }}><span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, ...statusStyle }}>{statusLabels[call.status] || call.status || "Unknown"}</span></td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#475467" }}>{formatDuration(call.duration_seconds)}</td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
          {loading && <div style={{ padding: 16, textAlign: "center", color: "#667085", fontSize: 12 }}>Loading call log…</div>}
        </div>
      </div>
    </div>
  )
}

export default CallLog

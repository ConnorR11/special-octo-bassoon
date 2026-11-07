import React, { useCallback, useEffect, useState } from "react"
import { Search, RefreshCw, ShieldCheck, FileText, ChevronLeft, ChevronRight } from "lucide-react"
import { supabase } from "../lib/supabase"

const PAGE_SIZE = 50
const money = value => {
  if (!value) return "—"
  return String(value).trim()
}

export default function IWACertificates() {
  const [rows, setRows] = useState([])
  const [counts, setCounts] = useState({ total: 0, unmatched: 0, approved: 0, excluded: 0 })
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadCounts = useCallback(async () => {
    const statuses = ["unmatched", "approved", "excluded"]
    const results = await Promise.all(statuses.map(async value => {
      const { count, error: queryError } = await supabase.from("iwa_certificates").select("id", { count: "exact", head: true }).eq("match_status", value)
      if (queryError) throw queryError
      return [value, count || 0]
    }))
    const mapped = Object.fromEntries(results)
    setCounts({ total: results.reduce((sum, [, count]) => sum + count, 0), ...mapped })
  }, [])

  const loadRows = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError("")
    try {
      let request = supabase.from("iwa_certificates").select("id,certificate_id,installation_type,customer_name,installation_address,cover_period,contract_value,premium,payment_method,issue_date_text,completion_date_text,match_status", { count: "exact" }).order("certificate_id", { ascending: true }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      if (status !== "all") request = request.eq("match_status", status)
      const term = search.trim()
      if (term) {
        const safe = term.replace(/[%_]/g, "\\$&").replace(/,/g, "\\,")
        request = request.or(`certificate_id.ilike.%${safe}%,customer_name.ilike.%${safe}%,installation_address.ilike.%${safe}%`)
      }
      const [{ data, error: rowsError },] = await Promise.all([request, loadCounts()])
      if (rowsError) throw rowsError
      setRows(data || [])
    } catch (err) {
      setError(err?.message || "Unable to load IWA certificates.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [page, status, search, loadCounts])

  useEffect(() => { loadRows() }, [loadRows])

  const card = (label, value, icon, tint) => (
    <div style={{ background: "#fff", border: "1px solid #e7ebef", borderRadius: 12, padding: 18, display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: tint, display: "grid", placeItems: "center", color: "#24445c", flexShrink: 0 }}>{icon}</div>
      <div><div style={{ fontSize: 12, color: "#77818b" }}>{label}</div><div style={{ fontSize: 24, fontWeight: 700, color: "#18232d" }}>{value.toLocaleString("en-GB")}</div></div>
    </div>
  )

  return (
    <div style={{ padding: "4px 0 28px", color: "#202a33" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div><h1 style={{ margin: 0, fontSize: 25, fontWeight: 700 }}>IWA Certificates</h1><p style={{ margin: "6px 0 0", color: "#7b858e", fontSize: 13 }}>Independent Warranty Association certificate register</p></div>
        <button onClick={loadRows} disabled={loading} style={{ border: "1px solid #dce2e7", borderRadius: 8, background: "#fff", padding: "9px 13px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#34495a" }}><RefreshCw size={15}/> Refresh</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(175px,1fr))", gap: 12, marginBottom: 20 }}>
        {card("Total certificates", counts.total, <FileText size={19}/>, "#edf3f8")}
        {card("Awaiting match", counts.unmatched, <Search size={19}/>, "#fff5df")}
        {card("Approved matches", counts.approved, <ShieldCheck size={19}/>, "#e8f6ee")}
        {card("Excluded", counts.excluded, <FileText size={19}/>, "#f1f2f4")}
      </div>

      <div style={{ background: "#fff", border: "1px solid #e7ebef", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: 15, display: "flex", gap: 10, flexWrap: "wrap", borderBottom: "1px solid #edf0f2" }}>
          <div style={{ flex: "1 1 280px", position: "relative" }}><Search size={16} style={{ position: "absolute", left: 11, top: 11, color: "#8a949d" }}/><input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="Search certificate, customer or address..." style={{ width: "100%", boxSizing: "border-box", border: "1px solid #dce2e7", borderRadius: 8, padding: "9px 10px 9px 34px", fontSize: 13 }}/></div>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(0) }} style={{ border: "1px solid #dce2e7", borderRadius: 8, padding: "9px 12px", background: "#fff", color: "#34495a" }}>
            <option value="all">All statuses</option><option value="unmatched">Awaiting match</option><option value="approved">Approved</option><option value="excluded">Excluded</option>
          </select>
        </div>
        {error && <div style={{ padding: 14, color: "#b42318", background: "#fff4f2", fontSize: 13 }}>{error}</div>}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1120, fontSize: 12 }}>
            <thead><tr style={{ background: "#f8fafb", color: "#66727d", textAlign: "left" }}>
              {["Certificate ID","Customer / Installation address","Installation type","Cover period","Contract value","Premium","Payment method","Match status"].map(label => <th key={label} style={{ padding: "12px 13px", fontWeight: 650, whiteSpace: "nowrap", borderBottom: "1px solid #e9edf0" }}>{label}</th>)}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="8" style={{ padding: 30, textAlign: "center", color: "#7b858e" }}>Loading certificates…</td></tr> : rows.length === 0 ? <tr><td colSpan="8" style={{ padding: 30, textAlign: "center", color: "#7b858e" }}>No certificates found.</td></tr> : rows.map(row => <tr key={row.id} style={{ borderBottom: "1px solid #eef1f3" }}>
                <td style={{ padding: "12px 13px", fontWeight: 650, whiteSpace: "nowrap", color: "#23445c" }}>{row.certificate_id}</td>
                <td style={{ padding: "12px 13px", maxWidth: 300 }}><div style={{ fontWeight: 600 }}>{row.customer_name || "—"}</div><div style={{ color: "#7b858e", marginTop: 3 }}>{row.installation_address || "—"}</div></td>
                <td style={{ padding: "12px 13px" }}>{row.installation_type || "—"}</td>
                <td style={{ padding: "12px 13px", whiteSpace: "nowrap" }}>{row.cover_period || "—"}</td>
                <td style={{ padding: "12px 13px", whiteSpace: "nowrap" }}>{money(row.contract_value)}</td>
                <td style={{ padding: "12px 13px", whiteSpace: "nowrap" }}>{money(row.premium)}</td>
                <td style={{ padding: "12px 13px" }}>{row.payment_method || "—"}</td>
                <td style={{ padding: "12px 13px" }}><span style={{ display: "inline-block", borderRadius: 20, padding: "4px 9px", background: row.match_status === "approved" ? "#e8f6ee" : row.match_status === "excluded" ? "#f1f2f4" : "#fff5df", color: row.match_status === "approved" ? "#187044" : row.match_status === "excluded" ? "#626b73" : "#8b5a00", whiteSpace: "nowrap", fontWeight: 600 }}>{row.match_status === "unmatched" ? "Awaiting match" : row.match_status}</span></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px 15px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderTop: "1px solid #edf0f2", color: "#77818b", fontSize: 12 }}>
          <span>Showing {rows.length ? page * PAGE_SIZE + 1 : 0}–{page * PAGE_SIZE + rows.length} of {status === "all" ? counts.total : counts[status] || 0}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={page === 0 || loading} onClick={() => setPage(value => Math.max(0, value - 1))} style={{ border: "1px solid #dce2e7", borderRadius: 7, padding: "7px 10px", background: "#fff", cursor: "pointer", opacity: page === 0 ? .45 : 1 }}><ChevronLeft size={15}/></button>
            <button disabled={loading || rows.length < PAGE_SIZE} onClick={() => setPage(value => value + 1)} style={{ border: "1px solid #dce2e7", borderRadius: 7, padding: "7px 10px", background: "#fff", cursor: "pointer", opacity: rows.length < PAGE_SIZE ? .45 : 1 }}><ChevronRight size={15}/></button>
          </div>
        </div>
      </div>
    </div>
  )
}

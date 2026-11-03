import React, { useCallback, useEffect, useState } from "react"
import { Download, RefreshCw, Users } from "lucide-react"
import { supabase } from "../lib/supabase"

const PAGE_SIZE = 20
const START_DATE = "2026-01-01T00:00:00"
const LEAD_SOURCE = "SMG Solar"
const COLUMNS = [
  ["Received Date", row => row.received_date_time || ""],
  ["Name", row => [row.first_name, row.last_name].filter(Boolean).join(" ")],
  ["Postcode", row => row.postcode || ""],
  ["Disposition", row => row.disposition || ""],
  ["Related Appointment Results", row => row.appointment_results || ""],
  ["Marketing Note", row => row.marketing_note || ""],
]

function csvCell(value) { return '"' + String(value ?? "").replace(/"/g, '""') + '"' }
function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function LeadExport() {
  const [leads, setLeads] = useState([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState("")

  const loadLeads = useCallback(async (pageNumber = 0) => {
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return }
    setLoading(true)
    setError("")
    const { data, error: queryError } = await supabase.rpc("get_lead_export_page", {
      p_source: LEAD_SOURCE,
      p_limit: PAGE_SIZE,
      p_offset: pageNumber * PAGE_SIZE,
    })
    if (queryError) { setError(queryError.message); setLeads([]); setTotal(0) }
    else {
      const rows = data || []
      setLeads(rows)
      setTotal(Number(rows[0]?.total_count || 0))
      setPage(pageNumber)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadLeads(0)
  }, [loadLeads])


  async function exportCsv() {
    if (!supabase || exporting) return
    setExporting(true); setError("")
    try {
      const rows = []
      let offset = 0
      while (true) {
        const { data, error: queryError } = await supabase.rpc("get_lead_export_page", {
          p_source: LEAD_SOURCE,
          p_limit: 1000,
          p_offset: offset,
        })
        if (queryError) throw queryError
        const batch = data || []
        rows.push(...batch)
        if (batch.length < 1000) break
        offset += 1000
      }
      const header = COLUMNS.map(([label]) => csvCell(label)).join(",")
      const lines = rows.map(row => COLUMNS.map(([, getter]) => csvCell(getter(row))).join(","))
      const blob = new Blob(["\uFEFF" + [header, ...lines].join("\r\n")], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "homeshield-smg-solar-leads-2026.csv"
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url)
    } catch (err) { setError(err?.message || "Unable to export leads.") }
    finally { setExporting(false) }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const btn = { border: "1px solid #d9e1e8", borderRadius: 8, background: "#fff", padding: "9px 13px", color: "#17364b", fontWeight: 600, cursor: "pointer" }
  return <section style={{ maxWidth: 1600, margin: "0 auto", color: "#203342" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
      <div><h1 style={{ margin: 0, fontSize: 25 }}>SMG Solar</h1><p style={{ margin: "6px 0 0", color: "#71808c", fontSize: 13 }}>SMG Solar leads received from 1 January 2026 onwards.</p></div>
      <button type="button" onClick={exportCsv} disabled={exporting || loading || total === 0} style={{ ...btn, background: "#073b56", color: "#fff", borderColor: "#073b56", display: "inline-flex", alignItems: "center", gap: 8, opacity: exporting || loading || total === 0 ? .55 : 1 }}><Download size={16}/>{exporting ? "Preparing CSV..." : "Export CSV"}</button>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", background: "#fff", border: "1px solid #e3e9ee", borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 38, height: 38, borderRadius: 10, background: "#edf4f7", display: "grid", placeItems: "center", color: "#174d68" }}><Users size={19}/></div><div><div style={{ fontSize: 22, fontWeight: 700 }}>{total.toLocaleString("en-GB")}</div><div style={{ fontSize: 12, color: "#71808c" }}>Matching leads</div></div></div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}><span style={{ fontSize: 13, fontWeight: 600, color: "#536575" }}>Lead source: SMG Solar</span><button type="button" onClick={() => loadLeads(page)} disabled={loading} style={{ ...btn, display: "inline-flex", alignItems: "center", gap: 7 }}><RefreshCw size={14}/>Refresh</button></div>
    </div>
    {error && <div role="alert" style={{ padding: 12, marginBottom: 14, borderRadius: 8, background: "#fff1f0", color: "#a12622", border: "1px solid #f2c8c5", fontSize: 13 }}>{error}</div>}
    <div style={{ background: "#fff", border: "1px solid #e3e9ee", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr style={{ background: "#f5f8fa", color: "#536575", textAlign: "left" }}>{["Received Date","Name","Postcode","Disposition","Related Appointment Results","Marketing Note"].map(label => <th key={label} style={{ padding: "13px 12px", borderBottom: "1px solid #e3e9ee", whiteSpace: "nowrap" }}>{label}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan={6} style={{ padding: 30, textAlign: "center" }}>Loading leads...</td></tr> : leads.length === 0 ? <tr><td colSpan={6} style={{ padding: 30, textAlign: "center" }}>No leads found for this filter.</td></tr> : leads.map((row, index) => <tr key={row.received_date_time + "-" + index} style={{ borderBottom: "1px solid #edf1f4" }}>
          <td style={{ padding: "11px 12px", whiteSpace: "nowrap" }}>{formatDate(row.received_date_time)}</td><td style={{ padding: "11px 12px", fontWeight: 600, whiteSpace: "nowrap" }}>{[row.first_name,row.last_name].filter(Boolean).join(" ") || "—"}</td><td style={{ padding: "11px 12px", whiteSpace: "nowrap" }}>{row.postcode || "—"}</td><td style={{ padding: "11px 12px", whiteSpace: "nowrap" }}>{row.disposition || "—"}</td><td style={{ padding: "11px 12px", whiteSpace: "pre-wrap" }}>{row.appointment_results || "—"}</td><td style={{ padding: "11px 12px", whiteSpace: "pre-wrap" }}>{row.marketing_note || "—"}</td>
        </tr>)}</tbody>
      </table></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "13px 16px", borderTop: "1px solid #e3e9ee" }}>
        <span style={{ fontSize: 12, color: "#71808c" }}>Showing {total === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString("en-GB")}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><button type="button" onClick={() => loadLeads(Math.max(0,page-1))} disabled={loading || page===0} style={{ ...btn, opacity: loading || page===0 ? .45 : 1 }}>Previous</button><span style={{ fontSize: 12, color: "#536575" }}>Page {page+1} of {pages}</span><button type="button" onClick={() => loadLeads(page+1)} disabled={loading || page+1>=pages} style={{ ...btn, opacity: loading || page+1>=pages ? .45 : 1 }}>Next</button></div>
      </div>
    </div>
  </section>
}

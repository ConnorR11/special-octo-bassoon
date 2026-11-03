import React, { useCallback, useEffect, useState } from "react"
import { Download, RefreshCw, Users } from "lucide-react"
import { supabase } from "../lib/supabase"

const PAGE_SIZE = 20
const START_DATE = "2026-01-01T00:00:00"
const COLUMNS = [
  ["Name", row => [row.salutations, row.first_name, row.last_name].filter(Boolean).join(" ")],
  ["Phone", row => row.primary_phone_number || ""],
  ["Secondary Phone", row => row.secondary_phone_number || ""],
  ["Email", row => row.email || ""],
  ["Address", row => row.address || ""],
  ["Postcode", row => row.postcode || ""],
  ["Lead Source", row => row.lead_source || ""],
  ["Lead Type", row => row.lead_type || ""],
  ["Disposition", row => row.disposition || ""],
  ["Received", row => row.received_date_time || ""],
]
const SELECT_FIELDS = "salutations,first_name,last_name,primary_phone_number,secondary_phone_number,email,address,postcode,lead_source,lead_type,disposition,received_date_time"

function csvCell(value) { return '"' + String(value ?? "").replace(/"/g, '""') + '"' }
function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function LeadExport() {
  const [leads, setLeads] = useState([])
  const [sources, setSources] = useState([])
  const [source, setSource] = useState("all")
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState("")

  const loadSources = useCallback(async () => {
    if (!supabase) return
    const { data, error: queryError } = await supabase.rpc("get_lead_export_sources")
    if (queryError) throw queryError
    setSources((data || []).map(row => row.lead_source).filter(Boolean))
  }, [])

  const loadLeads = useCallback(async (pageNumber = 0, sourceValue = source) => {
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return }
    setLoading(true)
    setError("")
    const { data, error: queryError } = await supabase.rpc("get_lead_export_page", {
      p_source: sourceValue === "all" ? null : sourceValue,
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
  }, [source])

  useEffect(() => {
    let active = true
    async function initialise() {
      try { await loadSources(); if (active) await loadLeads(0, "all") }
      catch (err) { if (active) { setError(err?.message || "Unable to load leads."); setLoading(false) } }
    }
    initialise()
    return () => { active = false }
  }, [loadSources, loadLeads])

  async function changeSource(value) { setSource(value); await loadLeads(0, value) }

  async function exportCsv() {
    if (!supabase || exporting) return
    setExporting(true); setError("")
    try {
      const rows = []
      let offset = 0
      while (true) {
        let request = supabase.from("leads").select(SELECT_FIELDS).gte("received_date_time", START_DATE).order("received_date_time", { ascending: false }).range(offset, offset + 999)
        if (source !== "all") request = request.eq("lead_source", source)
        const { data, error: queryError } = await request
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
      link.download = "homeshield-leads-2026" + (source === "all" ? "" : "-" + source.toLowerCase().replace(/[^a-z0-9]+/g, "-")) + ".csv"
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url)
    } catch (err) { setError(err?.message || "Unable to export leads.") }
    finally { setExporting(false) }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const btn = { border: "1px solid #d9e1e8", borderRadius: 8, background: "#fff", padding: "9px 13px", color: "#17364b", fontWeight: 600, cursor: "pointer" }
  return <section style={{ maxWidth: 1600, margin: "0 auto", color: "#203342" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
      <div><h1 style={{ margin: 0, fontSize: 25 }}>Lead Export</h1><p style={{ margin: "6px 0 0", color: "#71808c", fontSize: 13 }}>All leads received from 1 January 2026 onwards.</p></div>
      <button type="button" onClick={exportCsv} disabled={exporting || loading || total === 0} style={{ ...btn, background: "#073b56", color: "#fff", borderColor: "#073b56", display: "inline-flex", alignItems: "center", gap: 8, opacity: exporting || loading || total === 0 ? .55 : 1 }}><Download size={16}/>{exporting ? "Preparing CSV..." : "Export CSV"}</button>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", background: "#fff", border: "1px solid #e3e9ee", borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 38, height: 38, borderRadius: 10, background: "#edf4f7", display: "grid", placeItems: "center", color: "#174d68" }}><Users size={19}/></div><div><div style={{ fontSize: 22, fontWeight: 700 }}>{total.toLocaleString("en-GB")}</div><div style={{ fontSize: 12, color: "#71808c" }}>Matching leads</div></div></div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}><label htmlFor="lead-export-source" style={{ fontSize: 13, fontWeight: 600 }}>Lead source</label><select id="lead-export-source" value={source} onChange={event => changeSource(event.target.value)} style={{ minWidth: 220, padding: "10px 12px", border: "1px solid #d9e1e8", borderRadius: 8, background: "#fff" }}><option value="all">All lead sources</option>{sources.map(value => <option key={value} value={value}>{value}</option>)}</select><button type="button" onClick={() => loadLeads(page, source)} disabled={loading} style={{ ...btn, display: "inline-flex", alignItems: "center", gap: 7 }}><RefreshCw size={14}/>Refresh</button></div>
    </div>
    {error && <div role="alert" style={{ padding: 12, marginBottom: 14, borderRadius: 8, background: "#fff1f0", color: "#a12622", border: "1px solid #f2c8c5", fontSize: 13 }}>{error}</div>}
    <div style={{ background: "#fff", border: "1px solid #e3e9ee", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 1150, borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr style={{ background: "#f5f8fa", color: "#536575", textAlign: "left" }}>{["Name","Phone","Secondary Phone","Email","Address","Postcode","Lead Source","Lead Type","Disposition","Received"].map(label => <th key={label} style={{ padding: "13px 12px", borderBottom: "1px solid #e3e9ee", whiteSpace: "nowrap" }}>{label}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan={10} style={{ padding: 30, textAlign: "center" }}>Loading leads...</td></tr> : leads.length === 0 ? <tr><td colSpan={10} style={{ padding: 30, textAlign: "center" }}>No leads found for this filter.</td></tr> : leads.map((row, index) => <tr key={row.received_date_time + "-" + index} style={{ borderBottom: "1px solid #edf1f4" }}>
          <td style={{ padding: "11px 12px", fontWeight: 600, whiteSpace: "nowrap" }}>{[row.salutations,row.first_name,row.last_name].filter(Boolean).join(" ") || "—"}</td><td style={{ padding: "11px 12px", whiteSpace: "nowrap" }}>{row.primary_phone_number || "—"}</td><td style={{ padding: "11px 12px", whiteSpace: "nowrap" }}>{row.secondary_phone_number || "—"}</td><td style={{ padding: "11px 12px" }}>{row.email || "—"}</td><td style={{ padding: "11px 12px" }}>{row.address || "—"}</td><td style={{ padding: "11px 12px", whiteSpace: "nowrap" }}>{row.postcode || "—"}</td><td style={{ padding: "11px 12px", whiteSpace: "nowrap" }}>{row.lead_source || "—"}</td><td style={{ padding: "11px 12px", whiteSpace: "nowrap" }}>{row.lead_type || "—"}</td><td style={{ padding: "11px 12px", whiteSpace: "nowrap" }}>{row.disposition || "—"}</td><td style={{ padding: "11px 12px", whiteSpace: "nowrap" }}>{formatDate(row.received_date_time)}</td>
        </tr>)}</tbody>
      </table></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "13px 16px", borderTop: "1px solid #e3e9ee" }}>
        <span style={{ fontSize: 12, color: "#71808c" }}>Showing {total === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString("en-GB")}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><button type="button" onClick={() => loadLeads(Math.max(0,page-1),source)} disabled={loading || page===0} style={{ ...btn, opacity: loading || page===0 ? .45 : 1 }}>Previous</button><span style={{ fontSize: 12, color: "#536575" }}>Page {page+1} of {pages}</span><button type="button" onClick={() => loadLeads(page+1,source)} disabled={loading || page+1>=pages} style={{ ...btn, opacity: loading || page+1>=pages ? .45 : 1 }}>Next</button></div>
      </div>
    </div>
  </section>
}

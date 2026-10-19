import React from "react"
import { supabase } from "../lib/supabase"
import { RefreshCw, Search, Link2, Unlink, Download, CheckCircle2, AlertCircle } from "lucide-react"

const pageSize = 50

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB")
}

function money(value) {
  if (value == null || value === "") return "—"
  const amount = Number(value)
  return Number.isFinite(amount) ? amount.toLocaleString("en-GB", { style: "currency", currency: "GBP" }) : String(value)
}

export default function EPVSApplications() {
  const [rows, setRows] = React.useState([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(0)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState("all")
  const [loading, setLoading] = React.useState(true)
  const [importing, setImporting] = React.useState(false)
  const [error, setError] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [linkingId, setLinkingId] = React.useState(null)
  const [dealSearch, setDealSearch] = React.useState("")
  const [dealResults, setDealResults] = React.useState([])
  const [dealLoading, setDealLoading] = React.useState(false)
  const [activeRow, setActiveRow] = React.useState(null)

  React.useEffect(() => { loadRows() }, [page, status])

  async function loadRows() {
    setLoading(true)
    setError("")
    let query = supabase.from("epvs_submissions").select("id,epvs_validation_id,customer_full_name,customer_first_name,customer_last_name,customer_phone,customer_email,installation_address,installation_postcode,status,contract_value,contract_signed_at,epvs_created_at,last_synced_at,linked_deal_id,deals:linked_deal_id(contract_number,customer_name)", { count: "exact" })
      .order("epvs_created_at", { ascending: false, nullsFirst: false })
      .range(page * pageSize, page * pageSize + pageSize - 1)
    if (status !== "all") query = query.eq("status", status)
    if (search.trim()) {
      const term = search.trim().replace(/[(),]/g, " ")
      query = query.or(`customer_full_name.ilike.%${term}%,installation_postcode.ilike.%${term}%,customer_email.ilike.%${term}%,customer_phone.ilike.%${term}%,installation_address.ilike.%${term}%,epvs_validation_id.eq.${/^\\d+$/.test(term) ? term : "0"}`)
    }
    const { data, error: loadError, count } = await query
    if (loadError) setError(loadError.message)
    setRows(data || [])
    setTotal(count || 0)
    setLoading(false)
  }

  async function importExisting() {
    setImporting(true)
    setError("")
    setMessage("")
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const token = sessionData?.session?.access_token
      if (!token) throw new Error("Your session has expired. Sign in again.")
      const response = await fetch("/api/epvs/import-existing", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || `Import failed (HTTP ${response.status}).`)
      setMessage(`Import complete: ${result.fetchedFromEpvs} applications fetched and ${result.importedOrUpdated} records inserted or updated.`)
      setPage(0)
      await loadRows()
    } catch (e) {
      setError(e?.message || "Could not import EPVS applications.")
    } finally {
      setImporting(false)
    }
  }

  async function searchDeals(value) {
    setDealSearch(value)
    if (value.trim().length < 2) { setDealResults([]); return }
    setDealLoading(true)
    const term = value.trim().replace(/[(),]/g, " ")
    const { data, error: dealError } = await supabase.from("deals")
      .select("id,contract_number,customer_name,postcode,address,sale_date,deal_value,status")
      .or(`customer_name.ilike.%${term}%,contract_number.ilike.%${term}%,postcode.ilike.%${term}%,address.ilike.%${term}%`)
      .order("sale_date", { ascending: false, nullsFirst: false })
      .limit(25)
    if (dealError) setError(dealError.message)
    setDealResults(data || [])
    setDealLoading(false)
  }

  async function linkDeal(epvsRow, deal) {
    setError("")
    setMessage("")
    const { error: updateError } = await supabase.from("epvs_submissions")
      .update({ linked_deal_id: deal?.id || null, updated_at: new Date().toISOString() })
      .eq("id", epvsRow.id)
    if (updateError) { setError(updateError.message); return }
    setRows(current => current.map(row => row.id === epvsRow.id ? { ...row, linked_deal_id: deal?.id || null } : row))
    setMessage(deal ? `EPVS application #${epvsRow.epvs_validation_id} linked to ${deal.customer_name || deal.contract_number || "the selected deal"}.` : "Deal link removed.")
    setActiveRow(null)
    setDealSearch("")
    setDealResults([])
  }

  const linkedIds = new Set(rows.map(row => row.linked_deal_id).filter(Boolean))

  return <div style={{ padding: "8px 0 30px", color: "#263238", maxWidth: 1600, margin: "0 auto" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 42, height: 42, borderRadius: 10, background: "#f15a24", color: "#fff", display: "grid", placeItems: "center", fontSize: 25, fontWeight: 800 }}>e</div><div><h1 style={{ margin: 0, fontSize: 26, fontWeight: 750, color: "#182230" }}>EPVS Applications</h1><div style={{ marginTop: 2, color: "#f15a24", fontSize: 11, fontWeight: 750, letterSpacing: ".08em", textTransform: "uppercase" }}>Validation Hub</div></div></div>
        <p style={{ margin: "6px 0 0", color: "#667085", fontSize: 14 }}>Import existing Validation Hub applications and link each one to its CRM deal.</p>
      </div>
      <button type="button" onClick={importExisting} disabled={importing} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 15px", border: 0, borderRadius: 9, background: importing ? "#98a2b3" : "#f15a24", color: "#fff", fontWeight: 700, cursor: importing ? "wait" : "pointer" }}>
        {importing ? <RefreshCw size={16} /> : <Download size={16} />}{importing ? "Importing applications…" : "Import existing EPVS applications"}
      </button>
    </div>

    <div style={{ background: "#f15a24", borderRadius: 10, padding: "17px 20px", color: "#fff", marginBottom: 16, boxShadow: "0 3px 8px rgba(241,90,36,.14)" }}>
      <div style={{ fontSize: 12, fontWeight: 750, letterSpacing: ".07em", textTransform: "uppercase" }}>Important notice</div>
      <div style={{ fontSize: 14, marginTop: 5 }}>Application records sync from EPVS Validation Hub when you run an import. Linking a CRM deal does not change the application in EPVS.</div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 16 }}>
      {[
        { label: "Grand total applications", value: total, accent: "#f15a24" },
        { label: "Linked on this page", value: rows.filter(row => row.linked_deal_id).length, accent: "#64a83b" },
        { label: "Awaiting a CRM link", value: rows.filter(row => !row.linked_deal_id).length, accent: "#e4a11b" },
      ].map(item => <div key={item.label} style={{ padding: "17px 18px", border: "1px solid #edf0f2", borderTop: `3px solid ${item.accent}`, borderRadius: 9, background: "#fff", boxShadow: "0 1px 3px rgba(16,24,40,.04)" }}>
        <div style={{ color: "#667085", fontSize: 12 }}>{item.label}</div><div style={{ fontSize: 28, fontWeight: 800, marginTop: 3, color: "#182230" }}>{Number(item.value).toLocaleString("en-GB")}</div>
      </div>)}
    </div>
    {message && <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "12px 14px", marginBottom: 14, borderRadius: 8, background: "#ecfdf3", color: "#027a48", fontSize: 13 }}><CheckCircle2 size={17}/>{message}</div>}
    {error && <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "12px 14px", marginBottom: 14, borderRadius: 8, background: "#fef3f2", color: "#b42318", fontSize: 13 }}><AlertCircle size={17}/>{error}</div>}

    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
      <form onSubmit={e => { e.preventDefault(); setPage(0); loadRows() }} style={{ display: "flex", gap: 8, flex: "1 1 300px", maxWidth: 520 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 10px", flex: 1, border: "1px solid #d0d5dd", borderRadius: 8, background: "#fff" }}><Search size={16} color="#667085"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer, postcode, email, EPVS ID…" style={{ width: "100%", minWidth: 0, border: 0, outline: 0, padding: "10px 0", fontSize: 13 }}/></div>
        <button type="submit" style={{ border: "1px solid #d0d5dd", borderRadius: 8, padding: "0 13px", background: "#fff", fontWeight: 600 }}>Search</button>
      </form>
      <select value={status} onChange={e => { setStatus(e.target.value); setPage(0) }} style={{ border: "1px solid #d0d5dd", borderRadius: 8, padding: "9px 12px", background: "#fff" }}>
        <option value="all">All statuses</option>
        {[...new Set(rows.map(row => row.status).filter(Boolean))].sort().map(value => <option key={value} value={value}>{value}</option>)}
      </select>
    </div>

    <div style={{ border: "1px solid #eaecf0", borderRadius: 10, overflow: "auto", background: "#fff" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 1100 }}>
        <thead><tr>{["EPVS ID", "Customer / contact", "Installation address", "Status", "Contract value", "Signed", "CRM deal", "Action"].map(title => <th key={title} style={{ padding: "12px 10px", background: "#fff7f3", textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid #eaecf0", color: "#8b3b20", fontWeight: 750 }}>{title}</th>)}</tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: "#667085" }}>Loading EPVS applications…</td></tr> :
           rows.length === 0 ? <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: "#667085" }}>No applications found. Use “Import existing EPVS applications” to fetch them from Validation Hub.</td></tr> :
           rows.map(row => <React.Fragment key={row.id}>
            <tr>
              <td style={cell}><strong>#{row.epvs_validation_id}</strong><div style={{ color: "#98a2b3", marginTop: 4 }}>Created {formatDate(row.epvs_created_at)}</div></td>
              <td style={{ ...cell, minWidth: 190 }}><strong>{row.customer_full_name || [row.customer_first_name,row.customer_last_name].filter(Boolean).join(" ") || "Unknown customer"}</strong><div style={{ color: "#667085", marginTop: 4 }}>{row.customer_phone || "No phone"} · {row.customer_email || "No email"}</div></td>
              <td style={{ ...cell, minWidth: 190 }}>{row.installation_address || "—"}<div style={{ color: "#667085", marginTop: 4 }}>{row.installation_postcode || ""}</div></td>
              <td style={cell}><span style={{ display: "inline-block", borderRadius: 99, padding: "4px 8px", background: "#fff0e8", color: "#a33d16", whiteSpace: "nowrap" }}>{row.status || "Unknown"}</span></td>
              <td style={{ ...cell, whiteSpace: "nowrap" }}>{money(row.contract_value)}</td>
              <td style={{ ...cell, whiteSpace: "nowrap" }}>{formatDate(row.contract_signed_at)}</td>
              <td style={{ ...cell, minWidth: 180 }}>{row.linked_deal_id ? <><strong>{row.deals?.contract_number || "Linked"}</strong>{row.deals?.customer_name && <div style={{ color: "#667085", marginTop: 4, fontSize: 11 }}>{row.deals.customer_name}</div>}</> : <span style={{ color: "#b54708" }}>Not linked</span>}</td>
              <td style={{ ...cell, whiteSpace: "nowrap" }}><button type="button" onClick={() => { setActiveRow(activeRow === row.id ? null : row.id); setDealSearch(""); setDealResults([]) }} style={actionButton}><Link2 size={14}/>{row.linked_deal_id ? "Change link" : "Link deal"}</button>{row.linked_deal_id && <button type="button" title="Remove deal link" onClick={() => linkDeal(row, null)} style={{ ...actionButton, marginLeft: 6, color: "#b42318" }}><Unlink size={14}/></button>}</td>
            </tr>
            {activeRow === row.id && <tr><td colSpan={8} style={{ padding: 14, background: "#f9fafb", borderBottom: "1px solid #eaecf0" }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Find the matching CRM deal for EPVS #{row.epvs_validation_id}</div>
              <input value={dealSearch} onChange={e => searchDeals(e.target.value)} placeholder="Search customer name, contract number, postcode or address…" style={{ width: "min(100%, 560px)", boxSizing: "border-box", padding: 10, border: "1px solid #d0d5dd", borderRadius: 8, background: "#fff" }}/>
              {dealLoading && <div style={{ padding: 10, color: "#667085" }}>Searching deals…</div>}
              {!dealLoading && dealSearch.trim().length >= 2 && <div style={{ marginTop: 8, maxWidth: 800, border: "1px solid #eaecf0", borderRadius: 8, background: "#fff", overflow: "hidden" }}>
                {dealResults.length === 0 ? <div style={{ padding: 12, color: "#667085" }}>No matching deals found.</div> : dealResults.map(deal => <div key={deal.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 10, borderBottom: "1px solid #f2f4f7" }}>
                  <div><strong>{deal.customer_name || "Unknown customer"}</strong><div style={{ color: "#667085", marginTop: 3 }}>{deal.contract_number || "No contract number"} · {deal.postcode || deal.address || "No address"} · {formatDate(deal.sale_date)}</div></div>
                  <button type="button" onClick={() => linkDeal(row, deal)} style={actionButton}>Link this deal</button>
                </div>)}
              </div>}
            </td></tr>}
           </React.Fragment>)
          }
        </tbody>
      </table>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 2px", color: "#667085", fontSize: 12 }}>
      <span>{total.toLocaleString("en-GB")} applications · Page {page + 1} of {Math.max(1, Math.ceil(total / pageSize))}</span>
      <div style={{ display: "flex", gap: 8 }}><button type="button" disabled={page === 0 || loading} onClick={() => setPage(p => Math.max(0, p - 1))} style={pageButton}>Previous</button><button type="button" disabled={(page + 1) * pageSize >= total || loading} onClick={() => setPage(p => p + 1)} style={pageButton}>Next</button></div>
    </div>
    <p style={{ fontSize: 12, color: "#667085", marginTop: 8 }}>Only the EPVS-to-deal link is changed when you link a record. EPVS application data is not edited in Validation Hub.</p>
  </div>
}

const cell = { padding: "11px 10px", borderBottom: "1px solid #f2f4f7", verticalAlign: "top" }
const actionButton = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 9px", border: "1px solid #d0d5dd", borderRadius: 7, background: "#fff", color: "#175cd3", fontSize: 12, fontWeight: 650, cursor: "pointer" }
const pageButton = { padding: "7px 11px", border: "1px solid #d0d5dd", borderRadius: 7, background: "#fff", cursor: "pointer" }

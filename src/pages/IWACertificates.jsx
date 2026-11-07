import React, { useCallback, useEffect, useState } from "react"
import { Search, RefreshCw, ShieldCheck, FileText, ChevronLeft, ChevronRight, Link2, X, CheckCircle2 } from "lucide-react"
import { supabase } from "../lib/supabase"

const PAGE_SIZE = 50
const money = value => {
  if (!value) return "—"
  return String(value).trim()
}

const parseAmount = value => {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

const formatCurrency = value => new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
}).format(value)

export default function IWACertificates() {
  const [rows, setRows] = useState([])
  const [counts, setCounts] = useState({ total: 0, unmatched: 0, approved: 0, excluded: 0 })
  const [financialTotals, setFinancialTotals] = useState({ contractValue: 0, premium: 0 })
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [matchingCertificate, setMatchingCertificate] = useState(null)
  const [dealSearch, setDealSearch] = useState("")
  const [dealResults, setDealResults] = useState([])
  const [dealSearchLoading, setDealSearchLoading] = useState(false)
  const [matchSaving, setMatchSaving] = useState(false)
  const [matchError, setMatchError] = useState("")
  const [exactMatchMode, setExactMatchMode] = useState(false)
  const [activeTab, setActiveTab] = useState("sent-unmatched")
  const [toSendRows, setToSendRows] = useState([])
  const [toSendCount, setToSendCount] = useState(0)
  const [toSendSearch, setToSendSearch] = useState("")
  const [toSendPage, setToSendPage] = useState(0)
  const [toSendLoading, setToSendLoading] = useState(false)
  const [toSendError, setToSendError] = useState("")

  const loadCounts = useCallback(async () => {
    const statuses = ["unmatched", "approved", "excluded"]
    const results = await Promise.all(statuses.map(async value => {
      const { count, error: queryError } = await supabase.from("iwa_certificates").select("id", { count: "exact", head: true }).eq("match_status", value)
      if (queryError) throw queryError
      return [value, count || 0]
    }))
    const mapped = Object.fromEntries(results)
    setCounts({ total: results.reduce((sum, [, count]) => sum + count, 0), ...mapped })
    let from = 0
    let contractValue = 0
    let premium = 0
    while (true) {
      const { data, error: totalsError } = await supabase.from("iwa_certificates").select("contract_value,premium").order("certificate_id", { ascending: true }).range(from, from + 999)
      if (totalsError) throw totalsError
      const batch = data || []
      for (const row of batch) { contractValue += parseAmount(row.contract_value); premium += parseAmount(row.premium) }
      if (batch.length < 1000) break
      from += 1000
    }
    setFinancialTotals({ contractValue, premium })
  }, [])

  const loadRows = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError("")
    try {
      let request = supabase.from("iwa_certificates").select("id,certificate_id,installation_type,customer_name,installation_address,cover_period,contract_value,premium,payment_method,issue_date_text,completion_date_text,match_status,deal_row_id", { count: "exact" }).order("issue_date", { ascending: false, nullsFirst: false }).order("certificate_id", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      request = request.eq("match_status", activeTab === "sent-matched" ? "approved" : "unmatched")
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
  }, [page, activeTab, search, loadCounts])

  useEffect(() => { loadRows() }, [loadRows])

  const loadToSend = useCallback(async () => {
    if (!supabase) return
    setToSendLoading(true)
    setToSendError("")
    try {
      let request = supabase.from("deals")
        .select("id,contract_number,customer_name,address,postcode,email,product,deal_value,net_value,sale_date,installation_start_date,salesperson_name,status,iwa_certificates!iwa_certificates_deal_row_id_fkey(id)", { count: "exact" })
        .is("iwa_certificates", null)
        .gte("sale_date", "2024-01-01")
        .eq("product", "Windows")
        .not("installation_start_date", "is", null)
        .gt("net_value", 0)
        .eq("balance_outstanding", 0)
        .order("sale_date", { ascending: false, nullsFirst: false })
        .range(toSendPage * PAGE_SIZE, (toSendPage + 1) * PAGE_SIZE - 1)
      const term = toSendSearch.trim()
      if (term) {
        const safe = term.replace(/[%_]/g, "\\$&").replace(/,/g, "\\,")
        request = request.or(`customer_name.ilike.%${safe}%,contract_number.ilike.%${safe}%,postcode.ilike.%${safe}%,address.ilike.%${safe}%`)
      }
      const { data, error: queryError, count } = await request
      if (queryError) throw queryError
      setToSendRows(data || [])
      setToSendCount(count || 0)
    } catch (err) {
      setToSendError(err?.message || "Unable to load deals awaiting an IWA certificate.")
      setToSendRows([])
      setToSendCount(0)
    } finally {
      setToSendLoading(false)
    }
  }, [toSendPage, toSendSearch])

  useEffect(() => {
    if (activeTab === "to-send") loadToSend()
  }, [activeTab, loadToSend])
  const searchDeals = async value => {
    setExactMatchMode(false)
    setDealSearch(value)
    setMatchError("")
    const term = value.trim()
    if (!matchingCertificate) { setDealResults([]); return }
    const completionParts = String(matchingCertificate.completion_date_text || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (!completionParts) {
      setDealResults([])
      setMatchError("This IWA certificate does not have a valid completion date, so deals cannot be matched.")
      return
    }
    const completionDate = `${completionParts[3]}-${completionParts[2].padStart(2, "0")}-${completionParts[1].padStart(2, "0")}`
    if (term.length < 2) { setDealResults([]); return }
    setDealSearchLoading(true)
    try {
      const safe = term.replace(/[%_]/g, "\\$&").replace(/,/g, "\\,")
      const targetValue = parseAmount(matchingCertificate.contract_value)
      if (!targetValue) { setDealResults([]); setMatchError("This certificate does not have a valid contract value to filter deals."); return }
      const result = await supabase.from("deals")
        .select("id,contract_number,customer_name,address,postcode,product,deal_value,sale_date,status")
        .eq("deal_value", targetValue)
        .not("product", "ilike", "%solar%")
        .or(`customer_name.ilike.%${safe}%,postcode.ilike.%${safe}%,address.ilike.%${safe}%,contract_number.ilike.%${safe}%`)
        .not("sale_date", "is", null)
        .lt("sale_date", completionDate)
        .order("sale_date", { ascending: false }).limit(100)
      if (result.error) throw result.error
      setDealResults((result.data || []).filter(deal => !String(deal.product || "").toLowerCase().includes("solar")))
    } catch (err) {
      setMatchError(err.message || "Unable to search deals.")
      setDealResults([])
    } finally { setDealSearchLoading(false) }
  }

  const findExactMatches = async row => {
    setMatchingCertificate(row)
    setDealSearch(row.customer_name || "")
    setDealResults([])
    setMatchError("")
    setExactMatchMode(true)
    const completionParts = String(row.completion_date_text || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    const targetValue = parseAmount(row.contract_value)
    if (!completionParts || !row.customer_name?.trim() || !targetValue) {
      setMatchError("An exact match needs a customer name, a valid completion date and a contract value greater than £0.")
      return
    }
    const completionDate = `${completionParts[3]}-${completionParts[2].padStart(2, "0")}-${completionParts[1].padStart(2, "0")}`
    setDealSearchLoading(true)
    try {
      const result = await supabase.from("deals")
        .select("id,contract_number,customer_name,address,postcode,product,deal_value,sale_date,status")
        .ilike("customer_name", row.customer_name.trim())
        .not("sale_date", "is", null)
        .lt("sale_date", completionDate)
        .order("sale_date", { ascending: false }).limit(100)
      if (result.error) throw result.error
      const normalizedName = row.customer_name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-GB")
      const exact = (result.data || []).filter(deal =>
        String(deal.customer_name || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-GB") === normalizedName &&
        Number(deal.deal_value) === targetValue
      )
      setDealResults(exact)
      if (!exact.length) setMatchError("No exact matches found. Customer name and deal value must both match, and the deal must have been sold before the certificate completion date.")
    } catch (err) {
      setMatchError(err.message || "Unable to check exact matches.")
      setDealResults([])
    } finally { setDealSearchLoading(false) }
  }

  const approveMatch = async deal => {
    if (!matchingCertificate) return
    setMatchSaving(true)
    setMatchError("")
    const result = await supabase.from("iwa_certificates")
      .update({ deal_row_id: deal.id, match_status: "approved" })
      .eq("id", matchingCertificate.id)
    setMatchSaving(false)
    if (result.error) { setMatchError(result.error.message); return }
    setMatchingCertificate(null)
    setDealSearch("")
    setDealResults([])
    await loadRows()
  }

  const removeMatch = async row => {
    if (!window.confirm("Remove this deal link and return the certificate to awaiting match?")) return
    const result = await supabase.from("iwa_certificates")
      .update({ deal_row_id: null, match_status: "unmatched" }).eq("id", row.id)
    if (result.error) setError(result.error.message)
    else await loadRows()
  }


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

      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #e3e8ec", marginBottom: 18 }}>
        <button onClick={() => { setActiveTab("sent-unmatched"); setPage(0) }} style={{ border: 0, borderBottom: activeTab === "sent-unmatched" ? "3px solid #23445c" : "3px solid transparent", background: "transparent", padding: "11px 16px", color: activeTab === "sent-unmatched" ? "#23445c" : "#6f7b85", fontWeight: 650, cursor: "pointer" }}>Sent - Unmatched <span style={{ marginLeft: 6, background: "#edf2f6", borderRadius: 12, padding: "2px 7px", fontSize: 11 }}>{counts.unmatched.toLocaleString("en-GB")}</span></button>
        <button onClick={() => { setActiveTab("sent-matched"); setPage(0) }} style={{ border: 0, borderBottom: activeTab === "sent-matched" ? "3px solid #23445c" : "3px solid transparent", background: "transparent", padding: "11px 16px", color: activeTab === "sent-matched" ? "#23445c" : "#6f7b85", fontWeight: 650, cursor: "pointer" }}>Sent - Matched <span style={{ marginLeft: 6, background: "#edf2f6", borderRadius: 12, padding: "2px 7px", fontSize: 11 }}>{counts.approved.toLocaleString("en-GB")}</span></button>
        <button onClick={() => setActiveTab("to-send")} style={{ border: 0, borderBottom: activeTab === "to-send" ? "3px solid #23445c" : "3px solid transparent", background: "transparent", padding: "11px 16px", color: activeTab === "to-send" ? "#23445c" : "#6f7b85", fontWeight: 650, cursor: "pointer" }}>To Send <span style={{ marginLeft: 6, background: "#edf2f6", borderRadius: 12, padding: "2px 7px", fontSize: 11 }}>{toSendCount.toLocaleString("en-GB")}</span></button>
      </div>
      {activeTab !== "to-send" && <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(175px,1fr))", gap: 12, marginBottom: 20 }}>
        {card("Total certificates", counts.total, <FileText size={19}/>, "#edf3f8")}
        {card("Awaiting match", counts.unmatched, <Search size={19}/>, "#fff5df")}
        {card("Approved matches", counts.approved, <ShieldCheck size={19}/>, "#e8f6ee")}
        {card("Excluded", counts.excluded, <FileText size={19}/>, "#f1f2f4")}
        {card("Total contract value", formatCurrency(financialTotals.contractValue), <span style={{fontSize:19,fontWeight:700}}>£</span>, "#edf3f8")}
        {card("Total premium", formatCurrency(financialTotals.premium), <span style={{fontSize:19,fontWeight:700}}>£</span>, "#e8f6ee")}
      </div>

      <div style={{ background: "#fff", border: "1px solid #e7ebef", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: 15, display: "flex", gap: 10, flexWrap: "wrap", borderBottom: "1px solid #edf0f2" }}>
          <div style={{ flex: "1 1 280px", position: "relative" }}><Search size={16} style={{ position: "absolute", left: 11, top: 11, color: "#8a949d" }}/><input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="Search certificate, customer or address..." style={{ width: "100%", boxSizing: "border-box", border: "1px solid #dce2e7", borderRadius: 8, padding: "9px 10px 9px 34px", fontSize: 13 }}/></div>

        </div>
        {error && <div style={{ padding: 14, color: "#b42318", background: "#fff4f2", fontSize: 13 }}>{error}</div>}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1120, fontSize: 12 }}>
            <thead><tr style={{ background: "#f8fafb", color: "#66727d", textAlign: "left" }}>
              {["Certificate ID","Customer / Installation address","Installation type","Cover period","Contract value","Premium","Payment method","Match status"].map(label => <th key={label} style={{ padding: "12px 13px", fontWeight: 650, whiteSpace: "nowrap", borderBottom: "1px solid #e9edf0" }}>{label}</th>)}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="9" style={{ padding: 30, textAlign: "center", color: "#7b858e" }}>Loading certificates…</td></tr> : rows.length === 0 ? <tr><td colSpan="8" style={{ padding: 30, textAlign: "center", color: "#7b858e" }}>No certificates found.</td></tr> : rows.map(row => <tr key={row.id} style={{ borderBottom: "1px solid #eef1f3" }}>
                <td style={{ padding: "12px 13px", fontWeight: 650, whiteSpace: "nowrap", color: "#23445c" }}>{row.certificate_id}</td>
                <td style={{ padding: "12px 13px", maxWidth: 300 }}><div style={{ fontWeight: 600 }}>{row.customer_name || "—"}</div><div style={{ color: "#7b858e", marginTop: 3 }}>{row.installation_address || "—"}</div></td>
                <td style={{ padding: "12px 13px" }}>{row.installation_type || "—"}</td>
                <td style={{ padding: "12px 13px", whiteSpace: "nowrap" }}>{row.cover_period || "—"}</td>
                <td style={{ padding: "12px 13px", whiteSpace: "nowrap" }}>{money(row.contract_value)}</td>
                <td style={{ padding: "12px 13px", whiteSpace: "nowrap" }}>{money(row.premium)}</td>
                <td style={{ padding: "12px 13px" }}>{row.payment_method || "—"}</td>
                <td style={{ padding: "12px 13px" }}><span style={{ display: "inline-block", borderRadius: 20, padding: "4px 9px", background: row.match_status === "approved" ? "#e8f6ee" : row.match_status === "excluded" ? "#f1f2f4" : "#fff5df", color: row.match_status === "approved" ? "#187044" : row.match_status === "excluded" ? "#626b73" : "#8b5a00", whiteSpace: "nowrap", fontWeight: 600 }}>{row.match_status === "unmatched" ? "Awaiting match" : row.match_status}</span></td>
                <td style={{ padding: "12px 13px", whiteSpace: "nowrap" }}>
                  {row.deal_row_id
                    ? <button onClick={() => removeMatch(row)} style={{ border: "1px solid #dce2e7", borderRadius: 7, padding: "6px 9px", background: "#fff", color: "#a33b35", cursor: "pointer" }}>Remove link</button>
                    : <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => findExactMatches(row)} style={{ border: "1px solid #b8d8c7", borderRadius: 7, padding: "6px 9px", background: "#f0faf4", color: "#176b45", cursor: "pointer", whiteSpace: "nowrap" }}>Exact match</button>
                      <button onClick={() => { setMatchingCertificate(row); setDealSearch(row.customer_name || ""); setDealResults([]); setMatchError(""); setExactMatchMode(false); }} style={{ border: "1px solid #cbd8e2", borderRadius: 7, padding: "6px 9px", background: "#f5f9fc", color: "#23445c", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><Link2 size={13}/> Find Deal</button>
                    </div>}
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px 15px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderTop: "1px solid #edf0f2", color: "#77818b", fontSize: 12 }}>
          <span>Showing {rows.length ? page * PAGE_SIZE + 1 : 0}–{page * PAGE_SIZE + rows.length} of {activeTab === "sent-matched" ? counts.approved : counts.unmatched}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={page === 0 || loading} onClick={() => setPage(value => Math.max(0, value - 1))} style={{ border: "1px solid #dce2e7", borderRadius: 7, padding: "7px 10px", background: "#fff", cursor: "pointer", opacity: page === 0 ? .45 : 1 }}><ChevronLeft size={15}/></button>
            <button disabled={loading || rows.length < PAGE_SIZE} onClick={() => setPage(value => value + 1)} style={{ border: "1px solid #dce2e7", borderRadius: 7, padding: "7px 10px", background: "#fff", cursor: "pointer", opacity: rows.length < PAGE_SIZE ? .45 : 1 }}><ChevronRight size={15}/></button>
          </div>
        </div>
      </div>

      </>}

      {activeTab === "to-send" && <div style={{ background: "#fff", border: "1px solid #e7ebef", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: 15, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", borderBottom: "1px solid #edf0f2" }}>
          <div style={{ flex: "1 1 320px", position: "relative" }}><Search size={16} style={{ position: "absolute", left: 11, top: 11, color: "#8a949d" }}/><input value={toSendSearch} onChange={e => { setToSendSearch(e.target.value); setToSendPage(0) }} placeholder="Search customer, contract, postcode or address..." style={{ width: "100%", boxSizing: "border-box", border: "1px solid #dce2e7", borderRadius: 8, padding: "9px 10px 9px 34px", fontSize: 13 }}/></div>
          <button onClick={loadToSend} disabled={toSendLoading} style={{ border: "1px solid #dce2e7", borderRadius: 8, background: "#fff", padding: "9px 13px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#34495a" }}><RefreshCw size={15}/> Refresh</button>
        </div>
        {toSendError && <div style={{ padding: 14, color: "#b42318", background: "#fff4f2", fontSize: 13 }}>{toSendError}</div>}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1250, fontSize: 12 }}>
            <thead><tr style={{ background: "#f8fafb", color: "#66727d", textAlign: "left" }}>
              {["Customer Name","Address","Email Address","Deposit Amount","Date Deposit Paid","Type of Install","Date of Completion","Total Contract Value","Other Information"].map(label => <th key={label} style={{ padding: "12px 13px", fontWeight: 650, whiteSpace: "nowrap", borderBottom: "1px solid #e9edf0" }}>{label}</th>)}
            </tr></thead>
            <tbody>
              {toSendLoading ? <tr><td colSpan="9" style={{ padding: 30, textAlign: "center", color: "#7b858e" }}>Loading deals…</td></tr> : toSendRows.length === 0 ? <tr><td colSpan="9" style={{ padding: 30, textAlign: "center", color: "#7b858e" }}>No deals awaiting an IWA certificate.</td></tr> : toSendRows.map(deal => <tr key={deal.id} style={{ borderBottom: "1px solid #eef1f3" }}>
                <td style={{ padding: "12px 13px", fontWeight: 600 }}>{deal.customer_name || "—"}</td>
                <td style={{ padding: "12px 13px", color: "#66727d", minWidth: 260 }}>{[deal.address, deal.postcode].filter(Boolean).join(", ") || "—"}</td>
                <td style={{ padding: "12px 13px" }}>{deal.email || "—"}</td>
                <td style={{ padding: "12px 13px", whiteSpace: "nowrap" }}>N/A</td>
                <td style={{ padding: "12px 13px", whiteSpace: "nowrap" }}>N/A</td>
                <td style={{ padding: "12px 13px" }}>{deal.product || "—"}</td>
                <td style={{ padding: "12px 13px", whiteSpace: "nowrap" }}>N/A</td>
                <td style={{ padding: "12px 13px", whiteSpace: "nowrap" }}>{deal.deal_value == null ? "—" : formatCurrency(Number(deal.deal_value))}</td>
                <td style={{ padding: "12px 13px" }}>N/A</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px 15px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderTop: "1px solid #edf0f2", color: "#77818b", fontSize: 12 }}>
          <span>Showing {toSendRows.length ? toSendPage * PAGE_SIZE + 1 : 0}–{toSendPage * PAGE_SIZE + toSendRows.length} of {toSendCount.toLocaleString("en-GB")}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={toSendPage === 0 || toSendLoading} onClick={() => setToSendPage(value => Math.max(0, value - 1))} style={{ border: "1px solid #dce2e7", borderRadius: 7, padding: "7px 10px", background: "#fff", cursor: "pointer", opacity: toSendPage === 0 ? .45 : 1 }}><ChevronLeft size={15}/></button>
            <button disabled={toSendLoading || toSendRows.length < PAGE_SIZE} onClick={() => setToSendPage(value => value + 1)} style={{ border: "1px solid #dce2e7", borderRadius: 7, padding: "7px 10px", background: "#fff", cursor: "pointer", opacity: toSendRows.length < PAGE_SIZE ? .45 : 1 }}><ChevronRight size={15}/></button>
          </div>
        </div>
      </div>}

      {matchingCertificate && <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,25,35,.48)", display: "flex", justifyContent: "center", alignItems: "center", padding: 18 }}>
        <div style={{ background: "#fff", borderRadius: 14, width: "min(900px,100%)", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.22)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: 18, borderBottom: "1px solid #e9edf0" }}>
            <div><h2 style={{ margin: 0, fontSize: 19 }}>{exactMatchMode ? "Exact IWA deal matches" : "Match IWA certificate"}</h2><div style={{ color: "#77818b", fontSize: 12 }}>Certificate {matchingCertificate.certificate_id}</div></div>
            <button onClick={() => setMatchingCertificate(null)} style={{ border: 0, background: "transparent", cursor: "pointer" }}><X size={20}/></button>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ background: "#f7f9fb", border: "1px solid #e8edf1", borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <strong>{matchingCertificate.customer_name || "Customer not recorded"}</strong>
              <div style={{ color: "#66727d", fontSize: 13 }}>{matchingCertificate.installation_address || "Address not recorded"}</div>
              <div style={{ fontSize: 12, color: "#66727d", marginTop: 8 }}>Type: {matchingCertificate.installation_type || "—"} · Completed: {matchingCertificate.completion_date_text || "—"} · Contract: {money(matchingCertificate.contract_value)} · Premium: {money(matchingCertificate.premium)}</div>
            </div>
            {!exactMatchMode && <>
              <div style={{ fontSize: 12, color: "#66727d", marginBottom: 8 }}>Deal value filter: <strong>{formatCurrency(parseAmount(matchingCertificate.contract_value))}</strong> · Solar deals are excluded · Sold before completion date</div>
              <input value={dealSearch} onChange={e => searchDeals(e.target.value)} placeholder="Search customer, postcode, address or contract number…" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #dce2e7", borderRadius: 8, padding: 11 }}/>
            </>}
            {exactMatchMode && <div style={{ color: "#66727d", fontSize: 12, marginTop: 8 }}>Exact criteria: customer name and deal value match; sold date is before completion date. IWA value: {money(matchingCertificate.contract_value)} · Completion: {matchingCertificate.completion_date_text || "—"}</div>}
            {matchError && <div style={{ color: exactMatchMode && dealResults.length === 0 ? "#8b5a00" : "#b42318", marginTop: 10 }}>{matchError}</div>}
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {dealSearchLoading ? <div>Searching deals…</div> : dealResults.length === 0 ? <div style={{ color: "#77818b", padding: 16 }}>{exactMatchMode ? "No exact matches found." : "No eligible deals found. Deals must have a sold date before the IWA completion date."}</div> : dealResults.map(deal => <div key={deal.id} style={{ border: "1px solid #e5eaee", borderRadius: 9, padding: 12, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div><strong>{deal.customer_name || "Unnamed customer"} · {deal.contract_number || "No contract number"}</strong><div style={{ fontSize: 12, color: "#77818b" }}>{[deal.address, deal.postcode].filter(Boolean).join(", ")} · {deal.product || "Product not specified"}</div><div style={{ fontSize: 11, color: "#77818b" }}>{deal.sale_date || "No sale date"} · {deal.status || "No status"}</div></div>
                <button disabled={matchSaving} onClick={() => approveMatch(deal)} style={{ background: "#176b45", color: "#fff", border: 0, borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}><CheckCircle2 size={14}/> {matchSaving ? "Saving…" : "Approve Match"}</button>
              </div>)}
            </div>
            <div style={{ fontSize: 11, color: "#77818b", marginTop: 14 }}>The deal row ID is only saved after you select Approve Match.</div>
          </div>
        </div>
      </div>}
    </div>
  )
}

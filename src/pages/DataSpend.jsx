import React, { useCallback, useEffect, useState } from "react"
import { RefreshCw, Search, Save, ChevronLeft, ChevronRight } from "lucide-react"
import { supabase } from "../lib/supabase"

const PAGE_SIZE = 100
const money = value => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value || 0))
const date = value => value ? new Date(value).toLocaleDateString("en-GB") : "—"
const clean = value => String(value ?? "").trim()

function DataSpend() {
  const [activeTab, setActiveTab] = useState("missing")
  const [rows, setRows] = useState([])
  const [costs, setCosts] = useState({})
  const [search, setSearch] = useState("")
  const [hotkeyFilter, setHotkeyFilter] = useState("")
  const [sourceFilter, setSourceFilter] = useState("")
  const [hotkeyOptions, setHotkeyOptions] = useState([])
  const [sourceOptions, setSourceOptions] = useState([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState({})
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const loadRows = useCallback(async (nextPage = page, searchValue = search, hotkeyValue = hotkeyFilter, sourceValue = sourceFilter, tabValue = activeTab) => {
    if (!supabase) return
    setLoading(true)
    setError("")
    setNotice("")
    try {
      // Hotkey returns are not chargeable: automatically set their missing lead cost to £0.
      const { error: autoCostError } = await supabase.from("leads")
        .update({ lead_cost: 0 })
        .eq("hotkey_status", "Return Accepted")
        .is("lead_cost", null)
        .gte("received_date_time", "2026-01-01T00:00:00")
        .lt("received_date_time", "2027-01-01T00:00:00")
      if (autoCostError) throw autoCostError

      let request = supabase.from("leads")
        .select("delete_row_id,marketing_row_id,first_name,last_name,primary_phone_number,email,postcode,lead_source,introducer,pronto_SID,pronto_c3,disposition,hotkey_status,received_date_time,lead_cost", { count: "exact" })
                .gte("received_date_time", "2026-01-01T00:00:00")
        .lt("received_date_time", "2027-01-01T00:00:00")
      request = tabValue === "spent" ? request.not("lead_cost", "is", null) : request.is("lead_cost", null)
      if (hotkeyValue) request = request.eq("hotkey_status", hotkeyValue)
      if (sourceValue) request = request.eq("lead_source", sourceValue)
      request = request.order("received_date_time", { ascending: false, nullsFirst: false })
      const term = clean(searchValue)
      if (term) {
        const escaped = term.replace(/[%_]/g, "\\$&").replace(/,/g, "\\,")
        request = request.or(`first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,postcode.ilike.%${escaped}%,primary_phone_number.ilike.%${escaped}%,email.ilike.%${escaped}%,lead_source.ilike.%${escaped}%,introducer.ilike.%${escaped}%,pronto_c3.ilike.%${escaped}%`)
      }
      const from = nextPage * PAGE_SIZE
      const { data, count, error: queryError } = await request.range(from, from + PAGE_SIZE - 1)
      if (queryError) throw queryError
      const nextRows = data || []
      setRows(nextRows)
      setTotal(count || 0)
      setPage(nextPage)
      setCosts(current => {
        const next = { ...current }
        nextRows.forEach(row => {
          const key = `${row.delete_row_id}:${row.marketing_row_id}`
          if (next[key] === undefined) next[key] = ""
        })
        return next
      })
    } catch (err) {
      console.error("Unable to load leads missing acquisition cost:", err)
      setError(err?.message || "Unable to load leads.")
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, search, hotkeyFilter, sourceFilter])

  useEffect(() => {
    async function loadFilterOptions() {
      if (!supabase) return
      const { data, error: optionsError } = await supabase.from("leads")
        .select("hotkey_status,lead_source")
        .is("lead_cost", null)
        .gte("received_date_time", "2026-01-01T00:00:00")
        .lt("received_date_time", "2027-01-01T00:00:00")
        .range(0, 9999)
      if (optionsError) {
        console.error("Unable to load Data Spend filter options:", optionsError)
        return
      }
      const values = data || []
      setHotkeyOptions([...new Set(values.map(row => row.hotkey_status).filter(value => clean(value)))].sort((a, b) => a.localeCompare(b)))
      setSourceOptions([...new Set(values.map(row => row.lead_source).filter(value => clean(value)))].sort((a, b) => a.localeCompare(b)))
    }
    loadFilterOptions()
  }, [])

  useEffect(() => { loadRows(0, "", "", "") }, [])

  const saveCost = async row => {
    const key = `${row.delete_row_id}:${row.marketing_row_id}`
    const raw = clean(costs[key])
    if (!raw || !Number.isFinite(Number(raw)) || Number(raw) < 0) {
      setError("Enter a valid lead cost of £0 or more.")
      return
    }
    setSaving(current => ({ ...current, [key]: true }))
    setError("")
    setNotice("")
    try {
      let updateRequest = supabase.from("leads")
        .update({ lead_cost: Number(Number(raw).toFixed(2)), lead_cost_source: "manual" })
        .eq("delete_row_id", row.delete_row_id)
        .eq("marketing_row_id", row.marketing_row_id)
      if (activeTab === "missing") updateRequest = updateRequest.is("lead_cost", null)
      const { data, error: updateError } = await updateRequest.select("marketing_row_id")
      if (updateError) throw updateError
      if (!data?.length) throw new Error("This lead was updated elsewhere or could not be saved. Refresh the list and try again.")
      if (activeTab === "missing") {
        setRows(current => current.filter(item => !(item.delete_row_id === row.delete_row_id && item.marketing_row_id === row.marketing_row_id)))
        setTotal(current => Math.max(0, current - 1))
      } else {
        setRows(current => current.map(item => item.delete_row_id === row.delete_row_id && item.marketing_row_id === row.marketing_row_id ? { ...item, lead_cost: Number(Number(raw).toFixed(2)), lead_cost_source: "manual" } : item))
      }
      setNotice(`Lead cost saved as ${money(raw)}.`)
    } catch (err) {
      setError(err?.message || "Unable to save lead cost.")
    } finally {
      setSaving(current => ({ ...current, [key]: false }))
    }
  }

  const th = { position: "sticky", top: 0, zIndex: 1, background: "#f8fafc", padding: "11px 10px", textAlign: "left", color: "#64748b", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", borderBottom: "1px solid #dbe2ea" }
  const td = { padding: "10px", color: "#172033", fontSize: 12, borderBottom: "1px solid #edf1f5", whiteSpace: "nowrap" }

  return <div style={{ background: "#f5f7fa", minHeight: "calc(100vh - 60px)", margin: "-24px -32px", color: "#172033" }}>
    <section style={{ background: "linear-gradient(115deg,#062b45 0%,#0b3a59 100%)", color: "#fff", padding: "25px 28px 22px" }}>
      <div style={{ fontSize: 10, letterSpacing: ".14em", fontWeight: 700, color: "#9db7c9", textTransform: "uppercase", marginBottom: 7 }}>Digital Team · Data Management</div>
      <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.15, fontWeight: 750 }}>Data Spend</h1>
      <p style={{ margin: "7px 0 0", fontSize: 12, color: "#c3d4e0" }}>Leads that are missing an acquisition cost</p>
      <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
        <div style={{ background: "#fff", color: "#102a43", borderRadius: 10, padding: "13px 17px", minWidth: 175 }}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 650 }}>{activeTab === "missing" ? "Leads missing cost" : "Leads with spend"}</div>
          <div style={{ fontSize: 27, fontWeight: 750, marginTop: 3 }}>{loading ? "—" : total.toLocaleString("en-GB")}</div>
        </div>
      </div>
    </section>
    <section style={{ padding: "16px 22px 28px" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, borderBottom: "1px solid #dbe2ea" }}>
        {[{ id: "missing", label: "Missing cost" }, { id: "spent", label: "Leads with spend" }].map(tab => <button key={tab.id} type="button" onClick={() => { setActiveTab(tab.id); loadRows(0, search, hotkeyFilter, sourceFilter, tab.id) }} style={{ padding: "10px 15px", border: 0, borderBottom: activeTab === tab.id ? "2px solid #0b3a59" : "2px solid transparent", background: "transparent", color: activeTab === tab.id ? "#0b3a59" : "#64748b", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{tab.label}</button>)}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ position: "relative", flex: "1 1 320px", maxWidth: 520 }}>
          <Search size={15} style={{ position: "absolute", left: 11, top: 11, color: "#94a3b8" }}/>
          <input value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === "Enter") loadRows(0, search) }} placeholder="Search name, postcode, phone, source or advert…" style={{ width: "100%", boxSizing: "border-box", height: 37, border: "1px solid #d5dee8", borderRadius: 8, padding: "0 12px 0 34px", background: "#fff", color: "#172033", fontSize: 12 }}/>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select aria-label="Filter by hotkey status" value={hotkeyFilter} onChange={event => { setHotkeyFilter(event.target.value); loadRows(0, search, event.target.value, sourceFilter) }} style={{ height: 37, border: "1px solid #d5dee8", borderRadius: 8, padding: "0 10px", background: "#fff", color: "#334155", fontSize: 12 }}>
            <option value="">All hotkey statuses</option>
            {hotkeyOptions.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          <select aria-label="Filter by lead source" value={sourceFilter} onChange={event => { setSourceFilter(event.target.value); loadRows(0, search, hotkeyFilter, event.target.value) }} style={{ height: 37, border: "1px solid #d5dee8", borderRadius: 8, padding: "0 10px", background: "#fff", color: "#334155", fontSize: 12 }}>
            <option value="">All lead sources</option>
            {sourceOptions.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          <button type="button" onClick={() => loadRows(0, search)}  disabled={loading} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid #d5dee8", borderRadius: 7, padding: "8px 12px", background: "#fff", color: "#334155", cursor: "pointer" }}><Search size={14}/>Search</button>
          <button type="button" onClick={() => loadRows(page, search)} disabled={loading} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid #d5dee8", borderRadius: 7, padding: "8px 12px", background: "#fff", color: "#334155", cursor: "pointer" }}><RefreshCw size={14}/>Refresh</button>
        </div>
      </div>
      {error && <div style={{ padding: 11, marginBottom: 10, borderRadius: 8, background: "#fff1f2", color: "#be123c", fontSize: 12 }}>{error}</div>}
      {notice && <div style={{ padding: 11, marginBottom: 10, borderRadius: 8, background: "#ecfdf5", color: "#047857", fontSize: 12 }}>{notice}</div>}
      <div style={{ overflow: "auto", maxHeight: "calc(100vh - 330px)", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 9 }}>
        <table style={{ width: "100%", minWidth: 1250, borderCollapse: "separate", borderSpacing: 0 }}>
          <thead><tr>{["Received", "Lead name", "Postcode", "Lead source", "Introducer", "SID", "C3 / Advert", "Disposition", "Hotkey status", "Lead cost", "Action"].map(label => <th key={label} style={th}>{label}</th>)}</tr></thead>
          <tbody>
            {rows.map(row => {
              const key = `${row.delete_row_id}:${row.marketing_row_id}`
              return <tr key={key}>
                <td style={td}>{date(row.received_date_time)}</td>
                <td style={{ ...td, fontWeight: 650 }}>{[row.first_name, row.last_name].map(clean).filter(Boolean).join(" ") || "—"}</td>
                <td style={td}>{row.postcode || "—"}</td>
                <td style={td}>{row.lead_source || "—"}</td>
                <td style={td}>{row.introducer || "—"}</td>
                <td style={td}>{row.pronto_SID || "—"}</td>
                <td style={td}>{row.pronto_c3 || "—"}</td>
                <td style={td}>{row.disposition || "—"}</td>
                <td style={td}>{row.hotkey_status || "—"}</td>
                <td style={td}><div style={{ display: "flex", alignItems: "center", gap: 5 }}><span>£</span><input aria-label={`Lead cost for ${row.marketing_row_id}`} type="number" min="0" step="0.01" value={costs[key] ?? (row.lead_cost ?? "")} onChange={event => setCosts(current => ({ ...current, [key]: event.target.value }))} placeholder="0.00" style={{ width: 90, padding: "7px 8px", border: "1px solid #cbd5e1", borderRadius: 6, color: "#172033", fontSize: 12 }}/></div></td>
                <td style={td}><button type="button" onClick={() => saveCost(row)} disabled={!!saving[key]} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: 0, borderRadius: 6, padding: "7px 10px", background: "#0b3a59", color: "#fff", fontSize: 11, fontWeight: 650, cursor: "pointer", opacity: saving[key] ? .6 : 1 }}><Save size={13}/>{saving[key] ? "Saving…" : "Save"}</button></td>
              </tr>
            })}
            {!loading && !rows.length && <tr><td colSpan={11} style={{ ...td, textAlign: "center", padding: 30, color: "#64748b" }}>{activeTab === "missing" ? "No leads are missing an acquisition cost." : "No leads with spend found."}</td></tr>}
            {loading && <tr><td colSpan={11} style={{ ...td, textAlign: "center", padding: 24, color: "#64748b" }}>Loading leads…</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        <span style={{ color: "#64748b", fontSize: 11 }}>Showing {total ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString("en-GB")} {activeTab === "missing" ? "leads missing a cost" : "leads with spend"}</span>
        <div style={{ display: "flex", gap: 7 }}>
          <button type="button" onClick={() => loadRows(Math.max(0, page - 1), search)} disabled={loading || page === 0} style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid #d5dee8", borderRadius: 7, padding: "7px 10px", background: "#fff", color: "#334155", cursor: "pointer", opacity: page === 0 ? .5 : 1 }}><ChevronLeft size={14}/>Previous</button>
          <button type="button" onClick={() => loadRows(page + 1, search)} disabled={loading || (page + 1) * PAGE_SIZE >= total} style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid #d5dee8", borderRadius: 7, padding: "7px 10px", background: "#fff", color: "#334155", cursor: "pointer", opacity: (page + 1) * PAGE_SIZE >= total ? .5 : 1 }}>Next<ChevronRight size={14}/></button>
        </div>
      </div>
    </section>
  </div>
}

export default DataSpend

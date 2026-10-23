import React, { useEffect, useMemo, useRef, useState } from "react"
import { ExternalLink, Link2, RefreshCw, Search, Sun, UserRound } from "lucide-react"
import { supabase } from "../lib/supabase"

const PAGE_SIZE = 50

function normalise(value) { return String(value ?? "").trim() }
function normaliseResult(value) { return normalise(value).replace(/\s+/g, " ").toUpperCase() }
function getQuoteStages(row) {
  let calculation = row?.epvs_calculation || null
  if (typeof calculation === "string") {
    try { calculation = JSON.parse(calculation) } catch { calculation = null }
  }
  const data = calculation?.data || {}
  const present = key => data[key] !== null && data[key] !== undefined && String(data[key]).trim() !== ""
  const electricityComplete = ["annualConsumption", "importRate", "exportRate", "standingCharge"].every(present) &&
    Number(data.annualConsumption) > 0 &&
    ["importRate", "exportRate", "standingCharge"].every(key => Number.isFinite(Number(data[key])) && Number(data[key]) >= 0) &&
    (!data.existingSolar || (present("existingGeneration") && Number(data.existingGeneration) >= 0))
  const openSolar = data.openSolar || {}
  const osArrays = Array.isArray(openSolar.arrays) ? openSolar.arrays : []
  const arrays = Array.isArray(data.arrays) ? data.arrays : []
  const designComplete = [...osArrays, ...arrays].some(array => Number(array?.panelCount || 0) > 0 && Number(array?.panelWattage || array?.panel_wattage || 0) > 0)
  const rateKeys = ["fluxDayImport", "fluxDayExport", "fluxImport", "fluxExport", "fluxPeakImport", "fluxPeakExport", "fluxStandingCharge"]
  const hasRates = rateKeys.some(key => present(key) && Number.isFinite(Number(data[key])) && Number(data[key]) > 0)
  const octopusComplete = Boolean(data.fluxRatesRetrievedAt || data.fluxImportTariffCode || data.fluxExportTariffCode) && hasRates
  const systemCostComplete = present("systemCost") && Number.isFinite(Number(data.systemCost)) && Number(data.systemCost) > 0
  return [
    { label: "Current electricity", complete: electricityComplete },
    { label: "OpenSolar design", complete: designComplete },
    { label: "Octopus rates", complete: octopusComplete },
    { label: "System cost", complete: systemCostComplete },
  ]
}
function startOfCurrentWeekISO() {
  const now = new Date()
  const day = (now.getDay() + 6) % 7
  now.setDate(now.getDate() - day)
  now.setHours(0, 0, 0, 0)
  return now.toISOString().slice(0, 10)
}
function dateLabel(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

export default function SolarRework({ onSelectAppointment }) {
  const [rows, setRows] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [linkedCount, setLinkedCount] = useState(0)
  const [tabCounts, setTabCounts] = useState({ unlinked: null, linked: null })
  const [hasMore, setHasMore] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [rowEdits, setRowEdits] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [yearFilter, setYearFilter] = useState("all")
  const [unlinkedSortOrder, setUnlinkedSortOrder] = useState("desc")
  const [page, setPage] = useState(0)
  const [activeTab, setActiveTab] = useState("unlinked")
  const [linkedReadinessTab, setLinkedReadinessTab] = useState("not-ready")
  const loadRequestId = useRef(0)

  async function loadRows(targetPage = page) {
    const requestId = ++loadRequestId.current
    if (activeTab === "quotes-sent") { setRows([]); setHasMore(false); setError(""); setLoading(false); return }
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return }
    setLoading(true)
    setRows([])
    setError("")
    try {
      let request = supabase.from("appointments")
        .select("appointment_row_id,marketing_row_id,name,postcode,address,phone_number_1,secondary_phone_number,email_address,appointment_date,result,job_type,product,open_solar_id,epvs_calculation,rep_allocated")
        .eq("job_type", "Solar")
        .not("rep_allocated", "is", null)
        .neq("rep_allocated", "")
        .lt("appointment_date", startOfCurrentWeekISO())
        .in("result", ["PM", "PM DNH"])
        .order("appointment_date", { ascending: activeTab === "linked" ? true : unlinkedSortOrder === "asc", nullsFirst: false })
        .order("appointment_row_id", { ascending: false })
      if (activeTab === "unlinked") {
        request = request.is("open_solar_id", null)
        if (yearFilter !== "all") request = request.gte("appointment_date", yearFilter + "-01-01").lt("appointment_date", (Number(yearFilter) + 1) + "-01-01")
        request = request.range(targetPage * PAGE_SIZE, targetPage * PAGE_SIZE + PAGE_SIZE - 1)
      } else {
        request = request.not("open_solar_id", "is", null).range(targetPage * PAGE_SIZE, targetPage * PAGE_SIZE + PAGE_SIZE - 1)
      }
      const needle = normalise(query).replace(/[%_,()]/g, " ")
      if (needle) request = request.or("name.ilike.%" + needle + "%,postcode.ilike.%" + needle + "%,address.ilike.%" + needle + "%,phone_number_1.ilike.%" + needle + "%,secondary_phone_number.ilike.%" + needle + "%,email_address.ilike.%" + needle + "%,product.ilike.%" + needle + "%,result.ilike.%" + needle + "%")
      const { data, error: queryError } = await request
      if (requestId !== loadRequestId.current) return
      if (queryError) throw queryError
      const batch = data || []
      const marketingIds = [...new Set(batch.map(row => row.marketing_row_id).filter(value => value !== null && value !== undefined && String(value).trim() !== ""))]
      let relatedByMarketingId = {}
      if (activeTab === "linked" && marketingIds.length) {
        const { data: relatedAppointments, error: relatedError } = await supabase
          .from("appointments")
          .select("appointment_row_id,marketing_row_id,result,appointment_date,name,job_type,product")
          .in("marketing_row_id", marketingIds)
          .order("appointment_date", { ascending: false, nullsFirst: false })
        if (relatedError) throw relatedError
        for (const related of relatedAppointments || []) {
          const key = String(related.marketing_row_id)
          if (!relatedByMarketingId[key]) relatedByMarketingId[key] = []
          relatedByMarketingId[key].push(related)
        }
      }
      const rowsWithRelated = batch.map(row => ({
        ...row,
        relatedAppointments: row.marketing_row_id === null || row.marketing_row_id === undefined
          ? []
          : (relatedByMarketingId[String(row.marketing_row_id)] || []).filter(related => related.appointment_row_id !== row.appointment_row_id)
      }))

      const eligibleBatch = rowsWithRelated.filter(row => normalise(row.job_type).toLowerCase() === "solar" && normaliseResult(row.result) !== "SOLD" && (activeTab !== "unlinked" ? Boolean(normalise(row.open_solar_id)) : !normalise(row.open_solar_id)))
      setHasMore(batch.length > PAGE_SIZE)
      setRows(eligibleBatch.slice(0, PAGE_SIZE))
    } catch (err) {
      if (requestId !== loadRequestId.current) return
      console.error("Solar Rework load failed:", err)
      setError(err?.message || "Unable to load historical solar appointments.")
      setRows([])
      setTotalCount(0)
      setHasMore(false)
    } finally {
      if (requestId === loadRequestId.current) setLoading(false)
    }
  }


  useEffect(() => { loadRows(page) }, [page, query, activeTab, yearFilter, unlinkedSortOrder])
  useEffect(() => { setPage(0) }, [query, activeTab, yearFilter, unlinkedSortOrder])

  // Load tab totals independently from the table request so badge counts never block or reset the visible list.
  useEffect(() => {
    let cancelled = false
    async function loadTabCounts() {
      if (!supabase) return
      try {
        const base = () => supabase.from("appointments")
          .select("appointment_row_id", { count: "exact", head: true })
          .eq("job_type", "Solar")
              .not("rep_allocated", "is", null)
          .neq("rep_allocated", "")
          .lt("appointment_date", startOfCurrentWeekISO())
          .in("result", ["PM", "PM DNH"])
        const [unlinkedResult, linkedResult] = await Promise.all([
          base().is("open_solar_id", null),
          base().not("open_solar_id", "is", null)
        ])
        if (unlinkedResult.error) throw unlinkedResult.error
        if (linkedResult.error) throw linkedResult.error
        if (!cancelled) setTabCounts({ unlinked: unlinkedResult.count ?? 0, linked: linkedResult.count ?? 0 })
      } catch (err) {
        console.warn("Solar Rework tab totals could not be loaded:", err)
      }
    }
    loadTabCounts()
    return () => { cancelled = true }
  }, [])

  async function saveOpenSolarId(row) {
    const value = normalise(rowEdits[row.appointment_row_id])
    if (!value) { setError("Enter an OpenSolar ID before saving."); return }
    if (!/^\d+$/.test(value)) { setError("OpenSolar ID must contain digits only."); return }
    setSavingId(row.appointment_row_id)
    setError("")
    try {
      const { error: updateError } = await supabase
        .from("appointments")
        .update({ open_solar_id: value })
        .eq("appointment_row_id", row.appointment_row_id)
        .is("open_solar_id", null)
      if (updateError) throw updateError
      setRows(current => current.filter(item => item.appointment_row_id !== row.appointment_row_id))
      setRowEdits(current => { const next = { ...current }; delete next[row.appointment_row_id]; return next })
      await loadRows(page)
    } catch (err) {
      console.error("Unable to save OpenSolar ID:", err)
      setError(err?.message || "Could not save the OpenSolar ID.")
    } finally { setSavingId(null) }
  }
  const filteredRows = rows
  const pageCount = hasMore ? page + 2 : page + 1
  const visibleRows = filteredRows
  const unlinkedCount = rows.length
  const formatStatus = row => {
    const result = normaliseResult(row.result)
    return result || "No result"
  }

  const inputStyle = { height: 38, border: "1px solid #d7dee5", borderRadius: 8, padding: "0 11px", background: "#fff", color: "#24313d", fontSize: 12, minWidth: 0 }
  const selectStyle = { ...inputStyle, cursor: "pointer" }
  const cardStyle = { background: "#fff", border: "1px solid #e1e7ec", borderRadius: 12, padding: 16, minWidth: 0 }
  const muted = { color: "#64748b", fontSize: 11 }

  return <div style={{ maxWidth: 1500, margin: "0 auto", color: "#1f2937" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Sun size={23} color="#0f766e" />
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 750 }}>Solar Appointment Rework</h1>
        </div>
        <p style={{ margin: "7px 0 0", color: "#64748b", fontSize: 13 }}>All solar appointments with result PM or PM DNH, for OpenSolar matching and quote preparation.</p>
      </div>
      <button onClick={() => loadRows(page)} disabled={loading} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 8, padding: "9px 13px", display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 650, cursor: loading ? "wait" : "pointer" }}>
        <RefreshCw size={14} /> Refresh list
      </button>
    </div>

    {error && <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: "#fff1f2", color: "#be123c", fontSize: 12 }}>{error}</div>}

    <div style={{ display: "flex", gap: 8, marginBottom: 12, borderBottom: "1px solid #dbe3ea", flexWrap: "wrap" }}>
      {[
        { value: "unlinked", label: "Unlinked appointments", count: tabCounts.unlinked },
        { value: "linked", label: "Linked appointments", count: tabCounts.linked },
        { value: "quotes-sent", label: "Quotes Sent" },
      ].map(tab => <button key={tab.value} onClick={() => { if (tab.value !== activeTab) { setRows([]); setLoading(true); setActiveTab(tab.value); setPage(0) } }} style={{ border: "1px solid " + (activeTab === tab.value ? "#0f766e" : "#d7dee5"), borderBottom: activeTab === tab.value ? "3px solid #0f766e" : "1px solid #d7dee5", borderRadius: "8px 8px 0 0", padding: "10px 14px", background: activeTab === tab.value ? "#f0fdfa" : "#fff", color: activeTab === tab.value ? "#0f766e" : "#475569", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{tab.label}{tab.count !== undefined && <span style={{ marginLeft: 7, display: "inline-flex", minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", padding: "0 5px", borderRadius: 999, background: activeTab === tab.value ? "#ccfbf1" : "#eef2f6", color: activeTab === tab.value ? "#0f766e" : "#475569", fontSize: 10, fontWeight: 800 }}>{tab.count === null ? "…" : tab.count.toLocaleString("en-GB")}</span>}</button>)}
    </div>

    <div style={{ ...cardStyle, padding: 13, marginBottom: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,2fr) repeat(2,minmax(145px,1fr))", gap: 10 }}>
        <div style={{ position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 11, top: 12, color: "#64748b" }} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, postcode, phone, email…" style={{ ...inputStyle, width: "100%", paddingLeft: 33, boxSizing: "border-box" }} />
        </div>
        <div style={{ ...muted, display: "flex", alignItems: "center", padding: "0 10px" }}>
        </div>
        {activeTab === "unlinked" && <>
          <select value={yearFilter} onChange={event => setYearFilter(event.target.value)} style={selectStyle}>
            <option value="all">All years</option>
            {Array.from({ length: new Date().getFullYear() - 2019 }, (_, index) => String(new Date().getFullYear() - index)).map(year => <option key={year} value={year}>{year}</option>)}
          </select>
          <select value={unlinkedSortOrder} onChange={event => setUnlinkedSortOrder(event.target.value)} style={selectStyle}>
            <option value="desc">Newest to oldest</option><option value="asc">Oldest to newest</option>
          </select>
        </>}
        </select>
      </div>
    </div>

    <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid #e2e8f0", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{activeTab === "quotes-sent" ? "Quotes Sent" : loading ? "Loading appointments…" : `Showing ${rows.length ? page * PAGE_SIZE + 1 : 0}–${page * PAGE_SIZE + rows.length} ${activeTab !== "unlinked" ? "linked" : "unlinked"} appointments`}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button disabled={page === 0 || loading} onClick={() => setPage(value => Math.max(0, value - 1))} style={{ ...selectStyle, padding: "0 12px" }}>Previous</button>
          <span style={muted}>Page {page + 1} of {pageCount}</span>
          <button disabled={!hasMore || loading} onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))} style={{ ...selectStyle, padding: "0 12px" }}>Next</button>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 980, fontSize: 12 }}>
          <thead><tr style={{ background: "#f8fafc", textAlign: "left", color: "#475569" }}>
            {["Name","OpenSolar ID","Date",activeTab === "unlinked" ? "Result" : "Quote readiness", ...(activeTab === "linked" ? ["Related appointment result"] : []),"Email","Open"].map((heading, index) => <th key={heading || index} style={{ padding: "11px 13px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, whiteSpace: "nowrap" }}>{heading}</th>)}
          </tr></thead>
          <tbody>
            {activeTab === "quotes-sent" && <tr><td colSpan={6} style={{ padding: 36, textAlign: "center", color: "#64748b" }}><div style={{ fontWeight: 700, color: "#334155", marginBottom: 6 }}>Quotes Sent is not set up yet</div><div>Once quote sending is implemented, this tab will show appointments with quotes sent.</div></td></tr>}
            {activeTab !== "quotes-sent" && !loading && visibleRows.length === 0 && <tr><td colSpan={7} style={{ padding: 28, textAlign: "center", color: "#64748b" }}>{"No appointments match these filters."}</td></tr>}
            {activeTab !== "quotes-sent" && visibleRows.map(row => {
              const linked = row.open_solar_id !== null && row.open_solar_id !== undefined && String(row.open_solar_id).trim() !== ""
              return <tr key={row.appointment_row_id} style={{ borderBottom: "1px solid #edf2f7" }}>
                <td style={{ padding: "6px 10px", maxWidth: 240 }}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>{normalise(row.name) || "Name missing"}</div>
                  <div style={{ ...muted, marginTop: 2 }}>{normalise(row.address)}{row.address && row.postcode ? ", " : ""}{normalise(row.postcode)}</div>
                </td>
                <td style={{ padding: "6px 10px", minWidth: 260 }}>
                  {linked ? <span style={{ color: "#047857", display: "inline-flex", gap: 5, alignItems: "center" }}><Link2 size={13}/> {row.open_solar_id}</span> : <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input value={rowEdits[row.appointment_row_id] ?? ""} onChange={event => setRowEdits(current => ({ ...current, [row.appointment_row_id]: event.target.value }))} placeholder="Enter OpenSolar ID" inputMode="numeric" aria-label={"OpenSolar ID for " + (normalise(row.name) || row.appointment_row_id)} style={{ ...inputStyle, height: 32, flex: 1, width: "100%", boxSizing: "border-box" }} />
                    <button onClick={() => saveOpenSolarId(row)} disabled={savingId === row.appointment_row_id || !normalise(rowEdits[row.appointment_row_id])} style={{ border: "1px solid #0f766e", borderRadius: 7, height: 32, padding: "0 10px", whiteSpace: "nowrap", background: "#f0fdfa", color: "#0f766e", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>{savingId === row.appointment_row_id ? "Saving…" : "Save"}</button>
                  </div>}
                </td>
                <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>{dateLabel(row.appointment_date)}</td>
                <td style={{ padding: "6px 10px", minWidth: activeTab === "unlinked" ? 100 : 210 }}>
                  {activeTab === "unlinked" ? <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#f1f5f9", color: "#475569", fontSize: 11, fontWeight: 700 }}>{formatStatus(row)}</span> : (() => {
                    const stages = getQuoteStages(row)
                    const completed = stages.filter(stage => stage.complete).length
                    const ready = completed === 4
                    return <div style={{ minWidth: 190 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(28px,1fr))", gap: 5, marginBottom: 6 }}>
                        {stages.map(stage => <div key={stage.label} title={stage.label + (stage.complete ? " — complete" : " — incomplete")} style={{ height: 7, borderRadius: 999, background: stage.complete ? "#16a34a" : "#dbe2ea" }} />)}
                      </div>
                      <div style={{ fontSize: 10, color: ready ? "#15803d" : "#64748b", fontWeight: 700 }}>{completed}/4 stages complete · {ready ? "Ready to quote" : "Not ready"}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 8px", marginTop: 4 }}>
                        {stages.map(stage => <span key={stage.label} title={stage.label} style={{ fontSize: 9, color: stage.complete ? "#15803d" : "#94a3b8" }}>{stage.complete ? "✓" : "○"} {stage.label}</span>)}
                      </div>
                    </div>
                  })()}
                </td>
                {activeTab === "linked" && <td style={{ padding: "6px 10px", minWidth: 170 }}>
                  {row.relatedAppointments?.length ? <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {row.relatedAppointments.map(related => <div key={related.appointment_row_id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ display: "inline-flex", alignSelf: "flex-start", padding: "3px 7px", borderRadius: 999, background: normaliseResult(related.result) === "SOLD" ? "#dcfce7" : "#f1f5f9", color: normaliseResult(related.result) === "SOLD" ? "#166534" : "#475569", fontSize: 10, fontWeight: 750 }}>{formatStatus(related)}</span>
                      <span style={{ ...muted }}>{dateLabel(related.appointment_date)}{related.job_type ? " · " + normalise(related.job_type) : ""}{related.product ? " · " + normalise(related.product) : ""}</span>
                    </div>)}
                  </div> : <span style={muted}>No related appointment</span>}
                </td>}
                <td style={{ padding: "6px 10px", minWidth: 160 }}><div style={{ ...muted, wordBreak: "break-word" }}>{normalise(row.email_address) || "No email"}</div></td>
                <td style={{ padding: "6px 10px" }}>
                  <button onClick={() => onSelectAppointment?.(row)} style={{ border: "1px solid #cbd5e1", borderRadius: 7, padding: "6px 8px", background: "#fff", color: "#0f172a", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", cursor: "pointer", fontSize: 11, fontWeight: 650 }}><UserRound size={13}/> Open <ExternalLink size={11}/></button>
                </td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
    </div>
    <div style={{ ...muted, marginTop: 12 }}>Saving an OpenSolar ID links the appointment in the CRM and moves it to the Linked appointments tab. This does not create a project in OpenSolar.</div>
  </div>
}

import React, { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, ChevronRight, ClipboardList, RefreshCw, Search } from "lucide-react"
import { supabase } from "../lib/supabase"

const REPORTS = [
  { id: "missing-result", title: "Appointments missing result", description: "Appointments where no result has been recorded." },
  { id: "wrong-cps", title: "Wrong CPS", description: "2026 appointments where CPS-P is FALSE, CPS-S is TRUE and is_pickup is FALSE.", group: "CPS Work" },
  { id: "sold-missing-cps-s", title: "Sold · CPS-S not true", description: "2026 appointments marked SOLD where CPS-S is FALSE or NULL.", group: "CPS Work" },
  { id: "pm-pickup-hcps", title: "PM · Pickup / HCPS review", description: '2026 appointments where result contains "PM", is_pickup is not TRUE, and HCPS is not 1110.', group: "CPS Work" },
  { id: "missing-lead-type", title: "Leads missing lead type", description: "Leads where lead_type is empty or NULL. Assign one of the approved lead types." },
  { id: "duplicate-marketing-row-id", title: "Duplicate marketing row IDs", description: "Lead records sharing a marketing_row_id with another lead. Review each copy before deleting." },
]

const LEAD_TYPE_OPTIONS = ["Air Source Heat Pump", "ECO4", "Garden Room", "Solar", "Windows"]

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function text(value) {
  return String(value ?? "").trim()
}

function hcps(row) {
  return `${row?.cps_h ? "1" : "0"}${row?.cps_c ? "1" : "0"}${row?.cps_p ? "1" : "0"}${row?.cps_s ? "1" : "0"}`
}

export default function DataClean({ onOpenAppointment, onOpenLead }) {
  const [activeReport, setActiveReport] = useState("missing-result")
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [leadTypeEdits, setLeadTypeEdits] = useState({})
  const [hcpsEdits, setHcpsEdits] = useState({})
  const [savingLeadIds, setSavingLeadIds] = useState({})
  const [saveMessages, setSaveMessages] = useState({})
  const [page, setPage] = useState(0)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [leadSourceFilter, setLeadSourceFilter] = useState("")
  const [duplicateSources, setDuplicateSources] = useState([])
  const [deletingLeadIds, setDeletingLeadIds] = useState({})
  const pageSize = 50
  const requestIdRef = useRef(0)

  const selectedReport = REPORTS.find(report => report.id === activeReport) || REPORTS[0]

  async function loadReport(reportId = activeReport, sourceFilter = leadSourceFilter, pageNumber = page) {
    const requestId = ++requestIdRef.current

    if (!supabase) {
      if (requestId !== requestIdRef.current) return
      setError("Supabase is not configured.")
      setLoading(false)
      return
    }

    setLoading(true)
    setError("")
    setSearch("")

    try {
      let allRows = []

      if (reportId === "duplicate-marketing-row-id") {
        const { data, error: queryError } = await supabase.rpc("get_duplicate_marketing_row_ids", {
          p_lead_source: sourceFilter || null, p_limit: pageSize + 1, p_offset: pageNumber * pageSize,
        })
        if (queryError) throw queryError
        const fetchedRows = Array.isArray(data) ? data : []
        setHasNextPage(fetchedRows.length > pageSize)
        const visibleSources = fetchedRows.map(item => item.lead_source).filter(Boolean)
        if (visibleSources.length) {
          setDuplicateSources(current => [...new Set([...current, ...visibleSources])].sort((a, b) => a.localeCompare(b)))
        }
        allRows = fetchedRows.slice(0, pageSize)
      } else {
      {
        let query

        if (reportId === "wrong-cps") {
          query = supabase.from("appointments")
            .select("appointment_row_id,name,phone_number_1,email_address,postcode,address,appointment_date,product,job_type,branch,rep_allocated,cps_h,cps_c,cps_p,cps_s,is_pickup,result")
            .eq("cps_p", false).eq("cps_s", true).eq("is_pickup", false)
            .gte("appointment_date", "2026-01-01T00:00:00").lt("appointment_date", "2027-01-01T00:00:00")
            .order("appointment_date", { ascending: false, nullsFirst: false })
        } else if (reportId === "sold-missing-cps-s") {
          query = supabase.from("appointments")
            .select("appointment_row_id,name,phone_number_1,email_address,postcode,address,appointment_date,product,job_type,branch,rep_allocated,cps_h,cps_c,cps_p,cps_s,is_pickup,result")
            .ilike("result", "SOLD").or("cps_s.is.null,cps_s.eq.false")
            .gte("appointment_date", "2026-01-01T00:00:00").lt("appointment_date", "2027-01-01T00:00:00")
            .order("appointment_date", { ascending: false, nullsFirst: false })
        } else if (reportId === "pm-pickup-hcps") {
          query = supabase.from("appointments")
            .select("appointment_row_id,name,phone_number_1,email_address,postcode,address,appointment_date,product,job_type,branch,rep_allocated,cps_h,cps_c,cps_p,cps_s,is_pickup,result")
            .ilike("result", "%PM%").or("is_pickup.is.null,is_pickup.eq.false")
            .gte("appointment_date", "2026-01-01T00:00:00").lt("appointment_date", "2027-01-01T00:00:00")
            .order("appointment_date", { ascending: false, nullsFirst: false })
        } else if (reportId === "missing-result") {
          query = supabase
            .from("appointments")
            .select("appointment_row_id,name,phone_number_1,email_address,postcode,address,appointment_date,product,job_type,branch,rep_allocated,result")
            .or('result.is.null,result.eq.""')
            .order("appointment_date", { ascending: false, nullsFirst: false })
        } else if (reportId === "missing-lead-type") {
          query = supabase
            .from("leads")
            .select("delete_row_id,marketing_row_id,first_name,last_name,salutations,primary_phone_number,email,address,postcode,lead_source,lead_type,received_date_time")
            .or('lead_type.is.null,lead_type.eq.""')
            .order("received_date_time", { ascending: false, nullsFirst: false })
        } else {
          throw new Error("Unknown Data Clean report.")
        }

        if (["missing-result"].includes(reportId)) {
          query = query.gte("appointment_date", "2026-01-01T00:00:00").lt("appointment_date", "2027-01-01T00:00:00")
        }

        if (reportId === "pm-pickup-hcps") {
          // Fetch newest PM appointments in small batches and stop once 25 rows
          // satisfy the derived HCPS rule. Filtering only after the first 25
          // candidates can incorrectly return an empty report.
          const batchSize = 100
          let offset = 0
          allRows = []
          while (allRows.length < 25) {
            const { data, error: queryError } = await query.range(offset, offset + batchSize - 1)
            if (queryError) throw queryError
            const batch = Array.isArray(data) ? data : []
            allRows = allRows.concat(batch.filter(row => hcps(row) !== "1110"))
            if (batch.length < batchSize) break
            offset += batchSize
          }
          allRows = allRows.slice(0, 25)
          setHasNextPage(false)
        } else {
          query = query.range(reportId === "missing-lead-type" ? page * pageSize : 0, (reportId === "missing-lead-type" ? page * pageSize : 0) + (reportId === "missing-lead-type" ? pageSize : 999))
          const { data, error: queryError } = await query
          if (queryError) throw queryError

          const fetchedRows = Array.isArray(data) ? data : []
          if (reportId === "missing-lead-type") {
            setHasNextPage(fetchedRows.length > pageSize)
            allRows = fetchedRows.slice(0, pageSize)
          } else {
            allRows = fetchedRows
          }
        }
      }
      }

      if (requestId !== requestIdRef.current) return
      setRows(allRows)
      setLeadTypeEdits({})
      setHcpsEdits({})
      setSaveMessages({})
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      console.error("Data Clean load error:", err)
      setError(err?.message || "Unable to load this report.")
      setRows([])
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    loadReport(activeReport, leadSourceFilter, page)
  }, [activeReport, page, leadSourceFilter])

  useEffect(() => {
    let cancelled = false
    async function loadDuplicateSources() {
      if (!supabase) return
      let sources = []
      const { data, error: sourceError } = await supabase.rpc("get_duplicate_marketing_row_sources")
      if (sourceError) console.error("Unable to load duplicate lead sources:", sourceError)
      else sources = (data || []).map(item => item.lead_source).filter(Boolean)

      // Fallback to the same working report RPC if the source-list RPC returns no options.
      if (!sources.length) {
        const { data: duplicateRows, error: rowsError } = await supabase.rpc("get_duplicate_marketing_row_ids", {
          p_lead_source: null, p_limit: 201, p_offset: 0,
        })
        if (rowsError) console.error("Unable to derive duplicate lead sources:", rowsError)
        else sources = (duplicateRows || []).map(item => item.lead_source).filter(Boolean)
      }
      if (!cancelled) setDuplicateSources([...new Set(sources)].sort((a, b) => a.localeCompare(b)))
    }
    loadDuplicateSources()
    return () => { cancelled = true }
  }, [])

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(row => {
      const values = [
        row.name,
        row.appointment_row_id,
        row.postcode,
        row.product,
        row.job_type,
        row.branch,
        row.rep_allocated,
        row.email_address,
        row.phone_number_1,
        row.appointment_date,
        ["wrong-cps", "pm-pickup-hcps", "sold-missing-cps-s"].includes(activeReport) ? hcps(row) : "",
        row.lead_source, row.lead_type, row.marketing_row_id, row.delete_row_id,
        row.first_name, row.last_name, row.primary_phone_number, row.disposition, row.last_time_called,
      ]
      return values.map(text).join(" ").toLowerCase().includes(term)
    })
  }, [rows, search, activeReport])

  function openRow(row) {
    if (activeReport === "missing-lead-type") {
      if (typeof onOpenLead === "function") return onOpenLead(row)
      return
    }
    if (typeof onOpenAppointment === "function") return onOpenAppointment(row)
    if (typeof onOpenLead === "function") onOpenLead(row)
  }

  async function deleteDuplicateLead(row) {
    const id = row.delete_row_id
    if (!id || !row.marketing_row_id || !supabase) return
    const customerName = [row.first_name, row.last_name].map(text).filter(Boolean).join(" ") || "this lead"
    if (!window.confirm(`Permanently delete ${customerName} (marketing_row_id: ${row.marketing_row_id})? This cannot be undone. Only this record will be deleted.`)) return
    setDeletingLeadIds(current => ({ ...current, [id]: true }))
    setSaveMessages(current => ({ ...current, [id]: "" }))
    try {
      const { data, error: deleteError } = await supabase.from("leads").delete().eq("delete_row_id", id).eq("marketing_row_id", row.marketing_row_id).select("delete_row_id")
      if (deleteError) throw deleteError
      if (!data?.length) throw new Error("No record was deleted. Check database permissions or refresh the report.")
      await loadReport("duplicate-marketing-row-id")
    } catch (err) {
      console.error("Unable to delete duplicate lead:", err)
      setSaveMessages(current => ({ ...current, [id]: err?.message || "Could not delete this lead." }))
    } finally { setDeletingLeadIds(current => ({ ...current, [id]: false })) }
  }

  async function saveLeadType(row) {
    const id = row.delete_row_id
    const leadType = leadTypeEdits[id]
    if (!id || !LEAD_TYPE_OPTIONS.includes(leadType) || !supabase) return
    setSavingLeadIds(current => ({ ...current, [id]: true }))
    setSaveMessages(current => ({ ...current, [id]: "" }))
    try {
      const { error: updateError } = await supabase
        .from("leads")
        .update({ lead_type: leadType })
        .eq("delete_row_id", id)
      if (updateError) throw updateError
      setRows(current => current.filter(item => item.delete_row_id !== id))
      setLeadTypeEdits(current => {
        const next = { ...current }
        delete next[id]
        return next
      })
    } catch (err) {
      console.error("Unable to update lead type:", err)
      setSaveMessages(current => ({ ...current, [id]: err?.message || "Could not save lead type." }))
    } finally {
      setSavingLeadIds(current => ({ ...current, [id]: false }))
    }
  }

  async function saveHcps(row) {
    const id = row.appointment_row_id
    const value = String(hcpsEdits[id] ?? hcps(row)).trim()
    if (!id || !/^[01]{4}$/.test(value) || !supabase) {
      setSaveMessages(current => ({ ...current, [id]: "Enter exactly four digits, each 0 or 1." }))
      return
    }
    const [cps_h, cps_c, cps_p, cps_s] = value.split("").map(bit => bit === "1")
    setSavingLeadIds(current => ({ ...current, [id]: true }))
    setSaveMessages(current => ({ ...current, [id]: "" }))
    try {
      const { error: updateError } = await supabase
        .from("appointments")
        .update({ cps_h, cps_c, cps_p, cps_s })
        .eq("appointment_row_id", id)
      if (updateError) throw updateError
      if (value === "1110") {
        setRows(current => current.filter(item => item.appointment_row_id !== id))
      } else {
        setRows(current => current.map(item => item.appointment_row_id === id ? { ...item, cps_h, cps_c, cps_p, cps_s } : item))
      }
      setHcpsEdits(current => { const next = { ...current }; delete next[id]; return next })
    } catch (err) {
      console.error("Unable to update appointment HCPS:", err)
      setSaveMessages(current => ({ ...current, [id]: err?.message || "Could not save HCPS." }))
    } finally {
      setSavingLeadIds(current => ({ ...current, [id]: false }))
    }
  }

  return (
    <section className="data-clean-page">
      <style>{styles}</style>

      <div className="data-clean-header">
        <div>
          <div className="data-clean-eyebrow">Administration</div>
          <h1>Data Clean</h1>
          <p>Central location for CRM data-quality reports and records that need attention.</p>
        </div>
        <button type="button" className="data-clean-refresh" onClick={() => loadReport(activeReport)} disabled={loading}>
          <RefreshCw size={14} className={loading ? "data-clean-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="data-clean-layout">
        <aside className="data-clean-report-list">
          <div className="data-clean-report-list-title"><ClipboardList size={16} /><span>Reports</span></div>
          {REPORTS.filter(report => !report.group).map(report => {
            const active = report.id === activeReport
            return (
              <button key={report.id} type="button" className={`data-clean-report-card ${active ? "active" : ""}`} onClick={() => { setPage(0); setActiveReport(report.id) }}>
                <div className="data-clean-report-icon">{active ? <AlertTriangle size={17} /> : <ChevronRight size={17} />}</div>
                <div className="data-clean-report-copy"><strong>{report.title}</strong><span>{report.description}</span></div>
              </button>
            )
          })}
          <div className="data-clean-group-title"><ClipboardList size={14} /><span>CPS Work</span></div>
          {REPORTS.filter(report => report.group === "CPS Work").map(report => {
            const active = report.id === activeReport
            return (
              <button key={report.id} type="button" className={`data-clean-report-card data-clean-report-nested ${active ? "active" : ""}`} onClick={() => { setPage(0); setActiveReport(report.id) }}>
                <div className="data-clean-report-icon">{active ? <AlertTriangle size={17} /> : <ChevronRight size={17} />}</div>
                <div className="data-clean-report-copy"><strong>{report.title}</strong><span>{report.description}</span></div>
              </button>
            )
          })}
        </aside>

        <main className="data-clean-main">
          {error && <div className="data-clean-error">{error}</div>}

          <div className="data-clean-summary-card">
            <div className="data-clean-summary-icon">{rows.length > 0 ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}</div>
            <div>
              <div className="data-clean-summary-label">{selectedReport.title}</div>
              <div className="data-clean-summary-number">{loading ? "—" : rows.length.toLocaleString("en-GB")}</div>
              <div className="data-clean-summary-text">{selectedReport.description}</div>
            </div>
          </div>

          <div className="data-clean-panel">
            <div className="data-clean-panel-header">
              <div><h2>{selectedReport.title}</h2><p>{selectedReport.description}</p></div>
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",justifyContent:"flex-end"}}>
                {activeReport === "duplicate-marketing-row-id" && <select aria-label="Filter duplicate leads by source" value={leadSourceFilter} onChange={event => { setPage(0); setLeadSourceFilter(event.target.value) }} style={{height:36,minWidth:180,padding:"0 10px",border:"1px solid #d7dee7",borderRadius:8,background:"#fff",color:"#334155",fontSize:12}}><option value="">All lead sources</option>{duplicateSources.map(source => <option key={source} value={source}>{source}</option>)}</select>}
                <div className="data-clean-search"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search records..." /></div>
              </div>
            </div>

            {loading ? (
              <div className="data-clean-empty"><RefreshCw size={22} className="data-clean-spin" /><strong>Loading report...</strong></div>
            ) : filteredRows.length === 0 ? (
              <div className="data-clean-empty"><CheckCircle2 size={28} /><strong>{search ? "No matching records" : "No issues found"}</strong><span>{search ? "Try a different search term." : "There are currently no records matching this report."}</span></div>
            ) : (
              <>
                <div className="data-clean-count">Showing {filteredRows.length.toLocaleString("en-GB")} records{activeReport === "missing-lead-type" ? ` · Page ${page + 1}` : ` · ${rows.length.toLocaleString("en-GB")} loaded`}</div>
                <div className="data-clean-table-wrap">
                  <table className="data-clean-table">
                    <thead>
                      <tr>
                        {activeReport === "duplicate-marketing-row-id" ? (
                          <><th>Marketing Row ID</th><th>Customer</th><th>Lead Source</th><th>Received</th><th>Postcode</th><th>Phone</th><th>Disposition</th><th>Archive Date Time</th><th>Copies</th><th>Action</th></>
                        ) : activeReport === "missing-lead-type" ? (
                          <><th>Lead</th><th>Received</th><th>Postcode</th><th>Lead Source</th><th>Phone</th><th>Email</th><th>Assign Lead Type</th><th></th></>
                        ) : (
                          <><th>Customer</th><th>Appointment</th><th>Postcode</th>{activeReport !== "pm-pickup-hcps" && <th>Product</th>}<th>Job Type</th><th>Branch</th><th>Sales Rep</th>{activeReport !== "pm-pickup-hcps" && <><th>Phone</th><th>Email</th></>}
                          {["wrong-cps", "pm-pickup-hcps", "sold-missing-cps-s"].includes(activeReport) && <><th>Result</th><th>HCPS</th><th>Pickup</th>{activeReport === "pm-pickup-hcps" && <th>Update HCPS</th>}</>}
                          <th></th></>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row, index) => (
                        <tr key={row.appointment_row_id || `${row.name}-${row.appointment_date}-${index}`}>
                          {activeReport === "duplicate-marketing-row-id" ? (
                            <>
                              <td><strong>{row.marketing_row_id}</strong><small>{row.delete_row_id}</small></td>
                              <td><strong>{[row.first_name, row.last_name].map(text).filter(Boolean).join(" ") || "Unnamed lead"}</strong></td><td>{row.lead_source || "—"}</td><td>{formatDate(row.received_date_time)}</td><td>{row.postcode || "—"}</td><td>{row.primary_phone_number || "—"}</td>
                              <td>{row.disposition || "—"}</td><td>{formatDate(row.time_archived)}</td>
                              <td><span className="data-clean-badge warning">{row.duplicate_count} copies</span></td>
                              <td><button type="button" className="data-clean-delete" disabled={!!deletingLeadIds[row.delete_row_id]} onClick={() => deleteDuplicateLead(row)}>{deletingLeadIds[row.delete_row_id] ? "Deleting…" : "Delete this row"}</button>{saveMessages[row.delete_row_id] && <small style={{color:"#b91c1c",whiteSpace:"normal",maxWidth:180}}>{saveMessages[row.delete_row_id]}</small>}</td>
                            </>
                          ) : activeReport === "missing-lead-type" ? (
                            <>
                              <td><strong>{[row.salutations, row.first_name, row.last_name].map(text).filter(Boolean).join(" ") || "Unnamed lead"}</strong><small>{row.delete_row_id}</small></td>
                              <td>{formatDate(row.received_date_time)}</td>
                              <td>{row.postcode || "—"}</td>
                              <td>{row.lead_source || "—"}</td>
                              <td>{row.primary_phone_number || "—"}</td>
                              <td>{row.email || "—"}</td>
                              <td>
                                <select
                                  aria-label={`Lead type for ${row.first_name || row.delete_row_id}`}
                                  value={leadTypeEdits[row.delete_row_id] || ""}
                                  onChange={event => setLeadTypeEdits(current => ({ ...current, [row.delete_row_id]: event.target.value }))}
                                  style={{ minWidth: 190, padding: "7px 9px", border: "1px solid #d7dee7", borderRadius: 7, background: "#fff", color: "#334155", fontSize: 11 }}
                                >
                                  <option value="">Select lead type…</option>
                                  {LEAD_TYPE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                                </select>
                                {saveMessages[row.delete_row_id] && <small style={{ color: "#b91c1c" }}>{saveMessages[row.delete_row_id]}</small>}
                              </td>
                              <td><button type="button" className="data-clean-open" disabled={!LEAD_TYPE_OPTIONS.includes(leadTypeEdits[row.delete_row_id]) || !!savingLeadIds[row.delete_row_id]} onClick={() => saveLeadType(row)}>{savingLeadIds[row.delete_row_id] ? "Saving…" : "Save"}</button></td>
                            </>
                          ) : (
                            <>
                              <td><strong>{row.name || "Unnamed customer"}</strong>{row.appointment_row_id && <small>{row.appointment_row_id}</small>}</td>
                              <td>{formatDate(row.appointment_date)}</td>
                              <td>{row.postcode || "—"}</td>
                              {activeReport !== "pm-pickup-hcps" && <td>{row.product || "—"}</td>}
                              <td>{row.job_type || "—"}</td>
                              <td>{row.branch || "—"}</td>
                              <td>{row.rep_allocated || "—"}</td>
                              {activeReport !== "pm-pickup-hcps" && <><td>{row.phone_number_1 || "—"}</td><td>{row.email_address || "—"}</td></>}
                              {["wrong-cps", "pm-pickup-hcps", "sold-missing-cps-s"].includes(activeReport) && (
                                <>
                                  <td>{row.result || "—"}</td>
                                  <td><span className="data-clean-badge warning">{hcps(row)}</span></td>
                                  <td><span className={`data-clean-badge ${row.is_pickup === true ? "danger" : "warning"}`}>{row.is_pickup === true ? "TRUE" : row.is_pickup === false ? "FALSE" : "NULL"}</span></td>
                                  {activeReport === "pm-pickup-hcps" && (
                                    <td>
                                      <div style={{display:"flex",gap:5,alignItems:"center"}}>
                                        <input aria-label={`HCPS for ${row.name || row.appointment_row_id}`} value={hcpsEdits[row.appointment_row_id] ?? hcps(row)} onChange={event => setHcpsEdits(current => ({...current,[row.appointment_row_id]:event.target.value.replace(/[^01]/g,"").slice(0,4)}))} maxLength={4} inputMode="numeric" style={{width:58,padding:"6px 7px",border:"1px solid #d7dee7",borderRadius:6,fontSize:11}}/>
                                        <button type="button" className="data-clean-open" disabled={!/^[01]{4}$/.test(String(hcpsEdits[row.appointment_row_id] ?? hcps(row))) || !!savingLeadIds[row.appointment_row_id]} onClick={() => saveHcps(row)}>{savingLeadIds[row.appointment_row_id] ? "Saving…" : "Save"}</button>
                                      </div>
                                      {saveMessages[row.appointment_row_id] && <small style={{color:"#b91c1c"}}>{saveMessages[row.appointment_row_id]}</small>}
                                    </td>
                                  )}
                                </>
                              )}
                              <td><button type="button" className="data-clean-open" onClick={() => openRow(row)}>Open</button></td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {["missing-lead-type", "duplicate-marketing-row-id"].includes(activeReport) && <div className="data-clean-pagination"><button type="button" className="data-clean-open" disabled={page === 0 || loading} onClick={() => setPage(current => Math.max(0, current - 1))}>Previous</button><span>Page {page + 1}</span><button type="button" className="data-clean-open" disabled={!hasNextPage || loading} onClick={() => setPage(current => current + 1)}>Next</button></div>}
              </>
            )}
          </div>
        </main>
      </div>
    </section>
  )
}

const styles = `
.data-clean-page{min-height:calc(100vh - 90px);width:100%;padding:28px 32px 50px;background:#f5f7fa;color:#172033;box-sizing:border-box;font-family:Inter,Arial,sans-serif}
.data-clean-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:22px}
.data-clean-eyebrow{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:7px}
.data-clean-header h1{margin:0;font-size:30px;line-height:1.1;color:#0f172a}
.data-clean-header p{margin:8px 0 0;font-size:13px;color:#64748b}
.data-clean-refresh{height:36px;padding:0 13px;border:1px solid #d7dee7;border-radius:8px;background:#fff;color:#334155;display:inline-flex;align-items:center;gap:7px;font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.data-clean-refresh:disabled{opacity:.6;cursor:default}
.data-clean-spin{animation:data-clean-spin 1s linear infinite}
@keyframes data-clean-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}

.data-clean-layout{display:grid!important;grid-template-columns:270px minmax(0,1fr)!important;gap:20px!important;align-items:start;width:100%;min-width:0;margin:0!important;padding:0!important}
.data-clean-report-list{width:270px!important;min-width:270px;box-sizing:border-box;background:#fff;border:1px solid #dfe5ec;border-radius:12px;padding:10px;position:sticky;top:18px;margin:0!important}
.data-clean-report-list-title{display:flex;align-items:center;gap:8px;padding:9px 10px 11px;color:#172033;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}
.data-clean-report-card{width:100%;display:flex;align-items:flex-start;gap:10px;padding:13px 10px;border:1px solid transparent;border-radius:9px;background:#fff;text-align:left;cursor:pointer;color:#334155;box-sizing:border-box}
.data-clean-report-card:hover{background:#f8fafc}
.data-clean-group-title{display:flex;align-items:center;gap:8px;margin:10px 6px 4px;padding:10px 4px 4px;border-top:1px solid #e6eaf0;color:#475569;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}
.data-clean-report-nested{padding-left:14px}
.data-clean-report-card.active{background:#eef4ff;border-color:#cbd9f5;color:#172554}
.data-clean-report-icon{width:30px;height:30px;flex:0 0 auto;border-radius:7px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#64748b}
.data-clean-report-card.active .data-clean-report-icon{background:#fff;color:#172554}
.data-clean-report-copy{min-width:0}
.data-clean-report-copy strong{display:block;font-size:12px;line-height:1.3}
.data-clean-report-copy span{display:block;margin-top:4px;font-size:10px;line-height:1.4;color:#64748b}

.data-clean-main{width:100%!important;min-width:0!important;margin:0!important;padding:0!important}
.data-clean-error{padding:13px 15px;margin-bottom:16px;border:1px solid #fecaca;background:#fff1f2;color:#b91c1c;border-radius:9px;font-size:12px}
.data-clean-summary-card{display:flex;align-items:center;gap:14px;background:#fff;border:1px solid #dfe5ec;border-radius:11px;padding:18px;margin:0 0 16px}
.data-clean-summary-icon{width:42px;height:42px;display:flex;align-items:center;justify-content:center;border-radius:9px;background:#fff7ed;color:#c2410c;flex:0 0 auto}
.data-clean-summary-label{font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.06em}
.data-clean-summary-number{margin-top:2px;font-size:26px;line-height:1.1;font-weight:750;color:#0f172a}
.data-clean-summary-text{margin-top:4px;font-size:12px;color:#64748b}
.data-clean-panel{background:#fff;border:1px solid #dfe5ec;border-radius:12px;overflow:hidden;margin:0}
.data-clean-panel-header{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:17px 18px;border-bottom:1px solid #e6eaf0}
.data-clean-panel-header h2{margin:0;font-size:16px;color:#0f172a}
.data-clean-panel-header p{margin:4px 0 0;font-size:11px;color:#64748b}
.data-clean-search{width:min(360px,100%);height:36px;display:flex;align-items:center;gap:8px;padding:0 11px;box-sizing:border-box;border:1px solid #d7dee7;border-radius:8px;background:#fff;color:#64748b}
.data-clean-search input{width:100%;border:0;outline:0;background:transparent;color:#172033;font:inherit;font-size:12px}
.data-clean-count{padding:10px 18px;background:#fafbfc;border-bottom:1px solid #e6eaf0;font-size:10px;font-weight:700;color:#64748b}\n.data-clean-pagination{display:flex;align-items:center;justify-content:center;gap:14px;padding:14px;border-top:1px solid #e6eaf0;color:#64748b;font-size:11px}
.data-clean-table-wrap{width:100%;overflow:auto}
.data-clean-table{width:100%;min-width:1250px;border-collapse:collapse}
.data-clean-table th{padding:10px 12px;background:#f8fafc;border-bottom:1px solid #dfe5ec;text-align:left;white-space:nowrap;font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.04em}
.data-clean-table td{padding:11px 12px;border-bottom:1px solid #edf0f4;vertical-align:middle;white-space:nowrap;font-size:11px;color:#334155}
.data-clean-table tbody tr:hover{background:#fafcff}
.data-clean-table td strong{display:block;color:#172033;font-size:11px}
.data-clean-table td small{display:block;margin-top:3px;color:#94a3b8;font-size:9px}
.data-clean-open{height:28px;padding:0 9px;border:1px solid #d7dee7;border-radius:6px;background:#fff;color:#334155;font-size:10px;font-weight:700;cursor:pointer}
.data-clean-open:hover{background:#f8fafc}
.data-clean-delete{height:28px;padding:0 9px;border:1px solid #fecaca;border-radius:6px;background:#fff1f2;color:#b91c1c;font-size:10px;font-weight:800;cursor:pointer}.data-clean-delete:disabled{opacity:.6;cursor:default}
.data-clean-badge{display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:23px;padding:0 7px;border-radius:6px;font-size:10px;font-weight:800}
.data-clean-badge.warning{background:#fff7ed;color:#c2410c;border:1px solid #fed7aa}
.data-clean-badge.danger{background:#fff1f2;color:#b91c1c;border:1px solid #fecaca}
.data-clean-empty{min-height:300px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#94a3b8}
.data-clean-empty strong{font-size:12px;color:#334155}
.data-clean-empty span{font-size:11px}

@media(max-width:900px){
  .data-clean-page{padding:20px 14px 40px}
  .data-clean-layout{display:block!important}
  .data-clean-report-list{width:100%!important;min-width:0;margin-bottom:14px!important;position:static}
  .data-clean-main{width:100%!important}
  .data-clean-panel-header{align-items:flex-start;flex-direction:column}
  .data-clean-search{width:100%}
}
`
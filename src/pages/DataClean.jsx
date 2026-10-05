import React, { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, ChevronRight, ClipboardList, RefreshCw, Search } from "lucide-react"
import { supabase } from "../lib/supabase"

const REPORTS = [
  { id: "missing-result", title: "Appointments missing result", description: "Appointments where no result has been recorded." },
  { id: "wrong-cps", title: "Wrong CPS", description: "Appointments where HCPS is 0001 but is_pickup is FALSE." },
]

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function text(value) { return String(value ?? "").trim() }

function hcps(row) {
  return `${row?.cps_h ? "1" : "0"}${row?.cps_c ? "1" : "0"}${row?.cps_p ? "1" : "0"}${row?.cps_s ? "1" : "0"}`
}

export default function DataClean({ onOpenAppointment, onOpenLead }) {
  const [activeReport, setActiveReport] = useState("missing-result")
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const requestIdRef = useRef(0)

  const selectedReport = REPORTS.find(report => report.id === activeReport) || REPORTS[0]

  async function loadReport(reportId = activeReport) {
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
      const pageSize = 1000
      let from = 0
      let allRows = []

      while (true) {
        let query

        if (reportId === "missing-result") {
          query = supabase
            .from("appointments")
            .select("appointment_row_id,name,phone_number_1,email_address,postcode,address,appointment_date,product,job_type,branch,rep_allocated,result")
            .or('result.is.null,result.eq.""')
            .order("appointment_date", { ascending: false, nullsFirst: false })
        } else if (reportId === "wrong-cps") {
          query = supabase
            .from("appointments")
            .select("appointment_row_id,name,phone_number_1,email_address,postcode,address,appointment_date,product,job_type,branch,rep_allocated,cps_h,cps_c,cps_p,cps_s,is_pickup,result")
            .eq("cps_h", false)
            .eq("cps_c", false)
            .eq("cps_p", false)
            .eq("cps_s", true)
            .eq("is_pickup", false)
            .order("appointment_date", { ascending: false, nullsFirst: false })
        } else {
          break
        }

        const { data, error: queryError } = await query.range(from, from + pageSize - 1)
        if (queryError) throw queryError

        const page = Array.isArray(data) ? data : []
        allRows = allRows.concat(page)
        if (page.length < pageSize) break
        from += pageSize
      }

      if (requestId !== requestIdRef.current) return
      setRows(allRows)
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
    loadReport(activeReport)
  }, [activeReport])

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(row => {
      const values = [row.name, row.appointment_row_id, row.postcode, row.product, row.job_type, row.branch, row.rep_allocated, row.email_address, row.phone_number_1, row.appointment_date, activeReport === "wrong-cps" ? hcps(row) : ""]
      return values.map(text).join(" ").toLowerCase().includes(term)
    })
  }, [rows, search, activeReport])

  function openRow(row) {
    if (typeof onOpenAppointment === "function") return onOpenAppointment(row)
    if (typeof onOpenLead === "function") onOpenLead(row)
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
          {REPORTS.map(report => {
            const active = report.id === activeReport
            return (
              <button key={report.id} type="button" className={`data-clean-report-card ${active ? "active" : ""}`} onClick={() => setActiveReport(report.id)}>
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
              <div className="data-clean-search"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search records..." /></div>
            </div>

            {loading ? (
              <div className="data-clean-empty"><RefreshCw size={22} className="data-clean-spin" /><strong>Loading report...</strong></div>
            ) : filteredRows.length === 0 ? (
              <div className="data-clean-empty"><CheckCircle2 size={28} /><strong>{search ? "No matching records" : "No issues found"}</strong><span>{search ? "Try a different search term." : "There are currently no records matching this report."}</span></div>
            ) : (
              <>
                <div className="data-clean-count">Showing {filteredRows.length.toLocaleString("en-GB")} of {rows.length.toLocaleString("en-GB")} records</div>
                <div className="data-clean-table-wrap">
                  <table className="data-clean-table">
                    <thead>
                      <tr>
                        <th>Customer</th><th>Appointment</th><th>Postcode</th><th>Product</th><th>Job Type</th><th>Branch</th><th>Sales Rep</th><th>Phone</th><th>Email</th>
                        {activeReport === "wrong-cps" && <><th>HCPS</th><th>Pickup</th></>}
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row, index) => (
                        <tr key={row.appointment_row_id || `${row.name}-${row.appointment_date}-${index}`}>
                          <td><strong>{row.name || "Unnamed customer"}</strong>{row.appointment_row_id && <small>{row.appointment_row_id}</small>}</td>
                          <td>{formatDate(row.appointment_date)}</td><td>{row.postcode || "—"}</td><td>{row.product || "—"}</td><td>{row.job_type || "—"}</td><td>{row.branch || "—"}</td><td>{row.rep_allocated || "—"}</td><td>{row.phone_number_1 || "—"}</td><td>{row.email_address || "—"}</td>
                          {activeReport === "wrong-cps" && <><td><span className="data-clean-badge warning">{hcps(row)}</span></td><td><span className="data-clean-badge danger">FALSE</span></td></>}
                          <td><button type="button" className="data-clean-open" onClick={() => openRow(row)}>Open</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </section>
  )
}

const styles = `
.data-clean-page{min-height:calc(100vh - 90px);width:100%;padding:28px 32px 50px;background:#f5f7fa;color:#172033;box-sizing:border-box;font-family:Inter,Arial,sans-serif}.data-clean-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:22px}.data-clean-eyebrow{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:7px}.data-clean-header h1{margin:0;font-size:30px;line-height:1.1;color:#0f172a}.data-clean-header p{margin:8px 0 0;font-size:13px;color:#64748b}.data-clean-refresh{height:36px;padding:0 13px;border:1px solid #d7dee7;border-radius:8px;background:#fff;color:#334155;display:inline-flex;align-items:center;gap:7px;font:inherit;font-size:12px;font-weight:600;cursor:pointer}.data-clean-refresh:disabled{opacity:.6;cursor:default}.data-clean-spin{animation:data-clean-spin 1s linear infinite}@keyframes data-clean-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.data-clean-layout{display:grid;grid-template-columns:270px minmax(0,1fr);align-items:start;column-gap:20px;width:100%;min-width:0}.data-clean-report-list{width:270px;box-sizing:border-box;background:#fff;border:1px solid #dfe5ec;border-radius:12px;padding:10px;position:sticky;top:18px}.data-clean-report-list-title{display:flex;align-items:center;gap:8px;padding:9px 10px 11px;color:#172033;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.data-clean-report-card{width:100%;display:flex;align-items:flex-start;gap:10px;padding:13px 10px;border:1px solid transparent;border-radius:9px;background:#fff;text-align:left;cursor:pointer;color:#334155}.data-clean-report-card:hover{background:#f8fafc}.data-clean-report-card.active{background:#eef4ff;border-color:#cbd9f5;color:#172554}.data-clean-report-icon{width:30px;height:30px;flex:0 0 auto;border-radius:7px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#64748b}.data-clean-report-card.active .data-clean-report-icon{background:#fff;color:#172554}.data-clean-report-copy{min-width:0}.data-clean-report-copy strong{display:block;font-size:12px;line-height:1.3}.data-clean-report-copy span{display:block;margin-top:4px;font-size:10px;line-height:1.4;color:#64748b}
.data-clean-main{width:100%;min-width:0}.data-clean-error{padding:13px 15px;margin-bottom:16px;border:1px solid #fecaca;background:#fff1f2;color:#b91c1c;border-radius:9px;font-size:12px}.data-clean-summary-card{display:flex;align-items:center;gap:14px;background:#fff;border:1px solid #dfe5ec;border-radius:11px;padding:18px;margin-bottom:16px}.data-clean-summary-icon{width:42px;height:42px;display:flex;align-items:center;justify-content:center;border-radius:9px;background:#fff7ed;color:#c2410c;flex:0 0 auto}.data-clean-summary-label{font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.06em}.data-clean-summary-number{margin-top:2px;font-size:26px;line-height:1.1;font-weight:750;color:#0f172a}.data-clean-summary-text{margin-top:4px;font-size:12px;color:#64748b}.data-clean-panel{background:#fff;border:1px solid #dfe5ec;border-radius:12px;overflow:hidden}.data-clean-panel-header{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:17px 18px;border-bottom:1px solid #e6eaf0}.data-clean-panel-header h2{margin:0;font-size:16px;color:#0f172a}.data-clean-panel-header p{margin:4px 0 0;font-size:11px;color:#64748b}.data-clean-search{width:min(360px,100%);height:36px;display:flex;align-items:center;gap:8px;padding:0 11px;box-sizing:border-box;border:1px solid #d7dee7;border-radius:8px;background:#fff;color:#64748b}.data-clean-search input{width:100%;border:0;outline:0;background:transparent;color:#172033;font:inherit;font-size:12px}.data-clean-count{padding:10px 18px;background:#fafbfc;border-bottom:1px solid #e6eaf0;font-size:10px;font-weight:700;color:#64748b}.data-clean-table-wrap{width:100%;overflow:auto}.data-clean-table{width:100%;min-width:1250px;border-collapse:collapse}.data-clean-table th{padding:10px 12px;background:#f8fafc;border-bottom:1px solid #dfe5ec;text-align:left;white-space:nowrap;font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.04em}.data-clean-table td{padding:11px 12px;border-bottom:1px solid #edf0f4;vertical-align:middle;white-space:nowrap;font-size:11px;color:#334155}.data-clean-table tbody tr:hover{background:#fafcff}.data-clean-table td strong{display:block;color:#172033;font-size:11px}.data-clean-table td small{display:block;margin-top:3px;color:#94a3b8;font-size:9px}.data-clean-open{height:28px;padding:0 9px;border:1px solid #d7dee7;border-radius:6px;background:#fff;color:#334155;font-size:10px;font-weight:700;cursor:pointer}.data-clean-open:hover{background:#f8fafc}.data-clean-badge{display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:23px;padding:0 7px;border-radius:6px;font-size:10px;font-weight:800}.data-clean-badge.warning{background:#fff7ed;color:#c2410c;border:1px solid #fed7aa}.data-clean-badge.danger{background:#fff1f2;color:#b91c1c;border:1px solid #fecaca}.data-clean-empty{min-height:300px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#94a3b8}.data-clean-empty strong{font-size:12px;color:#334155}.data-clean-empty span{font-size:11px}@media(max-width:900px){.data-clean-page{padding:20px 14px 40px}.data-clean-layout{display:block}.data-clean-report-list{width:100%;position:static;margin-bottom:14px}.data-clean-main{width:100%}.data-clean-panel-header{align-items:flex-start;flex-direction:column}.data-clean-search{width:100%}}
`

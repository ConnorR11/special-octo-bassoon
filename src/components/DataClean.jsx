import React, { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, RefreshCw, Database, ChevronDown, ChevronRight, Search } from "lucide-react"
import { supabase } from "../lib/supabase"

const CHECKS = [
  {
    key: "leads_missing_postcode",
    table: "leads",
    label: "Leads missing postcode",
    description: "Lead records with no postcode.",
    column: "postcode",
  },
  {
    key: "leads_missing_phone",
    table: "leads",
    label: "Leads missing phone",
    description: "Lead records with neither primary nor secondary phone number.",
    custom: true,
  },
  {
    key: "leads_missing_received",
    table: "leads",
    label: "Leads missing received date",
    description: "Lead records without a received date/time.",
    column: "received_date_time",
  },
  {
    key: "appointments_missing_rep",
    table: "appointments",
    label: "Appointments missing sales rep",
    description: "Appointments without an allocated rep.",
    column: "rep_allocated",
  },
  {
    key: "appointments_missing_date",
    table: "appointments",
    label: "Appointments missing appointment date",
    description: "Appointments without an appointment date.",
    column: "appointment_date",
  },
  {
    key: "appointments_missing_postcode",
    table: "appointments",
    label: "Appointments missing postcode",
    description: "Appointments without a postcode.",
    column: "postcode",
  },
  {
    key: "appointments_missing_email",
    table: "appointments",
    label: "Appointments missing email",
    description: "Appointments without a customer email address.",
    column: "email_address",
  },
  {
    key: "appointments_missing_result",
    table: "appointments",
    label: "Appointments missing result",
    description: "Appointments where no result has been recorded.",
    custom: true,
  },
  {
    key: "deals_missing_salesperson",
    table: "deals",
    label: "Deals missing salesperson",
    description: "Deal records without an allocated salesperson.",
    column: "salesperson",
  },
  {
    key: "deals_missing_sale_date",
    table: "deals",
    label: "Deals missing sale date",
    description: "Deal records without a sale date.",
    column: "sale_date",
  },
]

async function countMissing(check) {
  if (check.key === "appointments_missing_result") {
    const { count, error } = await supabase
      .from("appointments")
      .select("appointment_row_id", { count: "exact", head: true })
      .or("result.is.null,result.eq.")

    if (error) throw error
    return Number(count || 0)
  }

  if (check.custom) {
    const { count: primaryCount, error: primaryError } = await supabase
      .from(check.table)
      .select("delete_row_id", { count: "exact", head: true })
      .is("primary_phone_number", null)
      .is("secondary_phone_number", null)

    if (primaryError) throw primaryError
    return Number(primaryCount || 0)
  }

  const { count, error } = await supabase
    .from(check.table)
    .select("*", { count: "exact", head: true })
    .is(check.column, null)

  if (error) throw error
  return Number(count || 0)
}

async function loadAppointmentsMissingResult() {
  const { data, error } = await supabase
    .from("appointments")
    .select("appointment_row_id,name,phone_number_1,email_address,postcode,address,appointment_date,product,job_type,branch,rep_allocated,result,status")
    .or("result.is.null,result.eq.")
    .order("appointment_date", { ascending: false, nullsFirst: false })

  if (error) throw error
  return data || []
}

function DataClean() {
  const [results, setResults] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [missingResultAppointments, setMissingResultAppointments] = useState([])
  const [showMissingResults, setShowMissingResults] = useState(false)
  const [missingResultSearch, setMissingResultSearch] = useState("")
  const [loadingMissingResults, setLoadingMissingResults] = useState(false)

  async function loadChecks() {
    if (!supabase) {
      setError("Supabase is not configured.")
      setLoading(false)
      return
    }

    setLoading(true)
    setError("")

    try {
      const values = await Promise.all(
        CHECKS.map(async (check) => [check.key, await countMissing(check)])
      )
      setResults(Object.fromEntries(values))
    } catch (err) {
      console.error("Data Clean error:", err)
      setError(err?.message || "Unable to check data quality.")
      setResults({})
    } finally {
      setLoading(false)
    }
  }

  async function openMissingResultList() {
    if (showMissingResults) {
      setShowMissingResults(false)
      return
    }

    setShowMissingResults(true)
    setLoadingMissingResults(true)
    setMissingResultSearch("")

    try {
      const appointments = await loadAppointmentsMissingResult()
      setMissingResultAppointments(appointments)
    } catch (err) {
      console.error("Data Clean missing-result load error:", err)
      setError(err?.message || "Unable to load appointments without a result.")
      setMissingResultAppointments([])
    } finally {
      setLoadingMissingResults(false)
    }
  }

  useEffect(() => {
    loadChecks()
  }, [])

  const issueCount = Object.values(results).reduce((total, value) => total + Number(value || 0), 0)
  const checksWithIssues = CHECKS.filter((check) => Number(results[check.key] || 0) > 0).length

  const filteredMissingResultAppointments = missingResultAppointments.filter((appointment) => {
    const term = missingResultSearch.trim().toLowerCase()
    if (!term) return true

    return [
      appointment.name,
      appointment.phone_number_1,
      appointment.email_address,
      appointment.postcode,
      appointment.address,
      appointment.product,
      appointment.job_type,
      appointment.branch,
      appointment.rep_allocated,
      appointment.appointment_row_id,
    ].some((value) => String(value || "").toLowerCase().includes(term))
  })

  function formatAppointmentDate(value) {
    if (!value) return "—"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <section className="data-clean-page">
      <style>{`
        .data-clean-page{min-height:calc(100vh - 90px);padding:28px 32px 50px;background:#f5f7fa;color:#172033;box-sizing:border-box;font-family:Inter,Arial,sans-serif}
        .data-clean-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:22px}
        .data-clean-eyebrow{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:7px}
        .data-clean-head h1{margin:0;font-size:30px;line-height:1.1;color:#0f172a}
        .data-clean-head p{margin:8px 0 0;color:#64748b;font-size:13px}
        .data-clean-refresh{height:36px;padding:0 13px;border:1px solid #d7dee7;border-radius:8px;background:#fff;color:#334155;display:inline-flex;align-items:center;gap:7px;font:inherit;font-size:12px;cursor:pointer}
        .data-clean-refresh:disabled{opacity:.6;cursor:default}
        .data-clean-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:16px}
        .data-clean-card{background:#fff;border:1px solid #dfe5ec;border-radius:12px;padding:17px 18px}
        .data-clean-label{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#7b8797}
        .data-clean-value{margin-top:7px;font-size:25px;font-weight:750;color:#0f172a}
        .data-clean-note{margin-top:4px;font-size:11px;color:#64748b}
        .data-clean-list{background:#fff;border:1px solid #dfe5ec;border-radius:12px;overflow:hidden}
        .data-clean-list-head{padding:16px 18px;border-bottom:1px solid #e6eaf0;font-size:15px;font-weight:750;color:#0f172a}
        .data-clean-row{display:grid;grid-template-columns:36px 1.4fr 2fr 110px;gap:12px;align-items:center;padding:14px 18px;border-bottom:1px solid #edf0f4}
        .data-clean-row:last-child{border-bottom:0}
        .data-clean-icon{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:#fff4f4;color:#dc2626}
        .data-clean-title{font-size:12px;font-weight:700;color:#1e293b}
        .data-clean-desc{font-size:11px;color:#64748b}
        .data-clean-count{text-align:right;font-size:12px;font-weight:750;color:#dc2626}
        .data-clean-ok{color:#15803d}
        .data-clean-error{padding:13px 15px;margin-bottom:16px;border:1px solid #fecaca;background:#fff1f2;color:#b91c1c;border-radius:9px;font-size:12px}
        .data-clean-missing-results{margin:0 18px 18px;border:1px solid #dfe5ec;border-radius:10px;overflow:hidden;background:#fbfcfe}
        .data-clean-missing-results-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border-bottom:1px solid #e6eaf0}
        .data-clean-search{height:34px;width:min(380px,100%);display:flex;align-items:center;gap:8px;padding:0 10px;border:1px solid #d7dee7;border-radius:7px;background:#fff;color:#94a3b8;box-sizing:border-box}
        .data-clean-search input{border:0;outline:0;width:100%;font:inherit;font-size:11px;color:#334155;background:transparent}
        .data-clean-result-count{font-size:11px;color:#64748b;white-space:nowrap}
        .data-clean-appointment-table{width:100%;border-collapse:collapse;background:#fff}
        .data-clean-appointment-table th{padding:9px 11px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;background:#f8fafc;border-bottom:1px solid #e6eaf0}
        .data-clean-appointment-table td{padding:10px 11px;border-bottom:1px solid #edf0f4;font-size:10px;color:#334155;vertical-align:top}
        .data-clean-appointment-table tr:last-child td{border-bottom:0}
        .data-clean-customer{font-weight:700;color:#172033}.data-clean-sub{display:block;margin-top:3px;font-size:9px;color:#94a3b8}
        .data-clean-no-result{display:inline-flex;padding:3px 6px;border-radius:5px;background:#fff1f2;color:#b91c1c;font-size:9px;font-weight:700}
        .data-clean-empty{padding:30px;text-align:center;color:#64748b;font-size:11px}
        .data-clean-expand{width:100%;border:0;background:transparent;padding:0;text-align:left;cursor:pointer;font:inherit;color:inherit}
        .data-clean-expand-inner{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%}
        @media(max-width:800px){.data-clean-page{padding:22px 16px 35px}.data-clean-summary{grid-template-columns:1fr}.data-clean-head h1{font-size:26px}.data-clean-row{grid-template-columns:36px 1fr 80px}.data-clean-desc{margin-top:3px}.data-clean-appointment-table{min-width:850px}.data-clean-missing-results{overflow:auto}.data-clean-missing-results-toolbar{min-width:850px}}
      `}</style>

      <div className="data-clean-head">
        <div>
          <div className="data-clean-eyebrow">Administration</div>
          <h1>Data Clean</h1>
          <p>Common data-quality issues across the CRM.</p>
        </div>
        <button type="button" className="data-clean-refresh" onClick={loadChecks} disabled={loading}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && <div className="data-clean-error">{error}</div>}

      <div className="data-clean-summary">
        <div className="data-clean-card">
          <div className="data-clean-label">Issues found</div>
          <div className="data-clean-value">{loading ? "—" : issueCount.toLocaleString("en-GB")}</div>
          <div className="data-clean-note">Across the checks below</div>
        </div>
        <div className="data-clean-card">
          <div className="data-clean-label">Checks with issues</div>
          <div className="data-clean-value">{loading ? "—" : checksWithIssues}</div>
          <div className="data-clean-note">Of {CHECKS.length} checks</div>
        </div>
        <div className="data-clean-card">
          <div className="data-clean-label">Status</div>
          <div className="data-clean-value" style={{fontSize:20}}>{loading ? "Checking…" : issueCount ? "Attention required" : "All clear"}</div>
          <div className="data-clean-note">Last checked when this page loaded</div>
        </div>
      </div>

      <div className="data-clean-list">
        <div className="data-clean-list-head">
          <Database size={16} style={{verticalAlign:"-3px",marginRight:7}} /> Data quality checks
        </div>

        {CHECKS.map((check) => {
          const count = Number(results[check.key] || 0)
          const isMissingResult = check.key === "appointments_missing_result"

          return (
            <div key={check.key}>
              <div className="data-clean-row">
                <div className="data-clean-icon">
                  {count > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} className="data-clean-ok" />}
                </div>

                {isMissingResult ? (
                  <button type="button" className="data-clean-expand" onClick={openMissingResultList} disabled={!count}>
                    <div className="data-clean-expand-inner">
                      <div>
                        <div className="data-clean-title">{check.label}</div>
                        <div className="data-clean-desc">{check.description}</div>
                      </div>
                      {count > 0 && (showMissingResults ? <ChevronDown size={17} /> : <ChevronRight size={17} />)}
                    </div>
                  </button>
                ) : (
                  <div>
                    <div className="data-clean-title">{check.label}</div>
                    <div className="data-clean-desc">{check.description}</div>
                  </div>
                )}

                <div className={count ? "data-clean-count" : "data-clean-count data-clean-ok"}>
                  {loading ? "Checking…" : count ? `${count.toLocaleString("en-GB")} found` : "No issues"}
                </div>
              </div>

              {isMissingResult && showMissingResults && (
                <div className="data-clean-missing-results">
                  <div className="data-clean-missing-results-toolbar">
                    <div className="data-clean-search">
                      <Search size={14} />
                      <input
                        value={missingResultSearch}
                        onChange={(event) => setMissingResultSearch(event.target.value)}
                        placeholder="Search appointments..."
                      />
                    </div>
                    <div className="data-clean-result-count">
                      {loadingMissingResults ? "Loading..." : `${filteredMissingResultAppointments.length.toLocaleString("en-GB")} appointments`}
                    </div>
                  </div>

                  {loadingMissingResults ? (
                    <div className="data-clean-empty">Loading appointments without a result...</div>
                  ) : filteredMissingResultAppointments.length === 0 ? (
                    <div className="data-clean-empty">No appointments without a result found.</div>
                  ) : (
                    <div style={{overflowX:"auto"}}>
                      <table className="data-clean-appointment-table">
                        <thead>
                          <tr>
                            <th>Customer</th>
                            <th>Appointment</th>
                            <th>Product</th>
                            <th>Job Type</th>
                            <th>Branch</th>
                            <th>Sales Rep</th>
                            <th>Postcode</th>
                            <th>Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMissingResultAppointments.map((appointment) => (
                            <tr key={appointment.appointment_row_id}>
                              <td>
                                <span className="data-clean-customer">{appointment.name || "Unnamed customer"}</span>
                                {appointment.phone_number_1 && <span className="data-clean-sub">{appointment.phone_number_1}</span>}
                              </td>
                              <td>{formatAppointmentDate(appointment.appointment_date)}</td>
                              <td>{appointment.product || "—"}</td>
                              <td>{appointment.job_type || "—"}</td>
                              <td>{appointment.branch || "—"}</td>
                              <td>{appointment.rep_allocated || "—"}</td>
                              <td>{appointment.postcode || "—"}</td>
                              <td><span className="data-clean-no-result">No result</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default DataClean

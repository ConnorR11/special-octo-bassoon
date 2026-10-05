import React, { useEffect, useMemo, useState } from "react"
import { RefreshCw, Search, AlertTriangle, CheckCircle2 } from "lucide-react"
import { supabase } from "../lib/supabase"

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function hasResult(value) {
  return String(value ?? "").trim() !== ""
}

function searchValue(value) {
  return String(value ?? "").trim()
}

export default function DataClean({ onOpenAppointment }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  async function loadData() {
    if (!supabase) {
      setError("Supabase is not configured.")
      setLoading(false)
      return
    }

    setLoading(true)
    setError("")

    try {
      const pageSize = 1000
      let from = 0
      let allRows = []

      while (true) {
        const { data, error: queryError } = await supabase
          .from("appointments")
          .select("appointment_row_id,name,phone_number_1,email_address,postcode,address,appointment_date,product,job_type,branch,rep_allocated,result,status")
          .order("appointment_date", { ascending: false, nullsFirst: false })
          .range(from, from + pageSize - 1)

        if (queryError) throw queryError

        const page = Array.isArray(data) ? data : []
        allRows = allRows.concat(page)

        if (page.length < pageSize) break
        from += pageSize
      }

      setRows(allRows.filter((row) => !hasResult(row.result)))
    } catch (err) {
      console.error("Data Clean load error:", err)
      setError(err?.message || "Unable to load appointments.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows

    return rows.filter((row) => {
      const searchable = [
        row.name,
        row.appointment_row_id,
        row.postcode,
        row.product,
        row.job_type,
        row.branch,
        row.rep_allocated,
        row.email_address,
        row.phone_number_1,
      ].map(searchValue).join(" ").toLowerCase()

      return searchable.includes(term)
    })
  }, [rows, search])

  return (
    <section className="data-clean-page">
      <style>{styles}</style>

      <div className="data-clean-header">
        <div>
          <div className="data-clean-eyebrow">Administration</div>
          <h1>Data Clean</h1>
          <p>Appointments where no result has been recorded.</p>
        </div>

        <button type="button" className="data-clean-refresh" onClick={loadData} disabled={loading}>
          <RefreshCw size={14} className={loading ? "data-clean-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && <div className="data-clean-error">{error}</div>}

      <div className="data-clean-summary-card">
        <div className="data-clean-summary-icon">
          {rows.length > 0 ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
        </div>
        <div>
          <div className="data-clean-summary-label">Appointments missing result</div>
          <div className="data-clean-summary-number">{loading ? "—" : rows.length.toLocaleString("en-GB")}</div>
          <div className="data-clean-summary-text">The list below contains every appointment where the <strong>result</strong> field is blank.</div>
        </div>
      </div>

      <div className="data-clean-panel">
        <div className="data-clean-panel-header">
          <div>
            <h2>Appointments missing result</h2>
            <p>All appointments with no recorded result.</p>
          </div>

          <div className="data-clean-search">
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search appointments..." />
          </div>
        </div>

        {loading ? (
          <div className="data-clean-empty">
            <RefreshCw size={22} className="data-clean-spin" />
            <strong>Loading appointments...</strong>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="data-clean-empty">
            <CheckCircle2 size={28} />
            <strong>{search ? "No matching appointments" : "No appointments are missing a result"}</strong>
            <span>{search ? "Try a different search term." : "All appointments currently have a result recorded."}</span>
          </div>
        ) : (
          <>
            <div className="data-clean-count">
              Showing {filteredRows.length.toLocaleString("en-GB")} of {rows.length.toLocaleString("en-GB")} appointments
            </div>

            <div className="data-clean-table-wrap">
              <table className="data-clean-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Appointment</th>
                    <th>Postcode</th>
                    <th>Product</th>
                    <th>Job Type</th>
                    <th>Branch</th>
                    <th>Sales Rep</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, index) => (
                    <tr key={row.appointment_row_id || `${row.name}-${row.appointment_date}-${index}`}>
                      <td>
                        <strong>{row.name || "Unnamed customer"}</strong>
                        {row.appointment_row_id && <small>{row.appointment_row_id}</small>}
                      </td>
                      <td>{formatDate(row.appointment_date)}</td>
                      <td>{row.postcode || "—"}</td>
                      <td>{row.product || "—"}</td>
                      <td>{row.job_type || "—"}</td>
                      <td>{row.branch || "—"}</td>
                      <td>{row.rep_allocated || "—"}</td>
                      <td>{row.phone_number_1 || "—"}</td>
                      <td>{row.email_address || "—"}</td>
                      <td>
                        <button type="button" className="data-clean-open" onClick={() => onOpenAppointment?.(row)}>
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

const styles = `
.data-clean-page{min-height:calc(100vh - 90px);padding:28px 32px 50px;background:#f5f7fa;color:#172033;box-sizing:border-box;font-family:Inter,Arial,sans-serif}
.data-clean-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:22px}
.data-clean-eyebrow{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:7px}
.data-clean-header h1{margin:0;font-size:30px;line-height:1.1;color:#0f172a}
.data-clean-header p{margin:8px 0 0;font-size:13px;color:#64748b}
.data-clean-refresh{height:36px;padding:0 13px;border:1px solid #d7dee7;border-radius:8px;background:#fff;color:#334155;display:inline-flex;align-items:center;gap:7px;font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.data-clean-refresh:disabled{opacity:.6;cursor:default}
.data-clean-spin{animation:data-clean-spin 1s linear infinite}@keyframes data-clean-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.data-clean-error{padding:13px 15px;margin-bottom:16px;border:1px solid #fecaca;background:#fff1f2;color:#b91c1c;border-radius:9px;font-size:12px}
.data-clean-summary-card{display:flex;align-items:center;gap:14px;background:#fff;border:1px solid #dfe5ec;border-radius:11px;padding:18px;margin-bottom:16px}
.data-clean-summary-icon{width:42px;height:42px;display:flex;align-items:center;justify-content:center;border-radius:9px;background:#fff7ed;color:#c2410c;flex:0 0 auto}
.data-clean-summary-label{font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.06em}
.data-clean-summary-number{margin-top:2px;font-size:26px;line-height:1.1;font-weight:750;color:#0f172a}
.data-clean-summary-text{margin-top:4px;font-size:12px;color:#64748b}
.data-clean-panel{background:#fff;border:1px solid #dfe5ec;border-radius:12px;overflow:hidden}
.data-clean-panel-header{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:17px 18px;border-bottom:1px solid #e6eaf0}
.data-clean-panel-header h2{margin:0;font-size:16px;color:#0f172a}
.data-clean-panel-header p{margin:4px 0 0;font-size:11px;color:#64748b}
.data-clean-search{width:min(360px,100%);height:36px;display:flex;align-items:center;gap:8px;padding:0 11px;box-sizing:border-box;border:1px solid #d7dee7;border-radius:8px;background:#fff;color:#64748b}
.data-clean-search input{width:100%;border:0;outline:0;background:transparent;color:#172033;font:inherit;font-size:12px}
.data-clean-count{padding:10px 18px;background:#fafbfc;border-bottom:1px solid #e6eaf0;font-size:10px;font-weight:700;color:#64748b}
.data-clean-table-wrap{width:100%;overflow:auto}
.data-clean-table{width:100%;min-width:1250px;border-collapse:collapse}
.data-clean-table th{padding:10px 12px;background:#f8fafc;border-bottom:1px solid #dfe5ec;text-align:left;white-space:nowrap;font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.04em}
.data-clean-table td{padding:11px 12px;border-bottom:1px solid #edf0f4;vertical-align:middle;white-space:nowrap;font-size:11px;color:#334155}
.data-clean-table tbody tr:hover{background:#fafcff}
.data-clean-table td strong{display:block;color:#172033;font-size:11px}
.data-clean-table td small{display:block;margin-top:3px;color:#94a3b8;font-size:8px}
.data-clean-open{height:28px;padding:0 10px;border:1px solid #d7dee7;border-radius:6px;background:#fff;color:#172554;font-size:10px;font-weight:700;cursor:pointer}
.data-clean-open:hover{background:#f8fafc}
.data-clean-empty{min-height:240px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#94a3b8;text-align:center}
.data-clean-empty strong{color:#334155;font-size:13px}.data-clean-empty span{font-size:11px}
@media (max-width:900px){.data-clean-page{padding:20px 16px 40px}.data-clean-header,.data-clean-panel-header{flex-direction:column;align-items:stretch}.data-clean-search{width:100%}}
`

import React, { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, RefreshCw, Database } from "lucide-react"
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

function DataClean() {
  const [results, setResults] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

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

  useEffect(() => {
    loadChecks()
  }, [])

  const issueCount = Object.values(results).reduce((total, value) => total + Number(value || 0), 0)
  const checksWithIssues = CHECKS.filter((check) => Number(results[check.key] || 0) > 0).length

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
        @media(max-width:800px){.data-clean-page{padding:22px 16px 35px}.data-clean-summary{grid-template-columns:1fr}.data-clean-head h1{font-size:26px}.data-clean-row{grid-template-columns:36px 1fr 80px}.data-clean-desc{margin-top:3px}}
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
        <div className="data-clean-list-head"><Database size={16} style={{verticalAlign:"-3px",marginRight:7}} /> Data quality checks</div>
        {CHECKS.map((check) => {
          const count = Number(results[check.key] || 0)
          return (
            <div className="data-clean-row" key={check.key}>
              <div className="data-clean-icon">
                {count > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} className="data-clean-ok" />}
              </div>
              <div>
                <div className="data-clean-title">{check.label}</div>
                <div className="data-clean-desc">{check.description}</div>
              </div>
              <div className={count ? "data-clean-count" : "data-clean-count data-clean-ok"}>
                {loading ? "Checking…" : count ? `${count.toLocaleString("en-GB")} found` : "No issues"}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default DataClean

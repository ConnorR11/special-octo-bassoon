import React, { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw, Search, FileText, ClipboardCheck, AlertCircle } from "lucide-react"
import { supabase } from "../lib/supabase"
import SurveyProgressBar from "../components/SurveyProgressBar"

const styles = {
  page: { padding: "24px 28px 40px", color: "#17212b", minHeight: "100%", background: "#f6f8fb", boxSizing: "border-box" },
  container: { maxWidth: 1500, margin: "0 auto" },
  panel: { background: "#fff", border: "1px solid #e1e7ee", borderRadius: 12, boxShadow: "0 2px 8px rgba(15,23,42,.04)" },
  input: { height: 38, border: "1px solid #d8e0e8", borderRadius: 7, padding: "0 11px", fontSize: 12, minWidth: 230, outline: "none" },
  button: { height: 36, border: "1px solid #d8e0e8", borderRadius: 7, background: "#fff", padding: "0 12px", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#334155" },
  th: { padding: "12px 14px", textAlign: "left", color: "#64748b", fontSize: 10, letterSpacing: ".04em", textTransform: "uppercase", borderBottom: "1px solid #e8edf2", whiteSpace: "nowrap" },
  td: { padding: "13px 14px", borderBottom: "1px solid #edf1f5", fontSize: 12, verticalAlign: "middle" },
}

function formatDate(value) {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function isSolarDeal(deal) {
  return /solar/i.test(String(deal?.product || "")) || /solar/i.test(String(deal?.pipedrive_data?.product || ""))
}

function getPipedriveStage(deal) {
  return String(deal?.pipedrive_stage || deal?.stage || deal?.pipedrive_data?.pipedrive_stage || deal?.pipedrive_data?.stage || deal?.pipedrive_data?.stage_name || "").trim()
}

function hasDigitalContract(appointment) {
  return Boolean(
    String(appointment?.contract_number || "").trim() &&
    appointment?.signature_path &&
    appointment?.express_fit_signature_path &&
    appointment?.seg_disclaimer_signature_path
  )
}

export default function OutstandingSolarSurveys({ onSelectDeal }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [lastUpdated, setLastUpdated] = useState(null)

  const load = useCallback(async () => {
    if (!supabase) {
      setError("Supabase is not configured.")
      setLoading(false)
      return
    }
    setLoading(true)
    setError("")
    try {
      // Single-table query: global RLS policies control visibility.
      // Survey status is denormalised onto deals and kept current by database triggers.
      const { data: deals, error: dealsError } = await supabase
        .from("deals")
        .select("*")
        .gte("sale_date", "2026-01-01")
        .or("product.ilike.%solar%,pipedrive_data->>product.ilike.%solar%")
        .eq("has_digital_contract", true)
        .eq("has_survey_pdf", false)
        .order("sale_date", { ascending: false })
      if (dealsError) throw dealsError

      const excludedStages = new Set(["customer cancelled", "decline"])
      const outstanding = (deals || [])
        .filter(isSolarDeal)
        .filter(deal => !excludedStages.has(getPipedriveStage(deal).toLowerCase()))
        .map(deal => {
          const progress = deal.survey_progress || {}
          return {
            ...deal,
            linked_contract_number: deal.contract_number || "",
            surveyProgress: [
              progress.video || "outstanding",
              progress.epvs_waiver || "outstanding",
              progress.checklist || "outstanding",
              progress.photos || "outstanding",
            ],
          }
        })
      setRows(outstanding)
      setLastUpdated(new Date())
    } catch (e) {
      console.error("Unable to load outstanding solar surveys:", e)
      setError(e?.message || "Unable to load outstanding solar surveys.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(deal => [
      deal.customer_name, deal.contract_number, deal.linked_contract_number, deal.postcode,
      deal.address, deal.salesperson, deal.branch, deal.appointment_row_id,
    ].some(value => String(value || "").toLowerCase().includes(term)))
  }, [rows, search])

  return (
    <section style={styles.page}>
      <style>{`
        .outstanding-surveys-table-wrap{overflow:auto}
        .outstanding-surveys-table{width:100%;border-collapse:collapse;min-width:850px}
        .outstanding-surveys-table tbody tr:hover{background:#f0f7ff}
        .outstanding-surveys-table tbody tr[data-clickable="true"]{cursor:pointer}
        .outstanding-surveys-table tbody tr[data-clickable="true"]:focus{outline:2px solid #1684c7;outline-offset:-2px}
        .outstanding-surveys-open{border:0;background:transparent;color:#0877bd;font-size:11px;font-weight:750;display:inline-flex;align-items:center;gap:5px;cursor:pointer;padding:5px}
        @media(max-width:700px){.outstanding-surveys-page{padding:16px 10px!important}}
      `}</style>
      <div className="outstanding-surveys-page" style={styles.container}>
        <div style={styles.panel}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 16, flexWrap: "wrap", borderBottom: "1px solid #e8edf2" }}>
            <div style={{ fontSize: 12, fontWeight: 750, color: "#334155", whiteSpace: "nowrap" }}>Outstanding surveys <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 22, height: 22, padding: "0 6px", marginLeft: 5, boxSizing: "border-box", borderRadius: 999, background: "#e8eef4", color: "#17364b", fontSize: 11 }}>{loading ? "…" : rows.length.toLocaleString("en-GB")}</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={15} style={{ position: "absolute", left: 11, color: "#94a3b8" }}/>
              <input aria-label="Search outstanding surveys" placeholder="Search customer, contract, postcode…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...styles.input, paddingLeft: 34, width: 310, maxWidth: "75vw" }}/>
              </div>
              <span style={{ color: "#94a3b8", fontSize: 10, whiteSpace: "nowrap" }}>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
              <button type="button" style={styles.button} onClick={load} disabled={loading}><RefreshCw size={14}/>{loading ? "Refreshing…" : "Refresh list"}</button>
            </div>
          </div>
          {error && <div style={{ margin: 16, padding: 12, borderRadius: 8, background: "#fff1f0", color: "#a12b23", fontSize: 12, display: "flex", gap: 8, alignItems: "center" }}><AlertCircle size={16}/>{error}</div>}
          {!error && !loading && filteredRows.length === 0 && <div style={{ padding: "46px 20px", textAlign: "center", color: "#64748b" }}><FileText size={26} style={{ marginBottom: 9, color: "#94a3b8" }}/><div style={{ fontSize: 13, fontWeight: 750, color: "#334155" }}>No outstanding surveys found</div><div style={{ marginTop: 5, fontSize: 11 }}>All matching solar deals have a survey PDF, or there are no qualifying digital contracts.</div></div>}
          <div className="outstanding-surveys-table-wrap">
            <table className="outstanding-surveys-table">
              <thead><tr>
                <th style={styles.th}>Customer / Contract</th><th style={styles.th}>Postcode</th><th style={styles.th}>Pipedrive stage</th><th style={styles.th}>Sale date</th><th style={styles.th}>Salesperson</th><th style={styles.th}>Survey progress</th>
              </tr></thead>
              <tbody>
                {loading && <tr><td style={styles.td} colSpan={7}>Loading outstanding surveys…</td></tr>}
                {!loading && filteredRows.map(deal => <tr key={deal.id} data-clickable={onSelectDeal ? "true" : "false"} onClick={() => onSelectDeal?.(deal)} onKeyDown={e => { if (onSelectDeal && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelectDeal(deal) } }} tabIndex={onSelectDeal ? 0 : undefined} role={onSelectDeal ? "button" : undefined}>
                  <td style={styles.td}><div style={{ fontWeight: 750, color: "#1e293b" }}>{deal.customer_name || "Unnamed customer"}</div><div style={{ color: "#94a3b8", fontSize: 10, marginTop: 4 }}>{deal.contract_number || deal.linked_contract_number || "No contract number"}</div></td>
                  <td style={styles.td}>{deal.postcode || "—"}</td>
                  <td style={styles.td}>{getPipedriveStage(deal) || "—"}</td>
                  <td style={styles.td}>{formatDate(deal.sale_date)}</td>
                  <td style={styles.td}>{deal.salesperson_name || deal.salesperson || "—"}</td>
                  <td style={styles.td}>
<SurveyProgressBar progress={deal.surveyProgress} compact />
                  </td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}

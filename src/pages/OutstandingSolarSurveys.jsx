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

function isContractNumberAtLeastS12345(value) {
  const match = String(value || "").trim().match(/^S(\d+)$/i)
  return Boolean(match && Number(match[1]) >= 12345)
}

export default function OutstandingSolarSurveys({ onSelectDeal }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [hasNextPage, setHasNextPage] = useState(false)
  const pageSize = 50
  const [lastUpdated, setLastUpdated] = useState(null)

  const load = useCallback(async (requestedPage = page, requestedSearch = search) => {
    if (!supabase) {
      setError("Supabase is not configured.")
      setLoading(false)
      return
    }
    setLoading(true)
    setError("")
    try {
      // Server-side pagination: only load the current page plus one row to
      // determine whether a next page exists. Do not scan/download every deal.
      let query = supabase
        .from("deals")
        .select("*")
        .gte("contract_number", "S12345")
        .order("contract_number", { ascending: true })
        .range(requestedPage * pageSize, requestedPage * pageSize + pageSize)

      const term = requestedSearch.trim()
      if (term) {
        const safeTerm = term.replace(/[,%()]/g, " ").trim()
        if (safeTerm) {
          query = query.or([
            `customer_name.ilike.%${safeTerm}%`,
            `contract_number.ilike.%${safeTerm}%`,
            `postcode.ilike.%${safeTerm}%`,
            `address.ilike.%${safeTerm}%`,
            `salesperson.ilike.%${safeTerm}%`,
            `branch.ilike.%${safeTerm}%`,
          ].join(","))
        }
      }

      const { data, error: dealsError } = await query
      if (dealsError) throw dealsError
      const fetchedDeals = data || []
      setHasNextPage(fetchedDeals.length > pageSize)
      const currentDeals = fetchedDeals.slice(0, pageSize)
      const solarDealIds = currentDeals.map(deal => String(deal.id))

      let allProgressDocs = []
      let allProgressAnswers = new Map()
      if (solarDealIds.length) {
        const [{ data: docs, error: docsError }, { data: answers, error: answersError }] = await Promise.all([
          supabase.from("deal_documents").select("deal_id,category,survey_section").in("deal_id", solarDealIds),
          supabase.from("deal_survey_answers").select("deal_id,answers").in("deal_id", solarDealIds),
        ])
        if (docsError) throw docsError
        if (answersError) throw answersError
        allProgressDocs = docs || []
        allProgressAnswers = new Map((answers || []).map(item => [String(item.deal_id), item.answers || {}]))
      }

      const docsByDealId = new Map()
      for (const doc of allProgressDocs) {
        const id = String(doc.deal_id)
        if (!docsByDealId.has(id)) docsByDealId.set(id, [])
        docsByDealId.get(id).push(doc)
      }
      const photoSections = ["Front of Property", "Rear of Property", "Side of Property", "Close Up of Consumer Unit", "Close Up of Electricity Meter", "Close Up of Cut Out", "Wide Of Consumer Unit", "Loft Access Point", "Loft Roof Truss", "Internet DC Route", "External DC Route", "Proposed Inverter Location", "Proposed Battery Location", "Proposed Canopy Location", "Proposed Panel Layout", "Alternative Roof Elevations", "Existing Solar Equipment", "Existing EV Charger", "High Electrical Usage Items", "Shading Issues"]
      const outstanding = currentDeals
        .filter(deal => isContractNumberAtLeastS12345(deal.contract_number))
        .map(deal => {
          const dealDocs = docsByDealId.get(String(deal.id)) || []
          const answers = allProgressAnswers.get(String(deal.id)) || {}
          const answeredCount = Object.values(answers).filter(value => String(value || "").trim()).length
          const checklistComplete = answeredCount >= 27
          const photoSectionsComplete = new Set(dealDocs.filter(doc => doc.category === "survey_photos").map(doc => doc.survey_section || "Front of Property"))
          const photoCount = dealDocs.filter(doc => doc.category === "survey_photos").length
          return {
            ...deal,
            linked_contract_number: deal.contract_number || "",
            surveyProgress: [
              dealDocs.some(doc => doc.category === "survey_video") ? "complete" : "outstanding",
              dealDocs.some(doc => doc.category === "electricity_bill_epvs_waiver") ? "complete" : "outstanding",
              checklistComplete ? "complete" : answeredCount > 0 ? "in-progress" : "outstanding",
              photoSections.every(section => photoSectionsComplete.has(section)) ? "complete" : photoCount > 0 ? "in-progress" : "outstanding",
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
  }, [page, search])

  useEffect(() => { load(page, search) }, [load, page, search])

  const filteredRows = rows
  const changeSearch = value => {
    setSearch(value)
    setPage(0)
  }

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
            <div style={{ fontSize: 12, fontWeight: 750, color: "#334155", whiteSpace: "nowrap" }}>Outstanding surveys <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 22, height: 22, padding: "0 6px", marginLeft: 5, boxSizing: "border-box", borderRadius: 999, background: "#e8eef4", color: "#17364b", fontSize: 11 }}>{loading ? "…" : `${rows.length.toLocaleString("en-GB")} on this page`}</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={15} style={{ position: "absolute", left: 11, color: "#94a3b8" }}/>
              <input aria-label="Search outstanding surveys" placeholder="Search customer, contract, postcode…" value={search} onChange={e => changeSearch(e.target.value)} style={{ ...styles.input, paddingLeft: 34, width: 310, maxWidth: "75vw" }}/>
              </div>
              <span style={{ color: "#94a3b8", fontSize: 10, whiteSpace: "nowrap" }}>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
              <button type="button" style={styles.button} onClick={() => load(page, search)} disabled={loading}><RefreshCw size={14}/>{loading ? "Refreshing…" : "Refresh list"}</button>
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", borderTop: "1px solid #e8edf2", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#64748b" }}>
              {loading ? "Loading page…" : `Showing ${rows.length ? page * pageSize + 1 : 0}–${page * pageSize + rows.length} · Page ${page + 1}`}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" style={{ ...styles.button, opacity: page === 0 || loading ? 0.5 : 1, cursor: page === 0 || loading ? "not-allowed" : "pointer" }} disabled={page === 0 || loading} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</button>
              <button type="button" style={{ ...styles.button, opacity: !hasNextPage || loading ? 0.5 : 1, cursor: !hasNextPage || loading ? "not-allowed" : "pointer" }} disabled={!hasNextPage || loading} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

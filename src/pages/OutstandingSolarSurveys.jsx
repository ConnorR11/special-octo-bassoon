import React, { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw, Search, FileText, ClipboardCheck, AlertCircle, ExternalLink } from "lucide-react"
import { supabase } from "../lib/supabase"

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
      const solarDeals = []
      let dealOffset = 0
      while (true) {
        const { data, error: dealsError } = await supabase
          .from("deals")
          .select("*")
          .ilike("product", "%solar%")
          .order("sale_date", { ascending: false })
          .range(dealOffset, dealOffset + 999)
        if (dealsError) throw dealsError
        const batch = data || []
        solarDeals.push(...batch)
        if (batch.length < 1000) break
        dealOffset += 1000
      }

      const appointmentIds = [...new Set(solarDeals.map(deal => String(deal.appointment_row_id || "")).filter(Boolean))]
      const appointmentRows = []
      for (let offset = 0; offset < appointmentIds.length; offset += 500) {
        const { data, error: appointmentsError } = await supabase
          .from("appointments")
          .select("appointment_row_id,contract_number,signature_path,express_fit_signature_path,seg_disclaimer_signature_path")
          .in("appointment_row_id", appointmentIds.slice(offset, offset + 500))
        if (appointmentsError) throw appointmentsError
        appointmentRows.push(...(data || []))
      }

      const solarDealIds = solarDeals.map(deal => String(deal.id))
      const surveyDocumentRows = []
      const surveyProgressRows = []
      for (let offset = 0; offset < solarDealIds.length; offset += 500) {
        const { data, error: documentsError } = await supabase
          .from("deal_documents")
          .select("deal_id")
          .eq("category", "survey_pdf")
          .in("deal_id", solarDealIds.slice(offset, offset + 500))
        if (documentsError) throw documentsError
        surveyDocumentRows.push(...(data || []))
      }
      for (let offset = 0; offset < solarDealIds.length; offset += 500) {
        const ids = solarDealIds.slice(offset, offset + 500)
        const [{ data: docs, error: docsError }, { data: answers, error: answersError }] = await Promise.all([
          supabase.from("deal_documents").select("deal_id,category,survey_section").in("deal_id", ids),
          supabase.from("deal_survey_answers").select("deal_id,answers").in("deal_id", ids),
        ])
        if (docsError) throw docsError
        if (answersError) throw answersError
        surveyProgressRows.push({ docs: docs || [], answers: answers || [] })
      }

      const appointmentsById = new Map(appointmentRows.map(item => [String(item.appointment_row_id), item]))
      const generatedSurveyDealIds = new Set(surveyDocumentRows.map(item => String(item.deal_id)))
      const allProgressDocs = surveyProgressRows.flatMap(batch => batch.docs)
      const allProgressAnswers = new Map(surveyProgressRows.flatMap(batch => batch.answers).map(item => [String(item.deal_id), item.answers || {}]))
      const photoSections = ["Front of Property", "Inverter Location", "Consumer Unit", "Roof", "Loft"]
      const outstanding = solarDeals
        .filter(deal => {
          const appointment = appointmentsById.get(String(deal.appointment_row_id || ""))
          return hasDigitalContract(appointment) && !generatedSurveyDealIds.has(String(deal.id))
        })
        .map(deal => {
          const dealDocs = allProgressDocs.filter(doc => String(doc.deal_id) === String(deal.id))
          const answers = allProgressAnswers.get(String(deal.id)) || {}
          const answeredCount = Object.values(answers).filter(value => String(value || "").trim()).length
          const checklistComplete = answeredCount > 0 && answeredCount >= 10
          const photoSectionsComplete = new Set(dealDocs.filter(doc => doc.category === "survey_photos").map(doc => doc.survey_section || "Front of Property"))
          return {
            ...deal,
            linked_contract_number: appointmentsById.get(String(deal.appointment_row_id || ""))?.contract_number || "",
            surveyProgress: [
              dealDocs.some(doc => doc.category === "survey_video"),
              dealDocs.some(doc => doc.category === "electricity_bill_epvs_waiver"),
              checklistComplete,
              photoSections.every(section => photoSectionsComplete.has(section)),
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
        .outstanding-surveys-table tbody tr:hover{background:#f8fbff}
        .outstanding-surveys-open{border:0;background:transparent;color:#0877bd;font-size:11px;font-weight:750;display:inline-flex;align-items:center;gap:5px;cursor:pointer;padding:5px}
        @media(max-width:700px){.outstanding-surveys-page{padding:16px 10px!important}}
      `}</style>
      <div className="outstanding-surveys-page" style={styles.container}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: "#fff0dc", color: "#b96b08", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}><ClipboardCheck size={23}/></div>
            <div>
              <div style={{ color: "#b96b08", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Solar</div>
              <h1 style={{ margin: 0, fontSize: 27, letterSpacing: "-.025em" }}>Outstanding Solar Surveys</h1>
              <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 12 }}>Solar deals with a completed digital contract but no generated survey PDF.</p>
            </div>
          </div>
          <button type="button" style={styles.button} onClick={load} disabled={loading}><RefreshCw size={14}/>{loading ? "Refreshing…" : "Refresh list"}</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 16 }}>
          <div style={{ ...styles.panel, padding: "16px 18px" }}>
            <div style={{ color: "#64748b", fontSize: 10, fontWeight: 750, textTransform: "uppercase" }}>Outstanding surveys</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 7 }}>{loading ? "—" : rows.length.toLocaleString("en-GB")}</div>
          </div>
          <div style={{ ...styles.panel, padding: "16px 18px" }}>
            <div style={{ color: "#64748b", fontSize: 10, fontWeight: 750, textTransform: "uppercase" }}>Matching records</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 7 }}>{loading ? "—" : filteredRows.length.toLocaleString("en-GB")}</div>
          </div>
        </div>

        <div style={styles.panel}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 16, flexWrap: "wrap", borderBottom: "1px solid #e8edf2" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={15} style={{ position: "absolute", left: 11, color: "#94a3b8" }}/>
              <input aria-label="Search outstanding surveys" placeholder="Search customer, contract, postcode…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...styles.input, paddingLeft: 34, width: 310, maxWidth: "75vw" }}/>
            </div>
            <span style={{ color: "#94a3b8", fontSize: 10 }}>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
          </div>
          {error && <div style={{ margin: 16, padding: 12, borderRadius: 8, background: "#fff1f0", color: "#a12b23", fontSize: 12, display: "flex", gap: 8, alignItems: "center" }}><AlertCircle size={16}/>{error}</div>}
          {!error && !loading && filteredRows.length === 0 && <div style={{ padding: "46px 20px", textAlign: "center", color: "#64748b" }}><FileText size={26} style={{ marginBottom: 9, color: "#94a3b8" }}/><div style={{ fontSize: 13, fontWeight: 750, color: "#334155" }}>No outstanding surveys found</div><div style={{ marginTop: 5, fontSize: 11 }}>All matching solar deals have a survey PDF, or there are no qualifying digital contracts.</div></div>}
          <div className="outstanding-surveys-table-wrap">
            <table className="outstanding-surveys-table">
              <thead><tr>
                <th style={styles.th}>Customer / Contract</th><th style={styles.th}>Postcode</th><th style={styles.th}>Pipedrive stage</th><th style={styles.th}>Sale date</th><th style={styles.th}>Salesperson</th><th style={styles.th}>Survey progress</th><th style={styles.th}>Action</th>
              </tr></thead>
              <tbody>
                {loading && <tr><td style={styles.td} colSpan={7}>Loading outstanding surveys…</td></tr>}
                {!loading && filteredRows.map(deal => <tr key={deal.id}>
                  <td style={styles.td}><div style={{ fontWeight: 750, color: "#1e293b" }}>{deal.customer_name || "Unnamed customer"}</div><div style={{ color: "#94a3b8", fontSize: 10, marginTop: 4 }}>{deal.contract_number || deal.linked_contract_number || "No contract number"}</div></td>
                  <td style={styles.td}>{deal.postcode || "—"}</td>
                  <td style={styles.td}>{deal.stage || deal.pipedrive_stage || deal.pipedrive_data?.stage || deal.pipedrive_data?.stage_name || "—"}</td>
                  <td style={styles.td}>{formatDate(deal.sale_date)}</td>
                  <td style={styles.td}>{deal.salesperson_name || deal.salesperson || "—"}</td>
                  <td style={styles.td}>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(24px,1fr))",gap:5,minWidth:140}}>
                      {["Video","Bill","Checklist","Photos"].map((label,index) => <div key={label} title={label + (deal.surveyProgress?.[index] ? " complete" : " outstanding")}>
                        <div style={{height:7,borderRadius:99,background:deal.surveyProgress?.[index] ? "#16845b" : "#e5eaf0"}} />
                        <div style={{fontSize:9,color:deal.surveyProgress?.[index] ? "#16845b" : "#64748b",marginTop:4}}>{label}</div>
                      </div>)}
                    </div>
                  </td>
                  <td style={styles.td}><button type="button" className="outstanding-surveys-open" onClick={() => onSelectDeal?.(deal)}><ExternalLink size={13}/>Open deal</button></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}

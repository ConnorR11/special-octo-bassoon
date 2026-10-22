import React, { useEffect, useMemo, useState } from "react"
import { AlertCircle, CheckCircle2, ExternalLink, Link2, RefreshCw, Search, Sun, UserRound } from "lucide-react"
import { supabase } from "../lib/supabase"

const PAGE_SIZE = 100
const FETCH_SIZE = 1000
const UNSUITABLE_RESULTS = new Set(["DELETED", "REMOVED", "INVALID", "DUPLICATE", "NO COVER", "SINGLEHEAD"])

function normalise(value) { return String(value ?? "").trim() }
function normaliseResult(value) { return normalise(value).replace(/\s+/g, " ").toUpperCase() }
function dateLabel(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

export default function SolarRework({ onSelectAppointment }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [resultFilter, setResultFilter] = useState("all")
  const [linkFilter, setLinkFilter] = useState("all")
  const [suitabilityFilter, setSuitabilityFilter] = useState("all")
  const [page, setPage] = useState(0)

  async function loadRows() {
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return }
    setLoading(true)
    setError("")
    try {
      const fetched = []
      let from = 0
      while (true) {
        const { data, error: queryError } = await supabase
          .from("appointments")
          .select("appointment_row_id,name,postcode,address,phone_number_1,secondary_phone_number,email_address,appointment_date,result,job_type,product,open_solar_id,epvs_calculation")
          .ilike("job_type", "%solar%")
          .order("appointment_date", { ascending: false, nullsFirst: false })
          .range(from, from + FETCH_SIZE - 1)
        if (queryError) throw queryError
        const batch = data || []
        fetched.push(...batch)
        if (batch.length < FETCH_SIZE) break
        from += FETCH_SIZE
      }
      setRows(fetched.filter(row => normalise(row.job_type).toLowerCase() === "solar" && normaliseResult(row.result) !== "SOLD" && (row.open_solar_id === null || row.open_solar_id === undefined || String(row.open_solar_id).trim() === "")))
    } catch (err) {
      setError(err?.message || "Unable to load historical solar appointments.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRows() }, [])

  const filteredRows = useMemo(() => {
    const needle = normalise(query).toLowerCase()
    return rows.filter(row => {
      const result = normaliseResult(row.result)
      const unsuitable = UNSUITABLE_RESULTS.has(result)
      const linked = row.open_solar_id !== null && row.open_solar_id !== undefined && String(row.open_solar_id).trim() !== ""
      const hasEpvs = row.epvs_calculation !== null && row.epvs_calculation !== undefined
      if (resultFilter !== "all" && result !== resultFilter) return false
      if (linkFilter === "linked" && !linked) return false
      if (linkFilter === "unlinked" && linked) return false
      if (suitabilityFilter === "suitable" && unsuitable) return false
      if (suitabilityFilter === "unsuitable" && !unsuitable) return false
      if (needle && ![
        row.name, row.postcode, row.address, row.phone_number_1, row.secondary_phone_number,
        row.email_address, row.appointment_row_id, row.product, row.result, row.open_solar_id
      ].some(value => String(value ?? "").toLowerCase().includes(needle))) return false
      return true
    })
  }, [rows, query, resultFilter, linkFilter, suitabilityFilter])

  useEffect(() => { setPage(0) }, [query, resultFilter, linkFilter, suitabilityFilter])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const visibleRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const linkedCount = rows.filter(row => row.open_solar_id !== null && row.open_solar_id !== undefined && String(row.open_solar_id).trim() !== "").length
  const epvsCount = rows.filter(row => row.epvs_calculation !== null && row.epvs_calculation !== undefined).length
  const unsuitableCount = rows.filter(row => UNSUITABLE_RESULTS.has(normaliseResult(row.result))).length
  const unlinkedCount = rows.length - linkedCount
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
        <p style={{ margin: "7px 0 0", color: "#64748b", fontSize: 13 }}>Historical non-sold solar appointments, OpenSolar matching and quote preparation.</p>
      </div>
      <button onClick={loadRows} disabled={loading} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 8, padding: "9px 13px", display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 650, cursor: loading ? "wait" : "pointer" }}>
        <RefreshCw size={14} /> Refresh list
      </button>
    </div>

    {error && <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: "#fff1f2", color: "#be123c", fontSize: 12 }}>{error}</div>}

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 18 }}>
      <div style={cardStyle}><div style={muted}>Non-sold solar appointments</div><div style={{ fontSize: 25, fontWeight: 750, marginTop: 6 }}>{loading ? "…" : rows.length.toLocaleString("en-GB")}</div><div style={muted}>Sold appointments excluded</div></div>
      <div style={cardStyle}><div style={muted}>Unlinked to OpenSolar</div><div style={{ fontSize: 25, fontWeight: 750, marginTop: 6 }}>{loading ? "…" : unlinkedCount.toLocaleString("en-GB")}</div><div style={muted}>Ready for manual matching</div></div>
      <div style={cardStyle}><div style={muted}>Already linked</div><div style={{ fontSize: 25, fontWeight: 750, marginTop: 6 }}>{loading ? "…" : linkedCount.toLocaleString("en-GB")}</div><div style={muted}>OpenSolar ID recorded</div></div>
      <div style={cardStyle}><div style={muted}>With EPVS data</div><div style={{ fontSize: 25, fontWeight: 750, marginTop: 6 }}>{loading ? "…" : epvsCount.toLocaleString("en-GB")}</div><div style={muted}>Calculation data present</div></div>
      <div style={cardStyle}><div style={muted}>Unsuitable statuses</div><div style={{ fontSize: 25, fontWeight: 750, marginTop: 6 }}>{loading ? "…" : unsuitableCount.toLocaleString("en-GB")}</div><div style={muted}>Retained, not deleted</div></div>
    </div>

    <div style={{ ...cardStyle, padding: 13, marginBottom: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,2fr) repeat(3,minmax(145px,1fr))", gap: 10 }}>
        <div style={{ position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 11, top: 12, color: "#64748b" }} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, postcode, phone, email…" style={{ ...inputStyle, width: "100%", paddingLeft: 33, boxSizing: "border-box" }} />
        </div>
        <select value={linkFilter} onChange={event => setLinkFilter(event.target.value)} style={selectStyle}>
          <option value="all">All OpenSolar links</option><option value="unlinked">Unlinked — manual matching</option><option value="linked">Already linked</option>
        </select>
        <select value={suitabilityFilter} onChange={event => setSuitabilityFilter(event.target.value)} style={selectStyle}>
          <option value="all">All suitability statuses</option><option value="suitable">Potentially reworkable</option><option value="unsuitable">Unsuitable status</option>
        </select>
        <select value={resultFilter} onChange={event => setResultFilter(event.target.value)} style={selectStyle}>
          <option value="all">All appointment results</option>
          {[...new Set(rows.map(row => normaliseResult(row.result) || "No result"))].sort().map(result => <option key={result} value={result === "No result" ? "" : result}>{result}</option>)}
        </select>
      </div>
      <div style={{ ...muted, marginTop: 9 }}>Unsuitable statuses are flagged (Deleted, Removed, Invalid, Duplicate, No Cover and Singlehead); records remain visible and searchable.</div>
    </div>

    <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid #e2e8f0", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{loading ? "Loading appointments…" : `Showing ${filteredRows.length ? page * PAGE_SIZE + 1 : 0}–${Math.min((page + 1) * PAGE_SIZE, filteredRows.length)} of ${filteredRows.length.toLocaleString("en-GB")} appointments`}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button disabled={page === 0 || loading} onClick={() => setPage(value => Math.max(0, value - 1))} style={{ ...selectStyle, padding: "0 12px" }}>Previous</button>
          <span style={muted}>Page {page + 1} of {pageCount}</span>
          <button disabled={page + 1 >= pageCount || loading} onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))} style={{ ...selectStyle, padding: "0 12px" }}>Next</button>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1080, fontSize: 12 }}>
          <thead><tr style={{ background: "#f8fafc", textAlign: "left", color: "#475569" }}>
            {["Appointment / customer","Date","Result / suitability","Contact","OpenSolar","EPVS data",""].map((heading, index) => <th key={heading || index} style={{ padding: "11px 13px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, whiteSpace: "nowrap" }}>{heading}</th>)}
          </tr></thead>
          <tbody>
            {!loading && visibleRows.length === 0 && <tr><td colSpan={7} style={{ padding: 28, textAlign: "center", color: "#64748b" }}>No appointments match these filters.</td></tr>}
            {visibleRows.map(row => {
              const result = normaliseResult(row.result)
              const unsuitable = UNSUITABLE_RESULTS.has(result)
              const linked = row.open_solar_id !== null && row.open_solar_id !== undefined && String(row.open_solar_id).trim() !== ""
              const hasEpvs = row.epvs_calculation !== null && row.epvs_calculation !== undefined
              return <tr key={row.appointment_row_id} style={{ borderBottom: "1px solid #edf2f7" }}>
                <td style={{ padding: "12px 13px", maxWidth: 240 }}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>{normalise(row.name) || "Name missing"}</div>
                  <div style={{ ...muted, marginTop: 4 }}>{normalise(row.address)}{row.address && row.postcode ? ", " : ""}{normalise(row.postcode)}</div>
                  <div style={{ ...muted, marginTop: 3 }}>ID: {row.appointment_row_id}</div>
                </td>
                <td style={{ padding: "12px 13px", whiteSpace: "nowrap" }}>{dateLabel(row.appointment_date)}</td>
                <td style={{ padding: "12px 13px" }}>
                  <div style={{ fontWeight: 650 }}>{formatStatus(row)}</div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 5, borderRadius: 999, padding: "3px 7px", fontSize: 10, fontWeight: 700, background: unsuitable ? "#fff1f2" : "#ecfdf5", color: unsuitable ? "#be123c" : "#047857" }}>
                    {unsuitable ? <AlertCircle size={11}/> : <CheckCircle2 size={11}/>} {unsuitable ? "Unsuitable — retained" : "Potentially reworkable"}
                  </span>
                </td>
                <td style={{ padding: "12px 13px", minWidth: 160 }}>
                  <div>{normalise(row.phone_number_1) || normalise(row.secondary_phone_number) || "No phone"}</div>
                  <div style={{ ...muted, marginTop: 4, wordBreak: "break-word" }}>{normalise(row.email_address) || "No email"}</div>
                </td>
                <td style={{ padding: "12px 13px" }}>
                  {linked ? <span style={{ color: "#047857", display: "inline-flex", gap: 5, alignItems: "center" }}><Link2 size={13}/> {row.open_solar_id}</span> : <span style={{ color: "#b45309", display: "inline-flex", gap: 5, alignItems: "center" }}><AlertCircle size={13}/> Unlinked</span>}
                </td>
                <td style={{ padding: "12px 13px" }}>{hasEpvs ? <span style={{ color: "#047857" }}>Present</span> : <span style={{ color: "#64748b" }}>Missing</span>}</td>
                <td style={{ padding: "12px 13px" }}>
                  <button onClick={() => onSelectAppointment?.(row)} style={{ border: "1px solid #cbd5e1", borderRadius: 7, padding: "7px 9px", background: "#fff", color: "#0f172a", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", cursor: "pointer", fontSize: 11, fontWeight: 650 }}>
                    <UserRound size={13}/> Open appointment <ExternalLink size={11}/>
                  </button>
                </td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
    </div>
    <div style={{ ...muted, marginTop: 12 }}>This worklist is read-only for now. It does not create OpenSolar links or send messages; those will be added as separate, auditable steps after matching is reviewed.</div>
  </div>
}

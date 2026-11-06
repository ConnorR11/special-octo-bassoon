import React, { useEffect, useMemo, useRef, useState } from "react"
import { FileText, Link2, RefreshCw, Search, Sun } from "lucide-react"
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts"
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
function getQuoteRowMetrics(row) {
  let calculation = row?.epvs_calculation || null
  if (typeof calculation === "string") {
    try { calculation = JSON.parse(calculation) } catch { calculation = null }
  }
  const data = calculation?.data || {}
  const annualConsumption = Number(data.annualConsumption)
  // Prefer the OpenSolar array list when available. data.arrays may be a duplicate
  // copy of the same design, so never add both collections together.
  const arrays = Array.isArray(data.openSolar?.arrays)
    ? data.openSolar.arrays
    : Array.isArray(data.arrays)
      ? data.arrays
      : []
  const panelCount = arrays.reduce((total, array) => {
    const count = Number(array?.panelCount ?? array?.panel_count ?? array?.numberOfPanels ?? array?.modules)
    return total + (Number.isFinite(count) && count > 0 ? count : 0)
  }, 0)
  const systemCost = Number(data.systemCost)
  return {
    annualConsumption: Number.isFinite(annualConsumption) && annualConsumption > 0 ? annualConsumption : null,
    panelCount: panelCount > 0 ? panelCount : null,
    systemCost: Number.isFinite(systemCost) && systemCost > 0 ? systemCost : null,
  }
}
function getOpenSolarImageUrl(row) {
  let calculation = row?.epvs_calculation || null
  if (typeof calculation === "string") {
    try { calculation = JSON.parse(calculation) } catch { calculation = null }
  }
  return String(calculation?.data?.openSolar?.imageUrl || calculation?.openSolar?.imageUrl || "").trim()
}

function OpenSolarThumbnail({ row }) {
  const [imageUrl, setImageUrl] = useState(getOpenSolarImageUrl(row))
  const [attempted, setAttempted] = useState(false)
  const [visible, setVisible] = useState(false)
  const hostRef = useRef(null)
  useEffect(() => {
    const node = hostRef.current
    if (!node || imageUrl || visible) return
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: "120px" })
    observer.observe(node)
    return () => observer.disconnect()
  }, [imageUrl, visible])
  useEffect(() => {
    if (!visible || imageUrl || attempted || !row?.open_solar_id || !supabase) return
    let cancelled = false
    setAttempted(true)
    supabase.functions.invoke("opensolar-design", { body: { projectId: row.open_solar_id } })
      .then(({ data, error }) => {
        if (cancelled || error) return
        const url = String(data?.imageUrl || data?.systemImageUrl || "").trim()
        if (data?.success && url) setImageUrl(url)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [visible, imageUrl, attempted, row?.open_solar_id])
  return <div ref={hostRef} style={{ width: 76, height: 54, flex: "0 0 76px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: "1px solid #e2e8f0", borderRadius: 5, background: "#f8fafc" }}>
    {imageUrl ? <img src={imageUrl} alt={"OpenSolar design for " + (normalise(row.name) || "appointment")} loading="lazy" onError={() => setImageUrl("")} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span style={{ fontSize: 9, color: "#94a3b8", textAlign: "center", padding: 3 }}>{attempted ? "No preview" : "Design preview"}</span>}
  </div>
}
function startOfTodayISO() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
function startOfCurrentWeekISO() {
  const now = new Date()
  const day = (now.getDay() + 6) % 7
  now.setDate(now.getDate() - day)
  now.setHours(0, 0, 0, 0)
  return now.toISOString().slice(0, 10)
}
function startOfPreviousWeekISO() {
  const now = new Date()
  const day = (now.getDay() + 6) % 7
  now.setDate(now.getDate() - day - 7)
  now.setHours(0, 0, 0, 0)
  return now.toISOString().slice(0, 10)
}
function dateTimeLabel(value) { if (!value) return "Not viewed yet"; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) }
function dateLabel(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function QuoteDailyStatsPanel({ active, loading, stats, cardStyle, muted, firstSentDate, lastSentDate }) {
  if (!active) return null
  return <div style={{ ...cardStyle, padding: 16, marginBottom: 14 }}>
    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Quote sends and open rate</div>
    <div style={{ ...muted, marginBottom: 12 }}>{firstSentDate && lastSentDate ? firstSentDate + " – " + lastSentDate : "No quotes sent yet"} · All sent quotes are included; bars are split by disposition and the line shows the daily open rate.</div>
    {loading ? <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}>Loading quote activity…</div> : <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={stats} margin={{ top: 8, right: 14, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
          <YAxis yAxisId="quotes" allowDecimals={false} tick={{ fontSize: 10 }} />
          <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tickFormatter={value => value + "%"} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(value, name) => name === "Open rate" ? [value + "%", name] : [value, name]} />
          <Legend />
          <Bar yAxisId="quotes" dataKey="accepted" name="Accepted quote" stackId="disposition" fill="#16a34a" />
          <Bar yAxisId="quotes" dataKey="callBack" name="Call Back" stackId="disposition" fill="#f59e0b" />
          <Bar yAxisId="quotes" dataKey="notInterested" name="Not interested" stackId="disposition" fill="#dc2626" />
          <Bar yAxisId="quotes" dataKey="superseded" name="Superseded" stackId="disposition" fill="#94a3b8" />
          <Bar yAxisId="quotes" dataKey="awaiting" name="Awaiting outcome" stackId="disposition" fill="#0f766e" />
          <Line yAxisId="rate" type="monotone" dataKey="openRate" name="Open rate" stroke="#2563eb" strokeWidth={2} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>}
  </div>
}
export default function SolarRework({ onSelectAppointment, quotesOnly = false }) {
  const [rows, setRows] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [linkedCount, setLinkedCount] = useState(0)
  const [tabCounts, setTabCounts] = useState({ unlinked: null, linkedPm: null, linkedNonPm: null })
  const [hasMore, setHasMore] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [quoteDispositionEdits, setQuoteDispositionEdits] = useState({})
  const [savingQuoteDisposition, setSavingQuoteDisposition] = useState(null)
  const [quoteDispositionError, setQuoteDispositionError] = useState("")
  const [rowEdits, setRowEdits] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [yearFilter, setYearFilter] = useState("all")
  const [unlinkedSortOrder, setUnlinkedSortOrder] = useState("desc")
  const [linkedSortOrder, setLinkedSortOrder] = useState("desc")
  const [linkedSoldFilter, setLinkedSoldFilter] = useState("all")
  const [linkedPmGroup, setLinkedPmGroup] = useState("without-pm")
  const [resultFilter, setResultFilter] = useState("all")
  const [leadSourceFilter, setLeadSourceFilter] = useState("all")
  const [leadSourceOptions, setLeadSourceOptions] = useState([])
  const [quoteViewedFilter, setQuoteViewedFilter] = useState("all")
  const [quoteDailyStats, setQuoteDailyStats] = useState([])
  const [quoteStatsRange, setQuoteStatsRange] = useState({ first: "", last: "" })
  const [quoteStatsLoading, setQuoteStatsLoading] = useState(false)
  const [linkedReadinessFilter, setLinkedReadinessFilter] = useState("all")
  const [page, setPage] = useState(0)
  const [activeTab, setActiveTab] = useState(quotesOnly ? "quotes-work" : "unlinked")
  const [linkedReadinessTab, setLinkedReadinessTab] = useState("not-ready")
  const loadRequestId = useRef(0)

  useEffect(() => {
    if (activeTab !== "quotes-sent" || !supabase) return
    let cancelled = false
    async function loadQuoteDailyStats() {
      setQuoteStatsLoading(true)
      try {
        const { data, error } = await supabase.from("solar_quotes")
          .select("sent_at,last_viewed_at,disposition")
          .not("sent_at", "is", null)
          .in("status", ["sent", "delivered", "viewed"])
          .order("sent_at", { ascending: true })
        if (error) throw error
        const sentQuotes = data || []
        const dateKey = value => String(value).slice(0, 10)
        const firstDate = sentQuotes.length ? dateKey(sentQuotes[0].sent_at) : ""
        const lastDate = sentQuotes.length ? dateKey(sentQuotes[sentQuotes.length - 1].sent_at) : ""
        const firstDay = firstDate ? new Date(firstDate + "T00:00:00") : new Date()
        const lastDay = lastDate ? new Date(lastDate + "T00:00:00") : new Date()
        const dayCount = firstDate ? Math.max(1, Math.round((lastDay - firstDay) / 86400000) + 1) : 0
        const days = Array.from({ length: dayCount }, (_, index) => {
          const date = new Date(firstDay)
          date.setDate(date.getDate() + index)
          const key = date.toISOString().slice(0, 10)
          return { date: key, label: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), accepted: 0, notInterested: 0, superseded: 0, callBack: 0, awaiting: 0, opened: 0, openRate: 0 }
        })
        const byDate = Object.fromEntries(days.map(day => [day.date, day]))
        for (const quote of sentQuotes) {
          const day = byDate[dateKey(quote.sent_at)]
          if (!day) continue
          const disposition = String(quote.disposition || "").trim().toLowerCase()
          if (disposition === "accepted" || disposition === "accepted quote") day.accepted += 1
          else if (disposition === "not interested") day.notInterested += 1
          else if (disposition === "superseded") day.superseded += 1
          else if (disposition === "call back") day.callBack += 1
          else day.awaiting += 1
          if (quote.last_viewed_at) day.opened += 1
        }
        days.forEach(day => { const sent = day.accepted + day.notInterested + day.superseded + day.callBack + day.awaiting; day.openRate = sent ? Math.round(day.opened / sent * 100) : 0 })
        if (!cancelled) {
          setQuoteDailyStats(days)
          setQuoteStatsRange({ first: firstDate, last: lastDate })
        }
      } catch (err) {
        console.error("Unable to load daily solar quote stats:", err)
        if (!cancelled) { setQuoteDailyStats([]); setQuoteStatsRange({ first: "", last: "" }) }
      } finally {
        if (!cancelled) setQuoteStatsLoading(false)
      }
    }
    loadQuoteDailyStats()
    return () => { cancelled = true }
  }, [activeTab])
  useEffect(() => {
    let cancelled = false
    async function loadLeadSources() {
      if (!supabase) return
      try {
        const { data, error } = await supabase.from("appointments").select("lead_source").eq("job_type", "Solar").not("open_solar_id", "is", null).not("lead_source", "is", null).neq("lead_source", "").order("lead_source").limit(5000)
        if (error) throw error
        const values = [...new Set((data || []).map(row => normalise(row.lead_source)).filter(Boolean))].sort((a, b) => a.localeCompare(b))
        if (!cancelled) setLeadSourceOptions(values)
      } catch (err) { console.warn("Could not load lead source options:", err) }
    }
    loadLeadSources()
    return () => { cancelled = true }
  }, [])

  function updateQuoteDispositionEdit(row, patch) {
    setQuoteDispositionEdits(current => ({
      ...current,
      [row.id]: { disposition: row.disposition || "", callback_date: row.callback_date || "", ...(current[row.id] || {}), ...patch },
    }))
  }

  async function saveQuoteDisposition(row) {
    const edit = quoteDispositionEdits[row.id] || { disposition: row.disposition || "", callback_date: row.callback_date || "" }
    if (edit.disposition === "Call Back" && !edit.callback_date) {
      setQuoteDispositionError("Please choose a follow-up date for Call Back.")
      return
    }
    setSavingQuoteDisposition(row.id)
    setQuoteDispositionError("")
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      const { data: updated, error: updateError } = await supabase.from("solar_quotes").update({
        disposition: edit.disposition || null,
        callback_date: edit.disposition === "Call Back" ? edit.callback_date : null,
        disposition_updated_at: new Date().toISOString(),
        disposition_updated_by: userData?.user?.id || null,
      }).eq("id", row.id).select("id,disposition,callback_date").single()
      if (updateError) throw updateError
      setRows(current => current.map(item => item.id === row.id ? { ...item, ...updated } : item))
      setQuoteDispositionEdits(current => { const next = { ...current }; delete next[row.id]; return next })
    } catch (err) {
      setQuoteDispositionError(err?.message || "Unable to save quote disposition.")
    } finally {
      setSavingQuoteDisposition(null)
    }
  }

  async function loadRows(targetPage = page) {
    const requestId = ++loadRequestId.current
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return }
    setLoading(true)
    setRows([])
    setError("")
    try {
      if (activeTab === "lead-view") {
        let leadRequest = supabase.from("leads")
          .select("marketing_row_id,first_name,last_name,postcode,address,primary_phone_number,secondary_phone_number,email,lead_source,lead_type,disposition,appointment_date_time,appointment_product")
          .eq("lead_type", "Solar")
          .not("appointment_date_time", "is", null)
          .neq("appointment_date_time", "")
          .order("appointment_date_time", { ascending: false })
          .range(targetPage * PAGE_SIZE, targetPage * PAGE_SIZE + PAGE_SIZE)
        if (leadSourceFilter !== "all") leadRequest = leadRequest.eq("lead_source", leadSourceFilter)
        const needle = normalise(query).replace(/[%_,()]/g, " ")
        if (needle) leadRequest = leadRequest.or("first_name.ilike.%" + needle + "%,last_name.ilike.%" + needle + "%,address.ilike.%" + needle + "%,postcode.ilike.%" + needle + "%,primary_phone_number.ilike.%" + needle + "%,email.ilike.%" + needle + "%,disposition.ilike.%" + needle + "%")
        const { data: leadData, error: leadError } = await leadRequest
        if (requestId !== loadRequestId.current) return
        if (leadError) throw leadError
        const leadBatch = leadData || []
        const marketingIds = [...new Set(leadBatch.map(lead => normalise(lead.marketing_row_id)).filter(Boolean))]
        let appointmentByMarketingId = {}
        let appointmentMarketingById = {}
        if (marketingIds.length) {
          const { data: linkedAppointments, error: appointmentError } = await supabase.from("appointments")
            .select("appointment_row_id,marketing_row_id,appointment_date,result,name")
            .eq("job_type", "Solar")
            .in("marketing_row_id", marketingIds)
            .order("appointment_date", { ascending: false, nullsFirst: false })
          if (appointmentError) throw appointmentError
          for (const appointment of linkedAppointments || []) {
            const key = String(appointment.marketing_row_id)
            if (!appointmentByMarketingId[key]) appointmentByMarketingId[key] = appointment
            appointmentMarketingById[String(appointment.appointment_row_id)] = key
          }
        }
        const appointmentIds = Object.keys(appointmentMarketingById)
        const sentMarketingIds = new Set()
        for (let index = 0; index < appointmentIds.length; index += 500) {
          const ids = appointmentIds.slice(index, index + 500)
          const { data: sentQuotes, error: quotesError } = await supabase.from("solar_quotes")
            .select("appointment_row_id")
            .in("appointment_row_id", ids)
            .in("status", ["sent", "delivered", "viewed"])
            .not("sent_at", "is", null)
          if (quotesError) throw quotesError
          for (const quote of sentQuotes || []) {
            const marketingId = appointmentMarketingById[String(quote.appointment_row_id)]
            if (marketingId) sentMarketingIds.add(marketingId)
          }
        }
        const leadRows = leadBatch.map(lead => {
          const marketingId = String(lead.marketing_row_id)
          const appointment = appointmentByMarketingId[marketingId] || null
          return { ...lead, linkedAppointment: appointment, quoteSent: sentMarketingIds.has(marketingId) }
        })
        setRows(leadRows.slice(0, PAGE_SIZE))
        setHasMore(leadBatch.length > PAGE_SIZE)
        setLoading(false)
        return
      }
      if (activeTab === "quotes-sent" || activeTab === "quotes-work") {
        // Quotes To Work excludes appointments scheduled in the previous complete
        // Monday–Sunday week. Quotes Sent remains an unfiltered historical view.
        let appointmentsFromLastWeek = []
        if (activeTab === "quotes-work") {
          const { data: lastWeekAppointments, error: lastWeekError } = await supabase.from("appointments")
            .select("appointment_row_id")
            .gte("appointment_date", startOfPreviousWeekISO())
            .lt("appointment_date", startOfCurrentWeekISO())
            .not("appointment_date", "is", null)
          if (lastWeekError) throw lastWeekError
          appointmentsFromLastWeek = (lastWeekAppointments || []).map(item => String(item.appointment_row_id)).filter(Boolean)
        }
        let quoteRequest = supabase.from("solar_quotes")
          .select("id,appointment_row_id,quote_ref,customer_name,customer_email,status,created_at,sent_at,last_viewed_at,view_count,expires_at,storage_path,disposition,callback_date,disposition_notes")
          .in("status", ["sent", "delivered", "viewed"])
          .not("sent_at", "is", null)
          .order("sent_at", { ascending: false })
          .range(targetPage * PAGE_SIZE, targetPage * PAGE_SIZE + PAGE_SIZE)
        if (activeTab === "quotes-work") {
          quoteRequest = quoteRequest.or('disposition.is.null,disposition.not.in.("Superseded","Not interested","Accepted quote")')
          if (appointmentsFromLastWeek.length) {
            const excludedIds = appointmentsFromLastWeek.map(id => '"' + id.replace(/"/g, '\\"') + '"').join(",")
            quoteRequest = quoteRequest.not("appointment_row_id", "in", "(" + excludedIds + ")")
          }
        }
        if (quoteViewedFilter === "viewed") quoteRequest = quoteRequest.not("last_viewed_at", "is", null)
        if (quoteViewedFilter === "not-viewed") quoteRequest = quoteRequest.is("last_viewed_at", null)
        const needle = normalise(query).replace(/[%_,()]/g, " ")
        if (needle) quoteRequest = quoteRequest.or("customer_name.ilike.%" + needle + "%,customer_email.ilike.%" + needle + "%,quote_ref.ilike.%" + needle + "%,appointment_row_id.ilike.%" + needle + "%")
        const { data: quoteData, error: quoteError } = await quoteRequest
        if (requestId !== loadRequestId.current) return
        if (quoteError) throw quoteError
        const quoteBatch = quoteData || []
        const ids = [...new Set(quoteBatch.map(item => item.appointment_row_id).filter(Boolean))]
        let appointmentById = {}
        if (ids.length) {
          const { data: appointments, error: appointmentsError } = await supabase.from("appointments")
            .select("appointment_row_id,name,postcode,address,phone_number_1,secondary_phone_number,email_address,appointment_date,result,job_type,product,open_solar_id,epvs_calculation,rep_allocated")
            .in("appointment_row_id", ids)
          if (appointmentsError) throw appointmentsError
          appointmentById = Object.fromEntries((appointments || []).map(item => [String(item.appointment_row_id), item]))
        }
        setRows(quoteBatch.map(item => ({ ...appointmentById[String(item.appointment_row_id)], ...item })).slice(0, PAGE_SIZE))
        setHasMore(quoteBatch.length > PAGE_SIZE)
        setLoading(false)
        return
      }
      let request = supabase.from("appointments")
        .select("appointment_row_id,marketing_row_id,name,postcode,address,phone_number_1,secondary_phone_number,email_address,appointment_date,result,job_type,product,lead_source,open_solar_id,epvs_calculation,rep_allocated")
        .eq("job_type", "Solar")
        .not("result", "is", null)
        .neq("result", "")
        .not("result", "ilike", "sold")
        .lt("appointment_date", activeTab === "linked" ? startOfTodayISO() : startOfCurrentWeekISO())
        .order("appointment_date", { ascending: activeTab === "linked" ? linkedSortOrder === "asc" : unlinkedSortOrder === "asc", nullsFirst: false })
        .order("appointment_row_id", { ascending: false })
      if (yearFilter !== "all") request = request.gte("appointment_date", yearFilter + "-01-01").lt("appointment_date", (Number(yearFilter) + 1) + "-01-01")
      if (resultFilter !== "all") request = request.eq("result", resultFilter)
      if (leadSourceFilter !== "all") request = request.eq("lead_source", leadSourceFilter)
      if (activeTab === "unlinked") request = request.is("open_solar_id", null)
      else request = request.not("open_solar_id", "is", null)
      const needle = normalise(query).replace(/[%_,()]/g, " ")
      if (needle) request = request.or("name.ilike.%" + needle + "%,postcode.ilike.%" + needle + "%,address.ilike.%" + needle + "%,phone_number_1.ilike.%" + needle + "%,secondary_phone_number.ilike.%" + needle + "%,email_address.ilike.%" + needle + "%,product.ilike.%" + needle + "%,result.ilike.%" + needle + "%")
      let batch = []
      if (activeTab === "linked") {
        // Fetch every matching linked row in chunks; exclusions must happen before pagination.
        for (let offset = 0; ; offset += 500) {
          const { data, error: queryError } = await request.range(offset, offset + 499)
          if (requestId !== loadRequestId.current) return
          if (queryError) throw queryError
          batch = batch.concat(data || [])
          if (!data || data.length < 500) break
        }
      } else {
        const { data, error: queryError } = await request.range(targetPage * PAGE_SIZE, targetPage * PAGE_SIZE + PAGE_SIZE)
        if (requestId !== loadRequestId.current) return
        if (queryError) throw queryError
        batch = data || []
      }
      const marketingIds = [...new Set(batch.map(row => row.marketing_row_id).filter(value => value !== null && value !== undefined && String(value).trim() !== ""))]
      let leadByMarketingId = {}
      if (activeTab === "linked" && marketingIds.length) {
        const { data: leadRows, error: leadError } = await supabase
          .from("leads")
          .select("marketing_row_id,disposition")
          .in("marketing_row_id", marketingIds)
        if (leadError) throw leadError
        for (const lead of leadRows || []) leadByMarketingId[String(lead.marketing_row_id)] = lead
      }
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
      let quoteSentMarketingIds = new Set()
      let quoteSentAppointmentIds = new Set()
      if (activeTab === "linked") {
        const { data: sentQuotes, error: sentQuotesError } = await supabase.from("solar_quotes").select("appointment_row_id")
          .in("status", ["sent", "delivered", "viewed"]).not("sent_at", "is", null)
        if (sentQuotesError) throw sentQuotesError
        quoteSentAppointmentIds = new Set((sentQuotes || []).map(item => String(item.appointment_row_id)))
        const sentAppointmentIds = [...quoteSentAppointmentIds]
        if (sentAppointmentIds.length) {
          const { data: sentAppointments, error: sentAppointmentsError } = await supabase
            .from("appointments").select("appointment_row_id,marketing_row_id").in("appointment_row_id", sentAppointmentIds)
          if (sentAppointmentsError) throw sentAppointmentsError
          quoteSentMarketingIds = new Set((sentAppointments || [])
            .filter(item => item.marketing_row_id !== null && item.marketing_row_id !== undefined && String(item.marketing_row_id).trim() !== "")
            .map(item => String(item.marketing_row_id)))
        }
      }
      // Match sold deals directly against the customer email on the appointment.
      // This avoids scanning related appointments and joining their IDs.
      const emailSet = new Set(batch.map(row => normalise(row.email_address).toLowerCase()).filter(Boolean))
      const dealEmails = new Set()
      const emails = [...emailSet]
      for (let index = 0; index < emails.length; index += 500) {
        const emailBatch = emails.slice(index, index + 500)
        const { data: deals, error: dealsError } = await supabase
          .from("deals")
          .select("email")
          .in("email", emailBatch)
        if (dealsError) throw dealsError
        for (const deal of deals || []) {
          const email = normalise(deal.email).toLowerCase()
          if (email) dealEmails.add(email)
        }
      }

      const rowsWithRelated = batch.map(row => ({
        ...row,
        leadDisposition: leadByMarketingId[String(row.marketing_row_id)]?.disposition || null,
        relatedAppointments: row.marketing_row_id === null || row.marketing_row_id === undefined
          ? []
          : (relatedByMarketingId[String(row.marketing_row_id)] || []).filter(related => related.appointment_row_id !== row.appointment_row_id)
      }))

      const eligibleBatch = rowsWithRelated.filter(row => {
        const email = normalise(row.email_address).toLowerCase()
        const hasRelatedDeal = Boolean(email && dealEmails.has(email))
        return normalise(row.job_type).toLowerCase() === "solar" &&
          normaliseResult(row.result) !== "SOLD" &&
          // A linked appointment is also excluded when any other appointment sharing
          // its marketing row ID has already been marked SOLD.
          !(activeTab === "linked" && (row.relatedAppointments || []).some(related => normaliseResult(related.result) === "SOLD")) &&
          (activeTab !== "unlinked" ? Boolean(normalise(row.open_solar_id)) : !normalise(row.open_solar_id)) &&
          !hasRelatedDeal &&
          !(activeTab === "linked" && (quoteSentAppointmentIds.has(String(row.appointment_row_id)) || (row.marketing_row_id !== null && row.marketing_row_id !== undefined && quoteSentMarketingIds.has(String(row.marketing_row_id)))))
      })
      const pitchedEligible = eligibleBatch.filter(row => /PM/i.test(normalise(row.result)))
      const notPitchedEligible = eligibleBatch.filter(row => !/PM/i.test(normalise(row.result)))
      if (activeTab === "linked") setTabCounts(current => ({ ...current, linkedPm: pitchedEligible.length, linkedNonPm: notPitchedEligible.length }))
      const groupedEligible = activeTab === "linked" ? (linkedPmGroup === "pm" ? pitchedEligible : notPitchedEligible) : eligibleBatch
      const soldFiltered = activeTab === "linked" && linkedSoldFilter !== "all"
        ? groupedEligible.filter(row => {
            const sold = (row.relatedAppointments || []).some(related => normaliseResult(related.result) === "SOLD")
            return linkedSoldFilter === "sold" ? sold : !sold
          })
        : groupedEligible
      const readinessFiltered = activeTab === "linked" && linkedReadinessFilter !== "all"
        ? soldFiltered.filter(row => {
            const ready = getQuoteStages(row).every(stage => stage.complete)
            return linkedReadinessFilter === "ready" ? ready : !ready
          })
        : soldFiltered
      const start = targetPage * PAGE_SIZE
      setHasMore(readinessFiltered.length > start + PAGE_SIZE)
      setRows(readinessFiltered.slice(start, start + PAGE_SIZE))
      setTotalCount(readinessFiltered.length)
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


  useEffect(() => { loadRows(page) }, [page, query, activeTab, yearFilter, unlinkedSortOrder, linkedSortOrder, linkedSoldFilter, linkedReadinessFilter, linkedPmGroup, resultFilter, leadSourceFilter, quoteViewedFilter])
  useEffect(() => { setPage(0) }, [query, activeTab, yearFilter, unlinkedSortOrder, linkedSortOrder, linkedSoldFilter, linkedReadinessFilter, linkedPmGroup, resultFilter, leadSourceFilter, quoteViewedFilter])

  // Load tab totals independently from the table request so badge counts never block or reset the visible list.
  useEffect(() => {
    let cancelled = false
    async function loadTabCounts() {
      if (!supabase) return
      try {
        const base = () => {
          let request = supabase.from("appointments")
            .select("appointment_row_id", { count: "exact", head: true })
            .eq("job_type", "Solar")
            .not("result", "is", null)
            .neq("result", "")
            .not("result", "ilike", "sold")
            .lt("appointment_date", activeTab === "linked" ? startOfTodayISO() : startOfCurrentWeekISO())
          if (yearFilter !== "all") request = request.gte("appointment_date", yearFilter + "-01-01").lt("appointment_date", (Number(yearFilter) + 1) + "-01-01")
          if (resultFilter !== "all") request = request.eq("result", resultFilter)
          if (leadSourceFilter !== "all") request = request.eq("lead_source", leadSourceFilter)
          const needle = normalise(query).replace(/[%_,()]/g, " ")
          if (needle) request = request.or("name.ilike.%" + needle + "%,postcode.ilike.%" + needle + "%,address.ilike.%" + needle + "%,phone_number_1.ilike.%" + needle + "%,secondary_phone_number.ilike.%" + needle + "%,email_address.ilike.%" + needle + "%,product.ilike.%" + needle + "%,result.ilike.%" + needle + "%")
          return request
        }
        const [unlinkedResult, linkedPmResult, linkedNonPmResult] = await Promise.all([
          base().is("open_solar_id", null),
          base().not("open_solar_id", "is", null).ilike("result", "%PM%"),
          base().not("open_solar_id", "is", null).not("result", "ilike", "%PM%")
        ])
        if (unlinkedResult.error) throw unlinkedResult.error
        if (linkedPmResult.error) throw linkedPmResult.error
        if (linkedNonPmResult.error) throw linkedNonPmResult.error
        if (!cancelled) setTabCounts(current => ({
          ...current,
          unlinked: unlinkedResult.count ?? 0
        }))
      } catch (err) {
        console.warn("Solar Rework tab totals could not be loaded:", err)
      }
    }
    loadTabCounts()
    return () => { cancelled = true }
  }, [yearFilter, resultFilter, leadSourceFilter, query])

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
    {quotesOnly ? <div style={{ marginBottom: 20 }}><h1 style={{ margin: 0, fontSize: 24, fontWeight: 750 }}>Quotes To Work</h1><p style={{ margin: "7px 0 0", color: "#64748b", fontSize: 13 }}>Sent solar quotes that need an outcome or follow-up.</p><button onClick={() => loadRows(page)} disabled={loading} style={{ marginTop: 12, border: "1px solid #cbd5e1", background: "#fff", borderRadius: 8, padding: "9px 13px", display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 650, cursor: loading ? "wait" : "pointer" }}><RefreshCw size={14} /> Refresh list</button></div> : <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Sun size={23} color="#0f766e" />
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 750 }}>Solar Appointment Rework</h1>
        </div>
        <p style={{ margin: "7px 0 0", color: "#64748b", fontSize: 13 }}>All past solar appointments with a result, excluding Sold appointments. Use the result filter to narrow the list.</p>
      </div>
      <button onClick={() => loadRows(page)} disabled={loading} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 8, padding: "9px 13px", display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 650, cursor: loading ? "wait" : "pointer" }}>
        <RefreshCw size={14} /> Refresh list
      </button>
    </div>

    </>}
    {error && <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: "#fff1f2", color: "#be123c", fontSize: 12 }}>{error}</div>}
    {activeTab === "quotes-sent" && quoteDispositionError && <div role="alert" style={{ marginBottom: 12, padding: 10, borderRadius: 7, background: "#fff1f2", color: "#be123c", fontSize: 11 }}>{quoteDispositionError}</div>}

    {!quotesOnly && (
    <div style={{ display: "flex", gap: 8, marginBottom: 12, borderBottom: "1px solid #dbe3ea", flexWrap: "wrap" }}>
      {[
        { value: "unlinked", group: null, label: "Unlinked appointments", count: tabCounts.unlinked },
        { value: "linked", group: "pm", label: "Linked appointments - Pitched", count: tabCounts.linkedPm },
        { value: "linked", group: "without-pm", label: "Linked appointments - Not Pitched", count: tabCounts.linkedNonPm },
        { value: "lead-view", group: null, label: "Lead View" },
        { value: "quotes-sent", group: null, label: "Quotes Sent" },
        { value: "quotes-work", group: null, label: "Quotes to work" },
      ].map((tab, index) => {
        const selected = activeTab === tab.value && (tab.value !== "linked" || linkedPmGroup === tab.group)
        return <button key={tab.value + (tab.group || "")} onClick={() => {
          if (tab.value === "linked") setLinkedPmGroup(tab.group)
          if (tab.value !== activeTab || (tab.value === "linked" && linkedPmGroup !== tab.group)) {
            setRows([])
            setLoading(true)
            setActiveTab(tab.value)
            setPage(0)
          }
        }} style={{ border: "1px solid " + (selected ? "#0f766e" : "#d7dee5"), borderBottom: selected ? "3px solid #0f766e" : "1px solid #d7dee5", borderRadius: "8px 8px 0 0", padding: "10px 14px", background: selected ? "#f0fdfa" : "#fff", color: selected ? "#0f766e" : "#475569", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          {tab.label}{tab.count !== undefined && <span style={{ marginLeft: 7, display: "inline-flex", minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", padding: "0 5px", borderRadius: 999, background: selected ? "#ccfbf1" : "#eef2f6", color: selected ? "#0f766e" : "#475569", fontSize: 10, fontWeight: 800 }}>{tab.count === null ? "…" : tab.count.toLocaleString("en-GB")}</span>}
        </button>
      })}
    </div>
    )}

    <div style={{ ...cardStyle, padding: 13, marginBottom: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: activeTab === "linked" ? "minmax(200px,2fr) repeat(6,minmax(120px,1fr))" : activeTab === "unlinked" ? "minmax(200px,2fr) repeat(4,minmax(125px,1fr))" : (activeTab === "quotes-sent" || activeTab === "quotes-work") ? "minmax(220px,2fr) minmax(170px,1fr)" : "minmax(220px,2fr)", gap: 10, alignItems: "center" }}>
        <div style={{ position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 11, top: 12, color: "#64748b" }} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, postcode, phone, email…" style={{ ...inputStyle, width: "100%", paddingLeft: 33, boxSizing: "border-box" }} />
        </div>
{activeTab !== "lead-view" && <select value={resultFilter} onChange={event => { setResultFilter(event.target.value); setPage(0) }} style={selectStyle}>
          <option value="all">All results</option>
          <option value="PM">PM</option>
          <option value="PM DNH">PM DNH</option>
          <option value="DNH">DNH</option>
          <option value="no-result">No result</option>
        </select> }
                {activeTab !== "quotes-sent" && activeTab !== "quotes-work" && <select value={leadSourceFilter} onChange={event => { setLeadSourceFilter(event.target.value); setPage(0) }} style={selectStyle}>
          <option value="all">All lead sources</option>
          {leadSourceOptions.map(source => <option key={source} value={source}>{source}</option>)}
        </select>}
                {activeTab !== "lead-view" && <select value={yearFilter} onChange={event => setYearFilter(event.target.value)} style={selectStyle}>
          <option value="all">All years</option>
          {Array.from({ length: new Date().getFullYear() - 2019 }, (_, index) => String(new Date().getFullYear() - index)).map(year => <option key={year} value={year}>{year}</option>)}
        </select>}
        {activeTab === "unlinked" && <select value={unlinkedSortOrder} onChange={event => setUnlinkedSortOrder(event.target.value)} style={selectStyle}>
          <option value="desc">Newest to oldest</option><option value="asc">Oldest to newest</option>
        </select>}
        {activeTab === "linked" && <select value={linkedSortOrder} onChange={event => setLinkedSortOrder(event.target.value)} style={selectStyle}>
          <option value="desc">Newest to oldest</option><option value="asc">Oldest to newest</option>
        </select>}
        {activeTab === "linked" && <select value={linkedReadinessFilter} onChange={event => setLinkedReadinessFilter(event.target.value)} style={selectStyle}>
          <option value="all">All readiness statuses</option>
          <option value="ready">Ready to quote</option>
          <option value="not-ready">Not ready to quote</option>
        </select>}
        {activeTab === "linked" && <select value={linkedSoldFilter} onChange={event => setLinkedSoldFilter(event.target.value)} style={selectStyle}>
          <option value="all">All linked appointments</option>
          <option value="sold">Since sold</option>
          <option value="not-sold">Not subsequently sold</option>
        </select>}
      </div>
    </div>

    <QuoteDailyStatsPanel active={!quotesOnly && activeTab === "quotes-sent"} loading={quoteStatsLoading} stats={quoteDailyStats} cardStyle={cardStyle} muted={muted} firstSentDate={quoteStatsRange.first ? dateLabel(quoteStatsRange.first) : ""} lastSentDate={quoteStatsRange.last ? dateLabel(quoteStatsRange.last) : ""} />
    <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid #e2e8f0", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{(activeTab === "quotes-sent" || activeTab === "quotes-work") ? (activeTab === "quotes-work" ? "Quotes to work" : "Quotes Sent") : activeTab === "lead-view" ? loading ? "Loading solar leads…" : `Showing ${rows.length ? page * PAGE_SIZE + 1 : 0}–${page * PAGE_SIZE + rows.length} solar leads` : loading ? "Loading appointments…" : `Showing ${rows.length ? page * PAGE_SIZE + 1 : 0}–${Math.min((page + 1) * PAGE_SIZE, totalCount || rows.length)} of ${totalCount.toLocaleString("en-GB")} ${activeTab !== "unlinked" ? "linked" : "unlinked"} appointments`}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button disabled={page === 0 || loading} onClick={() => setPage(value => Math.max(0, value - 1))} style={{ ...selectStyle, padding: "0 12px" }}>Previous</button>
          <span style={muted}>Page {page + 1} of {pageCount}</span>
          <button disabled={!hasMore || loading} onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))} style={{ ...selectStyle, padding: "0 12px" }}>Next</button>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 980, fontSize: 12 }}>
          <thead><tr style={{ background: "#f8fafc", textAlign: "left", color: "#475569" }}>
            {((activeTab === "quotes-sent" || activeTab === "quotes-work") ? ["Customer", "Quote Ref", "Phone", "Email", "Sent", "Last viewed", "Views", "Disposition", ...(activeTab === "quotes-work" ? ["Open"] : [])] : activeTab === "lead-view" ? ["Lead", "Postcode", "Phone", "Email", "Appointment date & time", "Disposition", "Solar quote"] : ["Name", ...(activeTab === "unlinked" ? ["OpenSolar ID"] : ["Design"]), ...(activeTab === "linked" ? ["Lead disposition", "Appointment result"] : []),"Date",activeTab === "unlinked" ? "Result" : "Quote readiness", ...(activeTab === "linked" ? ["Related appointment result"] : [])]).map((heading, index) => <th key={heading || index} style={{ padding: "11px 13px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, whiteSpace: "nowrap" }}>{heading}</th>)}
          </tr></thead>
          <tbody>
            {activeTab === "lead-view" && !loading && visibleRows.length === 0 && <tr><td colSpan={7} style={{ padding: 36, textAlign: "center", color: "#64748b" }}>No solar leads with an appointment date and time match these filters.</td></tr>}
            {activeTab === "lead-view" && visibleRows.map(row => <tr key={row.marketing_row_id || row.email || row.first_name + row.last_name} onClick={() => row.linkedAppointment && onSelectAppointment?.(row.linkedAppointment)} style={{ borderBottom: "1px solid #edf2f7", cursor: row.linkedAppointment ? "pointer" : "default" }}>
              <td style={{ padding: "10px 13px", fontWeight: 700 }}>{[row.first_name, row.last_name].filter(Boolean).join(" ") || row.linkedAppointment?.name || "Name missing"}<div style={{ ...muted, marginTop: 3 }}>{row.address || "—"}</div></td>
              <td style={{ padding: "10px 13px" }}>{row.postcode || "—"}</td>
              <td style={{ padding: "10px 13px", whiteSpace: "nowrap" }}>{row.primary_phone_number || row.secondary_phone_number || "—"}</td>
              <td style={{ padding: "10px 13px" }}>{row.email || "—"}</td>
              <td style={{ padding: "10px 13px", whiteSpace: "nowrap" }}>{dateTimeLabel(row.appointment_date_time) || dateTimeLabel(row.linkedAppointment?.appointment_date)}</td>
              <td style={{ padding: "10px 13px" }}>{row.disposition ? <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontSize: 10, fontWeight: 750 }}>{row.disposition}</span> : "—"}</td>
              <td style={{ padding: "10px 13px" }}>{row.quoteSent ? <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#dcfce7", color: "#166534", fontSize: 10, fontWeight: 750 }}>Sent</span> : <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#f1f5f9", color: "#475569", fontSize: 10, fontWeight: 750 }}>Not sent</span>}</td>
            </tr>)}
            {(activeTab === "quotes-sent" || activeTab === "quotes-work") && !loading && visibleRows.length === 0 && <tr><td colSpan={activeTab === "quotes-work" ? 9 : 8} style={{ padding: 36, textAlign: "center", color: "#64748b" }}>No quotes match this filter.</td></tr>}
            {(activeTab === "quotes-sent" || activeTab === "quotes-work") && visibleRows.map(row => <tr key={row.id} onClick={() => { if (row.appointment_row_id) onSelectAppointment?.({ ...row, email: row.email_address || row.customer_email }) }} style={{ borderBottom: "1px solid #edf2f7", cursor: row.appointment_row_id ? "pointer" : "default" }}><td style={{ padding: "10px 13px", fontWeight: 700 }}>{normalise(row.customer_name || row.name) || "Name missing"}<div style={{ ...muted, marginTop: 3 }}>{normalise(row.address)}{row.address && row.postcode ? ", " : ""}{normalise(row.postcode)}</div></td><td style={{ padding: "10px 13px", whiteSpace: "nowrap" }}>{row.quote_ref || "—"}</td><td style={{ padding: "10px 13px", whiteSpace: "nowrap" }}>{row.phone_number_1 || row.secondary_phone_number ? <a href={"tel:" + encodeURIComponent(String(row.phone_number_1 || row.secondary_phone_number))} onClick={event => event.stopPropagation()} style={{ color: "#0f766e", fontWeight: 700, textDecoration: "none" }}>{row.phone_number_1 || row.secondary_phone_number}</a> : "—"}</td><td style={{ padding: "10px 13px" }}>{row.customer_email || row.email_address || "—"}</td><td style={{ padding: "10px 13px", whiteSpace: "nowrap" }}>{dateTimeLabel(row.sent_at)}</td><td style={{ padding: "10px 13px", whiteSpace: "nowrap" }}>{row.last_viewed_at ? dateTimeLabel(row.last_viewed_at) : <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 8px", borderRadius: 999, background: "#fee2e2", color: "#b91c1c", fontSize: 10, fontWeight: 750 }}>Not Viewed Yet</span>}</td><td style={{ padding: "10px 13px", textAlign: "center" }}>{Number(row.view_count || 0)}</td>{activeTab === "quotes-work" ? (<td style={{ padding: "8px 10px", minWidth: 205 }} onClick={event => event.stopPropagation()}><div style={{ display: "flex", flexDirection: "column", gap: 5 }}><select value={(quoteDispositionEdits[row.id]?.disposition ?? row.disposition) || ""} onChange={event => { updateQuoteDispositionEdit(row, { disposition: event.target.value, callback_date: event.target.value === "Call Back" ? (quoteDispositionEdits[row.id]?.callback_date || row.callback_date || "") : "" }); setQuoteDispositionError("") }} style={{ ...selectStyle, width: "100%", minWidth: 170, height: 30 }}><option value="">Awaiting outcome</option><option value="Not interested">Not interested</option><option value="Call Back">Call Back</option><option value="Superseded">Superseded</option><option value="Accepted quote">Accepted quote</option></select>{(quoteDispositionEdits[row.id]?.disposition ?? row.disposition) === "Call Back" && <input type="date" value={quoteDispositionEdits[row.id]?.callback_date ?? row.callback_date ?? ""} onChange={event => updateQuoteDispositionEdit(row, { callback_date: event.target.value })} style={{ ...inputStyle, height: 29, width: "100%", boxSizing: "border-box" }} />}{quoteDispositionEdits[row.id] && <button type="button" disabled={savingQuoteDisposition === row.id} onClick={() => saveQuoteDisposition(row)} style={{ border: 0, borderRadius: 5, background: "#0f766e", color: "#fff", padding: "6px 9px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{savingQuoteDisposition === row.id ? "Saving…" : "Save outcome"}</button>}</div></td>) : (<td style={{ padding: "10px 13px", minWidth: 150 }}><div style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={{ color: row.disposition ? "#334155" : "#94a3b8", fontWeight: row.disposition ? 650 : 400 }}>{row.disposition || "Awaiting outcome"}</span>{row.disposition === "Call Back" && row.callback_date && <span style={{ fontSize: 10, color: "#64748b" }}>Follow-up: {new Date(row.callback_date + "T00:00:00").toLocaleDateString("en-GB")}</span>}</div></td>)}{activeTab === "quotes-work" && <td style={{ padding: "8px 10px", textAlign: "center" }} onClick={event => event.stopPropagation()}><button type="button" title="Open sent quote" aria-label="Open sent quote" disabled={!row.storage_path} onClick={async event => { event.stopPropagation(); const popup = window.open("", "_blank"); if (!popup) return; try { const { data, error } = await supabase.storage.from("signatures").createSignedUrl(row.storage_path, 300, { download: false }); if (error || !data?.signedUrl) throw error || new Error("Could not create quote link."); popup.location.href = data.signedUrl; } catch (error) { popup.close(); setQuoteDispositionError(error?.message || "Unable to open this quote."); } }} style={{ width: 30, height: 28, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid #cbd5e1", borderRadius: 5, background: "#fff", color: "#0f766e", cursor: row.storage_path ? "pointer" : "not-allowed" }}><FileText size={15} /></button></td>}</tr>)}
            {activeTab !== "quotes-sent" && activeTab !== "quotes-work" && activeTab !== "lead-view" && !loading && visibleRows.length === 0 && <tr><td colSpan={activeTab === "linked" ? 7 : 4} style={{ padding: 28, textAlign: "center", color: "#64748b" }}>{"No appointments match these filters."}</td></tr>}
            {activeTab !== "quotes-sent" && activeTab !== "quotes-work" && activeTab !== "lead-view" && visibleRows.map(row => {
              const linked = row.open_solar_id !== null && row.open_solar_id !== undefined && String(row.open_solar_id).trim() !== ""
              return <tr key={row.appointment_row_id} onClick={() => onSelectAppointment?.(row)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectAppointment?.(row) } }} tabIndex={0} role="button" aria-label={"Open appointment for " + (normalise(row.name) || "unnamed customer")} style={{ borderBottom: "1px solid #edf2f7", cursor: "pointer" }}>
                <td style={{ padding: "6px 10px", maxWidth: 300 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                    {activeTab === "linked" && <OpenSolarThumbnail row={row} />}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}><span style={{ fontWeight: 700, color: "#0f172a" }}>{normalise(row.name) || "Name missing"}</span><span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "2px 6px", background: "#f1f5f9", color: "#475569", fontSize: 10, fontWeight: 700 }}>{formatStatus(row)}</span></div>
                      <div style={{ ...muted, marginTop: 2 }}>{normalise(row.address)}{row.address && row.postcode ? ", " : ""}{normalise(row.postcode)}</div>
                      {activeTab === "unlinked" && <button type="button" onClick={async event => { event.stopPropagation(); const postcode = normalise(row.postcode); if (!postcode) return; try { await navigator.clipboard.writeText(postcode) } catch (error) { console.error("Could not copy postcode:", error) } }} disabled={!normalise(row.postcode)} style={{ marginTop: 5, border: "1px solid #cbd5e1", borderRadius: 6, padding: "3px 7px", background: "#fff", color: normalise(row.postcode) ? "#334155" : "#94a3b8", fontSize: 10, fontWeight: 650, cursor: normalise(row.postcode) ? "pointer" : "not-allowed" }}>Copy postcode</button>}
                    </div>
                  </div>
                </td>
                {activeTab === "unlinked" && <td style={{ padding: "6px 8px", minWidth: 260 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input value={rowEdits[row.appointment_row_id] ?? ""} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} onChange={event => setRowEdits(current => ({ ...current, [row.appointment_row_id]: event.target.value }))} placeholder="Enter OpenSolar ID" inputMode="numeric" aria-label={"OpenSolar ID for " + (normalise(row.name) || row.appointment_row_id)} style={{ ...inputStyle, height: 32, flex: 1, width: "100%", boxSizing: "border-box" }} />
                    <button onClick={event => { event.stopPropagation(); saveOpenSolarId(row) }} disabled={savingId === row.appointment_row_id || !normalise(rowEdits[row.appointment_row_id])} style={{ border: "1px solid #0f766e", borderRadius: 7, height: 32, padding: "0 10px", whiteSpace: "nowrap", background: "#f0fdfa", color: "#0f766e", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>{savingId === row.appointment_row_id ? "Saving…" : "Save"}</button>
                  </div>
                </td>}
                {activeTab === "linked" && <td style={{ padding: "6px 10px", minWidth: 125, verticalAlign: "middle" }}>
                  {row.leadDisposition
                    ? <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontSize: 10, fontWeight: 750 }}>{row.leadDisposition}</span>
                    : <span style={muted}>No matching lead</span>}
                </td>}
                {activeTab === "linked" && <td style={{ padding: "6px 10px", minWidth: 115, verticalAlign: "middle" }}>
                  <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#f1f5f9", color: "#475569", fontSize: 10, fontWeight: 750 }}>{formatStatus(row)}</span>
                </td>}
                {activeTab === "linked" && <td style={{ padding: "6px 10px", minWidth: 105, whiteSpace: "nowrap", verticalAlign: "middle" }}>
                  {(() => {
                    const metrics = getQuoteRowMetrics(row)
                    return <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 10, color: "#475569" }}>
                      <span title="Annual electricity consumption">Usage: {metrics.annualConsumption !== null ? metrics.annualConsumption.toLocaleString("en-GB") + " kWh/yr" : "—"}</span>
                      <span title="Number of solar panels">Panels: {metrics.panelCount !== null ? metrics.panelCount : "—"}</span>
                      <span title="System cost">Cost: {metrics.systemCost !== null ? metrics.systemCost.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }) : "—"}</span>
                    </div>
                  })()}
                </td>}
                <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>
                  <div>{dateLabel(row.appointment_date)}</div>
                  {activeTab === "linked" && linked && <a href={"https://app.opensolar.com/projects/" + encodeURIComponent(String(row.open_solar_id))} onClick={event => event.stopPropagation()} target="_blank" rel="noreferrer" style={{ color: "#047857", display: "inline-flex", gap: 4, alignItems: "center", marginTop: 4, textDecoration: "none", fontSize: 10, fontWeight: 650 }}><Link2 size={12}/> {row.open_solar_id}</a>}
                </td>
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

              </tr>
            })}
          </tbody>
        </table>
      </div>
    </div>
    <div style={{ ...muted, marginTop: 12 }}>Saving an OpenSolar ID links the appointment in the CRM and moves it to the Linked appointments tab. This does not create a project in OpenSolar.</div>
  </div>
}
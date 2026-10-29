import React, { useEffect, useMemo, useState } from "react"
import { BarChart3, RefreshCw, TrendingUp, Search, FileSpreadsheet } from "lucide-react"
import * as XLSX from "xlsx-js-style"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { supabase } from "../lib/supabase"
import MapOfAppointments from "./MapOfAppointments"
import LeadDispositionKanban from "../components/LeadDispositionKanban"

const START_YEAR = 2026
const LEAD_TYPE_COLORS = ["#2563eb", "#0d9488", "#9333ea", "#ea580c", "#64748b", "#dc2626", "#0891b2", "#65a30d", "#c026d3", "#a16207"]

function pad(value) {
  return String(value).padStart(2, "0")
}

function monthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`
}

function buildMonthRange(startDate, endDate) {
  const rows = []
  const cursor = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    1
  )
  const end = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    1
  )

  while (cursor <= end) {
    rows.push({
      month: monthKey(cursor),
      label: cursor.toLocaleDateString("en-GB", {
        month: "short",
        year: "2-digit",
      }),
      lead_count: 0,
      cps_p_count: 0,
      cps_s_count: 0,
      cps_h_count: 0,
      cps_c_count: 0,
    })

    cursor.setMonth(cursor.getMonth() + 1)
  }

  return rows
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-GB").format(Number(value || 0))
}

function formatMonth(value) {
  if (!value) return ""

  const date = new Date(`${value}T00:00:00`)

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      })
}

function DataDashboard() {
  const [rows, setRows] = useState([])
  const [typeNames, setTypeNames] = useState([])
  const [leadSources, setLeadSources] = useState([])
  const [selectedLeadSource, setSelectedLeadSource] = useState("")
  const [chartPeriod, setChartPeriod] = useState("month")
  const [selectedLeadType, setSelectedLeadType] = useState("")
  const [leadSourcesLoading, setLeadSourcesLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("overview")
  const [archivedLeads, setArchivedLeads] = useState([])
  const [archivedLeadCount, setArchivedLeadCount] = useState(0)
  const [archivedLeadsLoading, setArchivedLeadsLoading] = useState(false)
  const [archivedLeadsError, setArchivedLeadsError] = useState("")
  const [archivedLeadsPage, setArchivedLeadsPage] = useState(0)
  const [archivedLeadsSearch, setArchivedLeadsSearch] = useState("")
  const [prontoLeadDetails, setProntoLeadDetails] = useState([])
  const [prontoLeadDetailsLoading, setProntoLeadDetailsLoading] = useState(false)
  const [prontoLeadDetailsError, setProntoLeadDetailsError] = useState("")
  const [prontoLeadDetailsLimit, setProntoLeadDetailsLimit] = useState(250)
  const [prontoLeadSearch, setProntoLeadSearch] = useState("")
  const [prontoLeadDispositionFilter, setProntoLeadDispositionFilter] = useState("all")
  const [prontoLeadAppointmentFilter, setProntoLeadAppointmentFilter] = useState("all")
  const [prontoLeadStageFilter, setProntoLeadStageFilter] = useState("all")
  const [prontoLeadDealFilter, setProntoLeadDealFilter] = useState("all")
  const [prontoSidRows, setProntoSidRows] = useState([])
  const [prontoMonthlyRows, setProntoMonthlyRows] = useState([])
  const [prontoMonthlyLoading, setProntoMonthlyLoading] = useState(false)
  const [prontoMonthlyError, setProntoMonthlyError] = useState("")
  const [showProntoVolumeBars, setShowProntoVolumeBars] = useState(true)
  const [showProntoBookingLines, setShowProntoBookingLines] = useState(true)
  const [prontoSidTotal, setProntoSidTotal] = useState(0)
  const [prontoNoContactTotal, setProntoNoContactTotal] = useState(0)
  const [prontoNoContactBySid, setProntoNoContactBySid] = useState({})
  const [prontoSidLoading, setProntoSidLoading] = useState(false)
  const [prontoExporting, setProntoExporting] = useState(false)
  const [prontoSidError, setProntoSidError] = useState("")
  const [prontoSidSearch, setProntoSidSearch] = useState("")
  const [prontoSort, setProntoSort] = useState({ key: null, direction: "asc" })
  const [prontoDatePeriod, setProntoDatePeriod] = useState("last_week")
  const [prontoStatusFilter, setProntoStatusFilter] = useState("all")
  const [showProntoDateStatusColumns, setShowProntoDateStatusColumns] = useState(true)
  const [showProntoDealInfoColumns, setShowProntoDealInfoColumns] = useState(true)
  const [expandedProntoSids, setExpandedProntoSids] = useState({})
  const [prontoC3Rows, setProntoC3Rows] = useState({})
  const [introducerSidRows, setIntroducerSidRows] = useState({})
  const [introducerSidLoading, setIntroducerSidLoading] = useState({})
  const [introducerC1Rows, setIntroducerC1Rows] = useState({})
  const [introducerC1Loading, setIntroducerC1Loading] = useState({})
  const [expandedIntroducerC1s, setExpandedIntroducerC1s] = useState({})
  const [introducerC3Rows, setIntroducerC3Rows] = useState({})
  const [introducerC3Loading, setIntroducerC3Loading] = useState({})
  const [expandedIntroducers, setExpandedIntroducers] = useState({})
  const [prontoC3Loading, setProntoC3Loading] = useState({})
  const [expandedProntoC1s, setExpandedProntoC1s] = useState({})
  const [prontoC1C3Rows, setProntoC1C3Rows] = useState({})
  const [prontoC1C3Loading, setProntoC1C3Loading] = useState({})
  const [missingSidC1Rows, setMissingSidC1Rows] = useState([])
  const [missingSidC1Loading, setMissingSidC1Loading] = useState(false)
  const [missingSidC1Error, setMissingSidC1Error] = useState("")
  const [missingSidC1Search, setMissingSidC1Search] = useState("")
  const [missingSidLeadRows, setMissingSidLeadRows] = useState([])
  const [missingSidLeadsLoading, setMissingSidLeadsLoading] = useState(false)
  const [missingSidLeadsError, setMissingSidLeadsError] = useState("")
  const [missingSidLeadsSearch, setMissingSidLeadsSearch] = useState("")

  function formatProntoDate(value) {
    if (!value) return "—"
    const date = new Date(`${value}T00:00:00`)
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB")
  }

  function isProntoLive(value) {
    if (!value) return false
    const latest = new Date(`${value}T00:00:00`)
    if (Number.isNaN(latest.getTime())) return false
    const cutoff = new Date()
    cutoff.setHours(0, 0, 0, 0)
    cutoff.setDate(cutoff.getDate() - 2)
    return latest >= cutoff
  }

  function prontoStatus(value) {
    const live = isProntoLive(value)
    return <span style={{ display: "inline-block", minWidth: 42, textAlign: "center", padding: "3px 8px", borderRadius: 999, background: live ? "#dcfce7" : "#fee2e2", color: live ? "#166534" : "#991b1b", fontSize: 11, fontWeight: 700 }}>{live ? "Live" : "Off"}</span>
  }

  async function exportProntoDrilldown() {
    if (!supabase || prontoExporting) return
    setProntoExporting(true)
    setProntoSidError("")
    try {
      const reportRows = []
      const statusFor = (date) => isProntoLive(date) ? "Live" : "Off"
      const addRow = ({ level, introducer, sid = "", c1 = "", c3 = "", first, latest, leads, booked }) => {
        const count = Number(leads || 0)
        const bookedCount = Number(booked || 0)
        reportRows.push({ Level: level, Introducer: introducer, SID: sid, "C1 Campaign": c1, "C3 Campaign": c3, "First Received": first || "", "Latest Received": latest || "", Status: statusFor(latest), Leads: count, Booked: bookedCount, "Booked %": Number((count ? bookedCount / count * 100 : 0).toFixed(1)) })
      }
      for (const introRow of filteredProntoSidRows) {
        const introducer = introRow.pronto_sid
        addRow({ level: "Introducer", introducer, first: introRow.first_lead_date, latest: introRow.latest_lead_date, leads: introRow.lead_count, booked: introRow.booked_count })
        const { data: sidRows, error: sidError } = await supabase.rpc("get_pronto_introducer_sid_counts", { introducer_filter: introducer, date_period: prontoDatePeriod })
        if (sidError) throw sidError
        for (const sidRow of sidRows || []) {
          const sid = String(sidRow.pronto_sid || "(No SID)")
          addRow({ level: "SID", introducer, sid, first: sidRow.first_lead_date, latest: sidRow.latest_lead_date, leads: sidRow.lead_count, booked: sidRow.booked_count })
          const { data: c1Rows, error: c1Error } = await supabase.rpc("get_pronto_introducer_sid_c1_counts", { introducer_filter: introducer, sid_filter: sid, date_period: prontoDatePeriod })
          if (c1Error) throw c1Error
          for (const c1Row of c1Rows || []) {
            const c1 = String(c1Row.pronto_c1 || "(Blank / NULL)")
            addRow({ level: "C1", introducer, sid, c1, first: c1Row.first_lead_date, latest: c1Row.latest_lead_date, leads: c1Row.lead_count, booked: c1Row.booked_count })
            const { data: c3Rows, error: c3Error } = await supabase.rpc("get_pronto_introducer_sid_c1_c3_counts", { introducer_filter: introducer, sid_filter: sid, c1_filter: c1, date_period: prontoDatePeriod })
            if (c3Error) throw c3Error
            for (const c3Row of c3Rows || []) addRow({ level: "C3", introducer, sid, c1, c3: String(c3Row.pronto_c3 || "(Blank / NULL)"), first: c3Row.first_lead_date, latest: c3Row.latest_lead_date, leads: c3Row.lead_count, booked: c3Row.booked_count })
          }
        }
      }
      if (!reportRows.length) { setProntoSidError("No Pronto data is available for the selected filters."); return }
      const worksheet = XLSX.utils.json_to_sheet(reportRows)
      worksheet["!cols"] = [{ wch: 14 }, { wch: 24 }, { wch: 20 }, { wch: 42 }, { wch: 42 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]
      // Style the exported hierarchy rows so SID and C1 levels are easy to distinguish.
      const reportHeaders = Object.keys(reportRows[0])
      reportRows.forEach((row, index) => {
        const excelRow = index + 2 // row 1 contains the column headings
        const fillColor = row.Level === "SID" ? "17365D" : row.Level === "C1" ? "808080" : null
        if (!fillColor) return
        reportHeaders.forEach((header, colIndex) => {
          const cell = XLSX.utils.encode_cell({ r: excelRow - 1, c: colIndex })
          if (!worksheet[cell]) return
          worksheet[cell].s = {
            fill: { patternType: "solid", fgColor: { rgb: fillColor } },
            font: { color: { rgb: "FFFFFF" }, bold: row.Level === "SID" },
            alignment: { vertical: "center" },
          }
        })
      })
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Pronto Drilldown")
      const periodLabels = { this_week: "This Week", last_week: "Last Week", last_4_weeks: "Last Four Weeks", year_to_date: "Year To Date", all_time: "All Time" }
      const info = XLSX.utils.aoa_to_sheet([["Pronto Buy Drilldown Report"], ["Date period", periodLabels[prontoDatePeriod] || prontoDatePeriod], ["Status filter", prontoStatusFilter === "all" ? "All Statuses" : prontoStatusFilter === "live" ? "Live" : "Off"], ["Search", prontoSidSearch.trim() || "None"], ["Generated", new Date().toLocaleString("en-GB")], [], ["Rows exported", reportRows.length]])
      XLSX.utils.book_append_sheet(workbook, info, "Report Info")
      XLSX.writeFile(workbook, "pronto-buy-drilldown-" + new Date().toISOString().slice(0, 10) + ".xlsx")
    } catch (err) {
      console.error("Error exporting Pronto drilldown:", err)
      setProntoSidError(err?.message || "Unable to export the Pronto drilldown report.")
    } finally { setProntoExporting(false) }
  }
  useEffect(() => { if (activeTab === "pronto") loadProntoLeadDetails() }, [activeTab, prontoDatePeriod, prontoLeadDetailsLimit])

  async function loadProntoMonthlyTrends() {
    if (!supabase) return
    setProntoMonthlyLoading(true)
    setProntoMonthlyError("")
    try {
      const { data, error: rpcError } = await supabase.rpc("get_pronto_monthly_introducer_trends", { date_period: "year_to_date" })
      if (rpcError) throw rpcError
      setProntoMonthlyRows((data || []).map((row) => ({ ...row, month_start: String(row.month_start).slice(0, 10), lead_count: Number(row.lead_count || 0), booked_count: Number(row.booked_count || 0) })))
    } catch (err) {
      console.error("Error loading Pronto monthly trends:", err)
      setProntoMonthlyError(err?.message || "Unable to load monthly Pronto trends.")
      setProntoMonthlyRows([])
    } finally { setProntoMonthlyLoading(false) }
  }

  async function loadProntoLeadDetails() {
    if (!supabase) return
    setProntoLeadDetailsLoading(true)
    setProntoLeadDetailsError("")
    try {
      const now = new Date()
      const weekStart = new Date(now); weekStart.setHours(0,0,0,0); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
      const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7)
      const fourWeeksStart = new Date(weekStart); fourWeeksStart.setDate(fourWeeksStart.getDate() - 28)
      const yearStart = new Date(now.getFullYear(),0,1)
      let from = new Date("2025-01-01T00:00:00")
      let to = new Date(now); to.setDate(to.getDate()+1); to.setHours(0,0,0,0)
      if (prontoDatePeriod === "this_week") from = weekStart
      else if (prontoDatePeriod === "last_week") { from = lastWeekStart; to = weekStart }
      else if (prontoDatePeriod === "last_4_weeks") { from = fourWeeksStart; to = weekStart }
      else if (prontoDatePeriod === "year_to_date") from = yearStart
      const { data: leadData, error: leadError } = await supabase.from("leads")
        .select("marketing_row_id,first_name,last_name,primary_phone_number,email,address,postcode,lead_source,introducer,pronto_SID,pronto_c1,pronto_c3,received_date_time,appointment_date_time,disposition")
        .eq("lead_source","Pronto Windows").gte("received_date_time",from.toISOString()).lt("received_date_time",to.toISOString())
        .order("received_date_time",{ascending:false}).range(0,prontoLeadDetailsLimit-1)
      if (leadError) throw leadError
      const leads = leadData || []
      const ids = leads.map((l) => l.marketing_row_id).filter(Boolean)
      let appointments = []
      if (ids.length) {
        const { data, error } = await supabase.from("appointments")
          .select("appointment_row_id,marketing_row_id,name,appointment_date,canvasser,rep_allocated,result,product,job_type,cps_h,cps_c,cps_p,cps_s,branch,rep_confirmed_time,appointment_confirmed_time")
          .in("marketing_row_id",ids).order("appointment_date",{ascending:false})
        if (error) throw error
        appointments = data || []
      }
      const appointmentIds = appointments.map((a) => a.appointment_row_id).filter(Boolean)
      let deals = []
      if (appointmentIds.length) {
        const { data: dealData, error: dealError } = await supabase.from("deals").select("id,appointment_row_id,net_value").in("appointment_row_id", appointmentIds)
        if (dealError) throw dealError
        deals = dealData || []
      }
      const dealsByAppointment = new Map()
      deals.forEach((deal) => {
        if (!dealsByAppointment.has(deal.appointment_row_id)) dealsByAppointment.set(deal.appointment_row_id, [])
        dealsByAppointment.get(deal.appointment_row_id).push(deal)
      })
      const byLead = new Map()
      appointments.forEach((a) => {
        const enriched = { ...a, relatedDeals: dealsByAppointment.get(a.appointment_row_id) || [] }
        if (!byLead.has(a.marketing_row_id)) byLead.set(a.marketing_row_id,[])
        byLead.get(a.marketing_row_id).push(enriched)
      })
      setProntoLeadDetails(leads.map((l) => {
        const relatedAppointments = byLead.get(l.marketing_row_id) || []
        const relatedDeals = relatedAppointments.flatMap((a) => a.relatedDeals || [])
        return { ...l, relatedAppointments, relatedDeals, netValueSold: relatedDeals.reduce((sum, d) => sum + Number(d.net_value || 0), 0) }
      }))
    } catch (err) {
      console.error("Error loading Pronto leads and appointments:",err)
      setProntoLeadDetailsError(err?.message || "Unable to load leads and related appointments.")
      setProntoLeadDetails([])
    } finally { setProntoLeadDetailsLoading(false) }
  }

  async function loadProntoSidData() {
    if (!supabase) {
      setProntoSidError("Supabase is not configured.")
      return
    }

    setProntoSidLoading(true)
    setProntoSidError("")

    try {
      const { data, error: rpcError } = await supabase.rpc("get_pronto_introducer_lead_counts", { date_period: prontoDatePeriod })
      if (rpcError) throw rpcError

      const { data: netValueRows, error: netValueError } = await supabase.rpc("get_pronto_introducer_net_value_sold", { date_period: prontoDatePeriod })
      if (netValueError) throw netValueError
      const netValueByIntroducer = Object.fromEntries((netValueRows || []).map((row) => [String(row.introducer || "(No Introducer)"), Number(row.net_value_sold || 0)]))
      const { data: solidValueRows, error: solidValueError } = await supabase.rpc("get_pronto_introducer_net_value_solid", { date_period: prontoDatePeriod })
      if (solidValueError) throw solidValueError
      const netValueSolidByIntroducer = Object.fromEntries((solidValueRows || []).map((row) => [String(row.introducer || "(No Introducer)"), Number(row.net_value_solid || 0)]))

      setProntoSidRows((data || []).map((row) => ({
        pronto_sid: String(row.introducer || "(No Introducer)"),
        introducers: String(row.introducer || "(No Introducer)"),
        no_contact_count: Number(row.no_contact_count || 0),
        lead_count: Number(row.lead_count || 0),
        booked_count: Number(row.booked_count || 0),
        cps_h_count: Number(row.cps_h_count || 0),
        cps_c_count: Number(row.cps_c_count || 0),
        cps_p_count: Number(row.cps_p_count || 0),
        cps_s_count: Number(row.cps_s_count || 0),
        net_value_sold: Number(netValueByIntroducer[String(row.introducer || "(No Introducer)")] || 0),
        net_value_solid: Number(netValueSolidByIntroducer[String(row.introducer || "(No Introducer)")] || 0),
        first_lead_date: row.first_lead_date || null,
        latest_lead_date: row.latest_lead_date || null,
      })))
      setProntoSidTotal(Number(data?.[0]?.total_count || 0))

      const { data: noContactRows, error: noContactRowsError } = await supabase.rpc(
        "get_pronto_sid_no_contact_counts",
        { date_period: prontoDatePeriod }
      )
      if (noContactRowsError) throw noContactRowsError
      const noContactCounts = (noContactRows || []).map((row) => ({
        pronto_sid: String(row.pronto_sid || "(No SID)"),
        no_contact_count: Number(row.no_contact_count || 0),
      }))
      setProntoNoContactBySid(Object.fromEntries(
        noContactCounts.map((row) => [row.pronto_sid, row.no_contact_count])
      ))
      setProntoNoContactTotal(noContactCounts.reduce((sum, row) => sum + row.no_contact_count, 0))
    } catch (err) {
      console.error("Error loading Pronto SID data:", err)
      setProntoSidError(err?.message || "Unable to load Pronto SID data.")
      setProntoSidRows([])
      setProntoSidTotal(0)
      setProntoNoContactTotal(0)
    } finally {
      setProntoSidLoading(false)
    }
  }

  async function loadMissingSidC1Values() {
    if (!supabase) {
      setMissingSidC1Error("Supabase is not configured.")
      return
    }

    setMissingSidC1Loading(true)
    setMissingSidC1Error("")
    try {
      const { data, error: rpcError } = await supabase.rpc("get_pronto_c1_values_without_sid")
      if (rpcError) throw rpcError
      setMissingSidC1Rows((data || []).map((row) => ({
        pronto_c1: String(row.pronto_c1 || ""),
        lead_count: Number(row.lead_count || 0),
      })))
    } catch (err) {
      console.error("Error loading Pronto C1 values without SID:", err)
      setMissingSidC1Error(err?.message || "Unable to load Pronto C1 values without a SID.")
      setMissingSidC1Rows([])
    } finally {
      setMissingSidC1Loading(false)
    }
  }

  async function loadMissingSidLeads() {
    if (!supabase) {
      setMissingSidLeadsError("Supabase is not configured.")
      return
    }

    setMissingSidLeadsLoading(true)
    setMissingSidLeadsError("")
    try {
      const { data, error: rpcError } = await supabase.rpc("get_pronto_windows_leads_without_sid")
      if (rpcError) throw rpcError
      setMissingSidLeadRows((data || []).map((row) => ({
        lead_identifier: String(row.lead_identifier || ""),
        pronto_c1: String(row.pronto_c1 || ""),
        pronto_c2: String(row.pronto_c2 || ""),
        pronto_c3: String(row.pronto_c3 || ""),
      })))
    } catch (err) {
      console.error("Error loading Pronto Windows leads without SID:", err)
      setMissingSidLeadsError(err?.message || "Unable to load Pronto Windows leads without a SID.")
      setMissingSidLeadRows([])
    } finally {
      setMissingSidLeadsLoading(false)
    }
  }

  async function toggleIntroducer(introducer) {
    const isExpanded = Boolean(expandedIntroducers[introducer])
    setExpandedIntroducers((current) => ({ ...current, [introducer]: !current[introducer] }))
    if (isExpanded || Object.prototype.hasOwnProperty.call(introducerSidRows, introducer) || introducerSidLoading[introducer]) return
    if (!supabase) return
    setIntroducerSidLoading((current) => ({ ...current, [introducer]: true }))
    try {
      const { data, error: rpcError } = await supabase.rpc("get_pronto_introducer_sid_counts", { introducer_filter: introducer, date_period: prontoDatePeriod })
      if (rpcError) throw rpcError
      const { data: valueRows, error: valueError } = await supabase.rpc("get_pronto_drilldown_net_values", { introducer_filter: introducer, group_level: "sid", date_period: prontoDatePeriod })
      if (valueError) throw valueError
      const values = Object.fromEntries((valueRows || []).map((v) => [String(v.group_value), v]))
      setIntroducerSidRows((current) => ({ ...current, [introducer]: (data || []).map((row) => ({
        pronto_sid: String(row.pronto_sid || "(No SID)"), lead_count: Number(row.lead_count || 0), booked_count: Number(row.booked_count || 0),
        first_lead_date: row.first_lead_date || null, latest_lead_date: row.latest_lead_date || null,
        cps_h_count: Number(row.cps_h_count || 0), cps_c_count: Number(row.cps_c_count || 0), cps_p_count: Number(row.cps_p_count || 0), cps_s_count: Number(row.cps_s_count || 0),
        net_value_sold: Number(values[String(row.pronto_sid || "(No SID)")]?.net_value_sold || 0), net_value_solid: Number(values[String(row.pronto_sid || "(No SID)")]?.net_value_solid || 0),
      })) }))
    } catch (err) {
      console.error("Error loading SID breakdown by introducer:", err)
      setIntroducerSidRows((current) => ({ ...current, [introducer]: [] }))
      setProntoSidError(err?.message || `Unable to load SID breakdown for introducer ${introducer}.`)
    } finally { setIntroducerSidLoading((current) => ({ ...current, [introducer]: false })) }
  }

  async function toggleIntroducerSid(introducer, sid) {
    const key = JSON.stringify([introducer, sid])
    const isExpanded = Boolean(expandedProntoSids[key])
    setExpandedProntoSids((current) => ({ ...current, [key]: !current[key] }))
    if (isExpanded || Object.prototype.hasOwnProperty.call(introducerC1Rows, key) || introducerC1Loading[key]) return
    setIntroducerC1Loading((current) => ({ ...current, [key]: true }))
    try {
      const { data, error } = await supabase.rpc("get_pronto_introducer_sid_c1_counts", { introducer_filter: introducer, sid_filter: sid, date_period: prontoDatePeriod })
      if (error) throw error
      const { data: valueRows, error: valueError } = await supabase.rpc("get_pronto_drilldown_net_values", { introducer_filter: introducer, sid_filter: sid, group_level: "c1", date_period: prontoDatePeriod })
      if (valueError) throw valueError
      const values = Object.fromEntries((valueRows || []).map((v) => [String(v.group_value), v]))
      setIntroducerC1Rows((current) => ({ ...current, [key]: (data || []).map((r) => ({ pronto_c1: String(r.pronto_c1 || "(Blank / NULL)"), lead_count: Number(r.lead_count || 0), booked_count: Number(r.booked_count || 0), first_lead_date: r.first_lead_date || null, latest_lead_date: r.latest_lead_date || null, cps_h_count: Number(r.cps_h_count || 0), cps_c_count: Number(r.cps_c_count || 0), cps_p_count: Number(r.cps_p_count || 0), cps_s_count: Number(r.cps_s_count || 0), net_value_sold: Number(values[String(r.pronto_c1 || "(Blank / NULL)")]?.net_value_sold || 0), net_value_solid: Number(values[String(r.pronto_c1 || "(Blank / NULL)")]?.net_value_solid || 0) })) }))
    } catch (err) {
      setIntroducerC1Rows((current) => ({ ...current, [key]: [] }))
      setProntoSidError(err?.message || "Unable to load C1 breakdown.")
    } finally { setIntroducerC1Loading((current) => ({ ...current, [key]: false })) }
  }

  async function toggleIntroducerC1(introducer, sid, c1) {
    const key = JSON.stringify([introducer, sid, c1])
    const isExpanded = Boolean(expandedIntroducerC1s[key])
    setExpandedIntroducerC1s((current) => ({ ...current, [key]: !current[key] }))
    if (isExpanded || Object.prototype.hasOwnProperty.call(introducerC3Rows, key) || introducerC3Loading[key]) return
    setIntroducerC3Loading((current) => ({ ...current, [key]: true }))
    try {
      const { data, error } = await supabase.rpc("get_pronto_introducer_sid_c1_c3_counts", { introducer_filter: introducer, sid_filter: sid, c1_filter: c1, date_period: prontoDatePeriod })
      if (error) throw error
      const { data: valueRows, error: valueError } = await supabase.rpc("get_pronto_drilldown_net_values", { introducer_filter: introducer, sid_filter: sid, c1_filter: c1, group_level: "c3", date_period: prontoDatePeriod })
      if (valueError) throw valueError
      const values = Object.fromEntries((valueRows || []).map((v) => [String(v.group_value), v]))
      setIntroducerC3Rows((current) => ({ ...current, [key]: (data || []).map((r) => ({ pronto_c3: String(r.pronto_c3 || "(Blank / NULL)"), lead_count: Number(r.lead_count || 0), booked_count: Number(r.booked_count || 0), first_lead_date: r.first_lead_date || null, latest_lead_date: r.latest_lead_date || null, cps_h_count: Number(r.cps_h_count || 0), cps_c_count: Number(r.cps_c_count || 0), cps_p_count: Number(r.cps_p_count || 0), cps_s_count: Number(r.cps_s_count || 0), net_value_sold: Number(values[String(r.pronto_c3 || "(Blank / NULL)")]?.net_value_sold || 0), net_value_solid: Number(values[String(r.pronto_c3 || "(Blank / NULL)")]?.net_value_solid || 0) })) }))
    } catch (err) {
      setIntroducerC3Rows((current) => ({ ...current, [key]: [] }))
      setProntoSidError(err?.message || "Unable to load C3 breakdown.")
    } finally { setIntroducerC3Loading((current) => ({ ...current, [key]: false })) }
  }

  async function toggleProntoSid(sid) {
    const isExpanded = Boolean(expandedProntoSids[sid])
    setExpandedProntoSids((current) => ({ ...current, [sid]: !current[sid] }))
    if (isExpanded || Object.prototype.hasOwnProperty.call(prontoC3Rows, sid) || prontoC3Loading[sid]) return
    if (!supabase) return

    setProntoC3Loading((current) => ({ ...current, [sid]: true }))
    try {
      const { data, error: rpcError } = await supabase.rpc("get_pronto_sid_c3_lead_counts_with_dates_filtered", { sid_filter: sid, date_period: prontoDatePeriod })
      if (rpcError) throw rpcError
      setProntoC3Rows((current) => ({
        ...current,
        [sid]: (data || []).map((row) => ({
          pronto_c3: String(row.pronto_c3 || "(Blank / NULL)"),
          lead_count: Number(row.lead_count || 0),
          booked_count: Number(row.booked_count || 0),
          first_lead_date: row.first_lead_date || null,
          latest_lead_date: row.latest_lead_date || null,
        })),
      }))
    } catch (err) {
      console.error("Error loading Pronto C3 breakdown:", err)
      setProntoC3Rows((current) => ({ ...current, [sid]: [] }))
      setProntoSidError(err?.message || `Unable to load Pronto C3 breakdown for SID ${sid}.`)
    } finally {
      setProntoC3Loading((current) => ({ ...current, [sid]: false }))
    }
  }

  async function toggleProntoC1(sid, c1) {
    const key = JSON.stringify([sid, c1])
    const isExpanded = Boolean(expandedProntoC1s[key])
    setExpandedProntoC1s((current) => ({ ...current, [key]: !current[key] }))
    if (isExpanded || Object.prototype.hasOwnProperty.call(prontoC1C3Rows, key) || prontoC1C3Loading[key]) return
    if (!supabase) return

    setProntoC1C3Loading((current) => ({ ...current, [key]: true }))
    try {
      const { data, error: rpcError } = await supabase.rpc("get_pronto_c1_c3_lead_counts", {
        sid_filter: sid,
        c1_filter: c1,
        date_period: prontoDatePeriod,
      })
      if (rpcError) throw rpcError
      setProntoC1C3Rows((current) => ({
        ...current,
        [key]: (data || []).map((item) => ({
          pronto_c3: String(item.pronto_c3 || "(Blank / NULL)"),
          lead_count: Number(item.lead_count || 0),
          booked_count: Number(item.booked_count || 0),
          first_lead_date: item.first_lead_date || null,
          latest_lead_date: item.latest_lead_date || null,
        })),
      }))
    } catch (err) {
      console.error("Error loading Pronto C3 breakdown for C1:", err)
      setProntoC1C3Rows((current) => ({ ...current, [key]: [] }))
      setProntoSidError(err?.message || `Unable to load Pronto C3 breakdown for C1 ${c1}.`)
    } finally {
      setProntoC1C3Loading((current) => ({ ...current, [key]: false }))
    }
  }

  async function loadData() {
    if (!supabase) {
      setError("Supabase is not configured.")
      setLoading(false)
      return
    }

    setLoading(true)
    setError("")

    try {
      const now = new Date()
      const start = new Date(START_YEAR, 0, 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      const rpcArgs = {
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        selected_lead_source: selectedLeadSource || null,
        period_type: chartPeriod,
      }

      const { data: chartData, error: chartError } = await supabase.rpc("get_lead_volume_chart_by_period", rpcArgs)
      if (chartError) throw chartError

      const grouped = new Map()
      const availableTypes = [...new Set((chartData || []).map((row) => String(row.lead_type || "(Empty / NULL)")))]
      setTypeNames(availableTypes)
      ;(chartData || []).forEach((item) => {
        const key = String(item.period_start).slice(0, 10)
        if (!grouped.has(key)) {
          const date = new Date(`${key}T00:00:00`)
          const label = chartPeriod === "week"
            ? `Week of ${date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}`
            : chartPeriod === "quarter"
              ? `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`
              : chartPeriod === "year"
                ? String(date.getFullYear())
                : date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
          grouped.set(key, {
            month: key,
            period_label: label,
            lead_count: Number(item.total_lead_count || 0),
            cps_h_count: Number(item.cps_h_count || 0),
            cps_c_count: Number(item.cps_c_count || 0),
            cps_p_count: Number(item.cps_p_count || 0),
            cps_s_count: Number(item.cps_s_count || 0),
          })
        }
        grouped.get(key)[String(item.lead_type || "(Empty / NULL)")] = Number(item.lead_count || 0)
      })
      const complete = [...grouped.values()].map((row) => {
        const percentage = (count) => row.lead_count > 0 ? (count / row.lead_count) * 100 : 0
        return {
          ...row,
          cps_h_pct: percentage(row.cps_h_count),
          cps_c_pct: percentage(row.cps_c_count),
          cps_p_pct: percentage(row.cps_p_count),
          cps_s_pct: percentage(row.cps_s_count),
        }
      })
      setRows(complete)
    } catch (err) {
      console.error("Error loading data dashboard:", err)

      setError(
        err?.message || "Unable to load lead volume data."
      )

      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    async function loadLeadSources() {
      setLeadSourcesLoading(true)
      try {
        const { data, error: sourcesError } = await supabase.rpc("get_lead_volume_sources")
        if (sourcesError) throw sourcesError
        setLeadSources((data || [])
          .filter((row) => {
            const source = String(row.lead_source ?? "").toLowerCase()
            return !source.includes("dds solar")
          })
          .map((row) => ({
            value: String(row.lead_source ?? ""),
            label: row.lead_source === "__NO_SOURCE__" ? "(No lead source)" : String(row.lead_source),
            count: Number(row.lead_count || 0),
          }))
          .sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" })))
      } catch (err) {
        console.error("Error loading lead sources:", err)
      } finally {
        setLeadSourcesLoading(false)
      }
    }
    if (supabase) loadLeadSources()
  }, [])


  async function loadArchivedLeads() {
    if (!supabase) return
    setArchivedLeadsLoading(true)
    setArchivedLeadsError("")
    try {
      const pageSize = 100
      let query = supabase.from("leads")
        .select("delete_row_id,marketing_row_id,salutations,first_name,last_name,postcode,primary_phone_number,email,lead_source,disposition,reason_for_archive,time_archived,received_date_time", { count: "exact" })
        .not("time_archived", "is", null)
        .order("time_archived", { ascending: false, nullsFirst: false })
        .range(archivedLeadsPage * pageSize, archivedLeadsPage * pageSize + pageSize - 1)
      const term = archivedLeadsSearch.trim().replace(/[,%()]/g, " ")
      if (term) query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,postcode.ilike.%${term}%,primary_phone_number.ilike.%${term}%,email.ilike.%${term}%,lead_source.ilike.%${term}%`)
      const { data, error: queryError, count } = await query
      if (queryError) throw queryError
      setArchivedLeads(data || [])
      setArchivedLeadCount(count || 0)
    } catch (e) {
      setArchivedLeadsError(e.message || "Unable to load archived leads.")
      setArchivedLeads([])
      setArchivedLeadCount(0)
    } finally {
      setArchivedLeadsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === "archived-leads") loadArchivedLeads()
  }, [activeTab, archivedLeadsPage, archivedLeadsSearch])

  useEffect(() => {
    loadData()
  }, [selectedLeadSource, chartPeriod])

  useEffect(() => {
    if (activeTab === "pronto") {
      loadProntoSidData()
      loadProntoMonthlyTrends()
    }
  }, [activeTab, prontoDatePeriod])

  const filteredMissingSidC1Rows = useMemo(() => {
    const search = missingSidC1Search.trim().toLowerCase()
    return missingSidC1Rows.filter((row) => !search || row.pronto_c1.toLowerCase().includes(search))
  }, [missingSidC1Rows, missingSidC1Search])

  const filteredMissingSidLeadRows = useMemo(() => {
    const search = missingSidLeadsSearch.trim().toLowerCase()
    return missingSidLeadRows.filter((row) =>
      !search || [row.lead_identifier, row.pronto_c1, row.pronto_c2, row.pronto_c3]
        .some((value) => value.toLowerCase().includes(search))
    )
  }, [missingSidLeadRows, missingSidLeadsSearch])

  function changeProntoSort(key) {
    setProntoSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }))
  }

  function sortProntoRows(rows) {
    if (!prontoSort.key) return rows
    const key = prontoSort.key
    const direction = prontoSort.direction === "asc" ? 1 : -1
    return [...rows].sort((a, b) => {
      let av
      let bv
      if (key === "name") {
        av = String(a.pronto_sid ?? a.pronto_c1 ?? a.pronto_c3 ?? "").toLowerCase()
        bv = String(b.pronto_sid ?? b.pronto_c1 ?? b.pronto_c3 ?? "").toLowerCase()
      } else if (key === "status") {
        av = isProntoLive(a.latest_lead_date) ? 1 : 0
        bv = isProntoLive(b.latest_lead_date) ? 1 : 0
      } else if (key === "booked_rate") {
        av = Number(a.lead_count) ? Number(a.booked_count || 0) / Number(a.lead_count) : 0
        bv = Number(b.lead_count) ? Number(b.booked_count || 0) / Number(b.lead_count) : 0
      } else if (key === "leads" || key === "booked") {
        av = Number(key === "leads" ? a.lead_count || 0 : a.booked_count || 0)
        bv = Number(key === "leads" ? b.lead_count || 0 : b.booked_count || 0)
      } else {
        av = a[key] ? new Date(a[key]).getTime() : 0
        bv = b[key] ? new Date(b[key]).getTime() : 0
      }
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * direction
      return (av - bv) * direction
    })
  }

  const prontoDashboardStats = useMemo(() => {
    const sum = (key) => (prontoSidRows || []).reduce((total, row) => total + Number(row[key] || 0), 0)
    const leads = sum("lead_count"), booked = sum("booked_count"), h = sum("cps_h_count")
    const confirmed = sum("cps_c_count"), pitched = sum("cps_p_count"), sold = sum("cps_s_count"), netValue = sum("net_value_sold")
    return { leads, booked, h, confirmed, pitched, sold, netValue, bookedRate: leads ? booked / leads * 100 : 0, valuePerLead: leads ? netValue / leads : 0, hToC: h ? confirmed / h * 100 : 0, cToP: confirmed ? pitched / confirmed * 100 : 0, pToS: pitched ? sold / pitched * 100 : 0, hToS: h ? sold / h * 100 : 0 }
  }, [prontoSidRows])

  const filteredProntoLeadDetails = useMemo(() => {
    const search = prontoLeadSearch.trim().toLowerCase()
    return prontoLeadDetails.filter((lead) => {
      const haystack = [lead.first_name, lead.last_name, lead.postcode, lead.introducer, lead.disposition, lead.pronto_SID, lead.pronto_c1, lead.pronto_c3].filter(Boolean).join(" ").toLowerCase()
      if (search && !haystack.includes(search)) return false
      if (prontoLeadDispositionFilter !== "all" && String(lead.disposition || "") !== prontoLeadDispositionFilter) return false
      const today = new Date(); today.setHours(0,0,0,0)
      const appointmentDate = lead.appointment_date_time ? new Date(lead.appointment_date_time) : null
      if (prontoLeadAppointmentFilter === "past" && (!appointmentDate || appointmentDate >= today)) return false
      if (prontoLeadAppointmentFilter === "forward" && (!appointmentDate || appointmentDate < today)) return false
      if (prontoLeadStageFilter !== "all" && !lead.relatedAppointments.some((a) => a["cps_" + prontoLeadStageFilter] === true)) return false
      const hasDeal = (lead.relatedDeals || []).length > 0
      if (prontoLeadDealFilter === "yes" && !hasDeal) return false
      if (prontoLeadDealFilter === "no" && hasDeal) return false
      return true
    })
  }, [prontoLeadDetails, prontoLeadSearch, prontoLeadDispositionFilter, prontoLeadAppointmentFilter, prontoLeadStageFilter, prontoLeadDealFilter])

  const filteredProntoSidRows = useMemo(() => {
    const search = prontoSidSearch.trim().toLowerCase()
    return sortProntoRows(prontoSidRows.filter((row) => {
      const matchesSearch = !search || row.pronto_sid.toLowerCase().includes(search)
      const live = isProntoLive(row.latest_lead_date)
      const matchesStatus = prontoStatusFilter === "all" || (prontoStatusFilter === "live" ? live : !live)
      return matchesSearch && matchesStatus
    }))
  }, [prontoSidRows, prontoSidSearch, prontoStatusFilter, prontoSort])

  const prontoTrendIntroducers = useMemo(
    () => filteredProntoSidRows.map((row) => String(row.pronto_sid || "(No Introducer)")),
    [filteredProntoSidRows]
  )

  const prontoMonthlyMaxRate = useMemo(() => {
    const rates = prontoMonthlyRows
      .filter((row) => prontoTrendIntroducers.includes(String(row.introducer || "(No Introducer)")))
      .filter((row) => Number(row.lead_count) > 0)
      .map((row) => Number(row.booked_count || 0) / Number(row.lead_count) * 100)
    const maxRate = rates.length ? Math.max(...rates) : 0
    return Math.max(10, Math.ceil(maxRate / 10) * 10)
  }, [prontoMonthlyRows, prontoTrendIntroducers])

  const prontoMonthlyChartData = useMemo(() => {
    if (!prontoMonthlyRows.length || !prontoTrendIntroducers.length) return []
    const current = new Date()
    const currentMonth = new Date(current.getFullYear(), current.getMonth(), 1)
    // The trend charts intentionally show month-by-month performance for the current calendar year,
    // independently of the table's selected date-period filter.
    const startMonth = new Date(current.getFullYear(), 0, 1)
    const monthKeys = []
    for (let date = new Date(startMonth); date <= currentMonth; date.setMonth(date.getMonth() + 1)) {
      monthKeys.push(date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-01")
    }
    const byMonth = new Map()
    for (const row of prontoMonthlyRows) {
      const name = String(row.introducer || "(No Introducer)")
      if (!prontoTrendIntroducers.includes(name)) continue
      const key = row.month_start.slice(0, 7) + "-01"
      if (!byMonth.has(key)) byMonth.set(key, {})
      const month = byMonth.get(key)
      month[name + "__leads"] = row.lead_count
      month[name + "__rate"] = row.lead_count ? row.booked_count / row.lead_count * 100 : null
    }
    return monthKeys.map((key) => ({
      month: new Date(key + "T00:00:00").toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
      ...(byMonth.get(key) || {}),
    }))
  }, [prontoMonthlyRows, prontoTrendIntroducers])

  const totalLeads = useMemo(
    () => rows.reduce((total, row) => total + (selectedLeadType ? Number(row[selectedLeadType] || 0) : Number(row.lead_count || 0)), 0),
    [rows, selectedLeadType]
  )

  const monthsWithData = useMemo(
    () => rows.filter((row) => (selectedLeadType ? Number(row[selectedLeadType] || 0) : Number(row.lead_count || 0)) > 0),
    [rows, selectedLeadType]
  )

  const averageMonthly = monthsWithData.length
    ? Math.round(
        totalLeads / monthsWithData.length
      )
    : 0

  const peakMonth = useMemo(() => {
    if (!monthsWithData.length) {
      return null
    }

    return monthsWithData.reduce((peak, row) =>
      row.lead_count > peak.lead_count
        ? row
        : peak
    )
  }, [monthsWithData, selectedLeadType])

  const firstDataMonth = monthsWithData[0]?.month

  return (
    <section className="data-dashboard-page">
      <style>{`
        .data-dashboard-tabs {
          display: flex;
          gap: 4px;
          border-bottom: 1px solid #dfe5ec;
          margin-bottom: 18px;
        }

        .data-dashboard-tab {
          border: 0;
          border-bottom: 2px solid transparent;
          background: transparent;
          color: #64748b;
          padding: 10px 15px;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          margin-bottom: -1px;
        }

        .data-dashboard-tab.active {
          color: #0877bd;
          border-bottom-color: #0877bd;
        }

        .pronto-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-bottom: 14px;
        }

        .pronto-search {
          width: 270px;
          height: 36px;
          border: 1px solid #d7dee7;
          border-radius: 8px;
          background: #fff;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 11px;
          box-sizing: border-box;
        }

        .pronto-search input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          font: inherit;
          font-size: 12px;
          color: #172033;
        }

        .pronto-table-card {
          background: #fff;
          border: 1px solid #dfe5ec;
          border-radius: 12px;
          overflow: hidden;
        }

        .pronto-table {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
          font-size: 12px;
        }

        .pronto-tree-table {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
          font-size: 12px;
        }

        .pronto-tree-table.pronto-hide-deal-info thead tr:not(.pronto-group-header) th:nth-child(13),
        .pronto-tree-table.pronto-hide-deal-info tbody td:nth-child(13),
        .pronto-tree-table.pronto-hide-deal-info thead tr:not(.pronto-group-header) th:nth-child(14),
        .pronto-tree-table.pronto-hide-deal-info tbody td:nth-child(14) { display: none; }
        .pronto-group-toggle { display: block; width: 100%; padding: 0; border: 0; background: transparent; color: inherit; text-align: left; font: inherit; font-weight: 700; cursor: pointer; }
        .pronto-tree-table.pronto-hide-date-status thead tr:not(.pronto-group-header) th:nth-child(2),
        .pronto-tree-table.pronto-hide-date-status tbody td:nth-child(2),
        .pronto-tree-table.pronto-hide-date-status thead tr:not(.pronto-group-header) th:nth-child(3),
        .pronto-tree-table.pronto-hide-date-status tbody td:nth-child(3),
        .pronto-tree-table.pronto-hide-date-status thead tr:not(.pronto-group-header) th:nth-child(4),
        .pronto-tree-table.pronto-hide-date-status tbody td:nth-child(4) { display: none; }
        .pronto-column-controls { display: flex; justify-content: flex-end; padding: 8px 12px; border-bottom: 1px solid #e5eaf0; background: #fff; }
        .pronto-column-toggle { border: 1px solid #cbd5e1; border-radius: 7px; padding: 6px 10px; background: #fff; color: #24364b; font-size: 12px; font-weight: 600; cursor: pointer; }
        .pronto-tree-table { min-width: 1500px; }
        .pronto-tree-table col.pronto-col-name { width: 22%; }
        .pronto-tree-table col.pronto-col-first { width: 8%; }
        .pronto-tree-table col.pronto-col-latest { width: 8%; }
        .pronto-tree-table col.pronto-col-status { width: 5%; }
        .pronto-tree-table col.pronto-col-leads { width: 5%; }
        .pronto-tree-table col.pronto-col-booked { width: 4%; }
        .pronto-tree-table col.pronto-col-conversion { width: 6%; }
        .pronto-tree-table col.pronto-col-net-value { width: 10%; }
        .pronto-tree-table col.pronto-col-booked-percent { width: 6%; }
        .pronto-tree-table col.pronto-col-spacer { width: 2%; }
        .pronto-tree-table th:nth-child(13),
        .pronto-tree-table td:nth-child(13),
        .pronto-tree-table th:nth-child(14),
        .pronto-tree-table td:nth-child(14) { white-space: nowrap; text-align: right; }
        .pronto-deal-info-header { text-align: center; border-left: 1px solid #4d6785; border-right: 1px solid #4d6785; }
        .pronto-tree-table th:nth-last-child(4),
        .pronto-tree-table td:nth-last-child(4),
        .pronto-tree-table th:nth-last-child(3),
        .pronto-tree-table td:nth-last-child(3) { white-space: nowrap; text-align: right; }

        .pronto-tree-toggle {
          border: 0;
          background: transparent;
          color: inherit;
          font: inherit;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          text-align: left;
          max-width: 100%;
        }

        .pronto-tree-leaf {
          display: inline-block;
          overflow-wrap: anywhere;
        }

        .pronto-sort-header {
          border: 0;
          padding: 0;
          margin: 0;
          background: transparent;
          color: inherit;
          font: inherit;
          font-weight: 700;
          text-align: left;
          cursor: pointer;
          white-space: nowrap;
        }
        .pronto-sort-header:hover { text-decoration: underline; }
        .pronto-sort-header:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; border-radius: 2px; }

        .pronto-tree-table td {
          padding: 10px 13px;
          line-height: 1.3;
          vertical-align: middle;
          border-bottom: 1px solid #e8edf3;
        }

        .pronto-tree-introducer td { background: #f8fafc; font-weight: 600; }
        .pronto-tree-sid td { background: #eef4fb; }
        .pronto-tree-c1 td { background: #ffffff; }
        .pronto-tree-c3 td { background: #ffffff; color: #243449; }
        .pronto-rate-low { color: #dc2626 !important; font-weight: 700; }
        .pronto-rate-normal { color: inherit; }
        .pronto-tree-loading td { background: #f8fafc; color: #64748b; padding: 12px 16px; }
        .pronto-tree-total td { background: #f8fafc; font-weight: 700; border-top: 1px solid #d7e0ea; }

        .pronto-table th {
          background: #17365d;
          color: #ffffff;
          text-align: left;
          font-weight: 700;
          padding: 11px 13px;
          border-bottom: 1px solid #dfe5ec;
        }

        .pronto-repeated-header th {
          background: #17365d;
          color: #ffffff;
          text-align: left;
          font-weight: 700;
          padding: 11px 12px;
          border-bottom: 1px solid #244a75;
        }

        .pronto-table th:last-child,
        .pronto-table td:last-child {
          text-align: left;
        }

        .pronto-table th,
        .pronto-table td {
          text-align: left !important;
        }

        .pronto-table td[colspan] {
          text-align: left !important;
        }

        .pronto-table td {
          padding: 10px 13px;
          border-bottom: 1px solid #edf1f5;
          color: #172033;
        }

        .pronto-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .pronto-table td:first-child {
          font-weight: 600;
        }

        .pronto-empty {
          padding: 45px 20px;
          text-align: center;
          color: #64748b;
          font-size: 13px;
        }

        .data-dashboard-page {
          min-height: calc(100vh - 90px);
          padding: 28px 32px 50px;
          background: #f5f7fa;
          color: #172033;
          box-sizing: border-box;
          font-family: Inter, Arial, sans-serif;
        }

        .data-dashboard-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 22px;
        }

        .data-dashboard-eyebrow {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .08em;
          color: #64748b;
          margin-bottom: 7px;
        }

        .data-dashboard-head h1 {
          margin: 0;
          font-size: 30px;
          line-height: 1.1;
          color: #0f172a;
        }

        .data-dashboard-head p {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .data-dashboard-refresh {
          height: 36px;
          padding: 0 13px;
          border: 1px solid #d7dee7;
          border-radius: 8px;
          background: #fff;
          color: #334155;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font: inherit;
          font-size: 12px;
          cursor: pointer;
        }

        .data-dashboard-refresh:disabled {
          opacity: .6;
          cursor: default;
        }

        .data-dashboard-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 16px;
        }

        .data-dashboard-card {
          background: #fff;
          border: 1px solid #dfe5ec;
          border-radius: 12px;
          padding: 17px 18px;
          box-sizing: border-box;
        }

        .data-dashboard-card-label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .06em;
          color: #7b8797;
        }

        .data-dashboard-card-value {
          margin-top: 7px;
          font-size: 25px;
          font-weight: 750;
          color: #0f172a;
        }

        .data-dashboard-card-note {
          margin-top: 4px;
          font-size: 11px;
          color: #64748b;
        }

        .data-dashboard-stage-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 12px;
        }

        .data-dashboard-stage-panel {
          border: 1px solid #e5eaf0;
          border-radius: 10px;
          padding: 12px 12px 6px;
          background: #fff;
          min-width: 0;
        }

        .data-dashboard-stage-panel h3 {
          margin: 0 0 2px;
          font-size: 13px;
          font-weight: 750;
          color: #172033;
        }

        .data-dashboard-stage-panel p {
          margin: 0 0 6px;
          font-size: 11px;
          color: #64748b;
        }

        .data-dashboard-chart-card {
          background: #fff;
          border: 1px solid #dfe5ec;
          border-radius: 12px;
          padding: 20px 18px 14px;
          box-sizing: border-box;
        }

        .data-dashboard-chart-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
          margin-bottom: 12px;
        }

        .data-dashboard-chart-title {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 15px;
          font-weight: 750;
          color: #0f172a;
        }

        .data-dashboard-chart-subtitle {
          margin: 5px 0 0;
          font-size: 11px;
          color: #64748b;
        }

        .data-dashboard-status {
          font-size: 11px;
          color: #64748b;
          white-space: nowrap;
        }

        .data-dashboard-error {
          padding: 13px 15px;
          margin-bottom: 16px;
          border: 1px solid #fecaca;
          background: #fff1f2;
          color: #b91c1c;
          border-radius: 9px;
          font-size: 12px;
        }

        .data-dashboard-empty {
          height: 430px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          font-size: 13px;
        }

        @media (max-width: 800px) {
          .data-dashboard-page {
            padding: 22px 16px 35px;
          }

          .data-dashboard-grid {
            grid-template-columns: 1fr;
          }

          .data-dashboard-head {
            align-items: flex-start;
          }

          .data-dashboard-head h1 {
            font-size: 26px;
          }

          .data-dashboard-status {
            display: none;
          }
        }
      `}</style>

      <div className="data-dashboard-head">
        <div>
          <div className="data-dashboard-eyebrow">
            Head Office
          </div>

          <h1>Data Dashboard</h1>

          <p>
            <span style={{ color: "#dc2626" }}>This is not all leads, still have to move more over</span>
          </p>
        </div>

        <button
          type="button"
          className="data-dashboard-refresh"
          onClick={loadData}
          disabled={loading}
        >
          <RefreshCw
            size={14}
            className={loading ? "spin" : ""}
          />

          Refresh
        </button>
      </div>

      <div className="data-dashboard-tabs">
        <button
          type="button"
          className={`data-dashboard-tab ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`data-dashboard-tab ${activeTab === "pronto" ? "active" : ""}`}
          onClick={() => setActiveTab("pronto")}
        >
          Pronto
        </button>
        <button
          type="button"
          className={`data-dashboard-tab ${activeTab === "map-appointments" ? "active" : ""}`}
          onClick={() => setActiveTab("map-appointments")}
        >
          Map of Appointments
        </button>
        <button
          type="button"
          className={`data-dashboard-tab ${activeTab === "archived-leads" ? "active" : ""}`}
          onClick={() => { setArchivedLeadsPage(0); setActiveTab("archived-leads") }}
        >
          Archived Leads
        </button>
        <button
          type="button"
          className={`data-dashboard-tab ${activeTab === "kanban" ? "active" : ""}`}
          onClick={() => setActiveTab("kanban")}
        >
          Kanban
        </button>
      </div>

      {error && activeTab === "overview" && (
        <div className="data-dashboard-error">
          {error}
        </div>
      )}

      {activeTab === "overview" ? (
        <>
      <div className="data-dashboard-chart-card">
        <div className="data-dashboard-chart-head">
          <div>
            <div className="data-dashboard-chart-title">
              <BarChart3 size={17} />
              Lead volume by type
            </div>

            <div className="data-dashboard-chart-subtitle">
              {firstDataMonth
                ? `CRM lead records currently begin ${formatMonth(
                    firstDataMonth
                  )}.`
                : "Lead records from January 2026 onwards, grouped by the selected period."}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <label htmlFor="lead-volume-period" style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Period</label>
            <select id="lead-volume-period" value={chartPeriod} onChange={(event) => setChartPeriod(event.target.value)} style={{ minWidth: 120, padding: "8px 10px", border: "1px solid #dfe5ec", borderRadius: 8, background: "#fff", color: "#334155", fontSize: 12 }}>
              <option value="week">Week</option><option value="month">Month</option><option value="quarter">Quarter</option><option value="year">Year</option>
            </select>
            <label htmlFor="lead-volume-type" style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Type</label>
            <select id="lead-volume-type" value={selectedLeadType} onChange={(event) => setSelectedLeadType(event.target.value)} style={{ minWidth: 150, padding: "8px 10px", border: "1px solid #dfe5ec", borderRadius: 8, background: "#fff", color: "#334155", fontSize: 12 }}>
              <option value="">All types</option>
              {[...typeNames].sort().map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <label htmlFor="lead-volume-source" style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Lead source</label>
            <select
              id="lead-volume-source"
              value={selectedLeadSource}
              onChange={(event) => setSelectedLeadSource(event.target.value)}
              disabled={leadSourcesLoading}
              style={{ minWidth: 210, maxWidth: "100%", padding: "8px 10px", border: "1px solid #dfe5ec", borderRadius: 8, background: "#fff", color: "#334155", fontSize: 12 }}
            >
              <option value="">All lead sources</option>
              {leadSources.map((source) => (
                <option key={source.value || "__NO_SOURCE__"} value={source.value}>{source.label} ({formatNumber(source.count)})</option>
              ))}
            </select>
            <div className="data-dashboard-status">
              {loading ? "Loading…" : `${formatNumber(totalLeads)} leads`}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="data-dashboard-empty">
            Loading lead volume…
          </div>
        ) : rows.length === 0 ? (
          <div className="data-dashboard-empty">
            <TrendingUp size={18} style={{ marginRight: 8 }} />
            No lead data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={430}>
            <ComposedChart data={rows} margin={{ top: 10, right: 18, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#e8edf3" vertical={false} />
              <XAxis dataKey="month" tickFormatter={(value) => rows.find((row) => row.month === value)?.period_label || value} interval={chartPeriod === "week" ? 3 : 0} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#dfe5ec" }} tickLine={false} />
              <YAxis yAxisId="leads" tickFormatter={formatNumber} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={55} /><YAxis yAxisId="conversion" orientation="right" domain={[0, (dataMax) => Math.max(5, Math.ceil(dataMax / 5) * 5)]} tickFormatter={value => `${Number(value).toFixed(0)}%`} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={48} />
              <Tooltip
                content={({ active, payload, label }) => {
                  const visibleItems = (payload || []).filter(
                    (item) => ["cps_h_pct", "cps_c_pct", "cps_p_pct", "cps_s_pct"].includes(item.dataKey) || (!String(item.dataKey).endsWith("_pct") && Number(item.value || 0) >= 1)
                  )
                  if (!active || visibleItems.length === 0) return null
                  const countKeyByPct = { cps_h_pct: "cps_h_count", cps_c_pct: "cps_c_count", cps_p_pct: "cps_p_count", cps_s_pct: "cps_s_count" }
                  return (
                    <div style={{ background: "#fff", border: "1px solid #dfe5ec", borderRadius: 8, padding: "10px 12px", fontSize: 12, boxShadow: "0 5px 18px rgba(15,23,42,.08)" }}>
                      <div style={{ marginBottom: 7, color: "#0f172a", fontWeight: 600 }}>{formatMonth(label)}</div>
                      {visibleItems.map((item) => {
                        const countKey = countKeyByPct[item.dataKey]
                        const count = countKey ? Number(item.payload?.[countKey] || 0) : Number(item.value || 0)
                        const displayName = item.name.replace(" percentage", " count")
                        const valueText = countKey ? `${formatNumber(count)} (${Number(item.value || 0).toFixed(1)}%)` : formatNumber(item.value)
                        return (
                          <div key={item.dataKey} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, color: item.color || "#334155" }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color || "#334155", flexShrink: 0 }} />
                            <span>{displayName}: {valueText}</span>
                          </div>
                        )
                      })}
                    </div>
                  )
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              {[...typeNames].filter((type) => !selectedLeadType || type === selectedLeadType).sort((a, b) => {
                const stackPriority = (type) => {
                  if (type === "Windows") return 0
                  if (type === "Solar") return 1
                  if (type === "Air Source Heat Pump") return 2
                  return 3
                }
                return stackPriority(a) - stackPriority(b) || typeNames.indexOf(a) - typeNames.indexOf(b)
              }).map((type) => (
                <Bar
                  key={type}
                  dataKey={type}
                  name={type}
                  yAxisId="leads"
                  stackId="leads"
                  fill={LEAD_TYPE_COLORS[typeNames.indexOf(type) % LEAD_TYPE_COLORS.length]}
                />
              ))}
            <Line yAxisId="conversion" type="monotone" dataKey="cps_h_pct" name="CPS H percentage" stroke="#111827" strokeWidth={2.5} dot={false} connectNulls />
            <Line yAxisId="conversion" type="monotone" dataKey="cps_c_pct" name="CPS C percentage" stroke="#dc2626" strokeWidth={2.5} dot={false} connectNulls />
            <Line yAxisId="conversion" type="monotone" dataKey="cps_p_pct" name="CPS P percentage" stroke="#7c3aed" strokeWidth={2.5} dot={false} connectNulls />
            <Line yAxisId="conversion" type="monotone" dataKey="cps_s_pct" name="CPS S percentage" stroke="#0d9488" strokeWidth={2.5} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

        </>
      ) : activeTab === "pronto" ? (
        <>
          <div className="pronto-toolbar">
            <div>
              <div className="data-dashboard-chart-title">Pronto Introducer Lead Counts</div>
              <div className="data-dashboard-chart-subtitle">
                Lead counts and campaign activity for the selected period.
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 10 }}>
              <select
                aria-label="Filter Pronto leads by date"
                value={prontoDatePeriod}
                onChange={(event) => {
                  const nextPeriod = event.target.value
                  setProntoDatePeriod(nextPeriod)
                  // Clear every cached drilldown so child counts are reloaded for the selected period.
                  setIntroducerSidRows({})
                  setIntroducerSidLoading({})
                  setIntroducerC1Rows({})
                  setIntroducerC1Loading({})
                  setIntroducerC3Rows({})
                  setIntroducerC3Loading({})
                  setExpandedIntroducers({})
                  setExpandedProntoSids({})
                  setExpandedIntroducerC1s({})
                  setProntoC3Rows({})
                  setProntoC3Loading({})
                  setExpandedProntoC1s({})
                  setProntoC1C3Rows({})
                  setProntoC1C3Loading({})
                }}
                style={{ height: 36, padding: "0 10px", border: "1px solid #d7dee7", borderRadius: 8, background: "#fff", color: "#172033", font: "inherit", fontSize: 12 }}
              >
                <option value="this_week">This Week</option>
                <option value="last_week">Last Week</option>
                <option value="last_4_weeks">Last 4 Weeks</option>
                <option value="year_to_date">Year To Date</option>
                <option value="all_time">All Time</option>
              </select>
              <select
                aria-label="Filter Pronto campaigns by status"
                value={prontoStatusFilter}
                onChange={(event) => setProntoStatusFilter(event.target.value)}
                style={{ height: 36, padding: "0 10px", border: "1px solid #d7dee7", borderRadius: 8, background: "#fff", color: "#172033", font: "inherit", fontSize: 12 }}
              >
                <option value="all">All Statuses</option>
                <option value="live">Live</option>
                <option value="off">Off</option>
              </select>
              <div className="pronto-search">
                <Search size={14} color="#64748b" />
                <input
                  type="text"
                  value={prontoSidSearch}
                  onChange={(event) => setProntoSidSearch(event.target.value)}
                  placeholder="Search introducer"
                />
              </div>              <button
                type="button"
                onClick={exportProntoDrilldown}
                disabled={prontoExporting || prontoSidLoading}
                style={{ height: 36, padding: "0 12px", display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid #17365d", borderRadius: 8, background: prontoExporting ? "#e2e8f0" : "#17365d", color: prontoExporting ? "#64748b" : "#fff", font: "inherit", fontSize: 12, fontWeight: 600, cursor: prontoExporting ? "wait" : "pointer", whiteSpace: "nowrap" }}
              >
                <FileSpreadsheet size={14} />
                {prontoExporting ? "Exporting…" : "Export drilldown"}
              </button>
            </div>
          </div>

          {prontoSidError && (
            <div className="data-dashboard-error">{prontoSidError}</div>
          )}

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:12, marginTop:18 }}>
            {[
              ["Total leads", formatNumber(prontoDashboardStats.leads), "Selected period"],
              ["Booked", formatNumber(prontoDashboardStats.booked), prontoDashboardStats.bookedRate.toFixed(1) + "% of leads"],
              ["Net value sold", "£" + formatNumber(prontoDashboardStats.netValue), "Linked sold deals"],
              ["Value per lead", "£" + prontoDashboardStats.valuePerLead.toFixed(2), "Net value ÷ leads"],
              ["Cost per lead", "Not configured", "Placeholder — add campaign spend"],
              ["Cost per sale", "Not configured", "Placeholder — add campaign spend"],
              ["Return on lead spend", "Not configured", "Placeholder — add campaign spend"]
            ].map(([label,value,sub]) => <div key={label} style={{ background:"#fff",border:"1px solid #dbe3ed",borderRadius:12,padding:14 }}>
              <div style={{ color:"#64748b",fontSize:12 }}>{label}</div><div style={{ fontSize:23,fontWeight:700,color:"#17365d",marginTop:5 }}>{value}</div><div style={{ color:"#64748b",fontSize:11,marginTop:4 }}>{sub}</div>
            </div>)}
          </div>
          <div style={{ marginTop:14, display:"grid", gridTemplateColumns:"minmax(0,1.5fr) minmax(260px,1fr)", gap:14 }}>
            <div style={{ background:"#fff",border:"1px solid #dbe3ed",borderRadius:12,padding:16 }}>
              <div className="data-dashboard-chart-title">Appointment conversion funnel</div>
              <div className="data-dashboard-chart-subtitle">Shows how total leads progress through CPS H, C, P and S. Each stage count is shown as a percentage of total leads; stage counts can overlap.</div>
              {[
                ["Leads",prontoDashboardStats.leads,100],
                ["H · Generated",prontoDashboardStats.h,prontoDashboardStats.leads ? prontoDashboardStats.h/prontoDashboardStats.leads*100 : 0],
                ["C · Confirmed",prontoDashboardStats.confirmed,prontoDashboardStats.leads ? prontoDashboardStats.confirmed/prontoDashboardStats.leads*100 : 0],
                ["P · Pitched",prontoDashboardStats.pitched,prontoDashboardStats.leads ? prontoDashboardStats.pitched/prontoDashboardStats.leads*100 : 0],
                ["S · Sold",prontoDashboardStats.sold,prontoDashboardStats.leads ? prontoDashboardStats.sold/prontoDashboardStats.leads*100 : 0]
              ].map(([label,count,pct]) => <div key={label} style={{ marginTop:12 }}>
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4 }}><span>{label}</span><strong>{formatNumber(count)} · {Number(pct).toFixed(1)}% of leads</strong></div>
                <div style={{ height:9,background:"#e8eef5",borderRadius:8,overflow:"hidden" }}><div style={{ height:"100%",width:Math.min(100,Math.max(0,Number(pct)))+"%",background:label === "Leads" ? "#64748b" : "#3478c8",borderRadius:8 }} /></div>
              </div>)}
              <div style={{ display:"flex",gap:14,flexWrap:"wrap",marginTop:12,color:"#64748b",fontSize:11 }}>
                <span>Lead→H: {prontoDashboardStats.leads ? (prontoDashboardStats.h/prontoDashboardStats.leads*100).toFixed(1) : "0.0"}%</span><span>Lead→C: {prontoDashboardStats.leads ? (prontoDashboardStats.confirmed/prontoDashboardStats.leads*100).toFixed(1) : "0.0"}%</span><span>Lead→P: {prontoDashboardStats.leads ? (prontoDashboardStats.pitched/prontoDashboardStats.leads*100).toFixed(1) : "0.0"}%</span><span>Lead→S: {prontoDashboardStats.leads ? (prontoDashboardStats.sold/prontoDashboardStats.leads*100).toFixed(1) : "0.0"}%</span>
              </div>
              <div style={{ display:"flex",gap:14,flexWrap:"wrap",marginTop:6,color:"#64748b",fontSize:11 }}>
                <span>H→C: {prontoDashboardStats.hToC.toFixed(1)}%</span><span>C→P: {prontoDashboardStats.cToP.toFixed(1)}%</span><span>P→S: {prontoDashboardStats.pToS.toFixed(1)}%</span><span>H→S: {prontoDashboardStats.hToS.toFixed(1)}%</span>
              </div>
            </div>
            <div style={{ background:"#fff",border:"1px solid #dbe3ed",borderRadius:12,padding:16 }}>
              <div className="data-dashboard-chart-title">Appointment pipeline</div>
              <div className="data-dashboard-chart-subtitle">Related appointment rows for the currently loaded lead list ({formatNumber(prontoLeadDetails.length)} leads).</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:14 }}>
                <div style={{ background:"#f8fafc",borderRadius:8,padding:12 }}><div style={{ color:"#64748b",fontSize:11 }}>Past appointments</div><strong style={{fontSize:22}}>{formatNumber(prontoLeadDetails.flatMap(l=>l.relatedAppointments || []).filter(a=>a.appointment_date && new Date(a.appointment_date)<new Date(new Date().setHours(0,0,0,0))).length)}</strong></div>
                <div style={{ background:"#f8fafc",borderRadius:8,padding:12 }}><div style={{ color:"#64748b",fontSize:11 }}>Today & forward</div><strong style={{fontSize:22}}>{formatNumber(prontoLeadDetails.flatMap(l=>l.relatedAppointments || []).filter(a=>a.appointment_date && new Date(a.appointment_date)>=new Date(new Date().setHours(0,0,0,0))).length)}</strong></div>
              </div>
              <div style={{ color:"#64748b",fontSize:11,marginTop:10 }}>Appointment totals reflect loaded leads only; full-period aggregation is a placeholder.</div>
            </div>
          </div>
          <div style={{ marginTop: 24, background: "#fff", border: "1px solid #dbe3ed", borderRadius: 12, padding: 16, minWidth: 0 }}>
            <div className="data-dashboard-chart-title">Monthly lead volume and booking rate by introducer</div>
            <div className="data-dashboard-chart-subtitle">Bars show leads received (left axis); lines show booking rate (right axis).</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "12px 0" }}>
              <button type="button" onClick={() => setShowProntoVolumeBars((visible) => !visible)} aria-pressed={showProntoVolumeBars} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "7px 12px", background: showProntoVolumeBars ? "#19385f" : "#fff", color: showProntoVolumeBars ? "#fff" : "#19385f", cursor: "pointer", fontSize: 13 }}>
                {showProntoVolumeBars ? "Hide volume bars" : "Show volume bars"}
              </button>
              <button type="button" onClick={() => setShowProntoBookingLines((visible) => !visible)} aria-pressed={showProntoBookingLines} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "7px 12px", background: showProntoBookingLines ? "#19385f" : "#fff", color: showProntoBookingLines ? "#fff" : "#19385f", cursor: "pointer", fontSize: 13 }}>
                {showProntoBookingLines ? "Hide booking lines" : "Show booking lines"}
              </button>
            </div>
            {prontoMonthlyLoading ? <p>Loading monthly trends…</p> : prontoMonthlyError ? <p style={{ color: "#dc2626" }}>{prontoMonthlyError}</p> : <ResponsiveContainer width="100%" height={380}>
              <ComposedChart data={prontoMonthlyChartData} margin={{ top: 12, right: 18, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="volume" orientation="left" allowDecimals={false} />
                <YAxis yAxisId="rate" orientation="right" domain={[0, prontoMonthlyMaxRate]} ticks={Array.from({ length: prontoMonthlyMaxRate / 10 + 1 }, (_, index) => index * 10)} tickFormatter={(value) => value + "%"} />
                <Tooltip formatter={(value, name) => String(name).endsWith("__rate") ? (value == null ? "No leads" : Number(value).toFixed(1) + "%") : Number(value).toLocaleString()} />
                <Legend content={() => (
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px 14px", paddingTop: 8 }}>
                    {prontoTrendIntroducers.map((name, index) => (
                      <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: LEAD_TYPE_COLORS[index % LEAD_TYPE_COLORS.length], fontSize: 12, whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-block", width: 12, height: 8, background: LEAD_TYPE_COLORS[index % LEAD_TYPE_COLORS.length], opacity: 0.6, borderRadius: 2 }} />
                        <span style={{ display: "inline-block", width: 14, borderTop: "2px solid " + LEAD_TYPE_COLORS[index % LEAD_TYPE_COLORS.length] }} />
                        {name}
                      </span>
                    ))}
                  </div>
                )} />
                {showProntoVolumeBars && prontoTrendIntroducers.map((name, index) => <Bar key={name + "-volume"} yAxisId="volume" stackId="monthly-leads" dataKey={name + "__leads"} name={name + " volume"} fill={LEAD_TYPE_COLORS[index % LEAD_TYPE_COLORS.length]} fillOpacity={0.55} />)}
                {showProntoBookingLines && prontoTrendIntroducers.map((name, index) => <Line key={name + "-rate"} yAxisId="rate" type="monotone" dataKey={name + "__rate"} name={name + " booking %"} stroke={LEAD_TYPE_COLORS[index % LEAD_TYPE_COLORS.length]} strokeWidth={2} dot={false} connectNulls={false} />)}
              </ComposedChart>
            </ResponsiveContainer>}
          </div>

          <div style={{ marginTop:14,background:"#fff",border:"1px solid #dbe3ed",borderRadius:12,padding:16 }}>
            <div className="data-dashboard-chart-title">Sales value by month</div>
            <div className="data-dashboard-chart-subtitle">Monthly sales value needs a confirmed deal close-date field. Until then, the monthly chart is a placeholder.</div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginTop:12 }}>
              <div style={{ border:"1px dashed #cbd5e1",borderRadius:8,padding:12,color:"#64748b" }}>Monthly net value sold<br/><strong>Awaiting deal close date</strong></div>
              <div style={{ border:"1px dashed #cbd5e1",borderRadius:8,padding:12,color:"#64748b" }}>Average value per sold deal<br/><strong>Awaiting reliable deal count</strong></div>
              <div style={{ border:"1px dashed #cbd5e1",borderRadius:8,padding:12,color:"#64748b" }}>Sold appointments without linked deal<br/><strong>Reconciliation metric to be added</strong></div>
            </div>
          </div>

          <div className="pronto-table-card">
            {prontoSidLoading ? (
              <div className="pronto-empty">Loading Pronto SID data…</div>
            ) : filteredProntoSidRows.length === 0 ? (
              <div className="pronto-empty">No Pronto SID data found.</div>
            ) : (
              <>
              <table className={`pronto-table pronto-tree-table${showProntoDateStatusColumns ? "" : " pronto-hide-date-status"}${showProntoDealInfoColumns ? "" : " pronto-hide-deal-info"}`}>
                <colgroup>
                  <col className="pronto-col-name" />
                  <col className="pronto-col-first" />
                  <col className="pronto-col-latest" />
                  <col className="pronto-col-status" />
                  <col className="pronto-col-leads" />
                  <col className="pronto-col-booked" />
                  <col className="pronto-col-booked" />
                  <col className="pronto-col-booked" />
                  <col className="pronto-col-booked" />
                  <col className="pronto-col-booked" />
                  <col className="pronto-col-conversion" />
                  <col className="pronto-col-conversion" />
                  <col className="pronto-col-net-value" />
                  <col className="pronto-col-net-value" />
                  <col className="pronto-col-booked-percent" />
                  <col className="pronto-col-spacer" />
                </colgroup>
                <thead>
                  <tr className="pronto-group-header">
                    <th></th>
                    <th colSpan={3} className="pronto-deal-info-header">
                      <button type="button" className="pronto-group-toggle" onClick={() => setShowProntoDateStatusColumns((shown) => !shown)} aria-expanded={showProntoDateStatusColumns}>Dates &amp; Status {showProntoDateStatusColumns ? "−" : "+"}</button>
                    </th>
                    <th colSpan={8}></th>
                    <th colSpan={2} className="pronto-deal-info-header">
                      <button type="button" className="pronto-group-toggle" onClick={() => setShowProntoDealInfoColumns((shown) => !shown)} aria-expanded={showProntoDealInfoColumns}>Deal Info {showProntoDealInfoColumns ? "−" : "+"}</button>
                    </th>
                    <th colSpan={2}></th>
                  </tr>
                  <tr>
                    <th><button type="button" className="pronto-sort-header" onClick={() => changeProntoSort("name")}>Introducer / Campaign{prontoSort.key === "name" ? (prontoSort.direction === "asc" ? " ↑" : " ↓") : ""}</button></th>
                    <th><button type="button" className="pronto-sort-header" onClick={() => changeProntoSort("first_lead_date")}>First received{prontoSort.key === "first_lead_date" ? (prontoSort.direction === "asc" ? " ↑" : " ↓") : ""}</button></th>
                    <th><button type="button" className="pronto-sort-header" onClick={() => changeProntoSort("latest_lead_date")}>Latest received{prontoSort.key === "latest_lead_date" ? (prontoSort.direction === "asc" ? " ↑" : " ↓") : ""}</button></th>
                    <th><button type="button" className="pronto-sort-header" onClick={() => changeProntoSort("status")}>Status{prontoSort.key === "status" ? (prontoSort.direction === "asc" ? " ↑" : " ↓") : ""}</button></th>
                    <th><button type="button" className="pronto-sort-header" onClick={() => changeProntoSort("leads")}>Leads{prontoSort.key === "leads" ? (prontoSort.direction === "asc" ? " ↑" : " ↓") : ""}</button></th>
                    <th><button type="button" className="pronto-sort-header" onClick={() => changeProntoSort("booked")}>Booked{prontoSort.key === "booked" ? (prontoSort.direction === "asc" ? " ↑" : " ↓") : ""}</button></th>
                    <th>CPS H</th>
                    <th>CPS C</th>
                    <th>CPS P</th>
                    <th>CPS S</th>
                    <th>Lead to H</th>
                    <th>Lead to P</th>
                    <th>Net Value Sold</th>
                    <th>Net Value Solid</th>
                    <th><button type="button" className="pronto-sort-header" onClick={() => changeProntoSort("booked_rate")}>Booked %{prontoSort.key === "booked_rate" ? (prontoSort.direction === "asc" ? " ↑" : " ↓") : ""}</button></th>
                    <th aria-label="Alignment spacer"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProntoSidRows.map((row) => (
                    <React.Fragment key={row.pronto_sid}>
                      <tr className="pronto-tree-introducer">
                        <td>
                          <button type="button" onClick={() => toggleIntroducer(row.pronto_sid)} aria-expanded={Boolean(expandedIntroducers[row.pronto_sid])} className="pronto-tree-toggle" style={{ paddingLeft: 4 }}>
                            <span aria-hidden="true">{expandedIntroducers[row.pronto_sid] ? "▾" : "▸"}</span>{row.pronto_sid}
                          </button>
                        </td>
                        <td>{formatProntoDate(row.first_lead_date)}</td>
                        <td>{formatProntoDate(row.latest_lead_date)}</td>
                        <td>{prontoStatus(row.latest_lead_date)}</td>
                        <td>{formatNumber(row.lead_count)}</td>
                        <td>{formatNumber(row.booked_count)}</td>
                        <td>{formatNumber(row.cps_h_count)}</td>
                        <td>{formatNumber(row.cps_c_count)}</td>
                        <td>{formatNumber(row.cps_p_count)}</td>
                        <td>{formatNumber(row.cps_s_count)}</td>
                        <td>{row.lead_count ? `${(row.cps_h_count / row.lead_count * 100).toFixed(1)}%` : "0.0%"}</td>
                        <td>{row.lead_count ? `${(row.cps_p_count / row.lead_count * 100).toFixed(1)}%` : "0.0%"}</td>
                        <td>£{formatNumber(row.net_value_sold)}</td>
                        <td>£{formatNumber(row.net_value_solid)}</td>
                        <td className={row.lead_count && (row.booked_count / row.lead_count) * 100 < 15 ? "pronto-rate-low" : "pronto-rate-normal"}>{row.lead_count ? `${((row.booked_count / row.lead_count) * 100).toFixed(1)}%` : "0.0%"}</td>
                        <td aria-hidden="true"></td>
                      </tr>
                      {expandedIntroducers[row.pronto_sid] && (
                        introducerSidLoading[row.pronto_sid] ? (
                          <tr className="pronto-tree-loading"><td colSpan={10}>Loading SID breakdown…</td></tr>
                        ) : sortProntoRows(introducerSidRows[row.pronto_sid] || []).map((sidRow) => {
                          const sidKey = JSON.stringify([row.pronto_sid, sidRow.pronto_sid]);
                          const sidExpanded = Boolean(expandedProntoSids[sidKey]);
                          const c1Rows = introducerC1Rows[sidKey] || [];
                          return (
                            <React.Fragment key={sidKey}>
                              <tr className="pronto-tree-sid">
                                <td>
                                  <button type="button" onClick={() => toggleIntroducerSid(row.pronto_sid, sidRow.pronto_sid)} aria-expanded={sidExpanded} className="pronto-tree-toggle" style={{ paddingLeft: 22 }}>
                                    <span aria-hidden="true">{sidExpanded ? "▾" : "▸"}</span>{sidRow.pronto_sid}
                                  </button>
                                </td>
                                <td>{formatProntoDate(sidRow.first_lead_date)}</td>
                                <td>{formatProntoDate(sidRow.latest_lead_date)}</td>
                                <td>{prontoStatus(sidRow.latest_lead_date)}</td>
                                <td>{formatNumber(sidRow.lead_count)}</td>
                                <td>{formatNumber(sidRow.booked_count)}</td>
                                <td>{formatNumber(sidRow.cps_h_count)}</td>
                                <td>{formatNumber(sidRow.cps_c_count)}</td>
                                <td>{formatNumber(sidRow.cps_p_count)}</td>
                                <td>{formatNumber(sidRow.cps_s_count)}</td>
                                <td>{sidRow.lead_count ? `${(sidRow.cps_h_count / sidRow.lead_count * 100).toFixed(1)}%` : "0.0%"}</td>
                                <td>{sidRow.lead_count ? `${(sidRow.cps_p_count / sidRow.lead_count * 100).toFixed(1)}%` : "0.0%"}</td>
                                <td>£{formatNumber(sidRow.net_value_sold)}</td>
                                <td>£{formatNumber(sidRow.net_value_solid)}</td>
                                <td className={sidRow.lead_count && (sidRow.booked_count / sidRow.lead_count) * 100 < 15 ? "pronto-rate-low" : "pronto-rate-normal"}>{sidRow.lead_count ? `${((sidRow.booked_count / sidRow.lead_count) * 100).toFixed(1)}%` : "0.0%"}</td>
                                <td aria-hidden="true"></td>
                              </tr>
                              {sidExpanded && (
                                introducerC1Loading[sidKey] ? (
                                  <tr className="pronto-tree-loading"><td colSpan={10}>Loading C1 campaigns…</td></tr>
                                ) : sortProntoRows(c1Rows).map((c1Row) => {
                                  const c1Key = JSON.stringify([row.pronto_sid, sidRow.pronto_sid, c1Row.pronto_c1]);
                                  const c1Expanded = Boolean(expandedIntroducerC1s[c1Key]);
                                  const c3Rows = introducerC3Rows[c1Key] || [];
                                  return (
                                    <React.Fragment key={c1Key}>
                                      <tr className="pronto-tree-c1">
                                        <td>
                                          <button type="button" onClick={() => toggleIntroducerC1(row.pronto_sid, sidRow.pronto_sid, c1Row.pronto_c1)} aria-expanded={c1Expanded} className="pronto-tree-toggle" style={{ paddingLeft: 42 }}>
                                            <span aria-hidden="true">{c1Expanded ? "▾" : "▸"}</span>{c1Row.pronto_c1}
                                          </button>
                                        </td>
                                        <td>{formatProntoDate(c1Row.first_lead_date)}</td>
                                        <td>{formatProntoDate(c1Row.latest_lead_date)}</td>
                                        <td>{prontoStatus(c1Row.latest_lead_date)}</td>
                                        <td>{formatNumber(c1Row.lead_count)}</td>
                                        <td>{formatNumber(c1Row.booked_count)}</td>
                                        <td>{formatNumber(c1Row.cps_h_count)}</td>
                                        <td>{formatNumber(c1Row.cps_c_count)}</td>
                                        <td>{formatNumber(c1Row.cps_p_count)}</td>
                                        <td>{formatNumber(c1Row.cps_s_count)}</td>
                                        <td>{c1Row.lead_count ? `${(c1Row.cps_h_count / c1Row.lead_count * 100).toFixed(1)}%` : "0.0%"}</td>
                                        <td>{c1Row.lead_count ? `${(c1Row.cps_p_count / c1Row.lead_count * 100).toFixed(1)}%` : "0.0%"}</td>
                                        <td>£{formatNumber(c1Row.net_value_sold)}</td>
                                        <td>£{formatNumber(c1Row.net_value_solid)}</td>
                                        <td className={c1Row.lead_count && (c1Row.booked_count / c1Row.lead_count) * 100 < 15 ? "pronto-rate-low" : "pronto-rate-normal"}>{c1Row.lead_count ? `${((c1Row.booked_count / c1Row.lead_count) * 100).toFixed(1)}%` : "0.0%"}</td>
                                        <td aria-hidden="true"></td>
                                      </tr>
                                      {c1Expanded && (
                                        introducerC3Loading[c1Key] ? (
                                          <tr className="pronto-tree-loading"><td colSpan={10}>Loading C3 campaigns…</td></tr>
                                        ) : sortProntoRows(c3Rows).map((c3Row) => (
                                          <tr className="pronto-tree-c3" key={c3Row.pronto_c3}>
                                            <td><span className="pronto-tree-leaf" style={{ paddingLeft: 66 }}>{c3Row.pronto_c3}</span></td>
                                            <td>{formatProntoDate(c3Row.first_lead_date)}</td>
                                            <td>{formatProntoDate(c3Row.latest_lead_date)}</td>
                                            <td>{prontoStatus(c3Row.latest_lead_date)}</td>
                                            <td>{formatNumber(c3Row.lead_count)}</td>
                                            <td>{formatNumber(c3Row.booked_count)}</td>
                                            <td>{formatNumber(c3Row.cps_h_count)}</td>
                                        <td>{formatNumber(c3Row.cps_c_count)}</td>
                                        <td>{formatNumber(c3Row.cps_p_count)}</td>
                                        <td>{formatNumber(c3Row.cps_s_count)}</td>
                                        <td>{c3Row.lead_count ? `${(c3Row.cps_h_count / c3Row.lead_count * 100).toFixed(1)}%` : "0.0%"}</td>
                                        <td>{c3Row.lead_count ? `${(c3Row.cps_p_count / c3Row.lead_count * 100).toFixed(1)}%` : "0.0%"}</td>
                                        <td>£{formatNumber(c3Row.net_value_sold)}</td>
                                        <td>£{formatNumber(c3Row.net_value_solid)}</td>
                                        <td className={c3Row.lead_count && (c3Row.booked_count / c3Row.lead_count) * 100 < 15 ? "pronto-rate-low" : "pronto-rate-normal"}>{c3Row.lead_count ? `${((c3Row.booked_count / c3Row.lead_count) * 100).toFixed(1)}%` : "0.0%"}</td>
                                            <td aria-hidden="true"></td>
                                          </tr>
                                        ))
                                      )}
                                    </React.Fragment>
                                  );
                                })
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </React.Fragment>
                  ))}
                  <tr className="pronto-tree-total">
                    <td colSpan={4}><strong>Total Pronto Windows leads</strong></td>
                    <td><strong>{formatNumber(prontoSidTotal)}</strong></td>
                    <td><strong>{formatNumber(prontoSidRows.reduce((sum, row) => sum + row.booked_count, 0))}</strong></td>
                    <td><strong>{formatNumber(prontoSidRows.reduce((sum, row) => sum + row.cps_h_count, 0))}</strong></td>
                    <td><strong>{formatNumber(prontoSidRows.reduce((sum, row) => sum + row.cps_c_count, 0))}</strong></td>
                    <td><strong>{formatNumber(prontoSidRows.reduce((sum, row) => sum + row.cps_p_count, 0))}</strong></td>
                    <td><strong>{formatNumber(prontoSidRows.reduce((sum, row) => sum + row.cps_s_count, 0))}</strong></td>
                    <td><strong>{prontoSidTotal ? `${(prontoSidRows.reduce((sum, row) => sum + row.cps_h_count, 0) / prontoSidTotal * 100).toFixed(1)}%` : "0.0%"}</strong></td>
                    <td><strong>{prontoSidTotal ? `${(prontoSidRows.reduce((sum, row) => sum + row.cps_p_count, 0) / prontoSidTotal * 100).toFixed(1)}%` : "0.0%"}</strong></td>
                    <td><strong>£{formatNumber(filteredProntoSidRows.reduce((sum, row) => sum + row.net_value_sold, 0))}</strong></td>
                    <td><strong>£{formatNumber(filteredProntoSidRows.reduce((sum, row) => sum + row.net_value_solid, 0))}</strong></td>
                    <td><strong>{prontoSidTotal ? `${((prontoSidRows.reduce((sum, row) => sum + row.booked_count, 0) / prontoSidTotal) * 100).toFixed(1)}%` : "0.0%"}</strong></td>
                    <td aria-hidden="true"></td>
                  </tr>
                </tbody>
              </table>
              </>
            )}
          </div>


          <div style={{ marginTop: 24, background: "#fff", border: "1px solid #dbe3ed", borderRadius: 12, padding: 16, minWidth: 0 }}>
            <div className="data-dashboard-chart-title">Pronto leads and related appointments</div>
            <div className="data-dashboard-chart-subtitle">Leads in the selected date period, with their related appointment records listed underneath.</div>
            {prontoLeadDetailsError && <p style={{ color: "#dc2626" }}>{prontoLeadDetailsError}</p>}
            {prontoLeadDetailsLoading ? <p>Loading leads and appointments…</p> : <>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:12}}>
                <input value={prontoLeadSearch} onChange={e=>setProntoLeadSearch(e.target.value)} placeholder="Search lead, postcode, introducer…" style={{height:34,minWidth:220,padding:"0 10px",border:"1px solid #cbd5e1",borderRadius:7}} />
                <select value={prontoLeadDispositionFilter} onChange={e=>setProntoLeadDispositionFilter(e.target.value)} style={{height:34,padding:"0 8px",border:"1px solid #cbd5e1",borderRadius:7}}><option value="all">All dispositions</option>{[...new Set(prontoLeadDetails.map(l=>l.disposition).filter(Boolean))].sort().map(v=><option key={v} value={v}>{v}</option>)}</select>
                <select value={prontoLeadAppointmentFilter} onChange={e=>setProntoLeadAppointmentFilter(e.target.value)} style={{height:34,padding:"0 8px",border:"1px solid #cbd5e1",borderRadius:7}}><option value="all">All appointment dates</option><option value="past">Past</option><option value="forward">Today & forward</option></select>
                <select value={prontoLeadStageFilter} onChange={e=>setProntoLeadStageFilter(e.target.value)} style={{height:34,padding:"0 8px",border:"1px solid #cbd5e1",borderRadius:7}}><option value="all">All CPS stages</option><option value="h">CPS H</option><option value="c">CPS C</option><option value="p">CPS P</option><option value="s">CPS S</option></select>
                <select value={prontoLeadDealFilter} onChange={e=>setProntoLeadDealFilter(e.target.value)} style={{height:34,padding:"0 8px",border:"1px solid #cbd5e1",borderRadius:7}}><option value="all">All deal links</option><option value="yes">Has linked deal</option><option value="no">No linked deal</option></select>
              </div>
              <div style={{color:"#64748b",fontSize:11,marginTop:8}}>Showing {formatNumber(filteredProntoLeadDetails.length)} of {formatNumber(prontoLeadDetails.length)} loaded leads.</div>
              <div style={{ overflowX: "auto", marginTop: 12 }}>
                <table className="pronto-table">
                  <thead><tr><th>Lead</th><th>Postcode</th><th>Introducer</th><th>Disposition</th><th>Received</th><th>Lead appointment date</th><th>Related appointments</th></tr></thead>
                  <tbody>
                    {filteredProntoLeadDetails.map((lead) => <React.Fragment key={lead.marketing_row_id}>
                      <tr>
                        <td><strong>{[lead.first_name,lead.last_name].filter(Boolean).join(" ") || "Unnamed lead"}</strong></td>
                        <td>{lead.postcode || "—"}</td><td>{lead.introducer || "—"}</td><td>{lead.disposition || "—"}</td>
                        <td>{lead.received_date_time ? new Date(lead.received_date_time).toLocaleDateString("en-GB") : "—"}</td>
                        <td>{lead.appointment_date_time || "—"}</td><td>{lead.relatedAppointments.length} appointment{lead.relatedAppointments.length===1?"":"s"}</td>
                      </tr>
                      {lead.relatedAppointments.map((a) => <tr key={a.appointment_row_id} style={{ background:"#f8fafc" }}>
                        <td colSpan={2} style={{ paddingLeft:28 }}><span style={{ color:"#64748b",fontSize:11 }}>↳ Appointment</span><div><strong>{a.name || "Appointment"}</strong></div><div style={{ color:"#64748b",fontSize:10 }}>{a.appointment_row_id}</div></td>
                        <td>{a.appointment_date ? new Date(a.appointment_date).toLocaleString("en-GB") : "No date"}</td>
                        <td>{a.product || a.job_type || "—"}</td><td>{a.result || "—"}</td><td>—</td>
                        <td><div style={{ display:"flex",flexWrap:"wrap",gap:4 }}>{["h","c","p","s"].map((stage) => <span key={stage} style={{ fontSize:10,borderRadius:5,padding:"2px 5px",background:a["cps_"+stage]===true?"#dcfce7":"#e2e8f0",color:a["cps_"+stage]===true?"#166534":"#64748b" }}>{stage.toUpperCase()}: {a["cps_"+stage]===true?"Yes":"No"}</span>)}</div><div style={{ color:"#64748b",fontSize:11 }}>{a.canvasser || a.rep_allocated || ""}</div>
                        {(a.relatedDeals || []).map((d) => <div key={d.id} style={{fontSize:11,color:"#166534"}}>Deal #{d.id}: £{formatNumber(d.net_value)}</div>)}</td>
                      </tr>)}
                    </React.Fragment>)}
                    {!filteredProntoLeadDetails.length && <tr><td colSpan={7}>No leads match these filters.</td></tr>}
                  </tbody>
                </table>
              </div>
              {prontoLeadDetails.length >= prontoLeadDetailsLimit && <button type="button" onClick={() => setProntoLeadDetailsLimit((n)=>n+250)} style={{ marginTop:12,border:"1px solid #cbd5e1",borderRadius:8,padding:"8px 12px",background:"#fff",color:"#17365d",cursor:"pointer" }}>Load 250 more leads</button>}
              <div style={{ color:"#64748b",fontSize:11,marginTop:8 }}>Showing {formatNumber(prontoLeadDetails.length)} leads. Related appointments are matched by marketing_row_id.</div>
            </>}
          </div>

        </>

      ) : activeTab === "archived-leads" ? (
        <div className="data-dashboard-chart-card">
          <div className="data-dashboard-chart-head">
            <div>
              <div className="data-dashboard-chart-title">Archived leads</div>
              <div className="data-dashboard-chart-subtitle">Leads with an archive date, sorted newest to oldest.</div>
            </div>
            <button type="button" onClick={loadArchivedLeads} disabled={archivedLeadsLoading} className="data-dashboard-refresh">{archivedLeadsLoading ? "Loading…" : "Refresh list"}</button>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",margin:"12px 0"}}>
            <div style={{position:"relative",flex:"1 1 260px",maxWidth:420}}>
              <Search size={15} style={{position:"absolute",left:10,top:11,color:"#64748b"}} />
              <input value={archivedLeadsSearch} onChange={e=>{setArchivedLeadsPage(0);setArchivedLeadsSearch(e.target.value)}} placeholder="Search name, postcode, phone, email or source" style={{width:"100%",boxSizing:"border-box",padding:"9px 10px 9px 32px",border:"1px solid #cbd5e1",borderRadius:8}} />
            </div>
            <span style={{fontSize:12,color:"#64748b"}}>{formatNumber(archivedLeadCount)} archived leads</span>
          </div>
          {archivedLeadsError && <div className="data-dashboard-error">{archivedLeadsError}</div>}
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{background:"#17365d",color:"#fff",textAlign:"left"}}>{["Archive date","Lead","Postcode","Lead source","Disposition","Archive reason","Received"].map(label=><th key={label} style={{padding:"11px 10px",whiteSpace:"nowrap"}}>{label}</th>)}</tr></thead>
              <tbody>
                {archivedLeads.map((lead,index)=><tr key={lead.delete_row_id || lead.marketing_row_id || index} style={{borderBottom:"1px solid #e2e8f0",background:index%2?"#f8fafc":"#fff"}}>
                  <td style={{padding:"10px",whiteSpace:"nowrap",fontWeight:600}}>{lead.time_archived ? new Date(lead.time_archived).toLocaleString("en-GB") : "—"}</td>
                  <td style={{padding:"10px",minWidth:150}}><strong>{[lead.salutations,lead.first_name,lead.last_name].filter(Boolean).join(" ") || "Unnamed lead"}</strong><div style={{color:"#64748b",fontSize:11}}>{lead.primary_phone_number || lead.email || ""}</div></td>
                  <td style={{padding:"10px",whiteSpace:"nowrap"}}>{lead.postcode || "—"}</td>
                  <td style={{padding:"10px"}}>{lead.lead_source || "—"}</td>
                  <td style={{padding:"10px"}}>{lead.disposition || "—"}</td>
                  <td style={{padding:"10px"}}>{lead.reason_for_archive || "—"}</td>
                  <td style={{padding:"10px",whiteSpace:"nowrap"}}>{lead.received_date_time ? new Date(lead.received_date_time).toLocaleString("en-GB") : "—"}</td>
                </tr>)}
                {!archivedLeadsLoading && !archivedLeads.length && <tr><td colSpan={7} style={{padding:18,textAlign:"center",color:"#64748b"}}>No archived leads found.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginTop:14}}>
            <span style={{fontSize:11,color:"#64748b"}}>Showing {archivedLeads.length ? archivedLeadsPage*100+1 : 0}–{archivedLeadsPage*100+archivedLeads.length} of {formatNumber(archivedLeadCount)} · Newest archive date first</span>
            <div style={{display:"flex",gap:8}}>
              <button type="button" disabled={archivedLeadsPage===0 || archivedLeadsLoading} onClick={()=>setArchivedLeadsPage(p=>Math.max(0,p-1))} style={{border:"1px solid #cbd5e1",borderRadius:7,padding:"7px 12px",background:"#fff",color:"#17365d",cursor:"pointer"}}>Previous</button>
              <button type="button" disabled={(archivedLeadsPage+1)*100>=archivedLeadCount || archivedLeadsLoading} onClick={()=>setArchivedLeadsPage(p=>p+1)} style={{border:"1px solid #cbd5e1",borderRadius:7,padding:"7px 12px",background:"#fff",color:"#17365d",cursor:"pointer"}}>Next</button>
            </div>
          </div>
        </div>
      ) : activeTab === "kanban" ? (
        <LeadDispositionKanban />
      ) : (
        <MapOfAppointments />
      )}
    </section>
  )
}

export default DataDashboard

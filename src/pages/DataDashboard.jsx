import React, { useEffect, useMemo, useState } from "react"
import { BarChart3, RefreshCw, TrendingUp, Search } from "lucide-react"
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
  const [prontoSidRows, setProntoSidRows] = useState([])
  const [prontoSidTotal, setProntoSidTotal] = useState(0)
  const [prontoNoContactTotal, setProntoNoContactTotal] = useState(0)
  const [prontoNoContactBySid, setProntoNoContactBySid] = useState({})
  const [prontoSidLoading, setProntoSidLoading] = useState(false)
  const [prontoSidError, setProntoSidError] = useState("")
  const [prontoSidSearch, setProntoSidSearch] = useState("")
  const [prontoDatePeriod, setProntoDatePeriod] = useState("last_week")
  const [prontoStatusFilter, setProntoStatusFilter] = useState("all")
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

      setProntoSidRows((data || []).map((row) => ({
        pronto_sid: String(row.introducer || "(No Introducer)"),
        introducers: String(row.introducer || "(No Introducer)"),
        no_contact_count: Number(row.no_contact_count || 0),
        lead_count: Number(row.lead_count || 0),
        booked_count: Number(row.booked_count || 0),
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
      setIntroducerSidRows((current) => ({ ...current, [introducer]: (data || []).map((row) => ({
        pronto_sid: String(row.pronto_sid || "(No SID)"), lead_count: Number(row.lead_count || 0), booked_count: Number(row.booked_count || 0),
        first_lead_date: row.first_lead_date || null, latest_lead_date: row.latest_lead_date || null,
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
      setIntroducerC1Rows((current) => ({ ...current, [key]: (data || []).map((r) => ({ pronto_c1: String(r.pronto_c1 || "(Blank / NULL)"), lead_count: Number(r.lead_count || 0), booked_count: Number(r.booked_count || 0), first_lead_date: r.first_lead_date || null, latest_lead_date: r.latest_lead_date || null })) }))
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
      setIntroducerC3Rows((current) => ({ ...current, [key]: (data || []).map((r) => ({ pronto_c3: String(r.pronto_c3 || "(Blank / NULL)"), lead_count: Number(r.lead_count || 0), booked_count: Number(r.booked_count || 0), first_lead_date: r.first_lead_date || null, latest_lead_date: r.latest_lead_date || null })) }))
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

  useEffect(() => {
    loadData()
  }, [selectedLeadSource, chartPeriod])

  useEffect(() => {
    if (activeTab === "pronto") {
      loadProntoSidData()
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

  const filteredProntoSidRows = useMemo(() => {
    const search = prontoSidSearch.trim().toLowerCase()
    return prontoSidRows.filter((row) => {
      const matchesSearch = !search || row.pronto_sid.toLowerCase().includes(search)
      const live = isProntoLive(row.latest_lead_date)
      const matchesStatus = prontoStatusFilter === "all" || (prontoStatusFilter === "live" ? live : !live)
      return matchesSearch && matchesStatus
    })
  }, [prontoSidRows, prontoSidSearch, prontoStatusFilter])

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

        .pronto-tree-table col.pronto-col-name { width: 34%; }
        .pronto-tree-table col.pronto-col-first { width: 10%; }
        .pronto-tree-table col.pronto-col-latest { width: 10%; }
        .pronto-tree-table col.pronto-col-status { width: 7%; }
        .pronto-tree-table col.pronto-col-leads { width: 7%; }
        .pronto-tree-table col.pronto-col-booked { width: 7%; }
        .pronto-tree-table col.pronto-col-booked-percent { width: 7%; }
        .pronto-tree-table col.pronto-col-spacer { width: 18%; }

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
              </div>
            </div>
          </div>

          {prontoSidError && (
            <div className="data-dashboard-error">{prontoSidError}</div>
          )}

          <div className="pronto-table-card">
            {prontoSidLoading ? (
              <div className="pronto-empty">Loading Pronto SID data…</div>
            ) : filteredProntoSidRows.length === 0 ? (
              <div className="pronto-empty">No Pronto SID data found.</div>
            ) : (
              <table className="pronto-table pronto-tree-table">
                <colgroup>
                  <col className="pronto-col-name" />
                  <col className="pronto-col-first" />
                  <col className="pronto-col-latest" />
                  <col className="pronto-col-status" />
                  <col className="pronto-col-leads" />
                  <col className="pronto-col-booked" />
                  <col className="pronto-col-booked-percent" />
                  <col className="pronto-col-spacer" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Introducer / Campaign</th>
                    <th>First received</th>
                    <th>Latest received</th>
                    <th>Status</th>
                    <th>Leads</th>
                    <th>Booked</th>
                    <th>Booked %</th>
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
                        <td>{row.lead_count ? `${((row.booked_count / row.lead_count) * 100).toFixed(1)}%` : "0.0%"}</td>
                        <td aria-hidden="true"></td>
                      </tr>
                      {expandedIntroducers[row.pronto_sid] && (
                        introducerSidLoading[row.pronto_sid] ? (
                          <tr className="pronto-tree-loading"><td colSpan={8}>Loading SID breakdown…</td></tr>
                        ) : (introducerSidRows[row.pronto_sid] || []).map((sidRow) => {
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
                                <td>{sidRow.lead_count ? `${((sidRow.booked_count / sidRow.lead_count) * 100).toFixed(1)}%` : "0.0%"}</td>
                                <td aria-hidden="true"></td>
                              </tr>
                              {sidExpanded && (
                                introducerC1Loading[sidKey] ? (
                                  <tr className="pronto-tree-loading"><td colSpan={8}>Loading C1 campaigns…</td></tr>
                                ) : c1Rows.map((c1Row) => {
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
                                        <td>{c1Row.lead_count ? `${((c1Row.booked_count / c1Row.lead_count) * 100).toFixed(1)}%` : "0.0%"}</td>
                                        <td aria-hidden="true"></td>
                                      </tr>
                                      {c1Expanded && (
                                        introducerC3Loading[c1Key] ? (
                                          <tr className="pronto-tree-loading"><td colSpan={8}>Loading C3 campaigns…</td></tr>
                                        ) : c3Rows.map((c3Row) => (
                                          <tr className="pronto-tree-c3" key={c3Row.pronto_c3}>
                                            <td><span className="pronto-tree-leaf" style={{ paddingLeft: 66 }}>{c3Row.pronto_c3}</span></td>
                                            <td>{formatProntoDate(c3Row.first_lead_date)}</td>
                                            <td>{formatProntoDate(c3Row.latest_lead_date)}</td>
                                            <td>{prontoStatus(c3Row.latest_lead_date)}</td>
                                            <td>{formatNumber(c3Row.lead_count)}</td>
                                            <td>{formatNumber(c3Row.booked_count)}</td>
                                            <td>{c3Row.lead_count ? `${((c3Row.booked_count / c3Row.lead_count) * 100).toFixed(1)}%` : "0.0%"}</td>
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
                    <td><strong>{prontoSidTotal ? `${((prontoSidRows.reduce((sum, row) => sum + row.booked_count, 0) / prontoSidTotal) * 100).toFixed(1)}%` : "0.0%"}</strong></td>
                    <td aria-hidden="true"></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>


        </>
      ) : activeTab === "kanban" ? (
        <LeadDispositionKanban />
      ) : (
        <MapOfAppointments />
      )}
    </section>
  )
}

export default DataDashboard

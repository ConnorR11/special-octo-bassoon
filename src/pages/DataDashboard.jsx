import React, { useEffect, useMemo, useState } from "react"
import { BarChart3, RefreshCw, TrendingUp, Search } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { supabase } from "../lib/supabase"
import MapOfAppointments from "./MapOfAppointments"

const START_YEAR = 2024
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
  const [leadSourcesLoading, setLeadSourcesLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("overview")
  const [prontoSidRows, setProntoSidRows] = useState([])
  const [prontoSidTotal, setProntoSidTotal] = useState(0)
  const [prontoSidLoading, setProntoSidLoading] = useState(false)
  const [prontoSidError, setProntoSidError] = useState("")
  const [prontoSidSearch, setProntoSidSearch] = useState("")
  const [prontoDatePeriod, setProntoDatePeriod] = useState("all_time")
  const [prontoStatusFilter, setProntoStatusFilter] = useState("all")
  const [expandedProntoSids, setExpandedProntoSids] = useState({})
  const [prontoC3Rows, setProntoC3Rows] = useState({})
  const [prontoC3Loading, setProntoC3Loading] = useState({})
  const [missingSidC1Rows, setMissingSidC1Rows] = useState([])
  const [missingSidC1Loading, setMissingSidC1Loading] = useState(false)
  const [missingSidC1Error, setMissingSidC1Error] = useState("")
  const [missingSidC1Search, setMissingSidC1Search] = useState("")
  const [blankC1C3Rows, setBlankC1C2Rows] = useState([])
  const [blankC1C3Loading, setBlankC1C2Loading] = useState(false)
  const [blankC1C3Error, setBlankC1C2Error] = useState("")
  const [blankC1C3Search, setBlankC1C2Search] = useState("")

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
      const { data, error: rpcError } = await supabase.rpc("get_pronto_sid_lead_counts_with_dates_filtered", { date_period: prontoDatePeriod })
      if (rpcError) throw rpcError

      setProntoSidRows((data || []).map((row) => ({
        pronto_sid: String(row.pronto_sid || ""),
        lead_count: Number(row.lead_count || 0),
        first_lead_date: row.first_lead_date || null,
        latest_lead_date: row.latest_lead_date || null,
      })))
      setProntoSidTotal(Number(data?.[0]?.total_count || 0))
    } catch (err) {
      console.error("Error loading Pronto SID data:", err)
      setProntoSidError(err?.message || "Unable to load Pronto SID data.")
      setProntoSidRows([])
      setProntoSidTotal(0)
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

  async function loadBlankC1C3Values() {
    if (!supabase) {
      setBlankC1C2Error("Supabase is not configured.")
      return
    }

    setBlankC1C2Loading(true)
    setBlankC1C2Error("")
    try {
      const { data, error: rpcError } = await supabase.rpc("get_pronto_c3_values_when_c1_blank")
      if (rpcError) throw rpcError
      setBlankC1C2Rows((data || []).map((row) => ({
        pronto_c3: String(row.pronto_c3 || ""),
        lead_count: Number(row.lead_count || 0),
      })))
    } catch (err) {
      console.error("Error loading Pronto C3 values where C1 is blank:", err)
      setBlankC1C2Error(err?.message || "Unable to load Pronto C3 values where C1 is blank.")
      setBlankC1C2Rows([])
    } finally {
      setBlankC1C2Loading(false)
    }
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

  async function loadData() {
    if (!supabase) {
      setError("Supabase is not configured.")
      setLoading(false)
      return
    }

    setLoading(true)
    setError("")

    try {
      /*
       * Dashboard starts from January 2024.
       *
       * We deliberately use a fixed January 2024 start date rather
       * than relying on the browser's current date for the beginning
       * of the dataset.
       */
      const now = new Date()

      const start = new Date(
        START_YEAR,
        0,
        1
      )

      const end = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1
      )

      const { data, error: rpcError } = await supabase.rpc(
        "get_lead_volume_by_month",
        {
          start_date: start.toISOString(),
          end_date: end.toISOString(),
          selected_lead_source: selectedLeadSource || null,
        }
      )

      if (rpcError) {
        throw rpcError
      }

      const { data: typeData, error: typeError } = await supabase.rpc(
        "get_monthly_lead_volume_by_type",
        {
          start_date: start.toISOString(),
          end_date: end.toISOString(),
          selected_lead_source: selectedLeadSource || null,
        }
      )
      if (typeError) throw typeError

      const availableTypes = [...new Set((typeData || []).map((row) => String(row.lead_type || "(Empty / NULL)")))]
      setTypeNames(availableTypes)
      const typeLookup = new Map()
      ;(typeData || []).forEach((row) => {
        const key = String(row.month).slice(0, 10)
        if (!typeLookup.has(key)) typeLookup.set(key, {})
        typeLookup.get(key)[String(row.lead_type || "(Empty / NULL)")] = Number(row.lead_count || 0)
      })

      const complete = buildMonthRange(start, end)
        .map((row) => ({
          ...row,
          ...Object.fromEntries(availableTypes.map((type) => [type, typeLookup.get(row.month)?.[type] || 0])),
        }))
        .slice(0, -1)

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
  }, [selectedLeadSource])

  useEffect(() => {
    if (activeTab === "pronto") {
      loadProntoSidData()
    }
  }, [activeTab, prontoDatePeriod])

  useEffect(() => {
    if (activeTab === "pronto" && missingSidC1Rows.length === 0 && !missingSidC1Loading) {
      loadMissingSidC1Values()
    }
    if (activeTab === "pronto" && blankC1C3Rows.length === 0 && !blankC1C3Loading) {
      loadBlankC1C3Values()
    }
  }, [activeTab])

  const filteredMissingSidC1Rows = useMemo(() => {
    const search = missingSidC1Search.trim().toLowerCase()
    return missingSidC1Rows.filter((row) => !search || row.pronto_c1.toLowerCase().includes(search))
  }, [missingSidC1Rows, missingSidC1Search])

  const filteredBlankC1C2Rows = useMemo(() => {
    const search = blankC1C3Search.trim().toLowerCase()
    return blankC1C3Rows.filter((row) => !search || row.pronto_c3.toLowerCase().includes(search))
  }, [blankC1C3Rows, blankC1C3Search])

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
    () =>
      rows.reduce(
        (total, row) => total + row.lead_count,
        0
      ),
    [rows]
  )

  const monthsWithData = useMemo(
    () => rows.filter((row) => row.lead_count > 0),
    [rows]
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
  }, [monthsWithData])

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

        .pronto-table col.pronto-col-name { width: 20.5%; }
        .pronto-table col.pronto-col-first { width: 23.5%; }
        .pronto-table col.pronto-col-latest { width: 25.5%; }
        .pronto-table col.pronto-col-status { width: 17%; }
        .pronto-table col.pronto-col-leads { width: 13.5%; }

        .pronto-table th,
        .pronto-table td {
          box-sizing: border-box;
          overflow-wrap: anywhere;
        }

        .pronto-breakdown-cell {
          padding: 8px 14px 14px !important;
          background: #f8fafc;
        }

        .pronto-breakdown-table {
          width: calc(100% + 28px);
          margin-left: -14px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
        }

        .pronto-breakdown-table th:first-child,
        .pronto-breakdown-table td:first-child {
          padding-left: 16px;
        }

        .pronto-table th {
          background: #f8fafc;
          color: #64748b;
          text-align: left;
          font-weight: 700;
          padding: 11px 13px;
          border-bottom: 1px solid #dfe5ec;
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
      </div>

      {error && activeTab === "overview" && (
        <div className="data-dashboard-error">
          {error}
        </div>
      )}

      {activeTab === "overview" ? (
        <>
      <div className="data-dashboard-grid">
        <div className="data-dashboard-card">
          <div className="data-dashboard-card-label">
            Total leads
          </div>

          <div className="data-dashboard-card-value">
            {formatNumber(totalLeads)}
          </div>

          <div className="data-dashboard-card-note">
            Since January 2024
          </div>
        </div>

        <div className="data-dashboard-card">
          <div className="data-dashboard-card-label">
            Average per active month
          </div>

          <div className="data-dashboard-card-value">
            {formatNumber(averageMonthly)}
          </div>

          <div className="data-dashboard-card-note">
            Months containing at least one lead
          </div>
        </div>

        <div className="data-dashboard-card">
          <div className="data-dashboard-card-label">
            Peak month
          </div>

          <div className="data-dashboard-card-value">
            {peakMonth
              ? formatNumber(peakMonth.lead_count)
              : "—"}
          </div>

          <div className="data-dashboard-card-note">
            {peakMonth
              ? formatMonth(peakMonth.month)
              : "No data"}
          </div>
        </div>
      </div>

      <div className="data-dashboard-chart-card">
        <div className="data-dashboard-chart-head">
          <div>
            <div className="data-dashboard-chart-title">
              <BarChart3 size={17} />
              Monthly lead volume by lead type
            </div>

            <div className="data-dashboard-chart-subtitle">
              {firstDataMonth
                ? `CRM lead records currently begin ${formatMonth(
                    firstDataMonth
                  )}.`
                : "Monthly lead records from January 2024 onwards."}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
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
            <BarChart data={rows} margin={{ top: 10, right: 18, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#e8edf3" vertical={false} />
              <XAxis dataKey="month" tickFormatter={(value) => new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })} interval={5} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#dfe5ec" }} tickLine={false} />
              <YAxis tickFormatter={formatNumber} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={55} />
              <Tooltip
                content={({ active, payload, label }) => {
                  const visibleItems = (payload || []).filter(
                    (item) => Number(item.value || 0) >= 1
                  )
                  if (!active || visibleItems.length === 0) return null
                  return (
                    <div style={{ background: "#fff", border: "1px solid #dfe5ec", borderRadius: 8, padding: "10px 12px", fontSize: 12, boxShadow: "0 5px 18px rgba(15,23,42,.08)" }}>
                      <div style={{ marginBottom: 7, color: "#0f172a", fontWeight: 600 }}>{formatMonth(label)}</div>
                      {visibleItems.map((item) => (
                        <div key={item.dataKey} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, color: item.color || "#334155" }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color || "#334155", flexShrink: 0 }} />
                          <span>{item.name}: {formatNumber(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  )
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              {typeNames.map((type, index) => (
                <Bar key={type} dataKey={type} name={type} stackId="leads" fill={LEAD_TYPE_COLORS[index % LEAD_TYPE_COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

        </>
      ) : activeTab === "pronto" ? (
        <>
          <div className="pronto-toolbar">
            <div>
              <div className="data-dashboard-chart-title">Pronto SID Lead Counts</div>
              <div className="data-dashboard-chart-subtitle">
                Lead counts and campaign activity for the selected period.
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 10 }}>
              <select
                aria-label="Filter Pronto leads by date"
                value={prontoDatePeriod}
                onChange={(event) => {
                  setProntoDatePeriod(event.target.value)
                  setProntoC3Rows({})
                  setExpandedProntoSids({})
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
                  placeholder="Search Pronto SID"
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
              <table className="pronto-table">
                <colgroup>
                  <col className="pronto-col-name" />
                  <col className="pronto-col-first" />
                  <col className="pronto-col-latest" />
                  <col className="pronto-col-status" />
                  <col className="pronto-col-leads" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Pronto SID</th>
                    <th>First received</th>
                    <th>Latest received</th>
                    <th>Status</th>
                    <th>Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProntoSidRows.map((row) => (
                    <React.Fragment key={row.pronto_sid}>
                      <tr>
                        <td>
                          <button
                            type="button"
                            onClick={() => toggleProntoSid(row.pronto_sid)}
                            aria-expanded={Boolean(expandedProntoSids[row.pronto_sid])}
                            style={{ border: 0, background: "transparent", padding: 0, color: "inherit", font: "inherit", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}
                          >
                            <span aria-hidden="true">{expandedProntoSids[row.pronto_sid] ? "▾" : "▸"}</span>
                            {row.pronto_sid}
                          </button>
                        </td>
                        <td>{formatProntoDate(row.first_lead_date)}</td>
                        <td>{formatProntoDate(row.latest_lead_date)}</td>
                        <td>{prontoStatus(row.latest_lead_date)}</td>
                        <td>{formatNumber(row.lead_count)}</td>
                      </tr>
                      {expandedProntoSids[row.pronto_sid] && (
                        <tr>
                          <td colSpan={5} className="pronto-breakdown-cell">
                            {prontoC3Loading[row.pronto_sid] ? (
                              <div className="pronto-empty" style={{ padding: 16 }}>Loading Pronto C3 breakdown…</div>
                            ) : (
                              <table className="pronto-table pronto-breakdown-table">
                                <colgroup>
                                  <col className="pronto-col-name" />
                                  <col className="pronto-col-first" />
                                  <col className="pronto-col-latest" />
                                  <col className="pronto-col-status" />
                                  <col className="pronto-col-leads" />
                                </colgroup>
                                <thead>
                                  <tr>
                                    <th>Pronto C1</th>
                                    <th>First received</th>
                                    <th>Latest received</th>
                                    <th>Status</th>
                                    <th>Leads</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(prontoC3Rows[row.pronto_sid] || []).length ? (
                                    prontoC3Rows[row.pronto_sid].map((c3Row) => (
                                      <tr key={c3Row.pronto_c3}>
                                        <td>{c3Row.pronto_c3}</td>
                                        <td>{formatProntoDate(c3Row.first_lead_date)}</td>
                                        <td>{formatProntoDate(c3Row.latest_lead_date)}</td>
                                        <td>{prontoStatus(c3Row.latest_lead_date)}</td>
                                        <td>{formatNumber(c3Row.lead_count)}</td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr><td colSpan={5}>No Pronto C3 values found.</td></tr>
                                  )}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  <tr>
                    <td colSpan={4}><strong>Total Pronto Windows leads</strong></td>
                    <td><strong>{formatNumber(prontoSidTotal)}</strong></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          <div style={{ marginTop: 22, marginBottom: 10 }}>
            <div className="data-dashboard-chart-title">Unique Pronto C1 values without a SID</div>
            <div className="data-dashboard-chart-subtitle">
              Distinct, non-blank Pronto C1 values from Pronto Windows leads where pronto_SID is blank or NULL, with the number of matching leads for each value.
            </div>
          </div>

          <div className="pronto-toolbar">
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {formatNumber(filteredMissingSidC1Rows.length)} unique values · {formatNumber(filteredMissingSidC1Rows.reduce((sum, row) => sum + row.lead_count, 0))} matching leads
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div className="pronto-search">
                <Search size={14} color="#64748b" />
                <input
                  type="text"
                  value={missingSidC1Search}
                  onChange={(event) => setMissingSidC1Search(event.target.value)}
                  placeholder="Search Pronto C1"
                  aria-label="Search Pronto C1 values without SID"
                />
              </div>
              <button type="button" className="data-dashboard-refresh" onClick={loadMissingSidC1Values} disabled={missingSidC1Loading}>
                <RefreshCw size={14} className={missingSidC1Loading ? "spin" : ""} />
                Refresh list
              </button>
            </div>
          </div>

          {missingSidC1Error && <div className="data-dashboard-error">{missingSidC1Error}</div>}

          <div className="pronto-table-card">
            {missingSidC1Loading ? (
              <div className="pronto-empty">Loading unique Pronto C1 values…</div>
            ) : filteredMissingSidC1Rows.length === 0 ? (
              <div className="pronto-empty">{missingSidC1Search ? "No matching Pronto C1 values." : "No non-blank Pronto C1 values found without a SID."}</div>
            ) : (
              <table className="pronto-table">
                <colgroup>
                  <col style={{ width: "80%" }} />
                  <col style={{ width: "20%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Pronto C1 value</th>
                    <th>Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMissingSidC1Rows.map((row) => (
                    <tr key={row.pronto_c1}>
                      <td style={{ fontWeight: 500 }}>{row.pronto_c1}</td>
                      <td>{formatNumber(row.lead_count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ marginTop: 22, marginBottom: 10 }}>
            <div className="data-dashboard-chart-title">Unique Pronto C3 values where C1 is blank or NULL</div>
            <div className="data-dashboard-chart-subtitle">
              Distinct, non-blank Pronto C3 values from Pronto Windows leads where pronto_c1 is blank or NULL, with the number of matching leads for each value.
            </div>
          </div>

          <div className="pronto-toolbar">
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {formatNumber(filteredBlankC1C2Rows.length)} unique values · {formatNumber(filteredBlankC1C2Rows.reduce((sum, row) => sum + row.lead_count, 0))} matching leads
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div className="pronto-search">
                <Search size={14} color="#64748b" />
                <input
                  type="text"
                  value={blankC1C3Search}
                  onChange={(event) => setBlankC1C2Search(event.target.value)}
                  placeholder="Search Pronto C3"
                  aria-label="Search Pronto C3 values where C1 is blank"
                />
              </div>
              <button type="button" className="data-dashboard-refresh" onClick={loadBlankC1C3Values} disabled={blankC1C3Loading}>
                <RefreshCw size={14} className={blankC1C3Loading ? "spin" : ""} />
                Refresh list
              </button>
            </div>
          </div>

          {blankC1C3Error && <div className="data-dashboard-error">{blankC1C3Error}</div>}

          <div className="pronto-table-card">
            {blankC1C3Loading ? (
              <div className="pronto-empty">Loading unique Pronto C3 values…</div>
            ) : filteredBlankC1C2Rows.length === 0 ? (
              <div className="pronto-empty">{blankC1C3Search ? "No matching Pronto C3 values." : "No non-blank Pronto C3 values found where C1 is blank or NULL."}</div>
            ) : (
              <table className="pronto-table">
                <colgroup>
                  <col style={{ width: "80%" }} />
                  <col style={{ width: "20%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Pronto C3 value</th>
                    <th>Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBlankC1C2Rows.map((row) => (
                    <tr key={row.pronto_c3}>
                      <td style={{ fontWeight: 500 }}>{row.pronto_c3}</td>
                      <td>{formatNumber(row.lead_count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <MapOfAppointments />
      )}
    </section>
  )
}

export default DataDashboard

import React, { useEffect, useMemo, useState } from "react"
import { BarChart3, RefreshCw, TrendingUp, Search } from "lucide-react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { supabase } from "../lib/supabase"

const START_YEAR = 2022

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("overview")
  const [prontoRows, setProntoRows] = useState([])
  const [prontoLoading, setProntoLoading] = useState(false)
  const [prontoError, setProntoError] = useState("")
  const [prontoSearch, setProntoSearch] = useState("")

  async function loadProntoData() {
    if (!supabase) {
      setProntoError("Supabase is not configured.")
      return
    }

    setProntoLoading(true)
    setProntoError("")

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "get_pronto_c1_lead_counts",
        { start_date: "2026-01-01T00:00:00+00:00" }
      )

      if (rpcError) throw rpcError

      setProntoRows(
        (data || []).map((row) => ({
          pronto_c1: String(row.pronto_c1 || "?"),
          lead_count: Number(row.lead_count || 0),
        }))
      )
    } catch (err) {
      console.error("Error loading Pronto data:", err)
      setProntoError(err?.message || "Unable to load Pronto data.")
      setProntoRows([])
    } finally {
      setProntoLoading(false)
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
       * Dashboard starts from January 2022.
       *
       * We deliberately use a fixed January 2022 start date rather
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
        }
      )

      if (rpcError) {
        throw rpcError
      }

      const lookup = new Map(
        (data || []).map((row) => [
          String(row.month).slice(0, 10),
          Number(row.lead_count || 0),
        ])
      )

      /*
       * Build every month from January 2022 through the
       * previous completed month. This means months with zero
       * leads still appear on the graph.
       */
      const complete = buildMonthRange(start, end)
        .map((row) => ({
          ...row,
          lead_count: lookup.get(row.month) || 0,
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
    loadData()
  }, [])

  useEffect(() => {
    if (activeTab === "pronto" && prontoRows.length === 0 && !prontoLoading) {
      loadProntoData()
    }
  }, [activeTab])

  const filteredProntoRows = useMemo(() => {
    const search = prontoSearch.trim().toLowerCase()
    if (!search) return prontoRows
    return prontoRows.filter((row) =>
      row.pronto_c1.toLowerCase().includes(search)
    )
  }, [prontoRows, prontoSearch])

  const prontoTotal = useMemo(
    () => prontoRows.reduce((total, row) => total + row.lead_count, 0),
    [prontoRows]
  )

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
          border-collapse: collapse;
          font-size: 12px;
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
          text-align: right;
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
            Lead volume received by month from January 2022 onwards.
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
            Since January 2022
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
              Lead volume
            </div>

            <div className="data-dashboard-chart-subtitle">
              {firstDataMonth
                ? `CRM lead records currently begin ${formatMonth(
                    firstDataMonth
                  )}.`
                : "Monthly lead records from January 2022 onwards."}
            </div>
          </div>

          <div className="data-dashboard-status">
            {loading
              ? "Loading…"
              : `${formatNumber(totalLeads)} leads`}
          </div>
        </div>

        {loading ? (
          <div className="data-dashboard-empty">
            Loading lead volume…
          </div>
        ) : rows.length === 0 ? (
          <div className="data-dashboard-empty">
            <TrendingUp
              size={18}
              style={{ marginRight: 8 }}
            />
            No lead data available.
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height={430}
          >
            <LineChart
              data={rows}
              margin={{
                top: 10,
                right: 18,
                left: 0,
                bottom: 8,
              }}
            >
              <CartesianGrid
                stroke="#e8edf3"
                vertical={false}
              />

              <XAxis
                dataKey="month"
                tickFormatter={(value) => {
                  const date = new Date(
                    `${value}T00:00:00`
                  )

                  return date.toLocaleDateString(
                    "en-GB",
                    {
                      month: "short",
                      year: "2-digit",
                    }
                  )
                }}
                interval={5}
                tick={{
                  fontSize: 10,
                  fill: "#64748b",
                }}
                axisLine={{
                  stroke: "#dfe5ec",
                }}
                tickLine={false}
              />

              <YAxis
                tickFormatter={formatNumber}
                tick={{
                  fontSize: 10,
                  fill: "#64748b",
                }}
                axisLine={false}
                tickLine={false}
                width={55}
              />

              <Tooltip
                labelFormatter={(value) =>
                  formatMonth(value)
                }
                formatter={(value) => [
                  formatNumber(value),
                  "Leads",
                ]}
                contentStyle={{
                  border: "1px solid #dfe5ec",
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow:
                    "0 5px 18px rgba(15,23,42,.08)",
                }}
              />

              <Line
                type="monotone"
                dataKey="lead_count"
                stroke="#0877bd"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      ) : (
        <>
          {prontoError && (
            <div className="data-dashboard-error">
              {prontoError}
            </div>
          )}

          <div className="pronto-toolbar">
            <div>
              <div className="data-dashboard-chart-title">Pronto C1</div>
              <div className="data-dashboard-chart-subtitle">
                Unique Pronto C1 values for Pronto Windows leads received since 1 January 2026.
              </div>
            </div>

            <div className="pronto-search">
              <Search size={14} color="#64748b" />
              <input
                type="text"
                value={prontoSearch}
                onChange={(event) => setProntoSearch(event.target.value)}
                placeholder="Search Pronto C1"
              />
            </div>
          </div>

          <div className="pronto-table-card">
            {prontoLoading ? (
              <div className="pronto-empty">Loading Pronto data…</div>
            ) : filteredProntoRows.length === 0 ? (
              <div className="pronto-empty">No Pronto C1 data found.</div>
            ) : (
              <table className="pronto-table">
                <thead>
                  <tr>
                    <th>Pronto C1</th>
                    <th>Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProntoRows.map((row) => (
                    <tr key={row.pronto_c1}>
                      <td>{row.pronto_c1}</td>
                      <td>{formatNumber(row.lead_count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </section>
  )
}

export default DataDashboard

import React, { useMemo, useState } from "react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import { money } from "../utils/formatters"
import { supabase } from "../lib/supabase"

const RESULT_SERIES = [
  { key: "Solid", colour: "#008000" },
  { key: "Decline", colour: "#ff9900" },
  { key: "Cancelled", colour: "#ff0000" },
  { key: "Missing stage", colour: "#64748b" },
]
const PRODUCT_SERIES = [
  { key: "Windows", colour: "#1683c7" },
  { key: "Solar", colour: "#d86bdc" },
  { key: "ASHP", colour: "#f59e0b" },
  { key: "Other", colour: "#15803d" },
]
const PRODUCT_FILTER_OPTIONS = ["Windows", "Solar", "ASHP", "Other"]

function normaliseResult(deal) {
  const stage = String(deal?.pipedrive_stage || "").trim()
  if (!stage) return "Missing stage"
  const value = stage.toLowerCase()
  if (value.includes("declin")) return "Decline"
  if (value.includes("cancel")) return "Cancelled"
  return "Solid"
}

function normaliseProduct(value) {
  const product = String(value ?? "").trim().toLowerCase()
  if (product.includes("window")) return "Windows"
  if (product.includes("solar")) return "Solar"
  if (product === "ashp" || product.includes("air source heat pump") || product.includes("heat pump")) return "ASHP"
  return "Other"
}

function addLinearTrend(data, sourceKey, trendKey) {
  const points = data.map((row, index) => ({ x: index, y: Number(row[sourceKey] || 0) })).filter(point => Number.isFinite(point.y))
  if (points.length < 2) return data.map(row => ({ ...row, [trendKey]: null }))
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length
  const denominator = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0)
  const slope = denominator ? points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0) / denominator : 0
  const intercept = meanY - slope * meanX
  return data.map((row, index) => ({ ...row, [trendKey]: intercept + slope * index }))
}

function axisMoney(value) {
  if (value >= 1000000) return `£${(value / 1000000).toFixed(1)}m`
  if (value >= 1000) return `£${Math.round(value / 1000)}k`
  return `£${value}`
}

function ChartCard({ title, subtitle, data, series, dataKey }) {
  const maxValue = data.reduce((max, row) => Math.max(max, Number(row.total || 0)), 0)
  const step = maxValue > 10000000 ? 2000000 : 2000000
  const maxTick = Math.max(step, Math.ceil(maxValue / step) * step)
  const ticks = Array.from({ length: Math.floor(maxTick / step) + 1 }, (_, i) => i * step)

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e5e8", borderRadius: 12, padding: "20px 18px 10px", minWidth: 0, boxSizing: "border-box" }}>
      <h2 style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "#17212b" }}>{title}</h2>
      <p style={{ margin: "0 0 10px", fontSize: 11, color: "#818891" }}>{subtitle}</p>
      <ResponsiveContainer width="100%" height={330}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d7d7d7" />
          <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#8a8a8a", fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} ticks={ticks} domain={[0, maxTick]} tickFormatter={axisMoney} tick={{ fill: "#777", fontSize: 10 }} width={74} />
          <Tooltip labelFormatter={(label) => String(label)} formatter={(value, name) => [money(Number(value || 0)), name]} contentStyle={{ border: "1px solid #e2e5e8", borderRadius: 8, fontSize: 11 }} />
          <Legend verticalAlign="bottom" height={32} iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          {series.map((item) => <Bar key={item.key} dataKey={item.key} name={item.key} stackId={dataKey} fill={item.colour} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function SalesChart({ contracts = [] }) {
  const [selectedProduct, setSelectedProduct] = useState("All products")
  const [selectedBranch, setSelectedBranch] = useState("All branches")
  const [selectedYear, setSelectedYear] = useState("all")
  const [timeGrouping, setTimeGrouping] = useState("yearToDate")
  const [salesChartMode, setSalesChartMode] = useState("product")
  const yearToDate = timeGrouping === "yearToDate"
  const [cpsSelectedYear, setCpsSelectedYear] = useState("all")
  const [cpsTimeGrouping, setCpsTimeGrouping] = useState("month")
  const [cpsSelectedProduct, setCpsSelectedProduct] = useState("All products")
  const [cpsSelectedBranch, setCpsSelectedBranch] = useState("All branches")
  const [showCpsBars, setShowCpsBars] = useState(true)
  const [showCpsBoLine, setShowCpsBoLine] = useState(false)
  const [showCpsConversionLine, setShowCpsConversionLine] = useState(false)
  const [showCpsDropOffLine, setShowCpsDropOffLine] = useState(false)
  const [showCpsBoTrend, setShowCpsBoTrend] = useState(false)
  const [showCpsConversionTrend, setShowCpsConversionTrend] = useState(false)
  const [showCpsDropOffTrend, setShowCpsDropOffTrend] = useState(false)
  const [cpsAppointments, setCpsAppointments] = useState([])
  const [cpsLoading, setCpsLoading] = useState(false)
  const [cpsError, setCpsError] = useState("")
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth()
  const currentDay = today.getDate()
  const years = useMemo(() => Array.from({ length: Math.max(0, currentYear - 2019) }, (_, i) => 2020 + i), [currentYear])

  const availableBranches = useMemo(() => [...new Set(contracts.map(deal => String(deal?.branch || deal?.branch_name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [contracts])

  const availableYears = useMemo(() => {
    const values = new Set()
    contracts.forEach((deal) => {
      if (!deal?.sale_date) return
      const date = new Date(`${String(deal.sale_date).slice(0, 10)}T00:00:00`)
      if (!Number.isNaN(date.getTime())) values.add(date.getFullYear())
    })
    return Array.from(values).sort((a, b) => b - a)
  }, [contracts])

  React.useEffect(() => {
    let cancelled = false
    async function loadCpsAppointments() {
      setCpsLoading(true)
      setCpsError("")
      try {
        const { data, error } = await supabase.rpc("sales_conversion_appointment_counts", {
          p_start_date: "2025-01-01T00:00:00Z",
          p_end_date: new Date().toISOString()
        })
        if (error) throw error
        if (!cancelled) setCpsAppointments(data || [])
      } catch (error) {
        if (!cancelled) {
          setCpsAppointments([])
          setCpsError(error?.message || "Unable to load sales conversion data.")
        }
      } finally {
        if (!cancelled) setCpsLoading(false)
      }
    }
    loadCpsAppointments()
    return () => { cancelled = true }
  }, [])

  const chartData = useMemo(() => years.map((year) => {
    const row = { year, total: 0 }
    ;[...RESULT_SERIES, ...PRODUCT_SERIES].forEach((item) => { row[item.key] = 0 })
    contracts.forEach((deal) => {
      if (!deal?.sale_date) return
      const date = new Date(`${String(deal.sale_date).slice(0, 10)}T00:00:00`)
      if (Number.isNaN(date.getTime()) || date.getFullYear() !== year) return
      const dealBranch = String(deal?.branch || deal?.branch_name || "").trim()
      if (selectedBranch !== "All branches" && dealBranch !== selectedBranch) return
      const yesterday = new Date(currentYear, currentMonth, currentDay)
      yesterday.setDate(yesterday.getDate() - 1)
      if (date > yesterday) return
      const value = Number(deal.net_value || 0)
      if (!Number.isFinite(value) || value <= 0) return
      row[normaliseResult(deal)] += value
      row[normaliseProduct(deal.product)] += value
      row.total += value
    })
    return row
  }), [contracts, years, currentYear, currentMonth, currentDay, selectedBranch])

  const monthlyBalanceData = useMemo(() => {
    if (yearToDate) {
      const yesterday = new Date(currentYear, currentMonth, currentDay)
      yesterday.setDate(yesterday.getDate() - 1)
      const cutoffMonth = yesterday.getMonth()
      const cutoffDay = yesterday.getDate()
      const allYears = [...new Set(contracts
        .filter(deal => deal?.sale_date)
        .map(deal => new Date(`${String(deal.sale_date).slice(0, 10)}T00:00:00`))
        .filter(date => !Number.isNaN(date.getTime()))
        .map(date => date.getFullYear())
        .filter(year => year >= 2020 && year <= currentYear))].sort((a, b) => a - b)
      return allYears
        .filter(year => selectedYear === "all" || String(year) === selectedYear)
        .map(year => {
          const cutoff = new Date(year, cutoffMonth, cutoffDay)
          const row = {
            bucketKey: String(year),
            month: String(year),
            hoverLabel: `1 Jan – ${cutoff.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${year}`,
            Solid: 0, Decline: 0, Cancelled: 0, "Missing stage": 0,
            Windows: 0, Solar: 0, ASHP: 0, Other: 0,
            total: 0, totalSold: 0, notSolidPercent: 0,
          }
          contracts.forEach(deal => {
            if (!deal?.sale_date) return
            const date = new Date(`${String(deal.sale_date).slice(0, 10)}T00:00:00`)
            if (Number.isNaN(date.getTime()) || date.getFullYear() !== year || date > cutoff ||
                date.getMonth() > cutoffMonth || (date.getMonth() === cutoffMonth && date.getDate() > cutoffDay)) return
            if (selectedProduct !== "All products" && selectedProduct !== normaliseProduct(deal.product)) return
            const dealBranch = String(deal?.branch || deal?.branch_name || "").trim()
            if (selectedBranch !== "All branches" && dealBranch !== selectedBranch) return
            const amount = Number(deal.net_value || 0)
            if (!Number.isFinite(amount) || amount <= 0) return
            row[normaliseResult(deal)] += amount
            row[normaliseProduct(deal.product)] += amount
            row.total += amount
            row.totalSold += 1
          })
          row.notSolidPercent = row.total > 0 ? ((row.Decline + row.Cancelled) / row.total) * 100 : 0
          return row
        })
    }
    const start = selectedYear === "all" ? new Date(2020, 0, 1) : new Date(Number(selectedYear), 0, 1)
    const yearEnd = selectedYear === "all" ? new Date(currentYear, currentMonth, currentDay) : new Date(Number(selectedYear), 11, 31)
    const end = yearEnd > new Date(currentYear, currentMonth, currentDay) ? new Date(currentYear, currentMonth, currentDay) : yearEnd
    const rows = []
    const getBucket = (date) => {
      const year = date.getFullYear()
      if (timeGrouping === "year") return { key: String(year), label: String(year), start: new Date(year, 0, 1) }
      if (timeGrouping === "quarter") {
        const quarter = Math.floor(date.getMonth() / 3) + 1
        return { key: `${year}-Q${quarter}`, label: `Q${quarter} ${year}`, start: new Date(year, (quarter - 1) * 3, 1) }
      }
      if (timeGrouping === "week") {
        const weekStart = new Date(year, date.getMonth(), date.getDate())
        const day = (weekStart.getDay() + 6) % 7
        weekStart.setDate(weekStart.getDate() - day)
        const weekYear = weekStart.getFullYear()
        const jan1 = new Date(weekYear, 0, 1)
        const week = Math.ceil((((weekStart - jan1) / 86400000) + jan1.getDay() + 6) / 7)
        const startDate = weekStart.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        return { key: weekStart.toISOString().slice(0, 10), label: `W${String(week).padStart(2, "0")} ${weekYear}`, hoverLabel: startDate, start: weekStart }
      }
      return { key: `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`, label: date.toLocaleDateString("en-GB", { month: "short", year: "numeric" }), start: new Date(year, date.getMonth(), 1) }
    }
    const cursor = new Date(start)
    while (cursor <= end) {
      const bucket = getBucket(cursor)
      if (!rows.some((row) => row.bucketKey === bucket.key)) rows.push({ bucketKey: bucket.key, month: bucket.label, hoverLabel: bucket.hoverLabel || bucket.label, bucketStart: bucket.start.getTime(), Solid: 0, Decline: 0, Cancelled: 0, "Missing stage": 0, Windows: 0, Solar: 0, ASHP: 0, Other: 0, total: 0, totalSold: 0, notSolidPercent: 0 })
      if (timeGrouping === "year") cursor.setFullYear(cursor.getFullYear() + 1)
      else if (timeGrouping === "quarter") cursor.setMonth(cursor.getMonth() + 3, 1)
      else if (timeGrouping === "week") cursor.setDate(cursor.getDate() + 7)
      else cursor.setMonth(cursor.getMonth() + 1, 1)
    }
    const rowByKey = new Map(rows.map((row) => [row.bucketKey, row]))
    contracts.forEach((deal) => {
      if (!deal?.sale_date) return
      const date = new Date(`${String(deal.sale_date).slice(0, 10)}T00:00:00`)
      if (Number.isNaN(date.getTime()) || date < start || date > end) return
      if (selectedProduct !== "All products" && selectedProduct !== normaliseProduct(deal.product)) return
      const dealBranch = String(deal?.branch || deal?.branch_name || "").trim()
      if (selectedBranch !== "All branches" && dealBranch !== selectedBranch) return
      const bucket = getBucket(date)
      const row = rowByKey.get(bucket.key)
      if (!row) return
      const amount = Number(deal.net_value || 0)
      if (!Number.isFinite(amount) || amount <= 0) return
      row[normaliseResult(deal)] += amount
      row[normaliseProduct(deal.product)] += amount
      row.total += amount
      row.totalSold += 1
    })
    rows.forEach((row) => { row.notSolidPercent = row.total > 0 ? ((row.Decline + row.Cancelled) / row.total) * 100 : 0 })
    return rows
  }, [contracts, currentYear, currentMonth, currentDay, selectedProduct, selectedBranch, selectedYear, timeGrouping, yearToDate, availableYears])

  const conversionData = useMemo(() => {
    const yesterdayEnd = new Date(currentYear, currentMonth, currentDay - 1, 23, 59, 59, 999)
    const start = cpsSelectedYear === "all" ? new Date(2025, 0, 1) : new Date(Math.max(2025, Number(cpsSelectedYear)), 0, 1)
    const selectedYear = cpsSelectedYear === "all" ? currentYear : Number(cpsSelectedYear)
    const requestedEnd = cpsTimeGrouping === "yearToDate" ? new Date(selectedYear, currentMonth, currentDay - 1, 23, 59, 59, 999) : (cpsSelectedYear === "all" ? yesterdayEnd : new Date(Number(cpsSelectedYear), 11, 31, 23, 59, 59, 999))
    const end = requestedEnd > yesterdayEnd ? yesterdayEnd : requestedEnd
    const rows = []
    const getBucket = (date) => {
      const year = date.getFullYear()
      if (cpsTimeGrouping === "yearToDate") return { key: String(year), label: String(year), start: new Date(year, 0, 1) }
      if (cpsTimeGrouping === "year") return { key: String(year), label: String(year), start: new Date(year, 0, 1) }
      if (cpsTimeGrouping === "quarter") {
        const quarter = Math.floor(date.getMonth() / 3) + 1
        return { key: `${year}-Q${quarter}`, label: `Q${quarter} ${year}`, start: new Date(year, (quarter - 1) * 3, 1) }
      }
      if (cpsTimeGrouping === "week") {
        const weekStart = new Date(year, date.getMonth(), date.getDate())
        const day = (weekStart.getDay() + 6) % 7
        weekStart.setDate(weekStart.getDate() - day)
        const jan1 = new Date(weekStart.getFullYear(), 0, 1)
        const week = Math.ceil((((weekStart - jan1) / 86400000) + jan1.getDay() + 6) / 7)
        return { key: weekStart.toISOString().slice(0, 10), label: `W${String(week).padStart(2, "0")} ${weekStart.getFullYear()}`, hoverLabel: weekStart.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), start: weekStart }
      }
      return { key: `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`, label: date.toLocaleDateString("en-GB", { month: "short", year: "numeric" }), start: new Date(year, date.getMonth(), 1) }
    }
    if (end >= start) {
      const cursor = new Date(start)
      while (cursor <= end) {
        const bucket = getBucket(cursor)
        if (!rows.some(row => row.bucketKey === bucket.key)) rows.push({ bucketKey: bucket.key, month: bucket.label, hoverLabel: bucket.hoverLabel || bucket.label, confirmedOnly: 0, priceOnly: 0, sold: 0, confirmed: 0, confirmedTotal: 0, priceTotal: 0, soldTotal: 0, soldNetValue: 0, solidNetValue: 0, conversionPercent: 0, boPercent: 0, dropOffPercent: 0 })
        if (cpsTimeGrouping === "year" || cpsTimeGrouping === "yearToDate") cursor.setFullYear(cursor.getFullYear() + 1)
        else if (cpsTimeGrouping === "quarter") cursor.setMonth(cursor.getMonth() + 3, 1)
        else if (cpsTimeGrouping === "week") cursor.setDate(cursor.getDate() + 7)
        else cursor.setMonth(cursor.getMonth() + 1, 1)
      }
    }
    const rowByKey = new Map(rows.map(row => [row.bucketKey, row]))
    cpsAppointments.forEach(appointment => {
      if (!appointment?.appointment_day) return
      const date = new Date(`${String(appointment.appointment_day).slice(0, 10)}T00:00:00`)
      if (Number.isNaN(date.getTime()) || date < start || date > end) return
      // In YTD mode, compare every year through the same calendar day as yesterday.
      if (cpsTimeGrouping === "yearToDate" && (date.getMonth() > yesterdayEnd.getMonth() || (date.getMonth() === yesterdayEnd.getMonth() && date.getDate() > yesterdayEnd.getDate()))) return
      if (cpsSelectedProduct !== "All products") { const jobType = normaliseProduct(appointment.job_type); if (cpsSelectedProduct === "Solar & ASHP" ? !["Solar", "ASHP"].includes(jobType) : cpsSelectedProduct !== jobType) return }
      if (cpsSelectedBranch !== "All branches" && appointment.branch !== cpsSelectedBranch) return
      const row = rowByKey.get(getBucket(date).key)
      if (!row) return
      row.confirmedTotal += Number(appointment.confirmed_count || 0)
      row.priceTotal += Number(appointment.price_count || 0)
      row.soldTotal += Number(appointment.sold_count || 0)
      row.soldNetValue += Number(appointment.sold_net_value || 0)
      row.solidNetValue += Number(appointment.solid_net_value || 0)
      row.confirmed += Number(appointment.confirmed_count || 0)
      row.sold += Number(appointment.sold_count || 0)
      row.priceOnly += Number(appointment.price_not_sold_count || 0)
      row.confirmedOnly += Number(appointment.confirmed_no_price_count || 0)
    })
    rows.forEach(row => { const barC = Math.max(0, row.confirmedTotal); const barP = Math.min(barC, Math.max(0, row.priceTotal)); const barS = Math.min(barP, Math.max(0, row.soldTotal)); row.confirmedOnly = barC - barP; row.priceOnly = barP - barS; row.sold = barS; row.conversionPercent = row.priceTotal > 0 ? row.soldTotal / row.priceTotal * 100 : 0; row.boPercent = row.confirmedTotal > 0 ? ((row.confirmedTotal - row.priceTotal) / row.confirmedTotal) * 100 : 0; row.dropOffPercent = row.soldNetValue > 0 ? ((row.soldNetValue - row.solidNetValue) / row.soldNetValue) * 100 : 0; row.totalPriced = barP })
    return rows
  }, [cpsAppointments, cpsSelectedProduct, cpsSelectedBranch, cpsSelectedYear, cpsTimeGrouping, currentYear, currentMonth, currentDay])

  const conversionTrendData = useMemo(() => {
    let rows = conversionData
    rows = addLinearTrend(rows, "boPercent", "boTrend")
    rows = addLinearTrend(rows, "conversionPercent", "conversionTrend")
    rows = addLinearTrend(rows, "dropOffPercent", "dropOffTrend")
    return rows
  }, [conversionData])

  if (!contracts.length) {
    return <div style={{ marginTop: 18, background: "#fff", border: "1px solid #e2e5e8", borderRadius: 12, padding: 24, color: "#777", fontSize: 12 }}>No sales data available.</div>
  }

  return (
    <section style={{ marginTop: 18 }}>

      <div style={{ marginTop: 18, background: "#fff", border: "1px solid #e2e5e8", borderRadius: 12, padding: "20px 18px 10px", minWidth: 0, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
          <div><h2 style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "#17212b" }}>Deal Breakdown</h2><p style={{ margin: 0, fontSize: 11, color: "#818891" }}>Net sales value · January 2020 onwards</p></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12, color: "#475569" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>View<select value={salesChartMode} onChange={event => setSalesChartMode(event.target.value)} style={{ border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", padding: "8px 10px", fontSize: 12, color: "#17212b" }}><option value="result">By Status</option><option value="product">By Product</option></select></label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>Year<select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} style={{ border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", padding: "8px 10px", fontSize: 12, color: "#17212b" }}><option value="all">All time</option>{availableYears.map((year) => <option key={year} value={String(year)}>{year}</option>)}</select></label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>Period<select value={timeGrouping} onChange={(event) => setTimeGrouping(event.target.value)} style={{ border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", padding: "8px 10px", fontSize: 12, color: "#17212b" }}><option value="year">Year</option><option value="quarter">Quarter</option><option value="month">Month</option><option value="week">Week</option><option value="yearToDate">Year to date</option></select></label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>Branch<select value={selectedBranch} onChange={event => setSelectedBranch(event.target.value)} style={{ border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", padding: "8px 10px", fontSize: 12, color: "#17212b", minWidth: 145 }}><option value="All branches">All branches</option>{availableBranches.map(branch => <option key={branch} value={branch}>{branch}</option>)}</select></label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>Products<select value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)} style={{ border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", padding: "8px 10px", fontSize: 12, color: "#17212b", minWidth: 145 }}><option value="All products">All products</option>{PRODUCT_FILTER_OPTIONS.map((product) => <option key={product} value={product}>{product}</option>)}</select></label>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={330}>
          <BarChart data={monthlyBalanceData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="month" interval="preserveStartEnd" minTickGap={24} axisLine={false} tickLine={false} tick={{ fill: "#8a8a8a", fontSize: 10 }} />
            <YAxis yAxisId="sales" axisLine={false} tickLine={false} tickFormatter={axisMoney} tick={{ fill: "#777", fontSize: 10 }} width={74} />
            <YAxis yAxisId="percent" orientation="right" axisLine={false} tickLine={false} domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: "#64748b", fontSize: 10 }} width={48} />
            <Tooltip content={({ active, payload, label }) => { if (!active || !payload?.length) return null; const row = payload[0]?.payload || {}; const displayLabel = timeGrouping === "week" ? (row.hoverLabel || label) : label; const total = Number(row.total || 0); const moneyShare = value => { const amount = Number(value || 0); return `${money(amount)} (${total > 0 ? (amount / total * 100).toFixed(1) : "0.0"}%)`; }; const style = { fontSize: 11, marginTop: 5 }; const breakdown = salesChartMode === "product" ? PRODUCT_SERIES.map(item => ({ key: item.key, colour: item.colour, value: row[item.key] })) : [{ key: "Missing stage", colour: "#64748b", value: row["Missing stage"] }, { key: "Cancelled", colour: "#ff0000", value: row.Cancelled }, { key: "Decline", colour: "#ff9900", value: row.Decline }, { key: "Solid", colour: "#008000", value: row.Solid }]; return <div style={{ background: "#fff", border: "1px solid #e2e5e8", borderRadius: 8, padding: "10px 12px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}><div style={{ color: "#17212b", fontWeight: 600, marginBottom: 6 }}>{displayLabel} · Total sold: {Number(row.totalSold || 0).toLocaleString("en-GB")}</div>{breakdown.map(item => <div key={item.key} style={{ ...style, color: item.colour }}>{item.key}: {moneyShare(item.value)}</div>)}<div style={{ borderTop: "1px solid #d1d5db", marginTop: 8, paddingTop: 7, fontSize: 11, fontWeight: 600, color: "#17212b" }}>Total net value: {money(Number(row.total || 0))}</div></div> }} />
            <Legend verticalAlign="bottom" height={32} iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {salesChartMode === "result" ? <>
              <Bar yAxisId="sales" dataKey="Solid" name="Net Sales/Solid" stackId="balance" fill="#008000" />
              <Bar yAxisId="sales" dataKey="Decline" name="Net Sales/Decline" stackId="balance" fill="#ff9900" />
              <Bar yAxisId="sales" dataKey="Cancelled" name="Net Sales/Cancel" stackId="balance" fill="#ff0000" />
              <Bar yAxisId="sales" dataKey="Missing stage" name="Missing stage" stackId="balance" fill="#64748b" />
            </> : PRODUCT_SERIES.map(series => <Bar key={series.key} yAxisId="sales" dataKey={series.key} name={series.key} stackId="balance" fill={series.colour} />)}
            <Line yAxisId="percent" type="monotone" dataKey="notSolidPercent" name="Drop Off" stroke="#111827" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ marginTop: 18, background: "#fff", border: "1px solid #e2e5e8", borderRadius: 12, padding: "20px 18px 10px", minWidth: 0, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
          <div><h2 style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "#17212b" }}>Sales Conversion by Month</h2><p style={{ margin: 0, fontSize: 11, color: "#818891" }}>Confirmed (C), price left (P) and sold (S) · 2025 onwards · conversion is sold ÷ price left</p></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12, color: "#475569" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>Year<select value={cpsSelectedYear} onChange={(event) => setCpsSelectedYear(event.target.value)} style={{ border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", padding: "8px 10px", fontSize: 12, color: "#17212b" }}><option value="all">All Time</option><option value="2026">2026</option><option value="2025">2025</option></select></label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>Period<select value={cpsTimeGrouping} onChange={(event) => setCpsTimeGrouping(event.target.value)} style={{ border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", padding: "8px 10px", fontSize: 12, color: "#17212b" }}><option value="year">Year</option><option value="quarter">Quarter</option><option value="month">Month</option><option value="week">Week</option><option value="yearToDate">Year to date</option></select></label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>Products<select value={cpsSelectedProduct} onChange={(event) => setCpsSelectedProduct(event.target.value)} style={{ border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", padding: "8px 10px", fontSize: 12, color: "#17212b", minWidth: 145 }}><option value="All products">All products</option>{["Windows", "Solar & ASHP", "Other"].map(product => <option key={product} value={product}>{product}</option>)}</select></label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>Branch<select value={cpsSelectedBranch} onChange={event => setCpsSelectedBranch(event.target.value)} style={{ border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", padding: "8px 10px", fontSize: 12, color: "#17212b", minWidth: 145 }}><option value="All branches">All branches</option>{["Central Solar", "Central Windows", "Clearline", "Grampian", "HES"].map(branch => <option key={branch} value={branch}>{branch}</option>)}</select></label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "4px 8px", border: "1px solid #e2e5e8", borderRadius: 8, background: "#f8fafc" }}><span style={{ fontWeight: 600, color: "#475569" }}>Display</span><label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}><input type="checkbox" checked={showCpsBars} onChange={event => setShowCpsBars(event.target.checked)} /> <span>Bars</span></label><span style={{ color: "#cbd5e1" }}>|</span><label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}><input type="checkbox" checked={showCpsBoLine} onChange={event => setShowCpsBoLine(event.target.checked)} /> <span style={{ color: "#2563eb" }}>BO%</span></label><label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}><input type="checkbox" checked={showCpsConversionLine} onChange={event => setShowCpsConversionLine(event.target.checked)} /> <span style={{ color: "#111827" }}>Conv</span></label><label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}><input type="checkbox" checked={showCpsDropOffLine} onChange={event => setShowCpsDropOffLine(event.target.checked)} /> <span style={{ color: "#dc2626" }}>Drop Off</span></label><span style={{ color: "#cbd5e1" }}>|</span><label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}><input type="checkbox" checked={showCpsBoTrend} onChange={event => setShowCpsBoTrend(event.target.checked)} /> <span style={{ color: "#2563eb" }}>BO% trend</span></label><label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}><input type="checkbox" checked={showCpsConversionTrend} onChange={event => setShowCpsConversionTrend(event.target.checked)} /> <span style={{ color: "#111827" }}>Conv trend</span></label><label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}><input type="checkbox" checked={showCpsDropOffTrend} onChange={event => setShowCpsDropOffTrend(event.target.checked)} /> <span style={{ color: "#dc2626" }}>Drop Off trend</span></label></div>
          </div>
        </div>
        {cpsLoading ? <div style={{ padding: 28, color: "#667085", fontSize: 12 }}>Loading sales conversion…</div> : cpsError ? <div style={{ padding: 18, color: "#b42318", fontSize: 12 }}>{cpsError}</div> : <ResponsiveContainer width="100%" height={660}>
          <BarChart data={conversionTrendData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="month" interval="preserveStartEnd" minTickGap={24} axisLine={false} tickLine={false} tick={{ fill: "#8a8a8a", fontSize: 10 }} />
            <YAxis yAxisId="count" axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: "#777", fontSize: 10 }} width={55} />
            <YAxis yAxisId="percent" orientation="right" axisLine={false} tickLine={false} domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tickFormatter={value => `${value}%`} tick={{ fill: "#64748b", fontSize: 10 }} width={48} />
            <Tooltip content={({ active, payload, label }) => { if (!active || !payload?.length) return null; const row = payload[0]?.payload || {}; const count = value => Number(value || 0).toLocaleString("en-GB"); const pct = value => `${Number(value || 0).toFixed(1)}%`; const lineStyle = { display: "flex", alignItems: "center", gap: 7, marginTop: 5 }; return <div style={{ background: "#fff", border: "1px solid #e2e5e8", borderRadius: 8, padding: "10px 12px", fontSize: 11, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}><div style={{ color: "#17212b", fontWeight: 600, marginBottom: 6 }}>{row.hoverLabel || label}</div><div style={{ ...lineStyle, color: "#ff0000" }}>C · Confirmed: {count(row.confirmedTotal)}</div><div style={{ ...lineStyle, color: "#ff9900" }}>P · Price left: {count(row.priceTotal)}</div><div style={{ ...lineStyle, color: "#008000" }}>S · Sold: {count(row.soldTotal)}</div><div style={{ ...lineStyle, color: "#008000", marginTop: 2, paddingLeft: 12 }}>Net: {new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number(row.soldNetValue || 0))}</div><div style={{ ...lineStyle, color: "#008000", marginTop: 2, paddingLeft: 12 }}>Solid: {new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number(row.solidNetValue || 0))}</div><div style={{ borderTop: "1px solid #d1d5db", marginTop: 8, paddingTop: 3 }}><div style={{ ...lineStyle, color: "#2563eb" }}>BO%: {pct(row.boPercent)}</div><div style={{ ...lineStyle, color: "#111827" }}>Conv: {pct(row.conversionPercent)}</div><div style={{ ...lineStyle, color: "#111827" }}>Drop Off: {pct(row.dropOffPercent)}</div></div></div> }} />
            <Legend verticalAlign="bottom" height={32} iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {showCpsBars && <><Bar yAxisId="count" dataKey="sold" name="S · Sold" stackId="cps" fill="#008000" /><Bar yAxisId="count" dataKey="priceOnly" name="P · Price left" stackId="cps" fill="#ff9900" /><Bar yAxisId="count" dataKey="confirmedOnly" name="C · Confirmed, no price" stackId="cps" fill="#ff0000" /></>}
            {showCpsConversionLine && <Line yAxisId="percent" type="monotone" dataKey="conversionPercent" name="P → S conversion" stroke="#111827" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />}
            {showCpsBoLine && <Line yAxisId="percent" type="monotone" dataKey="boPercent" name="BO%" stroke="#2563eb" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />}
            {showCpsDropOffLine && <Line yAxisId="percent" type="monotone" dataKey="dropOffPercent" name="Drop Off %" stroke="#dc2626" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />}
            {showCpsBoTrend && <Line yAxisId="percent" type="linear" dataKey="boTrend" name="BO% trend" stroke="#2563eb" strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={false} connectNulls />}
            {showCpsConversionTrend && <Line yAxisId="percent" type="linear" dataKey="conversionTrend" name="Conv trend" stroke="#111827" strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={false} connectNulls />}
            {showCpsDropOffTrend && <Line yAxisId="percent" type="linear" dataKey="dropOffTrend" name="Drop Off trend" stroke="#dc2626" strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={false} connectNulls />}
          </BarChart>
        </ResponsiveContainer>}
      </div>
      <style>{`@media (max-width: 760px) { .sales-performance-two-chart-grid { grid-template-columns: minmax(0, 1fr) !important; } }`}</style>
    </section>
  )
}

export default SalesChart

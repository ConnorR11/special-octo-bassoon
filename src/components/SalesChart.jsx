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

const RESULT_SERIES = [
  { key: "Solid", colour: "#008000" },
  { key: "Decline", colour: "#ff9900" },
  { key: "Cancelled", colour: "#ff0000" },
]
const PRODUCT_SERIES = [
  { key: "Windows", colour: "#1683c7" },
  { key: "Solar", colour: "#d86bdc" },
  { key: "ASHP", colour: "#f59e0b" },
  { key: "Other", colour: "#15803d" },
]

function normaliseResult(deal) {
  const value = String(deal?.pipedrive_stage || deal?.status || "").trim().toLowerCase()
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
          <Tooltip
            labelFormatter={(label) => String(label)}
            formatter={(value, name) => [money(Number(value || 0)), name]}
            contentStyle={{ border: "1px solid #e2e5e8", borderRadius: 8, fontSize: 11 }}
          />
          <Legend verticalAlign="bottom" height={32} iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          {series.map((item) => (
            <Bar key={item.key} dataKey={item.key} name={item.key} stackId={dataKey} fill={item.colour} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function SalesChart({ contracts = [] }) {
  const [selectedProduct, setSelectedProduct] = useState("All products")
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth()
  const currentDay = today.getDate()
  const years = useMemo(() => Array.from({ length: Math.max(0, currentYear - 2019) }, (_, i) => 2020 + i), [currentYear])

  const chartData = useMemo(() => years.map((year) => {
    const row = { year, total: 0 }
    ;[...RESULT_SERIES, ...PRODUCT_SERIES].forEach((item) => { row[item.key] = 0 })
    contracts.forEach((deal) => {
      if (!deal?.sale_date) return
      const date = new Date(`${String(deal.sale_date).slice(0, 10)}T00:00:00`)
      if (Number.isNaN(date.getTime()) || date.getFullYear() !== year) return
      if (date.getMonth() > currentMonth || (date.getMonth() === currentMonth && date.getDate() > currentDay)) return
      const value = Number(deal.net_value || 0)
      if (!Number.isFinite(value) || value <= 0) return
      row[normaliseResult(deal)] += value
      row[normaliseProduct(deal.product)] += value
      row.total += value
    })
    return row
  }), [contracts, years, currentMonth, currentDay])

  const monthlyBalanceData = useMemo(() => {
    const rows = []
    const start = new Date(2020, 0, 1)
    const end = new Date(currentYear, currentMonth, 1)
    for (let cursor = new Date(start); cursor <= end; cursor.setMonth(cursor.getMonth() + 1)) {
      rows.push({
        month: cursor.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
        monthKey: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
        Solid: 0,
        Decline: 0,
        Cancelled: 0,
        total: 0,
        notSolidPercent: 0,
      })
    }
    const rowByMonth = new Map(rows.map((row) => [row.monthKey, row]))
    contracts.forEach((deal) => {
      if (!deal?.sale_date) return
      const date = new Date(`${String(deal.sale_date).slice(0, 10)}T00:00:00`)
      if (Number.isNaN(date.getTime()) || date < start || date > today) return
      const row = rowByMonth.get(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`)
      if (!row) return
      if (selectedProduct !== "All products" && normaliseProduct(deal.product) !== selectedProduct) return
      const amount = Number(deal.net_value || 0)
      if (!Number.isFinite(amount) || amount <= 0) return
      const stage = normaliseResult(deal)
      row[stage] += amount
      row.total += amount
    })
    rows.forEach((row) => { row.notSolidPercent = row.total > 0 ? ((row.Decline + row.Cancelled) / row.total) * 100 : 0 })
    return rows
  }, [contracts, currentYear, currentMonth, currentDay, selectedProduct])

  if (!contracts.length) {
    return <div style={{ marginTop: 18, background: "#fff", border: "1px solid #e2e5e8", borderRadius: 12, padding: 24, color: "#777", fontSize: 12 }}>No sales data available.</div>
  }

  return (
    <section style={{ marginTop: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18 }}>
        <ChartCard title="Sales by Result" subtitle="Year-to-date net sales value by result" data={chartData} series={RESULT_SERIES} dataKey="result" />
        <ChartCard title="Sales by Product" subtitle="Year-to-date net sales value by product" data={chartData} series={PRODUCT_SERIES} dataKey="product" />
      </div>
      <div style={{ marginTop: 18, background: "#fff", border: "1px solid #e2e5e8", borderRadius: 12, padding: "20px 18px 10px", minWidth: 0, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 10 }}><div><h2 style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "#17212b" }}>Net Sales Value by Month</h2><p style={{ margin: 0, fontSize: 11, color: "#818891" }}>Monthly net sales value by deal result · January 2020 onwards</p></div><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#475569" }}>Product<select value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)} style={{ border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", padding: "8px 10px", fontSize: 12, color: "#17212b" }}>{["All products", "Windows", "Solar", "ASHP", "Other"].map((product) => <option key={product} value={product}>{product}</option>)}</select></label></div>
        <ResponsiveContainer width="100%" height={330}>
          <BarChart data={monthlyBalanceData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="month" interval="preserveStartEnd" minTickGap={24} axisLine={false} tickLine={false} tick={{ fill: "#8a8a8a", fontSize: 10 }} />
            <YAxis yAxisId="sales" axisLine={false} tickLine={false} tickFormatter={axisMoney} tick={{ fill: "#777", fontSize: 10 }} width={74} />
            <YAxis yAxisId="percent" orientation="right" axisLine={false} tickLine={false} domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: "#64748b", fontSize: 10 }} width={48} />
            <Tooltip labelFormatter={(label) => label} formatter={(value, name, item) => { if (name === "Not Solid") return null; const total = Number(item?.payload?.total || 0); const share = total > 0 ? (Number(value || 0) / total) * 100 : 0; return [`${money(Number(value || 0))} (${share.toFixed(1)}%)`, name] }} contentStyle={{ border: "1px solid #e2e5e8", borderRadius: 8, fontSize: 11 }} />
            <Legend verticalAlign="bottom" height={32} iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar yAxisId="sales" dataKey="Solid" name="Net Sales/Solid" stackId="balance" fill="#008000" />
            <Bar yAxisId="sales" dataKey="Decline" name="Net Sales/Decline" stackId="balance" fill="#ff9900" />
            <Bar yAxisId="sales" dataKey="Cancelled" name="Net Sales/Cancel" stackId="balance" fill="#ff0000" />
            <Line yAxisId="percent" type="monotone" dataKey="notSolidPercent" name="Not Solid" stroke="#1683c7" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <style>{`@media (max-width: 760px) { .sales-performance-two-chart-grid { grid-template-columns: minmax(0, 1fr) !important; } }`}</style>
    </section>
  )
}

export default SalesChart

import React, { useMemo } from "react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
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

  if (!contracts.length) {
    return <div style={{ marginTop: 18, background: "#fff", border: "1px solid #e2e5e8", borderRadius: 12, padding: 24, color: "#777", fontSize: 12 }}>No sales data available.</div>
  }

  return (
    <section style={{ marginTop: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18 }}>
        <ChartCard title="Sales by Result" subtitle="Year-to-date net sales value by result" data={chartData} series={RESULT_SERIES} dataKey="result" />
        <ChartCard title="Sales by Product" subtitle="Year-to-date net sales value by product" data={chartData} series={PRODUCT_SERIES} dataKey="product" />
      </div>
      <style>{`@media (max-width: 760px) { .sales-performance-two-chart-grid { grid-template-columns: minmax(0, 1fr) !important; } }`}</style>
    </section>
  )
}

export default SalesChart

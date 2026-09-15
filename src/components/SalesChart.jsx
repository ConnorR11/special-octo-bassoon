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

const PRODUCT_COLOURS = [
  "#1683c7",
  "#d86bdc",
  "#f59e0b",
  "#15803d",
  "#6366f1",
  "#64748b",
  "#dc2626",
  "#0f766e",
]

const PRODUCT_ORDER = [
  "Windows",
  "Solar",
  "Air Source Heat Pump",
  "Unassigned",
]

function normaliseProduct(value) {
  const product = String(value ?? "").trim()
  if (!product) return "Unassigned"

  const lower = product.toLowerCase()
  if (lower.includes("window")) return "Windows"
  if (lower.includes("solar")) return "Solar"
  if (lower === "ashp" || lower.includes("air source heat pump") || lower.includes("heat pump")) {
    return "Air Source Heat Pump"
  }

  return product
}

function productColour(product, index) {
  const name = product.toLowerCase()

  if (name === "unassigned") return "#94a3b8"
  if (name === "windows") return "#1683c7"
  if (name === "solar") return "#d86bdc"
  if (name === "air source heat pump") return "#f59e0b"
  if (name === "other") return "#15803d"

  return PRODUCT_COLOURS[index % PRODUCT_COLOURS.length]
}

function SalesChart({ contracts = [] }) {
  const today = new Date()
  const currentMonth = today.getMonth()
  const currentDay = today.getDate()

  const years = useMemo(() => {
    const yearSet = new Set()

    contracts.forEach((contract) => {
      if (!contract.sale_date) return

      const date = new Date(`${contract.sale_date}T00:00:00`)
      if (!Number.isNaN(date.getTime())) {
        yearSet.add(date.getFullYear())
      }
    })

    return Array.from(yearSet)
      .filter((year) => year >= 2020)
      .sort((a, b) => a - b)
  }, [contracts])

  const products = useMemo(() => {
    const productSet = new Set()

    contracts.forEach((contract) => {
      productSet.add(normaliseProduct(contract.product))
    })

    return Array.from(productSet).sort((a, b) => {
      const aIndex = PRODUCT_ORDER.indexOf(a)
      const bIndex = PRODUCT_ORDER.indexOf(b)

      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
      return a.localeCompare(b)
    })
  }, [contracts])

  const chartData = useMemo(() => {
    return years.map((year) => {
      const row = { year }

      products.forEach((product) => {
        row[product] = 0
      })

      contracts.forEach((contract) => {
        if (!contract.sale_date) return

        const date = new Date(`${contract.sale_date}T00:00:00`)
        if (Number.isNaN(date.getTime()) || date.getFullYear() !== year) return

        const month = date.getMonth()
        const day = date.getDate()

        if (month > currentMonth) return
        if (month === currentMonth && day > currentDay) return

        const product = normaliseProduct(contract.product)
        const value = Number(contract.net_value || 0)

        if (Number.isFinite(value)) {
          if (row[product] === undefined) row[product] = 0
          row[product] += value
        }
      })

      return row
    })
  }, [contracts, products, years, currentMonth, currentDay])

  const currentYear = today.getFullYear()
  const previousYear = currentYear - 1

  const yearTotal = useMemo(() => {
    const row = chartData.find((item) => item.year === currentYear)
    if (!row) return 0

    return products.reduce(
      (sum, product) => sum + Number(row[product] || 0),
      0
    )
  }, [chartData, products, currentYear])

  const previousYearTotal = useMemo(() => {
    const row = chartData.find((item) => item.year === previousYear)
    if (!row) return 0

    return products.reduce(
      (sum, product) => sum + Number(row[product] || 0),
      0
    )
  }, [chartData, products, previousYear])

  const yearDifference = yearTotal - previousYearTotal
  const yearDifferencePercent = previousYearTotal > 0
    ? (yearDifference / previousYearTotal) * 100
    : null

  const yAxisTicks = useMemo(() => {
    const maxValue = chartData.reduce((max, row) => {
      const total = products.reduce(
        (sum, product) => sum + Number(row[product] || 0),
        0
      )
      return Math.max(max, total)
    }, 0)

    const step = 2500000
    const maxTick = Math.max(step, Math.ceil(maxValue / step) * step)

    return Array.from(
      { length: maxTick / step + 1 },
      (_, index) => index * step
    )
  }, [chartData, products])

  if (!years.length) {
    return (
      <div className="card sales-chart">
        <div className="card-head">
          <div>
            <h2>Sales Performance</h2>
            <p>No sales data available</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card sales-chart">
      <div className="card-head">
        <div>
          <h2>Sales Performance</h2>
          <p>Year-to-date net sales value by product</p>
        </div>

        <div className="chart-total">
          <span>{currentYear} vs {previousYear} (YTD)</span>
          <b>
            {yearDifference >= 0 ? "+" : ""}{money(yearDifference)}
            {yearDifferencePercent !== null
              ? ` (${yearDifferencePercent >= 0 ? "+" : ""}${yearDifferencePercent.toFixed(1)}%)`
              : ""}
          </b>
          <small>
            {money(yearTotal)} vs {money(previousYearTotal)}
          </small>
        </div>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart
            data={chartData}
            margin={{
              top: 10,
              right: 10,
              left: 0,
              bottom: 5,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
            />

            <XAxis
              dataKey="year"
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              ticks={yAxisTicks}
              domain={[0, yAxisTicks[yAxisTicks.length - 1]]}
              tickFormatter={(value) =>
                value >= 1000000
                  ? `£${(value / 1000000).toFixed(1)}m`
                  : value >= 1000
                    ? `£${Math.round(value / 1000)}k`
                    : `£${value}`
              }
            />

            <Tooltip
              formatter={(value, name) => [money(value), name]}
              labelFormatter={(label) => `${label} YTD`}
            />

            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{
                fontSize: 12,
                paddingTop: 8,
              }}
            />

            {products.map((product, index) => (
              <Bar
                key={product}
                dataKey={product}
                name={product}
                stackId="sales"
                fill={productColour(product, index)}
                radius={
                  index === products.length - 1
                    ? [4, 4, 0, 0]
                    : [0, 0, 0, 0]
                }
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default SalesChart

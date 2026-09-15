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

function normaliseProduct(value) {
  const product = String(value ?? "").trim()
  return product || "Unassigned"
}

function productColour(product, index) {
  const name = product.toLowerCase()

  if (name === "unassigned") return "#94a3b8"
  if (name.includes("window")) return "#1683c7"
  if (name.includes("solar")) return "#d86bdc"
  if (name.includes("ashp") || name.includes("heat pump")) return "#f59e0b"
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

    return Array.from(yearSet).sort((a, b) => a - b)
  }, [contracts])

  const products = useMemo(() => {
    const productSet = new Set()

    contracts.forEach((contract) => {
      productSet.add(normaliseProduct(contract.product))
    })

    return Array.from(productSet).sort((a, b) => {
      if (a === "Unassigned") return 1
      if (b === "Unassigned") return -1
      return a.localeCompare(b)
    })
  }, [contracts])

  /*
   * YEAR-TO-DATE SALES
   *
   * Every year is measured over the same point in the year.
   * For example, if today is 15 September:
   * 2026 = 1 Jan → 15 Sep 2026
   * 2025 = 1 Jan → 15 Sep 2025
   * 2024 = 1 Jan → 15 Sep 2024
   * etc.
   *
   * This prevents complete historical years being compared
   * against only part of the current year.
   */
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

        // Only include sales up to today's month/day for every year.
        if (month > currentMonth) return
        if (month === currentMonth && day > currentDay) return

        const product = normaliseProduct(contract.product)
        const value = Number(contract.net_value || 0)

        if (Number.isFinite(value)) {
          row[product] += value
        }
      })

      return row
    })
  }, [contracts, products, years, currentMonth, currentDay])

  const yearlyTotals = useMemo(() => {
    return chartData.reduce((sum, row) => {
      return sum + products.reduce(
        (productSum, product) => productSum + Number(row[product] || 0),
        0
      )
    }, 0)
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
          <span>Total YTD across all years</span>
          <b>{money(yearlyTotals)}</b>
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

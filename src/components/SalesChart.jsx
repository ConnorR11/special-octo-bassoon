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

function SalesChart({ contracts }) {
  const chart = useMemo(() => {
    const months = []
    const now = new Date()

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)

      months.push({
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        month: date.toLocaleDateString("en-GB", { month: "short" }),
      })
    }

    const products = [
      ...new Set(
        contracts.map((contract) => contract.product).filter(Boolean)
      ),
    ]

    const chartData = months.map((month) => {
      const row = { ...month, total: 0 }

      products.forEach((product) => {
        row[product] = 0
      })

      contracts.forEach((contract) => {
        if (!contract.sale_date) return

        const date = new Date(`${contract.sale_date}T00:00:00`)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

        if (key === month.key) {
          const product = contract.product || "Other"
          const value = Number(contract.deal_value || 0)

          row[product] = (row[product] || 0) + value
          row.total += value
        }
      })

      return row
    })

    return { data: chartData, products }
  }, [contracts])

  const totalValue = chart.data.reduce(
    (total, month) => total + month.total,
    0
  )

  return (
    <div className="card sales-chart">
      <div className="card-head">
        <div>
          <h2>Sales performance</h2>
          <p>Contract value by product — last 12 months</p>
        </div>

        <div className="chart-total">
          <span>12 month value</span>
          <b>{money(totalValue)}</b>
        </div>
      </div>

      {chart.products.length === 0 ? (
        <div className="empty chart-empty">
          No product sales data available yet.
        </div>
      ) : (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={chart.data}
              margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) =>
                  value >= 1000
                    ? `£${Math.round(value / 1000)}k`
                    : `£${value}`
                }
              />
              <Tooltip
                formatter={(value, product) => [money(value), product]}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Legend />

              {chart.products.map((product, index) => (
                <Bar
                  key={product}
                  dataKey={product}
                  stackId="sales"
                  name={product}
                  fill={`hsl(${(index * 67) % 360}, 55%, 45%)`}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default SalesChart

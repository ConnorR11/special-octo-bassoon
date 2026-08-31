import React, { useMemo } from "react"

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"

import { money } from "../utils/formatters"

function ProductBreakdown({ contracts }) {
  const data = useMemo(() => {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ]

    const totals = months.map((month) => ({
      month,
      value: 0,
    }))

    contracts.forEach((contract) => {
      if (!contract.sale_date) return

      const date = new Date(contract.sale_date)

      if (Number.isNaN(date.getTime())) return

      if (date.getFullYear() !== 2026) return

      const monthIndex = date.getMonth()

      totals[monthIndex].value += Number(
        contract.deal_value || 0
      )
    })

    return totals
  }, [contracts])

  const total = data.reduce(
    (sum, month) => sum + month.value,
    0
  )

  return (
    <div className="annual-sales-chart">
      <div className="annual-sales-header">
        <div>
          <h2>2026 sales performance</h2>
          <p>Contract value by month</p>
        </div>

        <div className="annual-sales-total">
          <span>2026 total</span>
          <strong>{money(total)}</strong>
        </div>
      </div>

      <div className="annual-sales-graph">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={data}
            margin={{
              top: 10,
              right: 10,
              left: 10,
              bottom: 5,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
            />

            <XAxis
              dataKey="month"
              tickFormatter={(value) =>
                value.substring(0, 3)
              }
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              tickFormatter={(value) =>
                `£${Number(value).toLocaleString()}`
              }
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={75}
            />

            <Tooltip
              formatter={(value) => [
                money(value),
                "Contract value",
              ]}
              labelFormatter={(label) => label}
            />

            <Bar
              dataKey="value"
              name="Contract value"
              fill="#172554"
              radius={[5, 5, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default ProductBreakdown
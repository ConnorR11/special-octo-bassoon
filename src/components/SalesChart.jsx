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

function SalesChart({ contracts }) {
  const chartData = useMemo(() => {
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

    return months.map((month, index) => {
      const total = contracts.reduce(
        (sum, contract) => {
          if (!contract.sale_date) {
            return sum
          }

          const date = new Date(
            `${contract.sale_date}T00:00:00`
          )

          if (
            date.getFullYear() !== 2026 ||
            date.getMonth() !== index
          ) {
            return sum
          }

          return (
            sum +
            Number(contract.deal_value || 0)
          )
        },
        0
      )

      return {
        month,
        shortMonth: month.substring(0, 3),
        total,
      }
    })
  }, [contracts])

  const totalValue = chartData.reduce(
    (total, month) =>
      total + month.total,
    0
  )

  return (
    <div className="card sales-chart">

      <div className="card-head">

        <div>
          <h2>2026 Sales Performance</h2>

          <p>
            Total contract value by month
          </p>
        </div>

        <div className="chart-total">

          <span>
            2026 value
          </span>

          <b>
            {money(totalValue)}
          </b>

        </div>

      </div>

      <div className="chart-container">

        <ResponsiveContainer
          width="100%"
          height={340}
        >

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
              dataKey="shortMonth"
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) =>
                value >= 1000
                  ? `£${Math.round(
                      value / 1000
                    )}k`
                  : `£${value}`
              }
            />

            <Tooltip
              formatter={(value) => [
                money(value),
                "Contract value",
              ]}
              labelFormatter={(label) =>
                `2026 — ${label}`
              }
            />

            <Bar
              dataKey="total"
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

export default SalesChart
import React, { useMemo } from "react"

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"

import { money } from "../utils/formatters"

function YearOnYearSalesChart({ contracts = [] }) {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ]

  /*
   * Find all years from 2020 onwards
   */

  const years = useMemo(() => {
    const found = contracts
      .filter((contract) => contract.sale_date)
      .map((contract) => {
        const date = new Date(
          `${contract.sale_date}T00:00:00`
        )

        return date.getFullYear()
      })
      .filter((year) => year >= 2020)

    return [...new Set(found)].sort()
  }, [contracts])

  /*
   * Current year
   */

  const currentYear = new Date().getFullYear()

  /*
   * Colours for each year
   */

  const colours = [
    "#2563eb", // Blue
    "#16a34a", // Green
    "#dc2626", // Red
    "#9333ea", // Purple
    "#ea580c", // Orange
    "#0891b2", // Cyan
    "#db2777", // Pink
    "#ca8a04", // Yellow
    "#4f46e5", // Indigo
    "#059669", // Emerald
  ]

  /*
   * Build monthly running totals
   */

  const chartData = useMemo(() => {
    const yearlyTotals = {}

    years.forEach((year) => {
      yearlyTotals[year] = Array(12).fill(0)
    })

    contracts.forEach((contract) => {
      if (!contract.sale_date) {
        return
      }

      const date = new Date(
        `${contract.sale_date}T00:00:00`
      )

      const year = date.getFullYear()
      const month = date.getMonth()

      if (
        year < 2020 ||
        !yearlyTotals[year]
      ) {
        return
      }

      yearlyTotals[year][month] +=
        Number(contract.deal_value || 0)
    })

    /*
     * Convert monthly sales into
     * cumulative running totals
     */

    years.forEach((year) => {
      let runningTotal = 0

      yearlyTotals[year] =
        yearlyTotals[year].map((value) => {
          runningTotal += value
          return runningTotal
        })
    })

    /*
     * Recharts data
     */

    return months.map(
      (month, monthIndex) => {
        const row = {
          month,
        }

        years.forEach((year) => {
          row[year] =
            yearlyTotals[year][monthIndex]
        })

        return row
      }
    )
  }, [contracts, years])

  return (
    <div className="card sales-chart">

      <div className="card-head">

        <div>
          <h2>
            Year-on-Year Sales
          </h2>

          <p>
            Cumulative contract value by month
          </p>
        </div>

      </div>

      <div className="chart-container">

        <ResponsiveContainer
          width="100%"
          height={340}
        >

          <LineChart
            data={chartData}
            margin={{
              top: 10,
              right: 20,
              left: 0,
              bottom: 5,
            }}
          >

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
            />

            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) =>
                value >= 1000000
                  ? `£${(
                      value / 1000000
                    ).toFixed(1)}m`
                  : value >= 1000
                  ? `£${Math.round(
                      value / 1000
                    )}k`
                  : `£${value}`
              }
            />

            <Tooltip
              formatter={(value, name) => [
                money(value),
                name,
              ]}
            />

            <Legend />

            {years.map((year, index) => {
              const isCurrentYear =
                year === currentYear

              return (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={year}
                  name={String(year)}
                  stroke={
                    colours[
                      index %
                        colours.length
                    ]
                  }
                  strokeWidth={
                    isCurrentYear ? 4 : 1.5
                  }
                  dot={false}
                  activeDot={{
                    r: isCurrentYear ? 7 : 5,
                  }}
                  opacity={
                    isCurrentYear ? 1 : 0.65
                  }
                />
              )
            })}

          </LineChart>

        </ResponsiveContainer>

      </div>

    </div>
  )
}

export default YearOnYearSalesChart
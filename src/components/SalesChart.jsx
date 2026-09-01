import React, { useMemo, useState } from "react"

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

function SalesChart({ contracts = [] }) {

  /*
   * FIND ALL YEARS IN THE DATA
   */

  const years = useMemo(() => {
    const yearSet = new Set()

    contracts.forEach((contract) => {
      if (!contract.sale_date) {
        return
      }

      const date = new Date(
        `${contract.sale_date}T00:00:00`
      )

      if (!Number.isNaN(date.getTime())) {
        yearSet.add(date.getFullYear())
      }
    })

    return Array.from(yearSet).sort(
      (a, b) => b - a
    )
  }, [contracts])


  /*
   * DEFAULT TO THE MOST RECENT YEAR
   */

  const [selectedYear, setSelectedYear] =
    useState(null)

  const activeYear =
    selectedYear ?? years[0]


  /*
   * MONTHLY DATA FOR SELECTED YEAR
   */

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

    if (!activeYear) {
      return months.map((month) => ({
        month,
        shortMonth: month.substring(0, 3),
        total: 0,
      }))
    }

    return months.map(
      (month, index) => {

        const total = contracts.reduce(
          (sum, contract) => {

            if (!contract.sale_date) {
              return sum
            }

            const date = new Date(
              `${contract.sale_date}T00:00:00`
            )

            if (
              date.getFullYear() !==
                activeYear ||
              date.getMonth() !== index
            ) {
              return sum
            }

            return (
              sum +
              Number(
                contract.deal_value || 0
              )
            )
          },
          0
        )

        return {
          month,
          shortMonth:
            month.substring(0, 3),
          total,
        }
      }
    )

  }, [contracts, activeYear])


  /*
   * YEAR TOTAL
   */

  const totalValue = chartData.reduce(
    (total, month) =>
      total + month.total,
    0
  )


  /*
   * NO DATA
   */

  if (!years.length) {
    return (
      <div className="card sales-chart">

        <div className="card-head">

          <div>
            <h2>
              Sales Performance
            </h2>

            <p>
              No sales data available
            </p>
          </div>

        </div>

      </div>
    )
  }


  return (
    <div className="card sales-chart">

      <div className="card-head">

        <div>

          <h2>
            {activeYear} Sales Performance
          </h2>

          <p>
            Total contract value by month
          </p>

        </div>


        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
          }}
        >

          {/* YEAR SELECTOR */}

          <select
            value={activeYear}
            onChange={(event) =>
              setSelectedYear(
                Number(event.target.value)
              )
            }
            style={{
              border:
                "1px solid #dddfe3",
              borderRadius: "8px",
              background: "#fff",
              padding: "8px 12px",
              fontSize: "12px",
              color: "#444",
              cursor: "pointer",
            }}
          >

            {years.map((year) => (
              <option
                value={year}
                key={year}
              >
                {year}
              </option>
            ))}

          </select>


          {/* TOTAL */}

          <div className="chart-total">

            <span>
              {activeYear} value
            </span>

            <b>
              {money(totalValue)}
            </b>

          </div>

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
                `${activeYear} — ${label}`
              }
            />

            <Bar
              dataKey="total"
              name="Contract value"
              fill="#172554"
              radius={[
                5,
                5,
                0,
                0,
              ]}
            />

          </BarChart>

        </ResponsiveContainer>

      </div>

    </div>
  )
}

export default SalesChart
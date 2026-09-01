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
  ReferenceLine,
} from "recharts"

import { money } from "../utils/formatters"

function YearOnYearSalesChart({ contracts = [] }) {
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

  /*
   * TODAY
   */

  const today = new Date()

  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth()
  const currentDay = today.getDate()

  /*
   * Only display months up to
   * the current month.
   *
   * Example:
   *
   * September 1st
   * = January -> September
   */

  const visibleMonths = months.slice(
    0,
    currentMonth + 1
  )

  /*
   * Find all years from 2020 onwards.
   */

  const years = useMemo(() => {
    const found = contracts
      .filter(
        (contract) =>
          contract.sale_date
      )
      .map((contract) => {
        const date = new Date(
          `${contract.sale_date}T00:00:00`
        )

        return date.getFullYear()
      })
      .filter(
        (year) => year >= 2020
      )

    return [
      ...new Set(found),
    ].sort()
  }, [contracts])

  /*
   * COLOURS
   */

  const colours = [
    "#2563eb",
    "#16a34a",
    "#dc2626",
    "#9333ea",
    "#ea580c",
    "#0891b2",
    "#db2777",
    "#ca8a04",
    "#4f46e5",
    "#059669",
  ]

  /*
   * BUILD MONTHLY SALES
   *
   * ONLY SALES ON OR BEFORE TODAY
   * ARE INCLUDED.
   */

  const monthlySales = useMemo(() => {
    const yearlyTotals = {}

    years.forEach((year) => {
      yearlyTotals[year] =
        Array(12).fill(0)
    })

    contracts.forEach((contract) => {
      if (!contract.sale_date) {
        return
      }

      /*
       * Parse the sale date.
       */

      const date = new Date(
        `${contract.sale_date}T00:00:00`
      )

      const year =
        date.getFullYear()

      const month =
        date.getMonth()

      /*
       * Ignore anything before 2020.
       */

      if (year < 2020) {
        return
      }

      /*
       * Ignore years that don't exist
       * in our dataset.
       */

      if (!yearlyTotals[year]) {
        return
      }

      /*
       * IMPORTANT:
       *
       * Ignore any sale after TODAY.
       *
       * This means:
       *
       * Yesterday     = included
       * Today         = included
       * Tomorrow      = excluded
       */

      if (date > today) {
        return
      }

      /*
       * Add the sale.
       */

      yearlyTotals[year][month] +=
        Number(
          contract.deal_value || 0
        )
    })

    /*
     * Convert monthly sales into
     * cumulative running totals.
     */

    years.forEach((year) => {
      let runningTotal = 0

      yearlyTotals[year] =
        yearlyTotals[year].map(
          (value, monthIndex) => {

            /*
             * Don't calculate future
             * months for the current year.
             */

            if (
              year === currentYear &&
              monthIndex > currentMonth
            ) {
              return null
            }

            runningTotal += value

            return runningTotal
          }
        )
    })

    return yearlyTotals
  }, [
    contracts,
    years,
    currentYear,
    currentMonth,
    today,
  ])

  /*
   * BUILD CHART DATA
   *
   * IMPORTANT:
   *
   * We use visibleMonths rather than
   * all 12 months.
   *
   * Therefore the X-axis itself stops
   * at the current month.
   */

  const chartData = useMemo(() => {
    return visibleMonths.map(
      (month, index) => {

        const row = {
          month,
          monthIndex: index,
        }

        years.forEach((year) => {
          row[year] =
            monthlySales[year]?.[
              index
            ] ?? null
        })

        return row
      }
    )
  }, [
    visibleMonths,
    years,
    monthlySales,
  ])

  /*
   * YTD TOTALS
   *
   * Compare every year at the same
   * point in the calendar.
   */

  const ytdTotals = useMemo(() => {
    return years.map((year) => {

      const values =
        monthlySales[year] || []

      const value =
        values[currentMonth] || 0

      return {
        year,
        value,
      }
    })
  }, [
    years,
    monthlySales,
    currentMonth,
  ])

  /*
   * CURRENT YEAR YTD
   */

  const currentYTD =
    ytdTotals.find(
      (item) =>
        item.year === currentYear
    )?.value || 0

  /*
   * PREVIOUS YEAR YTD
   */

  const previousYTD =
    ytdTotals.find(
      (item) =>
        item.year ===
        currentYear - 1
    )?.value || 0

  /*
   * YEAR-ON-YEAR CHANGE
   */

  const yoyChange =
    previousYTD > 0
      ? ((currentYTD -
          previousYTD) /
          previousYTD) *
        100
      : null

  /*
   * AXIS FORMAT
   */

  function formatAxisValue(value) {
    if (value >= 1000000) {
      return `£${(
        value / 1000000
      ).toFixed(1)}m`
    }

    if (value >= 1000) {
      return `£${Math.round(
        value / 1000
      )}k`
    }

    return `£${value}`
  }

  /*
   * TOOLTIP
   */

  function CustomTooltip({
    active,
    payload,
    label,
  }) {
    if (
      !active ||
      !payload ||
      !payload.length
    ) {
      return null
    }

    return (
      <div
        style={{
          background: "#fff",
          border:
            "1px solid #e5e7eb",
          borderRadius: "8px",
          padding:
            "12px 14px",
          boxShadow:
            "0 4px 14px rgba(0,0,0,0.08)",
        }}
      >

        <strong
          style={{
            display: "block",
            marginBottom:
              "8px",
            fontSize: "12px",
          }}
        >
          {label}
        </strong>

        {payload
          .filter(
            (item) =>
              item.value !==
                null &&
              item.value !==
                undefined
          )
          .sort(
            (a, b) =>
              Number(b.value) -
              Number(a.value)
          )
          .map((item) => (
            <div
              key={
                item.dataKey
              }
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                gap: "30px",
                fontSize:
                  "11px",
                marginTop:
                  "4px",
              }}
            >

              <span
                style={{
                  color:
                    item.color,
                  fontWeight:
                    Number(
                      item.dataKey
                    ) ===
                    currentYear
                      ? 700
                      : 400,
                }}
              >
                {item.name}
              </span>

              <strong>
                {money(
                  item.value
                )}
              </strong>

            </div>
          ))}

      </div>
    )
  }

  return (
    <div className="card sales-chart">

      {/* HEADER */}

      <div className="card-head">

        <div>

          <h2>
            Year-on-Year Sales
          </h2>

          <p>
            Cumulative contract value
            by month
          </p>

        </div>

      </div>

      {/* SUMMARY */}

      <div
        style={{
          display:
            "grid",
          gridTemplateColumns:
            "repeat(3, 1fr)",
          gap: "12px",
          marginBottom:
            "20px",
        }}
      >

        {/* CURRENT YEAR */}

        <div
          style={{
            padding:
              "14px",
            background:
              "#fafafa",
            borderRadius:
              "8px",
          }}
        >

          <span
            style={{
              display:
                "block",
              fontSize:
                "10px",
              color:
                "#888",
              marginBottom:
                "5px",
            }}
          >
            {currentYear} YTD
          </span>

          <strong
            style={{
              fontSize:
                "20px",
            }}
          >
            {money(
              currentYTD
            )}
          </strong>

        </div>

        {/* PREVIOUS YEAR */}

        <div
          style={{
            padding:
              "14px",
            background:
              "#fafafa",
            borderRadius:
              "8px",
          }}
        >

          <span
            style={{
              display:
                "block",
              fontSize:
                "10px",
              color:
                "#888",
              marginBottom:
                "5px",
            }}
          >
            {currentYear - 1} YTD
          </span>

          <strong
            style={{
              fontSize:
                "20px",
            }}
          >
            {money(
              previousYTD
            )}
          </strong>

        </div>

        {/* YOY */}

        <div
          style={{
            padding:
              "14px",
            background:
              "#fafafa",
            borderRadius:
              "8px",
          }}
        >

          <span
            style={{
              display:
                "block",
              fontSize:
                "10px",
              color:
                "#888",
              marginBottom:
                "5px",
            }}
          >
            Year-on-year
          </span>

          <strong
            style={{
              fontSize:
                "20px",
              color:
                yoyChange ===
                null
                  ? "#333"
                  : yoyChange >=
                    0
                  ? "#28734c"
                  : "#a33b3b",
            }}
          >
            {yoyChange ===
            null
              ? "—"
              : `${
                  yoyChange >=
                  0
                    ? "+"
                    : ""
                }${yoyChange.toFixed(
                  1
                )}%`}
          </strong>

        </div>

      </div>

      {/* CHART */}

      <div className="chart-container">

        <ResponsiveContainer
          width="100%"
          height={680}
        >

          <LineChart
            data={chartData}
            margin={{
              top: 30,
              right: 30,
              left: 10,
              bottom: 20,
            }}
          >

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#eeeeee"
            />

            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{
                fontSize: 11,
              }}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{
                fontSize: 10,
              }}
              tickFormatter={
                formatAxisValue
              }
            />

            {/* CURRENT MONTH */}

            <ReferenceLine
              x={
                months[
                  currentMonth
                ]
              }
              stroke="#999"
              strokeDasharray="4 4"
              label={{
                value:
                  `Today — ${currentDay}/${currentMonth + 1}`,
                position:
                  "top",
                fontSize:
                  10,
                fill:
                  "#777",
              }}
            />

            <Tooltip
              content={
                <CustomTooltip />
              }
            />

            <Legend />

            {/* YEAR LINES */}

            {years.map(
              (
                year,
                index
              ) => {

                const isCurrentYear =
                  year ===
                  currentYear

                return (
                  <Line
                    key={year}
                    type="monotone"
                    dataKey={
                      year
                    }
                    name={String(
                      year
                    )}
                    stroke={
                      colours[
                        index %
                          colours.length
                      ]
                    }
                    strokeWidth={
                      isCurrentYear
                        ? 4
                        : 1.5
                    }
                    opacity={
                      isCurrentYear
                        ? 1
                        : 0.55
                    }
                    dot={
                      isCurrentYear
                        ? {
                            r: 3,
                          }
                        : false
                    }
                    activeDot={{
                      r:
                        isCurrentYear
                          ? 7
                          : 5,
                    }}
                    connectNulls={
                      false
                    }
                  />
                )
              }
            )}

          </LineChart>

        </ResponsiveContainer>

      </div>

    </div>
  )
}

export default YearOnYearSalesChart
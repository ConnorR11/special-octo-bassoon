import React, { useMemo, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
} from "lucide-react"

import { money } from "../utils/formatters"

function SalesBreakdown({ contracts = [] }) {
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

  // Build the sales data automatically from whatever
  // years exist in the database.
  const yearlyData = useMemo(() => {
    const years = {}

    contracts.forEach((contract) => {
      if (!contract.sale_date) {
        return
      }

      const date = new Date(contract.sale_date)

      if (Number.isNaN(date.getTime())) {
        return
      }

      const year = date.getFullYear()
      const month = date.getMonth()
      const value = Number(contract.deal_value || 0)

      if (!years[year]) {
        years[year] = months.map((monthName) => ({
          month: monthName,
          value: 0,
        }))
      }

      years[year][month].value += value
    })

    return Object.entries(years)
      .map(([year, monthlyTotals]) => ({
        year: Number(year),
        monthlyTotals,
        total: monthlyTotals.reduce(
          (sum, item) => sum + item.value,
          0
        ),
      }))
      .sort((a, b) => b.year - a.year)
  }, [contracts])

  // Open the most recent year by default
  const [expandedYear, setExpandedYear] = useState(null)

  React.useEffect(() => {
    if (
      expandedYear === null &&
      yearlyData.length > 0
    ) {
      setExpandedYear(yearlyData[0].year)
    }
  }, [yearlyData, expandedYear])

  function toggleYear(year) {
    setExpandedYear(
      expandedYear === year ? null : year
    )
  }

  if (!yearlyData.length) {
    return (
      <div className="empty">
        No sales data available.
      </div>
    )
  }

  return (
    <div className="sales-breakdown">

      {yearlyData.map((yearData) => {

        const isExpanded =
          expandedYear === yearData.year

        const max = Math.max(
          ...yearData.monthlyTotals.map(
            (item) => item.value
          ),
          1
        )

        return (
          <div
            className="sales-year"
            key={yearData.year}
          >

            {/* YEAR */}

            <button
              type="button"
              className="sales-year-header"
              onClick={() =>
                toggleYear(yearData.year)
              }
            >

              <div className="sales-year-title">

                {isExpanded ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}

                <strong>
                  {yearData.year}
                </strong>

              </div>

              <strong>
                {money(yearData.total)}
              </strong>

            </button>


            {/* MONTHS */}

            {isExpanded && (

              <div className="sales-year-months">

                {yearData.monthlyTotals.map(
                  ({ month, value }) => (

                    <div
                      className="bar-row"
                      key={month}
                    >

                      <div>

                        <span>
                          {month}
                        </span>

                        <b>
                          {money(value)}
                        </b>

                      </div>

                      <div className="bar">

                        <i
                          style={{
                            width:
                              `${(value / max) * 100}%`,
                          }}
                        />

                      </div>

                    </div>

                  )
                )}

              </div>

            )}

          </div>
        )
      })}

    </div>
  )
}

export default SalesBreakdown
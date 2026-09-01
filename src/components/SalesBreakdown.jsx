import React, { useMemo } from "react"
import { money } from "../utils/formatters"

function SalesBreakdown({ contracts = [] }) {
  const startYear = 2020
  const currentYear = new Date().getFullYear()

  const years = Array.from(
    { length: currentYear - startYear + 1 },
    (_, index) => startYear + index
  )

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
   * BUILD YEAR-ON-YEAR DATA
   */

  const yearlyData = useMemo(() => {
    return years.map((year) => {

      const monthlyTotals = months.map(
        (month, monthIndex) => {

          const value = contracts.reduce(
            (sum, contract) => {

              if (!contract.sale_date) {
                return sum
              }

              const date = new Date(
                `${contract.sale_date}T00:00:00`
              )

              if (
                Number.isNaN(date.getTime())
              ) {
                return sum
              }

              if (
                date.getFullYear() !== year ||
                date.getMonth() !== monthIndex
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
            value,
          }
        }
      )

      const total = monthlyTotals.reduce(
        (sum, month) =>
          sum + month.value,
        0
      )

      return {
        year,
        monthlyTotals,
        total,
      }
    })
  }, [contracts, years])


  /*
   * ONLY SHOW YEARS THAT HAVE DATA
   */

  const activeYears = yearlyData.filter(
    (year) => year.total > 0
  )


  /*
   * MONTHLY COMPARISON
   */

  const comparisonData = months.map(
    (month, monthIndex) => {

      const values = {}

      activeYears.forEach((yearData) => {
        values[yearData.year] =
          yearData.monthlyTotals[
            monthIndex
          ].value
      })

      return {
        month,
        values,
      }
    }
  )


  /*
   * IF THERE IS NO DATA
   */

  if (!activeYears.length) {
    return (
      <div className="empty">
        No sales data available.
      </div>
    )
  }


  return (
    <div className="sales-breakdown">

      {/* YEAR TOTALS */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "120px repeat(auto-fit, minmax(90px, 1fr))",
          gap: "10px",
          padding: "12px 0",
          borderBottom:
            "1px solid #e5e6e8",
          minWidth:
            `${120 + activeYears.length * 100}px`,
        }}
      >

        <div>
          <strong
            style={{
              fontSize: "10px",
              color: "#888",
            }}
          >
            Year
          </strong>
        </div>

        {activeYears.map((yearData) => (

          <div
            key={yearData.year}
            style={{
              textAlign: "right",
            }}
          >

            <span
              style={{
                display: "block",
                fontSize: "10px",
                color: "#888",
              }}
            >
              {yearData.year}
            </span>

            <strong
              style={{
                display: "block",
                fontSize: "13px",
                marginTop: "3px",
              }}
            >
              {money(yearData.total)}
            </strong>

          </div>

        ))}

      </div>


      {/* MONTHLY COMPARISON */}

      <div
        style={{
          overflowX: "auto",
        }}
      >

        <div
          style={{
            minWidth:
              `${120 + activeYears.length * 100}px`,
          }}
        >

          {comparisonData.map(
            ({ month, values }) => (

              <div
                key={month}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "120px repeat(" +
                    activeYears.length +
                    ", minmax(90px, 1fr))",
                  gap: "10px",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom:
                    "1px solid #f0f0f0",
                }}
              >

                {/* MONTH */}

                <div>

                  <span
                    style={{
                      fontSize: "10px",
                      color: "#666",
                    }}
                  >
                    {month}
                  </span>

                </div>


                {/* YEAR VALUES */}

                {activeYears.map(
                  (yearData) => {

                    const value =
                      values[
                        yearData.year
                      ] || 0

                    return (
                      <div
                        key={
                          yearData.year
                        }
                        style={{
                          textAlign: "right",
                        }}
                      >

                        <span
                          style={{
                            fontSize: "10px",
                            color:
                              value > 0
                                ? "#333"
                                : "#bbb",
                          }}
                        >
                          {money(value)}
                        </span>

                      </div>
                    )
                  }
                )}

              </div>

            )
          )}


          {/* TOTAL ROW */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "120px repeat(" +
                activeYears.length +
                ", minmax(90px, 1fr))",
              gap: "10px",
              padding:
                "14px 0 8px",
              marginTop: "4px",
              borderTop:
                "2px solid #e5e6e8",
            }}
          >

            <div>

              <strong
                style={{
                  fontSize: "10px",
                }}
              >
                Total
              </strong>

            </div>

            {activeYears.map(
              (yearData) => (

                <div
                  key={yearData.year}
                  style={{
                    textAlign:
                      "right",
                  }}
                >

                  <strong
                    style={{
                      fontSize: "11px",
                    }}
                  >
                    {money(
                      yearData.total
                    )}
                  </strong>

                </div>

              )
            )}

          </div>

        </div>

      </div>

    </div>
  )
}

export default SalesBreakdown
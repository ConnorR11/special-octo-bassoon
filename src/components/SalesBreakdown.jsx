import React from "react"
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

  // Find every year represented in the deals
  const years = [
    ...new Set(
      contracts
        .filter((contract) => contract.sale_date)
        .map((contract) =>
          new Date(contract.sale_date).getFullYear()
        )
    ),
  ].sort((a, b) => b - a)

  return (
    <div className="sales-breakdown">

      {years.map((year) => {

        const monthlyTotals = months.map(
          (month, monthIndex) => {

            const value = contracts
              .filter((contract) => {
                if (!contract.sale_date) {
                  return false
                }

                const date = new Date(
                  contract.sale_date
                )

                return (
                  date.getFullYear() === year &&
                  date.getMonth() === monthIndex
                )
              })
              .reduce(
                (sum, contract) =>
                  sum +
                  Number(
                    contract.deal_value || 0
                  ),
                0
              )

            return {
              month,
              value,
            }
          }
        )

        const max = Math.max(
          ...monthlyTotals.map(
            (item) => item.value
          ),
          1
        )

        const total = monthlyTotals.reduce(
          (sum, item) =>
            sum + item.value,
          0
        )

        return (
          <div
            className="sales-year"
            key={year}
          >

            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "flex-start",
                marginBottom: "20px",
              }}
            >

              <div>

                <h3
                  style={{
                    margin: 0,
                    fontSize: "16px",
                  }}
                >
                  {year}
                </h3>

                <span
                  style={{
                    display: "block",
                    color: "#888",
                    fontSize: "10px",
                    marginTop: "4px",
                  }}
                >
                  Annual sales
                </span>

                <strong
                  style={{
                    display: "block",
                    fontSize: "20px",
                    marginTop: "4px",
                  }}
                >
                  {money(total)}
                </strong>

              </div>

            </div>

            {monthlyTotals.map(
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
        )
      })}

      {years.length === 0 && (
        <div className="empty">
          No sales data available.
        </div>
      )}

    </div>
  )
}

export default SalesBreakdown
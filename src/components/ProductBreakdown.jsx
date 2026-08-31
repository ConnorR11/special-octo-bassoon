import React from "react"
import { money } from "../utils/formatters"

function ProductBreakdown({ contracts }) {
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

  const monthlyTotals = months.map((month, index) => {
    const total = contracts
      .filter((contract) => {
        if (!contract.sale_date) return false

        const date = new Date(contract.sale_date)

        return (
          date.getFullYear() === 2026 &&
          date.getMonth() === index
        )
      })
      .reduce(
        (sum, contract) =>
          sum + Number(contract.deal_value || 0),
        0
      )

    return {
      month,
      value: total,
    }
  })

  const max = Math.max(
    ...monthlyTotals.map((item) => item.value),
    1
  )

  const total2026 = monthlyTotals.reduce(
    (sum, item) => sum + item.value,
    0
  )

  return (
    <div className="breakdown">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "20px",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>
            2026 Sales
          </h2>

          <p>
            Total contract value by month
          </p>
        </div>

        <div style={{ textAlign: "right" }}>
          <span
            style={{
              display: "block",
              color: "#888",
              fontSize: "10px",
            }}
          >
            2026 total
          </span>

          <strong
            style={{
              display: "block",
              fontSize: "18px",
              marginTop: "3px",
            }}
          >
            {money(total2026)}
          </strong>
        </div>
      </div>

      {monthlyTotals.map(({ month, value }) => (
        <div className="bar-row" key={month}>
          <div>
            <span>{month}</span>
            <b>{money(value)}</b>
          </div>

          <div className="bar">
            <i
              style={{
                width: `${(value / max) * 100}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export default ProductBreakdown
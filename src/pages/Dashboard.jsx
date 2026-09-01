import React from "react"

import {
  FileText,
  PoundSterling,
  CalendarDays,
  ChevronRight,
} from "lucide-react"

import Stat from "../components/Stat"
import SalesChart from "../components/SalesChart"
import AnnualBreakdown from "../components/EPVS/AnnualBreakdown"

import {
  formatDate,
  getInitials,
  money,
} from "../utils/formatters"

function Dashboard({
  contracts,
  total,
  avg,
  upcoming,
  loading,
  setPage,
  setSelected,
}) {
  return (
    <section>
      {/* STATS */}

      <div className="stats">
        <Stat
          icon={<FileText size={20} />}
          label="Deals"
          value={contracts.length}
        />

        <Stat
          icon={<PoundSterling size={20} />}
          label="Contract value"
          value={money(total)}
        />

        <Stat
          icon={<PoundSterling size={20} />}
          label="Average contract"
          value={money(avg)}
        />

        <Stat
          icon={<CalendarDays size={20} />}
          label="Upcoming installations"
          value={upcoming}
        />
      </div>

      {/* SALES CHART */}

      <SalesChart contracts={contracts} />

      {/* LOWER DASHBOARD */}

      <div className="grid2">

        {/* RECENT CONTRACTS */}

        <div className="card">
          <div className="card-head">
            <div>
              <h2>Recent contracts</h2>

              <p>
                Latest sold deals
              </p>
            </div>

            <button
              className="link"
              onClick={() => setPage("contracts")}
            >
              View all

              <ChevronRight size={16} />
            </button>
          </div>

          {loading ? (
            <div className="empty">
              Loading…
            </div>
          ) : contracts.length === 0 ? (
            <div className="empty">
              No contracts found.
            </div>
          ) : (
            <div className="rows">

              {contracts
                .slice(0, 6)
                .map((contract) => (
                  <button
                    className="contract-row"
                    key={contract.id}
                    onClick={() =>
                      setSelected(contract)
                    }
                  >

                    <div className="avatar">
                      {getInitials(
                        contract.customer_name
                      )}
                    </div>

                    <div className="row-main">
                      <b>
                        {contract.customer_name ||
                          "Unnamed customer"}
                      </b>

                      <span>
                        {contract.product || "—"}
                        {" · "}
                        {contract.postcode || "—"}
                      </span>
                    </div>

                    <div className="row-value">
                      <b>
                        {money(
                          contract.deal_value
                        )}
                      </b>

                      <span>
                        {formatDate(
                          contract.sale_date
                        )}
                      </span>
                    </div>

                    <ChevronRight size={16} />

                  </button>
                ))}

            </div>
          )}
        </div>

        {/* 2026 SALES */}

        <div className="card">

          <div className="card-head">
            <div>
              <h2>2026 Sales</h2>

              <p>
                Contract value by month
              </p>
            </div>
          </div>

          <Sales2026 contracts={contracts} />

        </div>

      </div>
    </section>
  )
}


/*
 * 2026 MONTHLY SALES
 */

function Sales2026({ contracts }) {

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
            date.getFullYear() === 2026 &&
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

  const total2026 =
    monthlyTotals.reduce(
      (sum, item) =>
        sum + item.value,
      0
    )

  return (
    <div className="breakdown">

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
              fontSize: "20px",
              marginTop: "4px",
            }}
          >
            {money(total2026)}
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
              <span>{month}</span>

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
}

export default Dashboard
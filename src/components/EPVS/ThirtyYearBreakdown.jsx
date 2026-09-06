import React, {
  useMemo,
  useState,
} from "react"

const money = (value) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

const number = (value) =>
  Number(value || 0).toLocaleString(
    "en-GB",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )

const percent = (value) =>
  `${(
    Number(value || 0) * 100
  ).toFixed(1)}%`

export default function ThirtyYearBreakdown({
  thirtyYearProjection,
}) {
  const [selectedScenario, setSelectedScenario] =
    useState("averageInflation")

  if (!thirtyYearProjection) {
    return null
  }

  const {
    scenarios = {},
    inflationScenarios = [],
  } = thirtyYearProjection

  const scenario =
    scenarios[selectedScenario] ||
    scenarios.averageInflation

  if (!scenario) {
    return null
  }

  const {
    rows = [],
    totals = {},
    paybackPeriod,
    totalNetSavings,
    finalNetPosition,
  } = scenario

  const selectedInflation =
    scenario.inflationRate || 0

  const firstYear =
    rows[0] || {}

  const lastYear =
    rows[rows.length - 1] || {}

  return (
    <div
      style={{
        marginTop: 24,
      }}
    >
      {/* =================================================
          INTRO
      ================================================= */}

      <div
        className="card"
        style={{
          padding: 20,
          marginBottom: 14,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            color: "#475569",
          }}
        >
          30 Year Benefit Breakdown
        </h2>

        <p
          style={{
            margin: "14px 0 0",
            fontSize: 12,
            lineHeight: 1.7,
            color: "#475569",
          }}
        >
          The extended projections are
          illustrative estimates based on
          the customer's current electricity
          consumption, the entered EPVS
          generation figures, panel
          degradation and the selected
          inflation scenario.
        </p>

        <p
          style={{
            margin: "10px 0 0",
            fontSize: 12,
            lineHeight: 1.7,
            color: "#475569",
          }}
        >
          EPVS guidance states that where
          inflation is used, consumers should
          be shown multiple scenarios. This
          calculator therefore shows 0%,
          midpoint inflation and the 7.6%
          average inflation scenario.
        </p>
      </div>

      {/* =================================================
          SCENARIO SELECTOR
      ================================================= */}

      <div
        className="card"
        style={{
          padding: 18,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                color: "#334155",
                fontSize: 16,
              }}
            >
              Inflation scenario
            </h3>

            <p
              style={{
                margin: "5px 0 0",
                color: "#64748b",
                fontSize: 11,
              }}
            >
              Select the scenario displayed
              in the detailed projection.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {inflationScenarios.map(
              (item) => {
                const active =
                  item.key ===
                  selectedScenario

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      setSelectedScenario(
                        item.key
                      )
                    }
                    style={{
                      border: active
                        ? "1px solid #172554"
                        : "1px solid #d7dee8",

                      background: active
                        ? "#172554"
                        : "#fff",

                      color: active
                        ? "#fff"
                        : "#334155",

                      borderRadius: 8,
                      padding:
                        "9px 13px",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {item.label}
                  </button>
                )
              }
            )}
          </div>
        </div>
      </div>

      {/* =================================================
          SCENARIO SUMMARIES
      ================================================= */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <ScenarioCard
          title="0% inflation"
          scenario={
            scenarios.noInflation
          }
          active={
            selectedScenario ===
            "noInflation"
          }
        />

        <ScenarioCard
          title="3.8% inflation"
          scenario={
            scenarios.midpointInflation
          }
          active={
            selectedScenario ===
            "midpointInflation"
          }
        />

        <ScenarioCard
          title="7.6% inflation"
          scenario={
            scenarios.averageInflation
          }
          active={
            selectedScenario ===
            "averageInflation"
          }
        />
      </div>

      {/* =================================================
          SELECTED SCENARIO SUMMARY
      ================================================= */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(5, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <SummaryCard
          label="Inflation"
          value={percent(
            selectedInflation
          )}
        />

        <SummaryCard
          label="First year benefit"
          value={money(
            firstYear.annualBenefit
          )}
        />

        <SummaryCard
          label="Payback period"
          value={
            paybackPeriod
              ? `${paybackPeriod} years`
              : "Not achieved"
          }
        />

        <SummaryCard
          label="30 year net savings"
          value={money(
            totalNetSavings
          )}
        />

        <SummaryCard
          label="Final net position"
          value={money(
            finalNetPosition
          )}
        />
      </div>

      {/* =================================================
          FINANCE INFORMATION
      ================================================= */}

      <div
        className="card"
        style={{
          padding: 16,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, 1fr)",
            gap: 12,
          }}
        >
          <MiniMetric
            label="Total finance payments"
            value={money(
              totals.financePayment
            )}
          />

          <MiniMetric
            label="Replacement costs"
            value={money(
              totals.replacementPayment
            )}
          />

          <MiniMetric
            label="Total yearly payments"
            value={money(
              totals.yearlyPayment
            )}
          />

          <MiniMetric
            label="Total annual benefits"
            value={money(
              totals.annualBenefit
            )}
          />
        </div>
      </div>

      {/* =================================================
          TABLE
      ================================================= */}

      <div
        className="card"
        style={{
          padding: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            overflowX: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              minWidth: 1450,
              borderCollapse:
                "collapse",
              fontSize: 11,
            }}
          >
            <thead>
              <tr>
                <HeaderCell>
                  YR
                </HeaderCell>

                <HeaderCell>
                  GENERATION
                  <br />
                  kWh
                </HeaderCell>

                <HeaderCell>
                  SOLAR
                  <br />
                  BENEFIT
                </HeaderCell>

                <HeaderCell>
                  BATTERY
                  <br />
                  BENEFIT
                </HeaderCell>

                <HeaderCell>
                  EXPORT
                  <br />
                  BENEFIT
                </HeaderCell>

                <HeaderCell green>
                  TOTAL ANNUAL
                  <br />
                  BENEFIT
                </HeaderCell>

                <HeaderCell>
                  REPLACEMENT
                  <br />
                  COST
                </HeaderCell>

                <HeaderCell>
                  YEARLY
                  <br />
                  PAYMENTS
                </HeaderCell>

                <HeaderCell>
                  NET ANNUAL
                  <br />
                  BENEFIT
                </HeaderCell>

                <HeaderCell green>
                  NET
                  <br />
                  POSITION
                </HeaderCell>

                <HeaderCell>
                  BILL PRE
                  <br />
                  INSTALL
                </HeaderCell>

                <HeaderCell>
                  BILL POST
                  <br />
                  INSTALL
                </HeaderCell>

                <HeaderCell>
                  IMPORT
                  <br />
                  RATE
                </HeaderCell>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.year}>
                  <BodyCell>
                    {row.year}
                  </BodyCell>

                  <BodyCell>
                    {number(
                      row.generation
                    )}
                  </BodyCell>

                  <BodyCell>
                    {money(
                      row.solarBenefit
                    )}
                  </BodyCell>

                  <BodyCell>
                    {money(
                      row.batteryBenefit
                    )}
                  </BodyCell>

                  <BodyCell>
                    {money(
                      row.exportBenefit
                    )}
                  </BodyCell>

                  <BodyCell green>
                    {money(
                      row.annualBenefit
                    )}
                  </BodyCell>

                  <BodyCell>
                    {row.replacementPayment >
                    0
                      ? `-${money(
                          row.replacementPayment
                        )}`
                      : money(0)}
                  </BodyCell>

                  <BodyCell>
                    {row.financePayment >
                    0
                      ? `-${money(
                          row.financePayment
                        )}`
                      : money(0)}
                  </BodyCell>

                  <BodyCell
                    negative={
                      row.netAnnualBenefit <
                      0
                    }
                  >
                    {money(
                      row.netAnnualBenefit
                    )}
                  </BodyCell>

                  <BodyCell
                    green={
                      row.cumulativePosition >=
                      0
                    }
                    negative={
                      row.cumulativePosition <
                      0
                    }
                  >
                    {money(
                      row.cumulativePosition
                    )}
                  </BodyCell>

                  <BodyCell>
                    {money(
                      row.billPreInstall
                    )}
                  </BodyCell>

                  <BodyCell>
                    {money(
                      row.billPostInstall
                    )}
                  </BodyCell>

                  <BodyCell>
                    {row.importRate.toFixed(
                      3
                    )}
                  </BodyCell>
                </tr>
              ))}

              {/* TOTALS */}

              <tr>
                <td
                  style={{
                    ...totalCell,
                    textAlign: "left",
                  }}
                >
                  TOTALS
                </td>

                <td
                  style={totalCell}
                >
                  {number(
                    totals.generation
                  )}
                </td>

                <td
                  style={totalCell}
                >
                  {money(
                    totals.solarBenefit
                  )}
                </td>

                <td
                  style={totalCell}
                >
                  {money(
                    totals.batteryBenefit
                  )}
                </td>

                <td
                  style={totalCell}
                >
                  {money(
                    totals.exportBenefit
                  )}
                </td>

                <td
                  style={{
                    ...totalCell,
                    background:
                      "#299d48",
                  }}
                >
                  {money(
                    totals.annualBenefit
                  )}
                </td>

                <td
                  style={totalCell}
                >
                  {money(
                    -totals.replacementPayment
                  )}
                </td>

                <td
                  style={totalCell}
                >
                  {money(
                    -totals.financePayment
                  )}
                </td>

                <td
                  style={totalCell}
                >
                  {money(
                    totals.netAnnualBenefit
                  )}
                </td>

                <td
                  style={{
                    ...totalCell,
                    background:
                      "#299d48",
                  }}
                >
                  {money(
                    lastYear.cumulativePosition ||
                      0
                  )}
                </td>

                <td
                  style={totalCell}
                >
                  {money(
                    totals.billPreInstall
                  )}
                </td>

                <td
                  style={totalCell}
                >
                  {money(
                    totals.billPostInstall
                  )}
                </td>

                <td
                  style={totalCell}
                >
                  —
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* =================================================
          DISCLAIMER
      ================================================= */}

      <div
        style={{
          marginTop: 14,
          padding: 15,
          background: "#f8fafc",
          border:
            "1px solid #dbe3ec",
          borderRadius: 9,
          fontSize: 11,
          lineHeight: 1.6,
          color: "#475569",
        }}
      >
        <strong>
          Illustrative projection
        </strong>

        <p
          style={{
            margin:
              "6px 0 0",
          }}
        >
          These extended projections are
          illustrative estimates and should
          not be considered a guarantee of
          performance or savings. Inflation
          assumptions are scenarios rather
          than predictions. Actual electricity
          prices, generation, consumption,
          degradation and export payments may
          differ.
        </p>
      </div>
    </div>
  )
}

/*
 * =========================================================
 * SCENARIO CARD
 * =========================================================
 */

function ScenarioCard({
  title,
  scenario,
  active,
}) {
  if (!scenario) {
    return null
  }

  return (
    <div
      style={{
        border: active
          ? "2px solid #172554"
          : "1px solid #d7dee8",

        borderRadius: 10,
        padding: 15,
        background: active
          ? "#f8fafc"
          : "#fff",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#334155",
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 18,
          fontWeight: 700,
          color: "#172554",
        }}
      >
        {money(
          scenario.finalNetPosition
        )}
      </div>

      <div
        style={{
          marginTop: 4,
          fontSize: 10,
          color: "#64748b",
        }}
      >
        Final net position
      </div>

      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          color: "#475569",
        }}
      >
        Payback:{" "}
        <strong>
          {scenario.paybackPeriod
            ? `${scenario.paybackPeriod} years`
            : "Not achieved"}
        </strong>
      </div>
    </div>
  )
}

/*
 * =========================================================
 * SUMMARY CARD
 * =========================================================
 */

function SummaryCard({
  label,
  value,
}) {
  return (
    <div
      style={{
        background: "#299d48",
        color: "#fff",
        borderRadius: 8,
        padding: "13px 15px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 4,
          fontSize: 15,
          fontWeight: 700,
        }}
      >
        {value}
      </div>
    </div>
  )
}

/*
 * =========================================================
 * MINI METRIC
 * =========================================================
 */

function MiniMetric({
  label,
  value,
}) {
  return (
    <div
      style={{
        padding: 10,
        border:
          "1px solid #e5e7eb",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#64748b",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 4,
          fontSize: 14,
          fontWeight: 700,
          color: "#334155",
        }}
      >
        {value}
      </div>
    </div>
  )
}

/*
 * =========================================================
 * TABLE CELLS
 * =========================================================
 */

function HeaderCell({
  children,
  green = false,
}) {
  return (
    <th
      style={{
        background: green
          ? "#299d48"
          : "#575757",

        color: "#fff",

        border:
          "1px solid #222",

        padding:
          "8px 6px",

        textAlign: "center",

        fontWeight: 700,

        fontSize: 10,

        whiteSpace:
          "nowrap",
      }}
    >
      {children}
    </th>
  )
}

function BodyCell({
  children,
  green = false,
  negative = false,
}) {
  let background = "#fff"
  let color = "#333"

  if (green) {
    background = "#e8f5eb"
    color = "#26783a"
  }

  if (negative) {
    color = "#ff0000"
  }

  return (
    <td
      style={{
        background,
        color,

        border:
          "1px solid #222",

        padding:
          "6px 7px",

        textAlign:
          "right",

        whiteSpace:
          "nowrap",
      }}
    >
      {children}
    </td>
  )
}

const totalCell = {
  background: "#575757",
  color: "#fff",
  border:
    "1px solid #222",
  padding: "10px 7px",
  textAlign: "right",
  fontWeight: 700,
  whiteSpace: "nowrap",
}
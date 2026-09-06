import React from "react"

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

export default function ThirtyYearBreakdown({
  thirtyYearProjection,
  results,
  data,
}) {
  if (!thirtyYearProjection) {
    return null
  }

  const {
    rows = [],
    totals = {},
    paybackPeriod,
    scenarios = {},
    finance = {},
  } = thirtyYearProjection

  const noInflation =
    scenarios.none

  const midpoint =
    scenarios.midpoint

  const average =
    scenarios.average

  return (
    <div
      style={{
        marginTop: 24,
      }}
    >
      {/* =====================================================
          INTRODUCTION
      ===================================================== */}

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
          30 Year Benefit Projection
        </h2>

        <p
          style={{
            margin: "14px 0 0",
            fontSize: 12,
            lineHeight: 1.7,
            color: "#475569",
          }}
        >
          The following figures are illustrative
          projections based on the customer's
          current electricity consumption and
          the assumptions entered into the EPVS
          calculator. They take account of solar
          panel degradation and different
          electricity price inflation scenarios.
        </p>

        <p
          style={{
            margin: "10px 0 0",
            fontSize: 12,
            lineHeight: 1.7,
            color: "#475569",
          }}
        >
          The 7.6% scenario is the average
          inflation scenario used for the detailed
          projection below. The 3.8% scenario is
          the midpoint between 0% and 7.6%.
        </p>

        <div
          style={{
            marginTop: 14,
            padding: 12,
            background: "#fff7ed",
            borderRadius: 8,
            color: "#9a3412",
            fontSize: 11,
            lineHeight: 1.6,
          }}
        >
          <strong>
            Important:
          </strong>{" "}
          These figures are estimates for
          illustrative purposes only and are not
          a guarantee of performance or future
          electricity prices.
        </div>
      </div>

      {/* =====================================================
          INFLATION SCENARIOS
      ===================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0, 1fr))",
          gap: 14,
          marginBottom: 14,
        }}
      >
        <ScenarioCard
          label="0% Inflation"
          scenario={
            noInflation
          }
        />

        <ScenarioCard
          label="3.8% Inflation"
          scenario={
            midpoint
          }
        />

        <ScenarioCard
          label="7.6% Inflation"
          scenario={
            average
          }
          primary
        />
      </div>

      {/* =====================================================
          FINANCE SUMMARY
      ===================================================== */}

      {finance.totalContractValue >
        0 && (
        <div
          className="card"
          style={{
            padding: 20,
            marginBottom: 14,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              color: "#475569",
            }}
          >
            Finance
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(4, minmax(0, 1fr))",
              gap: 14,
              marginTop: 14,
            }}
          >
            <FinanceCard
              label="System cost"
              value={money(
                finance.systemCost
              )}
            />

            <FinanceCard
              label="Deposit"
              value={money(
                finance.deposit
              )}
            />

            <FinanceCard
              label="Monthly repayment"
              value={money(
                finance.monthlyPayment
              )}
            />

            <FinanceCard
              label="Total contract value"
              value={money(
                finance.totalContractValue
              )}
            />
          </div>

          {finance.totalFinanceInterest >
            0 && (
            <p
              style={{
                margin:
                  "12px 0 0",
                fontSize: 11,
                color: "#64748b",
              }}
            >
              Total finance interest:
              {" "}
              <strong>
                {money(
                  finance.totalFinanceInterest
                )}
              </strong>
            </p>
          )}
        </div>
      )}

      {/* =====================================================
          DETAILED SUMMARY
      ===================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(4, minmax(0, 1fr))",
          gap: 14,
          marginBottom: 14,
        }}
      >
        <SummaryCard
          label="First year benefit"
          value={money(
            rows[0]?.annualBenefit
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
          label="30 year net benefit"
          value={money(
            average?.totalNetSavings
          )}
        />

        <SummaryCard
          label="Year 30 net position"
          value={money(
            rows[29]
              ?.cumulativePosition
          )}
        />
      </div>

      {/* =====================================================
          SCENARIO COMPARISON
      ===================================================== */}

      <div
        className="card"
        style={{
          padding: 20,
          marginBottom: 14,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 15,
            color: "#475569",
          }}
        >
          Inflation Scenario Comparison
        </h3>

        <div
          style={{
            overflowX: "auto",
            marginTop: 14,
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse:
                "collapse",
              fontSize: 12,
            }}
          >
            <thead>
              <tr>
                <HeaderCell>
                  SCENARIO
                </HeaderCell>

                <HeaderCell>
                  INFLATION
                </HeaderCell>

                <HeaderCell>
                  YEAR 1
                  <br />
                  BENEFIT
                </HeaderCell>

                <HeaderCell>
                  30 YEAR
                  <br />
                  BENEFIT
                </HeaderCell>

                <HeaderCell>
                  PAYBACK
                </HeaderCell>

                <HeaderCell green>
                  YEAR 30
                  <br />
                  NET POSITION
                </HeaderCell>
              </tr>
            </thead>

            <tbody>
              <ScenarioRow
                label="No inflation"
                scenario={
                  noInflation
                }
              />

              <ScenarioRow
                label="Midpoint"
                scenario={
                  midpoint
                }
              />

              <ScenarioRow
                label="Average"
                scenario={
                  average
                }
                green
              />
            </tbody>
          </table>
        </div>
      </div>

      {/* =====================================================
          DETAILED 7.6% TABLE
      ===================================================== */}

      <div
        className="card"
        style={{
          padding: 20,
          marginBottom: 14,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 15,
            color: "#475569",
          }}
        >
          Detailed 30 Year Projection —
          7.6% Inflation Scenario
        </h3>

        <p
          style={{
            margin:
              "10px 0 0",
            fontSize: 11,
            color: "#64748b",
            lineHeight: 1.6,
          }}
        >
          Electricity and export rates are
          increased by 7.6% per year for this
          illustrative scenario, while solar
          generation reduces annually in line
          with the degradation assumption.
        </p>
      </div>

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
              minWidth: 1200,
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
                </HeaderCell>

                <HeaderCell>
                  SOLAR
                </HeaderCell>

                <HeaderCell>
                  BATTERY
                </HeaderCell>

                <HeaderCell>
                  EXPORT
                </HeaderCell>

                <HeaderCell green>
                  ANNUAL
                  <br />
                  BENEFIT
                </HeaderCell>

                <HeaderCell>
                  REPLACEMENT
                  <br />
                  COSTS
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
              </tr>
            </thead>

            <tbody>
              {rows.map(
                (row) => (
                  <tr
                    key={
                      row.year
                    }
                  >
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
                      {row.replacementCost >
                      0
                        ? `-${money(
                            row.replacementCost
                          )}`
                        : money(
                            0
                          )}
                    </BodyCell>

                    <BodyCell>
                      {row.yearlyPayment >
                      0
                        ? `-${money(
                            row.yearlyPayment
                          )}`
                        : money(
                            0
                          )}
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
                  </tr>
                )
              )}

              <tr>
                <td
                  style={{
                    ...totalCell,
                    textAlign:
                      "left",
                  }}
                >
                  TOTALS
                </td>

                <td
                  style={
                    totalCell
                  }
                >
                  {number(
                    totals.generation
                  )}
                </td>

                <td
                  style={
                    totalCell
                  }
                >
                  {money(
                    totals.solar
                  )}
                </td>

                <td
                  style={
                    totalCell
                  }
                >
                  {money(
                    totals.battery
                  )}
                </td>

                <td
                  style={
                    totalCell
                  }
                >
                  {money(
                    totals.exportKwh
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
                  style={
                    totalCell
                  }
                >
                  {money(
                    totals.replacementCost
                  )}
                </td>

                <td
                  style={
                    totalCell
                  }
                >
                  {money(
                    totals.yearlyPayment
                  )}
                </td>

                <td
                  style={
                    totalCell
                  }
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
                    rows[29]
                      ?.cumulativePosition ||
                      0
                  )}
                </td>

                <td
                  style={
                    totalCell
                  }
                >
                  {money(
                    totals.billPreInstall
                  )}
                </td>

                <td
                  style={
                    totalCell
                  }
                >
                  {money(
                    totals.billPostInstall
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* =====================================================
          EPVS DISCLAIMER
      ===================================================== */}

      <div
        style={{
          marginTop: 14,
          padding: 16,
          background: "#f8fafc",
          borderRadius: 8,
          fontSize: 11,
          lineHeight: 1.7,
          color: "#475569",
        }}
      >
        <strong>
          Predicted Energy Performance and
          Energy Saving
        </strong>

        <p
          style={{
            margin:
              "8px 0 0",
          }}
        >
          The performance of Solar PV systems is
          impossible to predict with certainty
          due to the variability in the amount
          of solar radiation from location to
          location and from year to year. This
          estimate is based upon the assumptions
          entered into this preliminary model and
          should be considered guidance only. It
          should not be considered a guarantee of
          performance.
        </p>

        <p
          style={{
            margin:
              "8px 0 0",
          }}
        >
          Inflation assumptions are illustrative
          only. Future electricity prices cannot
          be predicted with certainty.
        </p>
      </div>
    </div>
  )
}

function ScenarioCard({
  label,
  scenario,
  primary = false,
}) {
  if (!scenario) {
    return null
  }

  return (
    <div
      style={{
        background: primary
          ? "#299d48"
          : "#575757",
        color: "#fff",
        borderRadius: 10,
        padding: 18,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 5,
          fontSize: 11,
          opacity: 0.9,
        }}
      >
        Estimated 30 year net benefit
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        {money(
          scenario.totalNetSavings
        )}
      </div>

      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          opacity: 0.9,
        }}
      >
        Payback:{" "}
        {scenario.paybackPeriod
          ? `${scenario.paybackPeriod} years`
          : "Not achieved"}
      </div>
    </div>
  )
}

function FinanceCard({
  label,
  value,
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          color: "#64748b",
          marginBottom: 4,
        }}
      >
        {label}
      </div>

      <strong
        style={{
          fontSize: 15,
          color: "#172554",
        }}
      >
        {value}
      </strong>
    </div>
  )
}

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
        padding:
          "13px 15px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {label}:
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

function ScenarioRow({
  label,
  scenario,
  green = false,
}) {
  if (!scenario) {
    return null
  }

  return (
    <tr>
      <BodyCell>
        {label}
      </BodyCell>

      <BodyCell>
        {(
          scenario.inflationRate *
          100
        ).toFixed(1)}
        %
      </BodyCell>

      <BodyCell>
        {money(
          scenario.rows?.[0]
            ?.annualBenefit
        )}
      </BodyCell>

      <BodyCell>
        {money(
          scenario.totalNetSavings
        )}
      </BodyCell>

      <BodyCell>
        {scenario.paybackPeriod
          ? `${scenario.paybackPeriod} years`
          : "Not achieved"}
      </BodyCell>

      <BodyCell
        green={green}
        negative={
          !green &&
          (scenario.rows?.[29]
            ?.cumulativePosition ||
            0) < 0
        }
      >
        {money(
          scenario.rows?.[29]
            ?.cumulativePosition
        )}
      </BodyCell>
    </tr>
  )
}

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
        textAlign:
          "center",
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
  padding:
    "10px 7px",
  textAlign:
    "right",
  fontWeight: 700,
  whiteSpace:
    "nowrap",
}
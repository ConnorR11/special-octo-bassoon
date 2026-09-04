import React from "react"

const money = (value) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

const number = (value) =>
  Number(value || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export default function ThirtyYearBreakdown({
  thirtyYearProjection,
}) {
  if (!thirtyYearProjection) {
    return null
  }

  const {
    rows = [],
    totals = {},
    paybackPeriod,
    totalNetSavings,
    totalNetReturn,
  } = thirtyYearProjection

  return (
    <div
      style={{
        marginTop: 24,
      }}
    >
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
          30 Year Benefit Breakdown Based on Consumption
        </h2>

        <p
          style={{
            margin: "14px 0 0",
            fontSize: 12,
            lineHeight: 1.7,
            color: "#475569",
          }}
        >
          The estimated savings below are based on the
          customer's annual electricity consumption and
          the assumptions entered into the EPVS calculator.
          They are provided for illustration and are not a
          guarantee of performance. Replacement,
          maintenance and cleaning costs are not currently
          included in this preliminary model.
        </p>
      </div>

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
          label="First year total benefit"
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
          label="Total net savings"
          value={money(
            totalNetSavings
          )}
        />

        <SummaryCard
          label="Total net return"
          value={money(
            totalNetReturn
          )}
        />
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
              minWidth: 1050,
              borderCollapse: "collapse",
              fontSize: 11,
            }}
          >
            <thead>
              <tr>
                <HeaderCell>YR</HeaderCell>
                <HeaderCell>GENERATION</HeaderCell>
                <HeaderCell>SOLAR</HeaderCell>
                <HeaderCell>BATTERY</HeaderCell>
                <HeaderCell>EXPORT</HeaderCell>
                <HeaderCell green>
                  ANNUAL
                  <br />
                  BENEFIT
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
                    {money(row.solar)}
                  </BodyCell>

                  <BodyCell>
                    {money(row.battery)}
                  </BodyCell>

                  <BodyCell>
                    {money(row.exportKwh)}
                  </BodyCell>

                  <BodyCell green>
                    {money(
                      row.annualBenefit
                    )}
                  </BodyCell>

                  <BodyCell>
                    {row.yearlyPayment > 0
                      ? `-${money(
                          row.yearlyPayment
                        )}`
                      : money(0)}
                  </BodyCell>

                  <BodyCell
                    negative={
                      row.netAnnualBenefit < 0
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
                      row.cumulativePosition < 0
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
              ))}

              <tr>
                <td
                  style={{
                    ...totalCell,
                    textAlign: "left",
                  }}
                >
                  TOTALS
                </td>

                <td style={totalCell}>
                  {number(
                    totals.generation
                  )}
                </td>

                <td style={totalCell}>
                  {money(totals.solar)}
                </td>

                <td style={totalCell}>
                  {money(totals.battery)}
                </td>

                <td style={totalCell}>
                  {money(
                    totals.exportKwh
                  )}
                </td>

                <td
                  style={{
                    ...totalCell,
                    background: "#299d48",
                  }}
                >
                  {money(
                    totals.annualBenefit
                  )}
                </td>

                <td style={totalCell}>
                  {money(
                    -totals.yearlyPayment
                  )}
                </td>

                <td style={totalCell}>
                  {money(
                    totals.netAnnualBenefit
                  )}
                </td>

                <td
                  style={{
                    ...totalCell,
                    background: "#299d48",
                  }}
                >
                  {money(
                    rows[29]
                      ?.cumulativePosition || 0
                  )}
                </td>

                <td style={totalCell}>
                  {money(
                    totals.billPreInstall
                  )}
                </td>

                <td style={totalCell}>
                  {money(
                    totals.billPostInstall
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
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
        padding: "13px 15px",
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
        border: "1px solid #222",
        padding: "8px 6px",
        textAlign: "center",
        fontWeight: 700,
        fontSize: 10,
        whiteSpace: "nowrap",
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
        border: "1px solid #222",
        padding: "6px 7px",
        textAlign: "right",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  )
}

const totalCell = {
  background: "#575757",
  color: "#fff",
  border: "1px solid #222",
  padding: "10px 7px",
  textAlign: "right",
  fontWeight: 700,
  whiteSpace: "nowrap",
}
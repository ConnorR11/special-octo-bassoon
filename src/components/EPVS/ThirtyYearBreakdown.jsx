import React, { useMemo, useState } from "react"

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

const safeNumber = (value) => Number(value || 0)

export default function ThirtyYearBreakdown({
  thirtyYearProjection,
}) {
  const scenarios = thirtyYearProjection?.scenarios || {}

  const scenarioList = useMemo(
    () => [
      {
        key: "noInflation",
        label: "0% inflation",
        data: scenarios.noInflation,
      },
      {
        key: "midpointInflation",
        label: "3.8% inflation",
        data: scenarios.midpointInflation,
      },
      {
        key: "averageInflation",
        label: "7.6% inflation",
        data: scenarios.averageInflation,
      },
    ].filter((scenario) => scenario.data),
    [scenarios]
  )

  const [selectedKey, setSelectedKey] = useState("noInflation")

  if (!thirtyYearProjection || !scenarioList.length) return null

  const selectedScenario =
    scenarioList.find((scenario) => scenario.key === selectedKey) ||
    scenarioList[0]

  const scenario = selectedScenario.data
  const rows = Array.isArray(scenario.rows) ? scenario.rows : []
  const totals = scenario.totals || {}

  const firstYearBenefit = safeNumber(
    rows[0]?.annualBenefit
  )

  const paybackPeriod = scenario.paybackPeriod
  const totalNetSavings = safeNumber(
    scenario.totalNetSavings
  )
  const totalNetReturn = safeNumber(
    scenario.totalNetReturn
  )

  return (
    <div style={{ marginTop: 24 }}>
      <div
        className="card"
        style={{ padding: 20, marginBottom: 14 }}
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
          The estimated savings below are based on the customer's
          annual electricity consumption and the assumptions entered
          into the EPVS calculator. They are provided for illustration
          and are not a guarantee of performance. Replacement,
          maintenance and cleaning costs are not currently included in
          this preliminary model.
        </p>
      </div>

      <div
        className="card"
        style={{
          padding: 14,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#475569",
            marginBottom: 10,
          }}
        >
          Inflation scenario
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {scenarioList.map((item) => {
            const active = item.key === selectedScenario.key

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelectedKey(item.key)}
                style={{
                  border: active
                    ? "1px solid #299d48"
                    : "1px solid #d7dee8",
                  background: active ? "#e8f5eb" : "#fff",
                  color: active ? "#26783a" : "#475569",
                  borderRadius: 7,
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 14,
          marginBottom: 14,
        }}
      >
        <SummaryCard
          label="First year total benefit"
          value={money(firstYearBenefit)}
        />

        <SummaryCard
          label="Payback period"
          value={
            paybackPeriod !== null &&
            paybackPeriod !== undefined
              ? `${paybackPeriod} years`
              : "Not achieved"
          }
        />

        <SummaryCard
          label="Total net savings"
          value={money(totalNetSavings)}
        />

        <SummaryCard
          label="Total net return"
          value={money(totalNetReturn)}
        />
      </div>

      <div
        className="card"
        style={{
          padding: 0,
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
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
                  <BodyCell>{row.year}</BodyCell>
                  <BodyCell>{number(row.generation)}</BodyCell>
                  <BodyCell>{number(row.solar)}</BodyCell>
                  <BodyCell>{number(row.battery)}</BodyCell>
                  <BodyCell>{number(row.exportKwh)}</BodyCell>
                  <BodyCell green>
                    {money(row.annualBenefit)}
                  </BodyCell>
                  <BodyCell>
                    {safeNumber(row.yearlyPayment) > 0
                      ? `-${money(row.yearlyPayment)}`
                      : money(0)}
                  </BodyCell>
                  <BodyCell negative={safeNumber(row.netAnnualBenefit) < 0}>
                    {money(row.netAnnualBenefit)}
                  </BodyCell>
                  <BodyCell
                    green={safeNumber(row.cumulativePosition) >= 0}
                    negative={safeNumber(row.cumulativePosition) < 0}
                  >
                    {money(row.cumulativePosition)}
                  </BodyCell>
                  <BodyCell>{money(row.billPreInstall)}</BodyCell>
                  <BodyCell>{money(row.billPostInstall)}</BodyCell>
                </tr>
              ))}

              {rows.length > 0 && (
                <tr>
                  <td style={{ ...totalCell, textAlign: "left" }}>
                    TOTALS
                  </td>
                  <td style={totalCell}>
                    {number(totals.generation)}
                  </td>
                  <td style={totalCell}>
                    {number(totals.solar)}
                  </td>
                  <td style={totalCell}>
                    {number(totals.battery)}
                  </td>
                  <td style={totalCell}>
                    {number(totals.exportKwh)}
                  </td>
                  <td
                    style={{
                      ...totalCell,
                      background: "#299d48",
                    }}
                  >
                    {money(totals.annualBenefit)}
                  </td>
                  <td style={totalCell}>
                    {money(-safeNumber(totals.yearlyPayment))}
                  </td>
                  <td style={totalCell}>
                    {money(totals.netAnnualBenefit)}
                  </td>
                  <td
                    style={{
                      ...totalCell,
                      background: "#299d48",
                    }}
                  >
                    {money(
                      rows[rows.length - 1]?.cumulativePosition
                    )}
                  </td>
                  <td style={totalCell}>
                    {money(totals.billPreInstall)}
                  </td>
                  <td style={totalCell}>
                    {money(totals.billPostInstall)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value }) {
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
      <div style={{ fontSize: 12, fontWeight: 600 }}>
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

function HeaderCell({ children, green = false }) {
  return (
    <th
      style={{
        background: green ? "#299d48" : "#575757",
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

function BodyCell({ children, green = false, negative = false }) {
  let background = "#fff"
  let color = "#333"

  if (green) {
    background = "#e8f5eb"
    color = "#26783a"
  }

  if (negative) color = "#ff0000"

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

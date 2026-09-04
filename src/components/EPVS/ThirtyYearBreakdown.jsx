import React, { useMemo } from "react"

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
  results,
  data,
}) {
  const projection = useMemo(() => {
    const rows = []

    let cumulativePosition = 0

    const systemCost =
      Number(data.systemCost || 0)

    const annualConsumption =
      Number(data.annualConsumption || 0)

    const importRate =
      Number(data.importRate || 0)

    const exportRate =
      Number(data.exportRate || 0)

    /*
     * First-year values come directly from the calculator.
     */
    const firstYearGeneration =
      Number(results.generation || 0)

    const firstYearSolar =
      Number(results.solarSelfConsumption || 0)

    const firstYearBattery =
      Number(results.batteryContribution || 0)

    const firstYearExport =
      Number(results.exportKwh || 0)

    /*
     * Annual electricity price escalation.
     *
     * This is currently a modelling assumption and can later
     * be replaced by the exact EPVS tariff escalation logic.
     */
    const annualRateIncrease = 0.03

    /*
     * Solar degradation.
     *
     * Current preliminary model assumes 0.4% degradation
     * per year after year one.
     */
    const annualDegradation = 0.004

    /*
     * First-year grid bill before installation.
     */
    const firstYearBill =
      annualConsumption * importRate

    for (let year = 1; year <= 30; year++) {
      /*
       * Generation decreases as the panels age.
       */
      const generation =
        firstYearGeneration *
        Math.pow(
          1 - annualDegradation,
          year - 1
        )

      /*
       * Maintain the same proportions between solar,
       * battery and export as the calculator's first-year
       * result.
       */
      const solar =
        firstYearGeneration > 0
          ? generation *
            (firstYearSolar /
              firstYearGeneration)
          : 0

      const battery =
        firstYearGeneration > 0
          ? generation *
            (firstYearBattery /
              firstYearGeneration)
          : 0

      const exportKwh =
        Math.max(
          0,
          generation -
            solar -
            battery
        )

      /*
       * Electricity prices increase over time.
       */
      const importRateYear =
        importRate *
        Math.pow(
          1 + annualRateIncrease,
          year - 1
        )

      const exportRateYear =
        exportRate *
        Math.pow(
          1 + annualRateIncrease,
          year - 1
        )

      /*
       * Financial benefits.
       */
      const solarBenefit =
        solar * importRateYear

      const batteryBenefit =
        battery * importRateYear

      const exportBenefit =
        exportKwh * exportRateYear

      const annualBenefit =
        solarBenefit +
        batteryBenefit +
        exportBenefit

      /*
       * Finance payment.
       *
       * Current calculator assumes the full system cost
       * is paid in year one.
       */
      const yearlyPayment =
        year === 1
          ? systemCost -
            Number(data.deposit || 0)
          : 0

      const netAnnualBenefit =
        annualBenefit -
        yearlyPayment

      cumulativePosition +=
        netAnnualBenefit

      /*
       * Electricity bill before installation.
       */
      const billPreInstall =
        annualConsumption *
        importRateYear

      /*
       * Approximate bill after installation.
       *
       * This represents the remaining imported electricity
       * after solar and battery reduction.
       */
      const gridReduction =
        solar + battery

      const remainingGrid =
        Math.max(
          0,
          annualConsumption -
            gridReduction
        )

      const billPostInstall =
        remainingGrid *
        importRateYear

      rows.push({
        year,
        generation,
        solar,
        battery,
        exportKwh,
        annualBenefit,
        yearlyPayment,
        netAnnualBenefit,
        cumulativePosition,
        billPreInstall,
        billPostInstall,
      })
    }

    return rows
  }, [results, data])

  const totals = projection.reduce(
    (total, row) => {
      total.generation += row.generation
      total.solar += row.solar
      total.battery += row.battery
      total.exportKwh += row.exportKwh
      total.annualBenefit +=
        row.annualBenefit
      total.yearlyPayment +=
        row.yearlyPayment
      total.netAnnualBenefit +=
        row.netAnnualBenefit

      total.billPreInstall +=
        row.billPreInstall

      total.billPostInstall +=
        row.billPostInstall

      return total
    },
    {
      generation: 0,
      solar: 0,
      battery: 0,
      exportKwh: 0,
      annualBenefit: 0,
      yearlyPayment: 0,
      netAnnualBenefit: 0,
      billPreInstall: 0,
      billPostInstall: 0,
    }
  )

  /*
   * Find the first year where cumulative position
   * becomes positive.
   */
  const paybackRow =
    projection.find(
      (row) =>
        row.cumulativePosition >= 0
    )

  const paybackPeriod =
    paybackRow
      ? paybackRow.year
      : null

  const totalNetSavings =
    totals.netAnnualBenefit

  const totalNetReturn =
    totalNetSavings -
    Number(data.systemCost || 0)

  return (
    <div
      style={{
        marginTop: 24,
      }}
    >
      {/* =====================================================
          HEADER
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
          30 Year Benefit Breakdown Based on Consumption
        </h2>

        <p
          style={{
            margin:
              "14px 0 0",
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

      {/* =====================================================
          SUMMARY CARDS
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
          label="First year total benefit"
          value={money(
            projection[0]?.annualBenefit
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

      {/* =====================================================
          TABLE
          ===================================================== */}

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
              borderCollapse:
                "collapse",
              fontSize: 11,
            }}
          >
            <thead>
              <tr>
                <HeaderCell>YR</HeaderCell>
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
              {projection.map(
                (row) => (
                  <tr
                    key={row.year}
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
                        row.solar
                      )}
                    </BodyCell>

                    <BodyCell>
                      {money(
                        row.battery
                      )}
                    </BodyCell>

                    <BodyCell>
                      {money(
                        row.exportKwh
                      )}
                    </BodyCell>

                    <BodyCell
                      green
                    >
                      {money(
                        row.annualBenefit
                      )}
                    </BodyCell>

                    <BodyCell>
                      {row.yearlyPayment >
                      0
                        ? `-${money(
                            row.yearlyPayment
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
                  </tr>
                )
              )}

              {/* =================================================
                  TOTALS
                  ================================================= */}

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
                    -totals.yearlyPayment
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
                    projection[29]
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
    </div>
  )
}

/* =========================================================
   SUMMARY CARD
   ========================================================= */

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

/* =========================================================
   TABLE CELLS
   ========================================================= */

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
        border:
          "1px solid #222",
        padding: "6px 7px",
        textAlign: "right",
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
  border: "1px solid #222",
  padding: "10px 7px",
  textAlign: "right",
  fontWeight: 700,
  whiteSpace: "nowrap",
}
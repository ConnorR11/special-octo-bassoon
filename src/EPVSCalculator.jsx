import React, {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  Zap,
  Battery,
  Home,
  PoundSterling,
} from "lucide-react"

import AnnualBreakdown from "./components/EPVS/AnnualBreakdown"
import ThirtyYearBreakdown from "./components/EPVS/ThirtyYearBreakdown"

const money = (value) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const steps = [
  {
    title: "Customer",
    icon: Home,
  },
  {
    title: "Solar PV",
    icon: Zap,
  },
  {
    title: "Battery & Inverter",
    icon: Battery,
  },
  {
    title: "Tariff",
    icon: PoundSterling,
  },
  {
    title: "Finance",
    icon: PoundSterling,
  },
  {
    title: "Results",
    icon: CheckCircle2,
  },
]

const createArray = () => ({
  panelWattage: 415,
  panelCount: 10,
  orientation: 0,
  pitch: 30,
  irradiance: 0,
  shading: 1,
})

const initial = {
  customerName: "",
  address: "",
  postcode: "",

  annualConsumption: 4000,

  /*
   * CURRENT CUSTOMER TARIFF
   *
   * Stored as pence.
   *
   * These are NOT the proposed Flux rates.
   */
  importRate: 28,
  exportRate: 15,
  standingCharge: 30,

  existingSolar: false,
  existingGeneration: 0,

  numberOfArrays: 1,

  arrays: [
    createArray(),
    createArray(),
    createArray(),
  ],

  /*
   * Battery configuration.
   *
   * 0 = no battery.
   */
  batteryCapacity: 0,

  /*
   * Inverter capacity.
   *
   * Empty until selected.
   */
  inverterCapacity: "",

  /*
   * Proposed tariff.
   */
  tariff: "Standard Flux",

  /*
   * Flux rates.
   *
   * Stored as pence.
   */
  fluxDayImport: 24.96,
  fluxDayExport: 9.55,

  fluxImport: 14.98,
  fluxExport: 4.42,

  fluxPeakImport: 34.94,
  fluxPeakExport: 27.19,

  fluxStandingCharge: 62.83,

  /*
   * API information.
   */
  fluxGspGroupId: "",
  fluxTariffCode: "",
  fluxRetrievedAt: "",

  paymentMethod: "Finance",

  systemCost: 12000,
  deposit: 0,

  financeTerm: 10,
  financeRate: 7.9,
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  step,
  min,
  max,
  disabled = false,
}) {
  return (
    <label style={styles.field}>
      <span>{label}</span>

      <input
        type={type}
        value={value}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => {
          const nextValue =
            type === "number"
              ? event.target.value === ""
                ? ""
                : Number(event.target.value)
              : event.target.value

          onChange(nextValue)
        }}
      />
    </label>
  )
}

function Select({
  label,
  value,
  onChange,
  children,
}) {
  return (
    <label style={styles.field}>
      <span>{label}</span>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
      >
        {children}
      </select>
    </label>
  )
}

function Toggle({
  label,
  value,
  onChange,
}) {
  return (
    <label style={styles.toggleRow}>
      <span>{label}</span>

      <button
        type="button"
        onClick={() => onChange(!value)}
        style={{
          ...styles.toggle,
          background: value
            ? "#172554"
            : "#d1d5db",
        }}
      >
        <span
          style={{
            ...styles.toggleKnob,
            transform: value
              ? "translateX(20px)"
              : "translateX(0)",
          }}
        />
      </button>
    </label>
  )
}

export default function EPVSCalculator({
  appointment,
  onCalculationChange,
}) {
  const [step, setStep] = useState(0)

  const [loadingFluxRates, setLoadingFluxRates] =
    useState(false)

  const [fluxRateError, setFluxRateError] =
    useState("")

  const appointmentInitial = useMemo(() => {
    return {
      ...initial,

      customerName:
        appointment?.name || "",

      address:
        appointment?.address || "",

      postcode:
        appointment?.postcode || "",
    }
  }, [appointment])

  const [data, setData] =
    useState(appointmentInitial)

  useEffect(() => {
    setData((current) => ({
      ...current,

      customerName:
        appointment?.name ||
        current.customerName ||
        "",

      address:
        appointment?.address ||
        current.address ||
        "",

      postcode:
        appointment?.postcode ||
        current.postcode ||
        "",
    }))
  }, [appointment])

  const update = (
    key,
    value
  ) => {
    setData((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const updateArray = (
    index,
    key,
    value
  ) => {
    setData((current) => {
      const arrays = [
        ...current.arrays,
      ]

      arrays[index] = {
        ...arrays[index],
        [key]: value,
      }

      return {
        ...current,
        arrays,
      }
    })
  }

  /*
   * ============================================================
   * OCTOPUS FLUX API
   * ============================================================
   */

  const getCurrentFluxRates =
    async () => {
      if (
        !data.postcode?.trim()
      ) {
        setFluxRateError(
          "Please enter a postcode before retrieving Flux rates."
        )

        return
      }

      setLoadingFluxRates(true)
      setFluxRateError("")

      try {
        const response =
          await fetch(
            "/api/octopus-flux",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                postcode:
                  data.postcode,

                address:
                  data.address,
              }),
            }
          )

        const result =
          await response.json()

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.error ||
              "Unable to retrieve Flux rates."
          )
        }

        const rates =
          result.rates || {}

        /*
         * Update the calculator with the API values.
         *
         * The values remain editable afterwards.
         */

        setData((current) => ({
          ...current,

          fluxDayImport:
            Number(
              rates.dayImport ||
                0
            ),

          /*
           * Export rates may not be available from every
           * REST product response in exactly the same form.
           *
           * Keep the existing manually entered values when
           * an export value wasn't returned.
           */
          fluxImport:
            Number(
              rates.fluxImport ||
                current.fluxImport ||
                0
            ),

          fluxPeakImport:
            Number(
              rates.peakImport ||
                current.fluxPeakImport ||
                0
            ),

          fluxStandingCharge:
            Number(
              rates.standingCharge ||
                current.fluxStandingCharge ||
                0
            ),

          fluxGspGroupId:
            result.gspGroupId ||
            "",

          fluxTariffCode:
            result.tariff?.code ||
            "",

          fluxRetrievedAt:
            result.retrievedAt ||
            "",
        }))
      } catch (error) {
        console.error(
          "Flux rate error:",
          error
        )

        setFluxRateError(
          error?.message ||
            "Unable to retrieve Flux rates."
        )
      } finally {
        setLoadingFluxRates(false)
      }
    }

  /*
   * ============================================================
   * CALCULATIONS
   * ============================================================
   */

  const results = useMemo(() => {
    const numberOfArrays =
      Math.min(
        3,
        Math.max(
          1,
          Number(
            data.numberOfArrays || 1
          )
        )
      )

    const activeArrays =
      data.arrays.slice(
        0,
        numberOfArrays
      )

    /*
     * ----------------------------------------------------------
     * ARRAY GENERATION
     * ----------------------------------------------------------
     */

    const calculatedArrays =
      activeArrays.map(
        (
          array,
          index
        ) => {
          const panelWattage =
            Number(
              array.panelWattage ||
                0
            )

          const panelCount =
            Number(
              array.panelCount ||
                0
            )

          const irradiance =
            Number(
              array.irradiance ||
                0
            )

          const shading =
            Number(
              array.shading || 0
            )

          const systemSize =
            (panelWattage *
              panelCount) /
            1000

          const generation =
            systemSize *
            irradiance *
            shading

          return {
            ...array,

            arrayNumber:
              index + 1,

            systemSize,

            generation,
          }
        }
      )

    const systemSize =
      calculatedArrays.reduce(
        (
          total,
          array
        ) =>
          total +
          array.systemSize,
        0
      )

    const generation =
      calculatedArrays.reduce(
        (
          total,
          array
        ) =>
          total +
          array.generation,
        0
      )

    /*
     * ----------------------------------------------------------
     * ELECTRICITY
     * ----------------------------------------------------------
     */

    const annualConsumption =
      Number(
        data.annualConsumption ||
          0
      )

    /*
     * EPVS preliminary solar self-consumption cap.
     *
     * 37.5% of annual grid consumption.
     */

    const solarSelfConsumption =
      Math.min(
        generation,
        annualConsumption *
          0.375
      )

    const remainingGeneration =
      Math.max(
        0,
        generation -
          solarSelfConsumption
      )

    /*
     * ----------------------------------------------------------
     * BATTERY
     * ----------------------------------------------------------
     */

    const batteryCapacity =
      Number(
        data.batteryCapacity ||
          0
      )

    const batteryContribution =
      batteryCapacity > 0
        ? Math.min(
            remainingGeneration,

            annualConsumption *
              0.25,

            batteryCapacity *
              180
          )
        : 0

    const exportKwh =
      Math.max(
        0,
        generation -
          solarSelfConsumption -
          batteryContribution
      )

    const gridReduction =
      solarSelfConsumption +
      batteryContribution

    /*
     * ----------------------------------------------------------
     * CURRENT TARIFF BENEFIT
     * ----------------------------------------------------------
     *
     * Current rates are stored in pence.
     */

    const currentImportRate =
      Number(
        data.importRate || 0
      ) / 100

    const currentExportRate =
      Number(
        data.exportRate || 0
      ) / 100

    const solarBenefit =
      solarSelfConsumption *
      currentImportRate

    const batterySelfConsumptionBenefit =
      batteryContribution *
      currentImportRate

    const forceChargeBenefit = 0

    const exportBenefit =
      exportKwh *
      currentExportRate

    const annualSaving =
      solarBenefit +
      batterySelfConsumptionBenefit +
      forceChargeBenefit +
      exportBenefit

    /*
     * ----------------------------------------------------------
     * FINANCE
     * ----------------------------------------------------------
     */

    const systemCost =
      Number(
        data.systemCost || 0
      )

    const deposit =
      Number(
        data.deposit || 0
      )

    const financeAmount =
      data.paymentMethod ===
      "Finance"
        ? Math.max(
            0,
            systemCost -
              deposit
          )
        : 0

    const monthlyRate =
      Number(
        data.financeRate || 0
      ) /
      100 /
      12

    const months =
      Number(
        data.financeTerm || 0
      ) * 12

    const monthlyPayment =
      data.paymentMethod ===
        "Finance" &&
      financeAmount > 0 &&
      months > 0
        ? monthlyRate > 0
          ? financeAmount *
            (monthlyRate *
              Math.pow(
                1 +
                  monthlyRate,
                months
              )) /
            (Math.pow(
              1 +
                monthlyRate,
              months
            ) - 1)
          : financeAmount /
            months
        : 0

    const simplePayback =
      annualSaving > 0
        ? systemCost /
          annualSaving
        : null

    return {
      numberOfArrays,

      arrays:
        calculatedArrays,

      systemSize,

      generation,

      solarSelfConsumption,

      batteryContribution,

      exportKwh,

      gridReduction,

      solarBenefit,

      batterySelfConsumptionBenefit,

      forceChargeBenefit,

      exportBenefit,

      annualSaving,

      monthlyPayment,

      financeAmount,

      simplePayback,
    }
  }, [data])

  /*
   * ============================================================
   * 30 YEAR PROJECTION
   * ============================================================
   */

  const thirtyYearProjection =
    useMemo(() => {
      const systemCost =
        Number(
          data.systemCost || 0
        )

      const deposit =
        Number(
          data.deposit || 0
        )

      const annualConsumption =
        Number(
          data.annualConsumption ||
            0
        )

      const importRate =
        Number(
          data.importRate || 0
        ) / 100

      const exportRate =
        Number(
          data.exportRate || 0
        ) / 100

      const firstYearGeneration =
        Number(
          results.generation || 0
        )

      const firstYearSolar =
        Number(
          results.solarSelfConsumption ||
            0
        )

      const firstYearBattery =
        Number(
          results.batteryContribution ||
            0
        )

      /*
       * Existing preliminary model degradation.
       *
       * This should be replaced with the manufacturer
       * degradation figure when the full EPVS engine is
       * implemented.
       */

      const annualDegradation =
        0.004

      const inflationScenarios = [
        {
          key: "noInflation",
          label: "0% inflation",
          rate: 0,
        },
        {
          key: "midpointInflation",
          label: "3.8% inflation",
          rate: 0.038,
        },
        {
          key: "averageInflation",
          label: "7.6% inflation",
          rate: 0.076,
        },
      ]

      const buildScenario =
        (inflationRate) => {
          const rows = []

          let cumulativePosition =
            0

          for (
            let year = 1;
            year <= 30;
            year++
          ) {
            const generation =
              firstYearGeneration *
              Math.pow(
                1 -
                  annualDegradation,
                year - 1
              )

            const solar =
              firstYearGeneration >
              0
                ? generation *
                  (firstYearSolar /
                    firstYearGeneration)
                : 0

            const battery =
              firstYearGeneration >
              0
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

            const inflationMultiplier =
              Math.pow(
                1 +
                  inflationRate,
                year - 1
              )

            const importRateYear =
              importRate *
              inflationMultiplier

            const exportRateYear =
              exportRate *
              inflationMultiplier

            const solarBenefit =
              solar *
              importRateYear

            const batteryBenefit =
              battery *
              importRateYear

            const exportBenefit =
              exportKwh *
              exportRateYear

            const forceChargeBenefit =
              0

            const annualBenefit =
              solarBenefit +
              batteryBenefit +
              forceChargeBenefit +
              exportBenefit

            const yearlyPayment =
              year === 1
                ? Math.max(
                    0,
                    systemCost -
                      deposit
                  )
                : 0

            const netAnnualBenefit =
              annualBenefit -
              yearlyPayment

            cumulativePosition +=
              netAnnualBenefit

            const billPreInstall =
              annualConsumption *
              importRateYear

            const gridReduction =
              solar +
              battery

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

              solarBenefit,

              batteryBenefit,

              forceChargeBenefit,

              exportBenefit,

              annualBenefit,

              annualSaving:
                annualBenefit,

              yearlyPayment,

              netAnnualBenefit,

              cumulativePosition,

              billPreInstall,

              billPostInstall,

              importRateYear,

              exportRateYear,
            })
          }

          const totals =
            rows.reduce(
              (
                total,
                row
              ) => {
                total.generation +=
                  row.generation

                total.solar +=
                  row.solar

                total.battery +=
                  row.battery

                total.exportKwh +=
                  row.exportKwh

                total.solarBenefit +=
                  row.solarBenefit

                total.batteryBenefit +=
                  row.batteryBenefit

                total.forceChargeBenefit +=
                  row.forceChargeBenefit

                total.exportBenefit +=
                  row.exportBenefit

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
                solarBenefit: 0,
                batteryBenefit: 0,
                forceChargeBenefit: 0,
                exportBenefit: 0,
                annualBenefit: 0,
                yearlyPayment: 0,
                netAnnualBenefit: 0,
                billPreInstall: 0,
                billPostInstall: 0,
              }
            )

          const paybackRow =
            rows.find(
              (row) =>
                row.cumulativePosition >=
                0
            )

          return {
            inflationRate,

            rows,

            totals,

            paybackPeriod:
              paybackRow?.year ||
              null,

            totalNetSavings:
              totals.netAnnualBenefit,

            finalNetPosition:
              rows[
                rows.length - 1
              ]?.cumulativePosition ||
              0,

            totalNetReturn:
              totals.netAnnualBenefit -
              systemCost,
          }
        }

      const scenarios = {}

      inflationScenarios.forEach(
        (scenario) => {
          scenarios[
            scenario.key
          ] =
            buildScenario(
              scenario.rate
            )
        }
      )

      return {
        inflationScenarios,

        scenarios,
      }
    }, [
      data,
      results,
    ])

  /*
   * ============================================================
   * SEND CALCULATION TO APPOINTMENT DETAIL
   * ============================================================
   */

  useEffect(() => {
    onCalculationChange?.({
      data,

      results,

      thirtyYearProjection,
    })
  }, [
    data,
    results,
    thirtyYearProjection,
    onCalculationChange,
  ])

  const next = () => {
    setStep((current) =>
      Math.min(
        steps.length - 1,
        current + 1
      )
    )
  }

  const back = () => {
    setStep((current) =>
      Math.max(
        0,
        current - 1
      )
    )
  }

  const reset = () => {
    setData(
      appointmentInitial
    )

    setFluxRateError("")

    setStep(0)
  }

  return (
    <section>
      <div style={styles.wrapper}>

        {/* =====================================================
            STEPPER
            ===================================================== */}

        <div style={styles.stepper}>
          {steps.map(
            (item, index) => {
              const Icon =
                item.icon

              const active =
                index === step

              const complete =
                index < step

              return (
                <button
                  key={
                    item.title
                  }
                  type="button"
                  onClick={() => {
                    if (
                      index <=
                      step
                    ) {
                      setStep(
                        index
                      )
                    }
                  }}
                  style={{
                    ...styles.step,

                    opacity:
                      index >
                      step
                        ? 0.5
                        : 1,
                  }}
                >
                  <div
                    style={{
                      ...styles.stepCircle,

                      background:
                        active ||
                        complete
                          ? "#172554"
                          : "#eef2f7",

                      color:
                        active ||
                        complete
                          ? "white"
                          : "#64748b",
                    }}
                  >
                    <Icon
                      size={16}
                    />
                  </div>

                  <span>
                    {
                      item.title
                    }
                  </span>
                </button>
              )
            }
          )}
        </div>

        {/* =====================================================
            CUSTOMER
            ===================================================== */}

        {step === 0 && (
          <Card
            title="Customer"
            subtitle="Customer, property and current electricity information."
          >
            <div
              style={
                styles.grid
              }
            >
              <Input
                label="Customer name"
                value={
                  data.customerName
                }
                onChange={(
                  value
                ) =>
                  update(
                    "customerName",
                    value
                  )
                }
              />

              <Input
                label="Postcode"
                value={
                  data.postcode
                }
                onChange={(
                  value
                ) =>
                  update(
                    "postcode",
                    value
                  )
                }
              />

              <Input
                label="Address"
                value={
                  data.address
                }
                onChange={(
                  value
                ) =>
                  update(
                    "address",
                    value
                  )
                }
              />

              <Input
                label="Annual electricity consumption (kWh)"
                type="number"
                value={
                  data.annualConsumption
                }
                onChange={(
                  value
                ) =>
                  update(
                    "annualConsumption",
                    value
                  )
                }
                min={0}
              />

              <Input
                label="Current import rate (p/kWh)"
                type="number"
                value={
                  data.importRate
                }
                onChange={(
                  value
                ) =>
                  update(
                    "importRate",
                    value
                  )
                }
                min={0}
                step={0.01}
              />

              <Input
                label="Current export rate (p/kWh)"
                type="number"
                value={
                  data.exportRate
                }
                onChange={(
                  value
                ) =>
                  update(
                    "exportRate",
                    value
                  )
                }
                min={0}
                step={0.01}
              />

              <Input
                label="Current standing charge (p/day)"
                type="number"
                value={
                  data.standingCharge
                }
                onChange={(
                  value
                ) =>
                  update(
                    "standingCharge",
                    value
                  )
                }
                min={0}
                step={0.01}
              />

              <div
                style={{
                  gridColumn:
                    "1 / -1",
                }}
              >
                <Toggle
                  label="Existing solar PV"
                  value={
                    data.existingSolar
                  }
                  onChange={(
                    value
                  ) =>
                    update(
                      "existingSolar",
                      value
                    )
                  }
                />
              </div>

              {data.existingSolar && (
                <Input
                  label="Existing annual generation (kWh)"
                  type="number"
                  value={
                    data.existingGeneration
                  }
                  onChange={(
                    value
                  ) =>
                    update(
                      "existingGeneration",
                      value
                    )
                  }
                  min={0}
                />
              )}
            </div>
          </Card>
        )}

        {/* =====================================================
            SOLAR PV
            ===================================================== */}

        {step === 1 && (
          <Card
            title="Solar PV"
            subtitle="Configure each proposed roof / solar array."
          >
            <div
              style={{
                marginBottom: 22,
                padding: 16,
                background:
                  "#f8fafc",
                border:
                  "1px solid #e2e8f0",
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  maxWidth: 350,
                }}
              >
                <Input
                  label="Number of arrays"
                  type="number"
                  value={
                    data.numberOfArrays
                  }
                  onChange={(
                    value
                  ) =>
                    update(
                      "numberOfArrays",
                      Math.min(
                        3,
                        Math.max(
                          1,
                          Number(
                            value ||
                              1
                          )
                        )
                      )
                    )
                  }
                  min={1}
                  max={3}
                  step={1}
                />
              </div>

              <p
                style={{
                  margin:
                    "8px 0 0",
                  fontSize: 11,
                  color:
                    "#64748b",
                }}
              >
                Maximum 3 arrays.
              </p>
            </div>

            <div
              style={{
                display:
                  "flex",
                flexDirection:
                  "column",
                gap: 18,
              }}
            >
              {data.arrays
                .slice(
                  0,
                  data.numberOfArrays
                )
                .map(
                  (
                    array,
                    index
                  ) => {
                    const calculated =
                      results.arrays[
                        index
                      ]

                    return (
                      <div
                        key={
                          index
                        }
                        style={{
                          border:
                            "1px solid #dbe3ec",
                          borderRadius: 10,
                          padding: 20,
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            alignItems:
                              "center",
                            marginBottom:
                              18,
                          }}
                        >
                          <div>
                            <h3
                              style={{
                                margin: 0,
                                fontSize: 15,
                              }}
                            >
                              Array{" "}
                              {index +
                                1}
                            </h3>

                            <p
                              style={{
                                margin:
                                  "4px 0 0",
                                fontSize: 11,
                                color:
                                  "#64748b",
                              }}
                            >
                              EPVS roof / array
                            </p>
                          </div>

                          <div
                            style={{
                              background:
                                "#e8f5eb",
                              color:
                                "#26783a",
                              borderRadius:
                                999,
                              padding:
                                "7px 10px",
                              fontSize: 11,
                              fontWeight:
                                700,
                            }}
                          >
                            {calculated
                              ? `${Number(
                                  calculated.systemSize ||
                                    0
                                ).toFixed(
                                  2
                                )} kWp · ${Math.round(
                                  calculated.generation ||
                                    0
                                ).toLocaleString(
                                  "en-GB"
                                )} kWh`
                              : "—"}
                          </div>
                        </div>

                        <div
                          style={
                            styles.grid
                          }
                        >
                          <Input
                            label="Number of panels"
                            type="number"
                            value={
                              array.panelCount
                            }
                            onChange={(
                              value
                            ) =>
                              updateArray(
                                index,
                                "panelCount",
                                value
                              )
                            }
                            min={1}
                          />

                          <Input
                            label="Panel wattage (Wp)"
                            type="number"
                            value={
                              array.panelWattage
                            }
                            onChange={(
                              value
                            ) =>
                              updateArray(
                                index,
                                "panelWattage",
                                value
                              )
                            }
                            min={1}
                          />

                          <Input
                            label="Degrees from south (°)"
                            type="number"
                            value={
                              array.orientation
                            }
                            onChange={(
                              value
                            ) =>
                              updateArray(
                                index,
                                "orientation",
                                value
                              )
                            }
                            min={-180}
                            max={180}
                          />

                          <Input
                            label="Roof pitch / inclination (°)"
                            type="number"
                            value={
                              array.pitch
                            }
                            onChange={(
                              value
                            ) =>
                              updateArray(
                                index,
                                "pitch",
                                value
                              )
                            }
                            min={0}
                            max={90}
                          />

                          <Input
                            label="Irradiance / Kk figure"
                            type="number"
                            value={
                              array.irradiance
                            }
                            onChange={(
                              value
                            ) =>
                              updateArray(
                                index,
                                "irradiance",
                                value
                              )
                            }
                            min={0}
                            step={0.01}
                          />

                          <Input
                            label="Shade factor (SF)"
                            type="number"
                            value={
                              array.shading
                            }
                            onChange={(
                              value
                            ) =>
                              updateArray(
                                index,
                                "shading",
                                value
                              )
                            }
                            min={0}
                            max={1}
                            step={0.01}
                          />

                          <Input
                            label="Calculated system size (kWp)"
                            type="text"
                            value={
                              calculated
                                ? Number(
                                    calculated.systemSize ||
                                      0
                                  ).toFixed(
                                    2
                                  )
                                : "0.00"
                            }
                            disabled
                          />

                          <Input
                            label="Calculated generation (kWh)"
                            type="text"
                            value={
                              calculated
                                ? Number(
                                    calculated.generation ||
                                      0
                                  ).toFixed(
                                    2
                                  )
                                : "0.00"
                            }
                            disabled
                          />
                        </div>
                      </div>
                    )
                  }
                )}
            </div>

            <div
              style={{
                marginTop: 18,
                padding: 18,
                background:
                  "#e8f5eb",
                borderRadius: 10,
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color:
                      "#315b28",
                  }}
                >
                  Total generation
                </div>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    color:
                      "#4d7047",
                  }}
                >
                  {
                    results.numberOfArrays
                  }{" "}
                  array
                  {results.numberOfArrays !==
                  1
                    ? "s"
                    : ""}
                </div>
              </div>

              <strong
                style={{
                  fontSize: 20,
                  color:
                    "#26783a",
                }}
              >
                {Number(
                  results.generation ||
                    0
                ).toFixed(
                  2
                )}{" "}
                kWh
              </strong>
            </div>
          </Card>
        )}

        {/* =====================================================
            BATTERY & INVERTER
            ===================================================== */}

        {step === 2 && (
          <Card
            title="Battery & inverter"
            subtitle="Configure the proposed storage and inverter."
          >
            <div
              style={
                styles.grid
              }
            >
              <Select
                label="Battery configuration"
                value={
                  String(
                    data.batteryCapacity
                  )
                }
                onChange={(
                  value
                ) =>
                  update(
                    "batteryCapacity",
                    Number(
                      value
                    )
                  )
                }
              >
                <option value="0">
                  No battery
                </option>

                <option value="5.12">
                  1 × 5.12 kWh
                </option>

                <option value="10.24">
                  2 × 5.12 kWh
                </option>

                <option value="15.36">
                  3 × 5.12 kWh
                </option>

                <option value="9.4">
                  1 × 9.4 kWh
                </option>

                <option value="18.8">
                  2 × 9.4 kWh
                </option>

                <option value="28.2">
                  3 × 9.4 kWh
                </option>
              </Select>

              <Select
                label="Inverter capacity"
                value={
                  String(
                    data.inverterCapacity
                  )
                }
                onChange={(
                  value
                ) =>
                  update(
                    "inverterCapacity",
                    value
                  )
                }
              >
                <option value="">
                  Select inverter
                </option>

                <option value="3.7">
                  3.7 kW
                </option>

                <option value="6">
                  6 kW
                </option>

                <option value="7">
                  7 kW
                </option>

                <option value="10">
                  10 kW
                </option>
              </Select>
            </div>

            <div
              style={{
                marginTop: 20,
                padding: 16,
                background:
                  "#f8fafc",
                border:
                  "1px solid #e2e8f0",
                borderRadius: 10,
              }}
            >
              <strong>
                Selected system
              </strong>

              <div
                style={{
                  marginTop: 8,
                  display:
                    "flex",
                  gap: 20,
                  flexWrap:
                    "wrap",
                  fontSize: 13,
                  color:
                    "#475569",
                }}
              >
                <span>
                  Battery:{" "}
                  <strong>
                    {Number(
                      data.batteryCapacity ||
                        0
                    ) > 0
                      ? `${data.batteryCapacity} kWh`
                      : "None"}
                  </strong>
                </span>

                <span>
                  Inverter:{" "}
                  <strong>
                    {data.inverterCapacity
                      ? `${data.inverterCapacity} kW`
                      : "Not selected"}
                  </strong>
                </span>
              </div>
            </div>
          </Card>
        )}

        {/* =====================================================
            TARIFF
            ===================================================== */}

        {step === 3 && (
          <Card
            title="Tariff"
            subtitle="Current customer tariff and proposed Octopus Flux tariff."
          >
            {/* CURRENT TARIFF */}

            <div
              style={{
                padding: 18,
                background:
                  "#f8fafc",
                border:
                  "1px solid #e2e8f0",
                borderRadius: 10,
                marginBottom: 20,
              }}
            >
              <h3
                style={{
                  margin:
                    "0 0 5px",
                  fontSize: 15,
                }}
              >
                Current tariff
              </h3>

              <p
                style={{
                  margin:
                    "0 0 16px",
                  fontSize: 12,
                  color:
                    "#64748b",
                }}
              >
                Used as the customer's pre-installation baseline.
              </p>

              <div
                style={
                  styles.grid
                }
              >
                <Input
                  label="Current import rate (p/kWh)"
                  type="number"
                  value={
                    data.importRate
                  }
                  onChange={(
                    value
                  ) =>
                    update(
                      "importRate",
                      value
                    )
                  }
                  min={0}
                  step={0.01}
                />

                <Input
                  label="Current export rate (p/kWh)"
                  type="number"
                  value={
                    data.exportRate
                  }
                  onChange={(
                    value
                  ) =>
                    update(
                      "exportRate",
                      value
                    )
                  }
                  min={0}
                  step={0.01}
                />

                <Input
                  label="Current standing charge (p/day)"
                  type="number"
                  value={
                    data.standingCharge
                  }
                  onChange={(
                    value
                  ) =>
                    update(
                      "standingCharge",
                      value
                    )
                  }
                  min={0}
                  step={0.01}
                />
              </div>
            </div>

            {/* PROPOSED TARIFF */}

            <div
              style={{
                padding: 18,
                background:
                  "white",
                border:
                  "1px solid #dbe3ec",
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "flex-start",
                  gap: 15,
                  marginBottom:
                    18,
                }}
              >
                <div>
                  <h3
                    style={{
                      margin:
                        "0 0 5px",
                      fontSize: 15,
                    }}
                  >
                    Proposed tariff
                  </h3>

                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color:
                        "#64748b",
                    }}
                  >
                    Octopus Flux rates used after installation.
                  </p>
                </div>

                <Select
                  label=""
                  value={
                    data.tariff
                  }
                  onChange={(
                    value
                  ) =>
                    update(
                      "tariff",
                      value
                    )
                  }
                >
                  <option>
                    Standard Flux
                  </option>

                  <option>
                    Intelligent Flux
                  </option>

                  <option>
                    Standard
                  </option>

                  <option>
                    Overnight Charging
                  </option>

                  <option>
                    Octopus Cosy
                  </option>
                </Select>
              </div>

              {data.tariff ===
                "Standard Flux" && (
                <>
                  <div
                    style={{
                      padding:
                        14,
                      background:
                        "#eef4ff",
                      border:
                        "1px solid #cbd8f0",
                      borderRadius:
                        9,
                      marginBottom:
                        18,
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "center",
                        gap: 15,
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <div>
                        <strong>
                          Octopus Flux
                        </strong>

                        <p
                          style={{
                            margin:
                              "5px 0 0",
                            fontSize:
                              12,
                            color:
                              "#64748b",
                          }}
                        >
                          Retrieve the current regional Flux tariff from Octopus.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={
                          getCurrentFluxRates
                        }
                        disabled={
                          loadingFluxRates
                        }
                        style={{
                          ...styles.primary,

                          opacity:
                            loadingFluxRates
                              ? 0.6
                              : 1,

                          cursor:
                            loadingFluxRates
                              ? "default"
                              : "pointer",
                        }}
                      >
                        {loadingFluxRates
                          ? "Getting current rates..."
                          : "Get current Flux rates"}
                      </button>
                    </div>

                    {data.fluxGspGroupId && (
                      <div
                        style={{
                          marginTop:
                            12,
                          fontSize:
                            12,
                          color:
                            "#475569",
                        }}
                      >
                        <strong>
                          GSP region:
                        </strong>{" "}
                        {
                          data.fluxGspGroupId
                        }
                      </div>
                    )}

                    {data.fluxTariffCode && (
                      <div
                        style={{
                          marginTop:
                            4,
                          fontSize:
                            12,
                          color:
                            "#475569",
                        }}
                      >
                        <strong>
                          Tariff:
                        </strong>{" "}
                        {
                          data.fluxTariffCode
                        }
                      </div>
                    )}

                    {data.fluxRetrievedAt && (
                      <div
                        style={{
                          marginTop:
                            4,
                          fontSize:
                            12,
                          color:
                            "#64748b",
                        }}
                      >
                        Rates retrieved:{" "}
                        {new Date(
                          data.fluxRetrievedAt
                        ).toLocaleString(
                          "en-GB"
                        )}
                      </div>
                    )}

                    {fluxRateError && (
                      <div
                        style={{
                          marginTop:
                            12,
                          padding:
                            10,
                          background:
                            "#fff1f2",
                          border:
                            "1px solid #fecdd3",
                          color:
                            "#be123c",
                          borderRadius:
                            7,
                          fontSize:
                            12,
                        }}
                      >
                        {
                          fluxRateError
                        }
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      overflowX:
                        "auto",
                    }}
                  >
                    <table
                      style={{
                        width:
                          "100%",
                        borderCollapse:
                          "collapse",
                        fontSize:
                          13,
                      }}
                    >
                      <thead>
                        <tr>
                          <th
                            style={
                              styles.tableHeader
                            }
                          >
                            Rate
                          </th>

                          <th
                            style={
                              styles.tableHeader
                            }
                          >
                            Import (p/kWh)
                          </th>

                          <th
                            style={
                              styles.tableHeader
                            }
                          >
                            Export (p/kWh)
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        <tr>
                          <td
                            style={
                              styles.tableCell
                            }
                          >
                            Day
                          </td>

                          <td
                            style={
                              styles.tableCell
                            }
                          >
                            <input
                              type="number"
                              value={
                                data.fluxDayImport
                              }
                              step="0.01"
                              min="0"
                              onChange={(
                                event
                              ) =>
                                update(
                                  "fluxDayImport",
                                  Number(
                                    event
                                      .target
                                      .value
                                  )
                                )
                              }
                            />
                          </td>

                          <td
                            style={
                              styles.tableCell
                            }
                          >
                            <input
                              type="number"
                              value={
                                data.fluxDayExport
                              }
                              step="0.01"
                              min="0"
                              onChange={(
                                event
                              ) =>
                                update(
                                  "fluxDayExport",
                                  Number(
                                    event
                                      .target
                                      .value
                                  )
                                )
                              }
                            />
                          </td>
                        </tr>

                        <tr>
                          <td
                            style={
                              styles.tableCell
                            }
                          >
                            Flux / Off-peak
                          </td>

                          <td
                            style={
                              styles.tableCell
                            }
                          >
                            <input
                              type="number"
                              value={
                                data.fluxImport
                              }
                              step="0.01"
                              min="0"
                              onChange={(
                                event
                              ) =>
                                update(
                                  "fluxImport",
                                  Number(
                                    event
                                      .target
                                      .value
                                  )
                                )
                              }
                            />
                          </td>

                          <td
                            style={
                              styles.tableCell
                            }
                          >
                            <input
                              type="number"
                              value={
                                data.fluxExport
                              }
                              step="0.01"
                              min="0"
                              onChange={(
                                event
                              ) =>
                                update(
                                  "fluxExport",
                                  Number(
                                    event
                                      .target
                                      .value
                                  )
                                )
                              }
                            />
                          </td>
                        </tr>

                        <tr>
                          <td
                            style={
                              styles.tableCell
                            }
                          >
                            Peak
                          </td>

                          <td
                            style={
                              styles.tableCell
                            }
                          >
                            <input
                              type="number"
                              value={
                                data.fluxPeakImport
                              }
                              step="0.01"
                              min="0"
                              onChange={(
                                event
                              ) =>
                                update(
                                  "fluxPeakImport",
                                  Number(
                                    event
                                      .target
                                      .value
                                  )
                                )
                              }
                            />
                          </td>

                          <td
                            style={
                              styles.tableCell
                            }
                          >
                            <input
                              type="number"
                              value={
                                data.fluxPeakExport
                              }
                              step="0.01"
                              min="0"
                              onChange={(
                                event
                              ) =>
                                update(
                                  "fluxPeakExport",
                                  Number(
                                    event
                                      .target
                                      .value
                                  )
                                )
                              }
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div
                    style={{
                      marginTop:
                        18,
                      maxWidth:
                        350,
                    }}
                  >
                    <Input
                      label="Flux standing charge (p/day)"
                      type="number"
                      value={
                        data.fluxStandingCharge
                      }
                      onChange={(
                        value
                      ) =>
                        update(
                          "fluxStandingCharge",
                          value
                        )
                      }
                      min={0}
                      step={0.01}
                    />
                  </div>

                  <p
                    style={{
                      margin:
                        "15px 0 0",
                      fontSize:
                        12,
                      color:
                        "#64748b",
                    }}
                  >
                    Flux normally has a cheap overnight period and a higher peak period. The rates retrieved from Octopus remain editable so the sales rep can override them when required.
                  </p>
                </>
              )}
            </div>
          </Card>
        )}

        {/* =====================================================
            FINANCE
            ===================================================== */}

        {step === 4 && (
          <Card
            title="Finance"
            subtitle="Configure the customer's payment method."
          >
            <div
              style={
                styles.grid
              }
            >
              <Select
                label="Payment method"
                value={
                  data.paymentMethod
                }
                onChange={(
                  value
                ) =>
                  update(
                    "paymentMethod",
                    value
                  )
                }
              >
                <option value="Finance">
                  Finance
                </option>

                <option value="Cash">
                  Cash
                </option>
              </Select>

              <Input
                label="System cost (£)"
                type="number"
                value={
                  data.systemCost
                }
                onChange={(
                  value
                ) =>
                  update(
                    "systemCost",
                    value
                  )
                }
                min={0}
              />

              <Input
                label="Deposit (£)"
                type="number"
                value={
                  data.deposit
                }
                onChange={(
                  value
                ) =>
                  update(
                    "deposit",
                    value
                  )
                }
                min={0}
              />

              {data.paymentMethod ===
                "Finance" && (
                <>
                  <Input
                    label="Finance term (years)"
                    type="number"
                    value={
                      data.financeTerm
                    }
                    onChange={(
                      value
                    ) =>
                      update(
                        "financeTerm",
                        value
                      )
                    }
                    min={1}
                  />

                  <Input
                    label="Interest rate (%)"
                    type="number"
                    value={
                      data.financeRate
                    }
                    onChange={(
                      value
                    ) =>
                      update(
                        "financeRate",
                        value
                      )
                    }
                    min={0}
                    step={0.1}
                  />
                </>
              )}

              <div
                style={{
                  padding:
                    15,
                  background:
                    "#f8fafc",
                  border:
                    "1px solid #e2e8f0",
                  borderRadius:
                    9,
                }}
              >
                <div
                  style={{
                    fontSize:
                      11,
                    color:
                      "#64748b",
                  }}
                >
                  Amount after deposit
                </div>

                <strong
                  style={{
                    display:
                      "block",
                    marginTop:
                      5,
                    fontSize:
                      18,
                    color:
                      "#172554",
                  }}
                >
                  {money(
                    Math.max(
                      0,
                      Number(
                        data.systemCost ||
                          0
                      ) -
                        Number(
                          data.deposit ||
                            0
                        )
                    )
                  )}
                </strong>
              </div>
            </div>
          </Card>
        )}

        {/* =====================================================
            RESULTS
            ===================================================== */}

        {step === 5 && (
          <>
            <Results
              results={
                results
              }
              data={data}
            />

            <AnnualBreakdown
              results={
                results
              }
            />

            <ThirtyYearBreakdown
              thirtyYearProjection={
                thirtyYearProjection
              }
            />
          </>
        )}

        {/* =====================================================
            FOOTER
            ===================================================== */}

        <div
          style={
            styles.footer
          }
        >
          <button
            type="button"
            onClick={reset}
            style={
              styles.secondary
            }
          >
            <RotateCcw
              size={16}
            />
            Reset
          </button>

          <div
            style={{
              display:
                "flex",
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={
                back
              }
              disabled={
                step === 0
              }
              style={{
                ...styles.secondary,

                opacity:
                  step === 0
                    ? 0.5
                    : 1,
              }}
            >
              <ArrowLeft
                size={16}
              />
              Back
            </button>

            {step <
              steps.length -
                1 && (
              <button
                type="button"
                onClick={
                  next
                }
                style={
                  styles.primary
                }
              >
                Next
                <ArrowRight
                  size={16}
                />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/*
 * ============================================================
 * CARD
 * ============================================================
 */

function Card({
  title,
  subtitle,
  children,
}) {
  return (
    <div
      className="card"
      style={{
        marginBottom:
          20,
      }}
    >
      <div
        className="card-head"
      >
        <div>
          <h2>
            {title}
          </h2>

          <p>
            {subtitle}
          </p>
        </div>
      </div>

      {children}
    </div>
  )
}

/*
 * ============================================================
 * RESULTS
 * ============================================================
 */

function Results({
  results,
  data,
}) {
  const cards = [
    [
      "System size",
      `${Number(
        results.systemSize ||
          0
      ).toFixed(2)} kWp`,
    ],

    [
      "Estimated generation",
      `${Math.round(
        results.generation ||
          0
      ).toLocaleString(
        "en-GB"
      )} kWh`,
    ],

    [
      "Solar self-consumption",
      `${Math.round(
        results.solarSelfConsumption ||
          0
      ).toLocaleString(
        "en-GB"
      )} kWh`,
    ],

    [
      "Battery contribution",
      `${Math.round(
        results.batteryContribution ||
          0
      ).toLocaleString(
        "en-GB"
      )} kWh`,
    ],

    [
      "Estimated export",
      `${Math.round(
        results.exportKwh ||
          0
      ).toLocaleString(
        "en-GB"
      )} kWh`,
    ],

    [
      "Annual saving",
      money(
        results.annualSaving
      ),
    ],

    [
      "Monthly finance",
      data.paymentMethod ===
      "Finance"
        ? money(
            results.monthlyPayment
          )
        : "Cash",
    ],

    [
      "Simple payback",
      results.simplePayback
        ? `${Number(
            results.simplePayback
          ).toFixed(
            1
          )} years`
        : "—",
    ],
  ]

  return (
    <div
      className="card"
      style={{
        marginBottom:
          20,
      }}
    >
      <div
        className="card-head"
      >
        <div>
          <h2>
            EPVS calculation results
          </h2>

          <p>
            {data.customerName ||
              "New calculation"}{" "}
            ·{" "}
            {data.postcode ||
              "No postcode entered"}
          </p>
        </div>

        <div
          style={
            styles.badge
          }
        >
          Preliminary model
        </div>
      </div>

      <div
        style={
          styles.resultGrid
        }
      >
        {cards.map(
          ([label, value]) => (
            <div
              key={label}
              style={
                styles.resultCard
              }
            >
              <span>
                {label}
              </span>

              <strong>
                {value}
              </strong>
            </div>
          )
        )}
      </div>
    </div>
  )
}

/*
 * ============================================================
 * STYLES
 * ============================================================
 */

const styles = {
  wrapper: {
    maxWidth: 1200,
    margin: "0 auto",
  },

  stepper: {
    display: "grid",

    gridTemplateColumns:
      "repeat(6, minmax(90px, 1fr))",

    gap: 8,

    marginBottom: 20,

    overflowX: "auto",

    paddingBottom: 5,
  },

  step: {
    border: 0,

    background:
      "transparent",

    cursor: "pointer",

    display: "flex",

    flexDirection:
      "column",

    alignItems:
      "center",

    gap: 7,

    color:
      "#334155",

    fontSize: 12,

    whiteSpace:
      "nowrap",
  },

  stepCircle: {
    width: 34,

    height: 34,

    borderRadius:
      "50%",

    display: "flex",

    alignItems:
      "center",

    justifyContent:
      "center",
  },

  grid: {
    display: "grid",

    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",

    gap: 18,
  },

  field: {
    display: "flex",

    flexDirection:
      "column",

    gap: 7,
  },

  toggleRow: {
    display: "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    minHeight: 42,
  },

  toggle: {
    border: 0,

    width: 44,

    height: 24,

    borderRadius: 20,

    padding: 2,

    cursor: "pointer",
  },

  toggleKnob: {
    display: "block",

    width: 20,

    height: 20,

    background:
      "white",

    borderRadius:
      "50%",

    transition:
      "transform .15s",
  },

  footer: {
    display: "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    marginTop: 10,
  },

  primary: {
    border: 0,

    background:
      "#172554",

    color: "white",

    borderRadius: 8,

    padding:
      "11px 16px",

    display:
      "inline-flex",

    alignItems:
      "center",

    gap: 8,

    cursor: "pointer",

    fontWeight: 600,
  },

  secondary: {
    border:
      "1px solid #d7dee8",

    background:
      "white",

    color:
      "#334155",

    borderRadius: 8,

    padding:
      "10px 14px",

    display:
      "inline-flex",

    alignItems:
      "center",

    gap: 8,

    cursor: "pointer",
  },

  badge: {
    background:
      "#fff7ed",

    color:
      "#9a3412",

    borderRadius:
      999,

    padding:
      "6px 10px",

    fontSize: 12,

    fontWeight: 600,
  },

  resultGrid: {
    display: "grid",

    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",

    gap: 12,
  },

  resultCard: {
    border:
      "1px solid #e5e7eb",

    borderRadius: 10,

    padding: 16,

    display: "flex",

    flexDirection:
      "column",

    gap: 7,
  },

  tableHeader: {
    textAlign:
      "left",

    padding: 10,

    borderBottom:
      "1px solid #dbe3ec",

    background:
      "#f8fafc",
  },

  tableCell: {
    padding: 10,

    borderBottom:
      "1px solid #e5e7eb",
  },
}
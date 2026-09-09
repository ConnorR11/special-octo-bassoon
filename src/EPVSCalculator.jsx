import React, { useEffect, useMemo, useState } from "react"

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
  { title: "Customer", icon: Home },
  { title: "Solar PV", icon: Zap },
  { title: "Battery", icon: Battery },
  { title: "Inverter", icon: Zap },
  { title: "Tariff", icon: PoundSterling },
  { title: "Finance", icon: PoundSterling },
  { title: "Results", icon: CheckCircle2 },
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

  existingSolar: false,
  existingGeneration: 0,

  numberOfArrays: 1,

  arrays: [
    createArray(),
    createArray(),
    createArray(),
  ],

  batteryCapacity: 10,
  batteryEnabled: true,

  inverterCapacity: 5,

  importRate: 0.28,
  exportRate: 0.15,
  standingCharge: 0.30,

  tariff: "Standard",

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
          const value =
            type === "number"
              ? Number(event.target.value)
              : event.target.value

          onChange(value)
        }}
      />
    </label>
  )
}

function Toggle({ label, value, onChange }) {
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

  const update = (key, value) => {
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
      const arrays = [...current.arrays]

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
   * =========================================================
   * CALCULATIONS
   * =========================================================
   */

  const results = useMemo(() => {
    const numberOfArrays = Math.min(
      3,
      Math.max(
        1,
        Number(data.numberOfArrays || 1)
      )
    )

    const activeArrays =
      data.arrays.slice(
        0,
        numberOfArrays
      )

    /*
     * EPVS ARRAY GENERATION
     *
     * Each array is calculated independently:
     *
     * System size =
     * panel wattage × panel count / 1000
     *
     * Generation =
     * system size × irradiance × shade factor
     *
     * The irradiance / Kk figure is entered
     * separately for each roof/array.
     */

    const calculatedArrays =
      activeArrays.map(
        (array, index) => {
          const panelWattage =
            Number(
              array.panelWattage || 0
            )

          const panelCount =
            Number(
              array.panelCount || 0
            )

          const irradiance =
            Number(
              array.irradiance || 0
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

            arrayNumber: index + 1,

            systemSize,

            generation,
          }
        }
      )

    const systemSize =
      calculatedArrays.reduce(
        (total, array) =>
          total +
          array.systemSize,
        0
      )

    const generation =
      calculatedArrays.reduce(
        (total, array) =>
          total +
          array.generation,
        0
      )

    /*
     * =======================================================
     * SELF CONSUMPTION
     * =======================================================
     */

    const annualConsumption =
      Number(
        data.annualConsumption || 0
      )

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
     * =======================================================
     * BATTERY
     * =======================================================
     */

    const batteryContribution =
      data.batteryEnabled
        ? Math.min(
            remainingGeneration,

            annualConsumption *
              0.25,

            Number(
              data.batteryCapacity || 0
            ) * 180
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
     * =======================================================
     * FINANCIAL BENEFIT
     * =======================================================
     */

    const solarBenefit =
      solarSelfConsumption *
      Number(
        data.importRate || 0
      )

    const batterySelfConsumptionBenefit =
      batteryContribution *
      Number(
        data.importRate || 0
      )

    const forceChargeBenefit = 0

    const exportBenefit =
      exportKwh *
      Number(
        data.exportRate || 0
      )

    const annualSaving =
      solarBenefit +
      batterySelfConsumptionBenefit +
      forceChargeBenefit +
      exportBenefit

    /*
     * =======================================================
     * FINANCE
     * =======================================================
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
      monthlyRate > 0 &&
      months > 0
        ? financeAmount *
          (monthlyRate *
            Math.pow(
              1 + monthlyRate,
              months
            )) /
          (Math.pow(
            1 + monthlyRate,
            months
          ) - 1)
        : data.paymentMethod ===
            "Finance" &&
          months > 0
        ? financeAmount / months
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
   * =========================================================
   * 30 YEAR CALCULATION
   * =========================================================
   *
   * EPVS uses three inflation scenarios for the long-term
   * presentation: 0%, 3.8% and 7.6%.
   *
   * The UI component expects all three scenarios to be returned
   * under `thirtyYearProjection.scenarios`.
   */

  const thirtyYearProjection =
    useMemo(() => {
      const systemCost =
        Number(data.systemCost || 0)

      const deposit =
        Number(data.deposit || 0)

      const annualConsumption =
        Number(data.annualConsumption || 0)

      const importRate =
        Number(data.importRate || 0)

      const exportRate =
        Number(data.exportRate || 0)

      const firstYearGeneration =
        Number(results.generation || 0)

      const firstYearSolar =
        Number(results.solarSelfConsumption || 0)

      const firstYearBattery =
        Number(results.batteryContribution || 0)

      const annualDegradation = 0.004

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

      const buildScenario = (inflationRate) => {
        const rows = []
        let cumulativePosition = 0

        for (let year = 1; year <= 30; year++) {
          const generation =
            firstYearGeneration *
            Math.pow(
              1 - annualDegradation,
              year - 1
            )

          const solar =
            firstYearGeneration > 0
              ? generation *
                (firstYearSolar / firstYearGeneration)
              : 0

          const battery =
            firstYearGeneration > 0
              ? generation *
                (firstYearBattery / firstYearGeneration)
              : 0

          const exportKwh = Math.max(
            0,
            generation - solar - battery
          )

          const inflationMultiplier =
            Math.pow(
              1 + inflationRate,
              year - 1
            )

          const importRateYear =
            importRate * inflationMultiplier

          const exportRateYear =
            exportRate * inflationMultiplier

          const solarBenefit =
            solar * importRateYear

          const batteryBenefit =
            battery * importRateYear

          const exportBenefit =
            exportKwh * exportRateYear

          const forceChargeBenefit = 0

          const annualBenefit =
            solarBenefit +
            batteryBenefit +
            forceChargeBenefit +
            exportBenefit

          /*
           * The capital cost is applied in year 1.
           * The deposit is paid separately, so the remaining
           * system balance is the year-one payment represented
           * in the long-term cash position.
           */
          const yearlyPayment =
            year === 1
              ? Math.max(
                  0,
                  systemCost - deposit
                )
              : 0

          const netAnnualBenefit =
            annualBenefit - yearlyPayment

          cumulativePosition +=
            netAnnualBenefit

          const billPreInstall =
            annualConsumption *
            importRateYear

          const gridReduction =
            solar + battery

          const remainingGrid = Math.max(
            0,
            annualConsumption - gridReduction
          )

          const billPostInstall =
            remainingGrid * importRateYear

          const annualSaving =
            annualBenefit

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
            annualSaving,
            yearlyPayment,
            netAnnualBenefit,
            cumulativePosition,
            billPreInstall,
            billPostInstall,
            importRateYear,
            exportRateYear,
          })
        }

        const totals = rows.reduce(
          (total, row) => {
            total.generation += row.generation
            total.solar += row.solar
            total.battery += row.battery
            total.exportKwh += row.exportKwh
            total.solarBenefit += row.solarBenefit
            total.batteryBenefit += row.batteryBenefit
            total.forceChargeBenefit += row.forceChargeBenefit
            total.exportBenefit += row.exportBenefit
            total.annualBenefit += row.annualBenefit
            total.yearlyPayment += row.yearlyPayment
            total.netAnnualBenefit += row.netAnnualBenefit
            total.billPreInstall += row.billPreInstall
            total.billPostInstall += row.billPostInstall

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
              row.cumulativePosition >= 0
          )

        return {
          inflationRate,
          rows,
          totals,
          paybackPeriod:
            paybackRow?.year || null,
          totalNetSavings:
            totals.netAnnualBenefit,
          finalNetPosition:
            rows[rows.length - 1]?.cumulativePosition || 0,
          totalNetReturn:
            totals.netAnnualBenefit - systemCost,
        }
      }

      const scenarios = {}

      inflationScenarios.forEach((scenario) => {
        scenarios[scenario.key] =
          buildScenario(scenario.rate)
      })

      return {
        inflationScenarios,
        scenarios,
      }
    }, [data, results])

  /*
   * =========================================================
   * SEND CALCULATION TO APPOINTMENT DETAIL
   * =========================================================
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
    setData(appointmentInitial)
    setStep(0)
  }

  return (
    <section>
      <div style={styles.wrapper}>

        {/* =================================================
            STEPPER
            ================================================= */}

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
                    {item.title}
                  </span>
                </button>
              )
            }
          )}
        </div>

        {/* =================================================
            CUSTOMER & ENERGY
            ================================================= */}

        {step === 0 && (
          <Card
            title="Customer"
            subtitle="Customer details, electricity usage and existing solar PV."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              <div>
                <h3 style={{ margin: "0 0 14px", fontSize: 15, color: "#172554" }}>
                  Customer details
                </h3>
                <div style={styles.grid}>
                  <Input
                    label="Customer name"
                    value={data.customerName}
                    onChange={(value) => update("customerName", value)}
                  />
                  <Input
                    label="Postcode"
                    value={data.postcode}
                    onChange={(value) => update("postcode", value)}
                  />
                  <Input
                    label="Address"
                    value={data.address}
                    onChange={(value) => update("address", value)}
                  />
                </div>
              </div>

              <div>
                <h3 style={{ margin: "0 0 14px", fontSize: 15, color: "#172554" }}>
                  Electricity
                </h3>
                <div style={styles.grid}>
                  <Input
                    label="Annual electricity consumption (kWh)"
                    type="number"
                    value={data.annualConsumption}
                    onChange={(value) => update("annualConsumption", value)}
                    min={0}
                  />
                  <Input
                    label="Current import rate (p/kWh)"
                    type="number"
                    value={Number(data.importRate || 0) * 100}
                    onChange={(value) => update("importRate", Number(value || 0) / 100)}
                    min={0}
                    step={0.01}
                  />
                  <Input
                    label="Current export rate (p/kWh)"
                    type="number"
                    value={Number(data.exportRate || 0) * 100}
                    onChange={(value) => update("exportRate", Number(value || 0) / 100)}
                    min={0}
                    step={0.01}
                  />
                  <Input
                    label="Current standing charge (p/day)"
                    type="number"
                    value={Number(data.standingCharge || 0) * 100}
                    onChange={(value) => update("standingCharge", Number(value || 0) / 100)}
                    min={0}
                    step={0.01}
                  />
                </div>
              </div>

              <div>
                <h3 style={{ margin: "0 0 14px", fontSize: 15, color: "#172554" }}>
                  Existing solar PV
                </h3>
                <div style={styles.grid}>
                  <Toggle
                    label="Existing solar PV"
                    value={data.existingSolar}
                    onChange={(value) => update("existingSolar", value)}
                  />
                  {data.existingSolar && (
                    <Input
                      label="Existing annual generation (kWh)"
                      type="number"
                      value={data.existingGeneration}
                      onChange={(value) => update("existingGeneration", value)}
                      min={0}
                    />
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* =================================================
            SOLAR PV
            ================================================= */}

        {step === 1 && (
          <Card
            title="Solar PV arrays"
            subtitle="Enter the EPVS information for each roof / array."
          >

            {/* NUMBER OF ARRAYS */}

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
                          value ||
                            1
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
                Add an array when
                the panels are split
                across different
                roof orientations.
              </p>
            </div>

            {/* ARRAYS */}

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
                              EPVS roof /
                              array
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
                              ? `${Number(calculated.systemSize || 0).toFixed(
                                  2
                                )} kWp · ${Math.round(
                                  calculated.generation
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
                            type="number"
                            value={
                              calculated
                                ? Number(calculated.systemSize || 0).toFixed(
                                    2
                                  )
                                : "0.00"
                            }
                            disabled
                          />

                          <Input
                            label="Calculated generation (kWh)"
                            type="number"
                            value={
                              calculated
                                ? Number(calculated.generation || 0).toFixed(
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

            {/* TOTAL */}

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
                  Total overall
                  generation
                </div>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    color:
                      "#4d7047",
                  }}
                >
                  {results.numberOfArrays}{" "}
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
                {Number(results.generation || 0).toFixed(
                  2
                )}{" "}
                kWh
              </strong>
            </div>
          </Card>
        )}

        {/* =================================================
            BATTERY
            ================================================= */}

        {step === 2 && (
          <Card
            title="Battery"
            subtitle="Configure the proposed battery."
          >
            <div
              style={styles.grid}
            >
              <Toggle
                label="Battery included"
                value={
                  data.batteryEnabled
                }
                onChange={(
                  value
                ) =>
                  update(
                    "batteryEnabled",
                    value
                  )
                }
              />

              {data.batteryEnabled && (
                <Input
                  label="Battery capacity (kWh)"
                  type="number"
                  value={
                    data.batteryCapacity
                  }
                  onChange={(
                    value
                  ) =>
                    update(
                      "batteryCapacity",
                      value
                    )
                  }
                  min={0}
                  step={0.1}
                />
              )}
            </div>
          </Card>
        )}

        {/* =================================================
            INVERTER
            ================================================= */}

        {step === 3 && (
          <Card
            title="Inverter"
            subtitle="Configure the inverter capacity."
          >
            <div
              style={styles.grid}
            >
              <Input
                label="Inverter capacity (kW)"
                type="number"
                value={
                  data.inverterCapacity
                }
                onChange={(
                  value
                ) =>
                  update(
                    "inverterCapacity",
                    value
                  )
                }
                min={0}
                step={0.1}
              />
            </div>
          </Card>
        )}

        {/* =================================================
            TARIFF
            ================================================= */}

        {step === 4 && (
          <Card
            title="Tariff"
            subtitle="Select the tariff model."
          >
            <div
              style={styles.grid}
            >
              <label
                style={
                  styles.field
                }
              >
                <span>
                  Tariff
                </span>

                <select
                  value={
                    data.tariff
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "tariff",
                      event.target
                        .value
                    )
                  }
                >
                  <option>
                    Standard
                  </option>

                  <option>
                    Overnight Charging
                  </option>

                  <option>
                    Standard Flux
                  </option>

                  <option>
                    Intelligent Flux
                  </option>

                  <option>
                    Octopus Cosy
                  </option>
                </select>
              </label>
            </div>
          </Card>
        )}

        {/* =================================================
            FINANCE
            ================================================= */}

        {step === 5 && (
          <Card
            title="Payment"
            subtitle="Choose how the customer is paying for the system."
          >
            <div
              style={styles.grid}
            >

              <label
                style={
                  styles.field
                }
              >
                <span>
                  Payment method
                </span>

                <select
                  value={
                    data.paymentMethod
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "paymentMethod",
                      event.target
                        .value
                    )
                  }
                >
                  <option value="Finance">
                    Finance
                  </option>

                  <option value="Cash">
                    Cash
                  </option>
                </select>
              </label>

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
                  padding: 15,
                  background:
                    "#f8fafc",
                  border:
                    "1px solid #e2e8f0",
                  borderRadius: 9,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color:
                      "#64748b",
                  }}
                >
                  Amount after
                  deposit
                </div>

                <strong
                  style={{
                    display:
                      "block",
                    marginTop: 5,
                    fontSize: 18,
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

        {/* =================================================
            RESULTS
            ================================================= */}

        {step === 6 && (
          <>
            <Results
              results={results}
              data={data}
            />

            <AnnualBreakdown
              results={results}
            />

            <ThirtyYearBreakdown
              thirtyYearProjection={
                thirtyYearProjection
              }
            />
          </>
        )}

        {/* =================================================
            FOOTER
            ================================================= */}

        <div
          style={styles.footer}
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
              onClick={back}
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
                onClick={next}
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
 * =========================================================
 * CARD
 * =========================================================
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
        marginBottom: 20,
      }}
    >
      <div
        className="card-head"
      >
        <div>
          <h2>{title}</h2>

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
 * =========================================================
 * RESULTS
 * =========================================================
 */

function Results({
  results,
  data,
}) {
  const cards = [
    [
      "System size",
      `${Number(results.systemSize || 0).toFixed(
        2
      )} kWp`,
    ],

    [
      "Estimated generation",
      `${Math.round(
        results.generation
      ).toLocaleString(
        "en-GB"
      )} kWh`,
    ],

    [
      "Solar self-consumption",
      `${Math.round(
        results.solarSelfConsumption
      ).toLocaleString(
        "en-GB"
      )} kWh`,
    ],

    [
      "Battery contribution",
      `${Math.round(
        results.batteryContribution
      ).toLocaleString(
        "en-GB"
      )} kWh`,
    ],

    [
      "Estimated export",
      `${Math.round(
        results.exportKwh
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
        ? `${Number(results.simplePayback || 0).toFixed(
            1
          )} years`
        : "—",
    ],
  ]

  return (
    <div
      className="card"
      style={{
        marginBottom: 20,
      }}
    >
      <div
        className="card-head"
      >
        <div>
          <h2>
            EPVS calculation
            results
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
 * =========================================================
 * STYLES
 * =========================================================
 */

const styles = {
  wrapper: {
    maxWidth: 1200,
    margin: "0 auto",
  },

  stepper: {
    display: "grid",
    gridTemplateColumns:
      "repeat(7, minmax(70px, 1fr))",
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
    borderRadius:
      20,
    padding: 2,
    cursor:
      "pointer",
  },

  toggleKnob: {
    display:
      "block",
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
    cursor:
      "pointer",
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
    cursor:
      "pointer",
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
}
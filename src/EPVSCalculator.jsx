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
    title: "Property",
    icon: Home,
  },
  {
    title: "Solar PV",
    icon: Zap,
  },
  {
    title: "Battery",
    icon: Battery,
  },
  {
    title: "Inverter",
    icon: Zap,
  },
  {
    title: "Electricity",
    icon: Zap,
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
  panelCount: 0,
  panelWattage: 415,
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

  tariff: "Standard",

  paymentMethod: "Cash",

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
              ? Number(event.target.value)
              : event.target.value

          onChange(nextValue)
        }}
        style={{
          ...styles.input,
          opacity: disabled ? 0.55 : 1,
          background: disabled
            ? "#f5f5f5"
            : "#fff",
        }}
      />
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

function SelectInput({
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
        style={styles.input}
      >
        {children}
      </select>
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

  /*
   * =========================================================
   * UPDATE ARRAY
   * =========================================================
   */

  const updateArray = (
    index,
    key,
    value
  ) => {
    setData((current) => {
      const arrays = [
        ...(current.arrays || []),
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
   * =========================================================
   * CALCULATIONS
   * =========================================================
   *
   * EPVS array calculation:
   *
   * System Size (kWp)
   * =
   * Panel Wattage × Panel Count / 1000
   *
   * Generation (kWh)
   * =
   * System Size × Irradiance/Kk × Shade Factor
   *
   * Total Generation
   * =
   * Sum of all active arrays
   */

  const results = useMemo(() => {
    const numberOfArrays = Math.min(
      3,
      Math.max(
        1,
        Number(
          data.numberOfArrays || 1
        )
      )
    )

    const arrays = (
      data.arrays || []
    )
      .slice(0, numberOfArrays)
      .map((array, index) => {
        const panelCount =
          Number(
            array.panelCount || 0
          )

        const panelWattage =
          Number(
            array.panelWattage || 0
          )

        const orientation =
          Number(
            array.orientation || 0
          )

        const pitch =
          Number(
            array.pitch || 0
          )

        const irradiance =
          Number(
            array.irradiance || 0
          )

        const shading =
          Number(
            array.shading ?? 1
          )

        const systemSize =
          (panelCount *
            panelWattage) /
          1000

        /*
         * EPVS generation formula.
         *
         * Example:
         *
         * 3.04 kWp
         * × 783 Kk
         * × 0.96 SF
         * =
         * 2285.11 kWh
         */

        const generation =
          systemSize *
          irradiance *
          shading

        return {
          array: index + 1,

          panelCount,
          panelWattage,

          systemSize,

          orientation,
          pitch,

          irradiance,
          shading,

          generation,
        }
      })

    const totalSystemSize =
      arrays.reduce(
        (total, array) =>
          total +
          array.systemSize,
        0
      )

    const totalGeneration =
      arrays.reduce(
        (total, array) =>
          total +
          array.generation,
        0
      )

    /*
     * =======================================================
     * CONSUMPTION / SELF-CONSUMPTION
     * =======================================================
     *
     * This section continues to use the overall EPVS
     * generation figure produced above.
     */

    const annualConsumption =
      Number(
        data.annualConsumption || 0
      )

    const importRate =
      Number(
        data.importRate || 0
      )

    const exportRate =
      Number(
        data.exportRate || 0
      )

    const solarSelfConsumption =
      Math.min(
        totalGeneration,
        annualConsumption *
          0.375
      )

    const remainingGeneration =
      Math.max(
        0,
        totalGeneration -
          solarSelfConsumption
      )

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
        totalGeneration -
          solarSelfConsumption -
          batteryContribution
      )

    const gridReduction =
      solarSelfConsumption +
      batteryContribution

    const solarBenefit =
      solarSelfConsumption *
      importRate

    const batterySelfConsumptionBenefit =
      batteryContribution *
      importRate

    const forceChargeBenefit = 0

    const exportBenefit =
      exportKwh *
      exportRate

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
      Math.max(
        0,
        systemCost - deposit
      )

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

    let monthlyPayment = 0

    if (
      data.paymentMethod ===
      "Finance"
    ) {
      if (
        financeAmount > 0 &&
        monthlyRate > 0 &&
        months > 0
      ) {
        monthlyPayment =
          financeAmount *
          (monthlyRate *
            Math.pow(
              1 + monthlyRate,
              months
            )) /
          (Math.pow(
            1 + monthlyRate,
            months
          ) - 1)
      } else if (
        financeAmount > 0 &&
        months > 0
      ) {
        monthlyPayment =
          financeAmount / months
      }
    }

    const simplePayback =
      annualSaving > 0
        ? systemCost /
          annualSaving
        : null

    return {
      numberOfArrays,

      arrays,

      totalSystemSize,

      systemSize:
        totalSystemSize,

      generation:
        totalGeneration,

      totalGeneration,

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
   */

  const thirtyYearProjection =
    useMemo(() => {
      const rows = []

      let cumulativePosition = 0

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
        )

      const exportRate =
        Number(
          data.exportRate || 0
        )

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
       * These are currently the assumptions used by the
       * preliminary 30-year model.
       */

      const annualRateIncrease =
        0.076

      const annualDegradation =
        0.004

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

        const importRateYear =
          importRate *
          Math.pow(
            1 +
              annualRateIncrease,
            year - 1
          )

        const exportRateYear =
          exportRate *
          Math.pow(
            1 +
              annualRateIncrease,
            year - 1
          )

        const solarBenefit =
          solar *
          importRateYear

        const batteryBenefit =
          battery *
          importRateYear

        const exportBenefit =
          exportKwh *
          exportRateYear

        const annualBenefit =
          solarBenefit +
          batteryBenefit +
          exportBenefit

        /*
         * Only apply the upfront system payment once.
         *
         * Deposit is paid upfront, therefore the remaining
         * system cost is used as the first-year payment.
         */

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

      const totals =
        rows.reduce(
          (total, row) => {
            total.generation +=
              row.generation

            total.solar +=
              row.solar

            total.battery +=
              row.battery

            total.exportKwh +=
              row.exportKwh

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

      const paybackRow =
        rows.find(
          (row) =>
            row.cumulativePosition >=
            0
        )

      return {
        rows,

        totals,

        paybackPeriod:
          paybackRow?.year ||
          null,

        totalNetSavings:
          totals.netAnnualBenefit,

        totalNetReturn:
          totals.netAnnualBenefit -
          systemCost,
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

  /*
   * =========================================================
   * NAVIGATION
   * =========================================================
   */

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
      Math.max(0, current - 1)
    )
  }

  const reset = () => {
    setData(
      appointmentInitial
    )

    setStep(0)
  }

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <section>
      <div style={styles.wrapper}>
        {/* ===================================================
            STEPPER
            =================================================== */}

        <div style={styles.stepper}>
          {steps.map(
            (item, index) => {
              const Icon = item.icon

              const active =
                index === step

              const complete =
                index < step

              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => {
                    if (
                      index <= step
                    ) {
                      setStep(index)
                    }
                  }}
                  style={{
                    ...styles.step,
                    opacity:
                      index > step
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
                    <Icon size={16} />
                  </div>

                  <span>
                    {item.title}
                  </span>
                </button>
              )
            }
          )}
        </div>

        {/* ===================================================
            CUSTOMER
            =================================================== */}

        {step === 0 && (
          <Card
            title="Customer details"
            subtitle="Start the EPVS calculation with the customer and property information."
          >
            <div style={styles.grid}>
              <Input
                label="Customer name"
                value={
                  data.customerName
                }
                onChange={(value) =>
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
                onChange={(value) =>
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
                onChange={(value) =>
                  update(
                    "address",
                    value
                  )
                }
              />
            </div>
          </Card>
        )}

        {/* ===================================================
            PROPERTY
            =================================================== */}

        {step === 1 && (
          <Card
            title="Property"
            subtitle="Property and existing-system assumptions."
          >
            <div style={styles.grid}>
              <Input
                label="Annual electricity consumption (kWh)"
                type="number"
                value={
                  data.annualConsumption
                }
                onChange={(value) =>
                  update(
                    "annualConsumption",
                    value
                  )
                }
                min={0}
              />

              <Toggle
                label="Existing solar PV"
                value={
                  data.existingSolar
                }
                onChange={(value) =>
                  update(
                    "existingSolar",
                    value
                  )
                }
              />

              {data.existingSolar && (
                <Input
                  label="Existing annual generation (kWh)"
                  type="number"
                  value={
                    data.existingGeneration
                  }
                  onChange={(value) =>
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

        {/* ===================================================
            SOLAR PV
            =================================================== */}

        {step === 2 && (
          <Card
            title="Solar PV arrays"
            subtitle="Enter the EPVS information for each roof / array."
          >
            {/* NUMBER OF ARRAYS */}

            <div
              style={{
                maxWidth: 320,
                marginBottom: 22,
              }}
            >
              <Input
                label="Number of arrays"
                type="number"
                value={
                  data.numberOfArrays
                }
                onChange={(value) => {
                  const numberOfArrays =
                    Math.min(
                      3,
                      Math.max(
                        1,
                        Number(
                          value || 1
                        )
                      )
                    )

                  update(
                    "numberOfArrays",
                    numberOfArrays
                  )
                }}
                min={1}
                max={3}
              />

              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: "#64748b",
                }}
              >
                Maximum 3 arrays.
              </div>
            </div>

            {/* ARRAY CARDS */}

            <div
              style={{
                display: "flex",
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
                    const systemSize =
                      (Number(
                        array.panelWattage ||
                          0
                      ) *
                        Number(
                          array.panelCount ||
                            0
                        )) /
                      1000

                    const generation =
                      systemSize *
                      Number(
                        array.irradiance ||
                          0
                      ) *
                      Number(
                        array.shading ??
                          1
                      )

                    return (
                      <div
                        key={
                          index
                        }
                        style={
                          styles.arrayCard
                        }
                      >
                        {/* ARRAY HEADER */}

                        <div
                          style={
                            styles.arrayHeader
                          }
                        >
                          <div>
                            <h3
                              style={{
                                margin: 0,
                                fontSize:
                                  16,
                                fontWeight:
                                  700,
                                color:
                                  "#111827",
                              }}
                            >
                              Array{" "}
                              {index +
                                1}
                            </h3>

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
                              EPVS roof /
                              array
                            </div>
                          </div>

                          <div
                            style={
                              styles.arrayBadge
                            }
                          >
                            {systemSize.toFixed(
                              2
                            )}{" "}
                            kWp
                            {" · "}
                            {generation.toFixed(
                              2
                            )}{" "}
                            kWh
                          </div>
                        </div>

                        {/* ARRAY INPUTS */}

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
                            min={0}
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
                            min={0}
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

                          {/* CALCULATED SYSTEM SIZE */}

                          <div
                            style={
                              styles.field
                            }
                          >
                            <span>
                              Calculated system
                              size (kWp)
                            </span>

                            <div
                              style={
                                styles.calculatedField
                              }
                            >
                              {systemSize.toFixed(
                                2
                              )}
                            </div>
                          </div>

                          {/* CALCULATED GENERATION */}

                          <div
                            style={
                              styles.field
                            }
                          >
                            <span>
                              Calculated
                              generation
                              (kWh)
                            </span>

                            <div
                              style={
                                styles.calculatedField
                              }
                            >
                              {generation.toFixed(
                                2
                              )}
                            </div>
                          </div>
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
                padding: 16,
                borderRadius: 10,
                background:
                  "#e8f5eb",
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap: 20,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color:
                      "#26783a",
                    fontWeight:
                      600,
                  }}
                >
                  Total overall
                  generation
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color:
                      "#4b5563",
                    marginTop: 3,
                  }}
                >
                  Sum of all active
                  EPVS arrays
                </div>
              </div>

              <strong
                style={{
                  fontSize: 18,
                  color:
                    "#26783a",
                }}
              >
                {Number(
                  results.totalGeneration ||
                    0
                ).toFixed(2)}{" "}
                kWh
              </strong>
            </div>
          </Card>
        )}

        {/* ===================================================
            BATTERY
            =================================================== */}

        {step === 3 && (
          <Card
            title="Battery"
            subtitle="Configure the proposed battery."
          >
            <div style={styles.grid}>
              <Toggle
                label="Battery included"
                value={
                  data.batteryEnabled
                }
                onChange={(value) =>
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
                  onChange={(value) =>
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

        {/* ===================================================
            INVERTER
            =================================================== */}

        {step === 4 && (
          <Card
            title="Inverter"
            subtitle="Configure the inverter capacity."
          >
            <div style={styles.grid}>
              <Input
                label="Inverter capacity (kW)"
                type="number"
                value={
                  data.inverterCapacity
                }
                onChange={(value) =>
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

        {/* ===================================================
            ELECTRICITY
            =================================================== */}

        {step === 5 && (
          <Card
            title="Electricity"
            subtitle="Current electricity assumptions."
          >
            <div style={styles.grid}>
              <Input
                label="Annual consumption (kWh)"
                type="number"
                value={
                  data.annualConsumption
                }
                onChange={(value) =>
                  update(
                    "annualConsumption",
                    value
                  )
                }
                min={0}
              />

              <Input
                label="Import rate (£/kWh)"
                type="number"
                value={
                  data.importRate
                }
                onChange={(value) =>
                  update(
                    "importRate",
                    value
                  )
                }
                min={0}
                step={0.001}
              />

              <Input
                label="Export rate (£/kWh)"
                type="number"
                value={
                  data.exportRate
                }
                onChange={(value) =>
                  update(
                    "exportRate",
                    value
                  )
                }
                min={0}
                step={0.001}
              />
            </div>
          </Card>
        )}

        {/* ===================================================
            TARIFF
            =================================================== */}

        {step === 6 && (
          <Card
            title="Tariff"
            subtitle="Select the tariff model."
          >
            <div style={styles.grid}>
              <SelectInput
                label="Tariff"
                value={data.tariff}
                onChange={(value) =>
                  update(
                    "tariff",
                    value
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
              </SelectInput>
            </div>
          </Card>
        )}

        {/* ===================================================
            FINANCE
            =================================================== */}

        {step === 7 && (
          <Card
            title="Finance"
            subtitle="System cost, deposit and payment method."
          >
            <div style={styles.grid}>
              <SelectInput
                label="Payment method"
                value={
                  data.paymentMethod
                }
                onChange={(value) =>
                  update(
                    "paymentMethod",
                    value
                  )
                }
              >
                <option value="Cash">
                  Cash
                </option>

                <option value="Finance">
                  Finance
                </option>
              </SelectInput>

              <Input
                label="System cost (£)"
                type="number"
                value={
                  data.systemCost
                }
                onChange={(value) =>
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
                onChange={(value) =>
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
            </div>

            <div
              style={{
                marginTop: 18,
                padding: 14,
                background:
                  "#f8fafc",
                borderRadius: 8,
                fontSize: 12,
                color:
                  "#475569",
              }}
            >
              {data.paymentMethod ===
              "Cash" ? (
                <>
                  <strong>
                    Cash payment
                  </strong>

                  <div
                    style={{
                      marginTop: 4,
                    }}
                  >
                    A deposit can be
                    taken, but no
                    finance term or
                    interest rate is
                    required.
                  </div>
                </>
              ) : (
                <>
                  <strong>
                    Finance
                  </strong>

                  <div
                    style={{
                      marginTop: 4,
                    }}
                  >
                    The deposit is
                    deducted from the
                    system cost and
                    the remaining
                    balance is financed
                    over the selected
                    term.
                  </div>
                </>
              )}
            </div>
          </Card>
        )}

        {/* ===================================================
            RESULTS
            =================================================== */}

        {step === 8 && (
          <>
            <Results
              results={results}
              data={data}
            />

            <AnnualBreakdown
              results={results}
            />

            <ThirtyYearBreakdown
              results={results}
              data={data}
              thirtyYearProjection={
                thirtyYearProjection
              }
            />
          </>
        )}

        {/* ===================================================
            FOOTER
            =================================================== */}

        <div style={styles.footer}>
          <button
            type="button"
            onClick={reset}
            style={styles.secondary}
          >
            <RotateCcw size={16} />
            Reset
          </button>

          <div
            style={{
              display: "flex",
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={back}
              disabled={step === 0}
              style={{
                ...styles.secondary,
                opacity:
                  step === 0
                    ? 0.5
                    : 1,
              }}
            >
              <ArrowLeft size={16} />
              Back
            </button>

            {step <
              steps.length - 1 && (
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
 * ===========================================================
 * CARD
 * ===========================================================
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
      <div className="card-head">
        <div>
          <h2>{title}</h2>

          <p>{subtitle}</p>
        </div>
      </div>

      {children}
    </div>
  )
}

/*
 * ===========================================================
 * RESULTS
 * ===========================================================
 */

function Results({
  results,
  data,
}) {
  const cards = [
    [
      "Number of arrays",
      results.numberOfArrays,
    ],

    [
      "System size",
      `${results.totalSystemSize.toFixed(
        2
      )} kWp`,
    ],

    [
      "Estimated generation",
      `${Math.round(
        results.totalGeneration
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
      data.paymentMethod ===
      "Finance"
        ? "Monthly finance"
        : "Payment method",

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
        ? `${results.simplePayback.toFixed(
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
      <div className="card-head">
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
          style={styles.badge}
        >
          Preliminary model
        </div>
      </div>

      {/* ARRAY SUMMARY */}

      {results.arrays &&
        results.arrays.length >
          0 && (
          <div
            style={{
              marginBottom: 14,
              padding: 14,
              background:
                "#f8fafc",
              borderRadius: 10,
              border:
                "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color:
                  "#475569",
                marginBottom: 10,
              }}
            >
              EPVS array
              generation
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(3, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              {results.arrays.map(
                (array) => (
                  <div
                    key={
                      array.array
                    }
                    style={{
                      background:
                        "#fff",
                      border:
                        "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color:
                          "#64748b",
                      }}
                    >
                      Array{" "}
                      {
                        array.array
                      }
                    </div>

                    <strong
                      style={{
                        display:
                          "block",
                        marginTop: 4,
                        fontSize: 14,
                        color:
                          "#26783a",
                      }}
                    >
                      {array.generation.toFixed(
                        2
                      )}{" "}
                      kWh
                    </strong>

                    <div
                      style={{
                        marginTop: 3,
                        fontSize: 10,
                        color:
                          "#64748b",
                      }}
                    >
                      {
                        array.systemSize.toFixed(
                          2
                        )
                      }{" "}
                      kWp
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}

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
 * ===========================================================
 * STYLES
 * ===========================================================
 */

const styles = {
  wrapper: {
    maxWidth: 1200,
    margin: "0 auto",
  },

  stepper: {
    display: "grid",
    gridTemplateColumns:
      "repeat(9, minmax(70px, 1fr))",
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
    alignItems: "center",
    gap: 7,
    color: "#334155",
    fontSize: 12,
    whiteSpace:
      "nowrap",
  },

  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: "50%",
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

  input: {
    width: "100%",
    height: 38,
    boxSizing:
      "border-box",
    border:
      "1px solid #cfd6df",
    borderRadius: 7,
    padding:
      "0 10px",
    fontFamily:
      "inherit",
    fontSize: 13,
    color: "#111827",
    background:
      "#fff",
  },

  calculatedField: {
    width: "100%",
    height: 38,
    boxSizing:
      "border-box",
    border:
      "1px solid #e5e7eb",
    borderRadius: 7,
    padding:
      "0 10px",
    display: "flex",
    alignItems:
      "center",
    fontFamily:
      "inherit",
    fontSize: 13,
    color: "#888",
    background:
      "#f7f7f7",
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
    background: "white",
    color: "#334155",
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
    color: "#9a3412",
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

  arrayCard: {
    border:
      "1px solid #dbe2ea",
    borderRadius: 12,
    padding: 20,
    background:
      "#fff",
  },

  arrayHeader: {
    display: "flex",
    alignItems:
      "center",
    justifyContent:
      "space-between",
    gap: 20,
    marginBottom: 18,
  },

  arrayBadge: {
    background:
      "#e8f5eb",
    color: "#26783a",
    borderRadius:
      999,
    padding:
      "7px 11px",
    fontSize: 12,
    fontWeight: 700,
    whiteSpace:
      "nowrap",
  },
}
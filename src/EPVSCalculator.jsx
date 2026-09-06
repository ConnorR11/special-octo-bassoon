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
  Plus,
  Trash2,
} from "lucide-react"

import AnnualBreakdown from "./components/EPVS/AnnualBreakdown"
import ThirtyYearBreakdown from "./components/EPVS/ThirtyYearBreakdown"

const money = (value) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

const wholeNumber = (value) =>
  Math.round(Number(value || 0)).toLocaleString("en-GB")

const decimalNumber = (value) =>
  Number(value || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const steps = [
  { title: "Customer", icon: Home },
  { title: "Property", icon: Home },
  { title: "Solar PV", icon: Zap },
  { title: "Battery", icon: Battery },
  { title: "Inverter", icon: Zap },
  { title: "Electricity", icon: Zap },
  { title: "Tariff", icon: PoundSterling },
  { title: "Payment", icon: PoundSterling },
  { title: "Results", icon: CheckCircle2 },
]

/*
 * ============================================================
 * DEFAULT ARRAY
 * ============================================================
 *
 * EPVS requires the following information for each roof/array:
 *
 * Number of modules
 * Module power
 * Total installed capacity
 * Orientation
 * Inclination
 * Irradiance / Kk
 * Shading factor
 *
 * We also capture number of strings because this is required
 * as part of the system design information.
 */

const createArray = (number) => ({
  id: number,
  name: `Array ${number}`,

  panelWattage: 415,
  panelCount: number === 1 ? 10 : 0,

  strings: number === 1 ? 1 : 0,

  orientation: 0,
  pitch: 35,

  kk: 0,
  shading: 1,
})

const initial = {
  customerName: "",
  address: "",
  postcode: "",

  annualConsumption: 4000,

  existingSolar: false,
  existingGeneration: 0,

  arrays: [
    createArray(1),
    createArray(2),
    createArray(3),
    createArray(4),
    createArray(5),
    createArray(6),
  ],

  batteryCapacity: 10,
  batteryEnabled: true,

  inverterCapacity: 5,

  importRate: 0.25,
  exportRate: 0.055,

  tariff: "Standard",

  systemCost: 12000,

  paymentMethod: "Cash",

  deposit: 0,

  financeTerm: 10,
  financeRate: 7.9,

  panelDegradation: 0.00925,
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
    <label
      style={{
        ...styles.field,
        opacity: disabled ? 0.55 : 1,
      }}
    >
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

  /*
   * ============================================================
   * APPOINTMENT CHANGES
   * ============================================================
   */

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

  /*
   * ============================================================
   * GENERAL UPDATE
   * ============================================================
   */

  const update = (key, value) => {
    setData((current) => ({
      ...current,
      [key]: value,
    }))
  }

  /*
   * ============================================================
   * ARRAY UPDATE
   * ============================================================
   */

  const updateArray = (
    arrayId,
    key,
    value
  ) => {
    setData((current) => ({
      ...current,

      arrays: current.arrays.map(
        (array) =>
          array.id === arrayId
            ? {
                ...array,
                [key]: value,
              }
            : array
      ),
    }))
  }

  /*
   * ============================================================
   * CALCULATIONS
   * ============================================================
   */

  const results = useMemo(() => {
    /*
     * ----------------------------------------------------------
     * ARRAY GENERATION
     * ----------------------------------------------------------
     *
     * EPVS formula:
     *
     * Annual AC output (kWh)
     * =
     * kWp × Kk × SF
     *
     * This is deliberately calculated separately for every
     * roof/array.
     */

    const calculatedArrays =
      data.arrays.map((array) => {
        const panelCount =
          Number(array.panelCount || 0)

        const panelWattage =
          Number(
            array.panelWattage || 0
          )

        const strings =
          Number(array.strings || 0)

        const kk =
          Number(array.kk || 0)

        const shading =
          Number(array.shading || 0)

        const systemSize =
          (panelCount *
            panelWattage) /
          1000

        const generation =
          systemSize *
          kk *
          shading

        return {
          ...array,

          panelCount,
          panelWattage,
          strings,
          kk,
          shading,

          systemSize,
          generation,
        }
      })

    /*
     * Only arrays with panels are active.
     */

    const activeArrays =
      calculatedArrays.filter(
        (array) =>
          array.panelCount > 0
      )

    /*
     * Total system size.
     */

    const systemSize =
      activeArrays.reduce(
        (total, array) =>
          total + array.systemSize,
        0
      )

    /*
     * Total generation.
     */

    const generation =
      activeArrays.reduce(
        (total, array) =>
          total + array.generation,
        0
      )

    const annualConsumption =
      Number(
        data.annualConsumption || 0
      )

    /*
     * ----------------------------------------------------------
     * EPVS SELF-CONSUMPTION CAP
     * ----------------------------------------------------------
     *
     * EPVS states:
     *
     * Solar only = max 75% of annual consumption
     *
     * Solar + battery = max 90% of annual consumption
     */

    const selfConsumptionCap =
      data.batteryEnabled
        ? annualConsumption * 0.9
        : annualConsumption * 0.75

    /*
     * ----------------------------------------------------------
     * DIRECT SOLAR SELF-CONSUMPTION
     * ----------------------------------------------------------
     *
     * This is a preliminary model.
     *
     * We estimate direct solar consumption at 37.5% of
     * annual consumption, but never above the available
     * generation or EPVS self-consumption cap.
     */

    const directSolarPotential =
      annualConsumption * 0.375

    const solarSelfConsumption =
      Math.min(
        generation,
        directSolarPotential,
        selfConsumptionCap
      )

    /*
     * Remaining generation after direct use.
     */

    const remainingGeneration =
      Math.max(
        0,
        generation -
          solarSelfConsumption
      )

    /*
     * ----------------------------------------------------------
     * BATTERY SELF-CONSUMPTION
     * ----------------------------------------------------------
     *
     * Battery contribution is limited by:
     *
     * 1. Remaining solar generation
     * 2. Remaining EPVS self-consumption capacity
     * 3. Annual battery throughput assumption
     *
     * The 180 figure represents an indicative number of
     * equivalent cycles per year.
     */

    const remainingSelfConsumptionCapacity =
      Math.max(
        0,
        selfConsumptionCap -
          solarSelfConsumption
      )

    const batteryAnnualThroughput =
      Number(
        data.batteryCapacity || 0
      ) * 180

    const batteryContribution =
      data.batteryEnabled
        ? Math.min(
            remainingGeneration,
            remainingSelfConsumptionCapacity,
            batteryAnnualThroughput
          )
        : 0

    /*
     * ----------------------------------------------------------
     * EXPORT
     * ----------------------------------------------------------
     */

    const exportKwh =
      Math.max(
        0,
        generation -
          solarSelfConsumption -
          batteryContribution
      )

    /*
     * Total grid reduction.
     */

    const gridReduction =
      solarSelfConsumption +
      batteryContribution

    /*
     * ----------------------------------------------------------
     * FINANCIAL BENEFIT
     * ----------------------------------------------------------
     */

    const importRate =
      Number(data.importRate || 0)

    const exportRate =
      Number(data.exportRate || 0)

    const solarBenefit =
      solarSelfConsumption *
      importRate

    const batterySelfConsumptionBenefit =
      batteryContribution *
      importRate

    /*
     * Overnight charging is kept as a separate figure so it
     * can be added later without changing the data structure.
     */

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
     * ----------------------------------------------------------
     * PAYMENT / FINANCE
     * ----------------------------------------------------------
     */

    const systemCost =
      Math.max(
        0,
        Number(data.systemCost || 0)
      )

    const deposit =
      Math.min(
        systemCost,
        Math.max(
          0,
          Number(data.deposit || 0)
        )
      )

    const paymentMethod =
      data.paymentMethod === "Finance"
        ? "Finance"
        : "Cash"

    const financeAmount =
      paymentMethod === "Finance"
        ? Math.max(
            0,
            systemCost - deposit
          )
        : 0

    const financeTerm =
      paymentMethod === "Finance"
        ? Math.max(
            0,
            Number(
              data.financeTerm || 0
            )
          )
        : 0

    const financeRate =
      paymentMethod === "Finance"
        ? Math.max(
            0,
            Number(
              data.financeRate || 0
            )
          )
        : 0

    const months =
      financeTerm * 12

    const monthlyRate =
      financeRate / 100 / 12

    let monthlyPayment = 0

    if (
      paymentMethod === "Finance" &&
      financeAmount > 0 &&
      months > 0
    ) {
      if (monthlyRate > 0) {
        monthlyPayment =
          financeAmount *
          (
            monthlyRate *
            Math.pow(
              1 + monthlyRate,
              months
            )
          ) /
          (
            Math.pow(
              1 + monthlyRate,
              months
            ) - 1
          )
      } else {
        monthlyPayment =
          financeAmount / months
      }
    }

    const totalFinanceRepayment =
      paymentMethod === "Finance"
        ? monthlyPayment * months
        : 0

    const totalCustomerPayment =
      deposit +
      totalFinanceRepayment

    /*
     * Cash customer:
     *
     * Total payment = system cost
     *
     * Finance customer:
     *
     * Total payment = deposit + all finance repayments
     */

    const cashPayment =
      paymentMethod === "Cash"
        ? systemCost
        : 0

    /*
     * ----------------------------------------------------------
     * SIMPLE PAYBACK
     * ----------------------------------------------------------
     */

    const simplePayback =
      annualSaving > 0
        ? systemCost /
          annualSaving
        : null

    /*
     * ----------------------------------------------------------
     * RETURN EVERYTHING
     * ----------------------------------------------------------
     */

    return {
      arrays: calculatedArrays,
      activeArrays,

      systemSize,
      generation,

      annualConsumption,

      selfConsumptionCap,

      solarSelfConsumption,
      batteryContribution,
      exportKwh,

      gridReduction,

      solarBenefit,
      batterySelfConsumptionBenefit,
      forceChargeBenefit,
      exportBenefit,

      annualSaving,

      systemCost,
      deposit,

      paymentMethod,

      financeAmount,
      financeTerm,
      financeRate,
      monthlyPayment,

      totalFinanceRepayment,
      totalCustomerPayment,

      cashPayment,

      simplePayback,
    }
  }, [data])

  /*
   * ============================================================
   * 30 YEAR PROJECTION
   * ============================================================
   *
   * This follows the EPVS guidance that multi-year projections
   * should take panel degradation into account.
   *
   * The guide also says that if inflation is used, the source
   * should be government-backed and multiple scenarios should
   * be shown. For now this application uses a single projection
   * using the configured rate.
   */

  const thirtyYearProjection =
    useMemo(() => {
      const rows = []

      let cumulativePosition = 0

      const systemCost =
        Number(data.systemCost || 0)

      const deposit =
        Math.min(
          systemCost,
          Math.max(
            0,
            Number(data.deposit || 0)
          )
        )

      const annualConsumption =
        Number(
          data.annualConsumption || 0
        )

      const importRate =
        Number(data.importRate || 0)

      const exportRate =
        Number(data.exportRate || 0)

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
       * EPVS calculator example uses 0.925% degradation.
       *
       * We make this editable rather than hard coding it into
       * every calculation.
       */

      const annualDegradation =
        Math.max(
          0,
          Number(
            data.panelDegradation || 0
          )
        )

      /*
       * Current electricity price escalation assumption.
       *
       * This is a projection assumption rather than an EPVS
       * SAP input. It should be presented as illustrative.
       */

      const annualRateIncrease =
        0.076

      for (
        let year = 1;
        year <= 30;
        year++
      ) {
        /*
         * ------------------------------------------------------
         * GENERATION DEGRADATION
         * ------------------------------------------------------
         */

        const generation =
          firstYearGeneration *
          Math.pow(
            1 - annualDegradation,
            year - 1
          )

        /*
         * Preserve the Year 1 proportions between:
         *
         * Solar self-consumption
         * Battery self-consumption
         */

        const solar =
          firstYearGeneration > 0
            ? generation *
              (
                firstYearSolar /
                firstYearGeneration
              )
            : 0

        const battery =
          firstYearGeneration > 0
            ? generation *
              (
                firstYearBattery /
                firstYearGeneration
              )
            : 0

        /*
         * Export is the remaining generation.
         */

        const exportKwh =
          Math.max(
            0,
            generation -
              solar -
              battery
          )

        /*
         * ------------------------------------------------------
         * ENERGY PRICES
         * ------------------------------------------------------
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
         * ------------------------------------------------------
         * ANNUAL BENEFIT
         * ------------------------------------------------------
         */

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
         * ------------------------------------------------------
         * CUSTOMER PAYMENT
         * ------------------------------------------------------
         *
         * CASH:
         *
         * Year 1:
         * system cost - deposit
         *
         * FINANCE:
         *
         * Every month during the finance term:
         * monthly payment
         *
         * We therefore use:
         *
         * monthly payment × 12
         *
         * for each finance year.
         */

        let yearlyPayment = 0

        if (
          data.paymentMethod ===
          "Finance"
        ) {
          const financeTerm =
            Number(
              data.financeTerm || 0
            )

          if (year <= financeTerm) {
            yearlyPayment =
              Number(
                results.monthlyPayment ||
                  0
              ) * 12
          }
        } else {
          if (year === 1) {
            yearlyPayment =
              Math.max(
                0,
                systemCost -
                  deposit
              )
          }
        }

        /*
         * ------------------------------------------------------
         * NET BENEFIT
         * ------------------------------------------------------
         */

        const netAnnualBenefit =
          annualBenefit -
          yearlyPayment

        cumulativePosition +=
          netAnnualBenefit

        /*
         * ------------------------------------------------------
         * ELECTRICITY BILL
         * ------------------------------------------------------
         */

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

      /*
       * --------------------------------------------------------
       * TOTALS
       * --------------------------------------------------------
       */

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

      /*
       * Payback is the first year in which the cumulative
       * position becomes positive.
       */

      const paybackRow =
        rows.find(
          (row) =>
            row.cumulativePosition >=
            0
        )

      /*
       * Total net savings represents the cumulative benefit
       * after customer payments.
       */

      const totalNetSavings =
        totals.netAnnualBenefit

      return {
        rows,

        totals,

        paybackPeriod:
          paybackRow?.year || null,

        totalNetSavings,

        /*
         * Keep this as the cumulative position after all
         * customer payments. Do not subtract systemCost again
         * because the cost has already been included in the
         * yearly payments.
         */

        totalNetReturn:
          totalNetSavings,
      }
    }, [data, results])

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

  /*
   * ============================================================
   * NAVIGATION
   * ============================================================
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
    setData(appointmentInitial)
    setStep(0)
  }

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <section>
      <div style={styles.wrapper}>

        {/* =====================================================
            STEPPER
            ===================================================== */}

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

        {/* =====================================================
            CUSTOMER
            ===================================================== */}

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
                value={data.postcode}
                onChange={(value) =>
                  update(
                    "postcode",
                    value
                  )
                }
              />

              <Input
                label="Address"
                value={data.address}
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

        {/* =====================================================
            PROPERTY
            ===================================================== */}

        {step === 1 && (
          <Card
            title="Property"
            subtitle="Property and existing system information."
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

        {/* =====================================================
            SOLAR PV / ARRAYS
            ===================================================== */}

        {step === 2 && (
          <Card
            title="Solar PV arrays"
            subtitle="Enter the EPVS information for each roof / array."
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              {data.arrays.map(
                (array) => {
                  const isActive =
                    Number(
                      array.panelCount ||
                        0
                    ) > 0

                  const calculatedSize =
                    (
                      Number(
                        array.panelWattage ||
                          0
                      ) *
                      Number(
                        array.panelCount ||
                          0
                      )
                    ) / 1000

                  const calculatedGeneration =
                    calculatedSize *
                    Number(
                      array.kk || 0
                    ) *
                    Number(
                      array.shading || 0
                    )

                  return (
                    <div
                      key={array.id}
                      style={{
                        border:
                          "1px solid #e1e5ea",
                        borderRadius: 10,
                        padding: 16,
                        background:
                          isActive
                            ? "#fff"
                            : "#fafafa",
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
                            14,
                        }}
                      >
                        <div>
                          <strong
                            style={{
                              fontSize: 14,
                            }}
                          >
                            {array.name}
                          </strong>

                          <div
                            style={{
                              fontSize: 11,
                              color:
                                "#64748b",
                              marginTop:
                                3,
                            }}
                          >
                            EPVS roof /
                            array
                          </div>
                        </div>

                        {isActive && (
                          <div
                            style={{
                              background:
                                "#e8f5eb",
                              color:
                                "#26783a",
                              borderRadius:
                                999,
                              padding:
                                "5px 9px",
                              fontSize:
                                11,
                              fontWeight:
                                700,
                            }}
                          >
                            {calculatedSize.toFixed(
                              2
                            )}{" "}
                            kWp ·{" "}
                            {Math.round(
                              calculatedGeneration
                            ).toLocaleString(
                              "en-GB"
                            )}{" "}
                            kWh
                          </div>
                        )}
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
                              array.id,
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
                              array.id,
                              "panelWattage",
                              value
                            )
                          }
                          min={1}
                        />

                        <Input
                          label="Number of strings"
                          type="number"
                          value={
                            array.strings
                          }
                          onChange={(
                            value
                          ) =>
                            updateArray(
                              array.id,
                              "strings",
                              value
                            )
                          }
                          min={
                            isActive
                              ? 1
                              : 0
                          }
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
                              array.id,
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
                              array.id,
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
                            array.kk
                          }
                          onChange={(
                            value
                          ) =>
                            updateArray(
                              array.id,
                              "kk",
                              value
                            )
                          }
                          min={0}
                          step={1}
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
                              array.id,
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
                          value={calculatedSize.toFixed(
                            2
                          )}
                          disabled
                          onChange={() => {}}
                        />

                        <Input
                          label="Calculated generation (kWh)"
                          type="number"
                          value={calculatedGeneration.toFixed(
                            2
                          )}
                          disabled
                          onChange={() => {}}
                        />
                      </div>
                    </div>
                  )
                }
              )}

              {/* =================================================
                  TOTAL ARRAY SUMMARY
                  ================================================= */}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(3, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                <SummaryMetric
                  label="Active arrays"
                  value={
                    results.activeArrays
                      .length
                  }
                />

                <SummaryMetric
                  label="Total system size"
                  value={`${results.systemSize.toFixed(
                    2
                  )} kWp`}
                />

                <SummaryMetric
                  label="Total annual generation"
                  value={`${wholeNumber(
                    results.generation
                  )} kWh`}
                />
              </div>
            </div>
          </Card>
        )}

        {/* =====================================================
            BATTERY
            ===================================================== */}

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

        {/* =====================================================
            INVERTER
            ===================================================== */}

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

        {/* =====================================================
            ELECTRICITY
            ===================================================== */}

        {step === 5 && (
          <Card
            title="Electricity"
            subtitle="Use the customer's current electricity consumption and unit rates."
          >
            <div style={styles.grid}>
              <Input
                label="Annual consumption from bill (kWh)"
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
                label="Electricity unit rate (£/kWh)"
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
                label="Export tariff rate (£/kWh)"
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

              <Input
                label="Panel degradation (% per year)"
                type="number"
                value={
                  Number(
                    data.panelDegradation ||
                      0
                  ) * 100
                }
                onChange={(value) =>
                  update(
                    "panelDegradation",
                    Number(value || 0) /
                      100
                  )
                }
                min={0}
                step={0.001}
              />
            </div>

            <div
              style={{
                marginTop: 18,
                padding: 14,
                background: "#f8fafc",
                border:
                  "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 11,
                color: "#475569",
                lineHeight: 1.6,
              }}
            >
              <strong>
                EPVS self-consumption cap:
              </strong>{" "}
              {wholeNumber(
                results.selfConsumptionCap
              )}{" "}
              kWh/year (
              {data.batteryEnabled
                ? "90%"
                : "75%"}{" "}
              of current annual consumption).
            </div>
          </Card>
        )}

        {/* =====================================================
            TARIFF
            ===================================================== */}

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

        {/* =====================================================
            PAYMENT
            ===================================================== */}

        {step === 7 && (
          <Card
            title="Payment"
            subtitle="Choose whether the customer is paying cash or using consumer finance."
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
                value={data.deposit}
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
                    label="Annual interest rate (%)"
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

            {/* =================================================
                PAYMENT SUMMARY
                ================================================= */}

            <div
              style={{
                marginTop: 20,
                display: "grid",
                gridTemplateColumns:
                  "repeat(3, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              <SummaryMetric
                label="System cost"
                value={money(
                  results.systemCost
                )}
              />

              <SummaryMetric
                label="Deposit"
                value={money(
                  results.deposit
                )}
              />

              {data.paymentMethod ===
              "Finance" ? (
                <SummaryMetric
                  label="Finance amount"
                  value={money(
                    results.financeAmount
                  )}
                />
              ) : (
                <SummaryMetric
                  label="Balance"
                  value={money(
                    Math.max(
                      0,
                      results.systemCost -
                        results.deposit
                    )
                  )}
                />
              )}

              {data.paymentMethod ===
                "Finance" && (
                <>
                  <SummaryMetric
                    label="Monthly repayment"
                    value={money(
                      results.monthlyPayment
                    )}
                  />

                  <SummaryMetric
                    label="Total finance repayment"
                    value={money(
                      results.totalFinanceRepayment
                    )}
                  />

                  <SummaryMetric
                    label="Total customer payment"
                    value={money(
                      results.totalCustomerPayment
                    )}
                  />
                </>
              )}

              {data.paymentMethod ===
                "Cash" && (
                <SummaryMetric
                  label="Total customer payment"
                  value={money(
                    results.cashPayment
                  )}
                />
              )}
            </div>
          </Card>
        )}

        {/* =====================================================
            RESULTS
            ===================================================== */}

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

        {/* =====================================================
            FOOTER
            ===================================================== */}

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
                  step === 0 ? 0.5 : 1,
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
                style={styles.primary}
              >
                Next
                <ArrowRight size={16} />
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
 * ============================================================
 * SUMMARY METRIC
 * ============================================================
 */

function SummaryMetric({
  label,
  value,
}) {
  return (
    <div
      style={{
        border:
          "1px solid #e2e8f0",
        borderRadius: 8,
        padding: 14,
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#64748b",
          marginBottom: 5,
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
      `${results.systemSize.toFixed(
        2
      )} kWp`,
    ],

    [
      "Estimated generation",
      `${wholeNumber(
        results.generation
      )} kWh`,
    ],

    [
      "Solar self-consumption",
      `${wholeNumber(
        results.solarSelfConsumption
      )} kWh`,
    ],

    [
      "Battery contribution",
      `${wholeNumber(
        results.batteryContribution
      )} kWh`,
    ],

    [
      "Estimated export",
      `${wholeNumber(
        results.exportKwh
      )} kWh`,
    ],

    [
      "Annual saving",
      money(
        results.annualSaving
      ),
    ],

    [
      "Payment method",
      data.paymentMethod,
    ],

    [
      "Monthly finance",
      data.paymentMethod ===
      "Finance"
        ? money(
            results.monthlyPayment
          )
        : "N/A",
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

        <div style={styles.badge}>
          EPVS model
        </div>
      </div>

      <div style={styles.resultGrid}>
        {cards.map(
          ([label, value]) => (
            <div
              key={label}
              style={
                styles.resultCard
              }
            >
              <span>{label}</span>

              <strong>
                {value}
              </strong>
            </div>
          )
        )}
      </div>

      <div
        style={{
          marginTop: 18,
          padding: 12,
          background: "#f8fafc",
          border:
            "1px solid #e2e8f0",
          borderRadius: 8,
          fontSize: 10,
          lineHeight: 1.6,
          color: "#475569",
        }}
      >
        Generation is calculated per roof /
        array using the EPVS formula of kWp ×
        Kk × shade factor. Self-consumption is
        capped according to the EPVS methodology.
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
      "repeat(9, minmax(70px, 1fr))",
    gap: 8,
    marginBottom: 20,
    overflowX: "auto",
    paddingBottom: 5,
  },

  step: {
    border: 0,
    background: "transparent",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 7,
    color: "#334155",
    fontSize: 12,
    whiteSpace: "nowrap",
  },

  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: 18,
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },

  toggleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
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
    background: "white",
    borderRadius: "50%",
    transition:
      "transform .15s",
  },

  footer: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    marginTop: 10,
  },

  primary: {
    border: 0,
    background: "#172554",
    color: "white",
    borderRadius: 8,
    padding: "11px 16px",
    display: "inline-flex",
    alignItems: "center",
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
    padding: "10px 14px",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
  },

  badge: {
    background: "#e8f5eb",
    color: "#26783a",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 600,
  },

  resultGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, minmax(0, 1fr))",
    gap: 12,
  },

  resultCard: {
    border:
      "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
}
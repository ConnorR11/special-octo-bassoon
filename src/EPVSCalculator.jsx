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
  { title: "Property", icon: Home },
  { title: "Solar PV", icon: Zap },
  { title: "Battery", icon: Battery },
  { title: "Inverter", icon: Zap },
  { title: "Electricity", icon: Zap },
  { title: "Tariff", icon: PoundSterling },
  { title: "Finance", icon: PoundSterling },
  { title: "Results", icon: CheckCircle2 },
]

const initial = {
  customerName: "",
  address: "",
  postcode: "",

  annualConsumption: 4000,

  existingSolar: false,
  existingGeneration: 0,

  panelWattage: 415,
  panelCount: 10,
  orientation: 0,
  pitch: 30,
  shading: 1,

  batteryCapacity: 10,
  batteryEnabled: true,

  inverterCapacity: 5,

  importRate: 0.28,
  exportRate: 0.15,

  tariff: "Standard",

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

  /*
   * =========================================================
   * CALCULATIONS
   * =========================================================
   */

  const results = useMemo(() => {
    const systemSize =
      (Number(data.panelWattage || 0) *
        Number(data.panelCount || 0)) /
      1000

    const baseYield = 950

    const orientationFactor = Math.max(
      0.65,
      1 -
        (Math.abs(
          Number(data.orientation || 0)
        ) /
          180) *
          0.18
    )

    const pitchFactor = Math.max(
      0.88,
      1 -
        Math.abs(
          Number(data.pitch || 30) - 35
        ) *
          0.004
    )

    const generation =
      systemSize *
      baseYield *
      orientationFactor *
      pitchFactor *
      Number(data.shading || 1)

    const solarSelfConsumption =
      Math.min(
        generation,
        Number(
          data.annualConsumption || 0
        ) * 0.375
      )

    const remainingGeneration =
      Math.max(
        0,
        generation -
          solarSelfConsumption
      )

    const batteryContribution =
      data.batteryEnabled
        ? Math.min(
            remainingGeneration,
            Number(
              data.annualConsumption || 0
            ) * 0.25,
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

    const solarBenefit =
      solarSelfConsumption *
      Number(data.importRate || 0)

    const batterySelfConsumptionBenefit =
      batteryContribution *
      Number(data.importRate || 0)

    const forceChargeBenefit = 0

    const exportBenefit =
      exportKwh *
      Number(data.exportRate || 0)

    const annualSaving =
      solarBenefit +
      batterySelfConsumptionBenefit +
      forceChargeBenefit +
      exportBenefit

    const financeAmount =
      Math.max(
        0,
        Number(data.systemCost || 0) -
          Number(data.deposit || 0)
      )

    const monthlyRate =
      Number(data.financeRate || 0) /
      100 /
      12

    const months =
      Number(data.financeTerm || 0) *
      12

    const monthlyPayment =
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
        : months > 0
        ? financeAmount / months
        : 0

    const simplePayback =
      annualSaving > 0
        ? Number(
            data.systemCost || 0
          ) / annualSaving
        : null

    return {
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
   * This is calculated here as actual data rather than relying
   * on the ThirtyYearBreakdown component to calculate it.
   *
   * This means AppointmentDetail and the PDF can both use it.
   */

  const thirtyYearProjection = useMemo(() => {
    const rows = []

    let cumulativePosition = 0

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

    const annualRateIncrease = 0.03

    const annualDegradation = 0.004

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
          1 + annualRateIncrease,
          year - 1
        )

      const exportRateYear =
        exportRate *
        Math.pow(
          1 + annualRateIncrease,
          year - 1
        )

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

      const yearlyPayment =
        year === 1
          ? systemCost - deposit
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

    const totals = rows.reduce(
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

    const paybackRow =
      rows.find(
        (row) =>
          row.cumulativePosition >= 0
      )

    return {
      rows,
      totals,
      paybackPeriod:
        paybackRow?.year || null,
      totalNetSavings:
        totals.netAnnualBenefit,
      totalNetReturn:
        totals.netAnnualBenefit -
        systemCost,
    }
  }, [data, results])

  /*
   * =========================================================
   * SEND EVERYTHING TO APPOINTMENT DETAIL
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
      Math.max(0, current - 1)
    )
  }

  const reset = () => {
    setData(appointmentInitial)
    setStep(0)
  }

  return (
    <section>
      <div style={styles.wrapper}>

        <div style={styles.stepper}>
          {steps.map((item, index) => {
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
                  if (index <= step) {
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
                      active || complete
                        ? "#172554"
                        : "#eef2f7",
                    color:
                      active || complete
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
          })}
        </div>

        {step === 0 && (
          <Card
            title="Customer details"
            subtitle="Start the EPVS calculation with the customer and property information."
          >
            <div style={styles.grid}>
              <Input
                label="Customer name"
                value={data.customerName}
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

        {step === 2 && (
          <Card
            title="Solar PV"
            subtitle="Configure the proposed PV array."
          >
            <div style={styles.grid}>
              <Input
                label="Panel wattage (W)"
                type="number"
                value={
                  data.panelWattage
                }
                onChange={(value) =>
                  update(
                    "panelWattage",
                    value
                  )
                }
                min={1}
              />

              <Input
                label="Number of panels"
                type="number"
                value={
                  data.panelCount
                }
                onChange={(value) =>
                  update(
                    "panelCount",
                    value
                  )
                }
                min={1}
              />

              <Input
                label="Orientation from south (°)"
                type="number"
                value={
                  data.orientation
                }
                onChange={(value) =>
                  update(
                    "orientation",
                    value
                  )
                }
                min={-180}
                max={180}
              />

              <Input
                label="Pitch (°)"
                type="number"
                value={data.pitch}
                onChange={(value) =>
                  update(
                    "pitch",
                    value
                  )
                }
                min={0}
                max={90}
              />

              <Input
                label="Shading factor"
                type="number"
                value={data.shading}
                onChange={(value) =>
                  update(
                    "shading",
                    value
                  )
                }
                step={0.01}
                min={0}
                max={1}
              />
            </div>
          </Card>
        )}

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
                value={data.importRate}
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
                value={data.exportRate}
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

        {step === 6 && (
          <Card
            title="Tariff"
            subtitle="Select the tariff model."
          >
            <div style={styles.grid}>
              <label style={styles.field}>
                <span>Tariff</span>

                <select
                  value={data.tariff}
                  onChange={(event) =>
                    update(
                      "tariff",
                      event.target.value
                    )
                  }
                >
                  <option>Standard</option>
                  <option>Overnight Charging</option>
                  <option>Standard Flux</option>
                  <option>Intelligent Flux</option>
                  <option>Octopus Cosy</option>
                </select>
              </label>
            </div>
          </Card>
        )}

        {step === 7 && (
          <Card
            title="Finance"
            subtitle="System cost and finance assumptions."
          >
            <div style={styles.grid}>
              <Input
                label="System cost (£)"
                type="number"
                value={data.systemCost}
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

              <Input
                label="Finance term (years)"
                type="number"
                value={data.financeTerm}
                onChange={(value) =>
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
                value={data.financeRate}
                onChange={(value) =>
                  update(
                    "financeRate",
                    value
                  )
                }
                min={0}
                step={0.1}
              />
            </div>
          </Card>
        )}

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
              thirtyYearProjection={thirtyYearProjection}
            />
          </>
        )}

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

function Results({ results, data }) {
  const cards = [
    [
      "System size",
      `${results.systemSize.toFixed(2)} kWp`,
    ],
    [
      "Estimated generation",
      `${Math.round(
        results.generation
      ).toLocaleString("en-GB")} kWh`,
    ],
    [
      "Solar self-consumption",
      `${Math.round(
        results.solarSelfConsumption
      ).toLocaleString("en-GB")} kWh`,
    ],
    [
      "Battery contribution",
      `${Math.round(
        results.batteryContribution
      ).toLocaleString("en-GB")} kWh`,
    ],
    [
      "Estimated export",
      `${Math.round(
        results.exportKwh
      ).toLocaleString("en-GB")} kWh`,
    ],
    [
      "Annual saving",
      money(results.annualSaving),
    ],
    [
      "Monthly finance",
      money(results.monthlyPayment),
    ],
    [
      "Simple payback",
      results.simplePayback
        ? `${results.simplePayback.toFixed(1)} years`
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
          <h2>EPVS calculation results</h2>

          <p>
            {data.customerName ||
              "New calculation"}{" "}
            ·{" "}
            {data.postcode ||
              "No postcode entered"}
          </p>
        </div>

        <div style={styles.badge}>
          Preliminary model
        </div>
      </div>

      <div style={styles.resultGrid}>
        {cards.map(([label, value]) => (
          <div
            key={label}
            style={styles.resultCard}
          >
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

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
    transition: "transform .15s",
  },

  footer: {
    display: "flex",
    justifyContent: "space-between",
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
    border: "1px solid #d7dee8",
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
    background: "#fff7ed",
    color: "#9a3412",
    borderRadius: 999,
    padding: "6px 10px",
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
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
}
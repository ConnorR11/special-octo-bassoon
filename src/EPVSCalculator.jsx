import React, { useMemo, useState } from "react"

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


/* =========================================================
   FORMATTERS
   ========================================================= */

const money = (value) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))


const moneyExact = (value) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))


const number = (value) =>
  Math.round(Number(value || 0)).toLocaleString(
    "en-GB"
  )


/* =========================================================
   STEPS
   ========================================================= */

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


/* =========================================================
   INITIAL DATA
   ========================================================= */

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

  /*
   * These assumptions drive the 30-year projection.
   */
  energyPriceInflation: 7,
  generationDegradation: 0.5,

  tariff: "Standard",

  systemCost: 12000,
  deposit: 0,
  financeTerm: 10,
  financeRate: 7.9,
}


/* =========================================================
   INPUT
   ========================================================= */

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


/* =========================================================
   TOGGLE
   ========================================================= */

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
        onClick={() =>
          onChange(!value)
        }
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


/* =========================================================
   MAIN CALCULATOR
   ========================================================= */

export default function EPVSCalculator() {

  const [step, setStep] =
    useState(0)

  const [data, setData] =
    useState(initial)


  const update = (
    key,
    value
  ) => {
    setData((current) => ({
      ...current,
      [key]: value,
    }))
  }


  /* =======================================================
     BASE CALCULATION
     ======================================================= */

  const results = useMemo(() => {

    const systemSize =
      (Number(
        data.panelWattage || 0
      ) *
        Number(
          data.panelCount || 0
        )) /
      1000


    const baseYield = 950


    const orientationFactor =
      Math.max(
        0.65,
        1 -
          (
            Math.abs(
              Number(
                data.orientation || 0
              )
            ) /
            180
          ) *
            0.18
      )


    const pitchFactor =
      Math.max(
        0.88,
        1 -
          Math.abs(
            Number(
              data.pitch || 30
            ) - 35
          ) *
            0.004
      )


    const generation =
      systemSize *
      baseYield *
      orientationFactor *
      pitchFactor *
      Number(
        data.shading || 1
      )


    /*
     * Solar electricity used directly.
     */

    const solarSelfConsumption =
      Math.min(
        generation,
        Number(
          data.annualConsumption || 0
        ) * 0.375
      )


    /*
     * Generation remaining after direct solar.
     */

    const remainingGeneration =
      Math.max(
        0,
        generation -
          solarSelfConsumption
      )


    /*
     * Battery.
     */

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


    /*
     * Export.
     */

    const exportKwh =
      Math.max(
        0,
        generation -
          solarSelfConsumption -
          batteryContribution
      )


    /*
     * Grid reduction.
     */

    const gridReduction =
      solarSelfConsumption +
      batteryContribution


    /*
     * Financial benefit.
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


    /* =====================================================
       FINANCE
       ===================================================== */

    const financeAmount =
      Math.max(
        0,
        Number(
          data.systemCost || 0
        ) -
          Number(
            data.deposit || 0
          )
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


    const monthlyPayment =
      financeAmount > 0 &&
      monthlyRate > 0 &&
      months > 0
        ? financeAmount *
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
        : months > 0
        ? financeAmount /
          months
        : 0


    const yearlyPayment =
      monthlyPayment * 12


    const simplePayback =
      annualSaving > 0
        ? Number(
            data.systemCost || 0
          ) /
          annualSaving
        : null


    /* =====================================================
       30 YEAR PROJECTION
       ===================================================== */

    const years = []


    let cumulativePosition =
      -financeAmount


    for (
      let year = 1;
      year <= 30;
      year++
    ) {

      /*
       * Solar generation degrades every year.
       */

      const degradation =
        Math.pow(
          1 -
            Number(
              data.generationDegradation || 0
            ) /
              100,
          year - 1
        )


      const yearGeneration =
        generation *
        degradation


      /*
       * Electricity prices increase over time.
       */

      const priceInflation =
        Math.pow(
          1 +
            Number(
              data.energyPriceInflation || 0
            ) /
              100,
          year - 1
        )


      const yearImportRate =
        Number(
          data.importRate || 0
        ) *
        priceInflation


      const yearExportRate =
        Number(
          data.exportRate || 0
        ) *
        priceInflation


      /*
       * Direct solar.
       */

      const yearSolarSelfConsumption =
        Math.min(
          yearGeneration,
          Number(
            data.annualConsumption || 0
          ) * 0.375
        )


      /*
       * Battery.
       */

      const yearRemainingGeneration =
        Math.max(
          0,
          yearGeneration -
            yearSolarSelfConsumption
        )


      const yearBatteryContribution =
        data.batteryEnabled
          ? Math.min(
              yearRemainingGeneration,
              Number(
                data.annualConsumption || 0
              ) * 0.25,
              Number(
                data.batteryCapacity || 0
              ) * 180
            )
          : 0


      /*
       * Export.
       */

      const yearExportKwh =
        Math.max(
          0,
          yearGeneration -
            yearSolarSelfConsumption -
            yearBatteryContribution
        )


      /*
       * Financial benefits.
       */

      const yearSolarBenefit =
        yearSolarSelfConsumption *
        yearImportRate


      const yearBatteryBenefit =
        yearBatteryContribution *
        yearImportRate


      const yearForceChargeBenefit =
        0


      const yearExportBenefit =
        yearExportKwh *
        yearExportRate


      const yearAnnualBenefit =
        yearSolarBenefit +
        yearBatteryBenefit +
        yearForceChargeBenefit +
        yearExportBenefit


      /*
       * Finance payment.
       *
       * Payments only continue during the finance term.
       */

      const yearPayment =
        year <=
        Number(
          data.financeTerm || 0
        )
          ? yearlyPayment
          : 0


      /*
       * Net annual benefit.
       */

      const netAnnualBenefit =
        yearAnnualBenefit -
        yearPayment


      /*
       * Cumulative position.
       */

      cumulativePosition +=
        netAnnualBenefit


      /*
       * Pre-install bill.
       *
       * This represents the customer's estimated
       * electricity bill without the proposed system.
       */

      const billPreInstall =
        Number(
          data.annualConsumption || 0
        ) *
        yearImportRate


      /*
       * Post-install bill.
       */

      const billPostInstall =
        Math.max(
          0,
          billPreInstall -
            yearAnnualBenefit
        )


      years.push({
        year,

        generation:
          yearGeneration,

        solar:
          yearSolarBenefit,

        battery:
          yearBatteryBenefit,

        export:
          yearExportBenefit,

        annualBenefit:
          yearAnnualBenefit,

        yearlyPayment:
          yearPayment,

        netAnnualBenefit,

        netPosition:
          cumulativePosition,

        billPreInstall,

        billPostInstall,
      })
    }


    /*
     * Total values.
     */

    const totalAnnualBenefit =
      years.reduce(
        (total, row) =>
          total +
          row.annualBenefit,
        0
      )


    const totalPayments =
      years.reduce(
        (total, row) =>
          total +
          row.yearlyPayment,
        0
      )


    const totalNetSavings =
      years.reduce(
        (total, row) =>
          total +
          row.netAnnualBenefit,
        0
      )


    const totalSolar =
      years.reduce(
        (total, row) =>
          total +
          row.solar,
        0
      )


    const totalBattery =
      years.reduce(
        (total, row) =>
          total +
          row.battery,
        0
      )


    const totalExport =
      years.reduce(
        (total, row) =>
          total +
          row.export,
        0
      )


    const totalGeneration =
      years.reduce(
        (total, row) =>
          total +
          row.generation,
        0
      )


    /*
     * Payback year.
     */

    const paybackRow =
      years.find(
        (row) =>
          row.netPosition >= 0
      )


    const paybackPeriod =
      paybackRow
        ? paybackRow.year
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

      yearlyPayment,

      financeAmount,

      simplePayback,

      years,

      totalAnnualBenefit,

      totalPayments,

      totalNetSavings,

      totalSolar,

      totalBattery,

      totalExport,

      totalGeneration,

      paybackPeriod,
    }

  }, [data])


  /* =======================================================
     NAVIGATION
     ======================================================= */

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
    setData(initial)
    setStep(0)
  }


  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <section>

      <div style={styles.wrapper}>

        {/* =================================================
            STEP NAVIGATION
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
                      index <= step
                    ) {
                      setStep(
                        index
                      )
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
            CUSTOMER
            ================================================= */}

        {step === 0 && (

          <Card
            title="Customer details"
            subtitle="Start the EPVS calculation with the customer and property information."
          >

            <div
              style={styles.grid}
            >

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


        {/* =================================================
            PROPERTY
            ================================================= */}

        {step === 1 && (

          <Card
            title="Property"
            subtitle="Property and existing-system assumptions."
          >

            <div
              style={styles.grid}
            >

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


        {/* =================================================
            SOLAR PV
            ================================================= */}

        {step === 2 && (

          <Card
            title="Solar PV"
            subtitle="Configure the proposed PV array."
          >

            <div
              style={styles.grid}
            >

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
                value={
                  data.pitch
                }
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
                value={
                  data.shading
                }
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


        {/* =================================================
            BATTERY
            ================================================= */}

        {step === 3 && (

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


        {/* =================================================
            INVERTER
            ================================================= */}

        {step === 4 && (

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


        {/* =================================================
            ELECTRICITY
            ================================================= */}

        {step === 5 && (

          <Card
            title="Electricity"
            subtitle="Current electricity assumptions and long-term projection assumptions."
          >

            <div
              style={styles.grid}
            >

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

              <Input
                label="Energy price inflation (% per year)"
                type="number"
                value={
                  data.energyPriceInflation
                }
                onChange={(value) =>
                  update(
                    "energyPriceInflation",
                    value
                  )
                }
                min={0}
                step={0.1}
              />

              <Input
                label="Solar generation degradation (% per year)"
                type="number"
                value={
                  data.generationDegradation
                }
                onChange={(value) =>
                  update(
                    "generationDegradation",
                    value
                  )
                }
                min={0}
                max={10}
                step={0.1}
              />

            </div>

          </Card>

        )}


        {/* =================================================
            TARIFF
            ================================================= */}

        {step === 6 && (

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
                  onChange={(event) =>
                    update(
                      "tariff",
                      event.target.value
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

        {step === 7 && (

          <Card
            title="Finance"
            subtitle="System cost and finance assumptions."
          >

            <div
              style={styles.grid}
            >

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

              <Input
                label="Finance term (years)"
                type="number"
                value={
                  data.financeTerm
                }
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
                value={
                  data.financeRate
                }
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


        {/* =================================================
            RESULTS
            ================================================= */}

        {step === 8 && (

          <>

            <Results
              results={results}
              data={data}
            />

            <ThirtyYearBreakdown
              results={results}
            />

            <AnnualBreakdown
              results={results}
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
              display: "flex",
              gap: 10,
            }}
          >

            <button
              type="button"
              onClick={back}
              disabled={
                step === 0
              }
              style={
                styles.secondary
              }
            >
              <ArrowLeft
                size={16}
              />

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


/* =========================================================
   CARD
   ========================================================= */

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


/* =========================================================
   RESULTS
   ========================================================= */

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
      `${number(
        results.generation
      )} kWh`,
    ],

    [
      "Solar self-consumption",
      `${number(
        results.solarSelfConsumption
      )} kWh`,
    ],

    [
      "Battery contribution",
      `${number(
        results.batteryContribution
      )} kWh`,
    ],

    [
      "Estimated export",
      `${number(
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
      "Monthly finance",
      money(
        results.monthlyPayment
      ),
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

      <div
        className="card-head"
      >

        <div>

          <h2>
            EPVS calculation results
          </h2>

          <p>

            {data.customerName ||
              "New calculation"}

            {" · "}

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


/* =========================================================
   30 YEAR BREAKDOWN
   ========================================================= */

function ThirtyYearBreakdown({
  results,
}) {

  const years =
    results?.years || []


  return (

    <div
      className="card"
      style={{
        marginBottom: 20,
        padding: 0,
        overflow: "hidden",
      }}
    >

      {/* ===================================================
          HEADER
          =================================================== */}

      <div
        style={{
          padding:
            "22px 20px 16px",
        }}
      >

        <h2
          style={{
            margin: 0,
            fontSize: 21,
            color: "#475569",
          }}
        >
          30 Year Benefit Breakdown Based on Consumption
        </h2>

        <p
          style={{
            margin:
              "12px 0 0",
            fontSize: 13,
            lineHeight: 1.6,
            color: "#475569",
          }}
        >
          The estimated savings shown below are based on
          the current electricity consumption and the
          assumptions entered into the calculator. The
          projection includes generation degradation,
          electricity price inflation and finance payments.
          These figures are illustrative and should not be
          treated as a guarantee of performance.
        </p>

      </div>


      {/* ===================================================
          SUMMARY BOXES
          =================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(4, minmax(0, 1fr))",
          gap: 16,
          padding:
            "4px 28px 20px",
        }}
      >

        <SummaryBox
          label="First year total benefit"
          value={
            moneyExact(
              years[0]?.annualBenefit || 0
            )
          }
        />

        <SummaryBox
          label="Payback period"
          value={
            results.paybackPeriod
              ? `${results.paybackPeriod} years`
              : "Not reached"
          }
        />

        <SummaryBox
          label="Total net savings"
          value={
            moneyExact(
              results.totalNetSavings
            )
          }
        />

        <SummaryBox
          label="Total net return"
          value={
            moneyExact(
              results.years?.[29]
                ?.netPosition || 0
            )
          }
        />

      </div>


      {/* ===================================================
          TABLE
          =================================================== */}

      <div
        style={{
          width: "100%",
          overflowX: "auto",
        }}
      >

        <table
          style={{
            width: "100%",
            minWidth: 1100,
            borderCollapse:
              "collapse",
            fontSize: 11,
          }}
        >

          <thead>

            <tr>

              <TableHeader>
                YR
              </TableHeader>

              <TableHeader>
                GENERATION
              </TableHeader>

              <TableHeader>
                SOLAR
              </TableHeader>

              <TableHeader>
                BATTERY
              </TableHeader>

              <TableHeader>
                EXPORT
              </TableHeader>

              <TableHeader
                green
              >
                ANNUAL
                <br />
                BENEFIT
              </TableHeader>

              <TableHeader>
                YEARLY
                <br />
                PAYMENTS
              </TableHeader>

              <TableHeader>
                NET ANNUAL
                <br />
                BENEFIT
              </TableHeader>

              <TableHeader
                green
              >
                NET
                <br />
                POSITION
              </TableHeader>

              <TableHeader>
                BILL PRE
                <br />
                INSTALL
              </TableHeader>

              <TableHeader>
                BILL POST
                <br />
                INSTALL
              </TableHeader>

            </tr>

          </thead>


          <tbody>

            {years.map(
              (row) => (

                <tr
                  key={
                    row.year
                  }
                >

                  <TableCell
                    align="center"
                  >
                    {row.year}
                  </TableCell>

                  <TableCell>
                    {number(
                      row.generation
                    )}
                  </TableCell>

                  <TableCell>
                    {moneyExact(
                      row.solar
                    )}
                  </TableCell>

                  <TableCell>
                    {moneyExact(
                      row.battery
                    )}
                  </TableCell>

                  <TableCell>
                    {moneyExact(
                      row.export
                    )}
                  </TableCell>

                  <TableCell
                    bold
                  >
                    {moneyExact(
                      row.annualBenefit
                    )}
                  </TableCell>

                  <TableCell
                    negative={
                      row.yearlyPayment >
                      0
                    }
                  >
                    {row.yearlyPayment >
                    0
                      ? `-${moneyExact(
                          row.yearlyPayment
                        )}`
                      : moneyExact(
                          0
                        )}
                  </TableCell>

                  <TableCell
                    negative={
                      row.netAnnualBenefit <
                      0
                    }
                  >
                    {moneyExact(
                      row.netAnnualBenefit
                    )}
                  </TableCell>

                  <TableCell
                    bold
                    negative={
                      row.netPosition <
                      0
                    }
                  >
                    {moneyExact(
                      row.netPosition
                    )}
                  </TableCell>

                  <TableCell>
                    {moneyExact(
                      row.billPreInstall
                    )}
                  </TableCell>

                  <TableCell>
                    {moneyExact(
                      row.billPostInstall
                    )}
                  </TableCell>

                </tr>

              )
            )}


            {/* =============================================
                TOTALS
                ============================================= */}

            <tr>

              <td
                colSpan={1}
                style={
                  styles.totalCell
                }
              >
                TOTALS
              </td>

              <td
                style={
                  styles.totalCell
                }
              >
                {number(
                  results.totalGeneration
                )}
              </td>

              <td
                style={
                  styles.totalCell
                }
              >
                {moneyExact(
                  results.totalSolar
                )}
              </td>

              <td
                style={
                  styles.totalCell
                }
              >
                {moneyExact(
                  results.totalBattery
                )}
              </td>

              <td
                style={
                  styles.totalCell
                }
              >
                {moneyExact(
                  results.totalExport
                )}
              </td>

              <td
                style={
                  styles.totalCellGreen
                }
              >
                {moneyExact(
                  results.totalAnnualBenefit
                )}
              </td>

              <td
                style={
                  styles.totalCell
                }
              >
                {results.totalPayments >
                0
                  ? `-${moneyExact(
                      results.totalPayments
                    )}`
                  : moneyExact(
                      0
                    )}
              </td>

              <td
                style={
                  styles.totalCell
                }
              >
                {moneyExact(
                  results.totalNetSavings
                )}
              </td>

              <td
                style={
                  styles.totalCellGreen
                }
              >
                {moneyExact(
                  results.years?.[29]
                    ?.netPosition || 0
                )}
              </td>

              <td
                style={
                  styles.totalCell
                }
              >
                {moneyExact(
                  results.years.reduce(
                    (
                      total,
                      row
                    ) =>
                      total +
                      row.billPreInstall,
                    0
                  )
                )}
              </td>

              <td
                style={
                  styles.totalCell
                }
              >
                {moneyExact(
                  results.years.reduce(
                    (
                      total,
                      row
                    ) =>
                      total +
                      row.billPostInstall,
                    0
                  )
                )}
              </td>

            </tr>

          </tbody>

        </table>

      </div>

    </div>

  )
}


/* =========================================================
   SUMMARY BOX
   ========================================================= */

function SummaryBox({
  label,
  value,
}) {

  return (

    <div
      style={{
        background:
          "#2fa34a",
        color: "#fff",
        borderRadius: 7,
        minHeight: 54,
        display: "flex",
        flexDirection:
          "column",
        alignItems: "center",
        justifyContent:
          "center",
        padding:
          "8px 12px",
        textAlign: "center",
      }}
    >

      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        {label}
      </span>

      <strong
        style={{
          fontSize: 15,
          marginTop: 3,
        }}
      >
        {value}
      </strong>

    </div>

  )
}


/* =========================================================
   TABLE HEADER
   ========================================================= */

function TableHeader({
  children,
  green = false,
}) {

  return (

    <th
      style={{
        padding:
          "8px 7px",
        border:
          "1px solid #222",
        background:
          green
            ? "#2fa34a"
            : "#555",
        color: "#fff",
        fontSize: 10,
        fontWeight: 700,
        textAlign:
          "center",
        whiteSpace:
          "nowrap",
      }}
    >
      {children}
    </th>

  )
}


/* =========================================================
   TABLE CELL
   ========================================================= */

function TableCell({
  children,
  align = "right",
  bold = false,
  negative = false,
}) {

  return (

    <td
      style={{
        padding:
          "6px 8px",
        border:
          "1px solid #222",
        textAlign: align,
        whiteSpace:
          "nowrap",
        fontSize: 10,
        fontWeight:
          bold ? 600 : 400,
        color:
          negative
            ? "#ff0000"
            : "#334155",
        background:
          "#fff",
      }}
    >
      {children}
    </td>

  )
}


/* =========================================================
   STYLES
   ========================================================= */

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
    alignItems: "center",
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
    alignItems: "center",
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
    borderRadius: 999,
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


  totalCell: {
    padding:
      "10px 8px",
    border:
      "1px solid #222",
    background:
      "#555",
    color: "#fff",
    fontWeight: 700,
    fontSize: 10,
    textAlign: "right",
    whiteSpace:
      "nowrap",
  },


  totalCellGreen: {
    padding:
      "10px 8px",
    border:
      "1px solid #222",
    background:
      "#2fa34a",
    color: "#fff",
    fontWeight: 700,
    fontSize: 10,
    textAlign: "right",
    whiteSpace:
      "nowrap",
  },

}
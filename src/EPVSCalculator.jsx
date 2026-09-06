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
  AlertTriangle,
} from "lucide-react"

import AnnualBreakdown from "./components/EPVS/AnnualBreakdown"
import ThirtyYearBreakdown from "./components/EPVS/ThirtyYearBreakdown"

/*
 * =========================================================
 * EPVS CONSTANTS
 * =========================================================
 *
 * EPVS methodology:
 *
 * - Fuel inflation: 7.60%
 * - Mid-point inflation: 3.80%
 * - No inflation: 0%
 *
 * Standard SEG export is not fuel-inflated.
 *
 * Solar generation:
 *
 * Annual AC Output = kWp × Kk × Shade Factor
 *
 * Solar SC:
 *
 * Maximum 75% of annual generation / relevant consumption
 *
 * Solar + battery:
 *
 * Maximum 90% of annual consumption / generation
 */

const INFLATION_SCENARIOS = [
  {
    key: "zero",
    label: "0% inflation",
    rate: 0,
  },
  {
    key: "mid",
    label: "3.8% inflation",
    rate: 0.038,
  },
  {
    key: "epvs",
    label: "7.6% inflation",
    rate: 0.076,
  },
]

const DEFAULT_INFLATION_RATE = 0.076

const MAX_ARRAYS = 6

/*
 * EPVS methodology sunshine-hour figures.
 *
 * These are the annual daily average sunshine hours
 * from the EPVS methodology / SAP region table.
 */
const SAP_ZONES = [
  {
    value: "1",
    label: "Zone 1 - London",
    sunshineHours: 4.27,
  },
  {
    value: "2",
    label: "Zone 2 - Brighton",
    sunshineHours: 4.44,
  },
  {
    value: "3",
    label: "Zone 3 - Southampton",
    sunshineHours: 4.67,
  },
  {
    value: "4",
    label: "Zone 4 - Plymouth",
    sunshineHours: 4.75,
  },
  {
    value: "5E",
    label: "Zone 5E - Bristol",
    sunshineHours: 4.54,
  },
  {
    value: "5W",
    label: "Zone 5W - Cardiff",
    sunshineHours: 4.31,
  },
  {
    value: "6",
    label: "Zone 6 - Birmingham",
    sunshineHours: 4.11,
  },
  {
    value: "7E",
    label: "Zone 7E - Manchester",
    sunshineHours: 3.75,
  },
  {
    value: "7W",
    label: "Zone 7W - Chester",
    sunshineHours: 4.31,
  },
  {
    value: "8E",
    label: "Zone 8E - Carlisle",
    sunshineHours: 3.89,
  },
  {
    value: "8S",
    label: "Zone 8S - Dumfries",
    sunshineHours: 3.59,
  },
  {
    value: "9E",
    label: "Zone 9E - Newcastle",
    sunshineHours: 4.25,
  },
  {
    value: "9S",
    label: "Zone 9S - Edinburgh",
    sunshineHours: 3.97,
  },
  {
    value: "10",
    label: "Zone 10 - Middlesbrough",
    sunshineHours: 3.82,
  },
  {
    value: "11",
    label: "Zone 11 - Sheffield",
    sunshineHours: 4.07,
  },
  {
    value: "12",
    label: "Zone 12 - Norwich",
    sunshineHours: 4.41,
  },
  {
    value: "13",
    label: "Zone 13 - Aberystwyth",
    sunshineHours: 4.05,
  },
  {
    value: "14",
    label: "Zone 14 - Glasgow",
    sunshineHours: 3.38,
  },
  {
    value: "15",
    label: "Zone 15 - Dundee",
    sunshineHours: 4.0,
  },
  {
    value: "16",
    label: "Zone 16 - Aberdeen",
    sunshineHours: 3.97,
  },
  {
    value: "17",
    label: "Zone 17 - Inverness",
    sunshineHours: 3.42,
  },
  {
    value: "18",
    label: "Zone 18 - Stornoway",
    sunshineHours: 3.44,
  },
  {
    value: "19",
    label: "Zone 19 - Kirkwall",
    sunshineHours: 3.32,
  },
  {
    value: "20",
    label: "Zone 20 - Lerwick",
    sunshineHours: 3.17,
  },
  {
    value: "21",
    label: "Zone 21 - Belfast",
    sunshineHours: 3.5,
  },
]

const money = (value) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const money2 = (value) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

const number = (value) =>
  Number(value || 0).toLocaleString("en-GB", {
    maximumFractionDigits: 0,
  })

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

function createArray(index = 1) {
  return {
    id: index,
    panelCount: index === 1 ? 10 : 0,
    panelWattage: 415,
    orientation: 0,
    pitch: 35,
    kk: 1000,
    shadingFactor: 1,
  }
}

const initial = {
  customerName: "",
  address: "",
  postcode: "",

  annualConsumption: 4000,

  existingSolar: false,
  existingGeneration: 0,
  existingSolarSelfConsumption: 0.4,

  /*
   * Number of physical PV arrays / roofs.
   */
  arrayCount: 1,

  arrays: [
    createArray(1),
    createArray(2),
    createArray(3),
    createArray(4),
    createArray(5),
    createArray(6),
  ],

  /*
   * String count is recorded for system design /
   * validation. It does not multiply generation.
   */
  numberOfStrings: 1,

  batteryCapacity: 10,
  batteryEnabled: true,

  batteryDoD: 0.95,
  batteryRTE: 0.94,

  inverterCapacity: 5,
  inverterEuEfficiency: 0.97,

  sapZone: "14",

  importRate: 0.28,
  exportRate: 0.15,

  tariff: "Standard",

  /*
   * EPVS guide example uses 0.925%.
   * This should ultimately be populated from
   * the actual panel manufacturer's warranty.
   */
  panelDegradation: 0.925,

  /*
   * EPVS methodology says battery degradation should
   * come from manufacturer EoL/warranty. 2.5% is used
   * as the default when manufacturer information isn't
   * available.
   */
  batteryDegradation: 2.5,

  systemCost: 12000,
  deposit: 0,
  financeTerm: 10,
  financeRate: 7.9,

  /*
   * Replacement costs can be entered when known.
   * The EPVS model allows appropriate replacement costs
   * to be shown in longer-term projections.
   */
  inverterReplacementYear: 0,
  inverterReplacementCost: 0,

  batteryReplacementYear: 0,
  batteryReplacementCost: 0,
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  step,
  min,
  max,
  help,
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
          const nextValue =
            type === "number"
              ? Number(event.target.value)
              : event.target.value

          onChange(nextValue)
        }}
      />

      {help && (
        <small style={styles.help}>
          {help}
        </small>
      )}
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
   * EPVS CALCULATIONS
   * =========================================================
   */

  const results = useMemo(() => {
    const annualConsumption =
      Number(
        data.annualConsumption || 0
      )

    const inverterCapacity =
      Number(
        data.inverterCapacity || 0
      )

    const euEfficiency =
      Number(
        data.inverterEuEfficiency || 0
      )

    const sapZone =
      SAP_ZONES.find(
        (zone) =>
          zone.value ===
          String(data.sapZone)
      )

    const sunshineHours =
      sapZone?.sunshineHours || 0

    /*
     * -------------------------------------------------------
     * ARRAY GENERATION
     * -------------------------------------------------------
     *
     * EPVS:
     *
     * Annual AC output =
     * kWp × Kk × Shade Factor
     */

    const activeArrays =
      data.arrays
        .slice(0, data.arrayCount)
        .map((array) => {
          const panelCount =
            Number(
              array.panelCount || 0
            )

          const panelWattage =
            Number(
              array.panelWattage || 0
            )

          const kk =
            Number(
              array.kk || 0
            )

          const shadingFactor =
            Number(
              array.shadingFactor || 0
            )

          const systemSize =
            (panelCount *
              panelWattage) /
            1000

          const generation =
            systemSize *
            kk *
            shadingFactor

          const panelsPerString =
            data.numberOfStrings > 0
              ? panelCount /
                Number(
                  data.numberOfStrings
                )
              : 0

          return {
            ...array,
            systemSize,
            generation,
            panelsPerString,
          }
        })

    const systemSize =
      activeArrays.reduce(
        (total, array) =>
          total + array.systemSize,
        0
      )

    const generation =
      activeArrays.reduce(
        (total, array) =>
          total + array.generation,
        0
      )

    /*
     * -------------------------------------------------------
     * INVERTER CAPACITY
     * -------------------------------------------------------
     *
     * EPVS methodology:
     *
     * Solar SC capacity =
     * installed kW × EU efficiency × sunshine hours × 337
     *
     * Battery SC capacity =
     * installed kW × sunshine hours × 337
     *
     * Export capacity =
     * installed kW × sunshine hours × 365
     */

    const inverterSolarSCCapacity =
      inverterCapacity *
      euEfficiency *
      sunshineHours *
      337

    const inverterBatterySCCapacity =
      inverterCapacity *
      sunshineHours *
      337

    const inverterExportCapacity =
      inverterCapacity *
      sunshineHours *
      365

    /*
     * -------------------------------------------------------
     * EXISTING SOLAR
     * -------------------------------------------------------
     */

    const existingGeneration =
      data.existingSolar
        ? Number(
            data.existingGeneration ||
              0
          )
        : 0

    const existingSCPercentage =
      data.existingSolar
        ? Math.min(
            1,
            Math.max(
              0,
              Number(
                data.existingSolarSelfConsumption ||
                  0
              )
            )
          )
        : 0

    const existingSelfConsumption =
      existingGeneration *
      existingSCPercentage

    /*
     * -------------------------------------------------------
     * SOLAR SELF-CONSUMPTION
     * -------------------------------------------------------
     *
     * For a single-rate tariff:
     *
     * MIN(
     *   Inverter Solar SC Capacity,
     *   Generation × MIN(
     *     75%,
     *     Annual GC × 37.5% / Generation
     *   )
     * )
     */

    const solarPotentialCap =
      generation *
      Math.min(
        0.75,
        generation > 0
          ? (annualConsumption *
              0.375) /
              generation
          : 0
      )

    const solarSelfConsumption =
      Math.min(
        inverterSolarSCCapacity,
        solarPotentialCap
      )

    const solarSelfConsumptionPercentage =
      generation > 0
        ? solarSelfConsumption /
          generation
        : 0

    /*
     * -------------------------------------------------------
     * BATTERY SELF-CONSUMPTION
     * -------------------------------------------------------
     *
     * Constrained by:
     *
     * 90% of annual consumption
     * 90% of generation
     * inverter battery capacity
     * physical battery capacity
     */

    const batteryPhysicalCapacity =
      data.batteryEnabled
        ? Number(
            data.batteryCapacity || 0
          ) *
          Number(
            data.batteryDoD || 0
          ) *
          Number(
            data.batteryRTE || 0
          )
        : 0

    const batteryGenerationCap =
      generation *
      Math.max(
        0,
        0.9 -
          solarSelfConsumptionPercentage
      )

    const batteryConsumptionCap =
      annualConsumption *
      Math.max(
        0,
        0.9 -
          solarSelfConsumptionPercentage
      )

    const batteryInverterCap =
      Math.max(
        0,
        inverterBatterySCCapacity -
          solarSelfConsumption
      )

    const batteryContribution =
      data.batteryEnabled
        ? Math.min(
            batteryPhysicalCapacity,
            batteryGenerationCap,
            batteryConsumptionCap,
            batteryInverterCap
          )
        : 0

    /*
     * -------------------------------------------------------
     * TOTAL GRID REDUCTION
     * -------------------------------------------------------
     */

    const gridReduction =
      Math.min(
        annualConsumption *
          (data.batteryEnabled
            ? 0.9
            : 0.75),
        solarSelfConsumption +
          batteryContribution
      )

    /*
     * -------------------------------------------------------
     * EXPORT
     * -------------------------------------------------------
     */

    const availableSurplus =
      Math.max(
        0,
        generation -
          solarSelfConsumption -
          batteryContribution
      )

    const cappedExport =
      Math.min(
        availableSurplus,
        inverterExportCapacity
      )

    const existingExport =
      Math.max(
        0,
        existingGeneration -
          existingSelfConsumption
      )

    /*
     * Net export kWh for a new system.
     */
    const netExportKwh =
      Math.max(
        0,
        cappedExport -
          existingExport
      )

    /*
     * -------------------------------------------------------
     * YEAR 1 BENEFIT
     * -------------------------------------------------------
     */

    const solarBenefit =
      solarSelfConsumption *
      Number(data.importRate || 0)

    const batterySelfConsumptionBenefit =
      batteryContribution *
      Number(data.importRate || 0)

    /*
     * Standard SEG export does not receive fuel
     * inflation according to EPVS.
     *
     * Flux export is treated differently in the
     * detailed tariff methodology.
     *
     * For this calculator, Standard uses the entered
     * export rate without inflation.
     */
    const exportBenefit =
      netExportKwh *
      Number(data.exportRate || 0)

    const forceChargeBenefit = 0

    const annualSaving =
      solarBenefit +
      batterySelfConsumptionBenefit +
      forceChargeBenefit +
      exportBenefit

    /*
     * -------------------------------------------------------
     * FINANCE
     * -------------------------------------------------------
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

    const financeAmount =
      Math.max(
        0,
        systemCost - deposit
      )

    const monthlyRate =
      Number(data.financeRate || 0) /
      100 /
      12

    const months =
      Math.max(
        0,
        Number(data.financeTerm || 0) *
          12
      )

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

    const totalFinancePayments =
      monthlyPayment * months

    const totalContractValue =
      deposit +
      totalFinancePayments

    const simplePayback =
      annualSaving > 0
        ? systemCost /
          annualSaving
        : null

    return {
      activeArrays,

      systemSize,
      generation,

      existingGeneration,
      existingSelfConsumption,
      existingExport,

      sunshineHours,

      inverterSolarSCCapacity,
      inverterBatterySCCapacity,
      inverterExportCapacity,

      solarPotentialCap,
      solarSelfConsumption,
      solarSelfConsumptionPercentage,

      batteryPhysicalCapacity,
      batteryGenerationCap,
      batteryConsumptionCap,
      batteryInverterCap,
      batteryContribution,

      gridReduction,

      availableSurplus,
      cappedExport,
      netExportKwh,

      solarBenefit,
      batterySelfConsumptionBenefit,
      forceChargeBenefit,
      exportBenefit,

      annualSaving,

      financeAmount,
      monthlyPayment,
      totalFinancePayments,
      totalContractValue,

      simplePayback,
    }
  }, [data])

  /*
   * =========================================================
   * 30 YEAR PROJECTIONS
   * =========================================================
   */

  const thirtyYearProjection =
    useMemo(() => {
      const scenarios = {}

      INFLATION_SCENARIOS.forEach(
        (scenario) => {
          const rows = []

          let cumulativePosition = 0

          for (
            let year = 1;
            year <= 30;
            year++
          ) {
            /*
             * Panel degradation.
             */
            const generation =
              results.generation *
              Math.pow(
                Math.max(
                  0,
                  1 -
                    Number(
                      data.panelDegradation ||
                        0
                    ) /
                      100
                ),
                year - 1
              )

            /*
             * Battery degradation.
             */
            const battery =
              data.batteryEnabled
                ? results.batteryContribution *
                  Math.pow(
                    Math.max(
                      0,
                      1 -
                        Number(
                          data.batteryDegradation ||
                            0
                        ) /
                          100
                    ),
                    year - 1
                  )
                : 0

            /*
             * Maintain the same proportion of the
             * first-year generation going into direct
             * solar self-consumption.
             */
            const solarRatio =
              results.generation > 0
                ? results.solarSelfConsumption /
                  results.generation
                : 0

            const solar =
              generation *
              solarRatio

            /*
             * Battery cannot exceed the remaining
             * generation after solar.
             */
            const availableForBattery =
              Math.max(
                0,
                generation - solar
              )

            const cappedBattery =
              Math.min(
                battery,
                availableForBattery
              )

            const exportKwh =
              Math.max(
                0,
                generation -
                  solar -
                  cappedBattery
              )

            /*
             * EPVS fuel inflation.
             *
             * Self-consumption benefits are inflated.
             */
            const inflationFactor =
              Math.pow(
                1 + scenario.rate,
                year - 1
              )

            const importRateYear =
              Number(
                data.importRate || 0
              ) *
              inflationFactor

            /*
             * Standard SEG export is not inflated.
             *
             * Flux export is treated as indexed.
             */
            const exportIsInflated =
              data.tariff ===
                "Standard Flux" ||
              data.tariff ===
                "Intelligent Flux"

            const exportRateYear =
              Number(
                data.exportRate || 0
              ) *
              (exportIsInflated
                ? inflationFactor
                : 1)

            const solarBenefit =
              solar *
              importRateYear

            const batteryBenefit =
              cappedBattery *
              importRateYear

            const exportBenefit =
              exportKwh *
              exportRateYear

            const annualBenefit =
              solarBenefit +
              batteryBenefit +
              exportBenefit

            /*
             * Finance:
             *
             * Deposit in year 1.
             * Monthly finance payments for the duration
             * of the finance term.
             */
            const financePayment =
              year === 1
                ? deposit +
                  monthlyPayment *
                    Math.min(
                      12,
                      months
                    )
                : year <=
                  Number(
                    data.financeTerm || 0
                  )
                ? monthlyPayment * 12
                : 0

            /*
             * Replacement costs.
             */
            const inverterReplacement =
              Number(
                data.inverterReplacementYear ||
                  0
              ) === year
                ? Number(
                    data.inverterReplacementCost ||
                      0
                  )
                : 0

            const batteryReplacement =
              Number(
                data.batteryReplacementYear ||
                  0
              ) === year
                ? Number(
                    data.batteryReplacementCost ||
                      0
                  )
                : 0

            const replacementCosts =
              inverterReplacement +
              batteryReplacement

            const totalYearlyPayment =
              financePayment +
              replacementCosts

            const netAnnualBenefit =
              annualBenefit -
              totalYearlyPayment

            cumulativePosition +=
              netAnnualBenefit

            /*
             * Estimated bills.
             *
             * These are intentionally based on the
             * simplified single-rate input currently
             * available in the UI.
             */
            const billPreInstall =
              Number(
                data.annualConsumption ||
                  0
              ) *
              importRateYear

            const gridReduction =
              Math.min(
                Number(
                  data.annualConsumption ||
                    0
                ) *
                  (data.batteryEnabled
                    ? 0.9
                    : 0.75),
                solar +
                  cappedBattery
              )

            const remainingGrid =
              Math.max(
                0,
                Number(
                  data.annualConsumption ||
                    0
                ) -
                  gridReduction
              )

            const billPostInstall =
              remainingGrid *
              importRateYear

            rows.push({
              year,

              generation,
              solar,
              battery: cappedBattery,
              exportKwh,

              annualBenefit,

              solarBenefit,
              batteryBenefit,
              exportBenefit,

              yearlyPayment:
                totalYearlyPayment,

              financePayment,
              replacementCosts,

              netAnnualBenefit,

              cumulativePosition,

              billPreInstall,
              billPostInstall,

              importRateYear,
              exportRateYear,

              inflationRate:
                scenario.rate,
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

                total.financePayment +=
                  row.financePayment

                total.replacementCosts +=
                  row.replacementCosts

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
                financePayment: 0,
                replacementCosts: 0,
              }
            )

          const paybackRow =
            rows.find(
              (row) =>
                row.cumulativePosition >=
                0
            )

          scenarios[scenario.key] = {
            key: scenario.key,
            label: scenario.label,
            inflationRate:
              scenario.rate,

            rows,
            totals,

            paybackPeriod:
              paybackRow?.year ||
              null,

            totalNetSavings:
              totals.netAnnualBenefit,

            totalNetReturn:
              totals.netAnnualBenefit,
          }
        }
      )

      /*
       * The main projection remains the EPVS 7.6%
       * scenario so the existing ThirtyYearBreakdown
       * continues to work.
       */
      const epvsScenario =
        scenarios.epvs

      return {
        ...epvsScenario,

        scenarios,

        inflationScenarios:
          INFLATION_SCENARIOS,
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
    setData(appointmentInitial)
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

        {/* =================================================
            CUSTOMER
        ================================================= */}

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

        {/* =================================================
            PROPERTY
        ================================================= */}

        {step === 1 && (
          <Card
            title="Property"
            subtitle="Current electricity consumption and existing solar."
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
                <>
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

                  <Input
                    label="Existing solar self-consumption (%)"
                    type="number"
                    value={
                      Number(
                        data.existingSolarSelfConsumption ||
                          0
                      ) * 100
                    }
                    onChange={(value) =>
                      update(
                        "existingSolarSelfConsumption",
                        Number(value || 0) /
                          100
                      )
                    }
                    min={0}
                    max={100}
                    step={1}
                  />
                </>
              )}
            </div>
          </Card>
        )}

        {/* =================================================
            SOLAR PV
        ================================================= */}

        {step === 2 && (
          <>
            <Card
              title="Solar PV"
              subtitle="Enter the roof / array information used for the EPVS generation calculation."
            >
              <div style={styles.grid}>
                <Input
                  label="Number of arrays / roofs"
                  type="number"
                  value={
                    data.arrayCount
                  }
                  onChange={(value) =>
                    update(
                      "arrayCount",
                      Math.min(
                        MAX_ARRAYS,
                        Math.max(
                          1,
                          Number(
                            value || 1
                          )
                        )
                      )
                    )
                  }
                  min={1}
                  max={MAX_ARRAYS}
                  step={1}
                  help="EPVS allows each roof/array to have its own generation inputs."
                />

                <Input
                  label="Number of strings"
                  type="number"
                  value={
                    data.numberOfStrings
                  }
                  onChange={(value) =>
                    update(
                      "numberOfStrings",
                      Math.max(
                        1,
                        Number(
                          value || 1
                        )
                      )
                    )
                  }
                  min={1}
                  step={1}
                  help="Recorded as a system design input. String count does not multiply PV generation."
                />
              </div>
            </Card>

            {data.arrays
              .slice(0, data.arrayCount)
              .map((array, index) => (
                <ArrayCard
                  key={array.id}
                  array={array}
                  index={index}
                  numberOfStrings={
                    data.numberOfStrings
                  }
                  onChange={
                    updateArray
                  }
                />
              ))}

            {results.activeArrays.some(
              (array) =>
                array.shadingFactor <
                0.7
            ) && (
              <div
                style={
                  styles.warning
                }
              >
                <AlertTriangle
                  size={18}
                />

                <div>
                  <strong>
                    EPVS validation warning
                  </strong>

                  <div>
                    An array with 30% or
                    more shading cannot
                    be validated under
                    the EPVS validation
                    guide.
                  </div>
                </div>
              </div>
            )}

            <Card
              title="Generation summary"
              subtitle="Calculated using the EPVS array formula."
            >
              <div
                style={
                  styles.summaryGrid
                }
              >
                <SummaryMetric
                  label="Total installed capacity"
                  value={`${results.systemSize.toFixed(
                    2
                  )} kWp`}
                />

                <SummaryMetric
                  label="Total annual generation"
                  value={`${number(
                    results.generation
                  )} kWh`}
                />

                <SummaryMetric
                  label="Number of arrays"
                  value={
                    data.arrayCount
                  }
                />

                <SummaryMetric
                  label="Number of strings"
                  value={
                    data.numberOfStrings
                  }
                />
              </div>
            </Card>
          </>
        )}

        {/* =================================================
            BATTERY
        ================================================= */}

        {step === 3 && (
          <Card
            title="Battery"
            subtitle="Battery capacity and manufacturer performance assumptions."
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
                <>
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

                  <Input
                    label="Depth of discharge (%)"
                    type="number"
                    value={
                      Number(
                        data.batteryDoD ||
                          0
                      ) * 100
                    }
                    onChange={(value) =>
                      update(
                        "batteryDoD",
                        Number(
                          value || 0
                        ) / 100
                      )
                    }
                    min={0}
                    max={100}
                    step={1}
                  />

                  <Input
                    label="Round-trip efficiency (%)"
                    type="number"
                    value={
                      Number(
                        data.batteryRTE ||
                          0
                      ) * 100
                    }
                    onChange={(value) =>
                      update(
                        "batteryRTE",
                        Number(
                          value || 0
                        ) / 100
                      )
                    }
                    min={0}
                    max={100}
                    step={1}
                  />

                  <Input
                    label="Battery degradation (%/year)"
                    type="number"
                    value={
                      data.batteryDegradation
                    }
                    onChange={(value) =>
                      update(
                        "batteryDegradation",
                        value
                      )
                    }
                    min={0}
                    max={100}
                    step={0.1}
                    help="Use the manufacturer's warranty/EoL figure where available."
                  />
                </>
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
            subtitle="EPVS inverter capacity and SAP-region assumptions."
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

              <Input
                label="EU efficiency (%)"
                type="number"
                value={
                  Number(
                    data.inverterEuEfficiency ||
                      0
                  ) * 100
                }
                onChange={(value) =>
                  update(
                    "inverterEuEfficiency",
                    Number(
                      value || 0
                    ) / 100
                  )
                }
                min={0}
                max={100}
                step={0.1}
              />

              <label
                style={
                  styles.field
                }
              >
                <span>
                  SAP region
                </span>

                <select
                  value={
                    data.sapZone
                  }
                  onChange={(event) =>
                    update(
                      "sapZone",
                      event.target
                        .value
                    )
                  }
                >
                  {SAP_ZONES.map(
                    (zone) => (
                      <option
                        key={
                          zone.value
                        }
                        value={
                          zone.value
                        }
                      >
                        {zone.label}
                      </option>
                    )
                  )}
                </select>
              </label>

              <div
                style={
                  styles.infoBox
                }
              >
                <strong>
                  Sunshine hours
                </strong>

                <div
                  style={{
                    marginTop: 5,
                    fontSize: 20,
                    fontWeight: 700,
                  }}
                >
                  {results.sunshineHours.toFixed(
                    2
                  )}{" "}
                  hrs/day
                </div>

                <small>
                  Used for the EPVS inverter
                  capacity constraints.
                </small>
              </div>
            </div>

            <div
              style={{
                marginTop: 20,
              }}
            >
              <div
                style={
                  styles.summaryGrid
                }
              >
                <SummaryMetric
                  label="Solar SC inverter capacity"
                  value={`${number(
                    results.inverterSolarSCCapacity
                  )} kWh`}
                />

                <SummaryMetric
                  label="Battery SC inverter capacity"
                  value={`${number(
                    results.inverterBatterySCCapacity
                  )} kWh`}
                />

                <SummaryMetric
                  label="Export inverter capacity"
                  value={`${number(
                    results.inverterExportCapacity
                  )} kWh`}
                />
              </div>
            </div>
          </Card>
        )}

        {/* =================================================
            ELECTRICITY
        ================================================= */}

        {step === 5 && (
          <Card
            title="Electricity"
            subtitle="Current electricity assumptions used for Year 1 savings."
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

              <div
                style={
                  styles.infoBox
                }
              >
                <strong>
                  EPVS consumption cap
                </strong>

                <div
                  style={{
                    marginTop: 5,
                    fontSize: 20,
                    fontWeight: 700,
                  }}
                >
                  {data.batteryEnabled
                    ? "90%"
                    : "75%"}
                </div>

                <small>
                  Solar + battery installations
                  use the 90% cap. Solar-only
                  installations use 75%.
                </small>
              </div>
            </div>
          </Card>
        )}

        {/* =================================================
            TARIFF
        ================================================= */}

        {step === 6 && (
          <Card
            title="Tariff"
            subtitle="Select the tariff model used by the calculation."
          >
            <div style={styles.grid}>
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

              <div
                style={
                  styles.infoBox
                }
              >
                <strong>
                  Fuel inflation
                </strong>

                <div
                  style={{
                    marginTop: 5,
                    fontSize: 20,
                    fontWeight: 700,
                  }}
                >
                  7.60%
                </div>

                <small>
                  EPVS uses 7.60% as its
                  standard fuel inflation
                  scenario.
                </small>
              </div>
            </div>
          </Card>
        )}

        {/* =================================================
            FINANCE
        ================================================= */}

        {step === 7 && (
          <Card
            title="Finance"
            subtitle="System cost and consumer finance assumptions."
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
                step={1}
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

              <Input
                label="Panel degradation (%/year)"
                type="number"
                value={
                  data.panelDegradation
                }
                onChange={(value) =>
                  update(
                    "panelDegradation",
                    value
                  )
                }
                min={0}
                max={100}
                step={0.001}
                help="Use the panel manufacturer's stated performance warranty figure."
              />

              <Input
                label="Inverter replacement year"
                type="number"
                value={
                  data.inverterReplacementYear
                }
                onChange={(value) =>
                  update(
                    "inverterReplacementYear",
                    value
                  )
                }
                min={0}
                max={30}
                step={1}
              />

              <Input
                label="Inverter replacement cost (£)"
                type="number"
                value={
                  data.inverterReplacementCost
                }
                onChange={(value) =>
                  update(
                    "inverterReplacementCost",
                    value
                  )
                }
                min={0}
              />

              <Input
                label="Battery replacement year"
                type="number"
                value={
                  data.batteryReplacementYear
                }
                onChange={(value) =>
                  update(
                    "batteryReplacementYear",
                    value
                  )
                }
                min={0}
                max={30}
                step={1}
              />

              <Input
                label="Battery replacement cost (£)"
                type="number"
                value={
                  data.batteryReplacementCost
                }
                onChange={(value) =>
                  update(
                    "batteryReplacementCost",
                    value
                  )
                }
                min={0}
              />
            </div>

            <div
              style={{
                marginTop: 20,
              }}
            >
              <div
                style={
                  styles.summaryGrid
                }
              >
                <SummaryMetric
                  label="Monthly repayment"
                  value={money(
                    results.monthlyPayment
                  )}
                />

                <SummaryMetric
                  label="Total finance payments"
                  value={money(
                    results.totalFinancePayments
                  )}
                />

                <SummaryMetric
                  label="Total contract value"
                  value={money(
                    results.totalContractValue
                  )}
                />
              </div>
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

            <AnnualBreakdown
              results={results}
            />

            <InflationScenarioSummary
              thirtyYearProjection={
                thirtyYearProjection
              }
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

        {/* =================================================
            FOOTER
        ================================================= */}

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
 * =========================================================
 * ARRAY CARD
 * =========================================================
 */

function ArrayCard({
  array,
  index,
  numberOfStrings,
  onChange,
}) {
  const panelsPerString =
    numberOfStrings > 0
      ? Number(
          array.panelCount || 0
        ) / numberOfStrings
      : 0

  const invalidStringSplit =
    array.panelCount > 0 &&
    numberOfStrings > 0 &&
    !Number.isInteger(
      panelsPerString
    )

  return (
    <div
      className="card"
      style={{
        marginBottom: 14,
      }}
    >
      <div
        className="card-head"
      >
        <div>
          <h2>
            Array {index + 1}
          </h2>

          <p>
            Roof / array {index + 1}
          </p>
        </div>
      </div>

      <div style={styles.grid}>
        <Input
          label="Number of panels"
          type="number"
          value={
            array.panelCount
          }
          onChange={(value) =>
            onChange(
              index,
              "panelCount",
              Math.max(
                0,
                Number(
                  value || 0
                )
              )
            )
          }
          min={0}
          step={1}
        />

        <Input
          label="Panel wattage (Wp)"
          type="number"
          value={
            array.panelWattage
          }
          onChange={(value) =>
            onChange(
              index,
              "panelWattage",
              Math.max(
                0,
                Number(
                  value || 0
                )
              )
            )
          }
          min={1}
          step={1}
        />

        <Input
          label="Degrees from south (°)"
          type="number"
          value={
            array.orientation
          }
          onChange={(value) =>
            onChange(
              index,
              "orientation",
              Number(
                value || 0
              )
            )
          }
          min={-180}
          max={180}
          step={1}
        />

        <Input
          label="Roof pitch (°)"
          type="number"
          value={
            array.pitch
          }
          onChange={(value) =>
            onChange(
              index,
              "pitch",
              Number(
                value || 0
              )
            )
          }
          min={0}
          max={90}
          step={1}
        />

        <Input
          label="Irradiance Kk (kWh/kWp)"
          type="number"
          value={
            array.kk
          }
          onChange={(value) =>
            onChange(
              index,
              "kk",
              Number(
                value || 0
              )
            )
          }
          min={0}
          step={1}
          help="Enter the Kk figure from the current MCS irradiance dataset."
        />

        <Input
          label="Shade factor"
          type="number"
          value={
            array.shadingFactor
          }
          onChange={(value) =>
            onChange(
              index,
              "shadingFactor",
              Number(
                value || 0
              )
            )
          }
          min={0}
          max={1}
          step={0.01}
          help="1.00 = no shading. 0.90 = 10% shading."
        />

        <div
          style={
            styles.infoBox
          }
        >
          <strong>
            Array system size
          </strong>

          <div
            style={{
              marginTop: 5,
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            {(
              (Number(
                array.panelCount || 0
              ) *
                Number(
                  array.panelWattage ||
                    0
                )) /
              1000
            ).toFixed(2)}{" "}
            kWp
          </div>
        </div>

        <div
          style={
            styles.infoBox
          }
        >
          <strong>
            Estimated generation
          </strong>

          <div
            style={{
              marginTop: 5,
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            {number(
              (
                (Number(
                  array.panelCount ||
                    0
                ) *
                  Number(
                    array.panelWattage ||
                      0
                  )) /
                  1000
              ) *
                Number(
                  array.kk || 0
                ) *
                Number(
                  array.shadingFactor ||
                    0
                )
            )}{" "}
            kWh
          </div>
        </div>
      </div>

      {invalidStringSplit && (
        <div
          style={{
            ...styles.warning,
            marginTop: 16,
          }}
        >
          <AlertTriangle
            size={18}
          />

          <div>
            <strong>
              String configuration
              warning
            </strong>

            <div>
              {array.panelCount} panels
              divided across{" "}
              {numberOfStrings} strings
              gives{" "}
              {panelsPerString.toFixed(
                2
              )}{" "}
              panels per string.
              Check the physical
              system design.
            </div>
          </div>
        </div>
      )}
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
        results.netExportKwh
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

        <div
          style={
            styles.badge
          }
        >
          EPVS model
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

      <div
        style={{
          ...styles.summaryGrid,
          marginTop: 14,
        }}
      >
        <SummaryMetric
          label="Solar cap"
          value={`${number(
            results.solarSelfConsumption
          )} kWh`}
        />

        <SummaryMetric
          label="Battery cap"
          value={`${number(
            results.batteryContribution
          )} kWh`}
        />

        <SummaryMetric
          label="Grid reduction"
          value={`${number(
            results.gridReduction
          )} kWh`}
        />

        <SummaryMetric
          label="Export"
          value={`${number(
            results.netExportKwh
          )} kWh`}
        />
      </div>
    </div>
  )
}

/*
 * =========================================================
 * INFLATION SUMMARY
 * =========================================================
 */

function InflationScenarioSummary({
  thirtyYearProjection,
}) {
  if (
    !thirtyYearProjection?.scenarios
  ) {
    return null
  }

  const scenarios =
    Object.values(
      thirtyYearProjection.scenarios
    )

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
            30 Year Inflation Scenarios
          </h2>

          <p>
            EPVS requires projected
            figures to show different
            inflation scenarios when
            inflation is used.
          </p>
        </div>
      </div>

      <div
        style={
          styles.summaryGrid
        }
      >
        {scenarios.map(
          (scenario) => (
            <div
              key={
                scenario.key
              }
              style={{
                border:
                  "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 16,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                {scenario.label}
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontSize: 20,
                  fontWeight: 700,
                }}
              >
                {money(
                  scenario.totalNetSavings
                )}
              </div>

              <div
                style={{
                  marginTop: 5,
                  fontSize: 12,
                  color: "#475569",
                }}
              >
                Payback:{" "}
                {scenario.paybackPeriod
                  ? `${scenario.paybackPeriod} years`
                  : "Not achieved"}
              </div>
            </div>
          )
        )}
      </div>
    </div>
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
      <div className="card-head">
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
 * =========================================================
 * SUMMARY METRIC
 * =========================================================
 */

function SummaryMetric({
  label,
  value,
}) {
  return (
    <div
      style={{
        border:
          "1px solid #e5e7eb",
        borderRadius: 10,
        padding: 15,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#64748b",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 5,
          fontSize: 18,
          fontWeight: 700,
          color: "#172554",
        }}
      >
        {value}
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

  help: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.4,
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
      "repeat(4, minmax(0, 1fr))",
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

  summaryGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: 12,
  },

  infoBox: {
    border:
      "1px solid #dbe4ef",
    background: "#f8fafc",
    borderRadius: 10,
    padding: 14,
    color: "#334155",
  },

  warning: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    border:
      "1px solid #fed7aa",
    background: "#fff7ed",
    color: "#9a3412",
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    fontSize: 13,
    lineHeight: 1.5,
  },
}
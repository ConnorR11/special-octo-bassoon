import React, { useEffect, useMemo, useState } from "react"
import { supabase } from "./lib/supabase"
import { getEpvsZone, getIrradiance } from "./epvsIrradianceData"

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
  { title: "Battery & Inverter", icon: Battery },
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

  batteryCapacity: "",

  inverterCapacity: "",

  importRate: 28,
  exportRate: 15,
  standingCharge: 30,

  tariff: "Standard Flux",

  fluxDayImport: 24.96,
  fluxDayExport: 9.55,
  fluxImport: 14.98,
  fluxExport: 4.42,
  fluxPeakImport: 34.94,
  fluxPeakExport: 27.19,
  fluxStandingCharge: 62.83,
  fluxRatesRetrievedAt: "",
  fluxGsp: "",
  fluxImportTariffCode: "",
  fluxExportTariffCode: "",

  // EPVS modelling assumptions. Manufacturer values should be used where known.
  inverterEuEfficiency: 97,
  batteryDoD: 95,
  batteryRTE: 94,
  batteryDegradation: 2.5,
  batteryWarrantyYears: 10,
  solarDegradation: 0.4,
  solarWarrantyYears: 30,
  existingSolarSelfConsumption: 50,

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
  readOnly = false,
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
        readOnly={readOnly}
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


const SAP_ZONES = [
  { code: "1", name: "London", sunshine: 4.27 },
  { code: "2", name: "Brighton", sunshine: 4.44 },
  { code: "3", name: "Southampton", sunshine: 4.67 },
  { code: "4", name: "Plymouth", sunshine: 4.75 },
  { code: "5E", name: "Bristol", sunshine: 4.54 },
  { code: "5W", name: "Cardiff", sunshine: 4.31 },
  { code: "6", name: "Birmingham", sunshine: 4.11 },
  { code: "7E", name: "Manchester", sunshine: 3.75 },
  { code: "7W", name: "Chester", sunshine: 4.31 },
  { code: "8E", name: "Carlisle", sunshine: 3.89 },
  { code: "8S", name: "Dumfries", sunshine: 3.59 },
  { code: "9E", name: "Newcastle", sunshine: 4.25 },
  { code: "9S", name: "Edinburgh", sunshine: 3.97 },
  { code: "10", name: "Middlesbrough", sunshine: 3.82 },
  { code: "11", name: "Sheffield", sunshine: 4.07 },
  { code: "12", name: "Norwich", sunshine: 4.41 },
  { code: "13", name: "Aberystwyth", sunshine: 4.05 },
  { code: "14", name: "Glasgow", sunshine: 3.38 },
  { code: "15", name: "Dundee", sunshine: 4.00 },
  { code: "16", name: "Aberdeen", sunshine: 3.97 },
  { code: "17", name: "Inverness", sunshine: 3.42 },
  { code: "18", name: "Stornoway", sunshine: 3.44 },
  { code: "19", name: "Kirkwall", sunshine: 3.32 },
  { code: "20", name: "Lerwick", sunshine: 3.17 },
  { code: "21", name: "Belfast", sunshine: 3.50 },
]

function inferSapZone(postcode) {
  const outward = String(postcode || "").trim().toUpperCase().split(/\s+/)[0]
  if (/^(G|PA)/.test(outward)) return "14"
  if (/^DD/.test(outward)) return "15"
  if (/^AB/.test(outward)) return "16"
  if (/^IV/.test(outward)) return "17"
  if (/^HS/.test(outward)) return "18"
  if (/^KW/.test(outward)) return "19"
  if (/^ZE/.test(outward)) return "20"
  if (/^EH/.test(outward)) return "9S"
  if (/^DG/.test(outward)) return "8S"
  if (/^CA/.test(outward)) return "8E"
  if (/^NE/.test(outward)) return "9E"
  if (/^TS/.test(outward)) return "10"
  if (/^S/.test(outward)) return "11"
  if (/^NR/.test(outward)) return "12"
  if (/^(SY23|SY24|SY25)/.test(outward)) return "13"
  if (/^BT/.test(outward)) return "21"
  if (/^CH/.test(outward)) return "7W"
  if (/^(M|OL)/.test(outward)) return "7E"
  if (/^(B|CV)/.test(outward)) return "6"
  if (/^CF/.test(outward)) return "5W"
  if (/^BS/.test(outward)) return "5E"
  if (/^PL/.test(outward)) return "4"
  if (/^SO/.test(outward)) return "3"
  if (/^BN/.test(outward)) return "2"
  if (/^(E|EC|N|NW|SE|SW|W|WC)/.test(outward)) return "1"
  return "14"
}

function getSapZone(postcode, selectedZone) {
  const code = selectedZone || inferSapZone(postcode)
  return SAP_ZONES.find((zone) => zone.code === code) || SAP_ZONES.find((zone) => zone.code === "14")
}

function fluxProfileForConsumption(consumption) {
  const kwh = Number(consumption || 0)
  if (kwh < 2000) return { day: 0.61, flux: 0.15, peak: 0.24 }
  if (kwh < 3000) return { day: 0.63, flux: 0.12, peak: 0.25 }
  if (kwh < 4000) return { day: 0.64, flux: 0.10, peak: 0.26 }
  if (kwh < 5000) return { day: 0.63, flux: 0.09, peak: 0.28 }
  if (kwh < 6000) return { day: 0.63, flux: 0.08, peak: 0.29 }
  if (kwh < 7000) return { day: 0.62, flux: 0.08, peak: 0.30 }
  if (kwh < 8000) return { day: 0.61, flux: 0.08, peak: 0.31 }
  if (kwh < 9000) return { day: 0.53, flux: 0.15, peak: 0.32 }
  if (kwh < 10000) return { day: 0.54, flux: 0.18, peak: 0.28 }
  if (kwh < 11000) return { day: 0.54, flux: 0.20, peak: 0.26 }
  if (kwh < 12000) return { day: 0.54, flux: 0.21, peak: 0.25 }
  if (kwh < 13000) return { day: 0.54, flux: 0.22, peak: 0.24 }
  if (kwh < 14000) return { day: 0.54, flux: 0.23, peak: 0.23 }
  if (kwh < 15000) return { day: 0.54, flux: 0.24, peak: 0.22 }
  return { day: 0.54, flux: 0.25, peak: 0.21 }
}

const nonNegative = (value) => Math.max(0, Number(value || 0))

function monthlyPaymentForYear(data) {
  const systemCost = Number(data.systemCost || 0)
  const deposit = Number(data.deposit || 0)
  const financeAmount = Math.max(0, systemCost - deposit)
  const months = Math.max(0, Number(data.financeTerm || 0) * 12)
  if (financeAmount <= 0 || months <= 0) return 0
  const monthlyRate = Number(data.financeRate || 0) / 100 / 12
  if (monthlyRate <= 0) return financeAmount / months
  return financeAmount * (
    (monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)
  )
}

function calculateStandardFluxYear({
  generation,
  annualConsumption,
  inverterCapacity,
  inverterEuEfficiency,
  batteryCapacity,
  batteryDoD,
  batteryRTE,
  currentImportPence,
  currentExportPence,
  currentStandingPence,
  fluxDayImport,
  fluxDayExport,
  fluxImport,
  fluxExport,
  fluxPeakImport,
  fluxPeakExport,
  fluxStandingCharge,
  sunshineHours,
  existingGeneration,
  existingSolarSelfConsumption,
}) {
  const gen = nonNegative(generation)
  const consumption = nonNegative(annualConsumption)
  const inverter = nonNegative(inverterCapacity)
  const euEfficiency = nonNegative(inverterEuEfficiency) / 100
  const battery = nonNegative(batteryCapacity)
  const dod = nonNegative(batteryDoD) / 100
  const rte = nonNegative(batteryRTE) / 100
  const sunshine = nonNegative(sunshineHours)
  const profile = fluxProfileForConsumption(consumption)

  const currentImport = nonNegative(currentImportPence) / 100
  const currentExport = nonNegative(currentExportPence) / 100
  const currentStanding = nonNegative(currentStandingPence) / 100

  const dayImport = nonNegative(fluxDayImport) / 100
  const dayExport = nonNegative(fluxDayExport) / 100
  const newFluxImport = nonNegative(fluxImport) / 100
  const peakImport = nonNegative(fluxPeakImport) / 100
  const newPeakExport = nonNegative(fluxPeakExport) / 100
  const newStanding = nonNegative(fluxStandingCharge) / 100

  const existingGen = nonNegative(existingGeneration)
  const existingScPct = nonNegative(existingSolarSelfConsumption) / 100
  const existingExportKwh = existingGen * Math.max(0, 1 - existingScPct)

  // EPVS global inverter capacities.
  const inverterSolarSCCapacity = inverter * euEfficiency * sunshine * 337
  const inverterBatterySCCapacity = inverter * sunshine * 337
  const inverterExportCapacity = inverter * sunshine * 365
  const inverterFluxCapacity = inverter * 3 * 365

  // Standard Flux current-grid-consumption solar SC baseline.
  const cappedSolarSC = Math.min(
    inverterSolarSCCapacity,
    gen > 0 ? gen * Math.min(0.75, (consumption * 0.375) / gen) : 0
  )

  const peakSolarSC = Math.min(
    cappedSolarSC,
    consumption * 0.75 * profile.peak * (1 / 3)
  )
  const daySolarSC = nonNegative(cappedSolarSC - peakSolarSC)

  // Existing solar contribution, where applicable.
  const existingGenerationSC = existingGen * Math.min(
    Math.max(0, 0.9 - existingScPct),
    existingGen > 0 ? (consumption * 0.9) / existingGen : 0
  )

  // EPVS battery capacities include DoD, RTE and annualised cannibalism.
  const cannibalism = battery * 3.25
  const batterySCCapacity = nonNegative(
    battery * dod * rte * 337 - cannibalism
  )
  const batteryDemandCapacity = nonNegative(
    consumption * 0.9 - existingGenerationSC
  )

  const cappedBatterySC = Math.min(
    nonNegative(inverterBatterySCCapacity - cappedSolarSC),
    batterySCCapacity,
    nonNegative(gen * 0.9 - cappedSolarSC),
    batteryDemandCapacity + nonNegative(existingGen - existingGenerationSC)
  )

  // Standard Flux battery SC is allocated Peak first, then Day, then Flux.
  const reducedPeakBatteryGC = consumption * 0.9 * profile.peak
  const reducedDayBatteryGC = consumption * 0.9 * profile.day

  const peakBatterySC = Math.min(
    cappedBatterySC,
    nonNegative(reducedPeakBatteryGC - peakSolarSC)
  )
  const dayBatterySC = Math.min(
    nonNegative(cappedBatterySC - peakBatterySC),
    nonNegative(reducedDayBatteryGC - daySolarSC)
  )
  const fluxBatterySC = nonNegative(
    cappedBatterySC - peakBatterySC - dayBatterySC
  )

  const solarBenefit = cappedSolarSC * currentImport
  const batterySelfConsumptionBenefit =
    (peakBatterySC + dayBatterySC + fluxBatterySC) * currentImport

  // Standard Flux force-charge capacity.
  const fcBatteryCapacity = nonNegative(
    battery * dod * rte * 365 - cannibalism
  )

  const fluxImportCapacity = Math.min(
    nonNegative(fcBatteryCapacity - cappedBatterySC),
    nonNegative(inverterFluxCapacity - consumption * profile.flux)
  )

  const peakExportCapacity = Math.min(
    fluxImportCapacity,
    nonNegative(inverterFluxCapacity - consumption * profile.peak)
  )

  const peakDemandAfterSC = Math.min(
    nonNegative(fluxImportCapacity - peakExportCapacity),
    nonNegative(
      consumption * profile.peak - peakSolarSC - peakBatterySC
    )
  )

  const dayDemandAfterSC = Math.min(
    nonNegative(
      fluxImportCapacity - peakExportCapacity - peakDemandAfterSC
    ),
    nonNegative(
      consumption * profile.day - daySolarSC - dayBatterySC
    )
  )

  const fluxDemandAfterSC = Math.min(
    nonNegative(
      fluxImportCapacity - peakExportCapacity - peakDemandAfterSC - dayDemandAfterSC
    ),
    nonNegative(consumption * profile.flux - fluxBatterySC)
  )

  const fluxExportCostToCharge = fluxImportCapacity * newFluxImport
  const fluxDemandCostToCharge =
    (peakDemandAfterSC + dayDemandAfterSC + fluxDemandAfterSC) * newFluxImport

  const peakExportBenefit =
    peakExportCapacity * newPeakExport - fluxExportCostToCharge

  const peakDemandSavings =
    peakDemandAfterSC * (currentImport - newFluxImport)
  const dayDemandSavings =
    dayDemandAfterSC * (currentImport - dayImport)
  const fluxDemandSavings =
    fluxDemandAfterSC * (currentImport - newFluxImport)

  const forceChargeBenefit =
    peakDemandSavings + dayDemandSavings + fluxDemandSavings

  // Residual solar export plus the peak force-charge export.
  const cappedExportKwh = Math.min(
    nonNegative(inverterExportCapacity - cappedSolarSC - cappedBatterySC),
    nonNegative(
      gen + existingExportKwh - cappedSolarSC - cappedBatterySC
    )
  )

  const residualExportBenefit =
    cappedExportKwh * dayExport - existingExportKwh * currentExport

  const exportBenefit = residualExportBenefit + peakExportBenefit
  const exportKwh = cappedExportKwh + peakExportCapacity

  const unmetPeakKwh = nonNegative(
    consumption * profile.peak -
    peakSolarSC -
    peakBatterySC -
    peakDemandAfterSC
  )
  const unmetDayKwh = nonNegative(
    consumption * profile.day -
    daySolarSC -
    dayBatterySC -
    dayDemandAfterSC
  )
  const unmetFluxKwh = nonNegative(
    consumption * profile.flux -
    fluxBatterySC -
    fluxDemandAfterSC
  )

  // EPVS bill before/after installation.
  const billPreInstall =
    consumption * currentImport +
    currentStanding * 365 -
    existingExportKwh * currentExport

  const billPostInstall =
    unmetPeakKwh * peakImport +
    unmetDayKwh * dayImport +
    unmetFluxKwh * newFluxImport +
    fluxExportCostToCharge +
    fluxDemandCostToCharge +
    newStanding * 365

  const annualSaving = billPreInstall - billPostInstall

  return {
    profile,
    inverterSolarSCCapacity,
    inverterBatterySCCapacity,
    inverterExportCapacity,
    inverterFluxCapacity,
    cappedSolarSC,
    peakSolarSC,
    daySolarSC,
    cappedBatterySC,
    peakBatterySC,
    dayBatterySC,
    fluxBatterySC,
    batterySCCapacity,
    fcBatteryCapacity,
    fluxImportCapacity,
    peakExportCapacity,
    peakDemandAfterSC,
    dayDemandAfterSC,
    fluxDemandAfterSC,
    fluxExportCostToCharge,
    fluxDemandCostToCharge,
    peakDemandSavings,
    dayDemandSavings,
    fluxDemandSavings,
    peakExportBenefit,
    residualExportBenefit,
    solarBenefit,
    batterySelfConsumptionBenefit,
    forceChargeBenefit,
    exportBenefit,
    cappedExportKwh,
    exportKwh,
    unmetPeakKwh,
    unmetDayKwh,
    unmetFluxKwh,
    billPreInstall,
    billPostInstall,
    annualSaving,
  }
}

export default function EPVSCalculator({
  appointment,
  onCalculationChange,
}) {
  const [step, setStep] = useState(0)
  const [loadingFluxRates, setLoadingFluxRates] = useState(false)
  const [fluxRateError, setFluxRateError] = useState("")
  const [savingCalculation, setSavingCalculation] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")
  const [saveError, setSaveError] = useState("")

  const appointmentInitial = useMemo(() => {
    const saved = appointment?.epvs_calculation?.data || {}

    return {
      ...initial,
      ...saved,

      customerName:
        saved.customerName ||
        appointment?.name ||
        "",

      address:
        saved.address ||
        appointment?.address ||
        "",

      postcode:
        saved.postcode ||
        appointment?.postcode ||
        "",
    }
  }, [appointment])

  const [data, setData] =
    useState(appointmentInitial)

  useEffect(() => {
    setData(appointmentInitial)
  }, [appointmentInitial])

  const update = (key, value) => {
    setData((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const getCurrentFluxRates = async () => {
    const postcode = String(data.postcode || "").trim()

    if (!postcode) {
      setFluxRateError("Enter the customer postcode first.")
      return
    }

    setLoadingFluxRates(true)
    setFluxRateError("")

    try {
      const response = await fetch("/api/octopus-flux", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ postcode }),
      })

      const payload = await response.json()

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Unable to retrieve Octopus Flux rates.")
      }

      setData((current) => ({
        ...current,
        tariff: "Standard Flux",
        // The API returns dayImport/offPeakImport/peakImport,
        // while the calculator stores them as fluxDayImport/fluxImport/fluxPeakImport.
        fluxDayImport: Number(payload.rates?.dayImport ?? current.fluxDayImport),
        fluxDayExport: Number(payload.rates?.dayExport ?? current.fluxDayExport),
        fluxImport: Number(payload.rates?.offPeakImport ?? current.fluxImport),
        fluxExport: Number(payload.rates?.offPeakExport ?? current.fluxExport),
        fluxPeakImport: Number(payload.rates?.peakImport ?? current.fluxPeakImport),
        fluxPeakExport: Number(payload.rates?.peakExport ?? current.fluxPeakExport),
        fluxStandingCharge: Number(payload.rates?.standingCharge ?? current.fluxStandingCharge),
        fluxRatesRetrievedAt: payload.retrievedAt || new Date().toISOString(),
        fluxGsp: payload.gspGroupId || current.fluxGsp || "",
        fluxImportTariffCode: payload.tariff?.import || current.fluxImportTariffCode || "",
        fluxExportTariffCode: payload.tariff?.export || current.fluxExportTariffCode || "",
      }))
    } catch (error) {
      console.error("Flux rate lookup failed", error)
      setFluxRateError(error?.message || "Unable to retrieve Octopus Flux rates.")
    } finally {
      setLoadingFluxRates(false)
    }
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

  // Keep each array's EPVS Kk / irradiance figure in sync automatically
  // with the customer's postcode, roof pitch and orientation. The workbook
  // supports 3 installed arrays in this CRM; the hardware configuration is
  // intentionally capped at 3.
  useEffect(() => {
    const zone = getEpvsZone(data.postcode)
    if (!zone) return

    setData((current) => {
      let changed = false

      const arrays = current.arrays.map((array) => {
        const kk = getIrradiance(
          zone,
          array.pitch,
          array.orientation
        )

        const roundedKk = Number(kk.toFixed(2))

        if (Number(array.irradiance || 0) === roundedKk) {
          return array
        }

        changed = true
        return {
          ...array,
          irradiance: roundedKk,
        }
      })

      return changed
        ? { ...current, arrays }
        : current
    })
  }, [
    data.postcode,
    JSON.stringify(
      data.arrays.map((array) => ({
        pitch: array.pitch,
        orientation: array.orientation,
      }))
    ),
  ])

  /*
   * =========================================================
   * CALCULATIONS
   * =========================================================
   */

  const results = useMemo(() => {
    const numberOfArrays = Math.min(
      3,
      Math.max(1, Number(data.numberOfArrays || 1))
    )

    const activeArrays = data.arrays.slice(0, numberOfArrays)

    const calculatedArrays = activeArrays.map((array, index) => {
      const panelWattage = Number(array.panelWattage || 0)
      const panelCount = Number(array.panelCount || 0)
      const irradiance = Number(array.irradiance || 0)
      const shading = Number(array.shading || 0)
      const systemSize = (panelWattage * panelCount) / 1000
      const generation = systemSize * irradiance * shading

      return {
        ...array,
        arrayNumber: index + 1,
        systemSize,
        generation,
      }
    })

    const systemSize = calculatedArrays.reduce(
      (total, array) => total + array.systemSize,
      0
    )
    const generation = calculatedArrays.reduce(
      (total, array) => total + array.generation,
      0
    )

    const sapZone = getSapZone(data.postcode, data.sapZone)

    const model = calculateStandardFluxYear({
      generation,
      annualConsumption: Number(data.annualConsumption || 0),
      inverterCapacity: Number(data.inverterCapacity || 0),
      inverterEuEfficiency: Number(data.inverterEuEfficiency || 0),
      batteryCapacity: Number(data.batteryCapacity || 0),
      batteryDoD: Number(data.batteryDoD || 0),
      batteryRTE: Number(data.batteryRTE || 0),
      currentImportPence: Number(data.importRate || 0),
      currentExportPence: Number(data.exportRate || 0),
      currentStandingPence: Number(data.standingCharge || 0),
      fluxDayImport: Number(data.fluxDayImport || 0),
      fluxDayExport: Number(data.fluxDayExport || 0),
      fluxImport: Number(data.fluxImport || 0),
      fluxExport: Number(data.fluxExport || 0),
      fluxPeakImport: Number(data.fluxPeakImport || 0),
      fluxPeakExport: Number(data.fluxPeakExport || 0),
      fluxStandingCharge: Number(data.fluxStandingCharge || 0),
      sunshineHours: sapZone.sunshine,
      existingGeneration: data.existingSolar
        ? Number(data.existingGeneration || 0)
        : 0,
      existingSolarSelfConsumption: data.existingSolar
        ? Number(data.existingSolarSelfConsumption || 0)
        : 0,
    })

    const financeAmount =
      data.paymentMethod === "Finance"
        ? Math.max(
            0,
            Number(data.systemCost || 0) - Number(data.deposit || 0)
          )
        : 0
    const months = Number(data.financeTerm || 0) * 12
    const monthlyPayment = monthlyPaymentForYear(data)
    const totalContractValue =
      data.paymentMethod === "Finance"
        ? Number(data.deposit || 0) + monthlyPayment * months
        : Number(data.systemCost || 0)

    return {
      numberOfArrays,
      arrays: calculatedArrays,
      systemSize,
      generation,
      solarSelfConsumption: model.cappedSolarSC,
      batteryContribution: model.cappedBatterySC,
      exportKwh: model.exportKwh,
      gridReduction:
        model.cappedSolarSC +
        model.cappedBatterySC +
        model.peakDemandAfterSC +
        model.dayDemandAfterSC +
        model.fluxDemandAfterSC,
      solarBenefit: model.solarBenefit,
      batterySelfConsumptionBenefit: model.batterySelfConsumptionBenefit,
      forceChargeBenefit: model.forceChargeBenefit,
      exportBenefit: model.exportBenefit,
      annualSaving: model.annualSaving,
      monthlyPayment,
      financeAmount,
      totalContractValue,
      simplePayback:
        model.annualSaving > 0
          ? totalContractValue / model.annualSaving
          : null,
      billPreInstall: model.billPreInstall,
      billPostInstall: model.billPostInstall,
      model,
      sapZone,
      profile: model.profile,
    }
  }, [data])

  const thirtyYearProjection = useMemo(() => {
    const systemCost = Number(data.systemCost || 0)
    const deposit = Number(data.deposit || 0)
    const panelDegradation = Math.max(0, Number(data.solarDegradation || 0) / 100)
    const panelWarrantyYears = Math.max(1, Number(data.solarWarrantyYears || 30))
    const batteryDegradation = Math.max(0, Number(data.batteryDegradation || 0) / 100)
    const batteryWarrantyYears = Math.max(1, Number(data.batteryWarrantyYears || 10))

    const inflationScenarios = [
      { key: "noInflation", label: "0% inflation", rate: 0 },
      { key: "midpointInflation", label: "3.8% inflation", rate: 0.038 },
      { key: "averageInflation", label: "7.6% inflation", rate: 0.076 },
    ]

    const buildScenario = (inflationRate) => {
      const rows = []
      let cumulativePosition = 0

      for (let year = 1; year <= 30 && year <= panelWarrantyYears; year++) {
        const solarFactor = Math.pow(1 - panelDegradation, year - 1)
        const generation = Number(results.generation || 0) * solarFactor

        const existingGeneration = data.existingSolar
          ? Number(data.existingGeneration || 0) * Math.pow(1 - 0.00925, year - 1)
          : 0

        const batteryYear = (year - 1) % batteryWarrantyYears
        const batteryFactor = Math.max(0, 1 - batteryDegradation * batteryYear)
        const batteryCapacity = Number(data.batteryCapacity || 0) * batteryFactor

        const inflationMultiplier = Math.pow(1 + inflationRate, year - 1)

        const currentImportPence = Number(data.importRate || 0) * inflationMultiplier
        const currentExportPence = Number(data.exportRate || 0)
        const fluxDayImport = Number(data.fluxDayImport || 0) * inflationMultiplier
        const fluxDayExport = Number(data.fluxDayExport || 0) * inflationMultiplier
        const fluxImport = Number(data.fluxImport || 0) * inflationMultiplier
        const fluxExport = Number(data.fluxExport || 0) * inflationMultiplier
        const fluxPeakImport = Number(data.fluxPeakImport || 0) * inflationMultiplier
        const fluxPeakExport = Number(data.fluxPeakExport || 0) * inflationMultiplier

        const yearModel = calculateStandardFluxYear({
          generation,
          annualConsumption: Number(data.annualConsumption || 0),
          inverterCapacity: Number(data.inverterCapacity || 0),
          inverterEuEfficiency: Number(data.inverterEuEfficiency || 0),
          batteryCapacity,
          batteryDoD: Number(data.batteryDoD || 0),
          batteryRTE: Number(data.batteryRTE || 0),
          currentImportPence,
          currentExportPence,
          currentStandingPence: Number(data.standingCharge || 0),
          fluxDayImport,
          fluxDayExport,
          fluxImport,
          fluxExport,
          fluxPeakImport,
          fluxPeakExport,
          fluxStandingCharge: Number(data.fluxStandingCharge || 0),
          sunshineHours: getSapZone(data.postcode, data.sapZone).sunshine,
          existingGeneration,
          existingSolarSelfConsumption: data.existingSolar
            ? Number(data.existingSolarSelfConsumption || 0)
            : 0,
        })

        const financeAnnualPayment =
          data.paymentMethod === "Finance" && year <= Number(data.financeTerm || 0)
            ? monthlyPaymentForYear(data) * 12
            : 0

        const yearlyPayment =
          data.paymentMethod === "Finance"
            ? financeAnnualPayment + (year === 1 ? deposit : 0)
            : year === 1
              ? Math.max(0, systemCost - deposit)
              : 0

        const netAnnualBenefit = yearModel.annualSaving - yearlyPayment
        cumulativePosition += netAnnualBenefit

        rows.push({
          year,
          generation,
          solar: yearModel.solarBenefit,
          battery:
            yearModel.batterySelfConsumptionBenefit +
            yearModel.forceChargeBenefit,
          exportKwh: yearModel.exportKwh,
          exportBenefit: yearModel.exportBenefit,
          solarBenefit: yearModel.solarBenefit,
          batteryBenefit:
            yearModel.batterySelfConsumptionBenefit +
            yearModel.forceChargeBenefit,
          batterySelfConsumptionBenefit: yearModel.batterySelfConsumptionBenefit,
          forceChargeBenefit: yearModel.forceChargeBenefit,
          annualBenefit: yearModel.annualSaving,
          annualSaving: yearModel.annualSaving,
          yearlyPayment: -yearlyPayment,
          payment: yearlyPayment,
          netAnnualBenefit,
          cumulativePosition,
          billPreInstall: yearModel.billPreInstall,
          billPostInstall: yearModel.billPostInstall,
          solarSelfConsumptionKwh: yearModel.cappedSolarSC,
          batterySelfConsumptionKwh: yearModel.cappedBatterySC,
          peakSolarSC: yearModel.peakSolarSC,
          daySolarSC: yearModel.daySolarSC,
          peakBatterySC: yearModel.peakBatterySC,
          dayBatterySC: yearModel.dayBatterySC,
          fluxBatterySC: yearModel.fluxBatterySC,
          peakDemandAfterSC: yearModel.peakDemandAfterSC,
          dayDemandAfterSC: yearModel.dayDemandAfterSC,
          fluxDemandAfterSC: yearModel.fluxDemandAfterSC,
          peakExportCapacity: yearModel.peakExportCapacity,
          fluxImportCapacity: yearModel.fluxImportCapacity,
          importRateYear: currentImportPence,
          fluxDayImportYear: fluxDayImport,
          fluxImportYear: fluxImport,
          fluxPeakImportYear: fluxPeakImport,
          exportRateYear: fluxDayExport,
          fluxDayExportYear: fluxDayExport,
          billSaving: yearModel.annualSaving,
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
          total.payment += row.payment
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
          payment: 0,
          netAnnualBenefit: 0,
          billPreInstall: 0,
          billPostInstall: 0,
        }
      )

      const paybackRow = rows.find((row) => row.cumulativePosition >= 0)

      return {
        inflationRate,
        rows,
        totals,
        paybackPeriod: paybackRow?.year || null,
        totalNetSavings: totals.netAnnualBenefit,
        finalNetPosition: rows[rows.length - 1]?.cumulativePosition || 0,
        totalNetReturn: totals.netAnnualBenefit,
        totalContractValue:
          data.paymentMethod === "Finance"
            ? Number(data.deposit || 0) +
              monthlyPaymentForYear(data) *
                Number(data.financeTerm || 0) *
                12
            : systemCost,
      }
    }

    const scenarios = {}
    inflationScenarios.forEach((scenario) => {
      scenarios[scenario.key] = buildScenario(scenario.rate)
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

  const saveCalculation = async () => {
    const appointmentRowId = appointment?.appointment_row_id

    if (!appointmentRowId) {
      setSaveError("This appointment does not have an appointment ID, so the calculation cannot be saved.")
      return
    }

    setSavingCalculation(true)
    setSaveMessage("")
    setSaveError("")

    try {
      const payload = {
        version: 1,
        savedAt: new Date().toISOString(),
        data,
        results,
        thirtyYearProjection,
      }

      const { error } = await supabase
        .from("appointments")
        .update({ epvs_calculation: payload })
        .eq("appointment_row_id", appointmentRowId)

      if (error) throw error

      setSaveMessage(`Saved ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`)
    } catch (err) {
      console.error("Error saving EPVS calculation:", err)
      setSaveError(err?.message || "Unable to save EPVS calculation.")
    } finally {
      setSavingCalculation(false)
    }
  }

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
                    value={data.importRate}
                    onChange={(value) => update("importRate", value)}
                    min={0}
                    step={0.01}
                  />
                  <Input
                    label="Current export rate (p/kWh)"
                    type="number"
                    value={data.exportRate}
                    onChange={(value) => update("exportRate", value)}
                    min={0}
                    step={0.01}
                  />
                  <Input
                    label="Current standing charge (p/day)"
                    type="number"
                    value={data.standingCharge}
                    onChange={(value) => update("standingCharge", value)}
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
                  {data.existingSolar && (
                    <Input
                      label="Existing solar self-consumption (%)"
                      type="number"
                      value={data.existingSolarSelfConsumption}
                      onChange={(value) => update("existingSolarSelfConsumption", value)}
                      min={0}
                      max={100}
                      step={1}
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
                            label="Irradiance / Kk figure (EPVS)"
                            type="number"
                            value={
                              array.irradiance
                            }
                            disabled
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

            <div style={{ marginTop: 18, padding: 16, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#172554" }}>EPVS panel assumptions</h3>
              <div style={styles.grid}>
                <Input
                  label="Annual panel degradation (%)"
                  type="number"
                  value={data.solarDegradation}
                  onChange={(value) => update("solarDegradation", value)}
                  min={0}
                  max={10}
                  step={0.01}
                />
                <Input
                  label="Panel performance warranty (years)"
                  type="number"
                  value={data.solarWarrantyYears}
                  onChange={(value) => update("solarWarrantyYears", value)}
                  min={1}
                  max={40}
                  step={1}
                />
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 11, color: "#64748b" }}>Enter manufacturer figures where available. The projection is limited to the stated performance warranty.</p>
            </div>
          </Card>
        )}

        {/* =================================================
            BATTERY & INVERTER
            ================================================= */}

        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Card
              title="Battery"
              subtitle="Configure the proposed battery."
            >
              <div style={styles.grid}>
                <label style={styles.field}>
                  <span>Battery configuration</span>

                  <select
                    value={data.batteryCapacity}
                    onChange={(event) =>
                      update(
                        "batteryCapacity",
                        event.target.value === ""
                          ? ""
                          : Number(event.target.value)
                      )
                    }
                  >
                    <option value="">Select battery</option>
                    <option value={0}>No battery</option>
                    <option value={5.12}>1 × 5.12 kWh</option>
                    <option value={10.24}>2 × 5.12 kWh</option>
                    <option value={15.36}>3 × 5.12 kWh</option>
                    <option value={9.4}>1 × 9.4 kWh</option>
                    <option value={18.8}>2 × 9.4 kWh</option>
                    <option value={28.2}>3 × 9.4 kWh</option>
                  </select>
                </label>
              </div>
            </Card>

            <Card
              title="Inverter"
              subtitle="Configure the inverter capacity."
            >
              <div style={styles.grid}>
                <label style={styles.field}>
                  <span>Inverter capacity (kW)</span>

                  <select
                    value={data.inverterCapacity}
                    onChange={(event) =>
                      update(
                        "inverterCapacity",
                        event.target.value === ""
                          ? ""
                          : Number(event.target.value)
                      )
                    }
                  >
                    <option value="">Select inverter</option>
                    <option value={3.7}>3.7 kW</option>
                    <option value={6}>6 kW</option>
                    <option value={7}>7 kW</option>
                    <option value={10}>10 kW</option>
                  </select>
                </label>
              </div>
            </Card>

            <Card
              title="EPVS battery & inverter assumptions"
              subtitle="Manufacturer figures are preferred; EPVS defaults are shown where manufacturer data is unavailable."
            >
              <div style={styles.grid}>
                <Input label="Battery DoD (%)" type="number" value={data.batteryDoD} onChange={(value) => update("batteryDoD", value)} min={0} max={100} step={1} />
                <Input label="Battery round-trip efficiency (%)" type="number" value={data.batteryRTE} onChange={(value) => update("batteryRTE", value)} min={0} max={100} step={1} />
                <Input label="Battery degradation (% / year)" type="number" value={data.batteryDegradation} onChange={(value) => update("batteryDegradation", value)} min={0} max={20} step={0.1} />
                <Input label="Battery warranty (years)" type="number" value={data.batteryWarrantyYears} onChange={(value) => update("batteryWarrantyYears", value)} min={1} max={30} step={1} />
                <Input label="Inverter EU efficiency (%)" type="number" value={data.inverterEuEfficiency} onChange={(value) => update("inverterEuEfficiency", value)} min={0} max={100} step={0.1} />
                <label style={styles.field}>
                  <span>EPVS SAP region</span>
                  <select value={data.sapZone || inferSapZone(data.postcode)} onChange={(event) => update("sapZone", event.target.value)}>
                    {SAP_ZONES.map((zone) => (
                      <option key={zone.code} value={zone.code}>Zone {zone.code} - {zone.name} ({zone.sunshine.toFixed(2)} h/day)</option>
                    ))}
                  </select>
                </label>
              </div>
            </Card>
          </div>
        )}

        {/* =================================================
            TARIFF
            ================================================= */}

        {step === 3 && (
          <Card
            title="New Octopus Standard Flux"
            subtitle="Enter the current Flux rates from the Octopus Energy website."
          >
            <div
              style={{
                marginBottom: 18,
                padding: 16,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: "#172554", marginBottom: 5 }}>
                    Get current Octopus Flux rates
                  </div>
                  <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                    Uses the customer postcode to identify the electricity region and retrieves the current Flux import and export rates from Octopus.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={getCurrentFluxRates}
                  disabled={loadingFluxRates}
                  style={{
                    ...styles.primary,
                    opacity: loadingFluxRates ? 0.65 : 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  <RotateCcw size={15} />
                  {loadingFluxRates ? "Getting rates…" : "Get current rates"}
                </button>
              </div>

              {data.fluxRatesRetrievedAt && (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: "1px solid #e2e8f0",
                    display: "flex",
                    gap: 14,
                    flexWrap: "wrap",
                    fontSize: 11,
                    color: "#64748b",
                  }}
                >
                  <span>
                    Retrieved {new Date(data.fluxRatesRetrievedAt).toLocaleString("en-GB")}
                  </span>
                  {data.fluxGsp && <span>GSP: {data.fluxGsp}</span>}
                </div>
              )}

              {fluxRateError && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#b91c1c",
                    fontSize: 12,
                  }}
                >
                  {fluxRateError}
                </div>
              )}

              <div
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  color: "#64748b",
                }}
              >
                Octopus Flux uses three daily periods: 02:00–05:00 off-peak, 05:00–16:00 and 19:00–02:00 standard, and 16:00–19:00 peak. Rates are retrieved automatically from Octopus and are locked to prevent accidental changes.
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1fr",
                border: "1px solid #dbe3ec",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  background: "#f8fafc",
                  padding: "13px 16px",
                  fontWeight: 700,
                  fontSize: 12,
                  borderBottom: "1px solid #dbe3ec",
                }}
              >
                Rate
              </div>

              <div
                style={{
                  background: "#e2e2e2",
                  padding: "13px 16px",
                  fontWeight: 700,
                  fontSize: 12,
                  textAlign: "center",
                  borderBottom: "1px solid #dbe3ec",
                  borderLeft: "1px solid #dbe3ec",
                }}
              >
                Import
              </div>

              <div
                style={{
                  background: "#e2e2e2",
                  padding: "13px 16px",
                  fontWeight: 700,
                  fontSize: 12,
                  textAlign: "center",
                  borderBottom: "1px solid #dbe3ec",
                  borderLeft: "1px solid #dbe3ec",
                }}
              >
                Export
              </div>

              <div
                style={{
                  padding: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  borderBottom: "1px solid #dbe3ec",
                }}
              >
                Day Rate (p/kWh)
              </div>

              <div style={{ padding: 8, borderBottom: "1px solid #dbe3ec", borderLeft: "1px solid #dbe3ec" }}>
                <Input
                  label=""
                  type="number"
                  value={data.fluxDayImport}
                  readOnly
                  onChange={(value) => update("fluxDayImport", value)}
                  min={0}
                  step={0.01}
                />
              </div>

              <div style={{ padding: 8, borderBottom: "1px solid #dbe3ec", borderLeft: "1px solid #dbe3ec" }}>
                <Input
                  label=""
                  type="number"
                  value={data.fluxDayExport}
                  readOnly
                  onChange={(value) => update("fluxDayExport", value)}
                  min={0}
                  step={0.01}
                />
              </div>

              <div
                style={{
                  padding: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  borderBottom: "1px solid #dbe3ec",
                }}
              >
                Flux Rate (p/kWh)
              </div>

              <div style={{ padding: 8, borderBottom: "1px solid #dbe3ec", borderLeft: "1px solid #dbe3ec" }}>
                <Input
                  label=""
                  type="number"
                  value={data.fluxImport}
                  readOnly
                  onChange={(value) => update("fluxImport", value)}
                  min={0}
                  step={0.01}
                />
              </div>

              <div style={{ padding: 8, borderBottom: "1px solid #dbe3ec", borderLeft: "1px solid #dbe3ec" }}>
                <Input
                  label=""
                  type="number"
                  value={data.fluxExport}
                  readOnly
                  onChange={(value) => update("fluxExport", value)}
                  min={0}
                  step={0.01}
                />
              </div>

              <div
                style={{
                  padding: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  borderBottom: "1px solid #dbe3ec",
                }}
              >
                Peak Rate (p/kWh)
              </div>

              <div style={{ padding: 8, borderBottom: "1px solid #dbe3ec", borderLeft: "1px solid #dbe3ec" }}>
                <Input
                  label=""
                  type="number"
                  value={data.fluxPeakImport}
                  readOnly
                  onChange={(value) => update("fluxPeakImport", value)}
                  min={0}
                  step={0.01}
                />
              </div>

              <div style={{ padding: 8, borderBottom: "1px solid #dbe3ec", borderLeft: "1px solid #dbe3ec" }}>
                <Input
                  label=""
                  type="number"
                  value={data.fluxPeakExport}
                  readOnly
                  onChange={(value) => update("fluxPeakExport", value)}
                  min={0}
                  step={0.01}
                />
              </div>

              <div
                style={{
                  padding: 12,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Standing Charge (p/day)
              </div>

              <div
                style={{
                  padding: 8,
                  gridColumn: "span 2",
                  borderLeft: "1px solid #dbe3ec",
                }}
              >
                <Input
                  label=""
                  type="number"
                  value={data.fluxStandingCharge}
                  readOnly
                  onChange={(value) =>
                    update("fluxStandingCharge", value)
                  }
                  min={0}
                  step={0.01}
                />
              </div>
            </div>
          </Card>
        )}

        {/* =================================================
            FINANCE
            ================================================= */}

        {step === 4 && (
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

        {step === 5 && (
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
          style={{
            ...styles.footer,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              marginRight: "auto",
              fontSize: 11,
              color: saveError ? "#b42318" : "#299d48",
              fontWeight: 600,
            }}
          >
            {saveError || saveMessage}
          </div>

          <button
            type="button"
            onClick={saveCalculation}
            disabled={savingCalculation}
            style={{
              ...styles.primary,
              opacity: savingCalculation ? 0.65 : 1,
              cursor: savingCalculation ? "default" : "pointer",
            }}
          >
            {savingCalculation ? "Saving..." : "Save calculation"}
          </button>

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
          EPVS methodology model
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
      "repeat(6, minmax(70px, 1fr))",
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
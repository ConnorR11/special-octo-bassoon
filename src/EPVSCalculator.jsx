import React, { useEffect, useMemo, useState } from "react"
import { supabase } from "./lib/supabase"

import {
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


const createArray = () => ({
  panelWattage: 460,
  panelCount: 0,
  orientation: 0,
  pitch: 30,
  irradiance: 0,
  shading: 1,
})

const initial = {
  customerName: "",
  address: "",
  postcode: "",

  annualConsumption: "",

  existingSolar: false,
  existingGeneration: 0,

  arrays: [
    createArray(),
    createArray(),
    createArray(),
  ],

  batteryCapacity: "",

  inverterCapacity: "",

  importRate: "",
  exportRate: "",
  standingCharge: "",

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

function OctopusLogo() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flexShrink: 0 }}
    >
      <path
        d="M24 5c-8.3 0-15 6.7-15 15v6.5c0 2.4-1.5 4.2-3.5 5.5C3.8 33.2 4.2 37 7 38.5c2.1 1.1 4.3.3 5.4-1.3.1 3.3 2.1 5.8 5 5.8 2.1 0 3.8-1.1 4.8-2.9 0.5 2.3 1.9 3.9 3.8 3.9s3.3-1.6 3.8-3.9c1 1.8 2.7 2.9 4.8 2.9 2.9 0 4.9-2.5 5-5.8 1.1 1.6 3.3 2.4 5.4 1.3 2.8-1.5 3.2-5.3 1.5-6.5-2-1.3-3.5-3.1-3.5-5.5V20C39 11.7 32.3 5 24 5Z"
        fill="#ff48d8"
      />
      <circle cx="18" cy="21" r="4.2" fill="#fff" />
      <circle cx="30" cy="21" r="4.2" fill="#fff" />
      <circle cx="18.8" cy="21" r="2.3" fill="#18005c" />
      <circle cx="30.8" cy="21" r="2.3" fill="#18005c" />
      <path
        d="M19 29c2.8 2.8 7.2 2.8 10 0"
        fill="none"
        stroke="#18005c"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  )
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
        value={value ?? ""}
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
  consumption * 0.9 -
  cappedSolarSC -
  existingGenerationSC
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
    peakExportCapacity * newPeakExport - fluxExportCostToCharge

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
  const [loadingFluxRates, setLoadingFluxRates] = useState(false)
  const [fluxRateError, setFluxRateError] = useState("")
  const [savingCalculation, setSavingCalculation] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")
  const [saveError, setSaveError] = useState("")

  const appointmentInitial = useMemo(() => {
    const saved = appointment?.epvs_calculation?.data || {}
    const savedArrays = Array.isArray(saved.arrays) ? saved.arrays : initial.arrays

    return {
      ...initial,
      ...saved,
      arrays: savedArrays,

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

  /*
   * =========================================================
   * CALCULATIONS
   * =========================================================
   */

  const results = useMemo(() => {
    const numberOfArrays = 3

    const activeArrays = data.arrays.slice(0, 3)

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
    if (!hasRequiredEnergyInputs) {
      setSaveError(
        "Please enter annual electricity consumption, current import rate, current export rate and current standing charge before saving the calculation."
      )
      return
    }

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

  const hasRequiredEnergyInputs =
    String(data.annualConsumption ?? "").trim() !== "" &&
    String(data.importRate ?? "").trim() !== "" &&
    String(data.exportRate ?? "").trim() !== "" &&
    String(data.standingCharge ?? "").trim() !== ""

  const reset = () => {
    setData(appointmentInitial)
  }

  return (
    <section>
      <div style={styles.wrapper}>

        {/* =================================================
            CUSTOMER & ENERGY
            ================================================= */}

                  <Card
            title="Energy"
            subtitle="Electricity usage and existing solar PV."
          >
            <div
              style={{
                border: "1px solid #dbe3ec",
                borderRadius: 10,
                overflow: "hidden",
                background: "#ffffff",
              }}
            >
              {/* ELECTRICITY */}
              <div
                style={{
                  padding: "12px 14px",
                  background: "#f8fafc",
                  borderBottom: "1px solid #dbe3ec",
                  color: "#172554",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Electricity
              </div>

              <div style={{ padding: 14 }}>
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

                {!hasRequiredEnergyInputs && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "8px 10px",
                      borderRadius: 7,
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      fontSize: 11,
                      color: "#92400e",
                    }}
                  >
                    Enter all four electricity values before continuing to the calculation.
                  </div>
                )}
              </div>

              {/* EXISTING SOLAR */}
              <div
                style={{
                  padding: "12px 14px",
                  background: "#f8fafc",
                  borderTop: "1px solid #dbe3ec",
                  borderBottom: "1px solid #dbe3ec",
                  color: "#172554",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Existing solar PV
              </div>

              <div style={{ padding: 14 }}>
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

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 12,
              marginTop: -4,
              marginBottom: 20,
              padding: "12px 0",
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
              disabled={savingCalculation || !hasRequiredEnergyInputs}
              style={{
                ...styles.primary,
                opacity: savingCalculation || !hasRequiredEnergyInputs ? 0.65 : 1,
                cursor: savingCalculation || !hasRequiredEnergyInputs ? "default" : "pointer",
              }}
            >
              {savingCalculation ? "Saving..." : "Save calculation"}
            </button>
          </div>

       {/* =================================================
    SOLAR PV
    ================================================= */}

<Card
  title="Solar PV arrays"
  subtitle="Enter the EPVS information for each roof / array."
>

  {/* ARRAYS TABLE */}

  <div
    style={{
      width: "100%",
      overflowX: "auto",
      border: "1px solid #dbe3ec",
      borderRadius: 10,
    }}
  >
    <table
      style={{
        width: "100%",
        minWidth: 1050,
        borderCollapse: "separate",
        borderSpacing: 0,
        fontSize: 12,
      }}
    >
      <thead>
        <tr
          style={{
            background: "#f8fafc",
          }}
        >
          <th
            style={{
              padding: "12px 10px",
              textAlign: "left",
              color: "#172554",
              fontWeight: 700,
              borderBottom: "1px solid #dbe3ec",
              whiteSpace: "nowrap",
            }}
          >
            Array
          </th>

          <th
            style={{
              padding: "12px 10px",
              textAlign: "left",
              color: "#172554",
              fontWeight: 700,
              borderBottom: "1px solid #dbe3ec",
              whiteSpace: "nowrap",
            }}
          >
            Panels
          </th>

          <th
            style={{
              padding: "12px 10px",
              textAlign: "left",
              color: "#172554",
              fontWeight: 700,
              borderBottom: "1px solid #dbe3ec",
              whiteSpace: "nowrap",
            }}
          >
            Panel Wp
          </th>

          <th
            style={{
              padding: "12px 10px",
              textAlign: "left",
              color: "#172554",
              fontWeight: 700,
              borderBottom: "1px solid #dbe3ec",
              whiteSpace: "nowrap",
            }}
          >
            Orientation °
          </th>

          <th
            style={{
              padding: "12px 10px",
              textAlign: "left",
              color: "#172554",
              fontWeight: 700,
              borderBottom: "1px solid #dbe3ec",
              whiteSpace: "nowrap",
            }}
          >
            Pitch °
          </th>

          <th
            style={{
              padding: "12px 10px",
              textAlign: "left",
              color: "#172554",
              fontWeight: 700,
              borderBottom: "1px solid #dbe3ec",
              whiteSpace: "nowrap",
            }}
          >
            Irradiance / Kk
          </th>

          <th
            style={{
              padding: "12px 10px",
              textAlign: "left",
              color: "#172554",
              fontWeight: 700,
              borderBottom: "1px solid #dbe3ec",
              whiteSpace: "nowrap",
            }}
          >
            Shade SF
          </th>

          <th
            style={{
              padding: "12px 10px",
              textAlign: "right",
              color: "#172554",
              fontWeight: 700,
              borderBottom: "1px solid #dbe3ec",
              whiteSpace: "nowrap",
            }}
          >
            System size
          </th>

          <th
            style={{
              padding: "12px 10px",
              textAlign: "right",
              color: "#172554",
              fontWeight: 700,
              borderBottom: "1px solid #dbe3ec",
              whiteSpace: "nowrap",
            }}
          >
            Generation
          </th>
        </tr>
      </thead>

      <tbody>
        {data.arrays
          .slice(0, 3)
          .map((array, index) => {
            const calculated = results.arrays[index];

            const inputStyle = {
              width: "100%",
              boxSizing: "border-box",
              padding: "9px 8px",
              border: "1px solid #cbd5e1",
              borderRadius: 7,
              background: "#f1f5f9",
              color: "#475569",
              fontSize: 12,
              outline: "none",
              cursor: "not-allowed",
            };

            const calculatedStyle = {
              padding: "9px 8px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 7,
              color: "#26783a",
              fontWeight: 700,
              textAlign: "right",
              whiteSpace: "nowrap",
            };

            return (
              <tr key={index}>
                {/* ARRAY */}

                <td
                  style={{
                    padding: "10px",
                    borderBottom:
                      index === 2
                        ? "none"
                        : "1px solid #e2e8f0",
                    fontWeight: 700,
                    color: "#172554",
                    whiteSpace: "nowrap",
                  }}
                >
                  Array {index + 1}
                </td>

                {/* PANELS */}

                <td
                  style={{
                    padding: "8px 6px",
                    borderBottom:
                      index === 2
                        ? "none"
                        : "1px solid #e2e8f0",
                  }}
                >
                  <input
                    type="number"
                    value={array.panelCount}
                    min={1}
                    style={inputStyle}
                    readOnly
                    aria-label="Panels"
                  />
                </td>

                {/* PANEL WATTAGE */}

                <td
                  style={{
                    padding: "8px 6px",
                    borderBottom:
                      index === 2
                        ? "none"
                        : "1px solid #e2e8f0",
                  }}
                >
                  <input
          type="number"
          value={460}
          readOnly
          aria-label="Panel wattage (Wp)"
          style={{
            ...inputStyle,
            background: "#f1f5f9",
            cursor: "not-allowed",
          }}
        />
                </td>

                {/* ORIENTATION */}

                <td
                  style={{
                    padding: "8px 6px",
                    borderBottom:
                      index === 2
                        ? "none"
                        : "1px solid #e2e8f0",
                  }}
                >
                  <input
                    type="number"
                    value={array.orientation}
                    min={-180}
                    max={180}
                    style={inputStyle}
                    readOnly
                    aria-label="Orientation"
                  />
                </td>

                {/* PITCH */}

                <td
                  style={{
                    padding: "8px 6px",
                    borderBottom:
                      index === 2
                        ? "none"
                        : "1px solid #e2e8f0",
                  }}
                >
                  <input
                    type="number"
                    value={array.pitch}
                    min={0}
                    max={90}
                    style={inputStyle}
                    readOnly
                    aria-label="Pitch"
                  />
                </td>

                {/* IRRADIANCE */}

                <td
                  style={{
                    padding: "8px 6px",
                    borderBottom:
                      index === 2
                        ? "none"
                        : "1px solid #e2e8f0",
                  }}
                >
                  <input
          type="number"
          value={array.irradiance}
          readOnly
          aria-label="Irradiance / Kk"
          style={{
            ...inputStyle,
            background: "#f1f5f9",
            cursor: "not-allowed",
          }}
        />
                </td>

                {/* SHADE FACTOR */}

                <td
                  style={{
                    padding: "8px 6px",
                    borderBottom:
                      index === 2
                        ? "none"
                        : "1px solid #e2e8f0",
                  }}
                >
                  <input
                    type="number"
                    value={array.shading}
                    min={0}
                    max={1}
                    step={0.01}
                    style={inputStyle}
                    readOnly
                    aria-label="Shade factor"
                  />
                </td>

                {/* SYSTEM SIZE */}

                <td
                  style={{
                    padding: "8px 10px",
                    borderBottom:
                      index === 2
                        ? "none"
                        : "1px solid #e2e8f0",
                  }}
                >
                  <div style={calculatedStyle}>
                    {calculated
                      ? `${Number(
                          calculated.systemSize || 0
                        ).toFixed(2)} kWp`
                      : "0.00 kWp"}
                  </div>
                </td>

                {/* GENERATION */}

                <td
                  style={{
                    padding: "8px 10px",
                    borderBottom:
                      index === 2
                        ? "none"
                        : "1px solid #e2e8f0",
                  }}
                >
                  <div style={calculatedStyle}>
                    {calculated
                      ? `${Math.round(
                          calculated.generation || 0
                        ).toLocaleString("en-GB")} kWh`
                      : "0 kWh"}
                  </div>
                </td>
              </tr>
            );
          })}
      </tbody>
  <tfoot>
    <tr style={{ background: "#e8f5eb", color: "#315b28" }}>
      <td
        colSpan={8}
        style={{
          padding: "14px 10px",
          borderTop: "1px solid #bbdfc1",
          fontWeight: 700,
        }}
      >
        <div style={{ fontSize: 12 }}>Total overall generation</div>
        <div
          style={{
            marginTop: 3,
            fontSize: 11,
            fontWeight: 500,
            color: "#4d7047",
          }}
        >
          {results.numberOfArrays} array
          {results.numberOfArrays !== 1 ? "s" : ""}
        </div>
      </td>
      <td
        style={{
          padding: "14px 10px",
          borderTop: "1px solid #bbdfc1",
          textAlign: "right",
          whiteSpace: "nowrap",
          fontSize: 16,
          fontWeight: 800,
          color: "#26783a",
        }}
      >
        {Number(results.generation || 0).toFixed(2)} kWh
      </td>
    </tr>
  </tfoot>
    </table>
  </div>


</Card>

        {/* =================================================
    BATTERY & INVERTER
    ================================================= */}

<Card
  title="Battery & Inverter"
  subtitle="Configure the proposed battery and inverter."
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

        {/* =================================================
            TARIFF
            ================================================= */}

                  <Card
            title={
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  width: "100%",
                }}
              >
                <span>Get current Octopus Flux rates</span>
                <button
                  type="button"
                  onClick={getCurrentFluxRates}
                  disabled={loadingFluxRates}
                  style={{
                    ...styles.primary,
                    opacity: loadingFluxRates ? 0.65 : 1,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <OctopusLogo />
                  {loadingFluxRates ? "Getting rates…" : "Get current rates"}
                </button>
              </span>
            }
            subtitle="Uses the customer postcode to identify the electricity region and retrieves the current Flux import and export rates from Octopus."
          >
            <div className="octopus-flux-card">
              <style>{`
                .octopus-flux-card input {
                  width: 100%;
                  box-sizing: border-box;
                  border: 1px solid #cbd5e1;
                  border-radius: 8px;
                  padding: 7px 10px;
                  font-family: inherit;
                  font-size: 12px;
                  background: #fff;
                  color: #172554;
                }

                .octopus-flux-card input[readonly] {
                  background: #f1f5f9;
                  color: #334155;
                }
              `}</style>

            {fluxRateError && (
              <div
                style={{
                  marginBottom: 12,
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%" }}>
                  <span>Rate</span>
                  {data.fluxRatesRetrievedAt && (
                    <span style={{ fontSize: 10, fontWeight: 500, color: "#64748b", whiteSpace: "nowrap" }}>
                      Retrieved {new Date(data.fluxRatesRetrievedAt).toLocaleString("en-GB")}
                    </span>
                  )}
                </div>
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
            </div>
          </Card>

        {/* =================================================
            FINANCE
            ================================================= */}

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

        {/* =================================================
            RESULTS
            ================================================= */}

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

        {/* =================================================
            FOOTER
            ================================================= */}

        <div
          style={{
            ...styles.footer,
            flexWrap: "wrap",
          }}
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

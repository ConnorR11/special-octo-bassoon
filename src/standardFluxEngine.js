// EPVS Standard Flux engine — Methodology v1.0 (May 2026)
// Calculation-only module. Generation/array irradiance must be supplied by OpenSolar.

const DAYS = 365
const SC_DAYS = 337
const DAYLIGHT = 0.375
const FLUX_HOURS = 3
const CANNIBALISM_PER_KWH = 3.25
const DEFAULT_DOD = 0.95
const DEFAULT_RTE = 0.94

export const SAP_SUNSHINE_HOURS = {
  "1": 4.27, "2": 4.44, "3": 4.67, "4": 4.75,
  "5E": 4.54, "5W": 4.31, "6": 4.11, "7E": 3.75,
  "7W": 4.31, "8E": 3.89, "8S": 3.59, "9E": 4.25,
  "9S": 3.97, "10": 3.82, "11": 4.07, "12": 4.41,
  "13": 4.05, "14": 3.38, "15": 4.00, "16": 3.97,
  "17": 3.42, "18": 3.44, "19": 3.32, "20": 3.17, "21": 3.50,
}

const n = (v) => Math.max(0, Number(v || 0))
const mn = (...v) => Math.min(...v.map(n))
const mx = (...v) => Math.max(0, ...v.map(n))
const pct = (v) => n(v) / 100
const pounds = (pence) => n(pence) / 100

export function fluxProfileForConsumption(consumption) {
  const k = n(consumption)
  if (k < 2000) return { day: 0.61, flux: 0.15, peak: 0.24 }
  if (k < 3000) return { day: 0.63, flux: 0.12, peak: 0.25 }
  if (k < 4000) return { day: 0.64, flux: 0.10, peak: 0.26 }
  if (k < 5000) return { day: 0.63, flux: 0.09, peak: 0.28 }
  if (k < 6000) return { day: 0.63, flux: 0.08, peak: 0.29 }
  if (k < 7000) return { day: 0.62, flux: 0.08, peak: 0.30 }
  if (k < 8000) return { day: 0.61, flux: 0.08, peak: 0.31 }
  if (k < 9000) return { day: 0.53, flux: 0.15, peak: 0.32 }
  if (k < 10000) return { day: 0.54, flux: 0.18, peak: 0.28 }
  if (k < 11000) return { day: 0.54, flux: 0.20, peak: 0.26 }
  if (k < 12000) return { day: 0.54, flux: 0.21, peak: 0.25 }
  if (k < 13000) return { day: 0.54, flux: 0.22, peak: 0.24 }
  if (k < 14000) return { day: 0.54, flux: 0.23, peak: 0.23 }
  if (k < 15000) return { day: 0.54, flux: 0.24, peak: 0.22 }
  return { day: 0.54, flux: 0.25, peak: 0.21 }
}

export function calculateInverterCapacities({ inverterCapacityKw, euEfficiency = 0.97, sunshineHours, offPeakHours = 21 }) {
  const kw = n(inverterCapacityKw)
  const eff = n(euEfficiency)
  const sun = n(sunshineHours)
  return {
    solarSC: kw * eff * sun * SC_DAYS,
    batterySC: kw * sun * SC_DAYS,
    export: kw * sun * DAYS,
    offPeak: kw * n(offPeakHours) * DAYS,
    flux: kw * FLUX_HOURS * DAYS,
  }
}

export function calculateBatteryCapacities({ batteryCapacityKwh, batteryDoD = DEFAULT_DOD, batteryRTE = DEFAULT_RTE }) {
  const capacity = n(batteryCapacityKwh)
  const usable = capacity * n(batteryDoD) * n(batteryRTE)
  const cannibalism = capacity * CANNIBALISM_PER_KWH
  return { cannibalism, sc: mx(usable * SC_DAYS - cannibalism), fc: mx(usable * DAYS - cannibalism) }
}

export function calculateAnnualBatteryDegradation({ endOfLifeFraction, warrantyYears, fallback = 0.025 }) {
  const eol = Number(endOfLifeFraction)
  const years = n(warrantyYears)
  return years > 0 && Number.isFinite(eol) && eol >= 0 && eol <= 1 ? (1 - eol) / years : n(fallback)
}

// EPVS 4.1.1
export function calculateGCSolarSC({ generationKwh, annualGridConsumptionKwh, inverterSolarSCCapacityKwh }) {
  const gen = n(generationKwh)
  if (!gen) return 0
  return mn(inverterSolarSCCapacityKwh, gen * Math.min(0.75, (n(annualGridConsumptionKwh) * DAYLIGHT) / gen))
}

// EPVS 4.2.1 for Standard Flux / single-rate system-potential savings.
export function calculateSPSolarSC({ generationKwh, inverterSolarSCCapacityKwh }) {
  return mn(inverterSolarSCCapacityKwh, n(generationKwh) * 0.75)
}

export function calculateExistingGenerationSC({ existingGenerationKwh, existingSolarSelfConsumptionPercent, annualGridConsumptionKwh }) {
  const gen = n(existingGenerationKwh)
  if (!gen) return 0
  const currentSC = pct(existingSolarSelfConsumptionPercent)
  return gen * Math.min(Math.max(0, 0.9 - currentSC), (n(annualGridConsumptionKwh) * 0.9) / gen)
}

// EPVS 4.1.2 — the four independent battery self-consumption limits.
export function calculateGCBatterySC({ generationKwh, annualGridConsumptionKwh, cappedSolarSCKwh, inverterBatterySCCapacityKwh, batterySCCapacityKwh, existingGenerationSCKwh = 0 }) {
  const gen = n(generationKwh)
  const gc = n(annualGridConsumptionKwh)
  const solarSC = n(cappedSolarSCKwh)
  const existingSC = n(existingGenerationSCKwh)
  return mn(gc * 0.9, gen * Math.max(0, 0.9 - (gen ? solarSC / gen : 0)), n(inverterBatterySCCapacityKwh) - solarSC, n(batterySCCapacityKwh), gc * 0.9 - existingSC)
}

// EPVS 4.2.2 system-potential battery baseline.
export function calculateSPBatterySC({ generationKwh, cappedSolarSCKwh, inverterBatterySCCapacityKwh, batterySCCapacityKwh, existingGenerationKwh = 0, existingSolarSelfConsumptionPercent = 0 }) {
  const gen = n(generationKwh)
  const solarSC = n(cappedSolarSCKwh)
  const solarPct = gen ? solarSC / gen : 0
  const existing = n(existingGenerationKwh)
  const existingPct = pct(existingSolarSelfConsumptionPercent)
  return mn(n(inverterBatterySCCapacityKwh) - solarSC, n(batterySCCapacityKwh), gen * Math.max(0, 0.9 - solarPct) + existing * Math.max(0, 0.9 - existingPct))
}

// EPVS 6.1 — one of the three Peak hours is treated as daylight.
export function allocateSolarSC({ cappedSolarSCKwh, annualGridConsumptionKwh, profile }) {
  const capped = n(cappedSolarSCKwh)
  const gc = n(annualGridConsumptionKwh)
  const gcPeak = Math.min(capped, gc * 0.75 * profile.peak * (1 / 3))
  const peak = Math.min(capped, Math.max(gcPeak, capped * profile.peak * (1 / 3)))
  return { peak, day: mx(capped - peak) }
}

// EPVS 6.2.2 / 6.3. Peak is prioritised, then Day, then Flux.
export function allocateBatterySC({ cappedBatterySCKwh, peakSolarSCKwh, daySolarSCKwh, annualGridConsumptionKwh, profile }) {
  const capped = n(cappedBatterySCKwh)
  const gc = n(annualGridConsumptionKwh)
  const reducedPeak = gc * 0.9 * profile.peak
  const reducedDay = gc * 0.9 * profile.day
  const peak = Math.min(capped, mx(reducedPeak - n(peakSolarSCKwh)))
  const day = Math.min(mx(capped - peak), mx(reducedDay - n(daySolarSCKwh)))
  return { peak, day, flux: mx(capped - peak - day) }
}

// EPVS 6.4 Standard Flux force charging.
export function calculateForceCharge({ annualGridConsumptionKwh, profile, cappedBatterySCKwh, fcBatteryCapacityKwh, inverterFluxCapacityKwh, peakSolarSCKwh, daySolarSCKwh, peakBatterySCKwh, dayBatterySCKwh, fluxBatterySCKwh, fluxImportRatePence, peakExportRatePence, currentImportRatePence, dayImportRatePence }) {
  const gc = n(annualGridConsumptionKwh)
  const fluxRate = pounds(fluxImportRatePence)
  const peakExportRate = pounds(peakExportRatePence)
  const currentRate = pounds(currentImportRatePence)
  const dayRate = pounds(dayImportRatePence)
  const importCapacity = mn(n(fcBatteryCapacityKwh) - n(cappedBatterySCKwh), n(inverterFluxCapacityKwh) - gc * profile.flux)
  const peakExportCapacity = mn(importCapacity, n(inverterFluxCapacityKwh) - gc * profile.peak)
  const peakDemand = Math.min(mx(importCapacity - peakExportCapacity), mx(gc * profile.peak - n(peakSolarSCKwh) - n(peakBatterySCKwh)))
  const dayDemand = Math.min(mx(importCapacity - peakExportCapacity - peakDemand), mx(gc * profile.day - n(daySolarSCKwh) - n(dayBatterySCKwh)))
  const fluxDemand = Math.min(mx(importCapacity - peakExportCapacity - peakDemand - dayDemand), mx(gc * profile.flux - n(fluxBatterySCKwh)))
  const exportChargeCost = importCapacity * fluxRate
  const demandChargeCost = (peakDemand + dayDemand + fluxDemand) * fluxRate
  const peakExportBenefit = peakExportCapacity * peakExportRate - exportChargeCost
  const peakDemandSavings = peakDemand * (currentRate - fluxRate)
  const dayDemandSavings = dayDemand * (currentRate - dayRate)
  const fluxDemandSavings = fluxDemand * (currentRate - fluxRate)
  return { importCapacity, peakExportCapacity, peakDemand, dayDemand, fluxDemand, exportChargeCost, demandChargeCost, peakExportBenefit, peakDemandSavings, dayDemandSavings, fluxDemandSavings, totalDemandSavings: peakDemandSavings + dayDemandSavings + fluxDemandSavings }
}

// EPVS 6.5 residual export. Kept separate from Peak Export Capacity.
export function calculateResidualExport({ generationKwh, existingGenerationKwh = 0, existingSolarSelfConsumptionPercent = 0, cappedSolarSCKwh, cappedBatterySCKwh, inverterExportCapacityKwh, dayExportRatePence, currentExportRatePence }) {
  const gen = n(generationKwh)
  const existingGen = n(existingGenerationKwh)
  const existingExport = existingGen * Math.max(0, 1 - pct(existingSolarSelfConsumptionPercent))
  const solarSC = n(cappedSolarSCKwh)
  const batterySC = n(cappedBatterySCKwh)
  const cappedExport = mn(n(inverterExportCapacityKwh) - solarSC - batterySC, gen + existingExport - solarSC - batterySC)
  return { cappedExportKwh: cappedExport, existingExportKwh: existingExport, netBenefit: cappedExport * pounds(dayExportRatePence) - existingExport * pounds(currentExportRatePence) }
}

/** Complete Standard Flux calculation. */
export function calculateStandardFlux(input) {
  const generation = n(input.generationKwh)
  const gc = n(input.annualGridConsumptionKwh)
  const inverterCapacityKw = n(input.inverterCapacityKw)
  const batteryCapacityKwh = n(input.batteryCapacityKwh)
  const euEfficiency = Number(input.inverterEuEfficiency ?? 97) > 1 ? pct(input.inverterEuEfficiency ?? 97) : n(input.inverterEuEfficiency ?? 0.97)
  const dod = Number(input.batteryDoD ?? 95) > 1 ? pct(input.batteryDoD ?? 95) : n(input.batteryDoD ?? DEFAULT_DOD)
  const rte = Number(input.batteryRTE ?? 94) > 1 ? pct(input.batteryRTE ?? 94) : n(input.batteryRTE ?? DEFAULT_RTE)
  const sunshineHours = n(input.sunshineHours ?? SAP_SUNSHINE_HOURS[String(input.sapZone ?? "14")] ?? SAP_SUNSHINE_HOURS["14"])
  const profile = fluxProfileForConsumption(gc)
  const inverter = calculateInverterCapacities({ inverterCapacityKw, euEfficiency, sunshineHours, offPeakHours: input.offPeakHours ?? 21 })
  const battery = calculateBatteryCapacities({ batteryCapacityKwh, batteryDoD: dod, batteryRTE: rte })

  const existingGenerationKwh = n(input.existingGenerationKwh)
  const existingSCPercent = n(input.existingSolarSelfConsumptionPercent)
  const existingGenerationSC = calculateExistingGenerationSC({ existingGenerationKwh, existingSolarSelfConsumptionPercent: existingSCPercent, annualGridConsumptionKwh: gc })

  const gcSolar = calculateGCSolarSC({ generationKwh: generation, annualGridConsumptionKwh: gc, inverterSolarSCCapacityKwh: inverter.solarSC })
  const spSolar = calculateSPSolarSC({ generationKwh: generation, inverterSolarSCCapacityKwh: inverter.solarSC })
  const gcBattery = calculateGCBatterySC({ generationKwh: generation, annualGridConsumptionKwh: gc, cappedSolarSCKwh: gcSolar, inverterBatterySCCapacityKwh: inverter.batterySC, batterySCCapacityKwh: battery.sc, existingGenerationSCKwh: existingGenerationSC })
  const spBattery = calculateSPBatterySC({ generationKwh: generation, cappedSolarSCKwh: spSolar, inverterBatterySCCapacityKwh: inverter.batterySC, batterySCCapacityKwh: battery.sc, existingGenerationKwh, existingSolarSelfConsumptionPercent: existingSCPercent })

  const gcSolarWindows = allocateSolarSC({ cappedSolarSCKwh: gcSolar, annualGridConsumptionKwh: gc, profile })
  const spSolarWindows = allocateSolarSC({ cappedSolarSCKwh: spSolar, annualGridConsumptionKwh: gc, profile })
  const gcBatteryWindows = allocateBatterySC({ cappedBatterySCKwh: gcBattery, peakSolarSCKwh: gcSolarWindows.peak, daySolarSCKwh: gcSolarWindows.day, annualGridConsumptionKwh: gc, profile })

  const forceCharge = calculateForceCharge({ annualGridConsumptionKwh: gc, profile, cappedBatterySCKwh: gcBattery, fcBatteryCapacityKwh: battery.fc, inverterFluxCapacityKwh: inverter.flux, peakSolarSCKwh: gcSolarWindows.peak, daySolarSCKwh: gcSolarWindows.day, peakBatterySCKwh: gcBatteryWindows.peak, dayBatterySCKwh: gcBatteryWindows.day, fluxBatterySCKwh: gcBatteryWindows.flux, fluxImportRatePence: input.fluxImportRatePence, peakExportRatePence: input.fluxPeakExportPence, currentImportRatePence: input.currentImportRatePence, dayImportRatePence: input.fluxDayImportPence })

  const residualExport = calculateResidualExport({ generationKwh: generation, existingGenerationKwh, existingSolarSelfConsumptionPercent: existingSCPercent, cappedSolarSCKwh: gcSolar, cappedBatterySCKwh: gcBattery, inverterExportCapacityKwh: inverter.export, dayExportRatePence: input.fluxDayExportPence, currentExportRatePence: input.currentExportRatePence })

  const currentRate = pounds(input.currentImportRatePence)
  const peakRate = pounds(input.fluxPeakImportPence)
  const dayRate = pounds(input.fluxDayImportPence)
  const fluxRate = pounds(input.fluxImportRatePence)
  const standing = pounds(input.fluxStandingChargePence)
  const solarBenefit = (gcSolarWindows.peak + gcSolarWindows.day) * currentRate
  const batteryBenefit = (gcBatteryWindows.peak + gcBatteryWindows.day + gcBatteryWindows.flux) * currentRate
  const unmetPeak = mx(gc * profile.peak - gcSolarWindows.peak - gcBatteryWindows.peak - forceCharge.peakDemand)
  const unmetDay = mx(gc * profile.day - gcSolarWindows.day - gcBatteryWindows.day - forceCharge.dayDemand)
  const unmetFlux = mx(gc * profile.flux - gcBatteryWindows.flux - forceCharge.fluxDemand)
  const billBefore = gc * currentRate + pounds(input.currentStandingChargePence) * DAYS - residualExport.existingExportKwh * pounds(input.currentExportRatePence)
  const billAfter = unmetPeak * peakRate + unmetDay * dayRate + unmetFlux * fluxRate + forceCharge.exportChargeCost + forceCharge.demandChargeCost + standing * DAYS

  return {
    tariff: "Standard Flux",
    numberOfStrings: Number(input.numberOfStrings || 0),
    generationKwh: generation,
    annualGridConsumptionKwh: gc,
    profile,
    sunshineHours,
    inverter,
    battery,
    existingGenerationSC,
    gc: { solarSC: gcSolar, peakSolarSC: gcSolarWindows.peak, daySolarSC: gcSolarWindows.day, batterySC: gcBattery, peakBatterySC: gcBatteryWindows.peak, dayBatterySC: gcBatteryWindows.day, fluxBatterySC: gcBatteryWindows.flux },
    sp: { solarSC: spSolar, peakSolarSC: spSolarWindows.peak, daySolarSC: spSolarWindows.day, batterySC: spBattery },
    forceCharge,
    export: residualExport,
    benefits: { solarSelfConsumption: solarBenefit, batterySelfConsumption: batteryBenefit, forceCharge: forceCharge.totalDemandSavings, peakExport: forceCharge.peakExportBenefit, residualExport: residualExport.netBenefit, total: solarBenefit + batteryBenefit + forceCharge.totalDemandSavings + forceCharge.peakExportBenefit + residualExport.netBenefit },
    bill: { before: billBefore, after: billAfter, annualSaving: billBefore - billAfter, unmetPeakKwh: unmetPeak, unmetDayKwh: unmetDay, unmetFluxKwh: unmetFlux },
  }
}

export default calculateStandardFlux

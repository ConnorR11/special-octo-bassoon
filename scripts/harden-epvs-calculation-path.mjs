import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
let text = fs.readFileSync(path, "utf8")

const old = `  const gen = nonNegative(generation)\n  const consumption = nonNegative(annualConsumption)\n  const inverter = nonNegative(inverterCapacity)\n  const euEfficiency = nonNegative(inverterEuEfficiency) / 100\n  const battery = nonNegative(batteryCapacity)\n  const dod = nonNegative(batteryDoD) / 100\n  const rte = nonNegative(batteryRTE) / 100\n  const sunshine = nonNegative(sunshineHours)\n  const profile = fluxProfileForConsumption(consumption)`

const replacement = `  const gen = nonNegative(generation)\n  const consumption = nonNegative(annualConsumption)\n\n  // OpenSolar values are authoritative when present. Keep the EPVS defaults\n  // only as a safety net when an API value is missing/invalid.\n  const inverter = nonNegative(inverterCapacity)\n  const rawEfficiency = Number(inverterEuEfficiency)\n  const euEfficiencyPercent = rawEfficiency > 0 && rawEfficiency <= 1\n    ? rawEfficiency * 100\n    : rawEfficiency\n  const euEfficiency = (euEfficiencyPercent > 0 ? euEfficiencyPercent : 97) / 100\n\n  const battery = nonNegative(batteryCapacity)\n  const rawDod = Number(batteryDoD)\n  const dodPercent = rawDod > 0 && rawDod <= 1 ? rawDod * 100 : rawDod\n  const dod = (dodPercent > 0 ? dodPercent : 95) / 100\n\n  const rawRte = Number(batteryRTE)\n  const rtePercent = rawRte > 0 && rawRte <= 1 ? rawRte * 100 : rawRte\n  const rte = (rtePercent > 0 ? rtePercent : 94) / 100\n\n  const rawSunshine = Number(sunshineHours)\n  const sunshine = rawSunshine > 0 ? rawSunshine : 3.38\n  const profile = fluxProfileForConsumption(consumption)`

if (!text.includes(old)) {
  if (text.includes("const rawEfficiency = Number(inverterEuEfficiency)")) {
    console.log("EPVS calculation hardening already applied.")
    process.exit(0)
  }
  throw new Error("Could not locate calculateStandardFluxYear input normalization")
}

text = text.replace(old, replacement)

// The inverter capacity itself must remain the OpenSolar value. If it is ever
// absent, don't invent a capacity; the calculation will correctly show zero
// rather than silently substituting the panel system size.
fs.writeFileSync(path, text)
console.log("EPVS calculation path hardened.")

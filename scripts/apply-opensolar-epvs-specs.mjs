import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
let text = fs.readFileSync(path, "utf8")
let next = text

const marker = `      batteryQuantity: Number(hardware?.battery?.quantity || 0),\n      inverterCapacity: Number(hardware?.inverter?.capacityKw || 0),`

const replacement = `      batteryQuantity: Number(hardware?.battery?.quantity || 0),\n      batteryDoD: Number.isFinite(Number(hardware?.battery?.depthOfDischargePercent)) && Number(hardware?.battery?.depthOfDischargePercent) > 0\n        ? Number(hardware.battery.depthOfDischargePercent)\n        : initial.batteryDoD,\n      batteryRTE: Number.isFinite(Number(hardware?.battery?.roundTripEfficiencyPercent)) && Number(hardware?.battery?.roundTripEfficiencyPercent) > 0\n        ? Number(hardware.battery.roundTripEfficiencyPercent)\n        : initial.batteryRTE,\n      batteryWarrantyYears: Number.isFinite(Number(hardware?.battery?.warrantyYears)) && Number(hardware?.battery?.warrantyYears) > 0\n        ? Number(hardware.battery.warrantyYears)\n        : initial.batteryWarrantyYears,\n      inverterCapacity: Number(hardware?.inverter?.capacityKw || 0),\n      inverterEuEfficiency: Number.isFinite(Number(hardware?.inverter?.efficiencyPercent)) && Number(hardware?.inverter?.efficiencyPercent) > 0\n        ? Number(hardware.inverter.efficiencyPercent)\n        : initial.inverterEuEfficiency,`

if (next.includes(marker)) {
  next = next.replace(marker, replacement)
} else if (!next.includes("batteryDoD: Number.isFinite(Number(hardware?.battery?.depthOfDischargePercent))")) {
  throw new Error("Could not locate the OpenSolar hardware state block")
}

// Never allow a missing/zero manufacturer efficiency value to zero the EPVS model.
next = next.replace(
  '  const euEfficiency = nonNegative(inverterEuEfficiency) / 100\n  const battery = nonNegative(batteryCapacity)\n  const dod = nonNegative(batteryDoD) / 100\n  const rte = nonNegative(batteryRTE) / 100',
  '  const euEfficiency = (nonNegative(inverterEuEfficiency) || 97) / 100\n  const battery = nonNegative(batteryCapacity)\n  const dod = (nonNegative(batteryDoD) || 95) / 100\n  const rte = (nonNegative(batteryRTE) || 94) / 100'
)

if (next === text) {
  console.log("OpenSolar EPVS performance specs already applied.")
  process.exit(0)
}

fs.writeFileSync(path, next)
console.log("OpenSolar EPVS performance specs and safe fallbacks applied.")

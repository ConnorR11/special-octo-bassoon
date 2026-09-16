import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
const text = fs.readFileSync(path, "utf8")

const marker = `      batteryQuantity: Number(hardware?.battery?.quantity || 0),\n      inverterCapacity: Number(hardware?.inverter?.capacityKw || 0),`

const replacement = `      batteryQuantity: Number(hardware?.battery?.quantity || 0),\n      batteryDoD: Number.isFinite(Number(hardware?.battery?.depthOfDischargePercent)) && Number(hardware?.battery?.depthOfDischargePercent) > 0\n        ? Number(hardware.battery.depthOfDischargePercent)\n        : current.batteryDoD,\n      batteryRTE: Number.isFinite(Number(hardware?.battery?.roundTripEfficiencyPercent)) && Number(hardware?.battery?.roundTripEfficiencyPercent) > 0\n        ? Number(hardware.battery.roundTripEfficiencyPercent)\n        : current.batteryRTE,\n      batteryWarrantyYears: Number.isFinite(Number(hardware?.battery?.warrantyYears)) && Number(hardware?.battery?.warrantyYears) > 0\n        ? Number(hardware.battery.warrantyYears)\n        : current.batteryWarrantyYears,\n      inverterCapacity: Number(hardware?.inverter?.capacityKw || 0),\n      inverterEuEfficiency: Number.isFinite(Number(hardware?.inverter?.efficiencyPercent)) && Number(hardware?.inverter?.efficiencyPercent) > 0\n        ? Number(hardware.inverter.efficiencyPercent)\n        : current.inverterEuEfficiency,`

if (!text.includes(marker)) {
  if (text.includes("batteryDoD: Number.isFinite(Number(hardware?.battery?.depthOfDischargePercent))")) {
    console.log("OpenSolar EPVS performance specs already applied.")
    process.exit(0)
  }
  throw new Error("Could not locate the OpenSolar hardware state block")
}

const next = text.replace(marker, replacement)
fs.writeFileSync(path, next)
console.log("OpenSolar EPVS performance specs applied.")

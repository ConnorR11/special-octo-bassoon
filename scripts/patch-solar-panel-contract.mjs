import fs from "node:fs"

const path = "src/contracts/GenerateSolarContract.js"
const text = fs.readFileSync(path, "utf8")

// The current contract already has the OpenSolar hardware panel model and
// quantity available. Make the itemised-breakdown replacement apply to any
// panel item name (for example "Panels", "Solar Panels", or "PV Module"),
// rather than only an exact item name of "panels".
const exactCurrent = 'const n=String(name).trim().toLowerCase();if(n==="panels"){name=panelHardware?.model||name;quantity=panelHardware?.quantity??getTotalPanelCount(data)}'
const replacement = 'if(isPanelItem(name,type)){name=panelHardware?.model||name;quantity=panelHardware?.quantity??getTotalPanelCount(data)}'

if (text.includes(exactCurrent)) {
  fs.writeFileSync(path, text.replace(exactCurrent, replacement))
  console.log("Updated solar contract Panels row to use the OpenSolar panel model and quantity.")
  process.exit(0)
}

// If the replacement is already present, leave the source unchanged so the
// build remains idempotent.
if (text.includes(replacement)) {
  console.log("Solar contract panel model/quantity logic already applied; nothing to change.")
  process.exit(0)
}

// Legacy fallback for an older unminified version of the contract.
const legacyMarker = "const marker = \"const items = configured.map(item => {\""
if (text.includes("function getPanelHardware(data)") && text.includes("isPanelItem(name,type)")) {
  console.log("Solar contract panel helpers are present; no compatible panel-row patch is required.")
  process.exit(0)
}

console.warn("Solar contract panel row patch did not find the expected source pattern; leaving the file unchanged.")

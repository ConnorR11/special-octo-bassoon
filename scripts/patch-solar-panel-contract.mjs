import fs from "node:fs"

const path = "src/contracts/GenerateSolarContract.js"
const text = fs.readFileSync(path, "utf8")

// The contract now contains the OpenSolar hardware panel logic directly.
// This script remains in the build chain for backwards compatibility, but
// must not try to re-patch the file using an outdated source-code pattern.
const panelLogicAlreadyPresent =
  text.includes("function getPanelHardware(data)") &&
  text.includes("panelHardware?.model") &&
  text.includes("panelHardware?.quantity")

if (panelLogicAlreadyPresent) {
  console.log("Solar contract panel model/quantity logic already applied; nothing to change.")
  process.exit(0)
}

// Keep a legacy fallback for versions of the contract that still have the
// original panel item logic. This is intentionally based on stable markers
// rather than the exact formatting of the JavaScript source.
const marker = "const items = configured.map(item => {"
const panelMarker = "if (isPanelItem(name, type)) quantity = panelCount"

if (!text.includes(marker) || !text.includes(panelMarker)) {
  throw new Error("Could not locate the panel item logic in GenerateSolarContract.js.")
}

const target = `${marker}\n    const name = typeof item === "string" ? item : item?.name ?? "—"\n    const type = typeof item === "string" ? "" : item?.type ?? ""\n    let quantity = typeof item === "string" ? 1 : item?.quantity ?? 1\n    const normalisedName = String(name).trim().toLowerCase()\n\n    ${panelMarker}`

if (!text.includes(target)) {
  throw new Error("Could not locate the legacy panel item block in GenerateSolarContract.js.")
}

const replacement = `const panelHardware = Array.isArray(data?.hardware?.panels) ? data.hardware.panels : []\n  const panelHardwareItem = panelHardware.find(item => String(item?.model || "").trim())\n  const panelModel = String(panelHardwareItem?.model || "").trim()\n  const panelHardwareQuantity = Number(panelHardwareItem?.quantity || 0)\n  const panelCount = panelHardwareQuantity > 0 ? panelHardwareQuantity : getTotalPanelCount(data)\n\n  ${marker}\n    const configuredName = typeof item === "string" ? item : item?.name ?? "—"\n    const type = typeof item === "string" ? "" : item?.type ?? ""\n    let name = configuredName\n    let quantity = typeof item === "string" ? 1 : item?.quantity ?? 1\n    const normalisedName = String(configuredName).trim().toLowerCase()\n\n    if (isPanelItem(configuredName, type)) {\n      quantity = panelCount\n      if (panelModel) name = panelModel\n    }`

const replaced = text.replace(target, replacement)
fs.writeFileSync(path, replaced)
console.log("Updated solar contract Panels row to use the OpenSolar panel model and quantity.")

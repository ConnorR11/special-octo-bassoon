import fs from "node:fs"

const path = "src/contracts/GenerateSolarContract.js"
const text = fs.readFileSync(path, "utf8")

if (text.includes("const panelHardware = Array.isArray(data?.hardware?.panels)")) {
  console.log("Solar contract panel model patch already applied; nothing to change.")
  process.exit(0)
}

const target = `  const panelCount = getTotalPanelCount(data)\n\n  const items = configured.map(item => {\n    const name = typeof item === "string" ? item : item?.name ?? "—"\n    const type = typeof item === "string" ? "" : item?.type ?? ""\n    let quantity = typeof item === "string" ? 1 : item?.quantity ?? 1\n    const normalisedName = String(name).trim().toLowerCase()\n\n    if (isPanelItem(name, type)) quantity = panelCount`

const replacement = `  const panelHardware = Array.isArray(data?.hardware?.panels) ? data.hardware.panels : []\n  const panelHardwareItem = panelHardware.find(item => String(item?.model || "").trim())\n  const panelModel = String(panelHardwareItem?.model || "").trim()\n  const panelHardwareQuantity = positiveNumber(panelHardwareItem?.quantity)\n  const panelCount = panelHardwareQuantity || getTotalPanelCount(data)\n\n  const items = configured.map(item => {\n    const configuredName = typeof item === "string" ? item : item?.name ?? "—"\n    const type = typeof item === "string" ? "" : item?.type ?? ""\n    let name = configuredName\n    let quantity = typeof item === "string" ? 1 : item?.quantity ?? 1\n    const normalisedName = String(configuredName).trim().toLowerCase()\n\n    if (isPanelItem(configuredName, type)) {\n      quantity = panelCount\n      if (panelModel) name = panelModel\n    }`

if (!text.includes(target)) {
  throw new Error("Could not locate the panel item logic in GenerateSolarContract.js.")
}

const replaced = text.replace(target, replacement)
fs.writeFileSync(path, replaced)
console.log("Updated solar contract Panels row to use the OpenSolar panel model and quantity.")

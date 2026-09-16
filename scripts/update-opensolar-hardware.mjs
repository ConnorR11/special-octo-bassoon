import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
const text = fs.readFileSync(path, "utf8")
let next = text

if (!next.includes("batteryManufacturer:")) {
  const marker = '  batteryCapacity: "",\n\n  inverterCapacity: "",'
  if (!next.includes(marker)) throw new Error("Could not locate battery/inverter initial state")
  next = next.replace(marker, '  batteryCapacity: "",\n  batteryManufacturer: "",\n  batteryModel: "",\n  batteryQuantity: 0,\n\n  inverterCapacity: "",\n  inverterManufacturer: "",\n  inverterModel: "",\n  inverterQuantity: 0,')
}

if (!next.includes("const importedHardware = payload?.hardware || {}")) {
  const importedPattern = /([ \t]*)const imported = Array\.isArray\(payload\?\.arrays\) \? payload\.arrays : \[\]/
  if (importedPattern.test(next)) next = next.replace(importedPattern, `$1const imported = Array.isArray(payload?.arrays) ? payload.arrays : []\n$1const importedHardware = payload?.hardware || {}`)
}

if (!next.includes('batteryManufacturer: String(importedHardware?.battery?.manufacturer || "")')) {
  const hardwarePattern = /([ \t]*)\.\.\.current,\n\1arrays:/
  if (hardwarePattern.test(next)) {
    next = next.replace(hardwarePattern, `$1...current,\n$1batteryCapacity: Number(importedHardware?.battery?.capacityKwh || 0),\n$1batteryManufacturer: String(importedHardware?.battery?.manufacturer || ""),\n$1batteryModel: String(importedHardware?.battery?.model || ""),\n$1batteryQuantity: Number(importedHardware?.battery?.quantity || 0),\n$1inverterCapacity: Number(importedHardware?.inverter?.capacityKw || 0),\n$1inverterManufacturer: String(importedHardware?.inverter?.manufacturer || ""),\n$1inverterModel: String(importedHardware?.inverter?.model || ""),\n$1inverterQuantity: Number(importedHardware?.inverter?.quantity || 0),\n$1arrays:`)
  }
}

const readOnlyBox = (label, manufacturer, model, capacity, unit, quantity, emptyText) => `    <label style={styles.field}>\n      <span>${label}</span>\n      <div style={{ minHeight: 44, boxSizing: "border-box", padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#172554", display: "flex", alignItems: "center", fontSize: 13, fontWeight: 600 }}>\n        {data.${manufacturer}\n          ? \`\${data.${manufacturer}} — \${data.${model} || "Unknown model"}\`\n          : data.${model} || "${emptyText}"}\n        {Number(data.${capacity} || 0) > 0 && (\n          <span style={{ marginLeft: 6, fontWeight: 500, color: "#64748b" }}>({Number(data.${capacity}).toFixed(1)} ${unit})</span>\n        )}\n        {Number(data.${quantity} || 0) > 1 && (\n          <span style={{ marginLeft: 6, fontWeight: 500, color: "#64748b" }}>× {Number(data.${quantity})}</span>\n        )}\n      </div>\n    </label>`

if (!next.includes('data.batteryModel || "No battery selected in OpenSolar"')) {
  const batteryRegex = /    <label style=\{styles\.field\}>\n      <span>Battery configuration<\/span>[\s\S]*?      <\/select>\n    <\/label>/
  const replacement = readOnlyBox("Battery configuration", "batteryManufacturer", "batteryModel", "batteryCapacity", "kWh", "batteryQuantity", "No battery selected in OpenSolar")
  if (batteryRegex.test(next)) next = next.replace(batteryRegex, replacement)
}

if (!next.includes('data.inverterModel || "No inverter selected in OpenSolar"')) {
  const inverterRegex = /    <label style=\{styles\.field\}>\n      <span>Inverter capacity \(kW\)<\/span>[\s\S]*?      <\/select>\n    <\/label>/
  const replacement = readOnlyBox("Inverter capacity", "inverterManufacturer", "inverterModel", "inverterCapacity", "kW", "inverterQuantity", "No inverter selected in OpenSolar")
  if (inverterRegex.test(next)) next = next.replace(inverterRegex, replacement)
}

if (next !== text) {
  fs.writeFileSync(path, next)
  console.log("OpenSolar hardware UI patch applied.")
} else {
  console.log("OpenSolar hardware UI already applied; nothing to change.")
}

import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
const text = fs.readFileSync(path, "utf8")
let next = text

if (!next.includes("batteryManufacturer:")) {
  const marker = '  batteryCapacity: "",\n\n  inverterCapacity: "",'
  if (!next.includes(marker)) throw new Error("Could not locate battery/inverter initial state")
  next = next.replace(
    marker,
    '  batteryCapacity: "",\n  batteryManufacturer: "",\n  batteryModel: "",\n  batteryQuantity: 0,\n\n  inverterCapacity: "",\n  inverterManufacturer: "",\n  inverterModel: "",\n  inverterQuantity: 0,'
  )
}

const hardwareMarker = '      ...current,\n      arrays:'
if (next.includes(hardwareMarker) && !next.includes('batteryManufacturer: String(importedHardware?.battery?.manufacturer || "")')) {
  next = next.replace(
    hardwareMarker,
    `      ...current,\n      batteryCapacity: Number(importedHardware?.battery?.capacityKwh || 0),\n      batteryManufacturer: String(importedHardware?.battery?.manufacturer || ""),\n      batteryModel: String(importedHardware?.battery?.model || ""),\n      batteryQuantity: Number(importedHardware?.battery?.quantity || 0),\n      inverterCapacity: Number(importedHardware?.inverter?.capacityKw || 0),\n      inverterManufacturer: String(importedHardware?.inverter?.manufacturer || ""),\n      inverterModel: String(importedHardware?.inverter?.model || ""),\n      inverterQuantity: Number(importedHardware?.inverter?.quantity || 0),\n      arrays:`
  )
}

const importedMarker = '    const imported = Array.isArray(payload?.arrays) ? payload.arrays : []'
if (next.includes(importedMarker) && !next.includes('const importedHardware = payload?.hardware || {}')) {
  next = next.replace(
    importedMarker,
    `${importedMarker}\n    const importedHardware = payload?.hardware || {}`
  )
}

if (!next.includes('data.batteryManufacturer || ""')) {
  const batteryPattern = /    <label style=\{styles\.field\}>\n      <span>Battery configuration<\\/span>[\\s\\S]*?      <\\/select>\n    <\\/label>/
  const batteryReplacement = `    <label style={styles.field}>\n      <span>Battery configuration</span>\n      <div\n        style={{\n          minHeight: 44,\n          boxSizing: "border-box",\n          padding: "0 12px",\n          border: "1px solid #cbd5e1",\n          borderRadius: 10,\n          background: "#f8fafc",\n          color: "#172554",\n          display: "flex",\n          alignItems: "center",\n          fontSize: 13,\n          fontWeight: 600,\n        }}\n      >\n        {data.batteryModel || "No battery selected in OpenSolar"}\n        {Number(data.batteryCapacity || 0) > 0 && (\n          <span style={{ marginLeft: 6, fontWeight: 500, color: "#64748b" }}>\n            ({Number(data.batteryCapacity).toFixed(1)} kWh)\n          </span>\n        )}\n      </div>\n    </label>`

  const batteryRegex = new RegExp(
    String.raw`    <label style=\\{styles\\.field\\}>\\n      <span>Battery configuration<\\/span>[\\s\\S]*?      <\\/select>\\n    <\\/label>`
  )
  if (batteryRegex.test(next)) next = next.replace(batteryRegex, batteryReplacement)
}

if (!next.includes('data.inverterManufacturer || ""')) {
  const inverterRegex = new RegExp(
    String.raw`    <label style=\\{styles\\.field\\}>\\n      <span>Inverter capacity<\\/span>[\\s\\S]*?      <\\/select>\\n    <\\/label>`
  )
  const inverterReplacement = `    <label style={styles.field}>\n      <span>Inverter capacity</span>\n      <div\n        style={{\n          minHeight: 44,\n          boxSizing: "border-box",\n          padding: "0 12px",\n          border: "1px solid #cbd5e1",\n          borderRadius: 10,\n          background: "#f8fafc",\n          color: "#172554",\n          display: "flex",\n          alignItems: "center",\n          fontSize: 13,\n          fontWeight: 600,\n        }}\n      >\n        {data.inverterModel || "No inverter selected in OpenSolar"}\n        {Number(data.inverterCapacity || 0) > 0 && (\n          <span style={{ marginLeft: 6, fontWeight: 500, color: "#64748b" }}>\n            ({Number(data.inverterCapacity).toFixed(1)} kW)\n          </span>\n        )}\n      </div>\n    </label>`
  if (inverterRegex.test(next)) next = next.replace(inverterRegex, inverterReplacement)
}

if (next !== text) {
  fs.writeFileSync(path, next)
  console.log("OpenSolar hardware UI patch applied.")
} else {
  console.log("OpenSolar hardware UI already applied; nothing to change.")
}

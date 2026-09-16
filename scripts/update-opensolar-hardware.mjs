import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
const text = fs.readFileSync(path, "utf8")
let next = text

// OpenSolar hardware fields are display-only: OpenSolar is the source of truth.
if (!next.includes("batteryManufacturer:")) {
  const marker = '  batteryCapacity: "",\n\n  inverterCapacity: "",'
  if (!next.includes(marker)) throw new Error("Could not locate battery/inverter initial state")
  next = next.replace(marker, '  batteryCapacity: "",\n  batteryManufacturer: "",\n  batteryModel: "",\n  batteryQuantity: 0,\n\n  inverterCapacity: "",\n  inverterManufacturer: "",\n  inverterModel: "",\n  inverterQuantity: 0,\n\n  evChargerManufacturer: "",\n  evChargerModel: "",\n  evChargerQuantity: 0,')
}

if (!next.includes("const importedHardware = payload?.hardware || {}")) {
  const importedPattern = /([ \t]*)const imported = Array\.isArray\(payload\?\.arrays\) \? payload\.arrays : \[\]/
  if (importedPattern.test(next)) next = next.replace(importedPattern, `$1const imported = Array.isArray(payload?.arrays) ? payload.arrays : []\n$1const importedHardware = payload?.hardware || {}`)
}

if (!next.includes('evChargerManufacturer: String(importedHardware?.evCharger?.manufacturer || "")')) {
  const hardwarePattern = /([ \t]*)\.\.\.current,\n\1arrays:/
  if (hardwarePattern.test(next)) next = next.replace(hardwarePattern, `$1...current,\n$1batteryCapacity: Number(importedHardware?.battery?.capacityKwh || 0),\n$1batteryManufacturer: String(importedHardware?.battery?.manufacturer || ""),\n$1batteryModel: String(importedHardware?.battery?.model || ""),\n$1batteryQuantity: Number(importedHardware?.battery?.quantity || 0),\n$1inverterCapacity: Number(importedHardware?.inverter?.capacityKw || 0),\n$1inverterManufacturer: String(importedHardware?.inverter?.manufacturer || ""),\n$1inverterModel: String(importedHardware?.inverter?.model || ""),\n$1inverterQuantity: Number(importedHardware?.inverter?.quantity || 0),\n$1evChargerManufacturer: String(importedHardware?.evCharger?.manufacturer || ""),\n$1evChargerModel: String(importedHardware?.evCharger?.model || ""),\n$1evChargerQuantity: Number(importedHardware?.evCharger?.quantity || 0),\n$1arrays:`)
  }
}

if (!next.includes('data.batteryModel || "No battery selected in OpenSolar"')) {
  const batteryRegex = /    <label style=\{styles\.field\}>\n      <span>Battery configuration<\/span>[\s\S]*?      <\/select>\n    <\/label>/
  const batteryReplacement = String.raw`    <label style={styles.field}>\n      <span>Battery configuration</span>\n      <div style={{ minHeight: 44, boxSizing: "border-box", padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#172554", display: "flex", alignItems: "center", fontSize: 13, fontWeight: 600, minWidth: 0 }}>\n        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>\n          {data.batteryManufacturer\n            ? \`\${data.batteryManufacturer} — \${data.batteryModel || "Unknown model"}\`\n            : data.batteryModel || "No battery selected in OpenSolar"}\n        </span>\n        {Number(data.batteryCapacity || 0) > 0 && (\n          <span style={{ marginLeft: 6, flexShrink: 0, fontWeight: 500, color: "#64748b" }}>\n            (\${Number(data.batteryCapacity).toFixed(1)} kWh)\n          </span>\n        )}\n        {Number(data.batteryQuantity || 0) > 1 && (\n          <span style={{ marginLeft: 6, flexShrink: 0, fontWeight: 500, color: "#64748b" }}>× \${Number(data.batteryQuantity)}</span>\n        )}\n      </div>\n    </label>`
  if (batteryRegex.test(next)) next = next.replace(batteryRegex, batteryReplacement)
}

if (!next.includes('data.inverterModel || "No inverter selected in OpenSolar"')) {
  const inverterRegex = /    <label style=\{styles\.field\}>\n      <span>Inverter capacity \(kW\)<\/span>[\s\S]*?      <\/select>\n    <\/label>/
  const inverterReplacement = String.raw`    <label style={styles.field}>\n      <span>Inverter capacity (kW)</span>\n      <div style={{ minHeight: 44, boxSizing: "border-box", padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#172554", display: "flex", alignItems: "center", fontSize: 13, fontWeight: 600, minWidth: 0 }}>\n        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>\n          {data.inverterManufacturer\n            ? \`\${data.inverterManufacturer} — \${data.inverterModel || "Unknown model"}\`\n            : data.inverterModel || "No inverter selected in OpenSolar"}\n        </span>\n        {Number(data.inverterCapacity || 0) > 0 && (\n          <span style={{ marginLeft: 6, flexShrink: 0, fontWeight: 500, color: "#64748b" }}>\n            (\${Number(data.inverterCapacity).toFixed(1)} kW)\n          </span>\n        )}\n        {Number(data.inverterQuantity || 0) > 1 && (\n          <span style={{ marginLeft: 6, flexShrink: 0, fontWeight: 500, color: "#64748b" }}>× \${Number(data.inverterQuantity)}</span>\n        )}\n      </div>\n    </label>`
  if (inverterRegex.test(next)) next = next.replace(inverterRegex, inverterReplacement)
}

// Add the EV charger display using the same read-only OpenSolar treatment.
if (!next.includes('data.evChargerModel || "No EV charger selected in OpenSolar"')) {
  const evChargerBlock = String.raw`    <label style={styles.field}>\n      <span>EV Charger</span>\n      <div style={{ minHeight: 44, boxSizing: "border-box", padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#172554", display: "flex", alignItems: "center", fontSize: 13, fontWeight: 600, minWidth: 0 }}>\n        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>\n          {data.evChargerManufacturer\n            ? \`\${data.evChargerManufacturer} — \${data.evChargerModel || "Unknown model"}\`\n            : data.evChargerModel || "No EV charger selected in OpenSolar"}\n        </span>\n        {Number(data.evChargerQuantity || 0) > 1 && (\n          <span style={{ marginLeft: 6, flexShrink: 0, fontWeight: 500, color: "#64748b" }}>× \${Number(data.evChargerQuantity)}</span>\n        )}\n      </div>\n    </label>`

  const inverterStart = next.indexOf('    <label style={styles.field}>\n      <span>Inverter capacity (kW)</span>')
  if (inverterStart !== -1) {
    const inverterEnd = next.indexOf('    </label>', inverterStart)
    if (inverterEnd !== -1) {
      const insertAt = inverterEnd + '    </label>'.length
      next = next.slice(0, insertAt) + "\n" + evChargerBlock + next.slice(insertAt)
    }
  }
}

// Put Battery / Inverter / EV Charger on one full-width three-column row.
if (!next.includes('className="opensolar-hardware-row"')) {
  const batteryStart = next.indexOf('    <label style={styles.field}>\n      <span>Battery configuration</span>')
  const evStart = next.indexOf('    <label style={styles.field}>\n      <span>EV Charger</span>')

  if (batteryStart !== -1 && evStart !== -1) {
    const evEnd = next.indexOf('    </label>', evStart)
    if (evEnd !== -1) {
      const end = evEnd + '    </label>'.length
      const batteryEnd = next.indexOf('    </label>', batteryStart) + '    </label>'.length
      const inverterStart = next.indexOf('    <label style={styles.field}>\n      <span>Inverter capacity (kW)</span>', batteryEnd)
      if (inverterStart !== -1) {
        const inverterEnd = next.indexOf('    </label>', inverterStart) + '    </label>'.length
        const batteryBlock = next.slice(batteryStart, batteryEnd)
        const inverterBlock = next.slice(inverterStart, inverterEnd)
        const evBlock = next.slice(evStart, end)
        const row = `    <div className="opensolar-hardware-row" style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, width: "100%", minWidth: 0 }}>\n${batteryBlock}\n${inverterBlock}\n${evBlock}\n    </div>`
        next = next.slice(0, batteryStart) + row + next.slice(end)
      }
    }
  }
}

if (next !== text) {
  fs.writeFileSync(path, next)
  console.log("OpenSolar hardware UI patch applied.")
} else {
  console.log("OpenSolar hardware UI already applied; nothing to change.")
}

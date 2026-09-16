import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
let text = fs.readFileSync(path, "utf8")
let next = text

// Add OpenSolar hardware state.
if (!next.includes("batteryManufacturer:")) {
  next = next.replace(
    '  batteryCapacity: "",\n\n  inverterCapacity: "",',
    '  batteryCapacity: "",\n  batteryManufacturer: "",\n  batteryModel: "",\n  batteryQuantity: 0,\n\n  inverterCapacity: "",\n  inverterManufacturer: "",\n  inverterModel: "",\n  inverterQuantity: 0,\n\n  evChargerManufacturer: "",\n  evChargerModel: "",\n  evChargerQuantity: 0,\n\n  inverterCapacity: "",'
  )
}

// Read hardware returned by the existing OpenSolar/Supabase call.
if (!next.includes("const importedHardware = payload?.hardware || {}")) {
  next = next.replace(
    /([ \t]*)const imported = Array\.isArray\(payload\?\.arrays\) \? payload\.arrays : \[\]/,
    '$1const imported = Array.isArray(payload?.arrays) ? payload.arrays : []\n$1const importedHardware = payload?.hardware || {}'
  )
}

if (!next.includes("batteryManufacturer: String(importedHardware?.battery?.manufacturer || \"\")")) {
  next = next.replace(
    /([ \t]*)\.\.\.current,\n\1arrays:/,
    '$1...current,\n$1batteryCapacity: Number(importedHardware?.battery?.capacityKwh || 0),\n$1batteryManufacturer: String(importedHardware?.battery?.manufacturer || ""),\n$1batteryModel: String(importedHardware?.battery?.model || ""),\n$1batteryQuantity: Number(importedHardware?.battery?.quantity || 0),\n$1inverterCapacity: Number(importedHardware?.inverter?.capacityKw || 0),\n$1inverterManufacturer: String(importedHardware?.inverter?.manufacturer || ""),\n$1inverterModel: String(importedHardware?.inverter?.model || ""),\n$1inverterQuantity: Number(importedHardware?.inverter?.quantity || 0),\n$1evChargerManufacturer: String(importedHardware?.evCharger?.manufacturer || ""),\n$1evChargerModel: String(importedHardware?.evCharger?.model || ""),\n$1evChargerQuantity: Number(importedHardware?.evCharger?.quantity || 0),\n$1arrays:'
  )
}

const displayField = (label, expression, suffix) =>
  '    <label style={styles.field}>\n' +
  '      <span>' + label + '</span>\n' +
  '      <div style={{ minHeight: 44, boxSizing: "border-box", padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#172554", display: "flex", alignItems: "center", fontSize: 13, fontWeight: 600, minWidth: 0, overflow: "hidden" }}>\n' +
  '        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{' + expression + '}</span>' +
  (suffix ? '\n        ' + suffix : '') +
  '\n      </div>\n' +
  '    </label>'

const batteryRegex = /    <label style=\{styles\.field\}>\n      <span>Battery configuration<\/span>[\s\S]*?    <\/label>/
if (batteryRegex.test(next)) {
  const batterySuffix = '{Number(data.batteryCapacity || 0) > 0 && (\n          <span style={{ marginLeft: 6, flexShrink: 0, fontWeight: 500, color: "#64748b" }}>({Number(data.batteryCapacity).toFixed(1)} kWh)</span>\n        )}{Number(data.batteryQuantity || 0) > 1 && (\n          <span style={{ marginLeft: 6, flexShrink: 0, fontWeight: 500, color: "#64748b" }}>× {Number(data.batteryQuantity)}</span>\n        )}'
  next = next.replace(
    batteryRegex,
    displayField("Battery configuration", 'data.batteryManufacturer ? data.batteryManufacturer + " — " + (data.batteryModel || "Unknown model") : data.batteryModel || "No battery selected in OpenSolar"', batterySuffix)
  )
}

const inverterRegex = /    <label style=\{styles\.field\}>\n      <span>Inverter capacity \(kW\)<\/span>[\s\S]*?    <\/label>/
if (inverterRegex.test(next)) {
  const inverterSuffix = '{Number(data.inverterCapacity || 0) > 0 && (\n          <span style={{ marginLeft: 6, flexShrink: 0, fontWeight: 500, color: "#64748b" }}>({Number(data.inverterCapacity).toFixed(1)} kW)</span>\n        )}{Number(data.inverterQuantity || 0) > 1 && (\n          <span style={{ marginLeft: 6, flexShrink: 0, fontWeight: 500, color: "#64748b" }}>× {Number(data.inverterQuantity)}</span>\n        )}'
  next = next.replace(
    inverterRegex,
    displayField("Inverter capacity (kW)", 'data.inverterManufacturer ? data.inverterManufacturer + " — " + (data.inverterModel || "Unknown model") : data.inverterModel || "No inverter selected in OpenSolar"', inverterSuffix)
  )
}

if (!next.includes('data.evChargerModel || "No EV charger selected in OpenSolar"')) {
  const evSuffix = '{Number(data.evChargerQuantity || 0) > 1 && (\n          <span style={{ marginLeft: 6, flexShrink: 0, fontWeight: 500, color: "#64748b" }}>× {Number(data.evChargerQuantity)}</span>\n        )}'
  const evBlock = displayField("EV Charger", 'data.evChargerManufacturer ? data.evChargerManufacturer + " — " + (data.evChargerModel || "Unknown model") : data.evChargerModel || "No EV charger selected in OpenSolar"', evSuffix)
  const inverterLabel = '      <span>Inverter capacity (kW)</span>'
  const inverterStart = next.indexOf(inverterLabel)
  if (inverterStart !== -1) {
    const inverterEnd = next.indexOf('    </label>', inverterStart)
    if (inverterEnd !== -1) {
      const insertAt = inverterEnd + '    </label>'.length
      next = next.slice(0, insertAt) + "\n" + evBlock + next.slice(insertAt)
    }
  }
}

// Put Battery / Inverter / EV Charger on one responsive three-column row.
if (!next.includes('className="opensolar-hardware-row"')) {
  const batteryStart = next.indexOf('    <label style={styles.field}>\n      <span>Battery configuration</span>')
  const batteryEnd = batteryStart === -1 ? -1 : next.indexOf('    </label>', batteryStart) + '    </label>'.length
  const inverterStart = batteryEnd === -1 ? -1 : next.indexOf('    <label style={styles.field}>\n      <span>Inverter capacity (kW)</span>', batteryEnd)
  const inverterEnd = inverterStart === -1 ? -1 : next.indexOf('    </label>', inverterStart) + '    </label>'.length
  const evStart = inverterEnd === -1 ? -1 : next.indexOf('    <label style={styles.field}>\n      <span>EV Charger</span>', inverterEnd)
  const evEnd = evStart === -1 ? -1 : next.indexOf('    </label>', evStart) + '    </label>'.length

  if (batteryStart !== -1 && inverterStart !== -1 && evStart !== -1 && evEnd > evStart) {
    const row = [
      '    <div className="opensolar-hardware-row" style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, width: "100%", minWidth: 0 }}>',
      next.slice(batteryStart, batteryEnd),
      next.slice(inverterStart, inverterEnd),
      next.slice(evStart, evEnd),
      '    </div>',
    ].join("\n")
    next = next.slice(0, batteryStart) + row + next.slice(evEnd)
  }
}

if (next !== text) {
  fs.writeFileSync(path, next)
  console.log("OpenSolar hardware UI patch applied.")
} else {
  console.log("OpenSolar hardware UI already applied; nothing to change.")
}

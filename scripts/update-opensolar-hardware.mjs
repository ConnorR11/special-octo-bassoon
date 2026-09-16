import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
let text = fs.readFileSync(path, "utf8")
let next = text

// Keep the OpenSolar hardware values in calculator state.
const stateAnchor = '  batteryCapacity: "",'
if (!next.includes('batteryManufacturer: ""')) {
  next = next.replace(
    stateAnchor,
    `${stateAnchor}\n  batteryManufacturer: "",\n  batteryModel: "",\n  batteryQuantity: 0,`
  )
}
if (!next.includes('inverterManufacturer: ""')) {
  next = next.replace(
    '  inverterCapacity: "",',
    '  inverterCapacity: "",\n  inverterManufacturer: "",\n  inverterModel: "",\n  inverterQuantity: 0,'
  )
}
if (!next.includes('evChargerManufacturer: ""')) {
  next = next.replace(
    '  inverterQuantity: 0,',
    '  inverterQuantity: 0,\n\n  evChargerManufacturer: "",\n  evChargerModel: "",\n  evChargerQuantity: 0,'
  )
}

// Read the hardware object returned by the existing OpenSolar/Supabase call.
if (!next.includes('const importedHardware = payload?.hardware || {}')) {
  next = next.replace(
    /([ \t]*)const imported = Array\.isArray\(payload\?\.arrays\) \? payload\.arrays : \[\]/,
    '$1const imported = Array.isArray(payload?.arrays) ? payload.arrays : []\n$1const importedHardware = payload?.hardware || {}'
  )
}

// Populate calculator state from OpenSolar.
if (!next.includes('batteryManufacturer: String(importedHardware?.battery?.manufacturer || "")')) {
  next = next.replace(
    /([ \t]*)\.\.\.current,\n\1arrays:/,
    '$1...current,\n$1batteryCapacity: Number(importedHardware?.battery?.capacityKwh || 0),\n$1batteryManufacturer: String(importedHardware?.battery?.manufacturer || ""),\n$1batteryModel: String(importedHardware?.battery?.model || ""),\n$1batteryQuantity: Number(importedHardware?.battery?.quantity || 0),\n$1inverterCapacity: Number(importedHardware?.inverter?.capacityKw || 0),\n$1inverterManufacturer: String(importedHardware?.inverter?.manufacturer || ""),\n$1inverterModel: String(importedHardware?.inverter?.model || ""),\n$1inverterQuantity: Number(importedHardware?.inverter?.quantity || 0),\n$1evChargerManufacturer: String(importedHardware?.evCharger?.manufacturer || ""),\n$1evChargerModel: String(importedHardware?.evCharger?.model || ""),\n$1evChargerQuantity: Number(importedHardware?.evCharger?.quantity || 0),\n$1arrays:'
  )
}

// Repair missing commas from any previous generated version before Vite parses it.
next = next.replace(/(batteryManufacturer:\s*"[^"]*")\n(\s*batteryModel:)/g, '$1,\n$2')
next = next.replace(/(batteryModel:\s*"[^"]*")\n(\s*batteryQuantity:)/g, '$1,\n$2')
next = next.replace(/(inverterManufacturer:\s*"[^"]*")\n(\s*inverterModel:)/g, '$1,\n$2')
next = next.replace(/(inverterModel:\s*"[^"]*")\n(\s*inverterQuantity:)/g, '$1,\n$2')
next = next.replace(/(evChargerManufacturer:\s*"[^"]*")\n(\s*evChargerModel:)/g, '$1,\n$2')
next = next.replace(/(evChargerModel:\s*"[^"]*")\n(\s*evChargerQuantity:)/g, '$1,\n$2')

const labelBlock = (label) => new RegExp(
  `<label\\b[^>]*>[\\s\\S]*?<span[^>]*>${label}<\\/span>[\\s\\S]*?<\\/label>`,
  "m"
)

const displayField = (label, expression, suffix = "") =>
  `    <label style={{ ...styles.field, flex: "1 1 0", minWidth: 0, width: 0 }}>\n` +
  `      <span>${label}</span>\n` +
  `      <div style={{ minHeight: 44, boxSizing: "border-box", padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#172554", display: "flex", alignItems: "center", fontSize: 12, fontWeight: 600, minWidth: 0, width: "100%", overflow: "hidden" }}>\n` +
  `        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>${expression}</span>${suffix}\n` +
  `      </div>\n` +
  `    </label>`

const batteryField = displayField(
  "Battery configuration",
  'data.batteryManufacturer ? data.batteryManufacturer + " — " + (data.batteryModel || "Unknown model") : data.batteryModel || "No battery selected in OpenSolar"',
  ' {Number(data.batteryCapacity || 0) > 0 && <span style={{ marginLeft: 6, flexShrink: 0, fontWeight: 500, color: "#64748b" }}>({Number(data.batteryCapacity).toFixed(1)} kWh)</span>} {Number(data.batteryQuantity || 0) > 1 && <span style={{ marginLeft: 6, flexShrink: 0, fontWeight: 500, color: "#64748b" }}>× {Number(data.batteryQuantity)}</span>}'
)

const inverterField = displayField(
  "Inverter capacity (kW)",
  'data.inverterManufacturer ? data.inverterManufacturer + " — " + (data.inverterModel || "Unknown model") : data.inverterModel || "No inverter selected in OpenSolar"',
  ' {Number(data.inverterCapacity || 0) > 0 && <span style={{ marginLeft: 6, flexShrink: 0, fontWeight: 500, color: "#64748b" }}>({Number(data.inverterCapacity).toFixed(1)} kW)</span>} {Number(data.inverterQuantity || 0) > 1 && <span style={{ marginLeft: 6, flexShrink: 0, fontWeight: 500, color: "#64748b" }}>× {Number(data.inverterQuantity)}</span>}'
)

const evField = displayField(
  "EV Charger",
  'data.evChargerManufacturer ? data.evChargerManufacturer + " — " + (data.evChargerModel || "Unknown model") : data.evChargerModel || "No EV charger selected in OpenSolar"',
  ' {Number(data.evChargerQuantity || 0) > 1 && <span style={{ marginLeft: 6, flexShrink: 0, fontWeight: 500, color: "#64748b" }}>× {Number(data.evChargerQuantity)}</span>}'
)

const batteryRe = labelBlock("Battery configuration")
const inverterRe = labelBlock("Inverter capacity \\(kW\\)")
const evRe = labelBlock("EV Charger")

// Replace existing fields with the OpenSolar read-only versions.
if (batteryRe.test(next)) next = next.replace(batteryRe, batteryField)
if (inverterRe.test(next)) next = next.replace(inverterRe, inverterField)
if (evRe.test(next)) next = next.replace(evRe, evField)

// Wrap the three fields together so they share one row.
if (!next.includes('className="opensolar-hardware-row"')) {
  const batteryNow = next.match(batteryRe)
  const inverterNow = next.match(inverterRe)
  const evNow = next.match(evRe)

  if (batteryNow && inverterNow && evNow) {
    const start = batteryNow.index
    const end = evNow.index + evNow[0].length
    const row = [
      '    <div className="opensolar-hardware-row" style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 12, width: "100%", minWidth: 0 }}>',
      batteryField,
      inverterField,
      evField,
      "    </div>",
    ].join("\n")

    const between = next.slice(start, end)
    if ((between.match(/<label\\b/g) || []).length === 3) {
      next = next.slice(0, start) + row + next.slice(end)
    }
  }
}

if (next !== text) {
  fs.writeFileSync(path, next)
  console.log("OpenSolar hardware UI patch applied.")
} else {
  console.log("OpenSolar hardware UI already applied; nothing to change.")
}

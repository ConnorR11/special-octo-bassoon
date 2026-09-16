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

// All three OpenSolar hardware displays use the same structure and styling.
const displayField = (label, manufacturerExpression, modelExpression, capacityExpression, unit) =>
  `    <label style={{ ...styles.field, flex: "1 1 0", minWidth: 0, width: 0 }}>\n` +
  `      <span>${label}</span>\n` +
  `      <div style={{ minHeight: 68, boxSizing: "border-box", padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#172554", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0, width: "100%", overflow: "hidden" }}>\n` +
  `        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minWidth: 0 }}>\n` +
  `          <span style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>${manufacturerExpression}</span>\n` +
  `          <span style={{ fontSize: 11, fontWeight: 500, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, textAlign: "right" }}>${modelExpression}</span>\n` +
  `        </div>\n` +
  `        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 7, fontSize: 11, color: "#64748b" }}>\n` +
  `          <span>${capacityExpression} ${unit}</span>\n` +
  `          <span style={{ color: "#172554", fontWeight: 700 }}>Quantity ${unit === "kWh" ? "{Number(data.batteryQuantity || 0)}" : unit === "kW" ? "{Number(data.inverterQuantity || 0)}" : "{Number(data.evChargerQuantity || 0)}"}</span>\n` +
  `        </div>\n` +
  `      </div>\n` +
  `    </label>`

const batteryField = displayField(
  "Battery configuration",
  'data.batteryManufacturer || "No battery selected in OpenSolar"',
  'data.batteryModel || "Unknown model"',
  'Number(data.batteryCapacity || 0).toFixed(1)',
  "kWh"
)

const inverterField = displayField(
  "Inverter capacity (kW)",
  'data.inverterManufacturer || "No inverter selected in OpenSolar"',
  'data.inverterModel || "Unknown model"',
  'Number(data.inverterCapacity || 0).toFixed(1)',
  "kW"
)

const evField = displayField(
  "EV Charger",
  'data.evChargerManufacturer || "No EV charger selected in OpenSolar"',
  'data.evChargerModel || "Unknown model"',
  '"—"',
  ""
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

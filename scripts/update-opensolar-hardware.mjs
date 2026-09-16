import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
let text = fs.readFileSync(path, "utf8")
let next = text

// Keep the OpenSolar hardware values in calculator state.
const stateAnchor = '  batteryCapacity: "",'
if (!next.includes('batteryManufacturer: ""')) {
  next = next.replace(
    stateAnchor,
    `${stateAnchor}\n  batteryManufacturer: ""\n  batteryModel: ""\n  batteryQuantity: 0,`
  )
}
if (!next.includes('inverterManufacturer: ""')) {
  next = next.replace(
    '  inverterCapacity: "",',
    '  inverterCapacity: "",\n  inverterManufacturer: ""\n  inverterModel: ""\n  inverterQuantity: 0,'
  )
}
if (!next.includes('evChargerManufacturer: ""')) {
  next = next.replace(
    '  inverterQuantity: 0,',
    '  inverterQuantity: 0,\n\n  evChargerManufacturer: ""\n  evChargerModel: ""\n  evChargerQuantity: 0,'
  )
}

// Read the hardware object returned by the existing OpenSolar/Supabase call.
if (!next.includes('const importedHardware = payload?.hardware || {}')) {
  next = next.replace(
    /([ \t]*)const imported = Array\.isArray\(payload\?\.arrays\) \? payload\.arrays : \[\]/,
    '$1const imported = Array.isArray(payload?.arrays) ? payload.arrays : []\n$1const importedHardware = payload?.hardware || {}'
  )
}

// Populate the calculator state from OpenSolar without changing the existing API call.
if (!next.includes('batteryManufacturer: String(importedHardware?.battery?.manufacturer || "")')) {
  next = next.replace(
    /([ \t]*)\.\.\.current,\n\1arrays:/,
    '$1...current,\n$1batteryCapacity: Number(importedHardware?.battery?.capacityKwh || 0),\n$1batteryManufacturer: String(importedHardware?.battery?.manufacturer || ""),\n$1batteryModel: String(importedHardware?.battery?.model || ""),\n$1batteryQuantity: Number(importedHardware?.battery?.quantity || 0),\n$1inverterCapacity: Number(importedHardware?.inverter?.capacityKw || 0),\n$1inverterManufacturer: String(importedHardware?.inverter?.manufacturer || ""),\n$1inverterModel: String(importedHardware?.inverter?.model || ""),\n$1inverterQuantity: Number(importedHardware?.inverter?.quantity || 0),\n$1evChargerManufacturer: String(importedHardware?.evCharger?.manufacturer || ""),\n$1evChargerModel: String(importedHardware?.evCharger?.model || ""),\n$1evChargerQuantity: Number(importedHardware?.evCharger?.quantity || 0),\n$1arrays:'
  )
}

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

// Replace the three hardware fields as one controlled row. This is deliberately
// idempotent so repeated Vercel builds cannot remove the EV charger field.
const batteryRe = labelBlock("Battery configuration")
const inverterRe = labelBlock("Inverter capacity \(kW\)")
const evRe = labelBlock("EV Charger")

const batteryMatch = next.match(batteryRe)
const inverterMatch = next.match(inverterRe)
const evMatch = next.match(evRe)

if (batteryMatch && inverterMatch) {
  // Remove any existing hardware row wrapper first, leaving the three labels.
  next = next.replace(/<div className="opensolar-hardware-row"[^>]*>[\s\S]*?<\/div>/m, `${batteryMatch[0]}\n${inverterMatch[0]}\n${evMatch ? evMatch[0] : evField}`)

  const batteryNow = next.match(batteryRe)
  const inverterNow = next.match(inverterRe)
  const evNow = next.match(evRe)

  if (batteryNow && inverterNow && evNow) {
    const row = [
      '    <div className="opensolar-hardware-row" style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 12, width: "100%", minWidth: 0 }}>',
      batteryField,
      inverterField,
      evField,
      "    </div>",
    ].join("\n")

    const start = batteryNow.index
    const end = Math.max(
      batteryNow.index + batteryNow[0].length,
      inverterNow.index + inverterNow[0].length,
      evNow.index + evNow[0].length
    )

    // The fields are expected to be adjacent in the Payment/System section.
    // If another field sits between them, fall back to replacing individually.
    const between = next.slice(start, end)
    const onlyHardware =
      between.match(new RegExp(`<label\\b`, "g"))?.length === 3

    if (onlyHardware) {
      next = next.slice(0, start) + row + next.slice(end)
    } else {
      next = next.replace(batteryRe, batteryField).replace(inverterRe, inverterField).replace(evRe, evField)
    }
  }
} else {
  // If an earlier generated version has unusual markup, at minimum ensure EV is
  // present immediately after the inverter field.
  next = next.replace(inverterRe, `${inverterField}\n${evField}`)
  next = next.replace(batteryRe, batteryField)
}

if (next !== text) {
  fs.writeFileSync(path, next)
  console.log("OpenSolar hardware UI patch applied.")
} else {
  console.log("OpenSolar hardware UI already applied; nothing to change.")
}

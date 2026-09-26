import fs from "node:fs"

const path = "src/contracts/GenerateSolarContract.js"
const source = fs.readFileSync(path, "utf8")

const start = source.indexOf("function getContractProductNames(")
const end = source.indexOf("\nfunction productMatchesContractItem", start)

if (start === -1 || end === -1) {
  throw new Error("Could not find solar product matching function in GenerateSolarContract.js")
}

const replacement = `function getContractProductNames(appointment, epvs, pages) {
  const data = epvs?.data || {}
  const names = []

  const add = value => {
    const rendered = interpolate(String(value || ""), appointment, epvs).trim()
    if (rendered && rendered !== "—") names.push(rendered)
  }

  // Products configured directly on the contract template.
  ;(Array.isArray(pages) ? pages : []).forEach(page => {
    const configured = Array.isArray(page?.settings?.included_items)
      ? page.settings.included_items
      : []

    configured.forEach(item => {
      add(typeof item === "string" ? item : item?.name)
    })
  })

  // OpenSolar/EPVS hardware uses arrays of hardware objects.
  // These model values are matched against products.model so the
  // corresponding datasheet can be appended to the contract.
  ;(Array.isArray(data.inverters) ? data.inverters : []).forEach(inverter => {
    add(inverter?.model)
    add(inverter?.name)
  })

  ;(Array.isArray(data.batteries) ? data.batteries : []).forEach(battery => {
    add(battery?.model)
    add(battery?.name)
  })

  ;(Array.isArray(data.panels) ? data.panels : []).forEach(panel => {
    add(panel?.model)
    add(panel?.name)
  })

  // Support singular hardware objects used by some EPVS/OpenSolar payloads.
  add(data.inverter?.model)
  add(data.inverter?.name)
  add(data.battery?.model)
  add(data.battery?.name)
  add(data.storage?.model)
  add(data.storage?.name)

  // Support hardware represented as individual fields in older EPVS data.
  add(data.inverterModel || data.inverter_model || data.inverterName || data.inverter_name)
  add(data.batteryModel || data.battery_model || data.batteryName || data.battery_name)
  add(data.panelModel || data.panel_model || data.panelName || data.panel_name)

  ;(Array.isArray(data.arrays) ? data.arrays : []).forEach(array => {
    add(array?.panelModel || array?.panel_model || array?.panelName || array?.panel_name)
  })

  return [...new Set(names.map(normaliseDatasheetName).filter(Boolean))]
}`

const updated = source.slice(0, start) + replacement + source.slice(end)

fs.writeFileSync(path, updated)
console.log("Patched solar product matching for inverter, battery and panel datasheets.")

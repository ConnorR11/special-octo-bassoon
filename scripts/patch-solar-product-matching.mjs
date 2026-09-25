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
  // Match these by their model value against products.model.
  ;(Array.isArray(data.inverters) ? data.inverters : []).forEach(inverter => {
    add(inverter?.model)
  })

  ;(Array.isArray(data.batteries) ? data.batteries : []).forEach(battery => {
    add(battery?.model)
  })

  ;(Array.isArray(data.panels) ? data.panels : []).forEach(panel => {
    add(panel?.model)
  })

  // Support hardware represented as a single object in older EPVS data.
  add(data.inverterModel || data.inverter_model)
  add(data.batteryModel || data.battery_model)
  add(data.panelModel || data.panel_model)

  ;(Array.isArray(data.arrays) ? data.arrays : []).forEach(array => {
    add(array?.panelModel || array?.panel_model || array?.panelName || array?.panel_name)
  })

  return [...new Set(names.map(normaliseDatasheetName).filter(Boolean))]
}`

const updated = source.slice(0, start) + replacement + source.slice(end)

fs.writeFileSync(path, updated)
console.log("Patched solar product matching from OpenSolar hardware models.")

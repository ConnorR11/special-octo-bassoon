import fs from "node:fs"
import path from "node:path"

const file = path.resolve("src/contracts/GenerateSolarContract.js")
let source = fs.readFileSync(file, "utf8")

const start = source.indexOf("function getContractProductNames(")
const end = source.indexOf("async function getProductDatasheetPaths(", start)

if (start === -1 || end === -1) {
  throw new Error("Could not find solar datasheet product matching functions.")
}

const replacement = `function getContractProductNames(appointment, epvs, pages) {
  const data = epvs?.data || {}
  const names = []

  const add = value => {
    const rendered = interpolate(String(value || ""), appointment, epvs).trim()
    if (rendered && rendered !== "—") names.push(rendered)
  }

  ;(Array.isArray(pages) ? pages : []).forEach(page => {
    const configured = Array.isArray(page?.settings?.included_items)
      ? page.settings.included_items
      : []

    configured.forEach(item => {
      add(typeof item === "string" ? item : item?.name)
    })
  })

  // OpenSolar stores hardware models in arrays such as:
  // { inverters: [{ model: "HESS-HY-S-6.0K" }] }
  ;(Array.isArray(data.inverters) ? data.inverters : []).forEach(inverter => {
    add(inverter?.model)
  })

  ;(Array.isArray(data.batteries) ? data.batteries : []).forEach(battery => {
    add(battery?.model)
  })

  ;(Array.isArray(data.arrays) ? data.arrays : []).forEach(array => {
    add(array?.panelModel || array?.panel_model || array?.panelName || array?.panel_name)
  })

  // Keep support for the older EPVS fields as a fallback.
  add(data.inverterModel || data.inverter_model || data.inverterName || data.inverter_name)
  add(data.batteryModel || data.battery_model || data.batteryName || data.battery_name)
  add(data.panelModel || data.panel_model || data.panelName || data.panel_name)

  return [...new Set(names.map(normaliseDatasheetName).filter(Boolean))]
}

function productMatchesContractItem(product, itemName) {
  const model = normaliseDatasheetName(product?.model)
  const candidate = normaliseDatasheetName(itemName)

  if (!model || !candidate) return false

  return model === candidate
}

`

source = source.slice(0, start) + replacement + source.slice(end)
fs.writeFileSync(file, source)
console.log("Solar datasheet matching now uses products.model against OpenSolar hardware model values.")

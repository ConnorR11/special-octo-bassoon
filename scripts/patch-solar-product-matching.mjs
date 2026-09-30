import fs from "node:fs"

const path = "src/contracts/GenerateSolarContract.js"
let source = fs.readFileSync(path, "utf8")

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

  // New OpenSolar hardware structure.
  ;(Array.isArray(data.hardware?.panels) ? data.hardware.panels : []).forEach(panel => {
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

source = source.slice(0, start) + replacement + source.slice(end)

// Add a helper that reads the panel manufacturer/model from the new OpenSolar
// hardware payload while retaining compatibility with the older EPVS fields.
const helperMarker = "function isPanelItem(name, type = \"\") {"
if (!source.includes("function getPanelHardwareInfo(data)")) {
  const helper = `function getPanelHardwareInfo(data) {
  const source = data || {}
  const hardwarePanels = Array.isArray(source.hardware?.panels) ? source.hardware.panels : []
  const legacyPanels = Array.isArray(source.panels) ? source.panels : []
  const panels = hardwarePanels.length ? hardwarePanels : legacyPanels
  const panel = panels.find(item => item && (item.model || item.name || item.manufacturer)) || panels[0] || null

  if (!panel) return { model: "", manufacturer: "", displayName: "Panels", quantity: 0, wattage: 0 }

  const manufacturer = String(panel.manufacturer || "").trim()
  const model = String(panel.model || panel.name || "").trim()
  const displayName = [manufacturer, model].filter(Boolean).join(" — ") || "Panels"
  const quantity = positiveNumber(
    panel.quantity ?? panel.panelCount ?? panel.panel_count ?? panel.numberOfPanels ?? panel.number_of_panels
  )
  const wattage = positiveNumber(panel.capacity || panel.wattage || panel.panelWattage || panel.panel_wattage)

  return { model, manufacturer, displayName, quantity, wattage }
}

`
  source = source.replace(helperMarker, helper + helperMarker)
}

// Make the panel quantity use OpenSolar hardware.quantity first, with the
// existing array-based quantity remaining as a fallback.
const countStart = source.indexOf("function getTotalPanelCount(data) {")
const countEnd = source.indexOf("\n}\n\nfunction getPanelHardwareInfo", countStart)
if (countStart !== -1 && countEnd !== -1) {
  const countReplacement = `function getTotalPanelCount(data) {
  const source = data || {}

  const hardwarePanels = Array.isArray(source.hardware?.panels) ? source.hardware.panels : []
  const hardwareTotal = hardwarePanels.reduce((total, panel) => total + getPanelCountFromEntry(panel), 0)
  if (hardwareTotal > 0) return hardwareTotal

  const arrays = Array.isArray(source.arrays) ? source.arrays : []
  const arrayTotal = arrays.reduce((total, array) => total + getPanelCountFromEntry(array), 0)
  if (arrayTotal > 0) return arrayTotal

  const panels = Array.isArray(source.panels) ? source.panels : []
  const panelTotal = panels.reduce((total, panel) => total + getPanelCountFromEntry(panel), 0)
  if (panelTotal > 0) return panelTotal

  return getPanelCountFromEntry(source) || positiveNumber(
    source.totalPanels ??
    source.total_panels ??
    source.totalPanelCount ??
    source.total_panel_count
  )
}`
  source = source.slice(0, countStart) + countReplacement + source.slice(countEnd + 2)
}

// Interpolation: {{panel_type}} now resolves to the OpenSolar manufacturer + model.
const oldPanelType = 'panel_type: data.panelType || data.panel_type || data.panelModel || data.panel_model || data.panelName || data.panel_name || "Panels",'
const newPanelType = 'panel_type: getPanelHardwareInfo(data).displayName || data.panelType || data.panel_type || data.panelModel || data.panel_model || data.panelName || data.panel_name || "Panels",'
if (source.includes(oldPanelType)) {
  source = source.replace(oldPanelType, newPanelType)
}

// Itemised breakdown: the row named "Panels" keeps its configured label in
// the template, but the rendered product name becomes the OpenSolar panel
// manufacturer/model and the QTY becomes OpenSolar hardware.quantity.
const oldItemBlock = `const items = configured.map(item => {
    const name = typeof item === "string" ? item : item?.name ?? "—"
    const type = typeof item === "string" ? "" : item?.type ?? ""
    let quantity = typeof item === "string" ? 1 : item?.quantity ?? 1
    if (isPanelItem(name, type)) quantity = panelCount`
const newItemBlock = `const items = configured.map(item => {
    let name = typeof item === "string" ? item : item?.name ?? "—"
    const type = typeof item === "string" ? "" : item?.type ?? ""
    let quantity = typeof item === "string" ? 1 : item?.quantity ?? 1

    if (isPanelItem(name, type)) {
      const panelInfo = getPanelHardwareInfo(data)
      name = panelInfo.displayName
      quantity = panelInfo.quantity > 0 ? panelInfo.quantity : panelCount
    }`
if (source.includes(oldItemBlock)) {
  source = source.replace(oldItemBlock, newItemBlock)
}

fs.writeFileSync(path, source)
console.log("Patched solar contract to use OpenSolar panel model and quantity.")

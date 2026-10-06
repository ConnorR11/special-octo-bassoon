import jsPDF from "jspdf"
import { PDFDocument } from "pdf-lib"
import { supabase } from "../lib/supabase"

const CONTRACT_NAME = "Digital Solar Contract"

const rgb = (v, fallback = [11, 93, 138]) => {
  const h = String(v || "").replace("#", "")
  return /^[0-9a-f]{6}$/i.test(h)
    ? [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
    : fallback
}
const textValue = (v, fallback = "—") => v === undefined || v === null || v === "" ? fallback : String(v)
const num = (v, d = 0) => Number(v || 0).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d })
const money = (v) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number(v || 0))
const date = (v) => {
  if (!v) return "—"
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}

function getOpenSolarImageUrl(appointment) {
  return String(appointment?.open_solar_image || "").trim()
}

function getOpenSolarHardware(data) {
  const direct = data?.hardware || {}
  const openSolar = data?.openSolar?.hardware || {}

  const mergeHardware = (type) => {
    const directItems = Array.isArray(direct?.[type]) ? direct[type] : []
    const openSolarItems = Array.isArray(openSolar?.[type]) ? openSolar[type] : []

    if (!directItems.length) return openSolarItems
    if (!openSolarItems.length) return directItems

    // OpenSolar can contain the current model/quantity while the flattened
    // hardware record contains manufacturer details. Merge the first matching
    // hardware item so no manufacturer/model/quantity information is lost.
    return openSolarItems.map((item, index) => ({
      ...(directItems[index] || {}),
      ...(item || {}),
    })).concat(
      directItems.slice(openSolarItems.length)
    )
  }

  const panels = mergeHardware("panels")
  const inverters = mergeHardware("inverters")
  const batteries = mergeHardware("batteries")

  if (panels.length || inverters.length || batteries.length) {
    return { panels, inverters, batteries }
  }

  return null
}

function getHardwareItem(data, type) {
  const source = data || {}
  const hardware = getOpenSolarHardware(source)
  const collection = Array.isArray(hardware?.[type]) ? hardware[type] : []
  const legacyCollection = Array.isArray(source?.[type]) ? source[type] : []
  const entries = collection.length ? collection : legacyCollection
  return entries.find(Boolean) || null
}

function getContractHardwareItem(name, data) {
  const normalized = String(name || "").trim().toLowerCase()
  const panelItem = getPanelHardware(data) || getHardwareItem(data, "panels")
  const inverterItem = getHardwareItem(data, "inverters") || data?.inverter
  const batteryItem =
    getHardwareItem(data, "batteries") ||
    getHardwareItem(data, "storage") ||
    data?.battery ||
    data?.storage

  const matchesItem = (candidate, value) => {
    if (!candidate || !value) return false

    return [candidate?.model, candidate?.name]
      .map(value => String(value || "").trim().toLowerCase())
      .filter(Boolean)
      .includes(value)
  }

  if (
    normalized === "panels" ||
    /\bpanels$/i.test(normalized) ||
    matchesItem(panelItem, normalized) ||
    normalized === String(data?.panelModel || data?.panel_model || "").trim().toLowerCase()
  ) {
    return { item: panelItem, label: "Panels" }
  }

  if (
    normalized === "inverter" ||
    /\binverter$/i.test(normalized) ||
    matchesItem(inverterItem, normalized)
  ) {
    return { item: inverterItem, label: "Inverter" }
  }

  if (
    normalized === "battery" ||
    /\bbattery$/i.test(normalized) ||
    matchesItem(batteryItem, normalized)
  ) {
    return { item: batteryItem, label: "Battery" }
  }

  return { item: null, label: name }
}

function getContractItemName(name, data) {
  const resolved = getContractHardwareItem(name, data)
  if (!resolved.item) return name

  const manufacturer = String(
    resolved.item?.manufacturer ||
    resolved.item?.make ||
    resolved.item?.brand ||
    ""
  ).trim()

  const model = String(
    resolved.item?.model ||
    resolved.item?.name ||
    ""
  ).trim()

  return [manufacturer, model, resolved.label]
    .filter(Boolean)
    .join(" ")
}

function getPanelHardware(data) {
  const hardware = getOpenSolarHardware(data)
  const panels = Array.isArray(hardware?.panels) ? hardware.panels : []
  return panels[0] || null
}

function getTotalPanelCount(data) {
  const source = data || {}
  const hardware = getOpenSolarHardware(source)
  const hardwarePanels = Array.isArray(hardware?.panels) ? hardware.panels : []
  const hardwareTotal = hardwarePanels.reduce((total, panel) => {
    const count = Number(panel?.quantity ?? panel?.panelCount ?? panel?.panel_count ?? 0)
    return total + (Number.isFinite(count) && count > 0 ? count : 0)
  }, 0)
  if (hardwareTotal > 0) return hardwareTotal

  const arrays = Array.isArray(source.arrays) ? source.arrays : []
  const arrayTotal = arrays.reduce((total, array) => {
    const count = Number(
      array?.panelCount ?? array?.panel_count ?? array?.numberOfPanels ?? array?.number_of_panels ??
      array?.moduleCount ?? array?.module_count ?? array?.quantity ?? array?.count ?? 0
    )
    return total + (Number.isFinite(count) && count > 0 ? count : 0)
  }, 0)
  if (arrayTotal > 0) return arrayTotal

  const panels = Array.isArray(source.panels) ? source.panels : []
  const panelTotal = panels.reduce((total, panel) => {
    const count = Number(
      panel?.quantity ?? panel?.panelCount ?? panel?.panel_count ?? panel?.numberOfPanels ??
      panel?.number_of_panels ?? panel?.moduleCount ?? panel?.module_count ?? panel?.count ?? 0
    )
    return total + (Number.isFinite(count) && count > 0 ? count : 0)
  }, 0)
  if (panelTotal > 0) return panelTotal

  const fallback = Number(
    source.panelCount ?? source.panel_count ?? source.numberOfPanels ?? source.number_of_panels ??
    source.totalPanels ?? source.total_panels ?? source.totalPanelCount ?? source.total_panel_count ?? 0
  )
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 0
}

function interpolate(bodyText, appointment, epvs) {
  const data = epvs?.data || {}
  const results = epvs?.results || {}
  const batteryCapacity = Number(data.batteryCapacity || data.battery_capacity || 0)
  const panelHardware = getPanelHardware(data)
  const panelModel = panelHardware?.model || data.panelType || data.panel_type || data.panelModel || data.panel_model || data.panelName || data.panel_name || "Panels"
  const panelQuantity =
    panelHardware?.quantity ??
    data.panelQuantity ??
    data.panel_quantity ??
    getTotalPanelCount(data)

  const values = {
    customer_name: appointment?.name || data.customerName,
    customer_address: appointment?.address || data.address,
    postcode: appointment?.postcode || data.postcode,
    phone: appointment?.phone || appointment?.phone_number_1,
    email: appointment?.email || appointment?.email_address,
    appointment_date: date(appointment?.appointment_date),
    salesperson: appointment?.salesperson || appointment?.rep_allocated,
    open_solar_image: getOpenSolarImageUrl(appointment),
    system_size: results.systemSize ? `${num(results.systemSize, 2)} kWp` : "—",
    panel_type: panelModel,
    panel_count: num(panelQuantity),
    panel_wattage: data.panelWattage || data.panel_wattage ? `${num(data.panelWattage || data.panel_wattage)} W` : "—",
    inverter_type: data.inverterType || data.inverter_type || data.inverterModel || data.inverter_model || data.inverterName || data.inverter_name || "Inverter",
    inverter_quantity: data.inverterQuantity ?? data.inverter_quantity ?? 1,
    inverter_capacity: data.inverterCapacity || data.inverter_capacity ? `${num(data.inverterCapacity || data.inverter_capacity, 1)} kW` : "—",
    battery_type: data.batteryType || data.battery_type || data.batteryModel || data.battery_model || data.batteryName || data.battery_name || "Battery",
    battery_quantity: data.batteryQuantity ?? data.battery_quantity ?? 1,
    battery_capacity: batteryCapacity > 0 ? `${num(batteryCapacity, 1)} kWh` : "Not included",
    system_cost: money(data.systemCost),
    annual_generation: results.generation ? `${num(results.generation)} kWh` : "—",
    annual_saving: money(results.annualSaving)
  }

  return String(bodyText || "").replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => textValue(values[key]))
}

async function imageData(url) {
  const source = String(url || "").trim()
  if (!source) throw new Error("No image URL was provided.")
  let requestUrl = source
  const parsed = new URL(source, window.location.origin)
  if (parsed.hostname === "api.opensolar.com" || parsed.hostname.endsWith(".opensolar.com")) {
    requestUrl = `/api/opensolar-image?url=${encodeURIComponent(source)}`
  }
  const response = await fetch(requestUrl)
  if (!response.ok) throw new Error(`Image request returned HTTP ${response.status}`)
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = objectUrl
    await image.decode()
    const canvas = document.createElement("canvas")
    canvas.width = image.naturalWidth || image.width
    canvas.height = image.naturalHeight || image.height
    if (!canvas.width || !canvas.height) throw new Error("Image returned no dimensions.")
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Unable to create image canvas.")
    context.drawImage(image, 0, 0)
    return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function getSignatureImageUrl(appointment) {
  const path = String(appointment?.signature_path || "").trim()
  if (!path) return null
  try {
    const { data, error } = await supabase.storage.from("signatures").createSignedUrl(path, 600)
    if (error) {
      console.error("Unable to create signature signed URL:", error)
      return null
    }
    return data?.signedUrl || null
  } catch (error) {
    console.error("Unable to retrieve signature:", error)
    return null
  }
}

function normaliseDatasheetName(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ")
}

function getContractProductNames(appointment, epvs, pages) {
  const data = epvs?.data || {}
  const names = []
  const add = (value) => {
    const resolved = interpolate(String(value || ""), appointment, epvs).trim()
    if (resolved && resolved !== "—") names.push(resolved)
  }

  ;(Array.isArray(pages) ? pages : []).forEach((page) => {
    const items = Array.isArray(page?.settings?.included_items) ? page.settings.included_items : []
    items.forEach((item) => add(typeof item === "string" ? item : item?.name))
  })
  ;(Array.isArray(data.inverters) ? data.inverters : []).forEach((item) => { add(item?.model); add(item?.name) })
  ;(Array.isArray(data.batteries) ? data.batteries : []).forEach((item) => { add(item?.model); add(item?.name) })
  ;(Array.isArray(data.panels) ? data.panels : []).forEach((item) => { add(item?.model); add(item?.name) })
  const hardware = getOpenSolarHardware(data)
  ;(Array.isArray(hardware?.panels) ? hardware.panels : []).forEach((item) => {
    add(item?.model)
    add(item?.name)
    if (item?.manufacturer && item?.model) add(`${item.manufacturer} ${item.model}`)
  })
  add(data.inverter?.model); add(data.inverter?.name)
  add(data.battery?.model); add(data.battery?.name)
  add(data.storage?.model); add(data.storage?.name)
  add(data.inverterModel || data.inverter_model || data.inverterName || data.inverter_name)
  add(data.batteryModel || data.battery_model || data.batteryName || data.battery_name)
  add(data.panelModel || data.panel_model || data.panelName || data.panel_name)
  ;(Array.isArray(data.arrays) ? data.arrays : []).forEach((array) => add(array?.panelModel || array?.panel_model || array?.panelName || array?.panel_name))

  return [...new Set(names.map(normaliseDatasheetName).filter(Boolean))]
}

function productMatchesContractItem(product, itemName) {
  const values = [product?.name, product?.model, [product?.manufacturer, product?.model].filter(Boolean).join(" ")]
    .map(normaliseDatasheetName)
    .filter((value) => value.length >= 3)
  return values.some((value) => value === itemName || value.includes(itemName) || itemName.includes(value))
}

async function getProductDatasheetPaths(appointment, epvs, pages) {
  const names = getContractProductNames(appointment, epvs, pages)
  if (!names.length) return []
  const { data: products, error } = await supabase.from("products").select("name,model,manufacturer,datasheet_path,active").eq("active", true).not("datasheet_path", "is", null)
  if (error) throw error
  const out = []
  const seen = new Set()
  ;(products || []).forEach((product) => {
    const path = String(product?.datasheet_path || "").trim()
    if (!path || seen.has(path)) return
    if (names.some((name) => productMatchesContractItem(product, name))) {
      seen.add(path)
      out.push(path)
    }
  })
  return out
}

async function appendProductDatasheets(pdf, appointment, epvs, pages) {
  const paths = await getProductDatasheetPaths(appointment, epvs, pages)
  const base = pdf.output("arraybuffer")
  if (!paths.length) return new Uint8Array(base)
  const merged = await PDFDocument.load(base)
  for (const path of paths) {
    const { data, error } = await supabase.storage.from("product-datasheets").createSignedUrl(path, 600)
    if (error) throw new Error("Unable to create datasheet URL for " + path + ": " + (error.message || error))
    const url = data?.signedUrl
    if (!url) throw new Error("No signed URL was returned for datasheet " + path + ".")
    const response = await fetch(url)
    if (!response.ok) throw new Error("Datasheet request returned HTTP " + response.status + " for " + path + ".")
    const source = await PDFDocument.load(await response.arrayBuffer())
    const copiedPages = await merged.copyPages(source, source.getPageIndices())
    copiedPages.forEach((page) => merged.addPage(page))
  }
  return merged.save()
}

async function drawImage(pdf, url, x, y, width, maxHeight = 110) {
  const image = await imageData(url)
  const inner = Math.max(1, width - 4)
  const ratio = image.width / image.height
  let w = inner
  let h = w / ratio
  if (h > maxHeight) {
    h = maxHeight
    w = h * ratio
  }
  const ix = x + (width - w) / 2
  pdf.setFillColor(245, 247, 249)
  pdf.roundedRect(x, y, width, h + 4, 2.5, 2.5, "F")
  pdf.addImage(image.dataUrl, "PNG", ix, y + 2, w, h, undefined, "FAST")
  return y + h + 12
}

function drawAccreditationLogo(pdf, item, x, y, width, height, accent) {
  const name = String(item?.name || "").trim().toLowerCase()
  const logoType = String(item?.logo_type || "").trim().toLowerCase() ||
    (name.includes("napit") ? "napit" : name.includes("hies") ? "hies" : name.includes("mcs") ? "mcs" : "generic")

  pdf.setFillColor(255, 255, 255)
  pdf.roundedRect(x, y, width, height, 2.5, 2.5, "F")

  if (logoType === "mcs") {
    const size = Math.min(height - 5, width - 5)
    const bx = x + (width - size) / 2
    const by = y + 2.5
    pdf.setFillColor(18, 18, 18)
    pdf.rect(bx, by, size, size, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(Math.max(10, size * 0.58))
    pdf.text("MCS", bx + size / 2, by + size * 0.53, { align: "center" })
    pdf.setFontSize(Math.max(4.5, size * 0.18))
    pdf.text("CERTIFIED", bx + size / 2, by + size * 0.84, { align: "center" })
    return
  }

  if (logoType === "napit") {
    const iconX = x + 6
    const iconY = y + 4
    const iconW = 13
    const iconH = height - 8
    pdf.setFillColor(0, 82, 155)
    for (let i = 0; i < 8; i += 1) pdf.rect(iconX, iconY + i * (iconH / 8), iconW * 0.72, iconH / 8 - 0.7, "F")
    pdf.setDrawColor(235, 55, 50)
    pdf.setLineWidth(2.2)
    pdf.line(iconX + 1, iconY + iconH * 0.55, iconX + iconW * 0.34, iconY + iconH * 0.82)
    pdf.line(iconX + iconW * 0.34, iconY + iconH * 0.82, iconX + iconW, iconY + iconH * 0.18)
    pdf.setTextColor(0, 82, 155)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(15)
    pdf.text("NAPIT", x + width - 5, y + height * 0.61, { align: "right" })
    return
  }

  if (logoType === "hies") {
    pdf.setTextColor(0, 112, 82)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(23)
    pdf.text("hies", x + width / 2, y + height * 0.52, { align: "center" })
    pdf.setDrawColor(230, 119, 49)
    pdf.setLineWidth(0.8)
    pdf.line(x + 8, y + height * 0.64, x + width - 8, y + height * 0.64)
    pdf.setTextColor(0, 112, 82)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(4.8)
    pdf.text("QUALITY ASSURED CONTRACTORS SCHEME", x + width / 2, y + height * 0.79, { align: "center" })
    return
  }

  const initials = String(item?.name || "Accreditation")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase()
  pdf.setFillColor(...accent)
  pdf.circle(x + width / 2, y + height / 2 - 1, Math.min(width, height) * 0.25, "F")
  pdf.setTextColor(255, 255, 255)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(11)
  pdf.text(initials, x + width / 2, y + height / 2 + 3, { align: "center" })
}

function header(pdf, settings) {
  const width = pdf.internal.pageSize.getWidth()
  const height = pdf.internal.pageSize.getHeight()
  const accent = rgb(settings.accent)
  const text = rgb(settings.text_color, [16, 33, 43])
  const padding = Number(settings.padding_mm || 18)
  pdf.setFillColor(...rgb(settings.background, [255, 255, 255]))
  pdf.rect(0, 0, width, height, "F")
  if (settings.show_header !== false) {
    pdf.setFillColor(...accent)
    pdf.rect(0, 0, width, 14, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(8)
    pdf.text("HOMESHIELD SCOTLAND LTD", padding, 9)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7)
    pdf.text(CONTRACT_NAME, width - padding, 9, { align: "right" })
  }
  return { width, height, accent, text, padding, y: settings.show_header === false ? padding : 24 }
}

function title(pdf, page, ctx) {
  const terms = page?.settings?.page_kind === "terms_conditions"
  const ty = terms ? ctx.y - 2 : ctx.y + 4
  pdf.setTextColor(...ctx.text)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(terms ? 16 : 22)
  pdf.text(page.title || "", ctx.padding, ty)
  if (page.subtitle) {
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(terms ? 7.5 : 9)
    pdf.setTextColor(100, 112, 120)
    pdf.text(page.subtitle, terms ? ctx.width - ctx.padding : ctx.padding, terms ? ty : ctx.y + 11, terms ? { align: "right" } : {})
  }
  pdf.setFillColor(...ctx.accent)
  if (terms) pdf.rect(ctx.padding, ctx.y + 2, ctx.width - ctx.padding * 2, 1.2, "F")
  else pdf.rect(ctx.padding, ctx.y + 15, 28, 1.2, "F")
}

function rows(pdf, values, x, y, width, text, compact = false) {
  const h = compact ? 8 : 10
  values.forEach(([label, value], index) => {
    if (index % 2 === 0) {
      pdf.setFillColor(246, 248, 250)
      pdf.roundedRect(x, y - 5.5, width, h, 1.5, 1.5, "F")
    }
    pdf.setTextColor(...text)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(compact ? 7.5 : 8.5)
    pdf.text(String(label), x + 4, y)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(72, 84, 92)
    pdf.text(String(value), x + width - 4, y, { align: "right" })
    y += h
  })
  return y
}

function body(pdf, content, x, y, width, textRgb, appointment, epvs) {
  if (!content) return y
  const cleaned = String(content).replace(/(^|\r?\n)\s*{{open_solar_image}}\s*(?=\r?\n|$)/g, "$1")
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(9)
  pdf.setTextColor(...textRgb)
  interpolate(cleaned, appointment, epvs).split(/\r?\n/).forEach((line) => {
    if (!line.trim()) {
      y += 4
      return
    }
    pdf.splitTextToSize(line, width).forEach((part) => {
      pdf.text(part, x, y)
      y += 4.8
    })
    y += 2
  })
  return y
}

async function getExpressFitSignatureImageUrl(appointment) {
  const path = String(appointment?.express_fit_signature_path || "").trim()
  if (!path) return null
  try {
    const { data, error } = await supabase.storage.from("signatures").createSignedUrl(path, 600)
    if (error) {
      console.error("Unable to create Express Fit signature signed URL:", error)
      return null
    }
    return data?.signedUrl || null
  } catch (error) {
    console.error("Unable to retrieve Express Fit signature:", error)
    return null
  }
}

const EXPRESS_FIT_DISCLAIMER = "By signing and returning this document you are providing your agreement in writing to enable us to commence work within the cancellation period which starts when the customer signs the contract and ends 14 days after all of the goods relating to the contract are delivered to the customer's home.\\n\\nPlease Note: If you consent for work to begin within the cancellation period and you later exercise your right to cancel you will be liable for the cost of work performed up to the point of cancellation. You will also lose the right to cancel the contract within the cancellation period when the installation is completely finished. When this occurs the company can charge the full contract price.\\n\\nI/We understand that signing of this document does not affect my/our right to cancel the contract in the cancellation period which starts when I/we sign the contract and ends 14 days after all of the goods relating to the contract are delivered to my/our home.\\n\\nI/We hereby give express consent for Homeshield Scotland Ltd T/A Homeshield Renewables to commence work on the agreed installation date."

async function drawContractTotalAndSignature(pdf, ctx, data, results, appointment, y) {
  const width = ctx.width - ctx.padding * 2
  const price = results?.systemCost ?? data?.systemCost ?? appointment?.system_cost ?? appointment?.contract_value ?? appointment?.sale_value ?? appointment?.price
  const cardHeight = 38

  pdf.setFillColor(...ctx.accent)
  pdf.roundedRect(ctx.padding, y, width, cardHeight, 3, 3, "F")

  const signatureUrl = await getSignatureImageUrl(appointment)
  if (signatureUrl) {
    try {
      const signature = await imageData(signatureUrl)
      const sx = ctx.padding + 7
      const sy = y + 6
      const sw = Math.min(65, width * 0.45)
      const sh = 20
      pdf.setTextColor(255, 255, 255)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(6.5)
      pdf.text("CUSTOMER SIGNATURE", sx, sy)
      pdf.setFillColor(252, 253, 254)
      pdf.roundedRect(sx, sy + 2.5, sw, sh - 4, 1.5, 1.5, "F")
      const mw = sw - 8
      const mh = sh - 9
      const ratio = signature.width / signature.height
      let w = mw
      let h = w / ratio
      if (h > mh) {
        h = mh
        w = h * ratio
      }
      pdf.addImage(signature.dataUrl, "PNG", sx + (sw - w) / 2, sy + 3 + (mh - h) / 2, w, h, undefined, "FAST")
    } catch (error) {
      console.error("Unable to add customer signature to contract:", error)
    }
  }

  const tableLeft = ctx.padding + width * 0.61
  const tableRight = ctx.padding + width - 7
  const tableTop = y + 5
  const tableBottom = y + cardHeight - 5
  const tableMid = tableLeft + (tableRight - tableLeft) * 0.58
  const rowHeight = (tableBottom - tableTop) / 4

  const systemCost = Number(price || 0)
  const explicitDeposit = Number(data?.deposit || appointment?.deposit || 0)
  const financeMonths = Number(data?.financeTerm || 0) * 12
  const inferredDeposit = data?.paymentMethod === "Finance" && financeMonths > 0
    ? Number(results?.totalContractValue || 0) - Number(results?.monthlyPayment || 0) * financeMonths
    : 0
  const deposit = explicitDeposit > 0 ? explicitDeposit : Math.max(0, inferredDeposit)
  const adminFee = 399
  const totalCost = systemCost + adminFee

  const paymentRows = [
    ["System cost", systemCost],
    ["Deposit", deposit],
    ["Admin Fee", adminFee],
    ["Total Cost", totalCost],
  ]

  pdf.setDrawColor(255, 255, 255)
  pdf.setLineWidth(0.2)
  pdf.line(tableMid, tableTop, tableMid, tableBottom)

  paymentRows.forEach(([label, value], index) => {
    const rowTop = tableTop + index * rowHeight
    const rowBottom = rowTop + rowHeight
    const isTotal = index === paymentRows.length - 1

    if (index > 0) {
      pdf.line(tableLeft, rowTop, tableRight, rowTop)
    }

    pdf.setTextColor(255, 255, 255)
    pdf.setFont("helvetica", isTotal ? "bold" : "normal")
    pdf.setFontSize(isTotal ? 6.6 : 6.2)
    pdf.text(label, tableLeft + 2, rowTop + rowHeight * 0.68)

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(isTotal ? 8.2 : 7)
    pdf.text(money(value), tableRight - 2, rowTop + rowHeight * 0.68, { align: "right" })
  })
  return y + cardHeight
}

async function drawExpressFitSection(pdf, ctx, appointment, y) {
  const width = ctx.width - ctx.padding * 2
  const footerY = pdf.internal.pageSize.getHeight() - 13
  const footerGap = 4
  const side = 6
  const availableHeight = Math.max(28, footerY - footerGap - (y + 3))

  // Keep the disclaimer on the same page as the itemised table. The section is
  // deliberately compact so it can fit into the remaining space without ever
  // moving upwards over the final product rows.
  const signatureBoxWidth = Math.min(52, width * 0.28)
  const signatureBoxHeight = Math.min(14, Math.max(11, availableHeight * 0.27))
  const signatureColumnWidth = signatureBoxWidth + 4
  const textWidth = Math.max(90, width - side * 2 - signatureColumnWidth - 5)
  const lineHeight = Math.max(2.45, Math.min(2.8, availableHeight / 22))
  const paragraphGap = Math.max(0.8, Math.min(1.5, availableHeight / 42))
  const titleHeight = 7

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(5.35)
  const paragraphs = EXPRESS_FIT_DISCLAIMER.split(/\\n\\n/)
  const paragraphLines = paragraphs.map((paragraph) => pdf.splitTextToSize(paragraph, textWidth))
  const textHeight = paragraphLines.reduce((total, lines) => total + lines.length * lineHeight + paragraphGap, 0)

  // Size to the space actually available. Never position the card above `y`.
  const naturalHeight = titleHeight + textHeight + 5
  const cardHeight = Math.min(availableHeight, Math.max(27, naturalHeight))
  const top = y + 3

  pdf.setFillColor(246, 248, 250)
  pdf.setDrawColor(218, 226, 232)
  pdf.setLineWidth(0.35)
  pdf.roundedRect(ctx.padding, top, width, cardHeight, 3, 3, "FD")

  pdf.setTextColor(...ctx.text)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(7)
  pdf.text("EXPRESS FIT CONSENT", ctx.padding + side, top + 7)

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(5.35)
  pdf.setTextColor(72, 84, 92)
  let textY = top + 13
  const maxTextY = top + cardHeight - 4
  paragraphLines.forEach((lines, paragraphIndex) => {
    const visibleLines = Math.max(1, Math.floor((maxTextY - textY) / lineHeight))
    const clippedLines = lines.slice(0, visibleLines)
    if (clippedLines.length) {
      pdf.text(clippedLines, ctx.padding + side, textY)
      textY += clippedLines.length * lineHeight + paragraphGap
    }
    if (paragraphIndex === paragraphLines.length - 1) return
  })

  // Signature occupies its own column on the right and is anchored to the
  // bottom of the card, so the disclaimer text can never run underneath it.
  const signatureX = ctx.padding + width - signatureBoxWidth - side
  const signatureLabelY = top + cardHeight - signatureBoxHeight - 7
  pdf.setTextColor(...ctx.text)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(5.5)
  const labelLines = pdf.splitTextToSize("CUSTOMER EXPRESS FIT ACCEPTANCE SIGNATURE", signatureBoxWidth)
  pdf.text(labelLines, signatureX, signatureLabelY - Math.max(0, (labelLines.length - 1) * 2.1))

  pdf.setFillColor(255, 255, 255)
  pdf.roundedRect(signatureX, signatureLabelY + 1.5, signatureBoxWidth, signatureBoxHeight, 1.3, 1.3, "F")

  const signatureUrl = await getExpressFitSignatureImageUrl(appointment)
  if (signatureUrl) {
    try {
      const signature = await imageData(signatureUrl)
      const mw = signatureBoxWidth - 6
      const mh = signatureBoxHeight - 4
      const ratio = signature.width / signature.height
      let w = mw
      let h = w / ratio
      if (h > mh) {
        h = mh
        w = h * ratio
      }
      pdf.addImage(signature.dataUrl, "PNG", signatureX + (signatureBoxWidth - w) / 2, signatureLabelY + 2 + (mh - h) / 2, w, h, undefined, "FAST")
    } catch (error) {
      console.error("Unable to add Express Fit signature to contract:", error)
    }
  }
  return top + cardHeight
}

async function drawItemisedBreakdown(pdf, page, ctx, data, results, appointment, epvs) {
  const width = ctx.width - ctx.padding * 2
  const settings = page.settings || {}
  const configured = Array.isArray(settings.included_items) ? settings.included_items : []

  const items = configured.map((item) => {
    let name = typeof item === "string" ? item : item?.name ?? "—"
    const type = typeof item === "string" ? "" : item?.type ?? ""
    let quantity = typeof item === "string" ? 1 : item?.quantity ?? 1

    const resolved = getContractHardwareItem(name, data)
    if (resolved.item) {
      name = getContractItemName(name, data)
      quantity = resolved.item?.quantity ?? quantity
    }

    if (String(name).trim().toLowerCase() === "roof hooks" || String(name).trim().toLowerCase() === "rail fix kit") {
      quantity = "-"
    }
    if (String(name).trim().toLowerCase() === "panel installation") quantity = 1

    return { name, type, quantity }
  })

  const headerY = ctx.y + 28
  const typeX = ctx.padding + width - 43
  const rowHeight = 6.8
  pdf.setFillColor(...ctx.accent)
  pdf.roundedRect(ctx.padding, headerY - 7, width, 11, 2, 2, "F")
  pdf.setTextColor(255, 255, 255)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(8)
  pdf.text("PRODUCT / SERVICE", ctx.padding + 7, headerY)
  pdf.text("TYPE", typeX, headerY, { align: "center" })
  pdf.text("QTY", ctx.padding + width - 7, headerY, { align: "right" })

  let y = headerY + 8.3
  items.forEach((item, index) => {
    const name = interpolate(String(item.name), appointment, epvs)
    const type = interpolate(String(item.type), appointment, epvs)
    const quantity = interpolate(String(item.quantity), appointment, epvs)
    if (index % 2 === 0) {
      pdf.setFillColor(247, 249, 250)
      pdf.roundedRect(ctx.padding, y - 5.0, width, rowHeight, 1.2, 1.2, "F")
    }
    pdf.setTextColor(...ctx.text)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    pdf.text(name, ctx.padding + 7, y)
    if (type) {
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(6.2)
      const tw = pdf.getTextWidth(type) + 6
      const key = type.toLowerCase()
      const fill = key === "service" ? [255, 241, 230] : key === "product" ? [231, 242, 248] : [238, 240, 242]
      const colour = key === "service" ? [199, 106, 0] : key === "product" ? [11, 93, 138] : [75, 85, 92]
      pdf.setFillColor(...fill)
      pdf.setTextColor(...colour)
      pdf.roundedRect(typeX - tw / 2, y - 3.6, tw, 4.2, 2, 2, "F")
      pdf.text(type, typeX, y - 0.45, { align: "center" })
    }
    pdf.setTextColor(...ctx.text)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(8)
    pdf.text(quantity, ctx.padding + width - 7, y, { align: "right" })
    y += rowHeight
  })
  y += 3
  await drawExpressFitSection(pdf, ctx, appointment, y)
}


function parseTermsSections(raw) {
  const out = []
  let current = []
  String(raw || "").replace(/\r/g, "").split("\n").forEach((line) => {
    const text = line.trim()
    if (/^\d+\.\s+/.test(text)) {
      if (current.length) out.push(current.join(" ").trim())
      current = [text]
    } else if (text) {
      current.push(text)
    }
  })
  if (current.length) out.push(current.join(" ").trim())
  return out.filter(Boolean)
}

function drawTermsConditions(pdf, page, ctx, appointment, epvs) {
  const settings = page.settings || {}
  const width = ctx.width - ctx.padding * 2
  const gap = Number(settings.column_gap_mm || 6)
  const columnWidth = (width - gap) / 2
  const top = ctx.y + 10
  const bottom = ctx.height - 17
  let fontSize = Number(settings.font_size || 6.5)
  let lineHeight = Number(settings.line_height || 3.1)
  const spacing = Number(settings.section_spacing || 2)
  const headingSize = Number(settings.heading_font_size || 7)
  const sections = parseTermsSections(interpolate(String(page.body || ""), appointment, epvs))
  const makeLines = () => {
    const lines = []
    sections.forEach((section) => {
      const normalized = section.replace(/\s+/g, " ").trim()
      const match = normalized.match(/^(\d+\.\s+)(.*)$/)
      if (!match) {
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(fontSize)
        pdf.splitTextToSize(normalized, columnWidth).forEach((text) => lines.push({ text }))
        lines.push({ spacing })
        return
      }
      const headingMatch = match[2].match(/^(.+?\.)\s+(.*)$/)
      const prefix = match[1] + (headingMatch ? headingMatch[1] + " " : "")
      const bodyText = headingMatch ? headingMatch[2] : match[2]
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(headingSize)
      const prefixWidth = pdf.getTextWidth(prefix)
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(fontSize)
      if (prefixWidth < columnWidth - 10) {
        const first = (pdf.splitTextToSize(bodyText, Math.max(10, columnWidth - prefixWidth))[0] || "")
        lines.push({ text: first, boldPrefix: prefix })
        const rest = bodyText.slice(first.length).trim()
        if (rest) pdf.splitTextToSize(rest, columnWidth).forEach((text) => lines.push({ text }))
      } else {
        lines.push({ text: prefix })
        pdf.splitTextToSize(bodyText, columnWidth).forEach((text) => lines.push({ text }))
      }
      lines.push({ spacing })
    })
    return lines
  }

  let lines = makeLines()
  for (let i = 0; i < 12; i += 1) {
    const capacity = Math.floor((bottom - top) / lineHeight) * 2
    const required = lines.filter((line) => !line.spacing).length
    if (required <= capacity) break
    fontSize = Math.max(5.15, fontSize * 0.96)
    lineHeight = Math.max(2.35, lineHeight * 0.96)
    lines = makeLines()
  }

  let column = 0
  let x = ctx.padding
  let y = top
  lines.forEach((line) => {
    if (line.spacing) {
      y += line.spacing
      return
    }
    if (y + lineHeight > bottom) {
      column += 1
      x = ctx.padding + columnWidth + gap
      y = top
    }
    if (column > 1) return
    pdf.setTextColor(...ctx.text)
    if (line.boldPrefix) {
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(headingSize)
      const prefixWidth = pdf.getTextWidth(line.boldPrefix)
      pdf.text(line.boldPrefix, x, y)
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(fontSize)
      pdf.text(line.text, x + prefixWidth, y)
    } else {
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(fontSize)
      pdf.text(line.text, x, y)
    }
    y += lineHeight
  })
}

async function renderPage(pdf, page, index, pageCount, appointment, epvs, salesRepName) {
  const settings = page.settings || {}
  const ctx = header(pdf, settings)
  const kind = settings.page_kind || "standard"
  const data = epvs?.data || {}
  const results = epvs?.results || {}

  if (kind === "cover") {
    pdf.setFillColor(...rgb(settings.background, [5, 47, 79]))
    pdf.rect(0, 0, ctx.width, ctx.height, "F")
    let logo = null
    try {
      logo = await imageData("/homeshield-logo.png")
    } catch {}
    if (logo) {
      const w = 38
      pdf.addImage(logo.dataUrl, "PNG", ctx.padding, 14, w, w * logo.height / logo.width, undefined, "FAST")
    }
    pdf.setTextColor(255, 255, 255)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(27)
    pdf.text("Solar Contract", ctx.padding, 76)

    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(11)
    pdf.text("Prepared for", ctx.padding, 89)

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(17)
    pdf.text(textValue(appointment?.name || data.customerName, "Customer"), ctx.padding, 102)

    const address = [appointment?.address, appointment?.postcode].filter(Boolean).join(", ")
    if (address) {
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(8)
      pdf.text(address, ctx.padding, 112)
    }

    // Cover identification block — keep the same blue background and
    // white typography as the rest of the customer-facing cover.
    const coverDetails = [
      ["SALES REP", salesRepName],
      ["DATE", date(new Date())],
      ["CONTRACT NUMBER", appointment?.contract_number || "—"],
    ]

    const detailX = ctx.padding
    const detailY = 136
    const detailWidth = ctx.width - ctx.padding * 2
    const columnWidth = detailWidth / coverDetails.length

    coverDetails.forEach(([label, value], index) => {
      const x = detailX + index * columnWidth

      if (index > 0) {
        pdf.setDrawColor(77, 181, 255)
        pdf.setLineWidth(0.25)
        pdf.line(x - 6, detailY - 2, x - 6, detailY + 23)
      }

      pdf.setTextColor(185, 220, 242)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(7)
      pdf.text(label, x, detailY + 3)

      pdf.setTextColor(255, 255, 255)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(index === 2 ? 13 : 10.5)
      pdf.text(String(value), x, detailY + 12)
    })

    return
  }

  title(pdf, page, ctx)
  let y = ctx.y + 28
  const width = ctx.width - ctx.padding * 2

  if (kind === "system_overview") {
    const image = getOpenSolarImageUrl(appointment)
    if (!image) throw new Error("appointments.open_solar_image is empty on this appointment.")
    y = await drawImage(pdf, image, ctx.padding, y, width, 110)
    const batteryCapacity = Number(data.batteryCapacity || data.battery_capacity || 0)
    const panelCount = getTotalPanelCount(data)
    const arrays = Array.isArray(data.arrays) ? data.arrays : []
    const panelWattage = arrays.map((array) => Number(array?.panelWattage || array?.panel_wattage || 0)).find((value) => value > 0) || Number(data.panelWattage || data.panel_wattage || 0)
    const rowsData = [
      ["Customer", textValue(appointment?.name)],
      ["System size", results.systemSize ? `${num(results.systemSize, 2)} kWp` : "—"],
      ["Solar panels", panelCount > 0 ? `${num(panelCount)} × ${num(panelWattage)} W` : "—"],
      ["Inverter", data.inverterCapacity ? `${num(data.inverterCapacity, 1)} kW` : "—"],
      ["Battery", batteryCapacity > 0 ? `${num(batteryCapacity, 1)} kWh` : "Not included"],
      ["Estimated generation", results.generation ? `${num(results.generation)} kWh / year` : "—"]
    ]
    y = rows(pdf, rowsData, ctx.padding, y + 2, width, ctx.text)
    body(pdf, page.body, ctx.padding, y + 8, width, ctx.text, appointment, epvs)
  } else if (kind === "itemised_breakdown") {
    await drawItemisedBreakdown(pdf, page, ctx, data, results, appointment, epvs)
  } else if (kind === "terms_conditions") {
    drawTermsConditions(pdf, page, ctx, appointment, epvs)
  } else if (kind === "accreditations") {
    const items = Array.isArray(settings.items) ? settings.items : []
    const cardHeight = Number(settings.card_height_mm || 46)
    const cardGap = Number(settings.card_gap_mm || 7)
    const logoWidth = Number(settings.logo_width_mm || 43)
    const logoHeight = cardHeight - 12
    const logoX = ctx.padding + 6
    const contentX = logoX + logoWidth + 8
    const contentWidth = ctx.width - ctx.padding - contentX - 6

    pdf.setTextColor(100, 112, 120)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    const intro = textValue(settings.intro_text, "Our accreditations and certifications help give customers confidence in the quality, safety and consumer protection behind our installations.")
    const introLines = pdf.splitTextToSize(intro, width)
    pdf.text(introLines, ctx.padding, y)
    y += introLines.length * 4.2 + 6

    items.forEach((item, index) => {
      const top = y + index * (cardHeight + cardGap)

      pdf.setFillColor(246, 248, 250)
      pdf.roundedRect(ctx.padding, top, width, cardHeight, 3.5, 3.5, "F")

      drawAccreditationLogo(pdf, item, logoX, top + 6, logoWidth, logoHeight, ctx.accent)

      pdf.setTextColor(...ctx.text)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(12)
      pdf.text(textValue(item.name, "Accreditation"), contentX, top + 11)

      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(7.2)
      pdf.setTextColor(100, 112, 120)
      const description = pdf.splitTextToSize(textValue(item.description, ""), contentWidth)
      pdf.text(description.slice(0, 4), contentX, top + 18)
    })

    const cardsEnd = y + items.length * (cardHeight + cardGap) - cardGap
    if (page.body) body(pdf, page.body, ctx.padding, cardsEnd + 7, width, ctx.text, appointment, epvs)
  } else if (kind === "epvs") {
    y = rows(pdf, [
      ["System size", results.systemSize ? `${num(results.systemSize, 2)} kWp` : "—"],
      ["Annual consumption", data.annualConsumption ? `${num(data.annualConsumption)} kWh` : "—"],
      ["Estimated generation", results.generation ? `${num(results.generation)} kWh` : "—"],
      ["Solar self-consumption", results.solarSelfConsumption ? `${num(results.solarSelfConsumption)} kWh` : "—"],
      ["Estimated export", results.exportKwh ? `${num(results.exportKwh)} kWh` : "—"],
      ["Annual saving", money(results.annualSaving)]
    ], ctx.padding, y, width, ctx.text, true)
    y += 10

    const arrays = Array.isArray(data.arrays)
      ? data.arrays.slice(0, Number(data.numberOfArrays || data.arrays.length))
        .map((array, index) => ({ array, index, calculated: Array.isArray(results.arrays) ? results.arrays[index] || {} : {} }))
        .filter((item) => getTotalPanelCount({ arrays: [item.array] }) > 0)
      : []

    if (arrays.length) {
      const titleY = y + 3
      pdf.setTextColor(...ctx.text)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(9)
      pdf.text("SAP Calculation", ctx.padding, titleY)
      const headers = ["Array", "Panels", "Panel Wp", "Orientation (°)", "Pitch (°)", "Irradiance / Kk", "SF", "System size (kWp)", "Generation (kWh)"]
      const widths = [14, 14, 17, 23, 17, 25, 14, 25, 29]
      const tableY = titleY + 5
      const tableX = ctx.padding
      const headerHeight = 8
      const rowHeight = 7
      let x = tableX
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(5.8)
      headers.forEach((header, index) => {
        pdf.setFillColor(...ctx.accent)
        pdf.rect(x, tableY, widths[index], headerHeight, "F")
        pdf.setTextColor(255, 255, 255)
        const lines = pdf.splitTextToSize(header, widths[index] - 2)
        pdf.text(lines.slice(0, 2), x + widths[index] / 2, tableY + (lines.length > 1 ? 3 : 5), { align: "center" })
        x += widths[index]
      })

      let rowY = tableY + headerHeight
      let totalPanels = 0
      let totalSystemSize = 0
      let totalGeneration = 0

      arrays.forEach(({ array, index, calculated }) => {
        const panelCount = getTotalPanelCount({ arrays: [array] })
        const systemSize = Number(calculated?.systemSize || 0)
        const generation = Number(calculated?.generation || 0)
        totalPanels += panelCount
        totalSystemSize += Number.isFinite(systemSize) ? systemSize : 0
        totalGeneration += Number.isFinite(generation) ? generation : 0
        const values = [
          `Array ${index + 1}`,
          num(panelCount),
          `${num(array.panelWattage || array.panel_wattage)} W`,
          `${num(array.orientation)}°`,
          `${num(array.pitch)}°`,
          num(array.irradiance, 2),
          num(array.shading, 2),
          `${num(systemSize, 2)} kWp`,
          num(generation, 2)
        ]
        x = tableX
        values.forEach((value, valueIndex) => {
          pdf.setFillColor(valueIndex % 2 === 0 ? 247 : 255, valueIndex % 2 === 0 ? 249 : 255, valueIndex % 2 === 0 ? 250 : 255)
          pdf.setDrawColor(230, 235, 240)
          pdf.rect(x, rowY, widths[valueIndex], rowHeight, "FD")
          pdf.setTextColor(...ctx.text)
          pdf.setFont("helvetica", valueIndex === 0 ? "bold" : "normal")
          pdf.setFontSize(5.9)
          pdf.text(String(value), x + widths[valueIndex] / 2, rowY + 4.6, { align: "center" })
          x += widths[valueIndex]
        })
        rowY += rowHeight
      })

      const totals = ["TOTAL", num(totalPanels), "—", "—", "—", "—", "—", `${num(totalSystemSize, 2)} kWp`, num(totalGeneration, 2)]
      x = tableX
      totals.forEach((value, index) => {
        pdf.setFillColor(...ctx.accent)
        pdf.setDrawColor(255, 255, 255)
        pdf.rect(x, rowY, widths[index], rowHeight, "FD")
        pdf.setTextColor(255, 255, 255)
        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(5.9)
        pdf.text(String(value), x + widths[index] / 2, rowY + 4.6, { align: "center" })
        x += widths[index]
      })
      y = rowY + rowHeight + 8
    }
  } else if (kind === "datasheets") {
    const documents = Array.isArray(settings.documents) ? settings.documents : []
    documents.forEach((document) => {
      pdf.setTextColor(...ctx.text)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(9)
      pdf.text(textValue(document.title, "Datasheet"), ctx.padding, y)
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(7)
      pdf.setTextColor(105, 116, 124)
      pdf.text(textValue(document.description, ""), ctx.padding, y + 5)
      y += 14
    })
    body(pdf, page.body, ctx.padding, y + 4, width, ctx.text, appointment, epvs)
  } else {
    body(pdf, page.body, ctx.padding, y, width, ctx.text, appointment, epvs)
  }
}

function footer(pdf, index, count, settings, appointment) {
  if (settings.show_footer === false) return
  const width = pdf.internal.pageSize.getWidth()
  const height = pdf.internal.pageSize.getHeight()
  const padding = Number(settings.padding_mm || 18)
  pdf.setDrawColor(...rgb(settings.accent))
  pdf.setLineWidth(0.25)
  pdf.line(padding, height - 13, width - padding, height - 13)
  pdf.setTextColor(120, 130, 138)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(6.5)
  pdf.text(textValue(appointment?.name, "Customer"), padding, height - 8)
  pdf.text(`Page ${index + 1} of ${count}`, width - padding, height - 8, { align: "right" })
}

export async function GenerateSolarContract({ appointment, epvsCalculation }) {
  if (!appointment) return

  let contractNumber = String(appointment?.contract_number || "").trim()
  let shouldPersistContractNumber = false
  let salesRepName = String(
    appointment?.salesperson ||
    appointment?.rep_allocated ||
    ""
  ).trim()

  // Appointment rep fields are often stored as the rep's email address.
  // Resolve that to the rep's display name for the customer-facing contract.
  if (salesRepName.includes("@") && supabase) {
    const { data: repProfile } = await supabase
      .from("profiles")
      .select("full_name, display_name, email")
      .ilike("email", salesRepName)
      .maybeSingle()

    salesRepName =
      String(repProfile?.full_name || repProfile?.display_name || "").trim() ||
      salesRepName
  }

  if (!salesRepName) salesRepName = "—"

  if (!contractNumber) {
    const { data: generatedContractNumber, error: contractNumberError } = await supabase
      .rpc("next_digital_solar_contract_number")
    if (contractNumberError) throw contractNumberError

    contractNumber = String(generatedContractNumber || "").trim()
    if (!contractNumber) throw new Error("Unable to generate a digital solar contract number.")

    // Keep the number in memory while the contract is being built.
    // It is only written to the appointment after the PDF has been
    // successfully generated.
    shouldPersistContractNumber = true
  }

  const contractAppointment = {
    ...appointment,
    contract_number: contractNumber,
  }

  const { data: template, error: templateError } = await supabase
    .from("templates")
    .select("id,name,template_type,active")
    .eq("name", CONTRACT_NAME)
    .eq("active", true)
    .maybeSingle()
  if (templateError) throw templateError
  if (!template) throw new Error(`Active ${CONTRACT_NAME} template could not be found.`)

  const { data: pages, error: pagesError } = await supabase
    .from("template_pages")
    .select("id,title,subtitle,body,settings,slide_order")
    .eq("presentation_id", template.id)
    .order("slide_order", { ascending: true })
  if (pagesError) throw pagesError
  if (!pages?.length) throw new Error("The Digital Solar Contract template has no pages configured.")

  let epvs = epvsCalculation || appointment?.epvs_calculation || null
  if (typeof epvs === "string") {
    try {
      epvs = JSON.parse(epvs)
    } catch {}
  }

  const pageSize = pages.find((page) => page.settings?.page_size)?.settings?.page_size || "A4"
  const orientation = pages.find((page) => page.settings?.orientation)?.settings?.orientation || "portrait"
  const pdf = new jsPDF({ unit: "mm", format: pageSize.toLowerCase(), orientation })

  for (let index = 0; index < pages.length; index += 1) {
    if (index > 0) pdf.addPage(pageSize.toLowerCase(), orientation)
    const page = pages[index]
    await renderPage(pdf, page, index, pages.length, contractAppointment, epvs, salesRepName)
    footer(pdf, index, pages.length, page.settings || {}, appointment)
  }

  const safeName = textValue(appointment?.name, "Customer")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "Customer"
  const bytes = await appendProductDatasheets(pdf, appointment, epvs, pages)

  // Only persist the contract number after the complete contract has
  // successfully rendered, including its datasheets.
  if (shouldPersistContractNumber) {
    const { error: contractUpdateError } = await supabase
      .from("appointments")
      .update({ contract_number: contractNumber })
      .eq("appointment_row_id", appointment.appointment_row_id)

    if (contractUpdateError) throw contractUpdateError
  }

  const blob = new Blob([bytes], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = safeName + "-Digital-Solar-Contract.pdf"
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

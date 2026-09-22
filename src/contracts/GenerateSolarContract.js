import jsPDF from "jspdf"
import { supabase } from "../lib/supabase"

const CONTRACT_NAME = "Digital Solar Contract"

function hexToRgb(value, fallback = [11, 93, 138]) {
  const hex = String(value || "").replace("#", "")
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return fallback
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
}
function formatDate(value) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) }
function money(value) { return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number(value || 0)) }
function number(value, decimals = 0) { return Number(value || 0).toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) }
function textValue(value, fallback = "—") { return value === undefined || value === null || value === "" ? fallback : String(value) }

async function imageUrlToDataUrl(url) {
  const source = String(url || "").trim()
  if (!source) return null
  try {
    const response = await fetch(source, { mode: "cors" })
    if (!response.ok) return null
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    try {
      const image = new Image()
      image.crossOrigin = "anonymous"
      image.src = objectUrl
      await image.decode()
      const canvas = document.createElement("canvas")
      canvas.width = image.naturalWidth || image.width
      canvas.height = image.naturalHeight || image.height
      if (!canvas.width || !canvas.height) return null
      canvas.getContext("2d").drawImage(image, 0, 0)
      return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height }
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  } catch (error) {
    console.warn("Unable to load OpenSolar design image for the contract PDF", error)
    return null
  }
}

function interpolate(text, appointment, epvs) {
  const data = epvs?.data || {}; const results = epvs?.results || {}
  const values = { customer_name: appointment?.name || data.customerName, customer_address: appointment?.address || data.address, postcode: appointment?.postcode || data.postcode, phone: appointment?.phone || appointment?.phone_number_1, email: appointment?.email || appointment?.email_address, appointment_date: formatDate(appointment?.appointment_date), salesperson: appointment?.salesperson || appointment?.rep_allocated, system_size: results.systemSize ? `${number(results.systemSize, 2)} kWp` : "—", panel_count: number(data.panelCount), panel_wattage: data.panelWattage ? `${number(data.panelWattage)} W` : "—", inverter_capacity: data.inverterCapacity ? `${number(data.inverterCapacity, 1)} kW` : "—", battery_capacity: data.batteryEnabled ? `${number(data.batteryCapacity, 1)} kWh` : "Not included", system_cost: money(data.systemCost), annual_generation: results.generation ? `${number(results.generation)} kWh` : "—", annual_saving: money(results.annualSaving) }
  return String(text || "").replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => textValue(values[key]))
}
function drawHeader(pdf, pageWidth, pageHeight, settings) {
  const accent = hexToRgb(settings.accent); const text = hexToRgb(settings.text_color, [16, 33, 43]); const padding = Number(settings.padding_mm || 18); const background = hexToRgb(settings.background, [255, 255, 255])
  pdf.setFillColor(...background); pdf.rect(0, 0, pageWidth, pageHeight, "F")
  if (settings.show_header !== false) { pdf.setFillColor(...accent); pdf.rect(0, 0, pageWidth, 14, "F"); pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.text("HOMESHIELD SCOTLAND LTD", padding, 9); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.text(CONTRACT_NAME, pageWidth - padding, 9, { align: "right" }) }
  return { accent, text, padding, y: settings.show_header === false ? padding : 24 }
}
function drawFooter(pdf, pageNumber, pageCount, pageWidth, pageHeight, settings, appointment) {
  if (settings.show_footer === false) return
  const padding = Number(settings.padding_mm || 18); const accent = hexToRgb(settings.accent); pdf.setDrawColor(...accent); pdf.setLineWidth(0.25); pdf.line(padding, pageHeight - 13, pageWidth - padding, pageHeight - 13); pdf.setTextColor(120, 130, 138); pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5); pdf.text(textValue(appointment?.name, "Customer"), padding, pageHeight - 8); pdf.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - padding, pageHeight - 8, { align: "right" })
}
function drawTitle(pdf, title, subtitle, x, y, textRgb, accentRgb) {
  pdf.setTextColor(...textRgb); pdf.setFont("helvetica", "bold"); pdf.setFontSize(22); pdf.text(title, x, y)
  if (subtitle) { pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(100, 112, 120); pdf.text(subtitle, x, y + 7) }
  pdf.setFillColor(...accentRgb); pdf.rect(x, y + 11, 28, 1.2, "F")
}
function drawRows(pdf, rows, x, y, width, textRgb, compact = false) {
  const rowHeight = compact ? 8 : 10
  rows.forEach(([label, value], index) => { if (index % 2 === 0) { pdf.setFillColor(246, 248, 250); pdf.roundedRect(x, y - 5.5, width, rowHeight, 1.5, 1.5, "F") } pdf.setTextColor(...textRgb); pdf.setFont("helvetica", "bold"); pdf.setFontSize(compact ? 7.5 : 8.5); pdf.text(String(label), x + 4, y); pdf.setFont("helvetica", "normal"); pdf.setTextColor(72, 84, 92); pdf.text(String(value), x + width - 4, y, { align: "right" }); y += rowHeight })
  return y
}
function drawBody(pdf, body, x, y, width, textRgb, appointment, epvs) {
  if (!body) return y
  const lines = interpolate(body, appointment, epvs).split(/\r?\n/); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(...textRgb)
  lines.forEach((line) => { if (!line.trim()) { y += 4; return } const wrapped = pdf.splitTextToSize(line, width); wrapped.forEach((part) => { pdf.text(part, x, y); y += 4.8 }); y += 2 })
  return y
}

async function drawOpenSolarImage(pdf, imageUrl, x, y, width, maxHeight = 68) {
  const image = await imageUrlToDataUrl(imageUrl)
  if (!image) return y
  const ratio = image.width / image.height
  let drawWidth = width
  let drawHeight = drawWidth / ratio
  if (drawHeight > maxHeight) { drawHeight = maxHeight; drawWidth = drawHeight * ratio }
  const drawX = x + (width - drawWidth) / 2
  pdf.setFillColor(245, 247, 249)
  pdf.roundedRect(x, y, width, Math.min(maxHeight, drawHeight) + 4, 2.5, 2.5, "F")
  pdf.addImage(image.dataUrl, "PNG", drawX, y + 2, drawWidth, drawHeight, undefined, "FAST")
  return y + drawHeight + 8
}

async function renderPage(pdf, page, index, pageCount, appointment, epvs) {
  const settings = page.settings || {}; const pageWidth = pdf.internal.pageSize.getWidth(); const pageHeight = pdf.internal.pageSize.getHeight(); const { accent, text, padding, y: startY } = drawHeader(pdf, pageWidth, pageHeight, settings); const kind = settings.page_kind || "standard"; const data = epvs?.data || {}; const results = epvs?.results || {}
  if (kind === "cover") {
    const bg = hexToRgb(settings.background, [6, 47, 79]); pdf.setFillColor(...bg); pdf.rect(0, 0, pageWidth, pageHeight, "F"); pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(28); pdf.text("Digital Solar Contract", padding, 70); pdf.setFont("helvetica", "normal"); pdf.setFontSize(13); pdf.text("Prepared for", padding, 83); pdf.setFont("helvetica", "bold"); pdf.setFontSize(20); pdf.text(textValue(appointment?.name, "Customer"), padding, 94); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(205, 222, 232); pdf.text([appointment?.address, appointment?.postcode].filter(Boolean).join(", ") || "", padding, 103); pdf.setFillColor(...accent); pdf.roundedRect(padding, 122, pageWidth - padding * 2, 34, 4, 4, "F"); pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.text("YOUR SOLAR SYSTEM", padding + 8, 134); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.text(`${results.systemSize ? number(results.systemSize, 2) : "—"} kWp system`, padding + 8, 143); pdf.text(`${number(data.panelCount)} panels${data.batteryEnabled ? ` • ${number(data.batteryCapacity, 1)} kWh battery` : ""}`, padding + 8, 151); return
  }
  drawTitle(pdf, page.title || `Page ${index + 1}`, page.subtitle || "", padding, startY + 4, text, accent); let y = startY + 24; const width = pageWidth - padding * 2
  if (kind === "system_overview") {
    const openSolarImageUrl = epvs?.data?.openSolar?.systemImageUrl || epvs?.data?.openSolar?.imageUrl || epvs?.openSolar?.systemImageUrl || epvs?.openSolar?.imageUrl || ""
    if (openSolarImageUrl) y = await drawOpenSolarImage(pdf, openSolarImageUrl, padding, y, width, 72)
    y = drawRows(pdf, [["Customer", textValue(appointment?.name)], ["System size", results.systemSize ? `${number(results.systemSize, 2)} kWp` : "—"], ["Solar panels", `${number(data.panelCount)} × ${number(data.panelWattage)} W`], ["Inverter", data.inverterCapacity ? `${number(data.inverterCapacity, 1)} kW` : "—"], ["Battery", data.batteryEnabled ? `${number(data.batteryCapacity, 1)} kWh` : "Not included"], ["Estimated generation", results.generation ? `${number(results.generation)} kWh / year` : "—"]], padding, y, width, text); y += 8; y = drawBody(pdf, page.body, padding, y, width, text, appointment, epvs)
  } else if (kind === "itemised_breakdown") {
    y = drawRows(pdf, [["Solar PV panels", `${number(data.panelCount)} × ${number(data.panelWattage)} W`], ["Inverter", data.inverterCapacity ? `${number(data.inverterCapacity, 1)} kW` : "—"], ["Battery storage", data.batteryEnabled ? `${number(data.batteryCapacity, 1)} kWh` : "Not included"], ["System cost", money(data.systemCost)], ["Deposit", money(data.deposit)], ["Finance term", data.financeTerm ? `${number(data.financeTerm)} years` : "—"], ["Monthly finance", results.monthlyPayment ? money(results.monthlyPayment) : "—"]], padding, y, width, text); y += 8; y = drawBody(pdf, page.body, padding, y, width, text, appointment, epvs)
  } else if (kind === "accreditations") {
    const items = Array.isArray(settings.items) ? settings.items : []
    if (!items.length) { pdf.setFillColor(246, 248, 250); pdf.roundedRect(padding, y, width, 28, 3, 3, "F"); pdf.setTextColor(105, 116, 124); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.text("Accreditations and certification content can be added to this page", padding + 7, y + 12); pdf.text("from the template editor.", padding + 7, y + 18); y += 38 } else { items.forEach((item) => { pdf.setFillColor(246, 248, 250); pdf.roundedRect(padding, y, width, 20, 3, 3, "F"); pdf.setTextColor(...text); pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.text(textValue(item.name, "Accreditation"), padding + 7, y + 8); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(100, 112, 120); pdf.text(textValue(item.description, ""), padding + 7, y + 14); y += 25 }) }
    y = drawBody(pdf, page.body, padding, y + 4, width, text, appointment, epvs)
  } else if (kind === "epvs") {
    y = drawRows(pdf, [["System size", results.systemSize ? `${number(results.systemSize, 2)} kWp` : "—"], ["Annual consumption", data.annualConsumption ? `${number(data.annualConsumption)} kWh` : "—"], ["Estimated generation", results.generation ? `${number(results.generation)} kWh` : "—"], ["Solar self-consumption", results.solarSelfConsumption ? `${number(results.solarSelfConsumption)} kWh` : "—"], ["Estimated export", results.exportKwh ? `${number(results.exportKwh)} kWh` : "—"], ["Annual saving", money(results.annualSaving)], ["Simple payback", results.simplePayback ? `${number(results.simplePayback, 1)} years` : "—"], ["30 year saving", money(results.thirtyYearSavings)], ["30 year return", money(results.thirtyYearProfit)]], padding, y, width, text, true); y += 7
    if (settings.show_30_year_projection && Array.isArray(results.thirtyYearBreakdown) && results.thirtyYearBreakdown.length) { pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(...text); pdf.text("YEAR", padding + 2, y); pdf.text("ANNUAL", padding + 35, y); pdf.text("CUMULATIVE", padding + 78, y); pdf.text("RETURN", pageWidth - padding, y, { align: "right" }); y += 5; results.thirtyYearBreakdown.forEach((row) => { pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5); pdf.text(String(row.year ?? ""), padding + 2, y); pdf.text(money(row.annualSaving), padding + 35, y); pdf.text(money(row.cumulativeSaving), padding + 78, y); pdf.text(money(row.cumulativeReturn), pageWidth - padding, y, { align: "right" }); y += 4.2 }) }
  } else if (kind === "datasheets") {
    const docs = Array.isArray(settings.documents) ? settings.documents : []
    if (!docs.length) { pdf.setFillColor(246, 248, 250); pdf.roundedRect(padding, y, width, 28, 3, 3, "F"); pdf.setTextColor(105, 116, 124); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.text("Product datasheets will appear here when added to the template.", padding + 7, y + 14); y += 38 } else { docs.forEach((doc) => { pdf.setTextColor(...text); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.text(textValue(doc.title, "Datasheet"), padding, y); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(105, 116, 124); pdf.text(textValue(doc.description, ""), padding, y + 5); y += 14 }) }
    y = drawBody(pdf, page.body, padding, y + 4, width, text, appointment, epvs)
  } else {
    y = drawBody(pdf, page.body, padding, y, width, text, appointment, epvs)
  }
}

export async function GenerateSolarContract({ appointment, epvsCalculation }) {
  if (!appointment) return
  const { data: template, error: templateError } = await supabase.from("templates").select("id,name,template_type,active").eq("name", CONTRACT_NAME).eq("active", true).maybeSingle()
  if (templateError) throw templateError
  if (!template) throw new Error(`Active ${CONTRACT_NAME} template could not be found.`)
  const { data: pages, error: pagesError } = await supabase.from("template_pages").select("id,slide_order,title,subtitle,body,settings").eq("presentation_id", template.id).order("slide_order", { ascending: true })
  if (pagesError) throw pagesError
  if (!pages?.length) throw new Error(`${CONTRACT_NAME} has no pages configured.`)
  const firstSettings = pages[0]?.settings || {}
  const pdf = new jsPDF({ orientation: firstSettings.orientation || "portrait", unit: "mm", format: firstSettings.page_size || "a4" })
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index]
    if (index > 0) { const settings = page.settings || {}; pdf.addPage(settings.page_size || "a4", settings.orientation || "portrait") }
    await renderPage(pdf, page, index, pages.length, appointment, epvsCalculation)
  }
  pages.forEach((page, index) => { pdf.setPage(index + 1); drawFooter(pdf, index + 1, pages.length, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), page.settings || {}, appointment) })
  const safeName = String(appointment.name || "Customer").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Customer"
  pdf.save(`${safeName}-Digital-Solar-Contract.pdf`)
}

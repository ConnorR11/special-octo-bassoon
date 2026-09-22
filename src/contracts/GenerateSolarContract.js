import jsPDF from "jspdf"
import { supabase } from "../lib/supabase"

const CONTRACT_NAME = "Digital Solar Contract"

const rgb = (value, fallback = [11, 93, 138]) => {
  const hex = String(value || "").replace("#", "")
  return /^[0-9a-f]{6}$/i.test(hex)
    ? [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
    : fallback
}

const textValue = (v, fallback = "—") => v === undefined || v === null || v === "" ? fallback : String(v)

const num = (v, d = 0) => Number(v || 0).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d })

const money = v => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number(v || 0))

const date = v => {
  if (!v) return "—"
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}

function getOpenSolarImageUrl(appointment, epvs) {
  const data = epvs?.data || {}
  const openSolar = data.openSolar || {}
  return String(
    appointment?.open_solar_image ||
    openSolar.systemImageUrl ||
    openSolar.imageUrl ||
    appointment?.openSolarImageUrl ||
    ""
  ).trim()
}

function interpolate(body, appointment, epvs) {
  const data = epvs?.data || {}
  const results = epvs?.results || {}
  const values = {
    customer_name: appointment?.name || data.customerName,
    customer_address: appointment?.address || data.address,
    postcode: appointment?.postcode || data.postcode,
    phone: appointment?.phone || appointment?.phone_number_1,
    email: appointment?.email || appointment?.email_address,
    appointment_date: date(appointment?.appointment_date),
    salesperson: appointment?.salesperson || appointment?.rep_allocated,
    open_solar_image: getOpenSolarImageUrl(appointment, epvs),
    system_size: results.systemSize ? `${num(results.systemSize, 2)} kWp` : "—",
    panel_type: data.panelType || data.panel_type || data.panelModel || data.panel_model || data.panelName || data.panel_name || "Panels",
    panel_count: num(data.panelCount),
    panel_wattage: data.panelWattage ? `${num(data.panelWattage)} W` : "—",
    inverter_type: data.inverterType || data.inverter_type || data.inverterModel || data.inverter_model || data.inverterName || data.inverter_name || "Inverter",
    inverter_quantity: data.inverterQuantity ?? data.inverter_quantity ?? 1,
    inverter_capacity: data.inverterCapacity ? `${num(data.inverterCapacity, 1)} kW` : "—",
    battery_type: data.batteryType || data.battery_type || data.batteryModel || data.battery_model || data.batteryName || data.battery_name || "Battery",
    battery_quantity: data.batteryQuantity ?? data.battery_quantity ?? 1,
    battery_capacity: data.batteryEnabled ? `${num(data.batteryCapacity, 1)} kWh` : "Not included",
    system_cost: money(data.systemCost),
    annual_generation: results.generation ? `${num(results.generation)} kWh` : "—",
    annual_saving: money(results.annualSaving),
  }
  return String(body || "").replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => textValue(values[key]))
}

async function imageData(url) {
  const source = String(url || "").trim()
  if (!source) return null
  try {
    let requestUrl = source
    try {
      const parsed = new URL(source, window.location.origin)
      if (parsed.hostname === "api.opensolar.com" || parsed.hostname.endsWith(".opensolar.com")) {
        requestUrl = `/api/opensolar-image?url=${encodeURIComponent(source)}`
      }
    } catch {}
    const response = await fetch(requestUrl)
    if (!response.ok) throw new Error(`Image request returned ${response.status}`)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    try {
      const image = new Image()
      image.src = objectUrl
      await image.decode()
      const canvas = document.createElement("canvas")
      canvas.width = image.naturalWidth || image.width
      canvas.height = image.naturalHeight || image.height
      if (!canvas.width || !canvas.height) return null
      const context = canvas.getContext("2d")
      if (!context) return null
      context.drawImage(image, 0, 0)
      return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height }
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  } catch (error) {
    console.warn("Unable to load OpenSolar design image", error)
    return null
  }
}

async function drawImage(pdf, url, x, y, width, maxHeight = 72) {
  const image = await imageData(url)
  if (!image) return y
  const ratio = image.width / image.height
  let w = width
  let h = w / ratio
  if (h > maxHeight) {
    h = maxHeight
    w = h * ratio
  }
  pdf.setFillColor(245, 247, 249)
  pdf.roundedRect(x, y, width, h + 4, 2.5, 2.5, "F")
  pdf.addImage(image.dataUrl, "PNG", x + (width - w) / 2, y + 2, w, h, undefined, "FAST")
  return y + h + 8
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
  const titleY = terms ? ctx.y - 2 : ctx.y + 4

  pdf.setTextColor(...ctx.text)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(terms ? 16 : 22)
  pdf.text(page.title || "", ctx.padding, titleY)

  if (page.subtitle) {
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(terms ? 7.5 : 9)
    pdf.setTextColor(100, 112, 120)
    if (terms) {
      pdf.text(page.subtitle, ctx.width - ctx.padding, titleY, { align: "right" })
    } else {
      pdf.text(page.subtitle, ctx.padding, ctx.y + 11)
    }
  }

  pdf.setFillColor(...ctx.accent)
  if (terms) {
    pdf.rect(ctx.padding, ctx.y + 2, ctx.width - (ctx.padding * 2), 1.2, "F")
  } else {
    pdf.rect(ctx.padding, ctx.y + 15, 28, 1.2, "F")
  }
}

function rows(pdf, values, x, y, width, text, compact = false) {
  const h = compact ? 8 : 10
  values.forEach(([label, value], i) => {
    if (i % 2 === 0) {
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
  const withoutImageToken = String(content).replace(/(^|\r?\n)\s*{{open_solar_image}}\s*(?=\r?\n|$)/g, "$1")
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(9)
  pdf.setTextColor(...textRgb)
  interpolate(withoutImageToken, appointment, epvs).split(/\r?\n/).forEach(line => {
    if (!line.trim()) {
      y += 4
      return
    }
    pdf.splitTextToSize(line, width).forEach(part => {
      pdf.text(part, x, y)
      y += 4.8
    })
    y += 2
  })
  return y
}

function drawItemisedBreakdown(pdf, page, ctx, data, results, appointment, epvs) {
  const width = ctx.width - ctx.padding * 2
  const settings = page.settings || {}
  const configured = Array.isArray(settings.included_items) ? settings.included_items : []
  const items = configured.map(item => typeof item === "string"
    ? { name: item, quantity: 1, type: "" }
    : { name: item?.name ?? "—", quantity: item?.quantity ?? 1, type: item?.type ?? "" })
  const headerY = ctx.y + 28
  const typeX = ctx.padding + width - 43
  const rowHeight = 7.15

  pdf.setFillColor(...ctx.accent)
  pdf.roundedRect(ctx.padding, headerY - 7, width, 11, 2, 2, "F")
  pdf.setTextColor(255, 255, 255)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(8)
  pdf.text("PRODUCT / SERVICE", ctx.padding + 7, headerY)
  pdf.text("TYPE", typeX, headerY, { align: "center" })
  pdf.text("QTY", ctx.padding + width - 7, headerY, { align: "right" })

  let y = headerY + 9
  items.forEach((item, index) => {
    const name = interpolate(String(item.name), appointment, epvs)
    const type = interpolate(String(item.type), appointment, epvs)
    const quantity = interpolate(String(item.quantity), appointment, epvs)

    if (index % 2 === 0) {
      pdf.setFillColor(247, 249, 250)
      pdf.roundedRect(ctx.padding, y - 5.2, width, rowHeight, 1.2, 1.2, "F")
    }

    pdf.setTextColor(...ctx.text)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8.1)
    pdf.text(name, ctx.padding + 7, y)

    if (type) {
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(6.5)
      const tagWidth = pdf.getTextWidth(type) + 6
      const typeKey = type.toLowerCase()
      const fill = typeKey === "service" ? [255, 241, 230] : typeKey === "product" ? [231, 242, 248] : [238, 240, 242]
      const colour = typeKey === "service" ? [199, 106, 0] : typeKey === "product" ? [11, 93, 138] : [75, 85, 92]
      pdf.setFillColor(...fill)
      pdf.setTextColor(...colour)
      pdf.roundedRect(typeX - tagWidth / 2, y - 3.8, tagWidth, 4.5, 2, 2, "F")
      pdf.text(type, typeX, y - 0.5, { align: "center" })
    }

    pdf.setTextColor(...ctx.text)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(8.1)
    pdf.text(quantity, ctx.padding + width - 7, y, { align: "right" })
    y += rowHeight
  })

  y += 7
  const price = results?.systemCost ?? data?.systemCost ?? appointment?.system_cost ?? appointment?.contract_value ?? appointment?.sale_value ?? appointment?.price
  pdf.setFillColor(...ctx.accent)
  pdf.roundedRect(ctx.padding, y, width, 25, 3, 3, "F")
  pdf.setTextColor(255, 255, 255)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(8)
  pdf.text("TOTAL SYSTEM PRICE", ctx.padding + 8, y + 10)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(18)
  pdf.text(money(price), ctx.padding + width - 8, y + 15, { align: "right" })
}

function parseTermsSections(raw) {
  const sections = []
  let current = []
  String(raw || "").replace(/\r/g, "").split("\n").forEach(line => {
    const trimmed = line.trim()
    if (/^\d+\.\s+/.test(trimmed)) {
      if (current.length) sections.push(current.join(" ").trim())
      current = [trimmed]
    } else if (trimmed) {
      current.push(trimmed)
    }
  })
  if (current.length) sections.push(current.join(" ").trim())
  return sections.filter(Boolean)
}

function buildTermsLines(pdf, sections, columnWidth, fontSize, headingSize, sectionSpacing) {
  const lines = []
  sections.forEach(section => {
    const normal = String(section).replace(/\s+/g, " ").trim()
    const numbered = normal.match(/^(\d+\.\s+)(.*)$/)
    if (!numbered) {
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(fontSize)
      pdf.splitTextToSize(normal, columnWidth).forEach(text => lines.push({ text, boldPrefix: "" }))
      lines.push({ spacing: sectionSpacing })
      return
    }

    const headingMatch = numbered[2].match(/^(.+?\.)\s+(.*)$/)
    const prefix = numbered[1] + (headingMatch ? headingMatch[1] + " " : "")
    const bodyText = headingMatch ? headingMatch[2] : numbered[2]

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(headingSize)
    const prefixWidth = pdf.getTextWidth(prefix)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(fontSize)

    if (prefixWidth < columnWidth - 10) {
      const first = pdf.splitTextToSize(bodyText, Math.max(10, columnWidth - prefixWidth))[0] || ""
      lines.push({ text: first, boldPrefix: prefix })
      const rest = bodyText.slice(first.length).trim()
      if (rest) pdf.splitTextToSize(rest, columnWidth).forEach(text => lines.push({ text, boldPrefix: "" }))
    } else {
      lines.push({ text: prefix, boldPrefix: "" })
      pdf.splitTextToSize(bodyText, columnWidth).forEach(text => lines.push({ text, boldPrefix: "" }))
    }
    lines.push({ spacing: sectionSpacing })
  })
  return lines
}

function drawTermsConditions(pdf, page, ctx, appointment, epvs) {
  const settings = page.settings || {}
  const width = ctx.width - ctx.padding * 2
  const gap = Number(settings.column_gap_mm || 6)
  const columnWidth = (width - gap) / 2
  const top = ctx.y + 10
  const bottom = ctx.height - 17
  const available = bottom - top
  let fontSize = Number(settings.font_size || 6.5)
  let lineHeight = Number(settings.line_height || 3.1)
  const sectionSpacing = Number(settings.section_spacing || 2)
  const headingSize = Number(settings.heading_font_size || 7)

  const sections = parseTermsSections(interpolate(String(page.body || ""), appointment, epvs))
  let lines = buildTermsLines(pdf, sections, columnWidth, fontSize, headingSize, sectionSpacing)

  for (let i = 0; i < 12; i += 1) {
    const capacity = Math.floor(available / lineHeight) * 2
    const required = lines.reduce((count, line) => count + (line.spacing ? 0 : 1), 0)
    if (required <= capacity) break
    fontSize = Math.max(5.15, fontSize * 0.96)
    lineHeight = Math.max(2.35, lineHeight * 0.96)
    lines = buildTermsLines(pdf, sections, columnWidth, fontSize, headingSize, sectionSpacing)
  }

  let column = 0
  let x = ctx.padding
  let y = top

  for (const line of lines) {
    if (column > 1) break

    if (line.spacing) {
      if (y + line.spacing > bottom) {
        column += 1
        x = ctx.padding + columnWidth + gap
        y = top
      } else {
        y += line.spacing
      }
      continue
    }

    if (y + lineHeight > bottom) {
      column += 1
      x = ctx.padding + columnWidth + gap
      y = top
    }
    if (column > 1) break

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
  }
}

async function renderPage(pdf, page, index, pageCount, appointment, epvs) {
  const settings = page.settings || {}
  const ctx = header(pdf, settings)
  const kind = settings.page_kind || "standard"
  const data = epvs?.data || {}
  const results = epvs?.results || {}

  if (kind === "cover") {
    pdf.setFillColor(...rgb(settings.background, [6, 47, 79]))
    pdf.rect(0, 0, ctx.width, ctx.height, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(28)
    pdf.text("Digital Solar Contract", ctx.padding, 70)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(13)
    pdf.text("Prepared for", ctx.padding, 83)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(20)
    pdf.text(textValue(appointment?.name, "Customer"), ctx.padding, 94)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9)
    pdf.setTextColor(205, 222, 232)
    pdf.text([appointment?.address, appointment?.postcode].filter(Boolean).join(", "), ctx.padding, 103)
    return
  }

  title(pdf, page, ctx)
  let y = ctx.y + 28
  const width = ctx.width - ctx.padding * 2

  if (kind === "system_overview") {
    const image = getOpenSolarImageUrl(appointment, epvs)
    if (image) y = await drawImage(pdf, image, ctx.padding, y, width, 72)
    y = rows(pdf, [
      ["Customer", textValue(appointment?.name)],
      ["System size", results.systemSize ? `${num(results.systemSize, 2)} kWp` : "—"],
      ["Solar panels", `${num(data.panelCount)} × ${num(data.panelWattage)} W`],
      ["Inverter", data.inverterCapacity ? `${num(data.inverterCapacity, 1)} kW` : "—"],
      ["Battery", data.batteryEnabled ? `${num(data.batteryCapacity, 1)} kWh` : "Not included"],
      ["Estimated generation", results.generation ? `${num(results.generation)} kWh / year` : "—"],
    ], ctx.padding, y, width, ctx.text)
    body(pdf, page.body, ctx.padding, y + 8, width, ctx.text, appointment, epvs)
  } else if (kind === "itemised_breakdown") {
    drawItemisedBreakdown(pdf, page, ctx, data, results, appointment, epvs)
  } else if (kind === "terms_conditions") {
    drawTermsConditions(pdf, page, ctx, appointment, epvs)
  } else if (kind === "accreditations") {
    const items = Array.isArray(settings.items) ? settings.items : []
    items.forEach(item => {
      pdf.setFillColor(246, 248, 250)
      pdf.roundedRect(ctx.padding, y, width, 20, 3, 3, "F")
      pdf.setTextColor(...ctx.text)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(10)
      pdf.text(textValue(item.name, "Accreditation"), ctx.padding + 7, y + 8)
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(8)
      pdf.setTextColor(100, 112, 120)
      pdf.text(textValue(item.description, ""), ctx.padding + 7, y + 14)
      y += 25
    })
    body(pdf, page.body, ctx.padding, y + 4, width, ctx.text, appointment, epvs)
  } else if (kind === "epvs") {
    rows(pdf, [
      ["System size", results.systemSize ? `${num(results.systemSize, 2)} kWp` : "—"],
      ["Annual consumption", data.annualConsumption ? `${num(data.annualConsumption)} kWh` : "—"],
      ["Estimated generation", results.generation ? `${num(results.generation)} kWh` : "—"],
      ["Solar self-consumption", results.solarSelfConsumption ? `${num(results.solarSelfConsumption)} kWh` : "—"],
      ["Estimated export", results.exportKwh ? `${num(results.exportKwh)} kWh` : "—"],
      ["Annual saving", money(results.annualSaving)],
      ["Simple payback", results.simplePayback ? `${num(results.simplePayback, 1)} years` : "—"],
      ["30 year saving", money(results.thirtyYearSavings)],
      ["30 year return", money(results.thirtyYearProfit)],
    ], ctx.padding, y, width, ctx.text, true)
  } else if (kind === "datasheets") {
    const documents = Array.isArray(settings.documents) ? settings.documents : []
    documents.forEach(doc => {
      pdf.setTextColor(...ctx.text)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(9)
      pdf.text(textValue(doc.title, "Datasheet"), ctx.padding, y)
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(7)
      pdf.setTextColor(105, 116, 124)
      pdf.text(textValue(doc.description, ""), ctx.padding, y + 5)
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
    .select("id,slide_order,title,subtitle,body,settings")
    .eq("presentation_id", template.id)
    .order("slide_order", { ascending: true })

  if (pagesError) throw pagesError
  if (!pages?.length) throw new Error(`${CONTRACT_NAME} has no pages configured.`)

  const first = pages[0]?.settings || {}
  const pdf = new jsPDF({
    orientation: first.orientation || "portrait",
    unit: "mm",
    format: first.page_size || "a4",
  })

  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i]
    if (i > 0) {
      const settings = page.settings || {}
      pdf.addPage(settings.page_size || "a4", settings.orientation || "portrait")
    }
    await renderPage(pdf, page, i, pages.length, appointment, epvsCalculation)
  }

  pages.forEach((page, i) => {
    pdf.setPage(i + 1)
    footer(pdf, i, pages.length, page.settings || {}, appointment)
  })

  const safeName = String(appointment.name || "Customer")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "") || "Customer"

  pdf.save(`${safeName}-Digital-Solar-Contract.pdf`)
}

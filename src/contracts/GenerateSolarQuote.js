import jsPDF from "jspdf"
import { supabase } from "../lib/supabase"

const money = (value) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(Number(value || 0))
const value = (v, fallback = "To be confirmed") => v === null || v === undefined || v === "" ? fallback : String(v)
const clean = (v) => String(v ?? "").trim()

function getQuoteData(appointment) {
  const epvs = appointment?.epvs_calculation?.data || appointment?.epvs_calculation || {}
  const openSolar = epvs?.openSolar || {}
  const hardware = epvs?.hardware || openSolar?.hardware || {}
  const panels = Array.isArray(hardware.panels) ? hardware.panels : []
  const inverters = Array.isArray(hardware.inverters) ? hardware.inverters : []
  const batteries = Array.isArray(hardware.batteries) ? hardware.batteries : []
  const panelCount = panels.reduce((sum, item) => sum + Number(item?.quantity || item?.count || 0), 0) || Number(epvs.panelCount || epvs.numberOfPanels || 0)
  const capacity = Number(epvs.systemSize || epvs.system_size || openSolar.systemSize || 0)
  const cashPrice = Number(epvs.totalContractValue || epvs.totalPrice || appointment?.contract_value || appointment?.price_left || 0)
  const termYears = Number(epvs.financeTerm || appointment?.finance_term || 10)
  const rate = 3.9
  const deposit = Number(epvs.deposit || appointment?.deposit || 0)
  const principal = Math.max(0, cashPrice - deposit)
  const months = Math.max(1, Math.round(termYears * 12))
  const monthlyRate = rate / 100 / 12
  const monthly = monthlyRate ? principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months)) : principal / months
  return { epvs, openSolar, panels, inverters, batteries, panelCount, capacity, cashPrice, termYears, rate, deposit, monthly }
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

async function drawQuoteImage(pdf, url, x, y, width, maxHeight) {
  const image = await imageData(url)
  const ratio = image.width / image.height
  let imageWidth = width - 4
  let imageHeight = imageWidth / ratio
  if (imageHeight > maxHeight) {
    imageHeight = maxHeight
    imageWidth = imageHeight * ratio
  }
  pdf.addImage(image.dataUrl, "PNG", x + (width - imageWidth) / 2, y, imageWidth, imageHeight, undefined, "FAST")
  return imageHeight
}

function addWrapped(pdf, text, x, y, width, lineHeight = 5) {
  const lines = pdf.splitTextToSize(String(text), width)
  pdf.text(lines, x, y)
  return y + lines.length * lineHeight
}

export async function GenerateSolarQuote({ appointment, previewOnly = true }) {
  if (!appointment) throw new Error("An appointment is required to create a solar quote.")
  const { data: saved, error } = await supabase.from("appointments").select("*").eq("appointment_row_id", appointment.appointment_row_id).maybeSingle()
  if (error) throw error
  const record = saved || appointment
  const d = getQuoteData(record)
  const openSolarImageUrl = String(d.openSolar?.imageUrl || "").trim()
  const pdf = new jsPDF({ unit: "mm", format: "a4" })
  const w = 210, h = 297, margin = 18
  const navy = [16, 35, 63], blue = [11, 93, 138], muted = [92, 105, 120], pale = [239, 246, 250]
  const customer = clean(record.name || record.customer_name) || "Customer"
  const address = [record.address, record.postcode].filter(Boolean).join(", ")
  const quoteRef = String(record.appointment_row_id || "DRAFT").slice(0, 12).toUpperCase()
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
  const heading = (text, y) => {
    pdf.setTextColor(...blue); pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.text(text, margin, y)
    pdf.setDrawColor(220, 228, 234); pdf.line(margin, y + 3, w - margin, y + 3)
    return y + 11
  }
  const footer = (page) => {
    pdf.setDrawColor(220, 228, 234); pdf.line(margin, h - 15, w - margin, h - 15)
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(...muted)
    pdf.text("Homeshield Scotland | Solar proposal | Quote only — not a contract", margin, h - 10)
    pdf.text(String(page), w - margin, h - 10, { align: "right" })
  }
  // Cover
  pdf.setFillColor(255,255,255); pdf.rect(0, 0, w, h, "F")
  pdf.setTextColor(...blue); pdf.setFont("helvetica","bold"); pdf.setFontSize(11); pdf.text("HOMESHIELD SCOTLAND", margin, 15)
  pdf.setFontSize(23); pdf.text("Your Solar PV System", margin, 31)
  pdf.setFont("helvetica","normal"); pdf.setFontSize(9); pdf.setTextColor(...muted); pdf.text("Your proposed solar system and estimated performance", margin, 39)
  pdf.setTextColor(...navy); pdf.setFont("helvetica","bold"); pdf.setFontSize(15); pdf.text(customer, 120, 58)
  pdf.setFont("helvetica","normal"); pdf.setFontSize(11)
  let y = 70; y = addWrapped(pdf, address || "Property address to be confirmed", 120, y, 70, 5)
  pdf.setTextColor(...muted); pdf.setFontSize(9); pdf.text("Quote reference: " + quoteRef, 120, 99); pdf.text("Prepared: " + today, 120, 107)
  pdf.setFillColor(...blue); pdf.roundedRect(margin, 112, w - margin*2, 23, 3, 3, "F")
  pdf.setTextColor(255,255,255); pdf.setFont("helvetica","bold"); pdf.setFontSize(16); pdf.text(d.panelCount ? "×" + d.panelCount : "Panels TBC", margin + 12, 123)
  pdf.setFont("helvetica","normal"); pdf.setFontSize(7.5); pdf.text("SOLAR PANELS", margin + 12, 130)
  pdf.setDrawColor(255,255,255); pdf.line(98, 116, 98, 131)
  pdf.setFont("helvetica","bold"); pdf.setFontSize(16); pdf.text(d.capacity ? d.capacity.toFixed(2) + " kWp" : "TBC", 110, 123)
  pdf.setFont("helvetica","normal"); pdf.setFontSize(7.5); pdf.text("SYSTEM SIZE", 110, 130)
  // Hardware badges sit directly beneath the panel-count and system-size banner.
  const hardwareLabel = (items, fallback) => {
    const names = items.map(item => [item?.manufacturer, item?.model, item?.name].filter(Boolean).join(" ")).filter(Boolean)
    return names.length ? names.join(", ") : fallback
  }
  const inverterLabel = hardwareLabel(d.inverters, "Inverter details to be confirmed")
  const batteryLabel = hardwareLabel(d.batteries, "Battery details to be confirmed")
  const hardwareY = 140
  const hardwareGap = 5
  const hardwareW = (w - margin * 2 - hardwareGap) / 2
  const drawHardwareCard = (x, title, detail) => {
    pdf.setFillColor(...pale); pdf.roundedRect(x, hardwareY, hardwareW, 24, 2.5, 2.5, "F")
    pdf.setTextColor(...blue); pdf.setFont("helvetica","bold"); pdf.setFontSize(8); pdf.text(title.toUpperCase(), x + 4, hardwareY + 7)
    pdf.setTextColor(...navy); pdf.setFont("helvetica","normal"); pdf.setFontSize(8)
    pdf.text(pdf.splitTextToSize(detail, hardwareW - 8).slice(0, 2), x + 4, hardwareY + 14)
  }
  drawHardwareCard(margin, "Inverter", inverterLabel)
  drawHardwareCard(margin + hardwareW + hardwareGap, "Battery storage", batteryLabel)

  pdf.setTextColor(...blue); pdf.setFont("helvetica","normal"); pdf.setFontSize(17); pdf.text("System Performance", margin, 177)
  pdf.setDrawColor(185,211,226); pdf.roundedRect(margin,182,w-margin*2,35,3,3,"S")
  const performance = [
    ["Estimated annual savings", d.epvs.annualSavings ? money(d.epvs.annualSavings) : "Not available"],
    ["Estimated long-term savings", d.epvs.totalSavings ? money(d.epvs.totalSavings) : "Not available"],
    ["Annual electricity consumption", d.epvs.annualConsumption ? Number(d.epvs.annualConsumption).toLocaleString("en-GB")+" kWh" : "Not available"]
  ]
  const performanceColors = [[245,171,45],[133,190,58],[40,165,205]]
  performance.forEach((item,index)=>{
    const py=185+index*10
    pdf.setFillColor(...performanceColors[index]); pdf.roundedRect(margin+3,py,91,8,1.5,1.5,"F")
    pdf.setTextColor(255,255,255); pdf.setFont("helvetica","bold"); pdf.setFontSize(7); pdf.text(item[0],margin+6,py+5.2)
    pdf.setTextColor(...navy); pdf.setFontSize(9); pdf.text(item[1],115,py+5.2)
  })
  pdf.setFillColor(...pale); pdf.roundedRect(margin, 224, w - margin*2, 40, 4, 4, "F")
  pdf.setTextColor(...blue); pdf.setFont("helvetica","bold"); pdf.setFontSize(10); pdf.text("CASH PRICE", margin + 8, 234)
  pdf.setTextColor(...navy); pdf.setFontSize(20); pdf.text(money(d.cashPrice), margin + 8, 245)
  pdf.setTextColor(...blue); pdf.setFontSize(10); pdf.text("INDICATIVE MONTHLY FINANCE", 108, 234)
  pdf.setTextColor(...navy); pdf.setFontSize(20); pdf.text(money(d.monthly) + " / month", 108, 245)
  pdf.setFont("helvetica","normal"); pdf.setFontSize(8); pdf.setTextColor(...muted)
  pdf.text("Illustrative at 3.9% over " + d.termYears + " years; subject to lender approval and confirmed terms.", margin + 8, 256, { maxWidth: w - margin*2 - 16 })
  if (openSolarImageUrl) { try { await drawQuoteImage(pdf, openSolarImageUrl, margin, 45, 94, 76) } catch (error) { console.warn("OpenSolar image unavailable on quote cover:", error) } }
  footer(1)

  // System overview page removed; equipment details remain on the cover.

  // Price and savings
  pdf.addPage(); y=25; y=heading("Your quotation", y)
  pdf.setTextColor(...navy); pdf.setFont("helvetica","normal"); pdf.setFontSize(10)
  y=addWrapped(pdf, "The finance figure is illustrative, calculated at " + d.rate.toFixed(1) + "% annually over " + d.termYears + " years with an assumed deposit of " + money(d.deposit) + ". It is not a lender offer; final terms are subject to lender approval.", margin, y, w-margin*2, 5)
  y+=7; pdf.setFillColor(...pale); pdf.roundedRect(margin,y,w-margin*2,48,3,3,"F")
  pdf.setFont("helvetica","bold"); pdf.setTextColor(...blue); pdf.setFontSize(10); pdf.text("TOTAL CASH PRICE",margin+7,y+12)
  pdf.setTextColor(...navy); pdf.setFontSize(19); pdf.text(money(d.cashPrice),margin+7,y+23)
  pdf.setTextColor(...blue); pdf.setFontSize(10); pdf.text("INDICATIVE MONTHLY FINANCE",margin+7,y+35)
  pdf.setTextColor(...navy); pdf.setFontSize(17); pdf.text(money(d.monthly) + " per month",margin+7,y+44)
  y += 60; y=heading("Estimated energy performance",y)
  const epvs = d.epvs
  const energyRows = [
    ["Annual electricity consumption", epvs.annualConsumption ? Number(epvs.annualConsumption).toLocaleString("en-GB")+" kWh" : "Not available"],
    ["Estimated annual savings", epvs.annualSavings ? money(epvs.annualSavings) : "Not available"],
    ["Estimated long-term savings", epvs.totalSavings ? money(epvs.totalSavings) : "Not available"],
  ]
  for(const [label,val] of energyRows){pdf.setTextColor(...muted);pdf.setFontSize(9);pdf.text(label,margin,y);pdf.setTextColor(...navy);pdf.text(val,w-margin,y,{align:"right"});pdf.setDrawColor(225,230,235);pdf.line(margin,y+3,w-margin,y+3);y+=10}
  y+=5; pdf.setFont("helvetica","normal");pdf.setFontSize(8);pdf.setTextColor(...muted)
  addWrapped(pdf,"Energy savings are estimates based on the information available at the time of quotation. Actual results depend on usage, weather, tariffs, system design and export arrangements. Finance is subject to lender approval and final lender documentation.",margin,y,w-margin*2,4)
  footer(3)

  pdf.addPage(); y=25; y=heading("What is included",y)
  pdf.setTextColor(...navy); pdf.setFont("helvetica","normal"); pdf.setFontSize(10)
  y=addWrapped(pdf,"Supply of the listed solar equipment, installation and commissioning as agreed in the final specification. Any exclusions or site-specific requirements will be confirmed before an order is placed.",margin,y,w-margin*2,5)
  y+=14; y=heading("Next steps",y)
  pdf.setTextColor(...navy);pdf.setFont("helvetica","normal");pdf.setFontSize(11)
  y=addWrapped(pdf,"1. Review this proposal and the proposed system.",margin,y,w-margin*2,6)+5
  y=addWrapped(pdf,"2. Confirm the equipment, installation scope and any site-specific requirements.",margin,y,w-margin*2,6)+5
  y=addWrapped(pdf,"3. We will confirm the final specification, price and (where applicable) finance terms before you commit.",margin,y,w-margin*2,6)+10
  pdf.setFont("helvetica","bold");pdf.setFontSize(14);pdf.setTextColor(...blue);pdf.text("Homeshield Scotland",margin,y);y+=8
  pdf.setFont("helvetica","normal");pdf.setFontSize(10);pdf.setTextColor(...navy)
  y=addWrapped(pdf,"This document is a quotation proposal only. It is not a contract, finance offer or guarantee of savings.",margin,y,w-margin*2,5)
  footer(3)
  const blob = pdf.output("blob")
  const url = URL.createObjectURL(blob)
  if (!previewOnly) {
    const fileName = (customer.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"") || "Customer") + "-Solar-Quote.pdf"
    const path = "solar-quotes/" + quoteRef + "/" + Date.now() + "-" + fileName
    const { error: uploadError } = await supabase.storage.from("signatures").upload(path, blob, { contentType:"application/pdf", upsert:false })
    if (uploadError) throw uploadError
    return { url, path, fileName }
  }
  return { url, fileName: customer + "-Solar-Quote.pdf" }
}

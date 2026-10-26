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
  pdf.setFontSize(29); pdf.text("Your Solar PV System", margin, 52)
  pdf.setFont("helvetica","normal"); pdf.setFontSize(9); pdf.setTextColor(...muted); pdf.text("Your proposed solar system and estimated performance", margin, 39)
  pdf.setTextColor(...navy); pdf.setFont("helvetica","bold"); pdf.setFontSize(18); pdf.text(customer, margin, 127)
  pdf.setFont("helvetica","normal"); pdf.setFontSize(11)
  let y = 137; y = addWrapped(pdf, address || "Property address to be confirmed", margin, y, 150, 6)
  pdf.setTextColor(...muted); pdf.setFontSize(9); pdf.text("Quote reference: " + quoteRef, margin, 166); pdf.text("Prepared: " + today, margin, 173)
  pdf.setFillColor(...pale); pdf.roundedRect(margin, 193, w - margin*2, 66, 4, 4, "F")
  pdf.setTextColor(...blue); pdf.setFont("helvetica","bold"); pdf.setFontSize(10); pdf.text("CASH PRICE", margin + 8, 207)
  pdf.setTextColor(...navy); pdf.setFontSize(20); pdf.text(money(d.cashPrice), margin + 8, 220)
  pdf.setTextColor(...blue); pdf.setFontSize(10); pdf.text("INDICATIVE MONTHLY FINANCE", margin + 8, 235)
  pdf.setTextColor(...navy); pdf.setFontSize(20); pdf.text(money(d.monthly) + " / month", margin + 8, 247)
  pdf.setFont("helvetica","normal"); pdf.setFontSize(8); pdf.setTextColor(...muted)
  pdf.text("Illustrative at 3.9% over " + d.termYears + " years; subject to lender approval and confirmed terms.", margin + 8, 255, { maxWidth: w - margin*2 - 16 })
  if (openSolarImageUrl) { try { await drawQuoteImage(pdf, openSolarImageUrl, margin, 48, 94, 76) } catch (error) { console.warn("OpenSolar image unavailable on quote cover:", error) } }
  footer(1)

  // System overview
  pdf.addPage(); y = 25; y = heading("Your proposed solar system", y)
  pdf.setTextColor(...navy); pdf.setFont("helvetica","normal"); pdf.setFontSize(10)
  y = addWrapped(pdf, "This proposal summarises the solar equipment and installation planned for your property. Final equipment and quantities are subject to survey and confirmation.", margin, y, w - margin*2, 5)
  y += 8
  if (openSolarImageUrl) { try { y += await drawQuoteImage(pdf, openSolarImageUrl, margin, y, w - margin * 2, 62); y += 5 } catch (error) { console.warn("OpenSolar image unavailable in system breakdown:", error) } }
  const specs = [
    ["Solar panels", d.panelCount ? String(d.panelCount) + " panels" : "To be confirmed"],
    ["System capacity", d.capacity ? d.capacity.toFixed(2) + " kWp" : "To be confirmed"],
    ["Inverter", d.inverters.map(x => [x?.manufacturer,x?.model,x?.name].filter(Boolean).join(" ")).filter(Boolean).join(", ") || "To be confirmed"],
    ["Battery storage", d.batteries.map(x => [x?.manufacturer,x?.model,x?.name].filter(Boolean).join(" ")).filter(Boolean).join(", ") || "To be confirmed"],
  ]
  for (const [label, val] of specs) {
    pdf.setFillColor(...pale); pdf.roundedRect(margin, y, w-margin*2, 18, 2, 2, "F")
    pdf.setTextColor(...muted); pdf.setFontSize(8); pdf.setFont("helvetica","bold"); pdf.text(label.toUpperCase(), margin+5, y+6)
    pdf.setTextColor(...navy); pdf.setFontSize(11); pdf.setFont("helvetica","normal"); pdf.text(pdf.splitTextToSize(val, w-margin*2-10).slice(0,2), margin+5, y+13)
    y += 22
  }
  y += 4; y = heading("What is included", y)
  y = addWrapped(pdf, "Supply of the listed solar equipment, installation and commissioning as agreed in the final specification. Any exclusions or site-specific requirements will be confirmed before an order is placed.", margin, y, w-margin*2, 5)
  footer(2)

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

  pdf.addPage(); y=25; y=heading("Next steps",y)
  pdf.setTextColor(...navy);pdf.setFont("helvetica","normal");pdf.setFontSize(11)
  y=addWrapped(pdf,"1. Review this proposal and the proposed system.",margin,y,w-margin*2,6)+5
  y=addWrapped(pdf,"2. Confirm the equipment, installation scope and any site-specific requirements.",margin,y,w-margin*2,6)+5
  y=addWrapped(pdf,"3. We will confirm the final specification, price and (where applicable) finance terms before you commit.",margin,y,w-margin*2,6)+10
  pdf.setFont("helvetica","bold");pdf.setFontSize(14);pdf.setTextColor(...blue);pdf.text("Homeshield Scotland",margin,y);y+=8
  pdf.setFont("helvetica","normal");pdf.setFontSize(10);pdf.setTextColor(...navy)
  y=addWrapped(pdf,"This document is a quotation proposal only. It is not a contract, finance offer or guarantee of savings.",margin,y,w-margin*2,5)
  footer(4)
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

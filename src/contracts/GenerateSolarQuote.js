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
  // Completely redesigned proposal: sales summary, quotation detail, next steps.
  const line = (y) => { pdf.setDrawColor(220,228,234); pdf.line(margin,y,w-margin,y) }
  const section = (title,y) => {
    pdf.setTextColor(...blue); pdf.setFont("helvetica","bold"); pdf.setFontSize(13)
    pdf.text(title,margin,y); line(y+3); return y+10
  }
  const text = (content,x,y,width,size=9,color=navy,style="normal",lineHeight=4.5) => {
    pdf.setFont("helvetica",style); pdf.setFontSize(size); pdf.setTextColor(...color)
    return addWrapped(pdf,content,x,y,width,lineHeight)
  }
  const card = (x,y,width,height,fill=pale) => {
    pdf.setFillColor(...fill); pdf.roundedRect(x,y,width,height,3,3,"F")
  }
  const hardwareLabel = (items,fallback) => {
    const names=items.map(item=>[item?.manufacturer,item?.model,item?.name].filter(Boolean).join(" ")).filter(Boolean)
    return names.length ? names.join(", ") : fallback
  }
  const equipment = [
    ["Solar panels",d.panelCount ? String(d.panelCount)+" panels" : "To be confirmed"],
    ["System capacity",d.capacity ? d.capacity.toFixed(2)+" kWp" : "To be confirmed"],
    ["Inverter",hardwareLabel(d.inverters,"To be confirmed")],
    ["Battery storage",hardwareLabel(d.batteries,"To be confirmed")]
  ]
  const footer = (page) => {
    line(h-15); pdf.setFont("helvetica","normal"); pdf.setFontSize(8); pdf.setTextColor(...muted)
    pdf.text("Homeshield Scotland  |  Solar proposal  |  Quote only — not a contract",margin,h-9)
    pdf.text(page+" / 3",w-margin,h-9,{align:"right"})
  }

  // PAGE 1 — A clear, visual sales summary.
  pdf.setFillColor(255,255,255); pdf.rect(0,0,w,h,"F")
  pdf.setTextColor(...blue); pdf.setFont("helvetica","bold"); pdf.setFontSize(11)
  pdf.text("HOMESHIELD SCOTLAND",margin,16)
  pdf.setFont("helvetica","normal"); pdf.setFontSize(8); pdf.setTextColor(...muted)
  pdf.text("QUOTE REF  "+quoteRef,w-margin,12,{align:"right"})
  pdf.text("CREATED  "+today,w-margin,17,{align:"right"})
  pdf.setTextColor(...navy); pdf.setFont("helvetica","bold"); pdf.setFontSize(25)
  pdf.text("Your Solar PV System",margin,34)
  text("A proposal prepared for your home",margin,42,w-margin*2,10,muted,"normal",5)
  line(48)

  // Main hero image and customer/property panel.
  let heroBottom=53
  if(openSolarImageUrl) {
    try { heroBottom=53+await drawQuoteImage(pdf,openSolarImageUrl,margin,53,91,66) }
    catch(error) { console.warn("OpenSolar image unavailable on quote cover:",error) }
  }
  if(heroBottom===53) {
    card(margin,53,91,57,[230,240,246])
    text("Your proposed solar design",margin+6,80,79,10,muted,"normal",5)
    heroBottom=110
  }
  const infoX=119, infoW=w-margin-infoX
  pdf.setTextColor(...blue);pdf.setFont("helvetica","bold");pdf.setFontSize(8);pdf.text("PREPARED FOR",infoX,58)
  pdf.setTextColor(...navy);pdf.setFont("helvetica","bold");pdf.setFontSize(15)
  const customerLines=pdf.splitTextToSize(customer,infoW).slice(0,2);pdf.text(customerLines,infoX,66)
  let infoY=68+customerLines.length*5
  pdf.setFont("helvetica","normal");pdf.setFontSize(9);pdf.setTextColor(...navy)
  infoY=text(address||"Property address to be confirmed",infoX,infoY,infoW,9,navy,"normal",4.5)+5
  infoY=text("This proposal outlines the recommended equipment, indicative pricing and estimated energy performance.",infoX,infoY,infoW,8,muted,"normal",4)
  const heroEnd=Math.max(heroBottom,infoY)+7

  // System summary cards.
  let y=heroEnd
  y=section("Your proposed system",y)
  const gap=4, cardW=(w-margin*2-gap)/2, cardH=23
  const drawSpec=(x,yy,label,detail)=>{
    card(x,yy,cardW,cardH)
    pdf.setTextColor(...blue);pdf.setFont("helvetica","bold");pdf.setFontSize(8);pdf.text(label.toUpperCase(),x+5,yy+7)
    pdf.setTextColor(...navy);pdf.setFont("helvetica","bold");pdf.setFontSize(10)
    pdf.text(pdf.splitTextToSize(detail,cardW-10).slice(0,2),x+5,yy+15)
  }
  drawSpec(margin,y,"Solar panels",d.panelCount ? "×"+d.panelCount : "To be confirmed")
  drawSpec(margin+cardW+gap,y,"System capacity",d.capacity ? d.capacity.toFixed(2)+" kWp" : "To be confirmed")
  drawSpec(margin,y+27,"Inverter",hardwareLabel(d.inverters,"To be confirmed"))
  drawSpec(margin+cardW+gap,y+27,"Battery storage",hardwareLabel(d.batteries,"To be confirmed"))
  y+=58

  y=section("Estimated performance",y)
  const perf=[
    ["Annual electricity consumption",d.epvs.annualConsumption ? Number(d.epvs.annualConsumption).toLocaleString("en-GB")+" kWh" : "Not available"],
    ["Estimated annual savings",d.epvs.annualSavings ? money(d.epvs.annualSavings) : "Not available"],
    ["Estimated long-term savings",d.epvs.totalSavings ? money(d.epvs.totalSavings) : "Not available"]
  ]
  perf.forEach((item,i)=>{
    const py=y+i*10
    pdf.setFillColor(...[[245,171,45],[133,190,58],[40,165,205]][i]);pdf.roundedRect(margin,py,w-margin*2,8,1.5,1.5,"F")
    pdf.setTextColor(255,255,255);pdf.setFont("helvetica","bold");pdf.setFontSize(8);pdf.text(item[0],margin+4,py+5.2)
    pdf.setTextColor(255,255,255);pdf.setFont("helvetica","bold");pdf.setFontSize(9);pdf.text(item[1],w-margin-4,py+5.2,{align:"right"})
  })
  y+=36
  // Price panel is prominent but not crowded.
  card(margin,y,w-margin*2,38)
  const half=(w-margin*2)/2
  pdf.setTextColor(...blue);pdf.setFont("helvetica","bold");pdf.setFontSize(9)
  pdf.text("CASH PRICE",margin+7,y+10)
  pdf.text("INDICATIVE MONTHLY FINANCE",margin+half+5,y+10)
  pdf.setTextColor(...navy);pdf.setFontSize(19)
  pdf.text(money(d.cashPrice),margin+7,y+22)
  pdf.text(money(d.monthly)+" / month",margin+half+5,y+22)
  pdf.setFont("helvetica","normal");pdf.setFontSize(7);pdf.setTextColor(...muted)
  pdf.text("Illustrative at "+d.rate.toFixed(1)+"% over "+d.termYears+" years. Subject to lender approval and confirmed terms.",margin+7,y+32,{maxWidth:w-margin*2-14})
  footer(1)

  // PAGE 2 — Transparent pricing, savings assumptions and inclusions.
  pdf.addPage(); pdf.setFillColor(255,255,255);pdf.rect(0,0,w,h,"F")
  pdf.setTextColor(...blue);pdf.setFont("helvetica","bold");pdf.setFontSize(11);pdf.text("HOMESHIELD SCOTLAND",margin,16)
  pdf.setTextColor(...navy);pdf.setFontSize(22);pdf.text("Your quotation",margin,32)
  text("Pricing and specification summary",margin,40,w-margin*2,9,muted)
  let y2=53
  y2=section("Price and payment options",y2)
  card(margin,y2,w-margin*2,51)
  pdf.setTextColor(...muted);pdf.setFont("helvetica","bold");pdf.setFontSize(9)
  pdf.text("TOTAL CASH PRICE",margin+7,y2+12)
  pdf.text("INDICATIVE FINANCE",margin+half+5,y2+12)
  pdf.setTextColor(...navy);pdf.setFontSize(20)
  pdf.text(money(d.cashPrice),margin+7,y2+24)
  pdf.text(money(d.monthly)+" / month",margin+half+5,y2+24)
  pdf.setFont("helvetica","normal");pdf.setFontSize(8)
  pdf.text("Deposit: "+money(d.deposit),margin+7,y2+35)
  pdf.text("Term: "+d.termYears+" years",margin+half+5,y2+35)
  pdf.text("Illustration at "+d.rate.toFixed(1)+"% annual interest",margin+half+5,y2+43)
  y2+=62
  y2=section("Equipment and installation",y2)
  for(const [label,detail] of equipment){
    card(margin,y2,w-margin*2,17,[247,249,251])
    pdf.setTextColor(...blue);pdf.setFont("helvetica","bold");pdf.setFontSize(8);pdf.text(label.toUpperCase(),margin+5,y2+6)
    pdf.setTextColor(...navy);pdf.setFont("helvetica","normal");pdf.setFontSize(9)
    pdf.text(pdf.splitTextToSize(detail,w-margin*2-10).slice(0,2),margin+5,y2+12)
    y2+=20
  }
  y2+=3;y2=section("What is included",y2)
  y2=text("Supply of the listed solar equipment, installation and commissioning as agreed in the final specification. Any exclusions or site-specific requirements will be confirmed before an order is placed.",margin,y2,w-margin*2,9,navy,"normal",4.5)+5
  y2=section("Estimated savings — assumptions",y2)
  y2=text("Energy savings are estimates based on the information available at the time of quotation. Actual results depend on household usage, weather, tariffs, system design and export arrangements. Figures are indicative, not guarantees.",margin,y2,w-margin*2,8,muted,"normal",4)
  footer(2)

  // PAGE 3 — Next steps, limitations and customer confidence.
  pdf.addPage();pdf.setFillColor(255,255,255);pdf.rect(0,0,w,h,"F")
  pdf.setTextColor(...blue);pdf.setFont("helvetica","bold");pdf.setFontSize(11);pdf.text("HOMESHIELD SCOTLAND",margin,16)
  pdf.setTextColor(...navy);pdf.setFontSize(22);pdf.text("What happens next?",margin,34)
  text("We’ll confirm the final design, equipment and price with you before anything is ordered.",margin,43,w-margin*2,10,muted)
  let y3=62
  const steps=[
    ["01","Review your proposal","Check the proposed system, equipment and pricing."],
    ["02","Confirm the details","We’ll confirm installation scope, site-specific requirements and any exclusions."],
    ["03","Final checks and agreement","We’ll confirm the final specification, total price and, where applicable, finance terms before you commit."]
  ]
  for(const [num,title,desc] of steps){
    card(margin,y3,w-margin*2,34)
    pdf.setFillColor(...blue);pdf.circle(margin+10,y3+11,5,"F")
    pdf.setTextColor(255,255,255);pdf.setFont("helvetica","bold");pdf.setFontSize(8);pdf.text(num,margin+10,y3+12.5,{align:"center"})
    pdf.setTextColor(...navy);pdf.setFont("helvetica","bold");pdf.setFontSize(11);pdf.text(title,margin+20,y3+10)
    text(desc,margin+20,y3+18,w-margin*2-26,8,muted,"normal",4)
    y3+=41
  }
  y3+=4;y3=section("Important information",y3)
  y3=text("This document is a quotation proposal only. It is not a contract, a formal finance offer or a guarantee of savings. Finance is subject to lender approval and the lender’s final terms. Final equipment, installation scope and any exclusions will be confirmed before an order is placed.",margin,y3,w-margin*2,9,navy,"normal",4.5)
  y3+=12
  pdf.setTextColor(...blue);pdf.setFont("helvetica","bold");pdf.setFontSize(15);pdf.text("Homeshield Scotland",margin,y3)
  y3+=8;text("Thank you for considering Homeshield for your solar installation.",margin,y3,w-margin*2,9,muted)
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

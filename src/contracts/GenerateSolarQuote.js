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


  // PAGE 1 — System overview, inspired by the supplied reference.
  pdf.setFillColor(255,255,255); pdf.rect(0,0,w,h,"F")
  pdf.setTextColor(...blue); pdf.setFont("helvetica","bold"); pdf.setFontSize(10)
  pdf.text("HOMESHIELD SCOTLAND",margin,16)
  pdf.setTextColor(...muted);pdf.setFont("helvetica","normal");pdf.setFontSize(7.5)
  pdf.text("QUOTE REF: "+quoteRef,w-margin,12,{align:"right"})
  pdf.text("DATE CREATED: "+today,w-margin,17,{align:"right"})

  pdf.setTextColor(...navy);pdf.setFont("helvetica","bold");pdf.setFontSize(24)
  pdf.text("System Overview",margin,33)
  text("Your proposed solar energy system",margin,41,w-margin*2,9,muted,"normal",4)
  pdf.setFillColor(...blue);pdf.rect(margin,46,31,1.5,"F")

  // Large OpenSolar image, spanning the page width like the reference.
  const imageX=margin,imageY=56,imageW=w-margin*2,imageH=111
  card(imageX,imageY,imageW,imageH,[245,247,249])
  if(openSolarImageUrl) {
    try { await drawQuoteImage(pdf,openSolarImageUrl,imageX+3,imageY+3,imageW-6,imageH-6) }
    catch(error) { console.warn("OpenSolar image unavailable on quote cover:",error) }
  } else {
    text("Solar design image unavailable",imageX+8,imageY+imageH/2,imageW-16,11,muted,"normal",5)
  }

  // Compact specification table.
  const generation=Number(d.epvs.annualGeneration||d.epvs.annual_generation||d.epvs.estimatedGeneration||d.epvs.estimated_generation||d.epvs.annualProduction||d.epvs.annual_production||d.openSolar?.annualGeneration||0)
  const rowData=[
    ["Customer",customer],
    ["Property address",address||"To be confirmed"],
    ["System size",d.capacity?d.capacity.toFixed(2)+" kWp":"To be confirmed"],
    ["Solar panels",d.panelCount?String(d.panelCount)+" × "+(d.panels.find(item=>Number(item?.wattage||item?.power||item?.watts)>0)?.wattage||d.panels.find(item=>Number(item?.power||item?.watts)>0)?.power||450)+" W":"To be confirmed"],
    ["Inverter",hardwareLabel(d.inverters,"To be confirmed")],
    ["Battery",hardwareLabel(d.batteries,"To be confirmed")],
    ["Estimated generation",generation?Number(generation).toLocaleString("en-GB")+" kWh / year":"To be confirmed"]
  ]
  let rowY=173
  const rowH=10
  rowData.forEach(([label,detail],index)=>{
    if(index%2===0){pdf.setFillColor(245,247,249);pdf.roundedRect(margin,rowY,w-margin*2,rowH,1.5,1.5,"F")}
    pdf.setTextColor(...navy);pdf.setFont("helvetica","bold");pdf.setFontSize(8.5);pdf.text(label,margin+5,rowY+7)
    pdf.setTextColor(...muted);pdf.setFont("helvetica","normal");pdf.setFontSize(8.5)
    pdf.text(pdf.splitTextToSize(String(detail),w-margin*2-65).slice(0,1),w-margin-5,rowY+7,{align:"right"})
    rowY+=11
  })

  // Replace signature and itemised price breakdown with the two customer-facing price options.
  const priceY=252
  pdf.setFillColor(...blue);pdf.roundedRect(margin,priceY,w-margin*2,25,3,3,"F")
  const priceHalf=(w-margin*2)/2
  pdf.setTextColor(255,255,255);pdf.setFont("helvetica","bold");pdf.setFontSize(8)
  pdf.text("CASH PRICE",margin+8,priceY+7)
  pdf.text("MONTHLY FINANCE",margin+priceHalf+6,priceY+7)
  pdf.setFontSize(16)
  pdf.text(money(d.cashPrice),margin+8,priceY+17)
  pdf.text(money(d.monthly)+" / month",margin+priceHalf+6,priceY+17)
  pdf.setFont("helvetica","normal");pdf.setFontSize(6.5)
  pdf.text("Finance illustration at "+d.rate.toFixed(1)+"% over "+d.termYears+" years; subject to lender approval and confirmed terms.",margin+8,priceY+22)
  footer(1)

  // PAGE 2 — Itemised equipment and service breakdown.
  pdf.addPage(); pdf.setFillColor(255,255,255);pdf.rect(0,0,w,h,"F")
  pdf.setTextColor(...blue);pdf.setFont("helvetica","bold");pdf.setFontSize(10);pdf.text("HOMESHIELD SCOTLAND",margin,16)
  pdf.setTextColor(...navy);pdf.setFont("helvetica","bold");pdf.setFontSize(22);pdf.text("Itemised Breakdown",margin,33)
  text("Equipment and services included in your proposed system",margin,41,w-margin*2,9,muted)
  pdf.setFillColor(...blue);pdf.rect(margin,47,31,1.5,"F")

  const itemRows=[]
  const qtyOf=(item,fallback=1)=>Number(item?.quantity ?? item?.count ?? item?.qty ?? fallback) || fallback
  const itemName=(item,fallback)=>[item?.manufacturer,item?.model||item?.name].filter(Boolean).join(" ") || fallback
  d.panels.forEach((item,index)=>itemRows.push({
    name:itemName(item,"Solar panels"),type:"Product",
    qty:qtyOf(item,index===0 ? (d.panelCount||1) : 1),
  }))
  d.inverters.forEach(item=>{
    itemRows.push({name:itemName(item,"Inverter"),type:"Product",qty:qtyOf(item)})
    if(/hanchu|ess|wifi|dongle/i.test(String(item?.model||item?.name||""))) {
      // Accessory naming is retained only when explicitly present in source data.
    }
  })
  d.batteries.forEach(item=>itemRows.push({name:itemName(item,"Battery storage"),type:"Product",qty:qtyOf(item)}))
  if(!itemRows.some(item=>/panel/i.test(item.name)) && d.panelCount>0) {
    itemRows.unshift({name:"Solar panels",type:"Product",qty:d.panelCount})
  }
  if(!itemRows.some(item=>/installation/i.test(item.name))) itemRows.push({name:"Installation and commissioning",type:"Service",qty:1})
  if(!itemRows.some(item=>/system design/i.test(item.name))) itemRows.push({name:"System design",type:"Service",qty:1})

  const tableX=margin, tableW=w-margin*2, nameW=tableW-54, typeW=28, qtyW=26
  let ty=56
  pdf.setFillColor(...blue);pdf.roundedRect(tableX,ty,tableW,12,2,2,"F")
  pdf.setTextColor(255,255,255);pdf.setFont("helvetica","bold");pdf.setFontSize(8)
  pdf.text("PRODUCT / SERVICE",tableX+7,ty+7.5)
  pdf.text("TYPE",tableX+nameW+typeW/2,ty+7.5,{align:"center"})
  pdf.text("QTY",tableX+tableW-7,ty+7.5,{align:"right"})
  ty+=12
  itemRows.forEach((item,index)=>{
    const rowHeight=8
    if(index%2===0){pdf.setFillColor(245,248,249);pdf.roundedRect(tableX,ty,tableW,rowHeight,1,1,"F")}
    pdf.setTextColor(...navy);pdf.setFont("helvetica","normal");pdf.setFontSize(8)
    const nameLines=pdf.splitTextToSize(item.name,nameW-12).slice(0,1)
    pdf.text(nameLines,tableX+7,ty+5.3)
    const isService=item.type==="Service"
    pdf.setFillColor(...(isService?[255,241,224]:[226,240,248]))
    pdf.roundedRect(tableX+nameW+2,ty+1.2,typeW-4,5.6,2,2,"F")
    pdf.setTextColor(...(isService?[177,91,20]:blue));pdf.setFont("helvetica","bold");pdf.setFontSize(6.5)
    pdf.text(item.type,tableX+nameW+typeW/2,ty+4.9,{align:"center"})
    pdf.setTextColor(...navy);pdf.setFontSize(8);pdf.text(String(item.qty),tableX+tableW-7,ty+5.3,{align:"right"})
    ty+=rowHeight
  })
  ty+=8
  ty=section("What is included",ty)
  ty=text("Supply of the listed solar equipment, installation and commissioning as agreed in the final specification. Any exclusions or site-specific requirements will be confirmed before an order is placed.",margin,ty,w-margin*2,9,navy,"normal",4.5)+5
  ty=section("Savings and finance assumptions",ty)
  text("Energy savings are estimates based on available information. Actual results depend on household usage, weather, tariffs, system design and export arrangements. Finance is illustrative, subject to lender approval and confirmed terms.",margin,ty,w-margin*2,8,muted,"normal",4)
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

import jsPDF from "jspdf"
import { supabase } from "../lib/supabase"

const money = (value) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(Number(value || 0))
const value = (v, fallback = "To be confirmed") => v === null || v === undefined || v === "" ? fallback : String(v)
const clean = (v) => String(v ?? "").trim()

function getQuoteData(appointment) {
  let calculation = appointment?.epvs_calculation || {}
  if (typeof calculation === "string") {
    try { calculation = JSON.parse(calculation) } catch { calculation = {} }
  }
  const epvs = calculation?.data || calculation || {}
  const results = calculation?.results || epvs?.results || {}
  const openSolar = epvs?.openSolar || epvs?.open_solar || {}
  const hardware = epvs?.hardware || openSolar?.hardware || {}
  const panels = Array.isArray(hardware.panels) ? hardware.panels : (Array.isArray(epvs.panels) ? epvs.panels : [])
  const inverters = Array.isArray(hardware.inverters) ? hardware.inverters : (Array.isArray(epvs.inverters) ? epvs.inverters : [])
  const batteries = Array.isArray(hardware.batteries) ? hardware.batteries : (Array.isArray(epvs.batteries) ? epvs.batteries : [])
  const panelCount = panels.reduce((sum, item) => sum + Number(item?.quantity || item?.count || item?.panelCount || item?.panel_count || 0), 0)
    || Number(epvs.panelCount || epvs.panel_count || epvs.numberOfPanels || epvs.number_of_panels || 0)
  const arrays = Array.isArray(openSolar?.arrays) && openSolar.arrays.length
    ? openSolar.arrays
    : (Array.isArray(epvs?.arrays) ? epvs.arrays : [])
  const derivedCapacity = arrays.reduce((sum, array) => {
    const wattage = Number(array?.panelWattage || array?.panel_wattage || 0)
    const count = Number(array?.panelCount || array?.panel_count || array?.numberOfPanels || array?.number_of_panels || 0)
    return sum + (wattage * count) / 1000
  }, 0)
  const capacity = Number(results.systemSize || results.system_size || epvs.systemSize || epvs.system_size || openSolar.systemSize || openSolar.system_size || derivedCapacity || 0)
  const derivedGeneration = arrays.reduce((sum, array) => {
    const wattage = Number(array?.panelWattage || array?.panel_wattage || 0)
    const count = Number(array?.panelCount || array?.panel_count || array?.numberOfPanels || array?.number_of_panels || 0)
    const irradiance = Number(array?.irradiance || 0)
    const shading = Number(array?.shading ?? 1)
    return sum + ((wattage * count) / 1000) * irradiance * shading
  }, 0)
  const generation = Number(results.generation || results.annualGeneration || results.annual_generation || epvs.generation || epvs.annualGeneration || epvs.annual_generation || epvs.estimatedGeneration || epvs.estimated_generation || epvs.annualProduction || epvs.annual_production || openSolar.annualGeneration || openSolar.annual_generation || derivedGeneration || 0)
  const isTradeLead = String(appointment?.is_trade_lead || "").trim().toUpperCase() === "TRUE"
  const cashPrice = Number(isTradeLead ? (appointment?.price_left || 0) : (epvs.totalContractValue || epvs.totalPrice || appointment?.contract_value || appointment?.price_left || 0))
  const termYears = 10
  const rate = 3.9
  const deposit = Number(epvs.deposit || appointment?.deposit || 0)
  const principal = Math.max(0, cashPrice - deposit)
  const months = Math.max(1, Math.round(termYears * 12))
  const monthlyRate = rate / 100 / 12
  const monthly = monthlyRate ? principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months)) : principal / months
  return { epvs, results, openSolar, panels, inverters, batteries, panelCount, capacity, generation, cashPrice, termYears, rate, deposit, monthly }
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

export async function GenerateSolarQuote({ appointment, previewOnly = true, priceMode = "cash" }) {
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


  // PAGE 1 — System overview.
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
  const imageX=margin,imageY=56,imageW=w-margin*2,imageH=100
  card(imageX,imageY,imageW,imageH,[245,247,249])
  if(openSolarImageUrl) {
    try { await drawQuoteImage(pdf,openSolarImageUrl,imageX+3,imageY+3,imageW-6,imageH-6) }
    catch(error) { console.warn("OpenSolar image unavailable on quote cover:",error) }
  } else {
    text("Solar design image unavailable",imageX+8,imageY+imageH/2,imageW-16,11,muted,"normal",5)
  }

  // Compact specification table.
  const generation=Number(d.generation || 0)
  // Use the saved EPVS first-year pre-install electricity bill, converted from annual to monthly.
  const savedCalculation=record?.epvs_calculation||{}
  const savedProjection=savedCalculation?.thirtyYearProjection||savedCalculation?.data?.thirtyYearProjection||d.epvs?.thirtyYearProjection||{}
  const savedScenario=savedProjection?.scenarios?.averageInflation
  const savedRows=Array.isArray(savedScenario?.rows)?savedScenario.rows:(Array.isArray(savedScenario)?savedScenario:[])
  const annualPreInstallBill=Number(savedRows.find(row=>Number(row?.year)===1)?.billPreInstall ?? savedRows[0]?.billPreInstall)
  const monthlyElectricityBill=Number.isFinite(annualPreInstallBill)&&annualPreInstallBill>0?annualPreInstallBill/12:null
  const rowData=[
    ["Customer",customer],
    ["Property address",address||"To be confirmed"],
    ["System size",d.capacity?d.capacity.toFixed(2)+" kWp":"To be confirmed"],
    ["Solar panels",d.panelCount?String(d.panelCount)+" × "+(d.panels.find(item=>Number(item?.wattage||item?.power||item?.watts)>0)?.wattage||d.panels.find(item=>Number(item?.power||item?.watts)>0)?.power||450)+" W":"To be confirmed"],
    ["Inverter",hardwareLabel(d.inverters,"To be confirmed")],
    ["Battery",hardwareLabel(d.batteries,"To be confirmed")],
    ["Estimated generation",generation?Number(generation).toLocaleString("en-GB")+" kWh / year":"To be confirmed"],
    ["Estimated current electricity bill",monthlyElectricityBill!==null?money(monthlyElectricityBill)+" / month":"To be confirmed"]
  ]
  let coverRowY=162
  const rowH=10
  rowData.forEach(([label,detail],index)=>{
    if(index%2===0){pdf.setFillColor(245,247,249);pdf.roundedRect(margin,coverRowY,w-margin*2,rowH,1.5,1.5,"F")}
    pdf.setTextColor(...navy);pdf.setFont("helvetica","bold");pdf.setFontSize(8.5);pdf.text(label,margin+5,coverRowY+7)
    pdf.setTextColor(...muted);pdf.setFont("helvetica","normal");pdf.setFontSize(8.5)
    pdf.text(pdf.splitTextToSize(String(detail),w-margin*2-65).slice(0,1),w-margin-5,coverRowY+7,{align:"right"})
    coverRowY+=11
  })

  // Every quote displays both the cash price and monthly finance illustration.
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

  // Match the itemised table styling and hardware-resolution behaviour used by
  // GenerateSolarContract.js, without changing the contract generator.
  const hardware = d.epvs?.data?.openSolar?.hardware || d.openSolar?.hardware || {}
  const panels = Array.isArray(hardware.panels) ? hardware.panels : d.panels
  const inverters = Array.isArray(hardware.inverters) ? hardware.inverters : d.inverters
  const batteries = Array.isArray(hardware.batteries) ? hardware.batteries : d.batteries
  const findHardware = (items,label) => {
    const item = items.find(candidate => {
      const model = String(candidate?.model || candidate?.name || "").trim().toLowerCase()
      return model && (model.includes(label.toLowerCase()) || label.toLowerCase()==="panels")
    })
    if(!item) return null
    return {
      name:[String(item?.manufacturer||"").trim(),String(item?.model||item?.name||"").trim(),label].filter(Boolean).join(" "),
      quantity:item?.quantity
    }
  }
  const resolveHardware = name => {
    const normalized=String(name||"").trim().toLowerCase()
    const findMatch=(items,label)=> {
      const item=items.find(candidate=>{
        const model=String(candidate?.model||candidate?.name||"").trim().toLowerCase()
        return normalized===label.toLowerCase() || normalized===model ||
          (model && normalized.startsWith(model+" ")) ||
          normalized.endsWith(" "+label.toLowerCase()) ||
          (label==="Panels" && /\\bpanels$/i.test(normalized))
      })
      if(!item)return null
      return {name:[String(item?.manufacturer||"").trim(),String(item?.model||item?.name||"").trim(),label].filter(Boolean).join(" "),quantity:item?.quantity}
    }
    return findMatch(panels,"Panels") || findMatch(inverters,"Inverter") || findMatch(batteries,"Battery")
  }
  const panelHardware = findHardware(panels,"Panels")
  const panelWattage = d.panels.map(item=>Number(item?.wattage||item?.power||item?.watts||item?.capacity||0)).find(n=>n>0) || 450
  const configuredItems = [
    {name:"Panels",type:"Product",quantity:d.panelCount||1},
    {name:"Roof Hooks",type:"Product",quantity:"-"},
    {name:"Rail Fix Kit",type:"Product",quantity:"-"},
    {name:findHardware(inverters,"Inverter")?.name||"Inverter",type:"Product",quantity:findHardware(inverters,"Inverter")?.quantity??1},
    {name:"Wifi Dongle",type:"Product",quantity:1},
    {name:findHardware(batteries,"Battery")?.name||"Battery",type:"Product",quantity:findHardware(batteries,"Battery")?.quantity??1},
    {name:"24 Month Workmanship Warranty",type:"Service",quantity:1},
    {name:"System Design",type:"Service",quantity:1},
    {name:"Generation Meter",type:"Product",quantity:1},
    {name:"Bird Proofing",type:"Service",quantity:1},
    {name:"DC cable",type:"Product",quantity:1},
    {name:"EPVS Validation",type:"Service",quantity:1},
    {name:"HIES Warranty",type:"Service",quantity:1},
    {name:"Installation",type:"Service",quantity:1},
    {name:"Lifetime Monitoring",type:"Service",quantity:1},
    {name:"MCS Building Control Registration",type:"Service",quantity:1},
    {name:"Pair of A/C Isolators 32A",type:"Product",quantity:1},
    {name:"Pair of D/C 80A Isolators",type:"Product",quantity:1},
    {name:"Panel Installation",type:"Service",quantity:1},
    {name:"PV on Roof and Hazards Label Pack",type:"Product",quantity:1},
    {name:"Scaffolding (Where required)",type:"Service",quantity:1},
    {name:"Electrical Connections",type:"Service",quantity:1}
  ]
  const itemRows=configuredItems.map(item=>{
    let name=item.name, quantity=item.quantity
    const match=resolveHardware(name)
    if(match){name=match.name;quantity=match.quantity??quantity}
    const normalized=String(name).trim().toLowerCase()
    if(normalized==="roof hooks"||normalized==="rail fix kit")quantity="-"
    if(normalized==="panel installation")quantity=1
    return {name,type:item.type,qty:quantity}
  })
  const tableX=margin, tableW=w-margin*2
  const typeX=tableX+tableW-43
  let headerY=56
  const rowHeight=6.8
  pdf.setFillColor(...blue)
  pdf.roundedRect(tableX,headerY-7,tableW,11,2,2,"F")
  pdf.setTextColor(255,255,255)
  pdf.setFont("helvetica","bold")
  pdf.setFontSize(8)
  pdf.text("PRODUCT / SERVICE",tableX+7,headerY)
  pdf.text("TYPE",typeX,headerY,{align:"center"})
  pdf.text("QTY",tableX+tableW-7,headerY,{align:"right"})

  let rowY=headerY+8.3
  itemRows.forEach((item,index)=>{
    const name=String(item.name)
    const type=String(item.type||"")
    const quantity=String(item.qty)
    if(index%2===0){
      pdf.setFillColor(247,249,250)
      pdf.roundedRect(tableX,rowY-5,tableW,rowHeight,1.2,1.2,"F")
    }
    pdf.setTextColor(...navy)
    pdf.setFont("helvetica","normal")
    pdf.setFontSize(8)
    pdf.text(name,tableX+7,rowY)
    if(type){
      pdf.setFont("helvetica","bold")
      pdf.setFontSize(6.2)
      const tw=pdf.getTextWidth(type)+6
      const key=type.toLowerCase()
      const fill=key==="service"?[255,241,230]:key==="product"?[231,242,248]:[238,240,242]
      const colour=key==="service"?[199,106,0]:key==="product"?[11,93,138]:[75,85,92]
      pdf.setFillColor(...fill)
      pdf.setTextColor(...colour)
      pdf.roundedRect(typeX-tw/2,rowY-3.6,tw,4.2,2,2,"F")
      pdf.text(type,typeX,rowY-0.45,{align:"center"})
    }
    pdf.setTextColor(...navy)
    pdf.setFont("helvetica","bold")
    pdf.setFontSize(8)
    pdf.text(quantity,tableX+tableW-7,rowY,{align:"right"})
    rowY+=rowHeight
  })
  let ty=rowY+3
  ty+=8
  ty=section("What is included",ty)
  ty=text("Supply of the listed solar equipment, installation and commissioning as agreed in the final specification. Any exclusions or site-specific requirements will be confirmed before an order is placed.",margin,ty,w-margin*2,9,navy,"normal",4.5)+5
  ty=section("Savings and finance assumptions",ty)
  text("Energy savings are estimates based on available information. Actual results depend on household usage, weather, tariffs, system design and export arrangements. Finance is illustrative, subject to lender approval and confirmed terms.",margin,ty,w-margin*2,8,muted,"normal",4)
  footer(2)

  // PAGE 3 — EPVS 30-year financial and generation projection.
  pdf.addPage();pdf.setFillColor(255,255,255);pdf.rect(0,0,w,h,"F")
  pdf.setTextColor(...blue);pdf.setFont("helvetica","bold");pdf.setFontSize(10);pdf.text("HOMESHIELD SCOTLAND",margin,16)
  pdf.setTextColor(...navy);pdf.setFont("helvetica","bold");pdf.setFontSize(22);pdf.text("30 year breakdown",margin,32)
  pdf.setFillColor(...blue);pdf.rect(margin,38,31,1.5,"F")

  // EPVS stores the 30-year projection on the calculation object itself, alongside data.
  // Read the same path used by EpvsPdfRenderer rather than only reading calculation.data.
  const calculation=record?.epvs_calculation||{}
  const projection30=calculation?.thirtyYearProjection||calculation?.data?.thirtyYearProjection||d.epvs?.thirtyYearProjection||{}
  const scenario30=projection30?.scenarios?.averageInflation
  const projectionRows30=Array.isArray(scenario30?.rows)?scenario30.rows:(Array.isArray(scenario30)?scenario30:[])
  const tableX30=margin,tableY30=46,tableW30=w-margin*2
  const headers30=["YR","GENERATION","SOLAR","BATTERY","EXPORT","ANNUAL BENEFIT","YEARLY PAYMENTS","NET ANNUAL","NET POSITION","BILL PRE INSTALL","BILL POST INSTALL"]
  const weights30=[7,13,11,12,11,14,13,12,13,14,14]
  const weightTotal30=weights30.reduce((sum,n)=>sum+n,0)
  const widths30=weights30.map(n=>tableW30*n/weightTotal30)
  const headerH30=9,rowH30=5.0,totalH30=5.5
  pdf.setTextColor(...navy);pdf.setFont("helvetica","bold");pdf.setFontSize(8)
  pdf.text("30 Year Breakdown – 7.6% Inflation Rate",tableX30,45)
  pdf.setFillColor(...blue);pdf.roundedRect(tableX30,tableY30,tableW30,headerH30,1.5,1.5,"F")
  let tx30=tableX30
  headers30.forEach((header,index)=>{
    pdf.setTextColor(255,255,255);pdf.setFont("helvetica","bold");pdf.setFontSize(4.8)
    const words=header.split(" ")
    const mid=Math.ceil(words.length/2)
    const first=words.length>2?words.slice(0,mid).join(" "):header
    const second=words.length>2?words.slice(mid).join(" "):""
    if(second){pdf.text(first,tx30+widths30[index]/2,tableY30+3.4,{align:"center"});pdf.text(second,tx30+widths30[index]/2,tableY30+6.7,{align:"center"})}
    else pdf.text(header,tx30+widths30[index]/2,tableY30+5.5,{align:"center"})
    tx30+=widths30[index]
  })
  const numeric30=(row,...keys)=>{
    for(const key of keys){
      const direct=Number(row?.[key])
      if(Number.isFinite(direct)&&direct!==0)return direct
      const nested=Number(row?.model?.[key])
      if(Number.isFinite(nested)&&nested!==0)return nested
    }
    return 0
  }
  const solarOf30=row=>numeric30(row,"solarBenefit","solar")
  const batteryOf30=row=>numeric30(row,"batteryBenefit","battery")||numeric30(row,"batterySelfConsumptionBenefit")+numeric30(row,"forceChargeBenefit")
  const exportOf30=row=>numeric30(row,"exportBenefit")
  const benefitOf30=row=>solarOf30(row)+batteryOf30(row)+exportOf30(row)
  const savedAdminFee30=d.epvs?.adminFee??calculation?.data?.adminFee??record.admin_fee_amount
  const adminFee30=savedAdminFee30!==null&&savedAdminFee30!==undefined&&String(savedAdminFee30).trim()!==""?Math.max(0,Number(savedAdminFee30)||0):399
  const paymentOf30=row=>numeric30(row,"yearlyPayment","payment")-(Number(row?.year)===1?adminFee30:0)
  const fmtNum30=n=>Number(n||0).toLocaleString("en-GB",{maximumFractionDigits:0})
  const fmtMoney30=n=>money(n).replace(".00","")
  if(!projectionRows30.length){
    text("No saved 30-year EPVS projection is available for this appointment. Please recalculate and save the EPVS results before issuing this quotation.",tableX30,tableY30+20,tableW30,9,muted,"normal",4.5)
  } else {
    let rowY30=tableY30+headerH30
    let cumulative30=0
    const totals30=Array(10).fill(0)
    const bodyRows30=projectionRows30.slice(0,30).map(row=>{
      const solar=solarOf30(row),battery=batteryOf30(row),exportValue=exportOf30(row),benefit=solar+battery+exportValue
      const payment=paymentOf30(row),netAnnual=benefit+payment
      cumulative30+=benefit
      return [String(row?.year||""),fmtNum30(row?.generation),fmtMoney30(solar),fmtMoney30(battery),fmtMoney30(exportValue),fmtMoney30(benefit),fmtMoney30(payment),fmtMoney30(netAnnual),fmtMoney30(cumulative30+projectionRows30.reduce((sum,r)=>sum+paymentOf30(r),0)),fmtMoney30(row?.billPreInstall),fmtMoney30(row?.billPostInstall)].map((v,i)=>({v,n:[1,2,3,4,5,6,7,8,9,10].includes(i)?Number(String(v).replace(/[£,]/g,"")):0}))
    })
    const totalRaw30=Array(11).fill(0)
    bodyRows30.forEach((cells,index)=>{
      const row=projectionRows30[index]
      const solar=solarOf30(row),battery=batteryOf30(row),exportValue=exportOf30(row),benefit=solar+battery+exportValue,payment=paymentOf30(row)
      const vals=[String(row?.year||""),fmtNum30(row?.generation),fmtMoney30(solar),fmtMoney30(battery),fmtMoney30(exportValue),fmtMoney30(benefit),fmtMoney30(payment),fmtMoney30(benefit+payment),fmtMoney30(benefit+payment),fmtMoney30(row?.billPreInstall),fmtMoney30(row?.billPostInstall)]
      const nums=[0,Number(row?.generation)||0,solar,battery,exportValue,benefit,payment,benefit+payment,benefit+payment,Number(row?.billPreInstall)||0,Number(row?.billPostInstall)||0]
      tx30=tableX30
      vals.forEach((val,index)=>{
        const highlighted=index===5||index===8
        pdf.setFillColor(...(highlighted?[232,245,235]:index%2===0?[247,249,250]:[255,255,255]))
        pdf.setDrawColor(220,228,234);pdf.rect(tx30,rowY30,widths30[index],rowH30,"FD")
        pdf.setTextColor(...(highlighted?[38,120,58]:navy));pdf.setFont("helvetica",index===0?"bold":"normal");pdf.setFontSize(5.3)
        pdf.text(String(val),tx30+widths30[index]-0.7,rowY30+3.5,{align:"right"})
        tx30+=widths30[index]
        totalRaw30[index]+=nums[index]
      })
      rowY30+=rowH30
    })
    tx30=tableX30
    const totalVals=["TOTAL",fmtNum30(totalRaw30[1]),...totalRaw30.slice(2).map(fmtMoney30)]
    totalVals.forEach((val,index)=>{
      pdf.setFillColor(...(index===5||index===8?blue:[82,92,100]));pdf.setDrawColor(255,255,255);pdf.rect(tx30,rowY30,widths30[index],totalH30,"FD")
      pdf.setTextColor(255,255,255);pdf.setFont("helvetica","bold");pdf.setFontSize(5.2);pdf.text(String(val),tx30+widths30[index]-0.7,rowY30+3.7,{align:"right"});tx30+=widths30[index]
    })
  }

  // Inflation explanation disclaimer, matching the supplied EPVS reference.
  const disclaimerY30=tableY30+headerH30+Math.min(projectionRows30.length,30)*rowH30+totalH30+4
  const disclaimerH30=39
  if(disclaimerY30+disclaimerH30<h-8){
    pdf.setFillColor(242,246,249);pdf.setDrawColor(218,227,235)
    pdf.roundedRect(margin,disclaimerY30,w-margin*2,disclaimerH30,4,4,"FD")
    pdf.setTextColor(...navy);pdf.setFont("helvetica","bold");pdf.setFontSize(10)
    pdf.text("Why have we shown savings based on varying rates on inflation?",margin+7,disclaimerY30+9)
    const disclaimerText30="The current fuel inflation figure of 7.6% is based on data from the Office for National Statistics, covering the period 2015–2024. You can find more information at www.ons.gov.uk. The reason we have shown savings based on varying levels of inflation is because electricity inflation has fluctuated significantly over the past 20 years - including negative CPI values in 2006, 2015, and 2016 (-2.5%, -0.2%, -0.3%), and spikes like 21.7% in 2016. To avoid relying on one-off years, we use a long-term average to provide a more balanced view."
    text(disclaimerText30,margin+7,disclaimerY30+17,w-margin*2-14,8,muted,"normal",4)
  }
  footer(3)

  // PAGE 4 — Next steps, limitations and customer confidence.
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

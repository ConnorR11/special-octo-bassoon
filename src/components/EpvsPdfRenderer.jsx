import { jsPDF } from "jspdf"

function hexToRgb(hex, fallback = [0, 0, 0]) {
  const value = String(hex || "").trim().replace("#", "")
  if (!/^[0-9a-f]{6}$/i.test(value)) return fallback
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)]
}
function pdfMoney(value, settings) {
  const amount = Number(value || 0)
  const digits = Number(settings?.formatting?.currency_decimals ?? 2)
  return (settings?.formatting?.currency === "GBP" ? "£" : "") + amount.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
function pdfNumber(value, settings) {
  const digits = Number(settings?.formatting?.number_decimals ?? 2)
  return Number(value || 0).toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
function pdfValue(row, ...keys) {
  for (const key of keys) {
    const direct = Number(row?.[key])
    if (Number.isFinite(direct) && direct !== 0) return direct
    const model = Number(row?.model?.[key])
    if (Number.isFinite(model) && model !== 0) return model
  }
  return 0
}

export async function generateEpvsPdf(appointment, calculation, settings, page) {
  const data = calculation?.data || {}
  const projection = calculation?.thirtyYearProjection || {}
  const scenario = projection.scenarios?.averageInflation
  const rows = Array.isArray(scenario?.rows) ? scenario.rows : Array.isArray(scenario) ? scenario : []
  const doc = new jsPDF({ orientation: settings?.orientation || "portrait", unit: "mm", format: settings?.page_size || "a4" })
  const customer = appointment?.name || data.customerName || "Customer"
  const postcode = appointment?.postcode || data.postcode || ""
  const header = settings?.header || {}, summary = settings?.summary || {}, table = settings?.table || {}, footer = settings?.footer || {}
  const pageWidth = doc.internal.pageSize.getWidth(), pageHeight = doc.internal.pageSize.getHeight()
  const headerBg = hexToRgb(header.background, [23,37,84]), headerText = hexToRgb(header.title_color, [255,255,255])
  const summaryBg = hexToRgb(summary.cards?.background, [37,164,70]), summaryText = hexToRgb(summary.cards?.text_color, [255,255,255]), headingText = hexToRgb(summary.heading_color, [30,41,59])
  const tableHeaderBg = hexToRgb(table.header?.background, [75,75,75]), tableHeaderText = hexToRgb(table.header?.text_color, [255,255,255]), rowText = hexToRgb(table.row?.text_color, [30,41,59]), rowHighlight = hexToRgb(table.highlight?.background, [231,244,234])
  const totalBg = hexToRgb(table.totals?.background, [82,82,82]), totalHighlight = hexToRgb(table.totals?.highlight_background, [37,164,70]), totalText = hexToRgb(table.totals?.text_color, [255,255,255]), negativeText = hexToRgb(table.negative?.text_color, [255,0,0])
  const footerLine = hexToRgb(footer.line_color, [226,232,240]), footerText = hexToRgb(footer.text_color, [100,116,139])

  let cardCumulative = 0, paybackYear = null, firstYearBenefit = 0, finalNetPosition = 0
  const totalPayments = rows.reduce((total, row) => total + pdfValue(row, "yearlyPayment", "payment"), 0)
  rows.forEach((row, index) => {
    const annualBenefit = pdfValue(row, "solarBenefit", "solar") + (pdfValue(row, "batteryBenefit", "battery") || pdfValue(row, "batterySelfConsumptionBenefit") + pdfValue(row, "forceChargeBenefit")) + pdfValue(row, "exportBenefit")
    if (index === 0) firstYearBenefit = annualBenefit
    cardCumulative += annualBenefit
    const netPosition = totalPayments + cardCumulative
    if (paybackYear === null && netPosition >= 0) paybackYear = Number(row.year || 0)
    finalNetPosition = netPosition
  })

  const headerHeight = Number(header.height ?? 10)
  doc.setFillColor(...headerBg); doc.rect(0,0,pageWidth,headerHeight,"F")
  doc.setTextColor(...headerText); doc.setFont(undefined,"bold"); doc.setFontSize(Number(header.title_font_size ?? 8.5)); doc.text(String(header.title || page?.title || "EPVS Calculation"),7,Math.min(headerHeight-3.6,6.4))
  doc.setFont(undefined,"normal"); doc.setFontSize(Number(header.customer_font_size ?? 6.5)); doc.text(String(customer) + " · " + String(postcode || "No postcode"),pageWidth-10,Math.min(headerHeight-3.6,6.4),{align:"right"})

  doc.setTextColor(...headingText); doc.setFont(undefined,"bold"); doc.setFontSize(Number(summary.heading_font_size ?? 8)); doc.text(String(summary.heading || ""),7,headerHeight+5)
  const cards = Array.isArray(summary.cards?.items) ? summary.cards.items : [], cardHeight=Number(summary.cards?.height ?? 18), cardGap=Number(summary.cards?.gap ?? 4), cardColumns=Number(summary.cards?.columns ?? 4), cardWidth=(pageWidth-14-cardGap*(cardColumns-1))/cardColumns, cardY=headerHeight+8, cardRadius=Number(summary.cards?.radius ?? 2.5), cardValues=[pdfMoney(firstYearBenefit,settings),paybackYear?String(paybackYear)+" years":"—",pdfMoney(finalNetPosition,settings),pdfMoney(finalNetPosition,settings)]
  cards.slice(0,cardColumns).forEach((label,index)=>{const x=7+index*(cardWidth+cardGap);doc.setFillColor(...summaryBg);doc.roundedRect(x,cardY,cardWidth,cardHeight,cardRadius,cardRadius,"F");doc.setTextColor(...summaryText);doc.setFont(undefined,"bold");doc.setFontSize(7.2);doc.text(String(label||""),x+cardWidth/2,cardY+7,{align:"center"});doc.setFontSize(9);doc.text(cardValues[index]||"",x+cardWidth/2,cardY+13.5,{align:"center"})})

  let y=Number(table.start_y ?? 40)
  const headers=Array.isArray(table.columns)?table.columns:[], widths=Array.isArray(table.widths)?table.widths.map(Number):[], totalWidth=widths.reduce((sum,width)=>sum+width,0), startX=(pageWidth-totalWidth)/2, headerTableHeight=Number(table.header?.height ?? 10), rowHeight=Number(table.row?.height ?? 4.5), rowFontSize=Number(table.row?.font_size ?? 7), totalHeight=Number(table.totals?.height ?? 5.2), highlightColumns=new Set((table.highlight?.columns||[]).map(Number)), negativeColumns=new Set((table.negative?.columns||[]).map(Number))
  let x=startX; doc.setFont(undefined,"bold"); doc.setFontSize(Number(table.header?.font_size ?? 6.2))
  headers.forEach((headerValue,index)=>{doc.setFillColor(...tableHeaderBg);doc.setDrawColor(...tableHeaderBg);doc.rect(x,y,widths[index],headerTableHeight,"FD");doc.setTextColor(...tableHeaderText);const lines=String(headerValue||"").split(" ");if(lines.length>1){const midpoint=Math.ceil(lines.length/2);doc.text(lines.slice(0,midpoint).join(" "),x+widths[index]/2,y+3.5,{align:"center"});doc.text(lines.slice(midpoint).join(" "),x+widths[index]/2,y+7,{align:"center"})}else{doc.text(String(headerValue||""),x+widths[index]/2,y+5.5,{align:"center"})}x+=widths[index]})
  y += headerTableHeight

  let cumulativeBenefit=0
  const totals={generation:0,solar:0,battery:0,exportBenefit:0,annualBenefit:0,payments:0,netAnnual:0,billPre:0,billPost:0,finalNetPosition:0}
  rows.forEach(row=>{const solar=pdfValue(row,"solarBenefit","solar"),battery=pdfValue(row,"batteryBenefit","battery")||pdfValue(row,"batterySelfConsumptionBenefit")+pdfValue(row,"forceChargeBenefit"),exportBenefit=pdfValue(row,"exportBenefit"),annualBenefit=solar+battery+exportBenefit,payment=pdfValue(row,"yearlyPayment","payment"),netAnnual=annualBenefit+payment;cumulativeBenefit+=annualBenefit;const netPosition=totalPayments+cumulativeBenefit;totals.generation+=Number(row.generation||0);totals.solar+=solar;totals.battery+=battery;totals.exportBenefit+=exportBenefit;totals.annualBenefit+=annualBenefit;totals.payments+=payment;totals.netAnnual+=netAnnual;totals.billPre+=Number(row.billPreInstall||0);totals.billPost+=Number(row.billPostInstall||0);totals.finalNetPosition=netPosition;const values=[String(row.year||""),pdfNumber(row.generation,settings),pdfMoney(solar,settings),pdfMoney(battery,settings),pdfMoney(exportBenefit,settings),pdfMoney(annualBenefit,settings),pdfMoney(payment,settings),pdfMoney(netAnnual,settings),pdfMoney(netPosition,settings),pdfMoney(row.billPreInstall,settings),pdfMoney(row.billPostInstall,settings)];x=startX;doc.setFont(undefined,"normal");doc.setFontSize(rowFontSize);values.forEach((value,index)=>{doc.setFillColor(...(highlightColumns.has(index)?rowHighlight:[255,255,255]));doc.setTextColor(...(netAnnual<0&&negativeColumns.has(index)?negativeText:rowText));doc.rect(x,y,widths[index],rowHeight,"FD");doc.text(value,x+widths[index]-1,y+rowHeight-1.45,{align:"right"});x+=widths[index]});y+=rowHeight})
  if(rows.length){const values=["TOTAL",pdfNumber(totals.generation,settings),pdfMoney(totals.solar,settings),pdfMoney(totals.battery,settings),pdfMoney(totals.exportBenefit,settings),pdfMoney(totals.annualBenefit,settings),pdfMoney(totals.payments,settings),pdfMoney(totals.netAnnual,settings),pdfMoney(totals.finalNetPosition,settings),pdfMoney(totals.billPre,settings),pdfMoney(totals.billPost,settings)];x=startX;doc.setFont(undefined,"bold");doc.setFontSize(rowFontSize);values.forEach((value,index)=>{doc.setFillColor(...(index===5||index===8?totalHighlight:totalBg));doc.setTextColor(...totalText);doc.rect(x,y,widths[index],totalHeight,"FD");doc.text(value,x+widths[index]-1,y+totalHeight-1.65,{align:"right"});x+=widths[index]})}else{doc.setFontSize(7);doc.setTextColor(...footerText);doc.text("No 30 year projection is currently saved.",10,y+8)}
  if(footer.page_number){const pageCount=doc.internal.getNumberOfPages(),exportedAt=new Date().toLocaleString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});for(let pageNumber=1;pageNumber<=pageCount;pageNumber+=1){doc.setPage(pageNumber);doc.setDrawColor(...footerLine);doc.line(7,pageHeight-14,pageWidth-7,pageHeight-14);doc.setTextColor(...footerText);doc.setFont(undefined,"normal");doc.setFontSize(Number(footer.font_size ?? 5.5));doc.text(String(footer.text||"").replace("{exported_at}",exportedAt),7,pageHeight-9);doc.text("Page "+String(pageNumber)+" of "+String(pageCount),pageWidth-7,pageHeight-9,{align:"right"})}}
  const safeName=String(customer).replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"")||"customer"
  doc.save("EPVS-Calculation-"+safeName+".pdf")
}

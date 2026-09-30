import jsPDF from "jspdf"
import { PDFDocument } from "pdf-lib"
import { supabase } from "../lib/supabase"

const CONTRACT_NAME = "Digital Solar Contract"

const rgb=(v,f=[11,93,138])=>{const h=String(v||"").replace("#","");return /^[0-9a-f]{6}$/i.test(h)?[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]:f}
const textValue=(v,f="—")=>v===undefined||v===null||v===""?f:String(v)
const num=(v,d=0)=>Number(v||0).toLocaleString("en-GB",{minimumFractionDigits:d,maximumFractionDigits:d})
const money=v=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",maximumFractionDigits:0}).format(Number(v||0))
const date=v=>{if(!v)return"—";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}

function getOpenSolarImageUrl(a){return String(a?.open_solar_image||"").trim()}

// Resolve the panel count once from all supported EPVS/OpenSolar structures.
// This same helper is used by interpolation, System Overview, EPVS and the
// itemised breakdown so the contract cannot show different panel quantities.
function getTotalPanelCount(data){
  const source=data||{}
  const toPositiveNumber=v=>{
    const n=Number(v)
    return Number.isFinite(n)&&n>0?n:0
  }

  const getCount=entry=>toPositiveNumber(
    entry?.panelCount??
    entry?.panel_count??
    entry?.numberOfPanels??
    entry?.number_of_panels??
    entry?.moduleCount??
    entry?.module_count??
    entry?.quantity??
    entry?.count??
    (typeof entry?.panels==="number"?entry.panels:undefined)
  )

  const arrays=Array.isArray(source.arrays)?source.arrays:[]
  const arrayTotal=arrays.reduce((total,array)=>total+getCount(array),0)
  if(arrayTotal>0)return arrayTotal

  const panels=Array.isArray(source.panels)?source.panels:[]
  const panelTotal=panels.reduce((total,panel)=>total+getCount(panel),0)
  if(panelTotal>0)return panelTotal

  const fallback=getCount(source)||toPositiveNumber(
    source.totalPanels??source.total_panels??source.totalPanelCount??source.total_panel_count
  )
  return fallback
}

function isPanelItem(name,type=""){
  const value=`${String(name||"")} ${String(type||"")}`.trim().toLowerCase()
  return value.includes("panel")||value.includes("solar module")||value.includes("pv module")
}

function interpolate(body,appointment,epvs){
  const data=epvs?.data||{},results=epvs?.results||{},batteryCapacity=Number(data.batteryCapacity||0)
  const values={
    customer_name:appointment?.name||data.customerName,customer_address:appointment?.address||data.address,postcode:appointment?.postcode||data.postcode,
    phone:appointment?.phone||appointment?.phone_number_1,email:appointment?.email||appointment?.email_address,appointment_date:date(appointment?.appointment_date),
    salesperson:appointment?.salesperson||appointment?.rep_allocated,open_solar_image:getOpenSolarImageUrl(appointment),
    system_size:results.systemSize?`${num(results.systemSize,2)} kWp`:"—",
    panel_type:data.panelType||data.panel_type||data.panelModel||data.panel_model||data.panelName||data.panel_name||"Panels",
    panel_count:num(getTotalPanelCount(data)),panel_wattage:data.panelWattage?`${num(data.panelWattage)} W`:"—",
    inverter_type:data.inverterType||data.inverter_type||data.inverterModel||data.inverter_model||data.inverterName||data.inverter_name||"Inverter",
    inverter_quantity:data.inverterQuantity??data.inverter_quantity??1,inverter_capacity:data.inverterCapacity?`${num(data.inverterCapacity,1)} kW`:"—",
    battery_type:data.batteryType||data.battery_type||data.batteryModel||data.battery_model||data.batteryName||data.battery_name||"Battery",
    battery_quantity:data.batteryQuantity??data.battery_quantity??1,battery_capacity:batteryCapacity>0?`${num(batteryCapacity,1)} kWh`:"Not included",
    system_cost:money(data.systemCost),annual_generation:results.generation?`${num(results.generation)} kWh`:"—",annual_saving:money(results.annualSaving)
  }
  return String(body||"").replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g,(_,k)=>textValue(values[k]))
}

async function imageData(url){
  const source=String(url||"").trim();if(!source)throw new Error("No image URL was provided.")
  let requestUrl=source;const parsed=new URL(source,window.location.origin)
  if(parsed.hostname==="api.opensolar.com"||parsed.hostname.endsWith(".opensolar.com"))requestUrl=`/api/opensolar-image?url=${encodeURIComponent(source)}`
  const response=await fetch(requestUrl);if(!response.ok)throw new Error(`Image request returned HTTP ${response.status}`)
  const blob=await response.blob(),objectUrl=URL.createObjectURL(blob)
  try{const image=new Image();image.src=objectUrl;await image.decode();const canvas=document.createElement("canvas");canvas.width=image.naturalWidth||image.width;canvas.height=image.naturalHeight||image.height;if(!canvas.width||!canvas.height)throw new Error("Image returned no dimensions.");const context=canvas.getContext("2d");if(!context)throw new Error("Unable to create image canvas.");context.drawImage(image,0,0);return{dataUrl:canvas.toDataURL("image/png"),width:canvas.width,height:canvas.height}}finally{URL.revokeObjectURL(objectUrl)}
}
async function getSignatureImageUrl(a){const path=String(a?.signature_path||"").trim();if(!path)return null;try{const{data,error}=await supabase.storage.from("signatures").createSignedUrl(path,600);if(error){console.error("Unable to create signature signed URL:",error);return null}return data?.signedUrl||null}catch(e){console.error("Unable to retrieve signature:",e);return null}}
function normaliseDatasheetName(v){return String(v||"").trim().toLowerCase().replace(/\s+/g," ")}
function getContractProductNames(appointment,epvs,pages){
  const data=epvs?.data||{},names=[];const add=v=>{const r=interpolate(String(v||""),appointment,epvs).trim();if(r&&r!=="—")names.push(r)}
  ;(Array.isArray(pages)?pages:[]).forEach(page=>{const items=Array.isArray(page?.settings?.included_items)?page.settings.included_items:[];items.forEach(item=>add(typeof item==="string"?item:item?.name))})
  ;(Array.isArray(data.inverters)?data.inverters:[]).forEach(x=>{add(x?.model);add(x?.name)})
  ;(Array.isArray(data.batteries)?data.batteries:[]).forEach(x=>{add(x?.model);add(x?.name)})
  ;(Array.isArray(data.panels)?data.panels:[]).forEach(x=>{add(x?.model);add(x?.name)})
  add(data.inverter?.model);add(data.inverter?.name);add(data.battery?.model);add(data.battery?.name);add(data.storage?.model);add(data.storage?.name)
  add(data.inverterModel||data.inverter_model||data.inverterName||data.inverter_name);add(data.batteryModel||data.battery_model||data.batteryName||data.battery_name);add(data.panelModel||data.panel_model||data.panelName||data.panel_name)
  ;(Array.isArray(data.arrays)?data.arrays:[]).forEach(a=>add(a?.panelModel||a?.panel_model||a?.panelName||a?.panel_name))
  return[...new Set(names.map(normaliseDatasheetName).filter(Boolean))]
}
function productMatchesContractItem(product,itemName){const vals=[product?.name,product?.model,[product?.manufacturer,product?.model].filter(Boolean).join(" ")].map(normaliseDatasheetName).filter(v=>v.length>=3);return vals.some(v=>v===itemName||v.includes(itemName)||itemName.includes(v))}
async function getProductDatasheetPaths(appointment,epvs,pages){const names=getContractProductNames(appointment,epvs,pages);if(!names.length)return[];const{data:products,error}=await supabase.from("products").select("name,model,manufacturer,datasheet_path,active").eq("active",true).not("datasheet_path","is",null);if(error)throw error;const out=[],seen=new Set();(products||[]).forEach(p=>{const path=String(p?.datasheet_path||"").trim();if(!path||seen.has(path))return;if(names.some(n=>productMatchesContractItem(p,n))){seen.add(path);out.push(path)}});return out}
async function appendProductDatasheets(pdf,appointment,epvs,pages){const paths=await getProductDatasheetPaths(appointment,epvs,pages),base=pdf.output("arraybuffer");if(!paths.length)return new Uint8Array(base);const merged=await PDFDocument.load(base);for(const path of paths){const{data,error}=await supabase.storage.from("product-datasheets").createSignedUrl(path,600);if(error)throw new Error("Unable to create datasheet URL for "+path+": "+(error.message||error));const url=data?.signedUrl;if(!url)throw new Error("No signed URL was returned for datasheet "+path+".");const r=await fetch(url);if(!r.ok)throw new Error("Datasheet request returned HTTP "+r.status+" for "+path+".");const src=await PDFDocument.load(await r.arrayBuffer()),pages2=await merged.copyPages(src,src.getPageIndices());pages2.forEach(p=>merged.addPage(p))}return merged.save()}

async function drawImage(pdf,url,x,y,width,maxHeight=110){const im=await imageData(url),inner=Math.max(1,width-4),ratio=im.width/im.height;let w=inner,h=w/ratio;if(h>maxHeight){h=maxHeight;w=h*ratio}const ix=x+(width-w)/2;pdf.setFillColor(245,247,249);pdf.roundedRect(x,y,width,h+4,2.5,2.5,"F");pdf.addImage(im.dataUrl,"PNG",ix,y+2,w,h,undefined,"FAST");return y+h+12}
function header(pdf,s){const width=pdf.internal.pageSize.getWidth(),height=pdf.internal.pageSize.getHeight(),accent=rgb(s.accent),text=rgb(s.text_color,[16,33,43]),padding=Number(s.padding_mm||18);pdf.setFillColor(...rgb(s.background,[255,255,255]));pdf.rect(0,0,width,height,"F");if(s.show_header!==false){pdf.setFillColor(...accent);pdf.rect(0,0,width,14,"F");pdf.setTextColor(255,255,255);pdf.setFont("helvetica","bold");pdf.setFontSize(8);pdf.text("HOMESHIELD SCOTLAND LTD",padding,9);pdf.setFont("helvetica","normal");pdf.setFontSize(7);pdf.text(CONTRACT_NAME,width-padding,9,{align:"right"})}return{width,height,accent,text,padding,y:s.show_header===false?padding:24}}
function title(pdf,page,ctx){const terms=page?.settings?.page_kind==="terms_conditions",ty=terms?ctx.y-2:ctx.y+4;pdf.setTextColor(...ctx.text);pdf.setFont("helvetica","bold");pdf.setFontSize(terms?16:22);pdf.text(page.title||"",ctx.padding,ty);if(page.subtitle){pdf.setFont("helvetica","normal");pdf.setFontSize(terms?7.5:9);pdf.setTextColor(100,112,120);pdf.text(page.subtitle,terms?ctx.width-ctx.padding:ctx.padding,terms?ty:ctx.y+11,terms?{align:"right"}:{})}pdf.setFillColor(...ctx.accent);if(terms)pdf.rect(ctx.padding,ctx.y+2,ctx.width-ctx.padding*2,1.2,"F");else pdf.rect(ctx.padding,ctx.y+15,28,1.2,"F")}
function rows(pdf,values,x,y,width,text,compact=false){const h=compact?8:10;values.forEach(([label,value],i=>{if(i%2===0){pdf.setFillColor(246,248,250);pdf.roundedRect(x,y-5.5,width,h,1.5,1.5,"F")}pdf.setTextColor(...text);pdf.setFont("helvetica","bold");pdf.setFontSize(compact?7.5:8.5);pdf.text(String(label),x+4,y);pdf.setFont("helvetica","normal");pdf.setTextColor(72,84,92);pdf.text(String(value),x+width-4,y,{align:"right"});y+=h});return y}
function body(pdf,content,x,y,width,textRgb,appointment,epvs){if(!content)return y;const c=String(content).replace(/(^|\r?\n)\s*{{open_solar_image}}\s*(?=\r?\n|$)/g,"$1");pdf.setFont("helvetica","normal");pdf.setFontSize(9);pdf.setTextColor(...textRgb);interpolate(c,appointment,epvs).split(/\r?\n/).forEach(line=>{if(!line.trim()){y+=4;return}pdf.splitTextToSize(line,width).forEach(part=>{pdf.text(part,x,y);y+=4.8});y+=2});return y}

async function drawItemisedBreakdown(pdf,page,ctx,data,results,appointment,epvs){
  const width=ctx.width-ctx.padding*2,settings=page.settings||{},configured=Array.isArray(settings.included_items)?settings.included_items:[]
  const panelCount=getTotalPanelCount(data)
  const items=configured.map(item=>{const name=typeof item==="string"?item:item?.name??"—",type=typeof item==="string"?"":item?.type??"";let quantity=typeof item==="string"?1:item?.quantity??1;if(isPanelItem(name,type))quantity=panelCount;if(String(name).trim().toLowerCase()==="roof hooks"||String(name).trim().toLowerCase()==="rail fix kit")quantity="-";if(String(name).trim().toLowerCase()==="panel installation")quantity=1;return{name,type,quantity}})
  const headerY=ctx.y+28,typeX=ctx.padding+width-43,rowHeight=7.15
  pdf.setFillColor(...ctx.accent);pdf.roundedRect(ctx.padding,headerY-7,width,11,2,2,"F");pdf.setTextColor(255,255,255);pdf.setFont("helvetica","bold");pdf.setFontSize(8);pdf.text("PRODUCT / SERVICE",ctx.padding+7,headerY);pdf.text("TYPE",typeX,headerY,{align:"center"});pdf.text("QTY",ctx.padding+width-7,headerY,{align:"right"})
  let y=headerY+9
  items.forEach((item,index)=>{const name=interpolate(String(item.name),appointment,epvs),type=interpolate(String(item.type),appointment,epvs),quantity=interpolate(String(item.quantity),appointment,epvs);if(index%2===0){pdf.setFillColor(247,249,250);pdf.roundedRect(ctx.padding,y-5.2,width,rowHeight,1.2,1.2,"F")}pdf.setTextColor(...ctx.text);pdf.setFont("helvetica","normal");pdf.setFontSize(8.1);pdf.text(name,ctx.padding+7,y);if(type){pdf.setFont("helvetica","bold");pdf.setFontSize(6.5);const tw=pdf.getTextWidth(type)+6,key=type.toLowerCase(),fill=key==="service"?[255,241,230]:key==="product"?[231,242,248]:[238,240,242],colour=key==="service"?[199,106,0]:key==="product"?[11,93,138]:[75,85,92];pdf.setFillColor(...fill);pdf.setTextColor(...colour);pdf.roundedRect(typeX-tw/2,y-3.8,tw,4.5,2,2,"F");pdf.text(type,typeX,y-.5,{align:"center"})}pdf.setTextColor(...ctx.text);pdf.setFont("helvetica","bold");pdf.setFontSize(8.1);pdf.text(quantity,ctx.padding+width-7,y,{align:"right"});y+=rowHeight})
  y+=7
  const price=results?.systemCost??data?.systemCost??appointment?.system_cost??appointment?.contract_value??appointment?.sale_value??appointment?.price,totalCardHeight=32
  pdf.setFillColor(...ctx.accent);pdf.roundedRect(ctx.padding,y,width,totalCardHeight,3,3,"F")
  const signatureUrl=await getSignatureImageUrl(appointment)
  if(signatureUrl)try{const sig=await imageData(signatureUrl),sx=ctx.padding+7,sy=y+6,sw=Math.min(65,width*.45),sh=20;pdf.setTextColor(255,255,255);pdf.setFont("helvetica","bold");pdf.setFontSize(6.5);pdf.text("CUSTOMER SIGNATURE",sx,sy);pdf.setFillColor(252,253,254);pdf.roundedRect(sx,sy+2.5,sw,sh-4,1.5,1.5,"F");const mw=sw-8,mh=sh-9,r=sig.width/sig.height;let w=mw,h=w/r;if(h>mh){h=mh;w=h*r}pdf.addImage(sig.dataUrl,"PNG",sx+(sw-w)/2,sy+3+(mh-h)/2,w,h,undefined,"FAST")}catch(e){console.error("Unable to add customer signature to contract:",e)}
  const priceX=ctx.padding+width-8;pdf.setTextColor(255,255,255);pdf.setFont("helvetica","normal");pdf.setFontSize(7);pdf.text("TOTAL SYSTEM PRICE",priceX,y+10,{align:"right"});pdf.setFont("helvetica","bold");pdf.setFontSize(18);pdf.text(money(price),priceX,y+22,{align:"right"})
}

function parseTermsSections(raw){const out=[];let cur=[];String(raw||"").replace(/\r/g,"").split("\n").forEach(line=>{const t=line.trim();if(/^\d+\.\s+/.test(t)){if(cur.length)out.push(cur.join(" ").trim());cur=[t]}else if(t)cur.push(t)});if(cur.length)out.push(cur.join(" ").trim());return out.filter(Boolean)}
function drawTermsConditions(pdf,page,ctx,appointment,epvs){const s=page.settings||{},width=ctx.width-ctx.padding*2,gap=Number(s.column_gap_mm||6),cw=(width-gap)/2,top=ctx.y+10,bottom=ctx.height-17;let fs=Number(s.font_size||6.5),lh=Number(s.line_height||3.1);const spacing=Number(s.section_spacing||2),hs=Number(s.heading_font_size||7),sections=parseTermsSections(interpolate(String(page.body||""),appointment,epvs));const make=()=>{const lines=[];sections.forEach(sec=>{const n=sec.replace(/\s+/g," ").trim(),m=n.match(/^(\d+\.\s+)(.*)$/);if(!m){pdf.setFont("helvetica","normal");pdf.setFontSize(fs);pdf.splitTextToSize(n,cw).forEach(t=>lines.push({text:t}));lines.push({spacing});return}const hm=m[2].match(/^(.+?\.)\s+(.*)$/),prefix=m[1]+(hm?hm[1]+" ":""),bt=hm?hm[2]:m[2];pdf.setFont("helvetica","bold");pdf.setFontSize(hs);const pw=pdf.getTextWidth(prefix);pdf.setFont("helvetica","normal");pdf.setFontSize(fs);if(pw<cw-10){const first=(pdf.splitTextToSize(bt,Math.max(10,cw-pw))[0]||"");lines.push({text:first,boldPrefix:prefix});const rest=bt.slice(first.length).trim();if(rest)pdf.splitTextToSize(rest,cw).forEach(t=>lines.push({text:t}))}else{lines.push({text:prefix});pdf.splitTextToSize(bt,cw).forEach(t=>lines.push({text:t}))}lines.push({spacing})});return lines};let lines=make();for(let i=0;i<12;i++){const cap=Math.floor((bottom-top)/lh)*2,req=lines.filter(x=>!x.spacing).length;if(req<=cap)break;fs=Math.max(5.15,fs*.96);lh=Math.max(2.35,lh*.96);lines=make()}let col=0,x=ctx.padding,y=top;lines.forEach(line=>{if(line.spacing){y+=line.spacing;return}if(y+lh>bottom){col++;x=ctx.padding+cw+gap;y=top}if(col>1)return;pdf.setTextColor(...ctx.text);if(line.boldPrefix){pdf.setFont("helvetica","bold");pdf.setFontSize(hs);const pw=pdf.getTextWidth(line.boldPrefix);pdf.text(line.boldPrefix,x,y);pdf.setFont("helvetica","normal");pdf.setFontSize(fs);pdf.text(line.text,x+pw,y)}else{pdf.setFont("helvetica","normal");pdf.setFontSize(fs);pdf.text(line.text,x,y)}y+=lh})}

async function renderPage(pdf,page,index,pageCount,appointment,epvs){const settings=page.settings||{},ctx=header(pdf,settings),kind=settings.page_kind||"standard",data=epvs?.data||{},results=epvs?.results||{};if(kind==="cover"){pdf.setFillColor(...rgb(settings.background,[5,47,79]));pdf.rect(0,0,ctx.width,ctx.height,"F");let logo=null;try{logo=await imageData("/homeshield-logo.png")}catch{}if(logo){const w=38;pdf.addImage(logo.dataUrl,"PNG",ctx.padding,14,w,w*logo.height/logo.width,undefined,"FAST")}pdf.setTextColor(255,255,255);pdf.setFont("helvetica","bold");pdf.setFontSize(27);pdf.text("Solar Contract",ctx.padding,76);pdf.setFont("helvetica","normal");pdf.setFontSize(11);pdf.text("Prepared for",ctx.padding,89);pdf.setFont("helvetica","bold");pdf.setFontSize(17);pdf.text(textValue(appointment?.name||data.customerName,"Customer"),ctx.padding,102);const address=[appointment?.address,appointment?.postcode].filter(Boolean).join(", ");if(address){pdf.setFont("helvetica","normal");pdf.setFontSize(8);pdf.text(address,ctx.padding,112)}return}
title(pdf,page,ctx);let y=ctx.y+28,width=ctx.width-ctx.padding*2
if(kind==="system_overview"){const image=getOpenSolarImageUrl(appointment);if(!image)throw new Error("appointments.open_solar_image is empty on this appointment.");y=await drawImage(pdf,image,ctx.padding,y,width,110);const bc=Number(data.batteryCapacity||0),pc=getTotalPanelCount(data),arrays=Array.isArray(data.arrays)?data.arrays:[],pw=arrays.map(a=>Number(a?.panelWattage||a?.panel_wattage||0)).find(v=>v>0)||Number(data.panelWattage||data.panel_wattage||0);const rowsData=[["Customer",textValue(appointment?.name)],["System size",results.systemSize?`${num(results.systemSize,2)} kWp`:"—"],["Solar panels",pc>0?`${num(pc)} × ${num(pw)} W`:"—"],["Inverter",data.inverterCapacity?`${num(data.inverterCapacity,1)} kW`:"—"],["Battery",bc>0?`${num(bc,1)} kWh`:"Not included"],["Estimated generation",results.generation?`${num(results.generation)} kWh / year`:"—"]];y=rows(pdf,rowsData,ctx.padding,y+2,width,ctx.text);body(pdf,page.body,ctx.padding,y+8,width,ctx.text,appointment,epvs)}
else if(kind==="itemised_breakdown")await drawItemisedBreakdown(pdf,page,ctx,data,results,appointment,epvs)
else if(kind==="terms_conditions")drawTermsConditions(pdf,page,ctx,appointment,epvs)
else if(kind==="accreditations"){const items=Array.isArray(settings.items)?settings.items:[];items.forEach((item,i)=>{const top=y,rx=i%2===1?ctx.padding+width:ctx.padding,align=i%2===1?"right":"left";pdf.setFillColor(246,248,250);pdf.roundedRect(ctx.padding,top,width,27,3,3,"F");pdf.setTextColor(...ctx.text);pdf.setFont("helvetica","bold");pdf.setFontSize(10);pdf.text(textValue(item.name,"Accreditation"),rx,top+9,{align});pdf.setFont("helvetica","normal");pdf.setFontSize(8);pdf.setTextColor(100,112,120);pdf.text(pdf.splitTextToSize(textValue(item.description,""),width-18),rx,top+15,{align,maxWidth:width-18});y+=35});body(pdf,page.body,ctx.padding,y+4,width,ctx.text,appointment,epvs)}
else if(kind==="epvs"){
  y=rows(pdf,[["System size",results.systemSize?`${num(results.systemSize,2)} kWp`:"—"],["Annual consumption",data.annualConsumption?`${num(data.annualConsumption)} kWh`:"—"],["Estimated generation",results.generation?`${num(results.generation)} kWh`:"—"],["Solar self-consumption",results.solarSelfConsumption?`${num(results.solarSelfConsumption)} kWh`:"—"],["Estimated export",results.exportKwh?`${num(results.exportKwh)} kWh`:"—"],["Annual saving",money(results.annualSaving)],["Simple payback",results.simplePayback?`${num(results.simplePayback,1)} years`:"—"],["30 year saving",money(results.thirtyYearSavings)],["30 year return",money(results.thirtyYearProfit)]],ctx.padding,y,width,ctx.text,true);y+=10
  const arrays=Array.isArray(data.arrays)?data.arrays.slice(0,Number(data.numberOfArrays||data.arrays.length)).map((array,index)=>({array,index,calculated:Array.isArray(results.arrays)?results.arrays[index]||{}:{}})).filter(x=>getTotalPanelCount({arrays:[x.array]})>0):[]
  if(arrays.length){const titleY=y+3;pdf.setTextColor(...ctx.text);pdf.setFont("helvetica","bold");pdf.setFontSize(9);pdf.text("SAP Calculation",ctx.padding,titleY);const headers=["Array","Panels","Panel Wp","Orientation (°)","Pitch (°)","Irradiance / Kk","SF","System size (kWp)","Generation (kWh)"],tableY=titleY+5,widths=[14,14,17,23,17,25,14,25,29],tableX=ctx.padding,hh=8,rh=7;let tx=tableX;pdf.setFont("helvetica","bold");pdf.setFontSize(5.8);headers.forEach((h,i)=>{pdf.setFillColor(...ctx.accent);pdf.rect(tx,tableY,widths[i],hh,"F");pdf.setTextColor(255,255,255);const ls=pdf.splitTextToSize(h,widths[i]-2);pdf.text(ls.slice(0,2),tx+widths[i]/2,tableY+(ls.length>1?3:5),{align:"center"});tx+=widths[i]});let rowY=tableY+hh,totalPanels=0,totalSystemSize=0,totalGeneration=0;arrays.forEach(({array,index,calculated})=>{const panelCount=getTotalPanelCount({arrays:[array]}),systemSize=Number(calculated?.systemSize||0),generation=Number(calculated?.generation||0);totalPanels+=panelCount;totalSystemSize+=Number.isFinite(systemSize)?systemSize:0;totalGeneration+=Number.isFinite(generation)?generation:0;const vals=[`Array ${index+1}`,num(panelCount),`${num(array.panelWattage||array.panel_wattage)} W`,`${num(array.orientation)}°`,`${num(array.pitch)}°`,num(array.irradiance,2),num(array.shading,2),`${num(systemSize,2)} kWp`,num(generation,2)];tx=tableX;vals.forEach((v,i)=>{pdf.setFillColor(i%2===0?247:255,i%2===0?249:255,i%2===0?250:255);pdf.setDrawColor(230,235,240);pdf.rect(tx,rowY,widths[i],rh,"FD");pdf.setTextColor(...ctx.text);pdf.setFont("helvetica",i===0?"bold":"normal");pdf.setFontSize(5.9);pdf.text(String(v),tx+widths[i]/2,rowY+4.6,{align:"center"});tx+=widths[i]});rowY+=rh});const totals=["TOTAL",num(totalPanels),"—","—","—","—","—",`${num(totalSystemSize,2)} kWp`,num(totalGeneration,2)];tx=tableX;totals.forEach((v,i)=>{pdf.setFillColor(...ctx.accent);pdf.setDrawColor(255,255,255);pdf.rect(tx,rowY,widths[i],rh,"FD");pdf.setTextColor(255,255,255);pdf.setFont("helvetica","bold");pdf.setFontSize(5.9);pdf.text(String(v),tx+widths[i]/2,rowY+4.6,{align:"center"});tx+=widths[i]});y=rowY+rh+8}
}
else if(kind==="datasheets"){const docs=Array.isArray(settings.documents)?settings.documents:[];docs.forEach(doc=>{pdf.setTextColor(...ctx.text);pdf.setFont("helvetica","bold");pdf.setFontSize(9);pdf.text(textValue(doc.title,"Datasheet"),ctx.padding,y);pdf.setFont("helvetica","normal");pdf.setFontSize(7);pdf.setTextColor(105,116,124);pdf.text(textValue(doc.description,""),ctx.padding,y+5);y+=14});body(pdf,page.body,ctx.padding,y+4,width,ctx.text,appointment,epvs)}
else body(pdf,page.body,ctx.padding,y,width,ctx.text,appointment,epvs)
}
function footer(pdf,index,count,settings,appointment){if(settings.show_footer===false)return;const width=pdf.internal.pageSize.getWidth(),height=pdf.internal.pageSize.getHeight(),padding=Number(settings.padding_mm||18);pdf.setDrawColor(...rgb(settings.accent));pdf.setLineWidth(.25);pdf.line(padding,height-13,width-padding,height-13);pdf.setTextColor(120,130,138);pdf.setFont("helvetica","normal");pdf.setFontSize(6.5);pdf.text(textValue(appointment?.name,"Customer"),padding,height-8);pdf.text(`Page ${index+1} of ${count}`,width-padding,height-8,{align:"right"})}

export async function GenerateSolarContract({appointment,epvsCalculation}){
  if(!appointment)return
  const{data:template,error:templateError}=await supabase.from("templates").select("id,name,template_type,active").eq("name",CONTRACT_NAME).eq("active",true).maybeSingle();if(templateError)throw templateError;if(!template)throw new Error(`Active ${CONTRACT_NAME} template could not be found.`)
  const{data:pages,error:pagesError}=await supabase.from("template_pages").select("id,title,subtitle,body,settings,slide_order").eq("presentation_id",template.id).order("slide_order",{ascending:true});if(pagesError)throw pagesError;if(!pages?.length)throw new Error("The Digital Solar Contract template has no pages configured.")
  let epvs=epvsCalculation||appointment?.epvs_calculation||null;if(typeof epvs==="string")try{epvs=JSON.parse(epvs)}catch{}
  const pageSize=pages.find(p=>p.settings?.page_size)?.settings?.page_size||"A4",orientation=pages.find(p=>p.settings?.orientation)?.settings?.orientation||"portrait";const pdf=new jsPDF({unit:"mm",format:pageSize.toLowerCase(),orientation})
  for(let i=0;i<pages.length;i++){if(i>0)pdf.addPage(pageSize.toLowerCase(),orientation);const page=pages[i];await renderPage(pdf,page,i,pages.length,appointment,epvs);footer(pdf,i,pages.length,page.settings||{},appointment)}
  const safeName=textValue(appointment?.name,"Customer").replace(/[^a-z0-9]+/gi,"-").replace(/^-+|-+$/g,"")||"Customer";const bytes=await appendProductDatasheets(pdf,appointment,epvs,pages),blob=new Blob([bytes],{type:"application/pdf"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=safeName+"-Digital-Solar-Contract.pdf";document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url)
}
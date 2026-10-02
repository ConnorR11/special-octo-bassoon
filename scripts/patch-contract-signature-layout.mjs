import fs from "fs"

const file = "src/contracts/GenerateSolarContract.js"
let source = fs.readFileSync(file, "utf8")

const start = source.indexOf("async function drawItemisedBreakdown(")
const end = source.indexOf("function parseTermsSections(", start)
if (start === -1 || end === -1) throw new Error("Could not locate itemised breakdown function.")

const replacement = String.raw`async function getExpressFitSignatureImageUrl(appointment) {
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

const EXPRESS_FIT_DISCLAIMER = "By signing and returning this document you are providing your agreement in writing to enable us to commence work within the cancellation period which starts when the customer signs the contract and ends 14 days after all of the goods relating to the contract are delivered to the customer's home.\n\nPlease Note: If you consent for work to begin within the cancellation period and you later exercise your right to cancel you will be liable for the cost of work performed up to the point of cancellation. You will also lose the right to cancel the contract within the cancellation period when the installation is completely finished. When this occurs the company can charge the full contract price.\n\nI/We understand that signing of this document does not affect my/our right to cancel the contract in the cancellation period which starts when I/we sign the contract and ends 14 days after all of the goods relating to the contract are delivered to my/our home.\n\nI/We hereby give express consent for Homeshield Scotland Ltd T/A Homeshield Renewables to commence work on the agreed installation date."

async function drawContractTotalAndSignature(pdf, ctx, data, results, appointment, y) {
  const width = ctx.width - ctx.padding * 2
  const price = results?.systemCost ?? data?.systemCost ?? appointment?.system_cost ?? appointment?.contract_value ?? appointment?.sale_value ?? appointment?.price
  const cardHeight = 32

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

  const priceX = ctx.padding + width - 8
  pdf.setTextColor(255, 255, 255)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(7)
  pdf.text("TOTAL SYSTEM PRICE", priceX, y + 10, { align: "right" })
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(18)
  pdf.text(money(price), priceX, y + 22, { align: "right" })

  return y + cardHeight
}

async function drawExpressFitSection(pdf, ctx, appointment, y) {
  const width = ctx.width - ctx.padding * 2
  const cardHeight = 61
  const top = y

  pdf.setFillColor(246, 248, 250)
  pdf.setDrawColor(218, 226, 232)
  pdf.setLineWidth(0.35)
  pdf.roundedRect(ctx.padding, top, width, cardHeight, 3, 3, "FD")

  pdf.setTextColor(...ctx.text)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(8)
  pdf.text("EXPRESS FIT CONSENT", ctx.padding + 7, top + 9)

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(6.2)
  pdf.setTextColor(72, 84, 92)
  let textY = top + 17
  EXPRESS_FIT_DISCLAIMER.split(/\n\n/).forEach((paragraph) => {
    const lines = pdf.splitTextToSize(paragraph, width - 14)
    pdf.text(lines, ctx.padding + 7, textY)
    textY += lines.length * 3.1 + 2.5
  })

  const signatureUrl = await getExpressFitSignatureImageUrl(appointment)
  const signatureLabelY = top + cardHeight - 25
  pdf.setTextColor(...ctx.text)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(6.5)
  pdf.text("CUSTOMER EXPRESS FIT ACCEPTANCE SIGNATURE", ctx.padding + 7, signatureLabelY)
  pdf.setFillColor(255, 255, 255)
  pdf.roundedRect(ctx.padding + 7, signatureLabelY + 2.5, 65, 18, 1.5, 1.5, "F")

  if (signatureUrl) {
    try {
      const signature = await imageData(signatureUrl)
      const sw = 65
      const sh = 18
      const mw = sw - 8
      const mh = sh - 7
      const ratio = signature.width / signature.height
      let w = mw
      let h = w / ratio
      if (h > mh) {
        h = mh
        w = h * ratio
      }
      pdf.addImage(signature.dataUrl, "PNG", ctx.padding + 7 + (sw - w) / 2, signatureLabelY + 4 + (mh - h) / 2, w, h, undefined, "FAST")
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
  const panelHardware = getPanelHardware(data)

  const items = configured.map((item) => {
    let name = typeof item === "string" ? item : item?.name ?? "—"
    const type = typeof item === "string" ? "" : item?.type ?? ""
    let quantity = typeof item === "string" ? 1 : item?.quantity ?? 1
    const normalizedName = String(name).trim().toLowerCase()

    if (normalizedName === "panels") {
      name = panelHardware?.model || name
      quantity = panelHardware?.quantity ?? getTotalPanelCount(data)
    }

    if (normalizedName === "roof hooks" || normalizedName === "rail fix kit") quantity = "-"
    if (normalizedName === "panel installation") quantity = 1

    return { name, type, quantity }
  })

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
      const tw = pdf.getTextWidth(type) + 6
      const key = type.toLowerCase()
      const fill = key === "service" ? [255, 241, 230] : key === "product" ? [231, 242, 248] : [238, 240, 242]
      const colour = key === "service" ? [199, 106, 0] : key === "product" ? [11, 93, 138] : [75, 85, 92]
      pdf.setFillColor(...fill)
      pdf.setTextColor(...colour)
      pdf.roundedRect(typeX - tw / 2, y - 3.8, tw, 4.5, 2, 2, "F")
      pdf.text(type, typeX, y - 0.5, { align: "center" })
    }

    pdf.setTextColor(...ctx.text)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(8.1)
    pdf.text(quantity, ctx.padding + width - 7, y, { align: "right" })
    y += rowHeight
  })

  y += 7
  await drawExpressFitSection(pdf, ctx, appointment, y)
}

`

source = source.slice(0, start) + replacement + source.slice(end)

const oldOverview = `    y = rows(pdf, rowsData, ctx.padding, y + 2, width, ctx.text)\n    body(pdf, page.body, ctx.padding, y + 8, width, ctx.text, appointment, epvs)\n  } else if (kind === "itemised_breakdown") {`
const newOverview = `    y = rows(pdf, rowsData, ctx.padding, y + 2, width, ctx.text)\n    y = body(pdf, page.body, ctx.padding, y + 8, width, ctx.text, appointment, epvs) + 6\n    await drawContractTotalAndSignature(pdf, ctx, data, results, appointment, y)\n  } else if (kind === "itemised_breakdown") {`
if (!source.includes(oldOverview)) throw new Error("Could not locate system overview block.")
source = source.replace(oldOverview, newOverview)

fs.writeFileSync(file, source)
console.log("Moved contract total/signature to system overview and Express Fit section to itemised breakdown.")

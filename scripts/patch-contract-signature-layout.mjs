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

const EXPRESS_FIT_DISCLAIMER = "By signing and returning this document you are providing your agreement in writing to enable us to commence work within the cancellation period which starts when the customer signs the contract and ends 14 days after all of the goods relating to the contract are delivered to the customer's home.\\n\\nPlease Note: If you consent for work to begin within the cancellation period and you later exercise your right to cancel you will be liable for the cost of work performed up to the point of cancellation. You will also lose the right to cancel the contract within the cancellation period when the installation is completely finished. When this occurs the company can charge the full contract price.\\n\\nI/We understand that signing of this document does not affect my/our right to cancel the contract in the cancellation period which starts when I/we sign the contract and ends 14 days after all of the goods relating to the contract are delivered to my/our home.\\n\\nI/We hereby give express consent for Homeshield Scotland Ltd T/A Homeshield Renewables to commence work on the agreed installation date."

async function drawContractTotalAndSignature(pdf, ctx, data, results, appointment, y) {
  const width = ctx.width - ctx.padding * 2
  const price = results?.systemCost ?? data?.systemCost ?? appointment?.system_cost ?? appointment?.contract_value ?? appointment?.sale_value ?? appointment?.price
  const cardHeight = 38

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
  const labelX = priceX - 36
  const systemCost = Number(price || 0)
  const deposit = Number(data?.deposit || appointment?.deposit || 0)
  const adminFee = 399
  const totalCost = systemCost + adminFee

  const paymentRows = [
    ["System cost", systemCost],
    ["Deposit", deposit],
    ["Admin Fee", adminFee],
    ["Total Cost", totalCost],
  ]

  let paymentY = y + 9
  paymentRows.forEach(([label, value], index) => {
    const isTotal = index === paymentRows.length - 1

    pdf.setTextColor(255, 255, 255)
    pdf.setFont("helvetica", isTotal ? "bold" : "normal")
    pdf.setFontSize(isTotal ? 7.2 : 6.5)
    pdf.text(label, labelX, paymentY, { align: "right" })

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(isTotal ? 9.5 : 7.5)
    pdf.text(money(value), priceX, paymentY, { align: "right" })

    paymentY += isTotal ? 7 : 6
  })
  return y + cardHeight
}

async function drawExpressFitSection(pdf, ctx, appointment, y) {
  const width = ctx.width - ctx.padding * 2
  const footerY = pdf.internal.pageSize.getHeight() - 13
  const footerGap = 4
  const side = 6
  const availableHeight = Math.max(28, footerY - footerGap - (y + 3))

  // Keep the disclaimer on the same page as the itemised table. The section is
  // deliberately compact so it can fit into the remaining space without ever
  // moving upwards over the final product rows.
  const signatureBoxWidth = Math.min(52, width * 0.28)
  const signatureBoxHeight = Math.min(14, Math.max(11, availableHeight * 0.27))
  const signatureColumnWidth = signatureBoxWidth + 4
  const textWidth = Math.max(90, width - side * 2 - signatureColumnWidth - 5)
  const lineHeight = Math.max(2.45, Math.min(2.8, availableHeight / 22))
  const paragraphGap = Math.max(0.8, Math.min(1.5, availableHeight / 42))
  const titleHeight = 7

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(5.35)
  const paragraphs = EXPRESS_FIT_DISCLAIMER.split(/\\n\\n/)
  const paragraphLines = paragraphs.map((paragraph) => pdf.splitTextToSize(paragraph, textWidth))
  const textHeight = paragraphLines.reduce((total, lines) => total + lines.length * lineHeight + paragraphGap, 0)

  // Size to the space actually available. Never position the card above `y`.
  const naturalHeight = titleHeight + textHeight + 5
  const cardHeight = Math.min(availableHeight, Math.max(27, naturalHeight))
  const top = y + 3

  pdf.setFillColor(246, 248, 250)
  pdf.setDrawColor(218, 226, 232)
  pdf.setLineWidth(0.35)
  pdf.roundedRect(ctx.padding, top, width, cardHeight, 3, 3, "FD")

  pdf.setTextColor(...ctx.text)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(7)
  pdf.text("EXPRESS FIT CONSENT", ctx.padding + side, top + 7)

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(5.35)
  pdf.setTextColor(72, 84, 92)
  let textY = top + 13
  const maxTextY = top + cardHeight - 4
  paragraphLines.forEach((lines, paragraphIndex) => {
    const visibleLines = Math.max(1, Math.floor((maxTextY - textY) / lineHeight))
    const clippedLines = lines.slice(0, visibleLines)
    if (clippedLines.length) {
      pdf.text(clippedLines, ctx.padding + side, textY)
      textY += clippedLines.length * lineHeight + paragraphGap
    }
    if (paragraphIndex === paragraphLines.length - 1) return
  })

  // Signature occupies its own column on the right and is anchored to the
  // bottom of the card, so the disclaimer text can never run underneath it.
  const signatureX = ctx.padding + width - signatureBoxWidth - side
  const signatureLabelY = top + cardHeight - signatureBoxHeight - 7
  pdf.setTextColor(...ctx.text)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(5.5)
  const labelLines = pdf.splitTextToSize("CUSTOMER EXPRESS FIT ACCEPTANCE SIGNATURE", signatureBoxWidth)
  pdf.text(labelLines, signatureX, signatureLabelY - Math.max(0, (labelLines.length - 1) * 2.1))

  pdf.setFillColor(255, 255, 255)
  pdf.roundedRect(signatureX, signatureLabelY + 1.5, signatureBoxWidth, signatureBoxHeight, 1.3, 1.3, "F")

  const signatureUrl = await getExpressFitSignatureImageUrl(appointment)
  if (signatureUrl) {
    try {
      const signature = await imageData(signatureUrl)
      const mw = signatureBoxWidth - 6
      const mh = signatureBoxHeight - 4
      const ratio = signature.width / signature.height
      let w = mw
      let h = w / ratio
      if (h > mh) {
        h = mh
        w = h * ratio
      }
      pdf.addImage(signature.dataUrl, "PNG", signatureX + (signatureBoxWidth - w) / 2, signatureLabelY + 2 + (mh - h) / 2, w, h, undefined, "FAST")
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
  const rowHeight = 6.8
  pdf.setFillColor(...ctx.accent)
  pdf.roundedRect(ctx.padding, headerY - 7, width, 11, 2, 2, "F")
  pdf.setTextColor(255, 255, 255)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(8)
  pdf.text("PRODUCT / SERVICE", ctx.padding + 7, headerY)
  pdf.text("TYPE", typeX, headerY, { align: "center" })
  pdf.text("QTY", ctx.padding + width - 7, headerY, { align: "right" })

  let y = headerY + 8.3
  items.forEach((item, index) => {
    const name = interpolate(String(item.name), appointment, epvs)
    const type = interpolate(String(item.type), appointment, epvs)
    const quantity = interpolate(String(item.quantity), appointment, epvs)
    if (index % 2 === 0) {
      pdf.setFillColor(247, 249, 250)
      pdf.roundedRect(ctx.padding, y - 5.0, width, rowHeight, 1.2, 1.2, "F")
    }
    pdf.setTextColor(...ctx.text)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    pdf.text(name, ctx.padding + 7, y)
    if (type) {
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(6.2)
      const tw = pdf.getTextWidth(type) + 6
      const key = type.toLowerCase()
      const fill = key === "service" ? [255, 241, 230] : key === "product" ? [231, 242, 248] : [238, 240, 242]
      const colour = key === "service" ? [199, 106, 0] : key === "product" ? [11, 93, 138] : [75, 85, 92]
      pdf.setFillColor(...fill)
      pdf.setTextColor(...colour)
      pdf.roundedRect(typeX - tw / 2, y - 3.6, tw, 4.2, 2, 2, "F")
      pdf.text(type, typeX, y - 0.45, { align: "center" })
    }
    pdf.setTextColor(...ctx.text)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(8)
    pdf.text(quantity, ctx.padding + width - 7, y, { align: "right" })
    y += rowHeight
  })
  y += 3
  await drawExpressFitSection(pdf, ctx, appointment, y)
}

`

source = source.slice(0, start) + replacement + source.slice(end)

const overviewPattern = /    y = rows\(pdf, rowsData, ctx\.padding, y \+ 2, width, ctx\.text(?:, appointment, epvs)?\)\n    body\(pdf, page\.body, ctx\.padding, y \+ 8, width, ctx\.text(?:, appointment, epvs)?\)\n  \} else if \(kind === "itemised_breakdown"\) \{/m

if (!overviewPattern.test(source)) {
  console.warn("Could not locate system overview block; leaving overview unchanged.")
} else {
  source = source.replace(overviewPattern, (match) => {
    const bodyCall = match.includes("body(pdf, page.body, ctx.padding, y + 8, width, ctx.text, appointment, epvs)")
      ? "    y = body(pdf, page.body, ctx.padding, y + 8, width, ctx.text, appointment, epvs) + 6"
      : "    y = body(pdf, page.body, ctx.padding, y + 8, width, ctx.text) + 6"
    return match.replace(/    body\(pdf, page\.body[^\n]+/, bodyCall).replace(
      "  } else if (kind === \"itemised_breakdown\") {",
      "    const signatureCardHeight = 38\n    const footerClearance = 7\n    const footerY = pdf.internal.pageSize.getHeight() - 13\n    const signatureCardY = footerY - footerClearance - signatureCardHeight\n    await drawContractTotalAndSignature(pdf, ctx, data, results, appointment, signatureCardY)\n  } else if (kind === \"itemised_breakdown\") {"
    )
  })
}

fs.writeFileSync(file, source)
console.log("Moved contract total/signature to system overview and fitted Express Fit consent into the remaining itemised-breakdown space.")

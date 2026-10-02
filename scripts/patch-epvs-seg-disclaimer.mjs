import fs from "node:fs"
import path from "node:path"

const filePath = path.resolve("src/contracts/GenerateSolarContract.js")
let source = fs.readFileSync(filePath, "utf8")

if (source.includes("function drawSegDisclaimer")) {
  console.log("SEG disclaimer patch already present")
  process.exit(0)
}

const helper = String.raw`

async function drawSegDisclaimer(pdf, ctx, appointment) {
  const disclaimer = "The savings calculations include Smart Export Guarantee (SEG) payments which you receive for any export of energy to the grid, subject to the utility company criteria and requirements. We strongly recommend that all customers carry out their own research into SEG payments and tariffs available as these vary from supplier to supplier. Not registering for SEG will mean you do not receive the export payments detailed in the proposal.\\n\\nSEG tariffs are likely to change regularly and may go up or down. You may have to change suppliers and you should also check that the rate you buy your electricity at, does not outweigh the benefits of changing. The figures should be considered as an illustration and will differ, up or down, during the lifetime of your solar system."
  const width = ctx.width - ctx.padding * 2
  const boxX = ctx.padding
  const boxY = ctx.height - 67
  const boxH = 61

  pdf.setFillColor(247, 249, 250)
  pdf.setDrawColor(220, 226, 230)
  pdf.roundedRect(boxX, boxY, width, boxH, 2.5, 2.5, "FD")

  pdf.setTextColor(...ctx.text)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(7.2)
  pdf.text("SEG DISCLAIMER", boxX + 5, boxY + 7)

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(5.35)
  pdf.setTextColor(65, 76, 84)
  const lines = disclaimer.split("\\n").flatMap((paragraph) => {
    if (!paragraph.trim()) return [""]
    return pdf.splitTextToSize(paragraph, width - 10)
  })
  let textY = boxY + 12
  lines.forEach((line) => {
    if (!line) {
      textY += 2.1
      return
    }
    pdf.text(line, boxX + 5, textY)
    textY += 2.65
  })

  const path = String(appointment?.seg_disclaimer_signature_path || "").trim()
  if (!path) return

  try {
    const { data, error } = await supabase.storage.from("signatures").createSignedUrl(path, 600)
    if (error || !data?.signedUrl) return
    const signature = await imageData(data.signedUrl)
    const signatureBoxX = boxX + 5
    const signatureBoxY = boxY + boxH - 17
    const signatureBoxW = 52
    const signatureBoxH = 12

    pdf.setTextColor(...ctx.text)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(5.8)
    pdf.text("CUSTOMER SEG ACCEPTANCE SIGNATURE", signatureBoxX, signatureBoxY - 2)
    pdf.setFillColor(255, 255, 255)
    pdf.roundedRect(signatureBoxX, signatureBoxY, signatureBoxW, signatureBoxH, 1.5, 1.5, "F")

    const maxW = signatureBoxW - 6
    const maxH = signatureBoxH - 3
    const ratio = signature.width / signature.height
    let w = maxW
    let h = w / ratio
    if (h > maxH) {
      h = maxH
      w = h * ratio
    }
    pdf.addImage(signature.dataUrl, "PNG", signatureBoxX + (signatureBoxW - w) / 2, signatureBoxY + (signatureBoxH - h) / 2, w, h, undefined, "FAST")
  } catch (error) {
    console.error("Unable to add SEG disclaimer signature to contract:", error)
  }
}
`

const renderMarker = "async function renderPage(pdf, page, index, pageCount, appointment, epvs) {"
if (!source.includes(renderMarker)) throw new Error("Could not locate renderPage in GenerateSolarContract.js")
source = source.replace(renderMarker, helper + "\n" + renderMarker)

const pageMarker = `  if (pageTitle === "epvs calculations cont." || kind === "epvs_cont" || kind === "epvs_continuation") {\n    drawThirtyYearBreakdown(pdf, page, ctx, epvs)\n    return\n  }`
if (!source.includes(pageMarker)) throw new Error("Could not locate EPVS continuation render block")

const replacement = `${pageMarker.replace("    return\\n", "    return\\n")}\n  if (pageTitle === "epvs calculations cont." || kind === "epvs_cont" || kind === "epvs_continuation") {\n    await drawSegDisclaimer(pdf, ctx, appointment)\n  }`
source = source.replace(pageMarker, replacement)

fs.writeFileSync(filePath, source)
console.log("Patched EPVS Calculations Cont. with SEG disclaimer and customer signature")

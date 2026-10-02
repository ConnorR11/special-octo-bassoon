import fs from "node:fs"
import path from "node:path"

const filePath = path.resolve("src/contracts/GenerateSolarContract.js")
let source = fs.readFileSync(filePath, "utf8")

const marker = "Why have we shown savings based on varying rates on inflation?"
if (source.includes(marker)) {
  console.log("EPVS inflation explanation already present")
  process.exit(0)
}

const block = String.raw`      // EPVS inflation explanation: render immediately below the completed SAP table.
      const inflationCardY = y + 4
      const inflationCardH = 39
      pdf.setFillColor(241, 245, 248)
      pdf.setDrawColor(241, 245, 248)
      pdf.setLineWidth(0.2)
      pdf.rect(ctx.padding, inflationCardY, width, inflationCardH, "FD")

      const inflationX = ctx.padding + 7
      const inflationTextWidth = width - 14
      pdf.setTextColor(...ctx.text)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(8.2)
      pdf.text("Why have we shown savings based on varying rates on inflation?", inflationX, inflationCardY + 9)

      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(7.2)
      pdf.setTextColor(70, 82, 92)
      const inflationExplanation = "The current fuel inflation figure of 7.6% is based on data from the Office for National Statistics, covering the period 2015–2024. You can find more information at www.ons.gov.uk. The reason we have shown savings based on varying levels of inflation is because electricity inflation has fluctuated significantly over the past 20 years - including negative CPI values in 2006, 2015, and 2016 (-2.5%, -0.2%, -0.3%), and spikes like 21.7% in 2016. To avoid relying on one-off years, we use a long-term average to provide a more balanced view."
      const inflationLines = pdf.splitTextToSize(inflationExplanation, inflationTextWidth)
      pdf.text(inflationLines, inflationX, inflationCardY + 17)

      y = inflationCardY + inflationCardH + 4`

// The SAP renderer ends with the TOTAL row followed by this y-position update.
// Insert immediately after that update so the card can never overlap the table.
const completedTableMarker = /([ \t]*y = rowY \+ rowHeight \+ 8)/
const match = source.match(completedTableMarker)

if (match && typeof match.index === "number") {
  const insertAt = match.index + match[0].length
  source = source.slice(0, insertAt) + "\n" + block + source.slice(insertAt)
  fs.writeFileSync(filePath, source)
  console.log("Added EPVS inflation explanation below completed SAP table")
  process.exit(0)
}

// Fallback: locate the closing totals loop and place the card after it.
const totalsStart = source.indexOf('const totals = ["TOTAL"')
if (totalsStart >= 0) {
  const totalsLoopEnd = source.indexOf("      y = rowY + rowHeight", totalsStart)
  if (totalsLoopEnd >= 0) {
    const endLine = source.indexOf("\n", totalsLoopEnd)
    const insertAt = endLine >= 0 ? endLine : source.length
    source = source.slice(0, insertAt) + "\n" + block + source.slice(insertAt)
    fs.writeFileSync(filePath, source)
    console.log("Added EPVS inflation explanation using SAP totals fallback")
    process.exit(0)
  }
}

console.warn("EPVS SAP table marker not found; inflation explanation patch skipped")
process.exit(0)

import fs from "node:fs"
import path from "node:path"

const filePath = path.resolve("src/contracts/GenerateSolarContract.js")
let source = fs.readFileSync(filePath, "utf8")

// Remove any previous inflation card inserted by an earlier version of this
// patch. We deliberately use the comment marker rather than depending on the
// surrounding EPVS implementation.
const marker = "// EPVS inflation explanation:"
const start = source.indexOf(marker)
if (start >= 0) {
  const endMarker = "y = inflationCardY + inflationCardH + 4"
  const end = source.indexOf(endMarker, start)
  if (end >= 0) {
    source = source.slice(0, start) + source.slice(end + endMarker.length)
  } else {
    // Older versions did not update y after drawing the card. Remove through
    // the next known branch boundary if necessary.
    const branchEnd = source.indexOf('  } else if (kind === "datasheets") {', start)
    if (branchEnd >= 0) source = source.slice(0, start) + source.slice(branchEnd)
  }
}

const block = String.raw`

    // EPVS inflation explanation: immediately below the completed SAP table.
    const inflationCardY = rowY + rowHeight + 4
    const inflationCardH = 39
    pdf.setFillColor(241, 245, 248)
    pdf.setDrawColor(220, 228, 234)
    pdf.setLineWidth(0.35)
    pdf.roundedRect(ctx.padding, inflationCardY, width, inflationCardH, 2.5, 2.5, "FD")

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
    y = inflationCardY + inflationCardH + 4
`

// patch-epvs-30-year-layout.mjs creates the SAP table and finishes it with
// this stable statement. Insert the disclaimer directly after it, so it can
// never be placed inside or above the table.
const tableEnd = "    y = rowY + rowHeight + 4"
const tableEndIndex = source.indexOf(tableEnd)

if (tableEndIndex < 0) {
  throw new Error("Could not locate the completed EPVS SAP table")
}

source = source.slice(0, tableEndIndex + tableEnd.length) + block + source.slice(tableEndIndex + tableEnd.length)

fs.writeFileSync(filePath, source)
console.log("Added EPVS inflation explanation directly below the completed SAP calculation table")

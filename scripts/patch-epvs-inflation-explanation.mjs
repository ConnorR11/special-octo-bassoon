import fs from "node:fs"
import path from "node:path"

const filePath = path.resolve("src/contracts/GenerateSolarContract.js")
let source = fs.readFileSync(filePath, "utf8")

// Remove any previous version of the card so this patch can safely relocate it.
const existingStart = source.indexOf("// EPVS inflation explanation:")
if (existingStart >= 0) {
  const existingEndMarker = "y = inflationCardY + inflationCardH + 4"
  const existingEnd = source.indexOf(existingEndMarker, existingStart)
  if (existingEnd >= 0) {
    source = source.slice(0, existingStart) + source.slice(existingEnd + existingEndMarker.length)
  }
}

const block = String.raw`\n
      // EPVS inflation explanation: render directly below the completed SAP table.
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
`

// The SAP table has a stable TOTAL-row definition even when the surrounding
// layout patches change. Insert immediately after the totals drawing loop.
const totalsMarker = 'const totals = ["TOTAL", num(totalPanels)'
const totalsStart = source.indexOf(totalsMarker)
if (totalsStart < 0) {
  console.warn("EPVS SAP totals marker not found; inflation explanation patch skipped")
  process.exit(0)
}

const loopMarker = "totals.forEach((value, index) => {"
const loopStart = source.indexOf(loopMarker, totalsStart)
if (loopStart < 0) {
  console.warn("EPVS SAP totals loop not found; inflation explanation patch skipped")
  process.exit(0)
}

// Find the matching closing brace for the totals arrow-function. This avoids
// depending on whitespace or exact lines introduced by other patch scripts.
const bodyStart = loopStart + loopMarker.length
let depth = 1
let quote = null
let escaped = false
let template = false
let end = -1

for (let i = bodyStart; i < source.length; i += 1) {
  const ch = source[i]

  if (quote) {
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === "\\") {
      escaped = true
      continue
    }
    if (ch === quote) quote = null
    continue
  }

  if (template) {
    if (ch === "\\") {
      i += 1
      continue
    }
    if (ch === "`") template = false
    continue
  }

  if (ch === "\"") {
    quote = "\""
    continue
  }
  if (ch === "'") {
    quote = "'"
    continue
  }
  if (ch === "`") {
    template = true
    continue
  }

  if (ch === "{") depth += 1
  if (ch === "}") {
    depth -= 1
    if (depth === 0) {
      end = i + 1
      break
    }
  }
}

if (end < 0) {
  console.warn("Could not determine the end of the EPVS SAP totals loop; inflation explanation patch skipped")
  process.exit(0)
}

const closeParen = source.indexOf(")", end)
const insertAt = closeParen >= 0 && closeParen - end < 8 ? closeParen + 1 : end
source = source.slice(0, insertAt) + block + source.slice(insertAt)

fs.writeFileSync(filePath, source)
console.log("Added EPVS inflation explanation directly below the SAP calculation table")

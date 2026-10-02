import fs from "node:fs"
import path from "node:path"

const filePath = path.resolve("src/contracts/GenerateSolarContract.js")
let source = fs.readFileSync(filePath, "utf8")

if (source.includes("Why have we shown savings based on varying rates on inflation?")) {
  console.log("EPVS inflation explanation already present")
  process.exit(0)
}

const block = String.raw`      // Inflation explanation shown directly below the completed SAP array table.
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

const totalsStart = source.indexOf('const totals = ["TOTAL"')
if (totalsStart >= 0) {
  const afterTotals = source.indexOf("      y = rowY + rowHeight + 8", totalsStart)
  if (afterTotals >= 0) {
    source = source.slice(0, afterTotals) + block + source.slice(afterTotals + "      y = rowY + rowHeight + 8".length)
    fs.writeFileSync(filePath, source)
    console.log("Added inflation explanation card below EPVS SAP table")
    process.exit(0)
  }
}

const totalsPattern = /(const totals = \["TOTAL"[\s\S]*?totals\.forEach\(\(value, index\) => \{[\s\S]*?\n      \}\)\n)(\s*)(\n\s*\}\n\s*\} else if \(kind === "datasheets"\))/
const match = source.match(totalsPattern)
if (match) {
  const replacement = `${match[1]}\n${block}${match[3]}`
  source = source.replace(totalsPattern, replacement)
  fs.writeFileSync(filePath, source)
  console.log("Added inflation explanation card below EPVS SAP totals using resilient fallback")
  process.exit(0)
}

console.warn("EPVS SAP table changed; inflation explanation patch skipped rather than failing the build")
process.exit(0)

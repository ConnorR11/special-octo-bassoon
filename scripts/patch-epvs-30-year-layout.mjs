import fs from "node:fs"
import path from "node:path"

const filePath = path.resolve("src/contracts/GenerateSolarContract.js")
let source = fs.readFileSync(filePath, "utf8")

// Keep the page title/subtitle/underline clear, then place the 30-year
// descriptor immediately above the table header without overlapping it.
source = source.replace(
  'pdf.text("30 Year Breakdown – 7.6% Inflation Rate", tableX, ctx.y + 17)',
  'pdf.text("30 Year Breakdown – 7.6% Inflation Rate", tableX, ctx.y + 21.5)'
)
source = source.replace(
  'const headerY = ctx.y + 25',
  'const headerY = ctx.y + 28'
)

// Remove the white gap between the blue table header and the first data row.
// The rounded header ends at headerY + 4.5, so the first row starts there.
source = source.replace(
  'let y = headerY + headerHeight',
  'let y = headerY + 4.5'
)

fs.writeFileSync(filePath, source)
console.log("EPVS 30-year table heading layout adjusted")

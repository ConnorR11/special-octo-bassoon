import fs from "node:fs"
import path from "node:path"

const filePath = path.resolve("src/contracts/GenerateSolarContract.js")
let source = fs.readFileSync(filePath, "utf8")

// Remove the three legacy rows from the EPVS summary table.
// Match by label rather than the entire expression so formatting changes do
// not prevent the patch from applying.
const labels = ["Simple payback", "30 year saving", "30 year return"]

source = source
  .split("\n")
  .filter((line) => !labels.some((label) => line.includes(`[\"${label}\"`)))
  .join("\n")

// Also remove a matching row if a formatter has put several entries on one line.
for (const label of labels) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  source = source.replace(
    new RegExp(`\\s*\\[\\\"${escaped}\\\"[^\\n\\]]*\\]\\s*,?`, "g"),
    "\n"
  )
}

// Keep the 30-year table dimensions and row heights unchanged while making
// the figures more readable.
source = source.replace(/pdf\.setFontSize\(4\.8\)/g, "pdf.setFontSize(6)")

if (!source.includes("function drawThirtyYearBreakdown")) {
  throw new Error("The 30-year breakdown helper is missing from GenerateSolarContract.js")
}

fs.writeFileSync(filePath, source)
console.log("EPVS top-table rows removed and 30-year values set to 6pt")

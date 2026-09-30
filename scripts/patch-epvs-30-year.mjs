import fs from "node:fs"
import path from "node:path"

const filePath = path.resolve("src/contracts/GenerateSolarContract.js")
let source = fs.readFileSync(filePath, "utf8")

// Remove the three legacy rows from the EPVS summary table.
// Do this by label rather than matching the entire expression, because the
// generated source has changed formatting between revisions.
const labels = ["Simple payback", "30 year saving", "30 year return"]

source = source
  .split("\n")
  .filter((line) => !labels.some((label) => line.includes(`[\"${label}\"`)))
  .join("\n")

// Also remove the rows if a formatter has placed multiple entries on one line.
for (const label of labels) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  source = source.replace(
    new RegExp(`\\s*\\[\\\"${escaped}\\\"[^\\n\\]]*\\]\\s*,?`, "g"),
    "\n"
  )
}

// Keep the existing 30-year table dimensions and row heights, but use the
// larger 6pt figure text requested for the continuation table.
source = source.replace(/pdf\\.setFontSize\\(4\\.8\\)/g, "pdf.setFontSize(6)")

if (!source.includes("function drawThirtyYearBreakdown")) {
  throw new Error("The 30-year breakdown helper is missing from GenerateSolarContract.js")
}

fs.writeFileSync(filePath, source)
console.log("EPVS top-table rows removed and 30-year values set to 6pt")

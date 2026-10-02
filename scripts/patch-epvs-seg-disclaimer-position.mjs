import fs from "node:fs"
import path from "node:path"

const filePath = path.resolve("src/contracts/GenerateSolarContract.js")
let source = fs.readFileSync(filePath, "utf8")

const oldBlock = `  // Keep the card clearly separated from the footer while moving it slightly\n  // higher on the page. The larger card also gives the disclaimer more room.\n  const boxY = ctx.height - 91\n  const boxH = 69`

const newBlock = `  // Position the card from the actual bottom of the 30-year table rather than\n  // from a fixed page coordinate. This prevents the disclaimer from ever\n  // overlapping the table while preserving a small gap above and below it.\n  const headerY = ctx.y + 28\n  const tableRowHeight = 4.85\n  const tableTotalHeight = 5.8\n  const tableRows = 30\n  const tableBottom = headerY + 4.5 + (tableRows * tableRowHeight) + tableTotalHeight\n  const gapAbove = 5\n  const gapBelow = 5\n  const footerClearance = 13\n  const boxY = tableBottom + gapAbove\n  const availableHeight = ctx.height - footerClearance - gapBelow - boxY\n  const boxH = Math.min(69, Math.max(55, availableHeight))`

if (!source.includes(oldBlock)) {
  throw new Error("Could not locate the existing SEG disclaimer position block")
}

source = source.replace(oldBlock, newBlock)
fs.writeFileSync(filePath, source)
console.log("Positioned SEG disclaimer card dynamically between EPVS table and footer")

import fs from "fs"

const file = "src/contracts/GenerateSolarContract.js"
let source = fs.readFileSync(file, "utf8")

if (source.includes("function drawEpvsContractSummary(pdf, ctx, data, results, startY) {")) {
  source = source.replace(
    'const headerHeight = options.headerHeight || 7\n    const rowHeight = options.rowHeight || 6.1',
    'const headerHeight = options.headerHeight || 6.5\n    const rowHeight = options.rowHeight || 5.4'
  )

  source = source.replace(
    '  leftY += 8\n  leftY = drawSection(leftX, leftY, "SYSTEM COSTS/REPAYMENTS"',
    '  leftY += 5\n  leftY = drawSection(leftX, leftY, "SYSTEM COSTS/REPAYMENTS"'
  )

  source = source.replace(
    '  rightY += 8\n  rightY = drawSection(rightX, rightY, "ENERGY USAGE & CURRENT RATES"',
    '  rightY += 5\n  rightY = drawSection(rightX, rightY, "ENERGY USAGE & CURRENT RATES"'
  )

  source = source.replace(
    '  rightY += 8\n  rightY = drawSection(rightX, rightY, "NEW FLUX RATES"',
    '  rightY += 5\n  rightY = drawSection(rightX, rightY, "NEW FLUX RATES"'
  )

  // Give the Energy Usage & Current Rates table slightly more vertical room so
  // the longer second-row label remains clear and readable in the PDF.
  source = source.replace(
    '  ], { subHeaders: ["SINGLE/DAY", "NIGHT"] })',
    '  ], { subHeaders: ["SINGLE/DAY", "NIGHT"], rowHeight: 6.1 })'
  )

  // Reduce the gap between the inflation disclaimer and the first summary tables.
  source = source.replace(
    'drawEpvsContractSummary(pdf, ctx, data, results, y + 8)',
    'drawEpvsContractSummary(pdf, ctx, data, results, y + 3)'
  )
}

fs.writeFileSync(file, source)
console.log("EPVS contract summary layout patch applied.")

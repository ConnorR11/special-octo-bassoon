import fs from "node:fs"
import path from "node:path"

const filePath = path.resolve("src/contracts/GenerateSolarContract.js")
let source = fs.readFileSync(filePath, "utf8")

// Remove the three legacy summary rows from the EPVS summary table.
// Match by label rather than the full expression so formatting changes do not
// stop the build patch from removing them.
const labels = ["Simple payback", "30 year saving", "30 year return"]

source = source
  .split("\n")
  .filter((line) => !labels.some((label) => line.includes(`[\"${label}\"`)))
  .join("\n")

// Also handle a formatter that has placed several entries on one line.
for (const label of labels) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  source = source.replace(
    new RegExp(`\\s*\\[\\\"${escaped}\\\"[^\\n\\]]*\\]\\s*,?`, "g"),
    "\n"
  )
}

// Keep the existing 30-year table dimensions and row heights, but make the
// figures more readable.
source = source.replace(/pdf\.setFontSize\(4\.8\)/g, "pdf.setFontSize(6)")

if (source.includes("function drawThirtyYearBreakdown")) {
  fs.writeFileSync(filePath, source)
  console.log("EPVS 30-year layout patch applied")
  process.exit(0)
}

const helper = String.raw`
function drawThirtyYearBreakdown(pdf, page, ctx, epvs) {
  const projection = epvs?.thirtyYearProjection || {}
  const scenario = projection?.scenarios?.averageInflation
  const rows = Array.isArray(scenario?.rows)
    ? scenario.rows
    : Array.isArray(scenario)
      ? scenario
      : []

  const width = ctx.width - ctx.padding * 2
  const tableWidth = Math.min(width, 168)
  const tableX = ctx.padding + (width - tableWidth) / 2
  const headerY = ctx.y + 25
  const headerHeight = 9
  const rowHeight = 4.85
  const totalHeight = 5.8
  const widths = [8, 15, 15, 15, 15, 16, 16, 17, 17, 17, 17]
  const headers = [
    "YR",
    "GENERATION",
    "SOLAR",
    "BATTERY",
    "EXPORT",
    "ANNUAL BENEFIT",
    "YEARLY PAYMENTS",
    "NET ANNUAL",
    "NET POSITION",
    "BILL PRE INSTALL",
    "BILL POST INSTALL"
  ]

  const valueFrom = (row, ...keys) => {
    for (const key of keys) {
      const direct = Number(row?.[key])
      if (Number.isFinite(direct) && direct !== 0) return direct
      const model = Number(row?.model?.[key])
      if (Number.isFinite(model) && model !== 0) return model
    }
    return 0
  }

  const solarValue = (row) => valueFrom(row, "solarBenefit", "solar")
  const batteryValue = (row) =>
    valueFrom(row, "batteryBenefit", "battery") ||
    valueFrom(row, "batterySelfConsumptionBenefit") +
      valueFrom(row, "forceChargeBenefit")
  const exportValue = (row) => valueFrom(row, "exportBenefit")
  const annualBenefit = (row) => solarValue(row) + batteryValue(row) + exportValue(row)

  pdf.setTextColor(...ctx.text)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(9)
  pdf.text("30 Year Benefit Breakdown", tableX, ctx.y + 8)

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(6.5)
  pdf.setTextColor(100, 112, 120)
  pdf.text("Average inflation scenario (7.6%)", tableX, ctx.y + 14)

  let x = tableX
  pdf.setFillColor(...ctx.accent)
  pdf.roundedRect(tableX, headerY - 5.5, tableWidth, headerHeight, 1.8, 1.8, "F")
  pdf.setTextColor(255, 255, 255)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(4.7)

  headers.forEach((header, index) => {
    const lines = String(header).split(" ")
    const midpoint = Math.ceil(lines.length / 2)
    const firstLine = lines.length > 1 ? lines.slice(0, midpoint).join(" ") : lines[0]
    const secondLine = lines.length > 1 ? lines.slice(midpoint).join(" ") : ""
    if (secondLine) {
      pdf.text(firstLine, x + widths[index] / 2, headerY - 1.7, { align: "center" })
      pdf.text(secondLine, x + widths[index] / 2, headerY + 2.4, { align: "center" })
    } else {
      pdf.text(firstLine, x + widths[index] / 2, headerY, { align: "center" })
    }
    x += widths[index]
  })

  const totalPayments = rows.reduce(
    (total, row) => total + valueFrom(row, "yearlyPayment", "payment"),
    0
  )

  let y = headerY + headerHeight
  let cumulativeBenefit = 0
  const totals = {
    generation: 0,
    solar: 0,
    battery: 0,
    export: 0,
    annualBenefit: 0,
    payments: 0,
    netAnnual: 0,
    finalNetPosition: 0,
    billPre: 0,
    billPost: 0,
  }

  if (!rows.length) {
    pdf.setTextColor(100, 112, 120)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7)
    pdf.text("No 30 year projection is currently saved.", tableX, y + 10)
    return
  }

  rows.forEach((row, rowIndex) => {
    const solar = solarValue(row)
    const battery = batteryValue(row)
    const exportBenefit = exportValue(row)
    const benefit = solar + battery + exportBenefit
    const payment = valueFrom(row, "yearlyPayment", "payment")
    const netAnnual = benefit + payment
    cumulativeBenefit += benefit
    const netPosition = totalPayments + cumulativeBenefit

    totals.generation += Number(row?.generation || 0)
    totals.solar += solar
    totals.battery += battery
    totals.export += exportBenefit
    totals.annualBenefit += benefit
    totals.payments += payment
    totals.netAnnual += netAnnual
    totals.finalNetPosition = netPosition
    totals.billPre += Number(row?.billPreInstall || 0)
    totals.billPost += Number(row?.billPostInstall || 0)

    const values = [
      String(row?.year || ""),
      num(row?.generation),
      money(solar),
      money(battery),
      money(exportBenefit),
      money(benefit),
      money(payment),
      money(netAnnual),
      money(netPosition),
      money(row?.billPreInstall),
      money(row?.billPostInstall),
    ]

    x = tableX
    values.forEach((value, columnIndex) => {
      const highlighted = columnIndex === 5 || columnIndex === 8
      pdf.setFillColor(...(highlighted ? [232, 245, 235] : rowIndex % 2 === 0 ? [247, 249, 250] : [255, 255, 255]))
      pdf.setDrawColor(225, 230, 234)
      pdf.rect(x, y, widths[columnIndex], rowHeight, "FD")
      pdf.setTextColor(...(highlighted ? [38, 120, 58] : ctx.text))
      pdf.setFont("helvetica", columnIndex === 0 ? "bold" : "normal")
      pdf.setFontSize(6)
      pdf.text(String(value), x + widths[columnIndex] - 0.8, y + rowHeight - 1.55, { align: "right" })
      x += widths[columnIndex]
    })

    y += rowHeight
  })

  const totalValues = [
    "TOTAL",
    num(totals.generation),
    money(totals.solar),
    money(totals.battery),
    money(totals.export),
    money(totals.annualBenefit),
    money(totals.payments),
    money(totals.netAnnual),
    money(totals.finalNetPosition),
    money(totals.billPre),
    money(totals.billPost),
  ]

  x = tableX
  totalValues.forEach((value, index) => {
    pdf.setFillColor(...(index === 5 || index === 8 ? ctx.accent : [82, 92, 100]))
    pdf.setDrawColor(255, 255, 255)
    pdf.rect(x, y, widths[index], totalHeight, "FD")
    pdf.setTextColor(255, 255, 255)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(6)
    pdf.text(String(value), x + widths[index] - 0.8, y + totalHeight - 1.8, { align: "right" })
    x += widths[index]
  })
}
`

const renderMarker = "async function renderPage(pdf, page, index, pageCount, appointment, epvs) {"
if (!source.includes(renderMarker)) {
  throw new Error("Could not locate renderPage in GenerateSolarContract.js")
}

let updated = source.replace(renderMarker, helper + "\n" + renderMarker)

const pageMarker = `  title(pdf, page, ctx)\n  let y = ctx.y + 28\n  const width = ctx.width - ctx.padding * 2\n`
const pageReplacement = `${pageMarker}\n  const pageTitle = String(page?.title || "").trim().toLowerCase()\n  if (pageTitle === "epvs calculations cont." || kind === "epvs_cont" || kind === "epvs_continuation") {\n    drawThirtyYearBreakdown(pdf, page, ctx, epvs)\n    return\n  }\n`

if (!updated.includes(pageMarker)) {
  throw new Error("Could not locate the renderPage content marker in GenerateSolarContract.js")
}

updated = updated.replace(pageMarker, pageReplacement)

fs.writeFileSync(filePath, updated)
console.log("Patched EPVS Calculations Cont. with 30-year breakdown using the 7.6% average inflation scenario")

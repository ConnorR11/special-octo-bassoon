import fs from "fs"

const file = "src/contracts/GenerateSolarContract.js"
let source = fs.readFileSync(file, "utf8")

const helperMarker = "function drawEpvsContractSummary(pdf, ctx, data, results, startY) {"

if (!source.includes(helperMarker)) {
  const helper = String.raw`
function drawEpvsContractSummary(pdf, ctx, data, results, startY) {
  const width = ctx.width - ctx.padding * 2
  const gap = 10
  const columnWidth = (width - gap) / 2
  const generation = Number(results?.generation || 0)
  const solarSelfConsumption = Number(results?.solarSelfConsumption || 0)
  const batterySelfConsumption = Number(results?.batteryContribution || 0)
  // The generation breakdown must allocate the new system's generation
  // only between solar self-consumption, battery self-consumption and
  // residual solar export. results.exportKwh also includes force-charge
  // export, which can exceed the new system's generation and is therefore
  // not appropriate for this percentage breakdown.
  const exportKwh = Math.max(
    0,
    generation - solarSelfConsumption - batterySelfConsumption
  )
  const percentageOfGeneration = (value) => generation > 0 ? value / generation * 100 : null
  const existingSolar = data?.existingSolar === true
  const existingGeneration = existingSolar ? Number(data?.existingGeneration || 0) : null
  const existingSolarSelfConsumption = existingSolar ? Number(data?.existingSolarSelfConsumption || 0) : null
  const existingExport = existingSolar && existingSolarSelfConsumption != null ? Math.max(0, 100 - existingSolarSelfConsumption) : null
  const panelDegradation = Number(data?.solarDegradation || 0)
  const panelDegradationYear1 = Number(data?.solarDegradationYear1 ?? data?.panelDegradationYear1 ?? panelDegradation)
  const finance = data?.paymentMethod === "Finance"
  const financeTerm = Number(data?.financeTerm || 0)
  const financeRate = Number(data?.financeRate || 0)
  const monthlyPayment = Number(results?.monthlyPayment || 0)
  const deposit = Number(data?.deposit || 0)
  const totalRepayment = finance && monthlyPayment > 0 && financeTerm > 0 ? monthlyPayment * financeTerm * 12 + deposit : null

  const value = (raw, suffix = "", decimals = 2) => {
    if (raw === null || raw === undefined || raw === "" || !Number.isFinite(Number(raw))) return "N/A"
    return num(raw, decimals) + suffix
  }
  const pct = (raw) => raw === null || raw === undefined ? "N/A" : num(raw, 2) + "%"
  const moneyValue = (raw) => raw === null || raw === undefined || raw === "" || !Number.isFinite(Number(raw)) ? "N/A" : money(raw)
  const rate = (raw) => raw === null || raw === undefined || raw === "" || !Number.isFinite(Number(raw)) || Number(raw) <= 0 ? "N/A" : num(raw, 2)

  const drawSection = (x, y, sectionTitle, rowsData, options = {}) => {
    const headerHeight = options.headerHeight || 7
    const rowHeight = options.rowHeight || 6.1
    const labelWidth = options.labelWidth || columnWidth * 0.58
    const valueWidth = columnWidth - labelWidth
    const headerFill = [103, 103, 103]
    const cellFill = [235, 240, 244]
    const valueFill = [255, 255, 255]

    pdf.setFillColor(...headerFill)
    pdf.rect(x, y, columnWidth, headerHeight, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(6.7)
    pdf.text(sectionTitle, x + 3, y + 4.7)

    let rowY = y + headerHeight
    if (options.subHeaders) {
      const sub = options.subHeaders
      const firstWidth = labelWidth
      const remaining = columnWidth - firstWidth
      const subWidth = remaining / sub.length
      pdf.setFillColor(...cellFill)
      pdf.setDrawColor(90, 90, 90)
      pdf.setLineWidth(0.2)
      pdf.rect(x, rowY, firstWidth, rowHeight, "FD")
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(5.8)
      pdf.setTextColor(95, 95, 95)
      pdf.text("(per kWh)", x + firstWidth - 3, rowY + 4.1, { align: "right" })
      pdf.setTextColor(255, 255, 255)
      sub.forEach((header, index) => {
        const sx = x + firstWidth + index * subWidth
        pdf.setFillColor(...headerFill)
        pdf.rect(sx, rowY, subWidth, rowHeight, "FD")
        pdf.text(header, sx + subWidth / 2, rowY + 4.1, { align: "center" })
      })
      rowY += rowHeight
    }

    rowsData.forEach((row) => {
      const label = String(row[0] ?? "")
      const values = Array.isArray(row[1]) ? row[1] : [row[1]]
      pdf.setFillColor(...cellFill)
      pdf.setDrawColor(90, 90, 90)
      pdf.setLineWidth(0.2)
      pdf.rect(x, rowY, labelWidth, rowHeight, "FD")
      pdf.setFillColor(...valueFill)
      pdf.rect(x + labelWidth, rowY, valueWidth, rowHeight, "FD")
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(6.4)
      pdf.setTextColor(105, 105, 105)
      pdf.text(label, x + labelWidth - 3, rowY + 4.1, { align: "right" })
      if (values.length === 1) {
        pdf.text(String(values[0]), x + columnWidth - 3, rowY + 4.1, { align: "right" })
      } else {
        const subWidth = valueWidth / values.length
        values.forEach((item, index) => {
          if (index > 0) pdf.line(x + labelWidth + index * subWidth, rowY, x + labelWidth + index * subWidth, rowY + rowHeight)
          pdf.text(String(item), x + labelWidth + index * subWidth + subWidth / 2, rowY + 4.1, { align: "center" })
        })
      }
      rowY += rowHeight
    })
    return rowY
  }

  const leftX = ctx.padding
  const rightX = ctx.padding + columnWidth + gap
  let leftY = startY
  let rightY = startY

  leftY = drawSection(leftX, leftY, "NEW SYSTEM GENERATION (YEAR ONE)", [
    ["New Generation (kWh)", value(generation, "", 2)],
    ["Solar Self-Consumption", pct(percentageOfGeneration(solarSelfConsumption))],
    ["Battery Self-Consumption", pct(percentageOfGeneration(batterySelfConsumption))],
    ["Export", pct(percentageOfGeneration(exportKwh))],
    ["Panel Degradation (Year 1)", num(panelDegradationYear1, 3) + "%"],
    ["Panel Degradation (Years 2+)", num(panelDegradation, 3) + "%"],
    ["Annual Battery Degradation", num(Number(data?.batteryDegradation || 0), 3) + "%"],
  ])
  leftY += 8
  leftY = drawSection(leftX, leftY, "SYSTEM COSTS/REPAYMENTS", [
    ["System Cost", moneyValue(data?.systemCost)],
    ["Deposit", deposit > 0 ? money(deposit) : "N/A"],
    ["Annual Interest Rate", finance && financeRate > 0 ? num(financeRate, 2) + "%" : "N/A"],
    ["Payment Terms (years)", finance && financeTerm > 0 ? num(financeTerm, 0) : "N/A"],
    ["Regular Monthly Repayment", finance && monthlyPayment > 0 ? money(monthlyPayment) : "N/A"],
    ["Final Monthly Repayment", moneyValue(results?.finalMonthlyPayment ?? data?.finalMonthlyPayment)],
    ["Total Repayment (incl. deposit)", moneyValue(totalRepayment)],
  ])

  rightY = drawSection(rightX, rightY, "EXISTING SYSTEM", [
    ["Existing Generation (kWh)", existingGeneration != null ? value(existingGeneration, "", 2) : "N/A"],
    ["Battery Self-Consumption", "N/A"],
    ["Export", existingExport != null ? pct(existingExport) : "N/A"],
    ["Panel Degradation", existingSolar ? num(panelDegradation, 3) + "%" : "N/A"],
  ])
  rightY += 8
  rightY = drawSection(rightX, rightY, "ENERGY USAGE & CURRENT RATES", [
    ["Current Electricity Rate(s)", [rate(data?.importRate), "N/A"]],
    ["Current Export Tariff Rate", rate(data?.exportRate)],
    ["Annual Grid Consumption (kWh)", value(data?.annualConsumption, "", 2)],
  ], { subHeaders: ["SINGLE/DAY", "NIGHT"] })
  rightY += 8
  rightY = drawSection(rightX, rightY, "NEW FLUX RATES", [
    ["Day Rate (5am-4pm & 7pm-2am)", [rate(data?.fluxDayImport), rate(data?.fluxDayExport)]],
    ["Flux Rate (2am-5am)", [rate(data?.fluxImport), rate(data?.fluxExport)]],
    ["Peak Rate (4pm-7pm)", [rate(data?.fluxPeakImport), rate(data?.fluxPeakExport)]],
  ], { subHeaders: ["IMPORT", "EXPORT"] })

  return Math.max(leftY, rightY)
}
`

  const marker = "async function renderPage(pdf, page, index, pageCount, appointment, epvs, salesRepName) {"
  if (!source.includes(marker)) throw new Error("Could not locate renderPage in GenerateSolarContract.js")
  source = source.replace(marker, helper + "\n" + marker)
}

// Ensure both rate-table column headings use the dark header fill with white text.
// Keep the '(per kWh)' label in the light grey cell.
source = source.replace(
  'pdf.text("(per kWh)", x + firstWidth - 3, rowY + 4.1, { align: "right" })\n      sub.forEach',
  'pdf.text("(per kWh)", x + firstWidth - 3, rowY + 4.1, { align: "right" })\n      pdf.setTextColor(255, 255, 255)\n      sub.forEach'
)
source = source.replace(
  'const sx = x + firstWidth + index * subWidth\n        pdf.rect(sx, rowY, subWidth, rowHeight, "FD")',
  'const sx = x + firstWidth + index * subWidth\n        pdf.setFillColor(...headerFill)\n        pdf.rect(sx, rowY, subWidth, rowHeight, "FD")'
)

const datasheetsMarker = '  } else if (kind === "datasheets") {'
const summaryCall = '    y = drawEpvsContractSummary(pdf, ctx, data, results, y + 8)\n'

if (!source.includes(datasheetsMarker)) {
  throw new Error("Could not locate the datasheets branch in GenerateSolarContract.js")
}

if (!source.includes("drawEpvsContractSummary(pdf, ctx, data, results, y + 8)")) {
  source = source.replace(datasheetsMarker, summaryCall + datasheetsMarker)
}

fs.writeFileSync(file, source)
console.log("EPVS contract summary patch applied.")

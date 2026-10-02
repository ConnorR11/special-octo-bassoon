import fs from "node:fs"
import path from "node:path"

const filePath = path.resolve("src/contracts/GenerateSolarContract.js")
let source = fs.readFileSync(filePath, "utf8")

// Only render populated roof/array rows. The total row follows immediately.
const emptyRowsBlock = /\n\s*\/\/ Preserve the six-row layout even when fewer roof arrays are populated\.[\s\S]*?\n\s*const annualGeneration = Number\(results\.generation \|\| totalGeneration \|\| 0\)/
if (emptyRowsBlock.test(source)) {
  source = source.replace(emptyRowsBlock, `\n\n    const annualGeneration = Number(results.generation || totalGeneration || 0)`)
}

// Replace the text-only EPVS mark with the official EPVS Olly owl artwork.
// If the external artwork cannot be fetched, use a text fallback so contract
// generation is never blocked by a third-party image request.
const logoBlock = /\s*const logoX = ctx\.padding \+ width - 50[\s\S]*?pdf\.text\("Validation Scheme", logoX \+ 23, logoY \+ 19, \{ align: "center" \}\)/
if (logoBlock.test(source)) {
  const logoReplacement = `
    const logoX = ctx.padding + width - 53
    const logoY = introCardY + 4
    try {
      const epvsOlly = await imageData("https://epvs.co.uk/wp-content/uploads/2025/06/Olly.svg")
      pdf.addImage(epvsOlly.dataUrl, "PNG", logoX, logoY, 43, 31, undefined, "FAST")
    } catch (error) {
      console.warn("Unable to load EPVS Olly artwork; using text fallback:", error)
      pdf.setTextColor(72, 174, 58)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(25)
      pdf.text("epvs", logoX + 21.5, logoY + 16, { align: "center" })
      pdf.setTextColor(75, 75, 75)
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(5)
      pdf.text("Energy Performance", logoX + 21.5, logoY + 23, { align: "center" })
      pdf.text("Validation Scheme", logoX + 21.5, logoY + 27, { align: "center" })
    }`
  source = source.replace(logoBlock, logoReplacement)
}

// Replace the SAP/roof-array table. This matcher intentionally keys off the
// actual header and TOTAL row rather than the previous surrounding whitespace,
// because other EPVS patches can legitimately change the content immediately
// before and after this table.
const tableRenderBlock = /\n\s*const headers = \["Array", "Panels", "Panel Wp", "Orientation \\(°\\)", "Pitch \\(°\\)", "Irradiance \/ Kk", "SF", "System size \\(kWp\\)", "Generation \\(kWh\\)"\][\s\S]*?const totals = \["TOTAL", num\(totalPanels\), "—", "—", "—", "—", "—", `\$\{num\(totalSystemSize, 2\)\} kWp`, num\(totalGeneration, 2\)\)\][\s\S]*?y = rowY \+ rowHeight \+ 8/ 

if (!tableRenderBlock.test(source)) {
  // Also accept the same table if a previous patch has already altered the
  // header labels slightly. This keeps the build idempotent and prevents a
  // cosmetic table change from breaking the whole contract build.
  const broadTableBlock = /\n\s*const headers = \["Array", "Panels"[\s\S]*?const totals = \["TOTAL"[\s\S]*?\n\s*y = rowY \+ rowHeight \+ 8/
  if (!broadTableBlock.test(source)) {
    throw new Error("Could not locate the EPVS SAP table rendering block")
  }
  source = source.replace(broadTableBlock, buildTableReplacement())
} else {
  source = source.replace(tableRenderBlock, buildTableReplacement())
}

function buildTableReplacement() {
  return `
      const headers = ["Array", "Panels", "Panel Wp", "Orientation (°)", "Pitch (°)", "Irradiance / Kk", "SF", "System size (kWp)", "Generation (kWh)"]
      const widths = [14, 14, 17, 23, 17, 25, 14, 25, 29]
      const tableY = titleY + 5
      const tableX = ctx.padding
      const headerHeight = 8
      const rowHeight = 7
      const radius = 2.2
      const totalWidth = widths.reduce((sum, value) => sum + value, 0)
      let x = tableX

      // Header row: rounded only at the two outer top corners.
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(5.8)
      headers.forEach((header, index) => {
        pdf.setFillColor(...ctx.accent)
        pdf.setDrawColor(255, 255, 255)
        const isFirst = index === 0
        const isLast = index === headers.length - 1
        if (isFirst || isLast) {
          pdf.roundedRect(x, tableY, widths[index], headerHeight, radius, radius, "F")
          if (isFirst) pdf.rect(x + widths[index] - radius, tableY, radius, headerHeight, "F")
          if (isLast) pdf.rect(x, tableY, radius, headerHeight, "F")
        } else {
          pdf.rect(x, tableY, widths[index], headerHeight, "F")
        }
        pdf.setTextColor(255, 255, 255)
        const lines = pdf.splitTextToSize(header, widths[index] - 2)
        pdf.text(lines.slice(0, 2), x + widths[index] / 2, tableY + (lines.length > 1 ? 3 : 5), { align: "center" })
        x += widths[index]
      })

      let rowY = tableY + headerHeight
      let totalGeneration = 0

      arrays.forEach(({ array, index, calculated }) => {
        const panelCount = getTotalPanelCount({ arrays: [array] })
        const systemSize = Number(calculated?.systemSize || 0)
        const generation = Number(calculated?.generation || 0)
        totalGeneration += Number.isFinite(generation) ? generation : 0
        const values = [
          \`Array \${index + 1}\`,
          num(panelCount),
          \`\${num(array.panelWattage || array.panel_wattage)} W\`,
          \`\${num(array.orientation)}°\`,
          \`\${num(array.pitch)}°\`,
          num(array.irradiance, 2),
          num(array.shading, 2),
          \`\${num(systemSize, 2)} kWp\`,
          num(generation, 2)
        ]
        x = tableX
        values.forEach((value, valueIndex) => {
          pdf.setFillColor(valueIndex % 2 === 0 ? 247 : 255, valueIndex % 2 === 0 ? 249 : 255, valueIndex % 2 === 0 ? 250 : 255)
          pdf.setDrawColor(230, 235, 240)
          pdf.rect(x, rowY, widths[valueIndex], rowHeight, "FD")
          pdf.setTextColor(...ctx.text)
          pdf.setFont("helvetica", valueIndex === 0 ? "bold" : "normal")
          pdf.setFontSize(5.9)
          pdf.text(String(value), x + widths[valueIndex] / 2, rowY + 4.6, { align: "center" })
          x += widths[valueIndex]
        })
        rowY += rowHeight
      })

      // Cleaner total row: only the annual generation aggregate is shown.
      const totalLabelWidth = totalWidth - widths[widths.length - 1]
      pdf.setFillColor(...ctx.accent)
      pdf.setDrawColor(255, 255, 255)
      pdf.roundedRect(tableX, rowY, totalLabelWidth, rowHeight, radius, radius, "F")
      pdf.rect(tableX + totalLabelWidth - radius, rowY, radius, rowHeight, "F")
      pdf.setTextColor(255, 255, 255)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(5.9)
      pdf.text("Total Annual Generation (kWh)", tableX + totalLabelWidth - 3, rowY + 4.6, { align: "right" })

      const totalValueX = tableX + totalLabelWidth
      pdf.roundedRect(totalValueX, rowY, widths[widths.length - 1], rowHeight, radius, radius, "F")
      pdf.rect(totalValueX, rowY, radius, rowHeight, "F")
      pdf.setTextColor(255, 255, 255)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(5.9)
      pdf.text(num(totalGeneration, 2), totalValueX + widths[widths.length - 1] / 2, rowY + 4.6, { align: "center" })

      y = rowY + rowHeight + 8`
}

fs.writeFileSync(filePath, source)
console.log("EPVS array table trimmed, rounded and total row tidied; official Olly artwork applied")

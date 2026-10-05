import fs from "node:fs"
import path from "node:path"

const filePath = path.resolve("src/contracts/GenerateSolarContract.js")
let source = fs.readFileSync(filePath, "utf8")

// Keep the 30-year continuation heading/table spacing.
source = source.replace(
  'pdf.text("30 Year Breakdown – 7.6% Inflation Rate", tableX, ctx.y + 17)',
  'pdf.text("30 Year Breakdown – 7.6% Inflation Rate", tableX, ctx.y + 21.5)'
)
source = source.replace(
  'const headerY = ctx.y + 25',
  'const headerY = ctx.y + 28'
)
source = source.replace(
  'let y = headerY + headerHeight',
  'let y = headerY + 4.5'
)

// Replace the EPVS calculation page with the requested presentation.
// The existing blue Homeshield styling is retained, while the content mirrors
// the requested EPVS generation calculation layout.
const epvsBranch = String.raw`  } else if (kind === "epvs") {
    const panelArrays = Array.isArray(data.arrays)
      ? data.arrays
          .slice(0, Number(data.numberOfArrays || data.arrays.length))
          .map((array, index) => ({
            array,
            index,
            calculated: Array.isArray(results.arrays) ? results.arrays[index] || {} : {}
          }))
          .filter(({ array }) => getTotalPanelCount({ arrays: [array] }) > 0)
      : []

    const panelCount = getTotalPanelCount(data)
    const panelWattage = panelArrays
      .map(({ array }) => Number(array?.panelWattage || array?.panel_wattage || 0))
      .find((value) => value > 0) || Number(data.panelWattage || data.panel_wattage || 0)

    const systemSize = Number(results.systemSize || panelArrays.reduce(
      (total, { calculated }) => total + Number(calculated?.systemSize || 0),
      0
    ) || 0)

    const zoneMap = {
      "14": "Glasgow",
      "15": "Dundee",
      "16": "Aberdeen",
      "17": "Inverness",
      "18": "Stornoway",
      "19": "Kirkwall",
      "20": "Lerwick",
      "9S": "Edinburgh",
      "8S": "Dumfries",
      "8E": "Carlisle",
      "9E": "Newcastle",
      "10": "Middlesbrough",
      "11": "Sheffield",
      "12": "Norwich",
      "13": "Aberystwyth",
      "21": "Belfast",
      "7E": "Manchester",
      "7W": "Chester",
      "6": "Birmingham",
      "5W": "Cardiff",
      "5E": "Bristol",
      "4": "Plymouth",
      "3": "Southampton",
      "2": "Brighton",
      "1": "London"
    }

    const inferZone = (postcode) => {
      const outward = String(postcode || "").trim().toUpperCase().split(/\s+/)[0]
      if (/^(G|PA)/.test(outward)) return "14"
      if (/^DD/.test(outward)) return "15"
      if (/^AB/.test(outward)) return "16"
      if (/^IV/.test(outward)) return "17"
      if (/^HS/.test(outward)) return "18"
      if (/^KW/.test(outward)) return "19"
      if (/^ZE/.test(outward)) return "20"
      if (/^EH/.test(outward)) return "9S"
      if (/^DG/.test(outward)) return "8S"
      if (/^CA/.test(outward)) return "8E"
      if (/^NE/.test(outward)) return "9E"
      if (/^TS/.test(outward)) return "10"
      if (/^S/.test(outward)) return "11"
      if (/^NR/.test(outward)) return "12"
      if (/^(SY23|SY24|SY25)/.test(outward)) return "13"
      if (/^BT/.test(outward)) return "21"
      if (/^CH/.test(outward)) return "7W"
      if (/^(M|OL)/.test(outward)) return "7E"
      if (/^(B|CV)/.test(outward)) return "6"
      if (/^CF/.test(outward)) return "5W"
      if (/^BS/.test(outward)) return "5E"
      if (/^PL/.test(outward)) return "4"
      if (/^SO/.test(outward)) return "3"
      if (/^BN/.test(outward)) return "2"
      if (/^(E|EC|N|NW|SE|SW|W|WC)/.test(outward)) return "1"
      return "14"
    }

    const zone = String(
      data.sapZone || data.sap_zone || data.sapRegionCode || data.sap_region_code || inferZone(
        appointment?.postcode || data.postcode
      )
    )
    const regionName = zoneMap[zone] || zone

    // EPVS certification panel from the supplied reference, rebuilt in the
    // existing contract style so it remains sharp/selectable in the PDF.
    // The page title/underline sits immediately above this card, so keep the
    // card close to the heading rather than leaving the default page gap.
    y -= 6
    const introCardY = y - 3
    const introCardH = 37
    pdf.setFillColor(245, 248, 250)
    pdf.setDrawColor(225, 231, 235)
    pdf.setLineWidth(0.35)
    pdf.roundedRect(ctx.padding, introCardY, width, introCardH, 3, 3, "FD")

    const introX = ctx.padding + 7
    const introW = width - 63
    pdf.setTextColor(...ctx.text)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(8)
    pdf.text("EPVS CERTIFIED INSTALLER", introX, introCardY + 8)

    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(6.6)
    pdf.setTextColor(70, 82, 92)
    const intro1 = "We are proud to be an EPVS Certified Installer, and as part of our membership, the performance figures and savings estimates we provide are independently checked for accuracy and compliance with industry standards."
    const intro2 = "EPVS validation helps ensure that the information you receive is clear, fair, and based on realistic performance expectations, giving you confidence in the figures presented within this proposal."
    pdf.text(pdf.splitTextToSize(intro1, introW), introX, introCardY + 14)
    pdf.text(pdf.splitTextToSize(intro2, introW), introX, introCardY + 25)

    const logoX = ctx.padding + width - 50
    const logoY = introCardY + 8
    pdf.setTextColor(72, 170, 77)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(24)
    pdf.text("epvs", logoX + 23, logoY + 8, { align: "center" })
    pdf.setTextColor(70, 82, 92)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(4.4)
    pdf.text("Energy Performance", logoX + 23, logoY + 14, { align: "center" })
    pdf.text("Validation Scheme", logoX + 23, logoY + 19, { align: "center" })

    y = introCardY + introCardH + 8

    pdf.setTextColor(...ctx.text)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7)
    const explanation = "The figures below are based on the inputs used to calculate the generation of your new system. The calculation used to determine the generation for each roof/array is System Size × Irradiance × Shade Factor."
    const explanationLines = pdf.splitTextToSize(explanation, width)
    pdf.text(explanationLines, ctx.padding, y)
    // Keep the summary table close to the explanatory statement.
    y += explanationLines.length * 3.8 + 3.5

    // Four-column system summary.
    const summaryHeaders = ["NUMBER OF PANELS", "PANEL SIZE", "TOTAL SYSTEM SIZE", "POSTCODE REGION"]
    const summaryValues = [
      num(panelCount),
      \`${num(panelWattage)} W\`,
      \`${num(systemSize, 2)} kWp\`,
      \`Zone ${zone} - ${regionName}\`
    ]
    const summaryWidths = [width * 0.23, width * 0.24, width * 0.25, width * 0.28]
    let sx = ctx.padding
    summaryHeaders.forEach((header, index) => {
      pdf.setFillColor(...ctx.accent)
      pdf.setDrawColor(255, 255, 255)
      pdf.rect(sx, y, summaryWidths[index], 7, "FD")
      pdf.setTextColor(255, 255, 255)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(5.2)
      pdf.text(header, sx + summaryWidths[index] / 2, y + 4.6, { align: "center" })
      sx += summaryWidths[index]
    })
    sx = ctx.padding
    summaryValues.forEach((value, index) => {
      pdf.setFillColor(255, 255, 255)
      pdf.setDrawColor(120, 130, 138)
      pdf.rect(sx, y + 7, summaryWidths[index], 9, "FD")
      pdf.setTextColor(...ctx.text)
      pdf.setFont("helvetica", index === 3 ? "normal" : "bold")
      pdf.setFontSize(7)
      pdf.text(String(value), sx + summaryWidths[index] / 2, y + 13, { align: "center" })
      sx += summaryWidths[index]
    })
    y += 23

    // Roof/array calculation table.
    const tableX = ctx.padding
    const tableWidth = width
    const headerHeight = 11
    const rowHeight = 7
    const tableHeaders = [
      "ROOF/\nARRAY",
      "NO. OF\nPANELS",
      "ARRAY SIZE\n(kWp)",
      "ORIENTATION\n(° from south)",
      "ROOF PITCH\n(° from flat)",
      "IRRADIANCE\n(kK figure)",
      "SHADE\nFACTOR",
      "GENERATION\n(kWh)"
    ]
    const tableWidths = [14, 17, 23, 28, 28, 25, 23, tableWidth - 158]
    let tx = tableX
    tableHeaders.forEach((header, index) => {
      pdf.setFillColor(...ctx.accent)
      pdf.rect(tx, y, tableWidths[index], headerHeight, "F")
      pdf.setTextColor(255, 255, 255)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(5.4)
      const lines = String(header).split("\n")
      lines.forEach((line, lineIndex) => {
        pdf.text(line, tx + tableWidths[index] / 2, y + 4 + lineIndex * 3.3, { align: "center" })
      })
      tx += tableWidths[index]
    })

    let rowY = y + headerHeight
    let totalGeneration = 0
    panelArrays.slice(0, 6).forEach(({ array, index, calculated }) => {
      const count = getTotalPanelCount({ arrays: [array] })
      const size = Number(calculated?.systemSize || ((Number(array?.panelWattage || 0) * count) / 1000) || 0)
      const generation = Number(calculated?.generation || 0)
      totalGeneration += generation

      const values = [
        String(index + 1),
        num(count),
        num(size, 2),
        num(array?.orientation, 0),
        num(array?.pitch, 0),
        num(array?.irradiance, 0),
        num(array?.shading, 2),
        num(generation, 2)
      ]

      tx = tableX
      values.forEach((value, valueIndex) => {
        pdf.setFillColor(255, 255, 255)
        pdf.setDrawColor(120, 130, 138)
        pdf.rect(tx, rowY, tableWidths[valueIndex], rowHeight, "FD")
        pdf.setTextColor(...ctx.text)
        pdf.setFont("helvetica", valueIndex === 0 ? "bold" : "normal")
        pdf.setFontSize(6.5)
        pdf.text(String(value), tx + tableWidths[valueIndex] / 2, rowY + 4.6, { align: "center" })
        tx += tableWidths[valueIndex]
      })
      rowY += rowHeight
    })

    // Preserve the six-row layout even when fewer roof arrays are populated.
    const emptyRows = Math.max(0, 6 - Math.min(panelArrays.length, 6))
    for (let i = 0; i < emptyRows; i += 1) {
      tx = tableX
      tableWidths.forEach((cellWidth) => {
        pdf.setFillColor(255, 255, 255)
        pdf.setDrawColor(120, 130, 138)
        pdf.rect(tx, rowY, cellWidth, rowHeight, "FD")
        tx += cellWidth
      })
      rowY += rowHeight
    }

    const annualGeneration = Number(results.generation || totalGeneration || 0)
    tx = tableX
    const totalValues = ["", "", "", "", "", "", "Total Annual Generation (kWh)", num(annualGeneration, 2)]
    tableWidths.forEach((cellWidth, index) => {
      pdf.setFillColor(index === 7 ? 247 : 255, index === 7 ? 249 : 255, index === 7 ? 250 : 255)
      pdf.setDrawColor(120, 130, 138)
      pdf.rect(tx, rowY, cellWidth, rowHeight, "FD")
      if (index === 6) {
        pdf.setTextColor(...ctx.text)
        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(6.2)
        pdf.text("Total Annual Generation (kWh)", tx + cellWidth - 2, rowY + 4.6, { align: "right" })
      } else if (index === 7) {
        pdf.setTextColor(...ctx.text)
        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(7)
        pdf.text(num(annualGeneration, 2), tx + cellWidth / 2, rowY + 4.6, { align: "center" })
      }
      tx += cellWidth
    })

    y = rowY + rowHeight + 4
`
const marker = /  \} else if \(kind === "epvs"\) \{[\s\S]*?\n  \} else if \(kind === "datasheets"\) \{/ 
if (!marker.test(source)) {
  throw new Error("Could not locate the existing EPVS page renderer")
}
source = source.replace(marker, epvsBranch + '  } else if (kind === "datasheets") {')

fs.writeFileSync(filePath, source)
console.log("EPVS calculation page updated with generation detail and certification panel")

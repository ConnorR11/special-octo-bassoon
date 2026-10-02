import fs from "node:fs"

const file = "src/contracts/GenerateSolarContract.js"
let source = fs.readFileSync(file, "utf8")

// Statements-only renderer enhancement. Do not alter signatures, EPVS, itemised
// breakdowns, or other page rendering.
const oldBody = `function body(pdf, content, x, y, width, textRgb, appointment, epvs) {
  if (!content) return y
  const cleaned = String(content).replace(/(^|\\r?\\n)\\s*{{open_solar_image}}\\s*(?=\\r?\\n|$)/g, "$1")
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(9)
  pdf.setTextColor(...textRgb)
  interpolate(cleaned, appointment, epvs).split(/\\r?\\n/).forEach((line) => {
    if (!line.trim()) {
      y += 4
      return
    }
    pdf.splitTextToSize(line, width).forEach((part) => {
      pdf.text(part, x, y)
      y += 4.8
    })
    y += 2
  })
  return y
}`

const newBody = `function body(pdf, content, x, y, width, textRgb, appointment, epvs, settings = {}) {
  if (!content) return y
  const cleaned = String(content).replace(/(^|\\r?\\n)\\s*{{open_solar_image}}\\s*(?=\\r?\\n|$)/g, "$1")
  const fontSize = Number(settings.font_size ?? settings.body_font_size ?? 9)
  const lineHeight = Number(settings.line_height ?? settings.body_line_height ?? 4.8)
  const paragraphSpacing = Number(settings.paragraph_spacing ?? settings.section_spacing ?? 2)
  const blankLineSpacing = Number(settings.blank_line_spacing ?? paragraphSpacing)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(fontSize)
  pdf.setTextColor(...textRgb)
  interpolate(cleaned, appointment, epvs).split(/\\r?\\n/).forEach((line) => {
    if (!line.trim()) {
      y += blankLineSpacing
      return
    }
    pdf.splitTextToSize(line.trim(), width).forEach((part) => {
      pdf.text(part, x, y)
      y += lineHeight
    })
    y += paragraphSpacing
  })
  return y
}`

if (!source.includes(oldBody)) {
  console.log("Statements body renderer already updated or source shape changed; skipping.")
  process.exit(0)
}
source = source.replace(oldBody, newBody)

// Only pass page settings into the generic body renderer for the Important
// Customer Statements page. Other pages retain their existing rendering.
const oldStandard = `  } else {
    body(pdf, page.body, ctx.padding, y, width, ctx.text, appointment, epvs)
  }
}`
const newStandard = `  } else {
    const isImportantStatements = /important\\s+customer\\s+statements/i.test(String(page.title || "")) || page.settings?.page_kind === "statements"
    body(pdf, page.body, ctx.padding, y, width, ctx.text, appointment, epvs, isImportantStatements ? page.settings : {})
  }
}`

if (!source.includes(oldStandard)) {
  console.log("Statements page render branch not found; skipping settings wiring.")
  process.exit(0)
}
source = source.replace(oldStandard, newStandard)
fs.writeFileSync(file, source)

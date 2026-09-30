import fs from "node:fs"
import path from "node:path"

const filePath = path.resolve("src/contracts/GenerateSolarContract.js")
const source = fs.readFileSync(filePath, "utf8")

const pattern = /  if \(logoType === "hies"\) \{[\s\S]*?    return\n  \}\n\n  const initials/

const replacement = `  if (logoType === "hies") {
    // Refreshed HIES 2026 branding: dark green wordmark with the
    // distinctive layered geometric icon used by the current HIES site.
    const green = [0, 93, 67]
    const lightGreen = [105, 185, 95]
    const paleGreen = [218, 239, 215]
    const iconX = x + 5
    const iconY = y + 5
    const iconW = 15
    const iconH = Math.min(22, height - 10)

    pdf.setFillColor(...green)
    pdf.roundedRect(iconX, iconY + 2, iconW * 0.52, iconH - 4, 1.2, 1.2, "F")

    pdf.setFillColor(...lightGreen)
    pdf.triangle(
      iconX + iconW * 0.45,
      iconY,
      iconX + iconW,
      iconY + iconH * 0.2,
      iconX + iconW * 0.45,
      iconY + iconH * 0.4,
      "F"
    )
    pdf.setFillColor(...paleGreen)
    pdf.triangle(
      iconX + iconW * 0.45,
      iconY + iconH * 0.34,
      iconX + iconW,
      iconY + iconH * 0.54,
      iconX + iconW * 0.45,
      iconY + iconH * 0.88,
      "F"
    )

    pdf.setTextColor(...green)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(19)
    pdf.text("HIES", iconX + iconW + 4, y + height * 0.53)

    pdf.setTextColor(...green)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(4.3)
    pdf.text("HOME ENERGY PROTECTION", iconX + iconW + 4, y + height * 0.71)
    return
  }

  const initials`

if (!pattern.test(source)) {
  throw new Error("Could not locate the existing HIES accreditation logo block in GenerateSolarContract.js")
}

const updated = source.replace(pattern, replacement)
fs.writeFileSync(filePath, updated)
console.log("Patched HIES accreditation branding")

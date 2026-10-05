import fs from "node:fs"
import path from "node:path"

const filePath = path.resolve("src/contracts/GenerateSolarContract.js")
let source = fs.readFileSync(filePath, "utf8")

// Remove the EPVS certification card from the EPVS calculation page.
// Keep the first explanatory content close to the page title instead.
const certificationStart = '    // EPVS certification panel from the supplied reference'
const certificationEnd = '    y = introCardY + introCardH + 8\n'

if (source.includes(certificationStart) && source.includes(certificationEnd)) {
  const start = source.indexOf(certificationStart)
  const end = source.indexOf(certificationEnd, start)
  if (end === -1) throw new Error("Could not locate the end of the EPVS certification panel")
  const replacement = '    y = ctx.y + 20\n\n'
  source = source.slice(0, start) + replacement + source.slice(end + certificationEnd.length)
}

// Move the same certification panel to the top of the Accreditations page.
const accreditationMarker = '  } else if (kind === "accreditations") {\n'
const itemsMarker = '    const items = Array.isArray(settings.items) ? settings.items : []\n'

if (!source.includes(accreditationMarker)) {
  throw new Error("Could not locate the accreditations page renderer")
}

if (!source.includes('pdf.text("EPVS CERTIFIED INSTALLER", introX, introCardY + 8)')) {
  if (!source.includes(itemsMarker)) {
    throw new Error("Could not locate the accreditations items declaration")
  }

  const accreditationCard = String.raw`    // EPVS certification panel moved from the EPVS calculation page.
    const epvsCardY = y
    const epvsCardH = 37
    pdf.setFillColor(245, 248, 250)
    pdf.setDrawColor(225, 231, 235)
    pdf.setLineWidth(0.35)
    pdf.roundedRect(ctx.padding, epvsCardY, width, epvsCardH, 3, 3, "FD")

    const epvsIntroX = ctx.padding + 7
    const epvsIntroW = width - 63
    pdf.setTextColor(...ctx.text)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(8)
    pdf.text("EPVS CERTIFIED INSTALLER", epvsIntroX, epvsCardY + 8)

    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(6.6)
    pdf.setTextColor(70, 82, 92)
    const epvsIntro1 = "We are proud to be an EPVS Certified Installer, and as part of our membership, the performance figures and savings estimates we provide are independently checked for accuracy and compliance with industry standards."
    const epvsIntro2 = "EPVS validation helps ensure that the information you receive is clear, fair, and based on realistic performance expectations, giving you confidence in the figures presented within this proposal."
    pdf.text(pdf.splitTextToSize(epvsIntro1, epvsIntroW), epvsIntroX, epvsCardY + 14)
    pdf.text(pdf.splitTextToSize(epvsIntro2, epvsIntroW), epvsIntroX, epvsCardY + 25)

    const epvsLogoX = ctx.padding + width - 50
    const epvsLogoY = epvsCardY + 8
    pdf.setTextColor(72, 170, 77)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(24)
    pdf.text("epvs", epvsLogoX + 23, epvsLogoY + 8, { align: "center" })
    pdf.setTextColor(70, 82, 92)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(4.4)
    pdf.text("Energy Performance", epvsLogoX + 23, epvsLogoY + 14, { align: "center" })
    pdf.text("Validation Scheme", epvsLogoX + 23, epvsLogoY + 19, { align: "center" })

    y += epvsCardH + 7

`
  source = source.replace(itemsMarker, accreditationCard + itemsMarker)
}

fs.writeFileSync(filePath, source)
console.log("Moved EPVS certification panel to the Accreditations page.")

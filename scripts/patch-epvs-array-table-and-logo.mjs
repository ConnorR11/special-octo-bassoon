import fs from "node:fs"
import path from "node:path"

const filePath = path.resolve("src/contracts/GenerateSolarContract.js")
let source = fs.readFileSync(filePath, "utf8")

// Only render populated roof/array rows. The total row follows immediately.
const emptyRowsBlock = /\n\s*\/\/ Preserve the six-row layout even when fewer roof arrays are populated\.[\s\S]*?\n\s*const annualGeneration = Number\(results\.generation \|\| totalGeneration \|\| 0\)/
if (!emptyRowsBlock.test(source)) {
  throw new Error("Could not locate the EPVS empty-row block")
}
source = source.replace(emptyRowsBlock, `\n\n    const annualGeneration = Number(results.generation || totalGeneration || 0)`)

// Replace the text-only EPVS mark with the official EPVS Olly owl artwork.
// The image is the current Olly asset published by EPVS.
const logoBlock = /\s*const logoX = ctx\.padding \+ width - 50[\s\S]*?pdf\.text\("Validation Scheme", logoX \+ 23, logoY \+ 19, \{ align: "center" \}\)/
if (!logoBlock.test(source)) {
  throw new Error("Could not locate the EPVS logo block")
}
const logoReplacement = `
    const logoX = ctx.padding + width - 53
    const logoY = introCardY + 4
    const epvsOlly = await imageData("https://epvs.co.uk/wp-content/uploads/2025/06/Olly.svg")
    pdf.addImage(epvsOlly.dataUrl, "PNG", logoX, logoY, 43, 31, undefined, "FAST")`
source = source.replace(logoBlock, logoReplacement)

fs.writeFileSync(filePath, source)
console.log("EPVS array table trimmed and official Olly artwork applied")

import fs from "node:fs"

const file = "src/contracts/GenerateSolarContract.js"
let source = fs.readFileSync(file, "utf8")

// The Important Customer Statements page uses the same generic terms renderer.
// Make that renderer reset PDF text state before each section and use a compact,
// predictable vertical rhythm so long statements cannot run into the footer.
const start = source.indexOf('  const sections = parseTermsSections(interpolate(String(page.body || ""), appointment, epvs))')
const end = source.indexOf('  const drawLines = (lines)', start)
if (start < 0 || end < 0) {
  console.log("Important statements renderer not found; skipping layout patch")
  process.exit(0)
}

let block = source.slice(start, end)

block = block.replace(
  '    sections.forEach((section) => {\n      const normalized = section.replace(/\\s+/g, " ").trim()',
  '    sections.forEach((section) => {\n      // Reset any PDF text state inherited from preceding tables/components.\n      if (typeof pdf.setCharSpace === "function") pdf.setCharSpace(0)\n      pdf.setFont("helvetica", "normal")\n      pdf.setFontSize(fontSize)\n      const normalized = section.replace(/\\s+/g, " ").trim()'
)

// Compact the generic statement typography without changing the actual wording.
block = block.replace(/fontSize\\)\\n        pdf\.splitTextToSize/g, 'fontSize)\\n        pdf.splitTextToSize')
block = block.replace(/y \+= 4\.8/g, 'y += 4.2')
block = block.replace(/y \+= 4\n/g, 'y += 3.6\n')

source = source.slice(0, start) + block + source.slice(end)
fs.writeFileSync(file, source)

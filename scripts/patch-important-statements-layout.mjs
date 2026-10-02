import fs from "node:fs"

const file = "src/contracts/GenerateSolarContract.js"
let source = fs.readFileSync(file, "utf8")

const start = source.indexOf('  const sections = parseTermsSections(interpolate(String(page.body || ""), appointment, epvs))')
const end = source.indexOf("  let column = 0", start)
if (start < 0 || end < 0) {
  console.log("Important statements renderer not found; skipping layout patch")
  process.exit(0)
}

let block = source.slice(start, end)

block = block.replace(
  '    sections.forEach((section) => {\n      const normalized = section.replace(/\\s+/g, " ").trim()',
  '    sections.forEach((section) => {\n      if (typeof pdf.setCharSpace === "function") pdf.setCharSpace(0)\n      pdf.setFont("helvetica", "normal")\n      pdf.setFontSize(Math.min(fontSize, 8.2))\n      const normalized = section.replace(/\\s+/g, " ").trim()'
)

// Reduce vertical density on the statements page so the final section stays clear of the footer.
block = block.replace(/y \+= 4\.8/g, "y += 3.9")
block = block.replace(/y \+= 4\n/g, "y += 3.2\n")

source = source.slice(0, start) + block + source.slice(end)
fs.writeFileSync(file, source)

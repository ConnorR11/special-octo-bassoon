import fs from "node:fs"

const file = "src/contracts/GenerateSolarContract.js"
let source = fs.readFileSync(file, "utf8")

// ONLY modify the Important Customer Statements renderer.
// Do not touch contract signatures, EPVS pages, itemised breakdowns, or any
// other contract rendering.
const start = source.indexOf('  const sections = parseTermsSections(interpolate(String(page.body || ""), appointment, epvs))')
const end = source.indexOf("  let column = 0", start)
if (start < 0 || end < 0) {
  console.log("Important statements renderer not found; skipping layout patch")
  process.exit(0)
}

let block = source.slice(start, end)

// The statements page can inherit character spacing from preceding PDF content.
// Explicitly reset it for this page only so normal paragraphs do not render with
// the widely-spaced characters seen in the statements page.
if (!block.includes('pdf.setCharSpace(0)')) {
  block = '  pdf.setCharSpace(0)\n' + block
}

// Tighten only the vertical gaps between statement sections/paragraphs so the
// complete Important Customer Statements page fits cleanly above the footer.
block = block.replace(/y \+= 4\.8/g, "y += 2.8")
block = block.replace(/y \+= 4\n/g, "y += 2.2\n")

source = source.slice(0, start) + block + source.slice(end)
fs.writeFileSync(file, source)

import fs from "node:fs"

const file = "src/contracts/GenerateSolarContract.js"
let source = fs.readFileSync(file, "utf8")

// Only adjust vertical spacing on the Important Customer Statements page.
// Do not alter fonts, character spacing, wording, or any other PDF styling.
const start = source.indexOf('  const sections = parseTermsSections(interpolate(String(page.body || ""), appointment, epvs))')
const end = source.indexOf("  let column = 0", start)
if (start < 0 || end < 0) {
  console.log("Important statements renderer not found; skipping layout patch")
  process.exit(0)
}

let block = source.slice(start, end)

// Tighten only the vertical gaps between statement sections/paragraphs so the
// complete Important Customer Statements page fits cleanly above the footer.
// Leave fonts, character spacing, wording and all other PDF styling unchanged.
block = block.replace(/y \+= 4\.8/g, "y += 2.8")
block = block.replace(/y \+= 4\n/g, "y += 2.2\n")

source = source.slice(0, start) + block + source.slice(end)
fs.writeFileSync(file, source)

import fs from "node:fs"

const calculatorPath = "src/EPVSCalculator.jsx"
const calculator = fs.readFileSync(calculatorPath, "utf8")

const withoutImport = calculator.replace(
  /^import\s+AnnualBreakdown\s+from\s+["'][^"']*AnnualBreakdown["']\s*\n/m,
  ""
)

const withoutComponent = withoutImport.replace(
  /\n\s*<AnnualBreakdown\b[^>]*\/?>\s*\n/g,
  "\n"
)

let next = withoutComponent

// Remove the two result metrics from the EPVS results summary.
next = next.replace(
  /\n\s*\[\s*"Annual saving",[\s\S]*?\n\s*\],/g,
  "\n"
)
next = next.replace(
  /\n\s*\[\s*"Simple payback",[\s\S]*?\n\s*\],/g,
  "\n"
)

// The six remaining summary metrics should sit on one row on desktop.
next = next.replace(
  'gridTemplateColumns:\n      "repeat(4, minmax(0, 1fr))"',
  'gridTemplateColumns:\n      "repeat(6, minmax(0, 1fr))"'
)

if (next !== calculator) {
  fs.writeFileSync(calculatorPath, next)
  console.log("EPVS results summary updated.")
} else {
  console.log("EPVS results summary already matches the requested layout.")
}

const cssPath = "src/index.css"
if (fs.existsSync(cssPath)) {
  const css = fs.readFileSync(cssPath, "utf8")
  const withoutAnnualCss = css.replace(
    /\n\s*\.annual-breakdown[^\{]*\{[^}]*\}\s*/g,
    "\n"
  )
  if (withoutAnnualCss !== css) {
    fs.writeFileSync(cssPath, withoutAnnualCss)
  }
}

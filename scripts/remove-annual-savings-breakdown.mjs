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

if (withoutComponent !== calculator) {
  fs.writeFileSync(calculatorPath, withoutComponent)
  console.log("Annual savings breakdown removed from calculator.")
} else {
  console.log("Annual savings breakdown already removed from calculator.")
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

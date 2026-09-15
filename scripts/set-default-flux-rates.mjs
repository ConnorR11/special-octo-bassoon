import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
const text = fs.readFileSync(path, "utf8")

const replacements = [
  [/fluxDayImport:\s*[-+]?\d*\.?\d+/, "fluxDayImport: 0"],
  [/fluxDayExport:\s*[-+]?\d*\.?\d+/, "fluxDayExport: 0"],
  [/fluxImport:\s*[-+]?\d*\.?\d+/, "fluxImport: 0"],
  [/fluxExport:\s*[-+]?\d*\.?\d+/, "fluxExport: 0"],
  [/fluxPeakImport:\s*[-+]?\d*\.?\d+/, "fluxPeakImport: 0"],
  [/fluxPeakExport:\s*[-+]?\d*\.?\d+/, "fluxPeakExport: 0"],
  [/fluxStandingCharge:\s*[-+]?\d*\.?\d+/, "fluxStandingCharge: 0"],
]

let next = text
for (const [pattern, replacement] of replacements) {
  next = next.replace(pattern, replacement)
}

if (next === text) {
  throw new Error("Could not find the default Flux rates in src/EPVSCalculator.jsx")
}

fs.writeFileSync(path, next)

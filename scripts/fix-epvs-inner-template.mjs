import fs from "node:fs"
import path from "node:path"

const filePath = path.resolve("scripts/patch-epvs-30-year-layout.mjs")
let source = fs.readFileSync(filePath, "utf8")

// The EPVS patch is stored inside a String.raw template. Do not put nested
// template literals in the generated source; they leave escaped backticks in
// GenerateSolarContract.js and cause Vite import parsing to fail.
source = source.replace(/\\`\\\$\\{num\\(panelWattage\\)\\} W\\`/g, 'num(panelWattage) + " W"')
source = source.replace(/\\`\\\$\\{num\\(systemSize, 2\\)\\} kWp\\`/g, 'num(systemSize, 2) + " kWp"')
source = source.replace(/\\`Zone \\${zone} - \\${regionName}\\`/g, '"Zone " + zone + " - " + regionName')

fs.writeFileSync(filePath, source)
console.log("EPVS inner template syntax fixed")

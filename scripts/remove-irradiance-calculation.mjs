import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
let text = fs.readFileSync(path, "utf8")

text = text.replace('import { getIrradiance } from "./epvsIrradianceData"\n', "")

const start = text.indexOf("  // Automatically populate EPVS irradiance from postcode/SAP zone, pitch and orientation.\n")
if (start !== -1) {
  const endMarker = "  const updateArray = (\n"
  const end = text.indexOf(endMarker, start)
  if (end === -1) throw new Error("Could not locate the end of the irradiance calculation block")
  text = text.slice(0, start) + text.slice(end)
}

fs.writeFileSync(path, text)
console.log("Removed local irradiance calculation; EPVS now uses imported array irradiance.")

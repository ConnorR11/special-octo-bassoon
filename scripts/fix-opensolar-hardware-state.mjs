import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
let text = fs.readFileSync(path, "utf8")
const before = text

// The OpenSolar hardware build patch writes these state properties into the
// source file. Normalise the generated object syntax before Vite compiles it.
const fixes = [
  ['  batteryManufacturer: ""\n', '  batteryManufacturer: "",\n'],
  ['  batteryModel: ""\n', '  batteryModel: "",\n'],
  ['  inverterManufacturer: ""\n', '  inverterManufacturer: "",\n'],
  ['  inverterModel: ""\n', '  inverterModel: "",\n'],
  ['  evChargerManufacturer: ""\n', '  evChargerManufacturer: "",\n'],
  ['  evChargerModel: ""\n', '  evChargerModel: "",\n'],
]

for (const [from, to] of fixes) text = text.split(from).join(to)

if (text !== before) {
  fs.writeFileSync(path, text)
  console.log("OpenSolar hardware state syntax fixed.")
} else {
  console.log("OpenSolar hardware state syntax already valid.")
}

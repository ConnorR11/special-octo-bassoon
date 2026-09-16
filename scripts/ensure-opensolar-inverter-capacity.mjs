import fs from "node:fs"

const path = "api/opensolar-design.js"
const text = fs.readFileSync(path, "utf8")

const oldBlock = `      const capacity = numberOrNull(\n        activationData?.max_power_rating,\n        activationData?.max_power_kw,\n        activationData?.power_kw,\n        partData?.max_power_rating,\n        partData?.max_power_kw,\n        partData?.power_kw,\n        part?.max_power_rating,\n        part?.max_power_kw,\n        part?.power_kw,\n      )`

const newBlock = `      const rawCapacity = numberOrNull(\n        activation?.max_power_rating,\n        activation?.max_power_kw,\n        activation?.power_kw,\n        activationData?.max_power_rating,\n        activationData?.max_power_kw,\n        activationData?.power_kw,\n        activation?.specs?.max_power_rating,\n        activationData?.specs?.max_power_rating,\n        part?.activation?.max_power_rating,\n        partData?.activation?.max_power_rating,\n        partData?.max_power_rating,\n        partData?.max_power_kw,\n        partData?.power_kw,\n        part?.max_power_rating,\n        part?.max_power_kw,\n        part?.power_kw,\n      )\n      // OpenSolar's max_power_rating can be returned as watts in some\n      // activation records. The EPVS calculator expects kW.\n      const capacity = rawCapacity == null ? null : rawCapacity > 100 ? rawCapacity / 1000 : rawCapacity`

if (!text.includes(oldBlock)) {
  console.log("OpenSolar inverter capacity block already patched or layout differs; no change made.")
  process.exit(0)
}

fs.writeFileSync(path, text.replace(oldBlock, newBlock))
console.log("OpenSolar inverter max_power_rating patched into EPVS capacity path.")

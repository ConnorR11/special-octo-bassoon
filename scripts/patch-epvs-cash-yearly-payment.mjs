import fs from "node:fs"

const file = "src/EPVSCalculator.jsx"
let source = fs.readFileSync(file, "utf8")

const oldBlock = `        const yearlyPayment =
          data.paymentMethod === "Finance"
            ? financeAnnualPayment + (year === 1 ? deposit : 0)
            : year === 1
              ? Math.max(0, systemCost - deposit)
              : 0`

const newBlock = `        const yearlyPayment =
          data.paymentMethod === "Finance"
            ? financeAnnualPayment + (year === 1 ? deposit : 0)
            : year === 1
              ? Math.max(0, systemCost)
              : 0`

if (source.includes(newBlock)) {
  console.log("EPVS cash yearly payment already uses the full system cost.")
  process.exit(0)
}

if (!source.includes(oldBlock)) {
  throw new Error("Could not locate the cash yearly payment calculation in EPVSCalculator.jsx")
}

source = source.replace(oldBlock, newBlock)
fs.writeFileSync(file, source)
console.log("Updated EPVS cash yearly payment to show the full system cost, not system cost less deposit.")

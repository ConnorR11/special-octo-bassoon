import fs from "node:fs"

const file = "src/EPVSCalculator.jsx"
const source = fs.readFileSync(file, "utf8")

// The calculator's cash branch must show the full system cost in Year 1,
// then zero in every later year. Finance keeps its existing payment logic.
const candidates = [
  source.indexOf("const isCashPayment ="),
  source.indexOf("const isFinancePayment ="),
  source.indexOf("const yearlyPayment ="),
].filter((index) => index >= 0)
const start = Math.min(...candidates)
if (!Number.isFinite(start)) {
  throw new Error("Could not locate yearlyPayment calculation in EPVSCalculator.jsx")
}

const endMarker = "\n\n        const netAnnualBenefit"
const end = source.indexOf(endMarker, start)
if (end === -1) {
  throw new Error("Could not locate end of yearlyPayment calculation in EPVSCalculator.jsx")
}

const currentBlock = source.slice(start, end)
const desiredBlock = `const isCashPayment = String(data.paymentMethod || "").trim().toLowerCase() === "cash"
        const yearlyPayment = isCashPayment
          ? year === 1
            ? Math.max(0, systemCost)
            : 0
          : financeAnnualPayment + (year === 1 ? deposit : 0)`

if (currentBlock === desiredBlock) {
  console.log("EPVS yearly payments already use full system cost in cash Year 1 and zero thereafter.")
  process.exit(0)
}

const updated = source.slice(0, start) + desiredBlock + source.slice(end)
fs.writeFileSync(file, updated)
console.log("Updated EPVS yearly payments: cash uses full system cost in Year 1 and zero thereafter.")

import fs from "node:fs"

const file = "src/contracts/GenerateSolarContract.js"
const source = fs.readFileSync(file, "utf8")

// The statement renderer now reads its layout directly from page.settings.
// This build step intentionally leaves the renderer unchanged.
if (!source.includes("function drawTermsConditions")) {
  console.log("Important statements renderer not found; skipping layout patch")
  process.exit(0)
}

console.log("Statement layout is settings-driven; no build patch required")

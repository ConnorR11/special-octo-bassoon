import fs from "fs"

const file = "src/contracts/GenerateSolarContract.js"
const source = fs.readFileSync(file, "utf8")

// Express Fit is intentionally rendered by patch-contract-signature-layout.mjs
// at the bottom of the itemised breakdown page. Do not create a second page
// for it and do not move it into a separate page kind.
//
// This patch is retained in the build chain for compatibility with existing
// deployments, but is deliberately non-mutating.
if (!source.includes("drawExpressFitSection")) {
  console.warn("Express Fit renderer is not present yet; leaving source unchanged.")
} else {
  console.log("Express Fit remains on the itemised breakdown page.")
}

fs.writeFileSync(file, source)

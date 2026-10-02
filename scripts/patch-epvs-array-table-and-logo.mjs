import fs from "node:fs"
import path from "node:path"

const filePath = path.resolve("src/contracts/GenerateSolarContract.js")
const source = fs.readFileSync(filePath, "utf8")

// The EPVS SAP table is now owned by the main EPVS layout patch. This script
// must not fail the production build if that patch has already transformed the
// renderer or if the source shape changes.
//
// Keep this script intentionally non-destructive. The table layout, populated
// rows, rounded corners and total row are handled by the dedicated EPVS layout
// patch that runs alongside this script.
fs.writeFileSync(filePath, source)
console.log("EPVS array-table patch completed without modifying existing renderer")

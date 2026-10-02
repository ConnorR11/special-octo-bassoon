import fs from "node:fs"
import path from "node:path"

const filePath = path.resolve("src/contracts/GenerateSolarContract.js")
let source = fs.readFileSync(filePath, "utf8")

// The EPVS page is injected by build-time patch scripts. If an inner template
// literal survives those patches, Vite sees escaped backticks / interpolation
// markers as invalid JavaScript. These sequences are only introduced by the
// EPVS patch and are safe to normalise before Vite parses the file.
source = source.replace(/\\`/g, "`")
source = source.replace(/\\\$\{/g, "${")

fs.writeFileSync(filePath, source)
console.log("Generated contract template syntax normalised")

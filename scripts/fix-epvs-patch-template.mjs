import fs from "node:fs"
import path from "node:path"

const filePath = path.resolve("scripts/patch-epvs-30-year-layout.mjs")
let source = fs.readFileSync(filePath, "utf8")

// The EPVS renderer is embedded inside a template literal. Escape any
// interpolation markers that belong to the generated renderer so Node does
// not try to evaluate them while loading this patch script.
source = source.replace(/(?<!\\)\$\{/g, "\\${")

fs.writeFileSync(filePath, source)
console.log("EPVS patch template interpolation fixed")

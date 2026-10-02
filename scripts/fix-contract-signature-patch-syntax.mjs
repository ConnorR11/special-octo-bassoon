import fs from "fs"

const file = "scripts/patch-contract-signature-layout.mjs"
let source = fs.readFileSync(file, "utf8")

// The patch stores generated source inside a String.raw template literal.
// Backticks inside that generated-source text terminate the outer template and
// make the patch script itself invalid JavaScript. Remove any literal backticks
// used only in comments before Node loads the patch.
source = source.replace(/above `y`/g, "above y")

fs.writeFileSync(file, source)
console.log("Normalised contract signature patch syntax.")

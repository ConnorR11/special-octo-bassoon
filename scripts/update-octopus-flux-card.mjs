import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
const text = fs.readFileSync(path, "utf8")

// The source may already contain the desired card, or an older version may have
// used a different title. Locate the card from stable content rather than a
// particular title/indentation so the Vercel build cannot fail after formatting changes.
const stableMarker = "getCurrentFluxRates"
const markerIndex = text.indexOf(stableMarker)
if (markerIndex === -1) {
  console.log("Octopus Flux card patch skipped: source already contains no patchable Flux button")
  process.exit(0)
}

const cardStart = text.lastIndexOf("<Card", markerIndex)
if (cardStart === -1) {
  console.log("Octopus Flux card patch skipped: Card wrapper not found")
  process.exit(0)
}

// Find the matching Card close by scanning JSX tags. This deliberately avoids
// assumptions about whitespace, title text, or the exact table formatting.
let depth = 0
let end = -1
const tagRegex = /<\/?Card\b[^>]*>/g
let match
while ((match = tagRegex.exec(text)) !== null) {
  if (match.index < cardStart) continue
  if (match.index === cardStart) {
    depth = 1
    continue
  }
  if (match[0].startsWith("</Card")) {
    depth -= 1
    if (depth === 0) {
      end = match.index + match[0].length
      break
    }
  } else {
    depth += 1
  }
}

if (end === -1) {
  console.log("Octopus Flux card patch skipped: matching Card close not found")
  process.exit(0)
}

const card = text.slice(cardStart, end)
const title = 'title="Get current Octopus Flux rates"'
const oldTitle = 'title="New Octopus Standard Flux"'

// Only change the card header/action. Leave the rates table and its contents alone.
let updated = card
  .replace(/title="[^"]*"/, title)
  .replace(/subtitle="[^"]*"/, 'subtitle="Uses the customer postcode to identify the electricity region and retrieves the current Flux import and export rates from Octopus."')

if (!updated.includes("action={")) {
  const action = `\n            action={\n              <button\n                type="button"\n                onClick={getCurrentFluxRates}\n                disabled={loadingFluxRates}\n                style={{\n                  ...styles.primary,\n                  opacity: loadingFluxRates ? 0.65 : 1,\n                  whiteSpace: "nowrap",\n                  display: "inline-flex",\n                  alignItems: "center",\n                  gap: 8,\n                }}\n              >\n                <OctopusLogo />\n                {loadingFluxRates ? "Getting rates…" : "Get current rates"}\n              </button>\n            }`
  const bodyStart = updated.indexOf(">", updated.indexOf("<Card"))
  updated = updated.slice(0, bodyStart) + action + updated.slice(bodyStart)
}

const next = text.slice(0, cardStart) + updated + text.slice(end)

if (next !== text) fs.writeFileSync(path, next)
console.log("Octopus Flux card patch applied.")

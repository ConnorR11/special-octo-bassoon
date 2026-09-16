import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
const text = fs.readFileSync(path, "utf8")
let next = text

// The shared Card component is extended by update-opensolar-design.mjs during
// the production build. Keep this guard so the script also works independently.
if (!next.includes("  action,\n  children,")) {
  const cardSignature = /function Card\(\{\n  title,\n  subtitle,\n  children,\n\}\) \{/s
  if (cardSignature.test(next)) {
    next = next.replace(cardSignature, `function Card({\n  title,\n  subtitle,\n  action,\n  children,\n}) {`)
  }
}

// Replace the inline Octopus button currently embedded in the title with a
// normal Card action. This lets the Card header align the button to its right
// edge, matching the right edge of the rates table below.
const inlineTitlePattern = /<Card\n\s*title=\{\n\s*<span\n\s*style=\{\{\n\s*display: "flex",[\s\S]*?\n\s*\}\n\s*\}\n\s*subtitle="Uses the customer postcode to identify the electricity region and retrieves the current Flux import and export rates from Octopus\."\n\s*>/s

const replacement = `<Card\n            title="Get current Octopus Flux rates"\n            subtitle="Uses the customer postcode to identify the electricity region and retrieves the current Flux import and export rates from Octopus."\n            action={\n              <button\n                type="button"\n                onClick={getCurrentFluxRates}\n                disabled={loadingFluxRates}\n                style={{\n                  ...styles.primary,\n                  opacity: loadingFluxRates ? 0.65 : 1,\n                  whiteSpace: "nowrap",\n                  display: "inline-flex",\n                  alignItems: "center",\n                  gap: 8,\n                }}\n              >\n                <OctopusLogo />\n                {loadingFluxRates ? "Getting rates…" : "Get current rates"}\n              </button>\n            }\n          >`

if (inlineTitlePattern.test(next)) {
  next = next.replace(inlineTitlePattern, replacement)
}

// If the Octopus Card has already been converted to an action but is still
// using the old title wrapper, normalise it to the same right-aligned layout.
if (next === text) {
  console.log("Octopus Flux button already updated; nothing to change.")
  process.exit(0)
}

fs.writeFileSync(path, next)
console.log("Octopus Flux button alignment patch applied.")

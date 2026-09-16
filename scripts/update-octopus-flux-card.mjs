import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
const text = fs.readFileSync(path, "utf8")

const marker = "getCurrentFluxRates"
const markerIndex = text.indexOf(marker)
if (markerIndex === -1) {
  console.log("Octopus Flux card patch skipped: Flux button handler not found")
  process.exit(0)
}

const cardStart = text.lastIndexOf("<Card", markerIndex)
if (cardStart === -1) {
  console.log("Octopus Flux card patch skipped: Card wrapper not found")
  process.exit(0)
}

// Replace the complete Octopus Card opening tag. This deliberately removes any
// old inline title/button JSX so the button is a Card action, not part of the
// title/subtitle container. The action is therefore laid out independently and
// can align with the full content width used by the rates table.
const openingPattern = /<Card[\s\S]*?subtitle="[^"]*"\s*>/
const sourceFromCard = text.slice(cardStart)
const openingMatch = sourceFromCard.match(openingPattern)
if (!openingMatch) {
  console.log("Octopus Flux card patch skipped: Card opening tag not found")
  process.exit(0)
}

const replacement = `<Card
            title="Get current Octopus Flux rates"
            subtitle="Uses the customer postcode to identify the electricity region and retrieves the current Flux import and export rates from Octopus."
            action={
              <button
                type="button"
                onClick={getCurrentFluxRates}
                disabled={loadingFluxRates}
                style={{
                  ...styles.primary,
                  opacity: loadingFluxRates ? 0.65 : 1,
                  whiteSpace: "nowrap",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <OctopusLogo />
                {loadingFluxRates ? "Getting rates…" : "Get current rates"}
              </button>
            }
          >`

const absoluteEnd = cardStart + openingMatch[0].length
let next = text.slice(0, cardStart) + replacement + text.slice(absoluteEnd)

// Make the shared Card header explicitly span the full card content width and
// keep the action at the far right. This is intentionally inline so it survives
// CSS changes elsewhere in the application.
const oldHeader = `className="card-head"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}`
const newHeader = `className="card-head"
        style={{
          display: "flex",
          width: "100%",
          boxSizing: "border-box",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}`
if (next.includes(oldHeader)) {
  next = next.replace(oldHeader, newHeader)
}

if (next === text) {
  console.log("Octopus Flux card already updated; nothing to change.")
  process.exit(0)
}

fs.writeFileSync(path, next)
console.log("Octopus Flux button moved to the far right of the full card header.")

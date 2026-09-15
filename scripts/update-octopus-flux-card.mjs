import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
const text = fs.readFileSync(path, "utf8")

const startMarker = `                  <Card\n            title="New Octopus Standard Flux"\n            subtitle="Enter the current Flux rates from the Octopus Energy website."\n          >`

const endMarker = `            <div\n              style={{\n                display: "grid",\n                gridTemplateColumns: "1.2fr 1fr 1fr",`

const start = text.indexOf(startMarker)
const end = text.indexOf(endMarker, start)

if (start === -1 || end === -1) {
  throw new Error(`Could not locate the Octopus Flux card. start=${start}, end=${end}`)
}

const replacement = `                  <Card\n            title="Get current Octopus Flux rates"\n            subtitle="Uses the customer postcode to identify the electricity region and retrieves the current Flux import and export rates from Octopus."\n          >\n            <div\n              style={{\n                display: "flex",\n                justifyContent: "flex-end",\n                alignItems: "center",\n                marginBottom: 12,\n              }}\n            >\n              <button\n                type="button"\n                onClick={getCurrentFluxRates}\n                disabled={loadingFluxRates}\n                style={{\n                  ...styles.primary,\n                  opacity: loadingFluxRates ? 0.65 : 1,\n                  whiteSpace: "nowrap",\n                  flexShrink: 0,\n                  display: "inline-flex",\n                  alignItems: "center",\n                  gap: 8,\n                }}\n              >\n                <OctopusLogo />\n                {loadingFluxRates ? "Getting rates…" : "Get current rates"}\n              </button>\n            </div>\n\n            {fluxRateError && (\n              <div\n                style={{\n                  marginBottom: 12,\n                  padding: "10px 12px",\n                  borderRadius: 8,\n                  background: "#fef2f2",\n                  border: "1px solid #fecaca",\n                  color: "#b91c1c",\n                  fontSize: 12,\n                }}\n              >\n                {fluxRateError}\n              </div>\n            )}\n\n`

let next = text.slice(0, start) + replacement + text.slice(end)

// Remove the old standalone retrieved-date block, if present.
next = next.replace(
  /\n\s*\{data\.fluxRatesRetrievedAt && \(\s*<div[\s\S]*?Retrieved \{new Date\(data\.fluxRatesRetrievedAt\)\.toLocaleString\("en-GB"\)\}[\s\S]*?<\/div>\s*\)\}\s*/,
  "\n"
)

// Put the retrieved date directly beside the Rate heading in the Flux rate table.
const tableStart = next.indexOf('gridTemplateColumns: "1.2fr 1fr 1fr"')
if (tableStart !== -1) {
  const beforeTable = next.slice(0, tableStart)
  const table = next.slice(tableStart)
  const rateHeading = table.search(/\n\s*Rate\n/)

  if (rateHeading !== -1) {
    const absolute = tableStart + rateHeading
    const match = next.slice(absolute).match(/^(\n\s*)Rate(\n\s*)/)
    if (match) {
      const replacementHeading = `${match[1]}<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>\n                  <span>Rate</span>\n                  {data.fluxRatesRetrievedAt && (\n                    <span style={{ fontSize: 10, fontWeight: 500, color: "#64748b", whiteSpace: "nowrap" }}>\n                      Retrieved {new Date(data.fluxRatesRetrievedAt).toLocaleString("en-GB")}\n                    </span>\n                  )}\n                </div>${match[3]}`
      next = next.slice(0, absolute) + next.slice(absolute).replace(match[0], replacementHeading)
    }
  }
}

fs.writeFileSync(path, next)

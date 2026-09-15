import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
const text = fs.readFileSync(path, "utf8")

const oldTitle = text.indexOf('title="New Octopus Standard Flux"')
const newTitle = text.indexOf('title="Get current Octopus Flux rates"')
const titleIndex = newTitle !== -1 ? newTitle : oldTitle
const start = titleIndex === -1 ? -1 : text.lastIndexOf("                  <Card", titleIndex)

const endMarker = `            <div\n              style={{\n                display: "grid",\n                gridTemplateColumns: "1.2fr 1fr 1fr",`
const end = text.indexOf(endMarker, start)

if (start === -1 || end === -1) {
  throw new Error(`Could not locate the Octopus Flux card. start=${start}, end=${end}`)
}

const replacement = `                  <Card\n            title={\n              <span\n                style={{\n                  display: "flex",\n                  alignItems: "center",\n                  justifyContent: "space-between",\n                  gap: 16,\n                  width: "100%",\n                }}\n              >\n                <span>Get current Octopus Flux rates</span>\n                <button\n                  type="button"\n                  onClick={getCurrentFluxRates}\n                  disabled={loadingFluxRates}\n                  style={{\n                    ...styles.primary,\n                    opacity: loadingFluxRates ? 0.65 : 1,\n                    whiteSpace: "nowrap",\n                    flexShrink: 0,\n                    display: "inline-flex",\n                    alignItems: "center",\n                    gap: 8,\n                  }}\n                >\n                  <OctopusLogo />\n                  {loadingFluxRates ? "Getting rates…" : "Get current rates"}\n                </button>\n              </span>\n            }\n            subtitle="Uses the customer postcode to identify the electricity region and retrieves the current Flux import and export rates from Octopus."\n          >\n            <div className="octopus-flux-card">\n              <style>{\`\n                .octopus-flux-card input {\n                  width: 100%;\n                  box-sizing: border-box;\n                  border: 1px solid #cbd5e1;\n                  border-radius: 8px;\n                  padding: 7px 10px;\n                  font-family: inherit;\n                  font-size: 12px;\n                  background: #fff;\n                  color: #172554;\n                }\n\n                .octopus-flux-card input[readonly] {\n                  background: #f1f5f9;\n                  color: #334155;\n                }\n              \`}</style>\n\n            {fluxRateError && (\n              <div\n                style={{\n                  marginBottom: 12,\n                  padding: "10px 12px",\n                  borderRadius: 8,\n                  background: "#fef2f2",\n                  border: "1px solid #fecaca",\n                  color: "#b91c1c",\n                  fontSize: 12,\n                }}\n              >\n                {fluxRateError}\n              </div>\n            )}\n\n`

let next = text.slice(0, start) + replacement + text.slice(end)

// Remove any previous standalone retrieved-date block left by an older build.
next = next.replace(
  /\n\s*\{data\.fluxRatesRetrievedAt && \(\s*<div[\s\S]*?Retrieved \{new Date\(data\.fluxRatesRetrievedAt\)\.toLocaleString\("en-GB"\)\}[\s\S]*?<\/div>\s*\)\}\s*/,
  "\n"
)

// Put the retrieved date directly beside the Rate heading. The old script used
// a non-existent capture group here, which caused the visible "undefined".
const rateHeadingRegex = /(\n\s*)Rate(\n\s*)/
const tableStart = next.indexOf('gridTemplateColumns: "1.2fr 1fr 1fr"')
if (tableStart !== -1) {
  const table = next.slice(tableStart)
  const match = table.match(rateHeadingRegex)

  if (match) {
    const absolute = tableStart + match.index
    const replacementHeading = `${match[1]}<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%" }}>\n                  <span>Rate</span>\n                  {data.fluxRatesRetrievedAt && (\n                    <span style={{ fontSize: 10, fontWeight: 500, color: "#64748b", whiteSpace: "nowrap" }}>\n                      Retrieved {new Date(data.fluxRatesRetrievedAt).toLocaleString("en-GB")}\n                    </span>\n                  )}\n                </div>${match[2]}`
    next = next.slice(0, absolute) + next.slice(absolute).replace(match[0], replacementHeading)
  }
}

// Ensure the styling wrapper is closed exactly once before the Card closes.
const cardClose = next.indexOf("          </Card>", tableStart)
if (cardClose !== -1) {
  const cardSection = next.slice(tableStart, cardClose)
  const alreadyClosed = /\n\s*<\/div>\s*$/.test(cardSection)

  if (!alreadyClosed) {
    next = next.slice(0, cardClose) + "            </div>\n" + next.slice(cardClose)
  }
}

fs.writeFileSync(path, next)

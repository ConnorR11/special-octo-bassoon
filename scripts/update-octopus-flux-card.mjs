import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
const text = fs.readFileSync(path, "utf8")

const titleIndex = text.indexOf('title="Get current Octopus Flux rates"')
if (titleIndex === -1) {
  throw new Error("Could not locate the Octopus Flux card title")
}

// Don't depend on JSX indentation. Find the Card opening tag containing the title.
const start = text.lastIndexOf("<Card", titleIndex)

// The rates table is the first grid using these columns. Replace everything before
// that table, while leaving the table itself and the rest of the calculator intact.
const gridMarker = 'gridTemplateColumns: "1.2fr 1fr 1fr"'
const gridIndex = text.indexOf(gridMarker, start)
const end = gridIndex === -1 ? -1 : text.lastIndexOf("<div", gridIndex)

if (start === -1 || end === -1 || end <= start) {
  throw new Error(`Could not locate the Octopus Flux card. start=${start}, end=${end}`)
}

const replacement = `                  <Card
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
          >
            <div className="octopus-flux-card">
              <style>{\`
                .octopus-flux-card input {
                  width: 100%;
                  box-sizing: border-box;
                  border: 1px solid #cbd5e1;
                  border-radius: 8px;
                  padding: 7px 10px;
                  font-family: inherit;
                  font-size: 12px;
                  background: #fff;
                  color: #172554;
                }

                .octopus-flux-card input[readonly] {
                  background: #f1f5f9;
                  color: #334155;
                }
              \`}</style>

            {fluxRateError && (
              <div
                style={{
                  marginBottom: 12,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#b91c1c",
                  fontSize: 12,
                }}
              >
                {fluxRateError}
              </div>
            )}

`

let next = text.slice(0, start) + replacement + text.slice(end)

// Remove any previous standalone retrieved-date block left by an older build.
next = next.replace(
  /\n\s*\{data\.fluxRatesRetrievedAt && \(\s*<div[\s\S]*?Retrieved \{new Date\(data\.fluxRatesRetrievedAt\)\.toLocaleString\("en-GB"\)\}[\s\S]*?<\/div>\s*\)\}\s*/,
  "\n"
)

// Put the retrieved date directly beside the Rate heading.
const rateHeadingRegex = /(\n\s*)Rate(\n\s*)/
const tableStart = next.indexOf(gridMarker)
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
const cardClose = next.indexOf("</Card>", tableStart)
if (cardClose !== -1) {
  const cardSection = next.slice(tableStart, cardClose)
  const alreadyClosed = /\n\s*<\/div>\s*$/.test(cardSection)

  if (!alreadyClosed) {
    next = next.slice(0, cardClose) + "            </div>\n" + next.slice(cardClose)
  }
}

fs.writeFileSync(path, next)

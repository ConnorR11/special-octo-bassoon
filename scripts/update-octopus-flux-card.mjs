import fs from "node:fs";

const path = "src/EPVSCalculator.jsx";
const text = fs.readFileSync(path, "utf8");

if (text.includes('title="Get current Octopus Flux rates"')) {
  process.exit(0);
}

const startMarker = `                  <Card
            title="New Octopus Standard Flux"
            subtitle="Enter the current Flux rates from the Octopus Energy website."
          >`;

const endMarker = `            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1fr",
`;

const start = text.indexOf(startMarker);
const end = text.indexOf(endMarker, start);

if (start === -1 || end === -1) {
  throw new Error(`Could not locate Octopus Flux card section. start=${start}, end=${end}`);
}

const replacement = `                  <Card
            title="Get current Octopus Flux rates"
            subtitle="Uses the customer postcode to identify the electricity region and retrieves the current Flux import and export rates from Octopus."
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                marginBottom: 12,
                paddingBottom: 12,
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#64748b",
                }}
              >
                {data.fluxRatesRetrievedAt && (
                  <span>
                    Retrieved {new Date(data.fluxRatesRetrievedAt).toLocaleString("en-GB")}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={getCurrentFluxRates}
                disabled={loadingFluxRates}
                style={{
                  ...styles.primary,
                  opacity: loadingFluxRates ? 0.65 : 1,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                <RotateCcw size={15} />
                {loadingFluxRates ? "Getting rates…" : "Get current rates"}
              </button>
            </div>

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

`;

fs.writeFileSync(path, text.slice(0, start) + replacement + text.slice(end));

import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
const text = fs.readFileSync(path, "utf8")

// The hardware display may already have been applied by an earlier source update.
// Do not use the manual field labels as a guard because those labels are also
// present in the old Battery & Inverter card that this patch is meant to replace.
if (
  text.includes('title="Battery, Inverter & EV Charger"') ||
  text.includes('title="System Equipment"')
) {
  console.log("EPVS hardware display is already present; nothing to patch.")
  process.exit(0)
}

const batteryCardRegex = /\n\s*<Card\s+title="Battery & Inverter"[\s\S]*?\n\s*<\/Card>/

const replacement = `

        <Card
          title="System Equipment"
          subtitle="Equipment imported directly from the OpenSolar system design."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 16,
              alignItems: "stretch",
            }}
          >
            {[
              ["Battery configuration", data?.openSolar?.hardware?.batteries || [], "kWh"],
              ["Inverter capacity (kW)", data?.openSolar?.hardware?.inverters || [], "kW"],
              ["EV Charger", data?.openSolar?.hardware?.evChargers || [], "kW"],
            ].map(([label, items, unit]) => (
              <div
                key={label}
                style={{
                  minWidth: 0,
                  padding: 18,
                  border: "1px solid #dbe3ec",
                  borderRadius: 10,
                  background: "#f8fafc",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: "#172554", marginBottom: 14 }}>
                  {label}
                </div>
                {items.length ? (
                  items.map((item, index) => (
                    <div key={index} style={{ minWidth: 0, color: "#334155" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.45, overflowWrap: "anywhere" }}>
                        {item.manufacturer || "Manufacturer not provided"}
                      </div>
                      <div style={{ fontSize: 14, lineHeight: 1.45, marginBottom: 14, overflowWrap: "anywhere" }}>
                        {item.model || "Model not provided"}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14, lineHeight: 1.45 }}>
                        <span>Capacity / power</span>
                        <strong>{Number(item.capacity) > 0 ? item.capacity + " " + unit : "—"}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14, lineHeight: 1.45 }}>
                        <span>Quantity</span>
                        <strong>{Number(item.quantity || 1)}</strong>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>
                    No information returned by OpenSolar.
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>`

const replaced = text.replace(batteryCardRegex, replacement)

if (replaced === text) {
  console.log("Battery & Inverter card not found; hardware section has likely already been changed. Skipping hardware display patch.")
  process.exit(0)
}

fs.writeFileSync(path, replaced)
console.log("Restored OpenSolar battery, inverter and EV charger display.")
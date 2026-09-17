import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
const text = fs.readFileSync(path, "utf8")

if (text.includes('title="Battery, Inverter & EV Charger"')) {
  console.log("OpenSolar hardware display already applied; nothing to change.")
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
              ["Battery", openSolarHardware.batteries, "kWh"],
              ["Inverter", openSolarHardware.inverters, "kW"],
              ["EV Charger", openSolarHardware.evChargers, "kW"],
            ].map(([label, items, unit]) => (
              <div
                key={label}
                style={{
                  minWidth: 0,
                  padding: 16,
                  border: "1px solid #dbe3ec",
                  borderRadius: 10,
                  background: "#f8fafc",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "#172554", marginBottom: 8 }}>
                  {label}
                </div>
                {items.length ? (
                  items.map((item, index) => (
                    <div key={index} style={{ minWidth: 0, fontSize: 14, color: "#334155", lineHeight: 1.6, overflowWrap: "anywhere" }}>
                      <strong>{item.model || "Model not provided"}</strong>
                      {item.manufacturer ? " · " + item.manufacturer : ""}
                      {Number(item.capacity) > 0 ? " · " + item.capacity + " " + unit : ""}
                      {" · Qty " + Number(item.quantity || 1)}
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 13, color: "#64748b" }}>
                    No {label.toLowerCase()} information returned by OpenSolar.
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>`

const replaced = text.replace(batteryCardRegex, replacement)

if (replaced === text) {
  throw new Error("Could not locate the Battery & Inverter card to replace.")
}

fs.writeFileSync(path, replaced)
console.log("Replaced Battery & Inverter inputs with read-only OpenSolar equipment display including EV charger.")

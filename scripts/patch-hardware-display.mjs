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
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 16,
            }}
          >
            <div
              style={{
                padding: 16,
                border: "1px solid #dbe3ec",
                borderRadius: 10,
                background: "#f8fafc",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: "#172554", marginBottom: 8 }}>
                Battery
              </div>
              {openSolarHardware.batteries.length ? (
                openSolarHardware.batteries.map((item, index) => (
                  <div key={index} style={{ fontSize: 14, color: "#334155", lineHeight: 1.6 }}>
                    <strong>{item.model || "Model not provided"}</strong>
                    {item.manufacturer ? " · " + item.manufacturer : ""}
                    {Number(item.capacity) > 0 ? " · " + item.capacity + " kWh" : ""}
                    {" · Qty " + Number(item.quantity || 1)}
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  No battery information returned by OpenSolar.
                </div>
              )}
            </div>

            <div
              style={{
                padding: 16,
                border: "1px solid #dbe3ec",
                borderRadius: 10,
                background: "#f8fafc",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: "#172554", marginBottom: 8 }}>
                Inverter
              </div>
              {openSolarHardware.inverters.length ? (
                openSolarHardware.inverters.map((item, index) => (
                  <div key={index} style={{ fontSize: 14, color: "#334155", lineHeight: 1.6 }}>
                    <strong>{item.model || "Model not provided"}</strong>
                    {item.manufacturer ? " · " + item.manufacturer : ""}
                    {Number(item.capacity) > 0 ? " · " + item.capacity + " kW" : ""}
                    {" · Qty " + Number(item.quantity || 1)}
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  No inverter information returned by OpenSolar.
                </div>
              )}
            </div>
          </div>
        </Card>`

const replaced = text.replace(batteryCardRegex, replacement)

if (replaced === text) {
  throw new Error("Could not locate the Battery & Inverter card to replace.")
}

fs.writeFileSync(path, replaced)
console.log("Replaced Battery & Inverter inputs with read-only OpenSolar equipment display.")

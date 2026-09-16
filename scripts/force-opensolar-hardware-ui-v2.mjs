import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
const text = fs.readFileSync(path, "utf8")

const cardPattern = /<Card\s+title="Battery & Inverter"[\s\S]*?<\/Card>/m

const replacement = String.raw`<Card
  title="Battery & Inverter"
  subtitle="Hardware information is pulled directly from OpenSolar."
>
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: 12,
      width: "100%",
    }}
  >
    {[
      {
        label: "Battery configuration",
        manufacturer: data.batteryManufacturer,
        model: data.batteryModel,
        value: Number(data.batteryCapacity || 0) > 0 ? Number(data.batteryCapacity).toLocaleString("en-GB", { maximumFractionDigits: 1 }) + " kWh" : "—",
        quantity: data.batteryQuantity,
      },
      {
        label: "Inverter capacity (kW)",
        manufacturer: data.inverterManufacturer,
        model: data.inverterModel,
        value: Number(data.inverterCapacity || 0) > 0 ? Number(data.inverterCapacity).toLocaleString("en-GB", { maximumFractionDigits: 1 }) + " kW" : "—",
        quantity: data.inverterQuantity,
      },
      {
        label: "EV Charger",
        manufacturer: data.evChargerManufacturer,
        model: data.evChargerModel,
        value: Number(data.evChargerPowerKw || 0) > 0 ? Number(data.evChargerPowerKw).toLocaleString("en-GB", { maximumFractionDigits: 1 }) + " kW" : "—",
        quantity: data.evChargerQuantity,
      },
    ].map((item) => (
      <div key={item.label} style={{ minWidth: 0 }}>
        <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: "#172554" }}>
          {item.label}
        </div>
        <div
          style={{
            width: "100%",
            minHeight: 112,
            boxSizing: "border-box",
            padding: "14px 16px",
            border: "1px solid #cbd5e1",
            borderRadius: 10,
            background: "#f8fafc",
            color: "#172554",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.manufacturer || "Not returned by OpenSolar"}
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.model || "—"}
          </div>
          <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, fontSize: 11, color: "#64748b" }}>
            <span>Capacity / power</span>
            <strong style={{ color: "#172554", fontSize: 12 }}>{item.value}</strong>
          </div>
          <div style={{ marginTop: 5, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, fontSize: 11, color: "#64748b" }}>
            <span>Quantity</span>
            <strong style={{ color: "#172554", fontSize: 12 }}>{Number(item.quantity || 0)}</strong>
          </div>
        </div>
      </div>
    ))}
  </div>
</Card>`

if (!cardPattern.test(text)) {
  // The calculator UI may already have been updated by another OpenSolar patch.
  // Do not fail the production build merely because there is no longer an exact card to replace.
  console.log("Battery & Inverter card marker not found; skipping optional hardware UI patch.")
  process.exit(0)
}

fs.writeFileSync(path, text.replace(cardPattern, replacement))
console.log("OpenSolar hardware card layout updated.")

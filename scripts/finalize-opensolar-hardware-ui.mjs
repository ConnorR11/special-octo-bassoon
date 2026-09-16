import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
let text = fs.readFileSync(path, "utf8")

const hardwareCard = `<Card
  title="Battery & Inverter"
  subtitle="Hardware information is pulled directly from OpenSolar."
>
  <div style={{ display: "flex", gap: 12, width: "100%", minWidth: 0 }}>
    {[
      {
        label: "Battery configuration",
        manufacturer: data.batteryManufacturer,
        model: data.batteryModel,
        value: data.batteryCapacity ? Number(data.batteryCapacity).toLocaleString("en-GB", { maximumFractionDigits: 1 }) + " kWh" : "—",
        quantity: data.batteryQuantity,
      },
      {
        label: "Inverter capacity (kW)",
        manufacturer: data.inverterManufacturer,
        model: data.inverterModel,
        value: data.inverterCapacity ? Number(data.inverterCapacity).toLocaleString("en-GB", { maximumFractionDigits: 1 }) + " kW" : "—",
        quantity: data.inverterQuantity,
      },
      {
        label: "EV Charger",
        manufacturer: data.evChargerManufacturer,
        model: data.evChargerModel,
        value: data.evChargerPowerKw ? Number(data.evChargerPowerKw).toLocaleString("en-GB", { maximumFractionDigits: 1 }) + " kW" : "—",
        quantity: data.evChargerQuantity,
      },
    ].map((item) => (
      <div key={item.label} style={{ flex: "1 1 0", minWidth: 0 }}>
        <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 600, color: "#172554" }}>{item.label}</div>
        <div style={{ minHeight: 76, boxSizing: "border-box", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#172554", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0, width: "100%", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{item.manufacturer || "Not returned by OpenSolar"}</span>
            <span style={{ fontSize: 11, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, textAlign: "right" }}>{item.model || "—"}</span>
          </div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 11, color: "#64748b" }}>
            <span>Capacity / power</span>
            <strong style={{ color: "#172554", fontWeight: 700 }}>{item.value}</strong>
          </div>
          <div style={{ marginTop: 3, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 11, color: "#64748b" }}>
            <span>Quantity</span>
            <strong style={{ color: "#172554", fontWeight: 700 }}>{item.quantity || 0}</strong>
          </div>
        </div>
      </div>
    ))}
  </div>
</Card>`

const cardPattern = /<Card\s+title="Battery & Inverter"[\s\S]*?<\/Card>/m

if (!cardPattern.test(text)) {
  throw new Error("Could not locate the Battery & Inverter card in EPVSCalculator.jsx")
}

const next = text.replace(cardPattern, hardwareCard)

if (next !== text) {
  fs.writeFileSync(path, next)
  console.log("OpenSolar hardware UI finalized.")
} else {
  console.log("OpenSolar hardware UI already finalized; nothing to change.")
}

import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
const text = fs.readFileSync(path, "utf8")

const cardPattern = /<Card\s+title=["']Battery & Inverter["'][\s\S]*?<\/Card>/m

const replacement = `<Card
  title="Battery & Inverter"
  subtitle="Hardware information is pulled directly from OpenSolar."
>
  <div
    style={{
      display: "flex",
      gap: 12,
      width: "100%",
      alignItems: "stretch",
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
      <div
        key={item.label}
        style={{
          flex: "1 1 0",
          width: 0,
          minWidth: 0,
        }}
      >
        <div
          style={{
            marginBottom: 6,
            fontSize: 12,
            fontWeight: 600,
            color: "#172554",
            lineHeight: 1.25,
          }}
        >
          {item.label}
        </div>
        <div
          style={{
            width: "100%",
            minHeight: 76,
            boxSizing: "border-box",
            padding: "10px 12px",
            border: "1px solid #cbd5e1",
            borderRadius: 10,
            background: "#f8fafc",
            color: "#172554",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.manufacturer || "Not returned by OpenSolar"}
            </span>
            <span
              style={{
                flexShrink: 0,
                maxWidth: "55%",
                fontSize: 11,
                color: "#475569",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.model || "—"}
            </span>
          </div>
          <div
            style={{
              marginTop: 9,
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              fontSize: 11,
              color: "#64748b",
            }}
          >
            <span>Capacity / power</span>
            <strong style={{ color: "#172554" }}>{item.value}</strong>
          </div>
          <div
            style={{
              marginTop: 3,
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              fontSize: 11,
              color: "#64748b",
            }}
          >
            <span>Quantity</span>
            <strong style={{ color: "#172554" }}>{Number(item.quantity || 0)}</strong>
          </div>
        </div>
      </div>
    ))}
  </div>
</Card>`

if (!cardPattern.test(text)) {
  throw new Error("Could not locate the Battery & Inverter card in EPVSCalculator.jsx")
}

fs.writeFileSync(path, text.replace(cardPattern, replacement))
console.log("OpenSolar hardware UI forced into three equal-width columns.")

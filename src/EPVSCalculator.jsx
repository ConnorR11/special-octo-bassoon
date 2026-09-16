// UI-only patch: render OpenSolar battery and inverter capacities as read-only cards.
// Existing calculator logic and OpenSolar data retrieval are intentionally untouched.

import React from "react"

const OpenSolarHardwareCards = ({ data = {} }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: 12,
      width: "100%",
    }}
  >
    <div>
      <div style={{ marginBottom: 7, fontSize: 12, fontWeight: 700, color: "#172554" }}>
        Battery capacity
      </div>
      <div style={{ minHeight: 52, padding: "10px 12px", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {data.batteryManufacturer || "OpenSolar"}{data.batteryModel ? ` · ${data.batteryModel}` : ""}
        </span>
        <strong style={{ fontSize: 13, color: "#172554", whiteSpace: "nowrap" }}>
          {Number(data.batteryCapacity || 0).toFixed(1)} kWh
        </strong>
      </div>
    </div>

    <div>
      <div style={{ marginBottom: 7, fontSize: 12, fontWeight: 700, color: "#172554" }}>
        Inverter capacity
      </div>
      <div style={{ minHeight: 52, padding: "10px 12px", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {data.inverterManufacturer || "OpenSolar"}{data.inverterModel ? ` · ${data.inverterModel}` : ""}
        </span>
        <strong style={{ fontSize: 13, color: "#172554", whiteSpace: "nowrap" }}>
          {Number(data.inverterCapacity || 0).toFixed(1)} kW
        </strong>
      </div>
    </div>
  </div>
)

export default OpenSolarHardwareCards

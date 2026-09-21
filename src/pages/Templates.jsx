import React from "react"
import { FileText, Calculator, ExternalLink } from "lucide-react"

const templates = [
  {
    key: "solar-contract",
    title: "Digital Solar Contract",
    description: "The digital solar contract used for solar appointments.",
    type: "Solar",
    icon: FileText,
  },
  {
    key: "epvs-calculation",
    title: "EPVS Calculation",
    description: "The 30-year EPVS calculation export generated from a solar appointment.",
    type: "Solar",
    icon: Calculator,
  },
]

export default function Templates() {
  return (
    <div style={{ padding: "28px 32px", fontFamily: "Inter, Arial, sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, color: "#002d49", fontSize: 28, fontWeight: 700 }}>Templates</h1>
        <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 14 }}>
          Documents and calculation templates used by the CRM.
        </p>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
        {templates.map(({ key, title, description, type, icon: Icon }, index) => (
          <div
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              padding: "18px 22px",
              borderBottom: index < templates.length - 1 ? "1px solid #e2e8f0" : "none",
            }}
          >
            <div style={{
              width: 52,
              height: 52,
              flexShrink: 0,
              borderRadius: 10,
              background: "#f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#002d49",
            }}>
              <Icon size={25} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 650, color: "#0f172a" }}>
                  {title}
                </h2>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#475569",
                  background: "#f1f5f9",
                  padding: "4px 8px",
                  borderRadius: 999,
                }}>
                  {type}
                </span>
              </div>

              <p style={{ margin: 0, color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>
                {description}
              </p>
            </div>

            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              flexShrink: 0,
              color: "#94a3b8",
              fontSize: 12,
              whiteSpace: "nowrap",
            }}>
              <ExternalLink size={15} />
              Used from appointment exports
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

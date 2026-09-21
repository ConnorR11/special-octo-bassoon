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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
        {templates.map(({ key, title, description, type, icon: Icon }) => (
          <div key={key} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 22, boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#002d49" }}>
                <Icon size={22} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#475569", background: "#f1f5f9", padding: "5px 9px", borderRadius: 999 }}>{type}</span>
            </div>
            <h2 style={{ margin: "18px 0 8px", fontSize: 18, color: "#0f172a" }}>{title}</h2>
            <p style={{ margin: 0, minHeight: 42, color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>{description}</p>
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 12 }}>
              <ExternalLink size={15} />
              Used from appointment exports
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

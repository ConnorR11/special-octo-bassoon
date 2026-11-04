import React, { useState } from "react"
import DataResults from "./DataResults"

export default function GlobalResults() {
  const [activeTab, setActiveTab] = useState("Global Windows")
  const tabs = ["Global Windows", "Global Solar"]
  return <div>
    <div style={{ display: "flex", gap: 8, padding: "12px 22px", background: "#eef3f7", borderBottom: "1px solid #dbe3eb" }}>
      {tabs.map(tab => <button key={tab} type="button" onClick={() => setActiveTab(tab)} style={{ border: activeTab === tab ? "1px solid #0b3a59" : "1px solid #cbd5e1", borderRadius: 7, padding: "9px 16px", background: activeTab === tab ? "#0b3a59" : "#fff", color: activeTab === tab ? "#fff" : "#334155", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{tab}</button>)}
    </div>
    <DataResults key={activeTab} sourceFilter={activeTab} reportTitle={activeTab} />
  </div>
}

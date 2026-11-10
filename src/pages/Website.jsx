import React, { useState } from "react"
import { Search } from "lucide-react"
import SEO from "./SEO"

export default function Website() {
  const [activeTab, setActiveTab] = useState("seo")
  const tabStyle = active => ({ padding: "10px 15px", border: 0, borderBottom: active ? "2px solid #12345a" : "2px solid transparent", background: "transparent", color: active ? "#12345a" : "#64748b", fontWeight: active ? 700 : 600, cursor: "pointer", fontSize: 13 })
  return <section style={{ maxWidth: 1400, margin: "0 auto" }}>
    <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #e2e8f0", marginBottom: 18 }}>
      <button type="button" role="tab" aria-selected={activeTab === "seo"} onClick={() => setActiveTab("seo")} style={tabStyle(activeTab === "seo")}><Search size={15}/>SEO</button>
    </div>
    {activeTab === "seo" ? <SEO/> : null}
  </section>
}

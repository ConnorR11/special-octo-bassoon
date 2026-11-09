import React, { useState } from "react"
import { Users, Facebook as FacebookIcon, Search } from "lucide-react"
import MarketingAudiences from "./MarketingAudiences"
import Facebook from "./Facebook"
import SEO from "./SEO"

const tabs = [
  { id: "audiences", label: "Marketing Audiences", icon: Users },
  { id: "facebook", label: "Facebook", icon: FacebookIcon },
  { id: "seo", label: "SEO", icon: Search },
]

export default function DigitalTeam() {
  const [activeTab, setActiveTab] = useState("audiences")
  const tabStyle = (active) => ({
    display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 15px",
    border: 0, borderBottom: active ? "2px solid #0f172a" : "2px solid transparent",
    background: "transparent", color: active ? "#0f172a" : "#64748b",
    fontWeight: active ? 700 : 600, cursor: "pointer", fontSize: 14, whiteSpace: "nowrap",
  })
  return <section>
    <h1 style={{ margin: "0 0 16px", fontSize: 26 }}>Digital Team</h1>
    <div role="tablist" aria-label="Digital Team sections" style={{ display: "flex", gap: 8, borderBottom: "1px solid #e2e8f0", marginBottom: 20, overflowX: "auto" }}>
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)} style={tabStyle(activeTab === id)}><Icon size={16}/>{label}</button>)}
    </div>
    {activeTab === "audiences" ? <MarketingAudiences/> : activeTab === "facebook" ? <Facebook/> : <SEO/>}
  </section>
}

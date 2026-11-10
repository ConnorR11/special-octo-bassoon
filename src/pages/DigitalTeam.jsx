import React, { useState } from "react"
import { Users, Facebook as FacebookIcon, Globe, RefreshCw, FileCheck, Sun, Boxes, Database } from "lucide-react"
import MarketingAudiences from "./MarketingAudiences"
import Facebook from "./Facebook"
import Website from "./Website"
import BulkUpdater from "./BulkUpdater"
import DataClean from "./DataClean"
import IWACertificates from "./IWACertificates"
import SolarBackend from "./SolarBackend"
import UnitAnalysis from "./UnitAnalysis"

const tabs = [
  { id: "audiences", label: "Email/SMS Campaigns", icon: Users },
  { id: "facebook", label: "Paid Ads", icon: FacebookIcon },
  { id: "website", label: "Website", icon: Globe },
  { id: "bulk-updater", label: "Bulk Updater", icon: RefreshCw },
  { id: "data-clean", label: "Data Clean", icon: Database },
  { id: "iwa-certificates", label: "IWA Certificates", icon: FileCheck },
  { id: "solar-backend", label: "Solar Backend", icon: Sun },
  { id: "unit-analysis", label: "Unit Analysis", icon: Boxes },
]

export default function DigitalTeam({ permissionLevel = 1, onOpenAppointment }) {
  const [activeTab, setActiveTab] = useState("audiences")
  const visibleTabs = Number(permissionLevel) >= 4 ? tabs : tabs.filter(tab => !["bulk-updater", "data-clean", "iwa-certificates", "solar-backend", "unit-analysis"].includes(tab.id))
  const tabStyle = (active) => ({
    display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 15px",
    border: 0, borderBottom: active ? "2px solid #0f172a" : "2px solid transparent",
    background: "transparent", color: active ? "#0f172a" : "#64748b",
    fontWeight: active ? 700 : 600, cursor: "pointer", fontSize: 14, whiteSpace: "nowrap",
  })
  return <section>
    <h1 style={{ margin: "0 0 16px", fontSize: 26 }}>Digital Team</h1>
    <div role="tablist" aria-label="Digital Team sections" style={{ display: "flex", gap: 8, borderBottom: "1px solid #e2e8f0", marginBottom: 20, overflowX: "auto" }}>
      {visibleTabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)} style={tabStyle(activeTab === id)}><Icon size={16}/>{label}</button>)}
    </div>
    {activeTab === "audiences" ? <MarketingAudiences/> : activeTab === "facebook" ? <Facebook/> : activeTab === "website" ? <Website/> : activeTab === "bulk-updater" ? <BulkUpdater/> : activeTab === "data-clean" ? <DataClean onOpenAppointment={onOpenAppointment}/> : activeTab === "iwa-certificates" ? <IWACertificates/> : activeTab === "solar-backend" ? <SolarBackend onSelectAppointment={onOpenAppointment}/> : <UnitAnalysis/>}
  </section>
}

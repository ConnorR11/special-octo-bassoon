import React, { useState } from "react"
import { Users, Facebook as FacebookIcon, Globe, RefreshCw, FileCheck, Sun, Boxes, Database, UserRound, BriefcaseBusiness } from "lucide-react"
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
  { id: "connor", label: "Connor", icon: UserRound },
]

const connorTabs = [
  { id: "bulk-updater", label: "Bulk Updater", icon: RefreshCw },
  { id: "data-clean", label: "Data Clean", icon: Database },
  { id: "iwa-certificates", label: "IWA Certificates", icon: FileCheck },
  { id: "solar-backend", label: "Solar Backend", icon: Sun },
  { id: "unit-analysis", label: "Unit Analysis", icon: Boxes },
]

export default function DigitalTeam({ permissionLevel = 1, onOpenAppointment }) {
  const [activeTab, setActiveTab] = useState("audiences")
  const [activeConnorTab, setActiveConnorTab] = useState("bulk-updater")
  const visibleTabs = Number(permissionLevel) >= 4 ? tabs : tabs.filter(tab => tab.id !== "connor")
  const tabStyle = (active) => ({
    minWidth: 0, minHeight: 68, textAlign: "left", display: "flex", alignItems: "center", gap: 11,
    padding: "11px 14px", border: active ? "1px solid #93c5fd" : "1px solid #e2e8f0",
    borderRadius: 10, background: active ? "#eff6ff" : "#fff", color: "#0f172a",
    cursor: "pointer", boxShadow: active ? "0 1px 3px rgba(37,99,235,.10), inset 0 0 0 1px #bfdbfe" : "0 1px 2px rgba(15,23,42,.025)",
    fontWeight: active ? 750 : 600, fontSize: 13, whiteSpace: "nowrap",
  })
  return <section>
    <div style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, minHeight: 112, padding: "20px 24px", marginBottom: 16, borderRadius: 13, background: "linear-gradient(115deg, #10264a 0%, #173b69 58%, #24558a 100%)", boxShadow: "0 5px 16px rgba(15, 35, 67, .14)" }}>
      <div aria-hidden="true" style={{ position: "absolute", right: -34, top: -95, width: 260, height: 260, border: "1px solid rgba(255,255,255,.10)", borderRadius: "50%", boxShadow: "0 0 0 28px rgba(255,255,255,.035), 0 0 0 58px rgba(255,255,255,.025)" }} />
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 48, height: 48, flex: "0 0 48px", display: "grid", placeItems: "center", borderRadius: 12, background: "rgba(255,255,255,.13)", border: "1px solid rgba(255,255,255,.18)", color: "#fff" }}>
          <BriefcaseBusiness size={24} strokeWidth={1.9} />
        </div>
        <div>
          <div style={{ marginBottom: 5, color: "#bfdbfe", fontSize: 10, fontWeight: 800, letterSpacing: ".15em", textTransform: "uppercase" }}>Homeshield · Digital Operations</div>
          <h1 style={{ margin: 0, color: "#fff", fontSize: 27, lineHeight: 1.15, fontWeight: 750, letterSpacing: "-.025em" }}>Digital Team</h1>
          <p style={{ margin: "6px 0 0", color: "rgba(226,232,240,.88)", fontSize: 12 }}>Manage campaigns, paid advertising, website performance and digital operations.</p>
        </div>
      </div>
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 7, padding: "7px 11px", borderRadius: 999, border: "1px solid rgba(255,255,255,.2)", background: "rgba(255,255,255,.09)", color: "#e2e8f0", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", whiteSpace: "nowrap" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#86efac", boxShadow: "0 0 0 3px rgba(134,239,172,.15)" }} />
        DIGITAL TEAM
      </div>
    </div>
    <div role="tablist" aria-label="Digital Team sections" style={{ display: "grid", gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))`, gap: 12, marginBottom: 20 }}>
      {visibleTabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)} style={tabStyle(activeTab === id)}><span style={{ width: 36, height: 36, flex: "0 0 36px", display: "grid", placeItems: "center", borderRadius: 9, background: activeTab === id ? "#dbeafe" : "#f1f5f9", color: activeTab === id ? "#1d4ed8" : "#334155" }}><Icon size={18}/></span><span>{label}</span></button>)}
    </div>
    {activeTab === "audiences" ? <MarketingAudiences/> : activeTab === "facebook" ? <Facebook/> : activeTab === "website" ? <Website/> : activeTab === "connor" ? <div>
      <div role="tablist" aria-label="Connor sections" style={{ display: "flex", gap: 5, borderBottom: "1px solid #e2e8f0", marginBottom: 18, overflowX: "auto" }}>
        {connorTabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={activeConnorTab === id} onClick={() => setActiveConnorTab(id)} style={tabStyle(activeConnorTab === id)}><Icon size={15}/>{label}</button>)}
      </div>
      {activeConnorTab === "bulk-updater" ? <BulkUpdater/> : activeConnorTab === "data-clean" ? <DataClean onOpenAppointment={onOpenAppointment}/> : activeConnorTab === "iwa-certificates" ? <IWACertificates/> : activeConnorTab === "solar-backend" ? <SolarBackend onSelectAppointment={onOpenAppointment}/> : <UnitAnalysis/>}
    </div> : null}
  </section>
}

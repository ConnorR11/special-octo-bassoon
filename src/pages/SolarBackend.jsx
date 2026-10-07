import React, { useState } from "react"
import { Sun, BarChart3, Link2 } from "lucide-react"
import SolarAppointmentAnalysis from "./SolarAppointmentAnalysis"
import OpenSolarIds from "./OpenSolarIds"

export default function SolarBackend({ onSelectAppointment }) {
  const [activeTab, setActiveTab] = useState("analysis")

  return (
    <section className="solar-backend-page">
      <style>{`
        .solar-backend-page{min-height:100%;padding:28px 32px 40px;background:#f5f7fa;color:#0f172a;box-sizing:border-box}
        .solar-backend-container{max-width:1500px;margin:0 auto}
        .solar-backend-header{display:flex;align-items:flex-start;gap:14px;margin-bottom:20px}
        .solar-backend-icon{width:44px;height:44px;border-radius:12px;background:#e0f2fe;color:#0877bd;display:flex;align-items:center;justify-content:center;flex:0 0 auto}
        .solar-backend-eyebrow{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#0877bd;margin-bottom:4px}
        .solar-backend-heading{margin:0;font-size:30px;line-height:1.1;font-weight:750;letter-spacing:-.025em}
        .solar-backend-subtitle{margin:6px 0 0;color:#64748b;font-size:13px}
        .solar-backend-tabs{display:flex;gap:3px;border-bottom:1px solid #dbe3ec;margin-bottom:18px}
        .solar-backend-tab{height:42px;padding:0 17px;border:1px solid transparent;border-bottom:3px solid transparent;border-radius:9px 9px 0 0;background:transparent;color:#64748b;font-size:12px;font-weight:750;display:inline-flex;align-items:center;gap:7px;cursor:pointer}
        .solar-backend-tab:hover{background:#eef4f9;color:#334155}
        .solar-backend-tab.active{background:#fff;color:#0877bd;border-color:#dbe3ec;border-bottom-color:#0877bd}
        .solar-backend-content{background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 2px 10px rgba(15,23,42,.05);padding:20px}
        .solar-backend-content .solar-analysis-page,.solar-backend-content .open-solar-page{margin:0}
        .solar-backend-content .solar-analysis-controls{box-shadow:none}
        @media(max-width:800px){.solar-backend-page{padding:20px 14px}.solar-backend-content{padding:14px}.solar-backend-tabs{overflow-x:auto}.solar-backend-tab{white-space:nowrap}}
      `}</style>

      <div className="solar-backend-container">
        <div className="solar-backend-header">
          <div className="solar-backend-icon"><Sun size={25}/></div>
          <div>
            <div className="solar-backend-eyebrow">Administration</div>
            <h1 className="solar-backend-heading">Solar Backend</h1>
            <p className="solar-backend-subtitle">Analyse solar appointments and manage OpenSolar project IDs.</p>
          </div>
        </div>

        <div className="solar-backend-tabs">
          <button type="button" className={`solar-backend-tab ${activeTab === "analysis" ? "active" : ""}`} onClick={() => setActiveTab("analysis")}>
            <BarChart3 size={15}/>Appointment Analysis
          </button>
          <button type="button" className={`solar-backend-tab ${activeTab === "opensolar" ? "active" : ""}`} onClick={() => setActiveTab("opensolar")}>
            <Link2 size={15}/>OpenSolar IDs
          </button>
        </div>

        <div className="solar-backend-content">
          {activeTab === "analysis" ? (
            <SolarAppointmentAnalysis embedded onSelectAppointment={onSelectAppointment}/>
          ) : (
            <OpenSolarIds embedded/>
          )}
        </div>
      </div>
    </section>
  )
}

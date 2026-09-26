import React, { useState } from "react"
import MISection from "../components/mi/MISection"
import MarketingMI from "../components/mi/MarketingMI"
import SalesMI from "../components/mi/SalesMI"
import ProcurementMI from "../components/mi/ProcurementMI"
import WindowInstallationsMI from "../components/mi/WindowInstallationsMI"
import RenewableInstallationsMI from "../components/mi/RenewableInstallationsMI"
import ECO4MI from "../components/mi/ECO4MI"
import RemedialsMI from "../components/mi/RemedialsMI"
import AccountsMI from "../components/mi/AccountsMI"
import HeadOfficeMI from "../components/mi/HeadOfficeMI"
import ReviewsMI from "../components/mi/ReviewsMI"

const SECTIONS = [
  ["Marketing", MarketingMI],
  ["Sales", SalesMI],
  ["Procurement", ProcurementMI],
  ["Window Installations", WindowInstallationsMI],
  ["Renewable Installations", RenewableInstallationsMI],
  ["ECO4", ECO4MI],
  ["Remedials", RemedialsMI],
  ["Accounts", AccountsMI],
  ["Head Office", HeadOfficeMI],
  ["Reviews", ReviewsMI],
]

export default function MI() {
  const [openSections, setOpenSections] = useState({})

  const toggleSection = (section) => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }))
  }

  return (
    <section className="mi-page" style={{ maxWidth: 1200, width: "100%", margin: "0 auto", padding: "8px 4px 40px" }}>
      <style>{`
        .mi-page { box-sizing: border-box; }
        .mi-sections { display: flex; flex-direction: column; gap: 10px; }
        .mi-section { background: #fff; border: 1px solid #dce4ea; border-radius: 11px; overflow: hidden; }
        .mi-section-header {
          width: 100%; border: 0; padding: 15px 16px; background: #f3f6f8; color: #263645;
          font-size: 13px; font-weight: 800; display: flex; align-items: center;
          justify-content: space-between; gap: 12px; cursor: pointer; text-align: left;
        }
        .mi-section-header:hover { background: #edf2f5; }
        .mi-section-title { display: flex; align-items: center; gap: 9px; }
        .mi-section-body { min-height: 130px; border-top: 1px solid #dce4ea; padding: 16px; }
        @media (max-width: 900px) {
          .mi-page { padding: 4px 0 28px !important; }
          .mi-sections { gap: 8px; }
          .mi-section-body { min-height: 105px; padding: 12px; }
        }
      `}</style>

      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 26, lineHeight: 1.15, color: "#263645" }}>
          Management Information
        </h1>
        <p style={{ margin: "7px 0 0", color: "#74808a", fontSize: 12 }}>
          Senior management information
        </p>
      </div>

      <div className="mi-sections">
        {SECTIONS.map(([title, Component]) => {
          const isOpen = Boolean(openSections[title])
          return (
            <MISection
              key={title}
              title={title}
              open={isOpen}
              onToggle={() => toggleSection(title)}
            >
              <Component />
            </MISection>
          )
        })}
      </div>
    </section>
  )
}

import React from "react"

const SECTIONS = [
  "Marketing",
  "Sales",
  "Procurement",
  "Window Installations",
  "Renewable Installations",
  "ECO4",
  "Remedials",
  "Accounts",
  "Head Office",
  "Reviews",
]

export default function MI() {
  return (
    <section className="mi-page" style={{ maxWidth: 1200, width: "100%", margin: "0 auto", padding: "8px 4px 40px" }}>
      <style>{`
        .mi-page { box-sizing: border-box; }
        .mi-sections { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .mi-section { min-height: 180px; background: #fff; border: 1px solid #dce4ea; border-radius: 11px; overflow: hidden; }
        .mi-section-header { padding: 14px 16px; background: #f3f6f8; border-bottom: 1px solid #dce4ea; font-size: 13px; font-weight: 800; color: #263645; }
        .mi-section-body { min-height: 130px; }
        @media (max-width: 900px) {
          .mi-page { padding: 4px 0 28px !important; }
          .mi-sections { grid-template-columns: 1fr; gap: 10px; }
          .mi-section { min-height: 150px; }
          .mi-section-body { min-height: 105px; }
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
        {SECTIONS.map((section) => (
          <div className="mi-section" key={section}>
            <div className="mi-section-header">{section}</div>
            <div className="mi-section-body" />
          </div>
        ))}
      </div>
    </section>
  )
}

import React from "react"

const STEPS = [
  { key: "video", label: "Video" },
  { key: "bill", label: "Bill" },
  { key: "checklist", label: "Checklist" },
  { key: "photos", label: "Photos" },
]

export default function SurveyProgressBar({ progress = [], compact = false }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(24px,1fr))", gap: compact ? 5 : 8, minWidth: compact ? 140 : 240 }}>
      {STEPS.map((step, index) => {
        const status = typeof progress[index] === "string" ? progress[index] : progress[index] ? "complete" : "outstanding"
        const color = status === "complete" ? "#16845b" : status === "in-progress" ? "#f59e0b" : "#e5eaf0"
        const textColor = status === "complete" ? "#16845b" : status === "in-progress" ? "#b96b08" : "#64748b"
        const statusLabel = status === "complete" ? "Complete" : status === "in-progress" ? "In progress" : "Outstanding"
        return (
          <div key={step.key} title={step.label + ": " + statusLabel}>
            <div style={{ height: compact ? 7 : 8, borderRadius: 999, background: color }} />
            <div style={{ fontSize: compact ? 9 : 10, color: textColor, marginTop: 4, whiteSpace: "nowrap" }}>{step.label}</div>
          </div>
        )
      })}
    </div>
  )
}

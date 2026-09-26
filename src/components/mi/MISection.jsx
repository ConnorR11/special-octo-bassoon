import React from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

export default function MISection({ title, open, onToggle, children }) {
  return (
    <div className="mi-section">
      <button
        type="button"
        className="mi-section-header"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="mi-section-title">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          {title}
        </span>
      </button>
      {open && <div className="mi-section-body">{children}</div>}
    </div>
  )
}

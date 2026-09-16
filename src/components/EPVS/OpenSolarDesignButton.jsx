import React, { useEffect, useState } from "react"

function OpenSolarLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ display: "block", flexShrink: 0 }}>
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="#ffcc26" strokeWidth="3" />
      <circle cx="12" cy="12" r="2.2" fill="#ffcc26" />
    </svg>
  )
}

function HardwareRow({ title, data, unit }) {
  const parts = Array.isArray(data?.parts) ? data.parts : []
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", background: "#fff" }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#172554", marginBottom: 8 }}>{title}</div>
      {parts.length ? parts.map((part, index) => (
        <div key={`${title}-${index}`} style={{ display: "grid", gridTemplateColumns: "1.1fr 1.4fr .7fr .7fr", gap: 12, fontSize: 11, color: "#334155", paddingTop: index ? 8 : 0, borderTop: index ? "1px solid #f1f5f9" : 0 }}>
          <span><strong>Manufacturer</strong><br />{part.manufacturer || "—"}</span>
          <span><strong>Model</strong><br />{part.model || "—"}</span>
          <span><strong>Capacity</strong><br />{unit === "kW" ? `${part.capacityKw || 0} kW` : `${part.capacityKwh || 0} kWh`}</span>
          <span><strong>Quantity</strong><br />{part.quantity || 0}</span>
        </div>
      )) : (
        <div style={{ fontSize: 11, color: "#64748b" }}>No {title.toLowerCase()} found in this OpenSolar system.</div>
      )}
      {parts.length > 1 && (
        <div style={{ marginTop: 9, fontSize: 11, fontWeight: 700, color: "#172554" }}>
          Total: {unit === "kW" ? `${data.capacityKw || 0} kW` : `${data.capacityKwh || 0} kWh`} · {data.quantity || 0} unit(s)
        </div>
      )}
    </div>
  )
}

export default function OpenSolarDesignButton({ projectId, appointmentRowId, onDesignLoaded, style }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [design, setDesign] = useState(null)

  const getCurrentDesign = async () => {
    if (!projectId) {
      setError("No OpenSolar project ID is linked to this appointment.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/opensolar-design", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ projectId, appointmentRowId }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || `Unable to retrieve the OpenSolar design (HTTP ${response.status}).`)
      setDesign(payload)
      onDesignLoaded?.(payload)
    } catch (err) {
      console.error("OpenSolar design lookup failed", err)
      setError(err?.message || "Unable to retrieve the OpenSolar design.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (projectId) getCurrentDesign()
  }, [projectId])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", ...style }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="button" onClick={getCurrentDesign} disabled={loading} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 38, padding: "0 14px", border: 0, borderRadius: 8, background: "#172554", color: "#fff", fontSize: 12, fontWeight: 700, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1, whiteSpace: "nowrap" }}>
          <OpenSolarLogo />
          {loading ? "Getting design…" : "Refresh from OpenSolar"}
        </button>
      </div>

      {error && <div style={{ fontSize: 11, color: "#b91c1c", textAlign: "right" }}>{error}</div>}

      {design?.hardware && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 2 }}>
          <HardwareRow title="Inverter" data={design.hardware.inverter} unit="kW" />
          <HardwareRow title="Battery" data={design.hardware.battery} unit="kWh" />
        </div>
      )}
    </div>
  )
}

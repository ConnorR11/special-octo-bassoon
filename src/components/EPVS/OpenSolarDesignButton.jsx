import React, { useState } from "react"
import { supabase } from "../../lib/supabase"

function OpenSolarLogo() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="#ffcc26" strokeWidth="3" />
      <circle cx="12" cy="12" r="2.2" fill="#ffcc26" />
    </svg>
  )
}

export default function OpenSolarDesignButton({
  projectId,
  onDesignLoaded,
  style,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const getCurrentDesign = async () => {
    if (!projectId) {
      setError("No OpenSolar project ID is linked to this appointment.")
      return
    }

    if (!supabase) {
      setError("Supabase is not configured for this application.")
      return
    }

    setLoading(true)
    setError("")

    try {
      const { data: payload, error: functionError } = await supabase.functions.invoke(
        "opensolar-design",
        {
          body: { projectId },
        }
      )

      if (functionError) {
        throw new Error(functionError.message || "Unable to retrieve the OpenSolar design.")
      }

      if (!payload?.success) {
        throw new Error(payload?.error || "Unable to retrieve the OpenSolar design.")
      }

      onDesignLoaded?.(payload)
    } catch (err) {
      console.error("OpenSolar design lookup failed", err)
      setError(err?.message || "Unable to retrieve the OpenSolar design.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, ...style }}>
      <button
        type="button"
        onClick={getCurrentDesign}
        disabled={loading}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          minHeight: 38,
          padding: "0 14px",
          border: 0,
          borderRadius: 8,
          background: "#172554",
          color: "#fff",
          fontSize: 12,
          fontWeight: 700,
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
          whiteSpace: "nowrap",
        }}
      >
        <OpenSolarLogo />
        {loading ? "Getting design…" : "Get Current Design"}
      </button>

      {error && (
        <span style={{ maxWidth: 260, fontSize: 10, color: "#b91c1c", textAlign: "right" }}>
          {error}
        </span>
      )}
    </div>
  )
}

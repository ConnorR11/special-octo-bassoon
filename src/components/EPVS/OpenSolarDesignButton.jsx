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
  const [imageUrl, setImageUrl] = useState("")

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
        let detail = ""
        try {
          const response = functionError.context
          if (response && typeof response.json === "function") {
            const body = await response.clone().json()
            detail = body?.error || body?.detail || body?.message || ""
            if (body?.status) detail = `${detail}${detail ? " — " : ""}HTTP ${body.status}`
          }
        } catch {
          // Fall back to Supabase's standard error message.
        }
        throw new Error(detail || functionError.message || "Unable to retrieve the OpenSolar design.")
      }

      if (!payload?.success) {
        throw new Error(payload?.error || "Unable to retrieve the OpenSolar design.")
      }

      const nextImageUrl = String(payload?.imageUrl || payload?.systemImageUrl || "").trim()
      if (!nextImageUrl) {
        throw new Error("OpenSolar returned successfully, but no system image URL was returned.")
      }

      setImageUrl(nextImageUrl)
      onDesignLoaded?.(payload)
    } catch (err) {
      console.error("OpenSolar design lookup failed", err)
      setError(err?.message || "Unable to retrieve the OpenSolar design.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 10, ...style }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
      </div>

      {error && (
        <span style={{ maxWidth: 260, marginLeft: "auto", fontSize: 10, color: "#b91c1c", textAlign: "right" }}>
          {error}
        </span>
      )}

      {imageUrl && (
        <div
          style={{
            width: "100%",
            overflow: "hidden",
            border: "1px solid #e2e5e8",
            borderRadius: 8,
            background: "#f6f8f9",
          }}
        >
          <img
            src={imageUrl}
            alt="OpenSolar system design"
            style={{
              display: "block",
              width: "100%",
              maxHeight: 650,
              objectFit: "contain",
            }}
          />
        </div>
      )}
    </div>
  )
}

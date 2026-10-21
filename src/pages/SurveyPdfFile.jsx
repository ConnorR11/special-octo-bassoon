import React, { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function SurveyPdfFile() {
  const [message, setMessage] = useState("Opening private survey PDF…")
  useEffect(() => {
    let cancelled = false
    async function openPdf() {
      try {
        const documentId = new URLSearchParams(window.location.search).get("document_id") || ""
        if (!documentId) throw new Error("The survey PDF reference is missing.")
        const { data } = await supabase.auth.getSession()
        const token = data?.session?.access_token
        if (!token) throw new Error("Please sign in to the CRM, then open this link again.")
        const response = await fetch("/api/deals/open-survey-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ document_id: documentId }),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok || !result.url) throw new Error(result.error || "Unable to open this survey PDF.")
        if (!cancelled) window.location.replace(result.url)
      } catch (error) {
        if (!cancelled) setMessage(error?.message || "Unable to open this survey PDF.")
      }
    }
    openPdf()
    return () => { cancelled = true }
  }, [])
  return <div style={{ padding: 32, fontFamily: "Arial, sans-serif", color: "#233247" }}>
    <h2>Solar survey photos</h2><p>{message}</p><a href="/contracts">Return to CRM</a>
  </div>
}

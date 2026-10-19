import React, { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function OverstayFormFile() {
  const [message, setMessage] = useState("Opening private overstay form…")
  useEffect(() => {
    let cancelled = false
    async function openForm() {
      try {
        const path = new URLSearchParams(window.location.search).get("path") || ""
        if (!path) throw new Error("The overstay form reference is missing.")
        const { data } = await supabase.auth.getSession()
        const token = data?.session?.access_token
        if (!token) throw new Error("Please sign in to the CRM, then open this link again.")
        const response = await fetch("/api/sales/open-overstay-form", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ path }),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok || !result.url) throw new Error(result.error || "Unable to open this overstay form.")
        if (!cancelled) window.location.replace(result.url)
      } catch (error) {
        if (!cancelled) setMessage(error?.message || "Unable to open this overstay form.")
      }
    }
    openForm()
    return () => { cancelled = true }
  }, [])
  return <div style={{ padding: 32, fontFamily: "Arial, sans-serif", color: "#233247" }}>
    <h2>Overstay Form</h2><p>{message}</p><a href="/appointments">Return to CRM</a>
  </div>
}

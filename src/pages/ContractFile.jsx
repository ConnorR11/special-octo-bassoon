import React, { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function ContractFile() {
  const [message, setMessage] = useState("Opening private contract…")

  useEffect(() => {
    let cancelled = false
    async function openContract() {
      try {
        const path = new URLSearchParams(window.location.search).get("path") || ""
        if (!path) throw new Error("The contract reference is missing.")
        const { data } = await supabase.auth.getSession()
        const token = data?.session?.access_token
        if (!token) throw new Error("Please sign in to the CRM, then open this link again.")
        const response = await fetch("/api/sales/open-solar-contract", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ path }),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok || !result.url) throw new Error(result.error || "Unable to open this contract.")
        if (!cancelled) window.location.replace(result.url)
      } catch (error) {
        if (!cancelled) setMessage(error?.message || "Unable to open this contract.")
      }
    }
    openContract()
    return () => { cancelled = true }
  }, [])

  return <div style={{ padding: 32, fontFamily: "Arial, sans-serif", color: "#233247" }}>
    <h2>Solar contract</h2><p>{message}</p>
    <a href="/appointments">Return to CRM</a>
  </div>
}

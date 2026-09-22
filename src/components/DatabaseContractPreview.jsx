import React, { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { supabase } from "../lib/supabase"

function interpolate(value, appointment) {
  if (value == null) return ""
  const customer = String(appointment?.name || appointment?.customer_name || "").trim() || "Customer"
  const values = {
    customer_name: customer,
    name: customer,
    postcode: appointment?.postcode || "",
    address: appointment?.address || "",
    product: appointment?.product || "Solar",
  }
  return String(value).replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key) => values[key.toLowerCase()] ?? "")
}

function ContractPage({ page, appointment, number }) {
  const settings = page?.settings || {}
  const visual = settings.visual || {}
  const background = settings.background || visual.background || "#ffffff"
  const textColor = settings.text_color || visual.text_color || "#172033"
  const accent = settings.accent || visual.accent || "#0b5d8a"
  const padding = settings.padding || visual.content_padding || "42px"

  return (
    <div style={{ width: "210mm", minHeight: "297mm", background, color: textColor, boxSizing: "border-box", padding, position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,.35)", flex: "0 0 auto" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 7, background: accent }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 18, borderBottom: `1px solid ${accent}33`, marginBottom: 28 }}>
        <strong style={{ fontSize: 11, letterSpacing: ".06em" }}>HOMESHIELD SCOTLAND LTD</strong>
        <span style={{ fontSize: 9, opacity: .55 }}>DIGITAL SOLAR CONTRACT</span>
      </div>
      <div style={{ fontSize: 28, lineHeight: 1.05, fontWeight: 800 }}>{interpolate(page?.title || `Page ${number}`, appointment)}</div>
      {page?.subtitle && <div style={{ marginTop: 10, fontSize: 13, color: accent, fontWeight: 700 }}>{interpolate(page.subtitle, appointment)}</div>}
      {page?.body && <div style={{ marginTop: 26, whiteSpace: "pre-wrap", fontSize: 11, lineHeight: 1.65, color: visual.body_color || "#52606d" }}>{interpolate(page.body, appointment)}</div>}
      <div style={{ position: "absolute", left: padding, right: padding, bottom: 22, borderTop: "1px solid #dfe5e9", paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 8, color: "#7b8790" }}>
        <span>{interpolate("{{customer_name}}", appointment)}</span>
        <span>Page {number}</span>
      </div>
    </div>
  )
}

export default function DatabaseContractPreview({ appointment, templateId, onClose }) {
  const [template, setTemplate] = useState(null)
  const [pages, setPages] = useState([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError("")
      const { data: templateData, error: templateError } = await supabase.from("templates").select("id,name,template_type").eq("id", templateId).maybeSingle()
      if (templateError) { if (mounted) { setError(templateError.message); setLoading(false) }; return }
      if (!templateData) { if (mounted) { setError("Digital Solar Contract template could not be found."); setLoading(false) }; return }
      const { data: pageData, error: pageError } = await supabase.from("template_pages").select("id,slide_order,title,subtitle,body,settings").eq("presentation_id", templateData.id).order("slide_order", { ascending: true })
      if (pageError) { if (mounted) { setError(pageError.message); setLoading(false) }; return }
      if (mounted) { setTemplate(templateData); setPages(pageData || []); setIndex(0); setLoading(false) }
    }
    load()
    return () => { mounted = false }
  }, [templateId])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.()
      if (event.key === "ArrowRight") setIndex(v => Math.min(v + 1, Math.max(pages.length - 1, 0)))
      if (event.key === "ArrowLeft") setIndex(v => Math.max(v - 1, 0))
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose, pages.length])

  const page = pages[index]
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 4000, background: "#111820", color: "#fff", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", borderBottom: "1px solid rgba(255,255,255,.12)", flex: "0 0 auto" }}>
        <div><div style={{ fontSize: 14, fontWeight: 800 }}>{template?.name || "Digital Solar Contract"}</div><div style={{ fontSize: 10, opacity: .6, marginTop: 3 }}>{appointment?.name || "Presentation Preview"}</div></div>
        <button type="button" onClick={onClose} style={{ border: 0, background: "rgba(255,255,255,.08)", color: "#fff", width: 36, height: 36, borderRadius: 8, cursor: "pointer" }}><X size={18} /></button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 34 }}>
        {loading ? <div style={{ marginTop: 80, opacity: .7 }}>Loading contract preview...</div> : error ? <div style={{ marginTop: 80, textAlign: "center" }}><strong>Contract preview unavailable</strong><div style={{ marginTop: 8, opacity: .65, fontSize: 12 }}>{error}</div></div> : page ? <ContractPage page={page} appointment={appointment} number={index + 1} /> : <div style={{ marginTop: 80, opacity: .7 }}>This template has no pages yet.</div>}
      </div>
      <div style={{ height: 68, display: "flex", alignItems: "center", justifyContent: "center", gap: 18, flex: "0 0 auto" }}>
        <button type="button" disabled={index === 0 || !pages.length} onClick={() => setIndex(v => Math.max(v - 1, 0))} style={{ width: 42, height: 42, border: 0, borderRadius: 21, background: index === 0 ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.12)", color: "#fff" }}><ChevronLeft size={20} /></button>
        <div style={{ minWidth: 80, textAlign: "center", fontSize: 11, opacity: .7 }}>{pages.length ? `${index + 1} / ${pages.length}` : "0 / 0"}</div>
        <button type="button" disabled={index >= pages.length - 1 || !pages.length} onClick={() => setIndex(v => Math.min(v + 1, pages.length - 1))} style={{ width: 42, height: 42, border: 0, borderRadius: 21, background: index >= pages.length - 1 ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.12)", color: "#fff" }}><ChevronRight size={20} /></button>
      </div>
    </div>
  )
}

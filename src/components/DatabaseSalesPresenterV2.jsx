import React, { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, X, Sun, BatteryCharging, PoundSterling } from "lucide-react"
import { supabase } from "../lib/supabase"

const isSolar = (a) => [a?.product, a?.job_type, a?.measure, a?.service].filter(Boolean).join(" ").toLowerCase().includes("solar")

function interpolate(value, appointment) {
  if (value == null) return ""
  const customer = String(appointment?.name || appointment?.customer_name || "").trim() || "Customer"
  const values = { customer_name: customer, name: customer, postcode: appointment?.postcode || "", address: appointment?.address || "", product: appointment?.product || appointment?.job_type || "" }
  return String(value).replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key) => values[key.toLowerCase()] ?? "")
}

function BenefitIcon({ type, size = 13 }) {
  const Icon = type === "battery" ? BatteryCharging : type === "money" ? PoundSterling : Sun
  return <Icon size={size} />
}

function SlideOne({ slide, appointment }) {
  const settings = slide.settings || {}
  const visual = settings.visual || settings.cover || {}
  const benefits = Array.isArray(settings.benefits) ? settings.benefits : []
  const icons = Array.isArray(visual.benefit_icons) ? visual.benefit_icons : []
  const customer = interpolate("{{customer_name}}", appointment)
  const accent = visual.accent || "#7dd3fc"
  const textColor = visual.text_color || "#fff"
  const hero = visual.hero_svg || ""
  return <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", display: "flex", color: textColor, background: visual.background || "#07111c" }}>
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: visual.overlay || "transparent" }} />
    <div style={{ position: "relative", zIndex: 2, width: visual.left_width || "58%", padding: visual.left_padding || "clamp(30px,5vw,68px) clamp(28px,5vw,70px) 38px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxSizing: "border-box" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: visual.logo_gap ?? 12 }}><img src={visual.logo_url || "/homeshield-logo.png"} alt={settings.brand || "HomeShield Scotland"} style={{ width: visual.logo_width || "clamp(42px,4.2vw,58px)", height: "auto", objectFit: "contain", filter: visual.logo_shadow || "none" }} /><div><div style={{ fontSize: visual.brand_size || "clamp(10px,1vw,14px)", fontWeight: 800, letterSpacing: visual.brand_letter_spacing || ".08em" }}>{settings.brand || ""}</div>{settings.tagline && <div style={{ marginTop: 4, fontSize: visual.tagline_size || "clamp(8px,.8vw,11px)", color: visual.muted_color || "rgba(255,255,255,.66)" }}>{interpolate(settings.tagline, appointment)}</div>}</div></div>
        <div style={{ marginTop: visual.content_top_margin || "clamp(45px,8vh,82px)" }}>{settings.eyebrow && <div style={{ display: "inline-block", padding: visual.eyebrow_padding || "7px 11px", borderRadius: visual.eyebrow_radius ?? 999, background: visual.eyebrow_background || "transparent", border: visual.eyebrow_border ? `1px solid ${visual.eyebrow_border}` : "none", color: accent, fontSize: visual.eyebrow_size || "clamp(9px,.9vw,12px)", fontWeight: 800, letterSpacing: visual.eyebrow_letter_spacing || ".15em", textTransform: "uppercase", marginBottom: visual.eyebrow_margin_bottom ?? 17 }}>{interpolate(settings.eyebrow, appointment)}</div>}<div style={{ fontSize: visual.title_size || "clamp(38px,5.1vw,74px)", lineHeight: visual.title_line_height ?? .96, fontWeight: visual.title_weight ?? 800, letterSpacing: visual.title_letter_spacing || "-.045em" }}>{interpolate(slide.title, appointment)}</div>{slide.subtitle && <div style={{ marginTop: visual.subtitle_margin_top ?? 20, maxWidth: visual.subtitle_max_width || 560, fontSize: visual.subtitle_size || "clamp(14px,1.45vw,21px)", lineHeight: visual.subtitle_line_height || 1.4, color: visual.subtitle_color || "rgba(255,255,255,.78)" }}>{interpolate(slide.subtitle, appointment)}</div>}</div>
      </div>
      <div style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: visual.customer_gap ?? 8, padding: visual.customer_padding || "8px 13px", borderRadius: visual.customer_radius ?? 999, background: visual.customer_background || "transparent", border: visual.customer_border ? `1px solid ${visual.customer_border}` : "none", fontSize: visual.customer_size || "clamp(9px,.9vw,12px)", color: visual.customer_muted || "rgba(255,255,255,.75)" }}><span style={{ width: visual.customer_dot_size ?? 6, height: visual.customer_dot_size ?? 6, borderRadius: 50, background: accent }} />{visual.customer_prefix || "Prepared for"} <strong style={{ color: visual.customer_name_color || textColor }}>{customer}</strong></div>
    </div>
    <div style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: visual.hero_padding || "35px 32px 70px 0", boxSizing: "border-box" }}>{hero ? <div style={{ width: visual.hero_width || "min(430px,42vw)", maxWidth: "100%" }} dangerouslySetInnerHTML={{ __html: interpolate(hero, appointment) }} /> : visual.hero_url ? <img src={visual.hero_url} alt="" style={{ width: visual.hero_width || "min(430px,42vw)", maxWidth: "100%", height: "auto", objectFit: "contain" }} /> : null}</div>
    {benefits.length > 0 && <div style={{ position: "absolute", zIndex: 4, left: visual.benefits_left || "50%", bottom: visual.benefits_bottom ?? 20, transform: visual.benefits_transform || "translateX(-50%)", display: "flex", gap: visual.benefits_gap ?? 8, whiteSpace: "nowrap" }}>{benefits.map((label, i) => <div key={`${label}-${i}`} style={{ display: "flex", alignItems: "center", gap: visual.benefit_gap ?? 6, padding: visual.benefit_padding || "6px 10px", borderRadius: visual.benefit_radius ?? 8, background: visual.benefit_background || "transparent", border: visual.benefit_border ? `1px solid ${visual.benefit_border}` : "none", fontSize: visual.benefit_size || "clamp(8px,.75vw,10px)", color: visual.benefit_color || "rgba(255,255,255,.72)" }}><BenefitIcon type={icons[i % Math.max(icons.length, 1)]} size={visual.benefit_icon_size ?? 12} />{interpolate(label, appointment)}</div>)}</div>}
  </div>
}

function StandardSlide({ slide, appointment }) {
  const settings = slide.settings || {}
  const visual = settings.visual || {}
  return <div style={{ width: visual.width || "min(1200px,94vw)", height: visual.height || "min(675px,76vh)", background: visual.background || "#fff", color: visual.text_color || "#172033", borderRadius: visual.border_radius ?? 16, overflow: "hidden", boxShadow: visual.box_shadow || "0 25px 80px rgba(0,0,0,.35)", display: "flex", flexDirection: visual.flex_direction || "column" }}><div style={{ flex: 1, minHeight: 0, padding: visual.content_padding || "clamp(28px,5vw,64px)", display: "flex", flexDirection: "column", justifyContent: visual.content_justify || "center" }}>{settings.eyebrow && <div style={{ marginBottom: visual.eyebrow_margin_bottom ?? 14, color: visual.accent || settings.accent || "#2499ed", fontSize: visual.eyebrow_size || "clamp(10px,1vw,13px)", fontWeight: visual.eyebrow_weight || 800, letterSpacing: visual.eyebrow_letter_spacing || ".12em", textTransform: "uppercase" }}>{interpolate(settings.eyebrow, appointment)}</div>}<div style={{ fontSize: visual.title_size || "clamp(28px,4vw,54px)", lineHeight: visual.title_line_height || 1.05, fontWeight: visual.title_weight || 800 }}>{interpolate(slide.title, appointment)}</div>{slide.subtitle && <div style={{ marginTop: visual.subtitle_margin_top ?? 14, fontSize: visual.subtitle_size || "clamp(16px,2vw,24px)", color: visual.accent || settings.accent || "#2499ed", fontWeight: visual.subtitle_weight || 700 }}>{interpolate(slide.subtitle, appointment)}</div>}{slide.body && <div style={{ marginTop: visual.body_margin_top ?? 22, maxWidth: visual.body_max_width || 850, whiteSpace: "pre-wrap", fontSize: visual.body_size || "clamp(14px,1.5vw,19px)", lineHeight: visual.body_line_height || 1.6, color: visual.body_color || "#52606d" }}>{interpolate(slide.body, appointment)}</div>}</div></div>
}

export default function DatabaseSalesPresenterV2({ appointment, onClose, templateId }) {
  const [template, setTemplate] = useState(null)
  const [pages, setPages] = useState([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const type = isSolar(appointment) ? "solar" : "windows"

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true); setError("")
      let templateQuery = supabase.from("templates").select("id,name,template_type,description")
      if (templateId) {
        templateQuery = templateQuery.eq("id", templateId).maybeSingle()
      } else {
        templateQuery = templateQuery.eq("template_type", type).eq("active", true).order("created_at", { ascending: true }).limit(1).maybeSingle()
      }
      const { data: templateData, error: templateError } = await templateQuery
      if (templateError) { if (mounted) { setError(templateError.message); setLoading(false) }; return }
      if (!templateData) { if (mounted) { setError("No sales template could be found for this preview."); setLoading(false) }; return }
      const { data: pageData, error: pageError } = await supabase.from("template_pages").select("id,slide_order,title,subtitle,body,settings").eq("presentation_id", templateData.id).order("slide_order", { ascending: true })
      if (pageError) { if (mounted) { setError(pageError.message); setLoading(false) }; return }
      if (mounted) { setTemplate(templateData); setPages(pageData || []); setIndex(0); setLoading(false) }
    }
    load(); return () => { mounted = false }
  }, [type, templateId])

  useEffect(() => { const onKeyDown = (event) => { if (event.key === "Escape") onClose?.(); if (event.key === "ArrowRight") setIndex(v => Math.min(v + 1, Math.max(pages.length - 1, 0))); if (event.key === "ArrowLeft") setIndex(v => Math.max(v - 1, 0)) }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown) }, [onClose, pages.length])

  const page = pages[index]
  const isSlideOne = index === 0 && Boolean(page?.settings?.visual || page?.settings?.cover)
  return <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: "#07111c", color: "#fff", display: "flex", flexDirection: "column" }}>
    <div style={{ height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", borderBottom: "1px solid rgba(255,255,255,.12)", flex: "0 0 auto" }}><div><div style={{ fontSize: 14, fontWeight: 800 }}>{template?.name || (type === "solar" ? "Solar Presentation" : "Windows & Doors Presentation")}</div><div style={{ fontSize: 10, opacity: .65, marginTop: 3 }}>{appointment?.name || appointment?.customer_name || "Customer"}</div></div><button type="button" onClick={onClose} style={{ border: 0, background: "rgba(255,255,255,.08)", color: "#fff", width: 36, height: 36, borderRadius: 8, cursor: "pointer" }} aria-label="Close presenter"><X size={18} /></button></div>
    <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: isSlideOne ? 0 : 28 }}>{loading ? <div style={{ fontSize: 14, opacity: .7 }}>Loading presentation...</div> : error ? <div style={{ maxWidth: 520, textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Presenter unavailable</div><div style={{ fontSize: 12, opacity: .7 }}>{error}</div></div> : page ? (isSlideOne ? <SlideOne slide={page} appointment={appointment} /> : <StandardSlide slide={page} appointment={appointment} />) : <div style={{ fontSize: 14, opacity: .7 }}>This template has no pages yet.</div>}</div>
    <div style={{ height: 68, display: "flex", alignItems: "center", justifyContent: "center", gap: 18, flex: "0 0 auto" }}><button type="button" disabled={index === 0 || !pages.length} onClick={() => setIndex(v => Math.max(v - 1, 0))} style={{ width: 42, height: 42, border: 0, borderRadius: 21, background: index === 0 ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.12)", color: "#fff" }}><ChevronLeft size={20} /></button><div style={{ minWidth: 80, textAlign: "center", fontSize: 11, opacity: .7 }}>{pages.length ? `${index + 1} / ${pages.length}` : "0 / 0"}</div><button type="button" disabled={index >= pages.length - 1 || !pages.length} onClick={() => setIndex(v => Math.min(v + 1, pages.length - 1))} style={{ width: 42, height: 42, border: 0, borderRadius: 21, background: index >= pages.length - 1 ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.12)", color: "#fff" }}><ChevronRight size={20} /></button></div>
  </div>
}
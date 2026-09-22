import React, { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, X, Sun, BatteryCharging, PoundSterling } from "lucide-react"
import { supabase } from "../lib/supabase"

function isSolarAppointment(appointment) {
  const text = [appointment?.product, appointment?.job_type, appointment?.measure, appointment?.service]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  return text.includes("solar")
}

function interpolate(value, appointment) {
  if (value == null) return ""
  const customer = String(appointment?.name || "").trim() || String(appointment?.customer_name || "").trim() || "Customer"
  const replacements = {
    customer_name: customer,
    name: customer,
    postcode: appointment?.postcode || "",
    address: appointment?.address || "",
    product: appointment?.product || appointment?.job_type || "",
  }
  return String(value).replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key) => replacements[key.toLowerCase()] ?? "")
}

function SlideOneIcon({ type, size = 14 }) {
  const Icon = type === "battery" ? BatteryCharging : type === "money" ? PoundSterling : Sun
  return <Icon size={size} />
}

function SlideOne({ slide, appointment }) {
  const s = slide?.settings || {}
  const visual = s.visual || s.cover || {}
  const benefits = Array.isArray(s.benefits) && s.benefits.length ? s.benefits : []
  const benefitIcons = Array.isArray(visual.benefit_icons) && visual.benefit_icons.length ? visual.benefit_icons : []
  const customer = interpolate("{{customer_name}}", appointment)
  const title = interpolate(slide?.title || "", appointment)
  const subtitle = interpolate(slide?.subtitle || "", appointment)
  const eyebrow = interpolate(s.eyebrow || "", appointment)
  const tagline = interpolate(s.tagline || "", appointment)
  const background = visual.background || "#07111c"
  const accent = visual.accent || "#7dd3fc"
  const logoUrl = visual.logo_url || "/homeshield-logo.png"
  const heroSvg = visual.hero_svg || ""
  const textColor = visual.text_color || "#fff"

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 0, overflow: "hidden", display: "flex", color: textColor, background }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: visual.overlay || "transparent" }} />
      <div style={{ position: "relative", zIndex: 2, width: visual.left_width || "58%", padding: visual.left_padding || "clamp(30px,5vw,68px) clamp(28px,5vw,70px) 38px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxSizing: "border-box" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: visual.logo_gap ?? 12 }}>
            <img src={logoUrl} alt={s.brand || "HomeShield Scotland"} style={{ width: visual.logo_width || "clamp(42px,4.2vw,58px)", height: "auto", objectFit: "contain", filter: visual.logo_shadow || "none" }} />
            <div>
              <div style={{ fontSize: visual.brand_size || "clamp(10px,1vw,14px)", fontWeight: 800, letterSpacing: visual.brand_letter_spacing || ".08em" }}>{s.brand || ""}</div>
              {tagline && <div style={{ marginTop: 4, fontSize: visual.tagline_size || "clamp(8px,.8vw,11px)", color: visual.muted_color || "rgba(255,255,255,.66)" }}>{tagline}</div>}
            </div>
          </div>
          <div style={{ marginTop: visual.content_top_margin || "clamp(45px,8vh,82px)" }}>
            {eyebrow && <div style={{ display: "inline-block", padding: visual.eyebrow_padding || "7px 11px", borderRadius: visual.eyebrow_radius ?? 999, background: visual.eyebrow_background || "transparent", border: visual.eyebrow_border ? `1px solid ${visual.eyebrow_border}` : "none", color: accent, fontSize: visual.eyebrow_size || "clamp(9px,.9vw,12px)", fontWeight: 800, letterSpacing: visual.eyebrow_letter_spacing || ".15em", textTransform: "uppercase", marginBottom: visual.eyebrow_margin_bottom ?? 17 }}>{eyebrow}</div>}
            <div style={{ fontSize: visual.title_size || "clamp(38px,5.1vw,74px)", lineHeight: visual.title_line_height ?? .96, fontWeight: visual.title_weight ?? 800, letterSpacing: visual.title_letter_spacing || "-.045em" }}>{title}</div>
            {subtitle && <div style={{ marginTop: visual.subtitle_margin_top ?? 20, maxWidth: visual.subtitle_max_width || 560, fontSize: visual.subtitle_size || "clamp(14px,1.45vw,21px)", lineHeight: visual.subtitle_line_height || 1.4, color: visual.subtitle_color || "rgba(255,255,255,.78)" }}>{subtitle}</div>}
          </div>
        </div>
        <div style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: visual.customer_gap ?? 8, padding: visual.customer_padding || "8px 13px", borderRadius: visual.customer_radius ?? 999, background: visual.customer_background || "transparent", border: visual.customer_border ? `1px solid ${visual.customer_border}` : "none", fontSize: visual.customer_size || "clamp(9px,.9vw,12px)", color: visual.customer_muted || "rgba(255,255,255,.75)" }}><span style={{ width: visual.customer_dot_size ?? 6, height: visual.customer_dot_size ?? 6, borderRadius: 50, background: accent }} />{visual.customer_prefix || "Prepared for"} <strong style={{ color: visual.customer_name_color || textColor }}>{customer}</strong></div>
      </div>
      <div style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: visual.hero_padding || "35px 32px 70px 0", boxSizing: "border-box" }}>
        {heroSvg ? <div style={{ width: visual.hero_width || "min(430px,42vw)", maxWidth: "100%" }} dangerouslySetInnerHTML={{ __html: interpolate(heroSvg, appointment) }} /> : visual.hero_url ? <img src={visual.hero_url} alt="" style={{ width: visual.hero_width || "min(430px,42vw)", maxWidth: "100%", height: "auto", objectFit: "contain" }} /> : null}
      </div>
      {benefits.length > 0 && <div style={{ position: "absolute", zIndex: 4, left: visual.benefits_left || "50%", bottom: visual.benefits_bottom ?? 20, transform: visual.benefits_transform || "translateX(-50%)", display: "flex", gap: visual.benefits_gap ?? 8, whiteSpace: "nowrap" }}>
        {benefits.map((label, i) => <div key={`${label}-${i}`} style={{ display: "flex", alignItems: "center", gap: visual.benefit_gap ?? 6, padding: visual.benefit_padding || "6px 10px", borderRadius: visual.benefit_radius ?? 8, background: visual.benefit_background || "transparent", border: visual.benefit_border ? `1px solid ${visual.benefit_border}` : "none", fontSize: visual.benefit_size || "clamp(8px,.75vw,10px)", color: visual.benefit_color || "rgba(255,255,255,.72)" }}><SlideOneIcon type={benefitIcons[i % Math.max(benefitIcons.length, 1)]} size={visual.benefit_icon_size ?? 12} />{interpolate(label, appointment)}</div>)}
      </div>}
    </div>
  )
}

function StandardSlide({ slide, appointment }) {
  const settings = slide?.settings || {}
  const visual = settings.visual || {}
  return (
    <div style={{ width: visual.width || "min(1200px,94vw)", height: visual.height || "min(675px,76vh)", background: visual.background || "#fff", color: visual.text_color || "#172033", borderRadius: visual.border_radius ?? 16, overflow: "hidden", boxShadow: visual.box_shadow || "0 25px 80px rgba(0,0,0,.35)", display: "flex", flexDirection: visual.flex_direction || "column" }}>
      {slide.image_url && <div style={{ flex: visual.image_flex || "0 0 42%", backgroundImage: `url(${slide.image_url})`, backgroundSize: visual.image_fit || "cover", backgroundPosition: visual.image_position || "center" }} />}
      {slide.video_url && <video src={slide.video_url} controls autoPlay style={{ width: "100%", maxHeight: visual.video_max_height || "46%", objectFit: visual.video_fit || "cover" }} />}
      <div style={{ flex: 1, minHeight: 0, padding: visual.content_padding || "clamp(28px,5vw,64px)", display: "flex", flexDirection: "column", justifyContent: visual.content_justify || "center" }}>
        {settings.eyebrow && <div style={{ display: "inline-block", marginBottom: visual.eyebrow_margin_bottom ?? 14, color: visual.accent || settings.accent || "#2499ed", fontSize: visual.eyebrow_size || "clamp(10px,1vw,13px)", fontWeight: visual.eyebrow_weight || 800, letterSpacing: visual.eyebrow_letter_spacing || ".12em", textTransform: "uppercase" }}>{interpolate(settings.eyebrow, appointment)}</div>}
        <div style={{ fontSize: visual.title_size || "clamp(28px,4vw,54px)", lineHeight: visual.title_line_height || 1.05, fontWeight: visual.title_weight || 800 }}>{interpolate(slide.title, appointment)}</div>
        {slide.subtitle && <div style={{ marginTop: visual.subtitle_margin_top ?? 14, fontSize: visual.subtitle_size || "clamp(16px,2vw,24px)", color: visual.accent || settings.accent || "#2499ed", fontWeight: visual.subtitle_weight || 700 }}>{interpolate(slide.subtitle, appointment)}</div>}
        {slide.body && <div style={{ marginTop: visual.body_margin_top ?? 22, maxWidth: visual.body_max_width || 850, whiteSpace: "pre-wrap", fontSize: visual.body_size || "clamp(14px,1.5vw,19px)", lineHeight: visual.body_line_height || 1.6, color: visual.body_color || "#52606d" }}>{interpolate(slide.body, appointment)}</div>}
      </div>
    </div>
  )
}

export default function DatabaseSalesPresenter({ appointment, onClose }) {
  const [presentation, setPresentation] = useState(null)
  const [slides, setSlides] = useState([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const type = isSolarAppointment(appointment) ? "solar" : "windows"

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError("")
      const { data: presentationData, error: presentationError } = await supabase
        .from("templates")
        .select("id,name,presentation_type,description")
        .eq("presentation_type", type)
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()
      if (presentationError) { if (mounted) { setError(presentationError.message); setLoading(false) }; return }
      if (!presentationData) { if (mounted) { setError("No active sales presentation is configured for this appointment."); setLoading(false) }; return }
      const { data: slideData, error: slideError } = await supabase
        .from("template_pages")
        .select("id,slide_order,title,subtitle,body,image_url,video_url,slide_type,settings")
        .eq("presentation_id", presentationData.id)
        .order("slide_order", { ascending: true })
      if (slideError) { if (mounted) { setError(slideError.message); setLoading(false) }; return }
      if (mounted) { setPresentation(presentationData); setSlides(slideData || []); setIndex(0); setLoading(false) }
    }
    load()
    return () => { mounted = false }
  }, [type])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.()
      if (event.key === "ArrowRight") setIndex(value => Math.min(value + 1, Math.max(slides.length - 1, 0)))
      if (event.key === "ArrowLeft") setIndex(value => Math.max(value - 1, 0))
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose, slides.length])

  const slide = slides[index]
  const isSlideOne = index === 0 && Boolean(slide?.settings?.visual || slide?.settings?.cover)

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: "#07111c", color: "#fff", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", borderBottom: "1px solid rgba(255,255,255,.12)", flex: "0 0 auto" }}>
        <div><div style={{ fontSize: 14, fontWeight: 800 }}>{presentation?.name || (type === "solar" ? "Solar Presentation" : "Windows & Doors Presentation")}</div><div style={{ fontSize: 10, opacity: .65, marginTop: 3 }}>{appointment?.name || appointment?.customer_name || "Customer"}</div></div>
        <button type="button" onClick={onClose} style={{ border: 0, background: "rgba(255,255,255,.08)", color: "#fff", width: 36, height: 36, borderRadius: 8, cursor: "pointer" }} aria-label="Close presenter"><X size={18} /></button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: isSlideOne ? 0 : 28 }}>
        {loading ? <div style={{ fontSize: 14, opacity: .7 }}>Loading presentation...</div> : error ? <div style={{ maxWidth: 520, textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Presenter unavailable</div><div style={{ fontSize: 12, opacity: .7 }}>{error}</div></div> : slide ? (isSlideOne ? <SlideOne slide={slide} appointment={appointment} /> : <StandardSlide slide={slide} appointment={appointment} />) : <div style={{ fontSize: 14, opacity: .7 }}>This presentation has no slides yet.</div>}
      </div>
      <div style={{ height: 68, display: "flex", alignItems: "center", justifyContent: "center", gap: 18, flex: "0 0 auto" }}>
        <button type="button" disabled={index === 0 || !slides.length} onClick={() => setIndex(value => Math.max(value - 1, 0))} style={{ width: 42, height: 42, border: 0, borderRadius: 21, background: index === 0 ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.12)", color: "#fff", cursor: index === 0 ? "default" : "pointer" }} aria-label="Previous slide"><ChevronLeft size={20} /></button>
        <div style={{ minWidth: 80, textAlign: "center", fontSize: 11, opacity: .7 }}>{slides.length ? `${index + 1} / ${slides.length}` : "0 / 0"}</div>
        <button type="button" disabled={index >= slides.length - 1 || !slides.length} onClick={() => setIndex(value => Math.min(value + 1, slides.length - 1))} style={{ width: 42, height: 42, border: 0, borderRadius: 21, background: index >= slides.length - 1 ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.12)", color: "#fff", cursor: index >= slides.length - 1 ? "default" : "pointer" }} aria-label="Next slide"><ChevronRight size={20} /></button>
      </div>
    </div>
  )
}

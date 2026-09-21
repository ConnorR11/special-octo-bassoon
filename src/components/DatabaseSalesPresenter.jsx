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

function CoverIcon({ type, size = 14 }) {
  const Icon = type === "battery" ? BatteryCharging : type === "money" ? PoundSterling : Sun
  return <Icon size={size} />
}

function DatabaseCover({ slide, appointment }) {
  const s = slide?.settings || {}
  const cover = s.cover || {}
  const benefits = Array.isArray(s.benefits) && s.benefits.length ? s.benefits : ["Generate", "Store", "Save"]
  const benefitIcons = Array.isArray(cover.benefit_icons) && cover.benefit_icons.length ? cover.benefit_icons : ["sun", "battery", "money"]
  const customer = interpolate("{{customer_name}}", appointment)
  const title = interpolate(slide?.title || "", appointment)
  const subtitle = interpolate(slide?.subtitle || "", appointment)
  const eyebrow = interpolate(s.eyebrow || "", appointment)
  const tagline = interpolate(s.tagline || "", appointment)
  const background = cover.background || "radial-gradient(circle at 70% 38%, #12639a 0%, #083f69 35%, #032d50 68%, #021f38 100%)"
  const accent = cover.accent || "#7dd3fc"
  const logoUrl = cover.logo_url || "/homeshield-logo.png"
  const heroSvg = cover.hero_svg || ""

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 0, overflow: "hidden", display: "flex", color: cover.text_color || "#fff", background }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: cover.overlay || "radial-gradient(ellipse at 73% 50%, rgba(75,190,255,.16), transparent 45%), radial-gradient(ellipse at 20% 90%, rgba(0,0,0,.25), transparent 55%)" }} />
      <div style={{ position: "relative", zIndex: 2, width: cover.left_width || "58%", padding: cover.left_padding || "clamp(30px,5vw,68px) clamp(28px,5vw,70px) 38px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxSizing: "border-box" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: cover.logo_gap || 12 }}>
            <img src={logoUrl} alt={s.brand || "HomeShield Scotland"} style={{ width: cover.logo_width || "clamp(42px,4.2vw,58px)", height: "auto", objectFit: "contain", filter: cover.logo_shadow || "drop-shadow(0 4px 8px rgba(0,0,0,.28))" }} />
            <div>
              <div style={{ fontSize: cover.brand_size || "clamp(10px,1vw,14px)", fontWeight: 800, letterSpacing: ".08em" }}>{s.brand || "HOMESHIELD SCOTLAND LTD"}</div>
              <div style={{ marginTop: 4, fontSize: cover.tagline_size || "clamp(8px,.8vw,11px)", color: cover.muted_color || "rgba(255,255,255,.66)" }}>{tagline || "Enhancing Homes Across Scotland"}</div>
            </div>
          </div>
          <div style={{ marginTop: cover.content_top_margin || "clamp(45px,8vh,82px)" }}>
            {eyebrow && <div style={{ display: "inline-block", padding: cover.eyebrow_padding || "7px 11px", borderRadius: 999, background: cover.eyebrow_background || "rgba(125,211,252,.10)", border: `1px solid ${cover.eyebrow_border || "rgba(125,211,252,.25)"}`, color: accent, fontSize: cover.eyebrow_size || "clamp(9px,.9vw,12px)", fontWeight: 800, letterSpacing: ".15em", textTransform: "uppercase", marginBottom: 17 }}>{eyebrow}</div>}
            <div style={{ fontSize: cover.title_size || "clamp(38px,5.1vw,74px)", lineHeight: .96, fontWeight: 800, letterSpacing: "-.045em" }}>{title}</div>
            {subtitle && <div style={{ marginTop: 20, maxWidth: cover.subtitle_max_width || 560, fontSize: cover.subtitle_size || "clamp(14px,1.45vw,21px)", lineHeight: 1.4, color: cover.subtitle_color || "rgba(255,255,255,.78)" }}>{subtitle}</div>}
          </div>
        </div>
        <div style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 8, padding: cover.customer_padding || "8px 13px", borderRadius: 999, background: cover.customer_background || "rgba(0,0,0,.16)", border: `1px solid ${cover.customer_border || "rgba(255,255,255,.12)"}`, fontSize: cover.customer_size || "clamp(9px,.9vw,12px)", color: cover.customer_muted || "rgba(255,255,255,.75)" }}><span style={{ width: 6, height: 6, borderRadius: 50, background: accent }} />Prepared for <strong style={{ color: "#fff" }}>{customer}</strong></div>
      </div>
      <div style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: cover.hero_padding || "35px 32px 70px 0", boxSizing: "border-box" }}>
        {heroSvg ? <div style={{ width: cover.hero_width || "min(430px,42vw)", maxWidth: "100%" }} dangerouslySetInnerHTML={{ __html: interpolate(heroSvg, appointment) }} /> : <div style={{ opacity: .5, fontSize: 12 }}>No cover artwork configured</div>}
      </div>
      <div style={{ position: "absolute", zIndex: 4, left: "50%", bottom: cover.benefits_bottom || 20, transform: "translateX(-50%)", display: "flex", gap: 8, whiteSpace: "nowrap" }}>
        {benefits.map((label, i) => <div key={`${label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 6, padding: cover.benefit_padding || "6px 10px", borderRadius: 8, background: cover.benefit_background || "rgba(0,0,0,.16)", border: `1px solid ${cover.benefit_border || "rgba(255,255,255,.1)"}`, fontSize: cover.benefit_size || "clamp(8px,.75vw,10px)", color: cover.benefit_color || "rgba(255,255,255,.72)" }}><CoverIcon type={benefitIcons[i % benefitIcons.length]} size={12} />{interpolate(label, appointment)}</div>)}
      </div>
    </div>
  )
}

function StandardSlide({ slide, appointment }) {
  return (
    <div style={{ width: "min(1200px,94vw)", height: "min(675px,76vh)", background: "#fff", color: "#172033", borderRadius: 16, overflow: "hidden", boxShadow: "0 25px 80px rgba(0,0,0,.35)", display: "flex", flexDirection: "column" }}>
      {slide.image_url && <div style={{ flex: "0 0 42%", backgroundImage: `url(${slide.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />}
      {slide.video_url && <video src={slide.video_url} controls autoPlay style={{ width: "100%", maxHeight: "46%", objectFit: "cover" }} />}
      <div style={{ flex: 1, minHeight: 0, padding: "clamp(28px,5vw,64px)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {slide.settings?.eyebrow && <div style={{ display: "inline-block", marginBottom: 14, color: slide.settings?.accent || "#2499ed", fontSize: "clamp(10px,1vw,13px)", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase" }}>{interpolate(slide.settings.eyebrow, appointment)}</div>}
        <div style={{ fontSize: "clamp(28px,4vw,54px)", lineHeight: 1.05, fontWeight: 800 }}>{interpolate(slide.title, appointment)}</div>
        {slide.subtitle && <div style={{ marginTop: 14, fontSize: "clamp(16px,2vw,24px)", color: slide.settings?.accent || "#2499ed", fontWeight: 700 }}>{interpolate(slide.subtitle, appointment)}</div>}
        {slide.body && <div style={{ marginTop: 22, maxWidth: 850, whiteSpace: "pre-wrap", fontSize: "clamp(14px,1.5vw,19px)", lineHeight: 1.6, color: "#52606d" }}>{interpolate(slide.body, appointment)}</div>}
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
        .from("sales_presentations")
        .select("id,name,presentation_type,description")
        .eq("presentation_type", type)
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()
      if (presentationError) { if (mounted) { setError(presentationError.message); setLoading(false) }; return }
      if (!presentationData) { if (mounted) { setError("No active sales presentation is configured for this appointment."); setLoading(false) }; return }
      const { data: slideData, error: slideError } = await supabase
        .from("sales_presentation_slides")
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
  const isDatabaseCover = slide?.settings?.layout === "solar-cover"

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: "#07111c", color: "#fff", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", borderBottom: "1px solid rgba(255,255,255,.12)", flex: "0 0 auto" }}>
        <div><div style={{ fontSize: 14, fontWeight: 800 }}>{presentation?.name || (type === "solar" ? "Solar Presentation" : "Windows & Doors Presentation")}</div><div style={{ fontSize: 10, opacity: .65, marginTop: 3 }}>{appointment?.name || appointment?.customer_name || "Customer"}</div></div>
        <button type="button" onClick={onClose} style={{ border: 0, background: "rgba(255,255,255,.08)", color: "#fff", width: 36, height: 36, borderRadius: 8, cursor: "pointer" }} aria-label="Close presenter"><X size={18} /></button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: isDatabaseCover ? 0 : 28 }}>
        {loading ? <div style={{ fontSize: 14, opacity: .7 }}>Loading presentation...</div> : error ? <div style={{ maxWidth: 520, textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Presenter unavailable</div><div style={{ fontSize: 12, opacity: .7 }}>{error}</div></div> : slide ? (isDatabaseCover ? <DatabaseCover slide={slide} appointment={appointment} /> : <StandardSlide slide={slide} appointment={appointment} />) : <div style={{ fontSize: 14, opacity: .7 }}>This presentation has no slides yet.</div>}
      </div>
      <div style={{ height: 68, display: "flex", alignItems: "center", justifyContent: "center", gap: 18, flex: "0 0 auto" }}>
        <button type="button" disabled={index === 0 || !slides.length} onClick={() => setIndex(value => Math.max(value - 1, 0))} style={{ width: 42, height: 42, border: 0, borderRadius: 21, background: index === 0 ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.12)", color: "#fff", cursor: index === 0 ? "default" : "pointer" }} aria-label="Previous slide"><ChevronLeft size={20} /></button>
        <div style={{ minWidth: 80, textAlign: "center", fontSize: 11, opacity: .7 }}>{slides.length ? `${index + 1} / ${slides.length}` : "0 / 0"}</div>
        <button type="button" disabled={index >= slides.length - 1 || !slides.length} onClick={() => setIndex(value => Math.min(value + 1, slides.length - 1))} style={{ width: 42, height: 42, border: 0, borderRadius: 21, background: index >= slides.length - 1 ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.12)", color: "#fff", cursor: index >= slides.length - 1 ? "default" : "pointer" }} aria-label="Next slide"><ChevronRight size={20} /></button>
      </div>
    </div>
  )
}

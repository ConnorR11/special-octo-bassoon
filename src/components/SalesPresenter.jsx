import React, { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Maximize2, X, Sun, BatteryCharging, PoundSterling } from "lucide-react"
import { supabase } from "../lib/supabase"

function isSolarAppointment(appointment) {
  const text = [appointment?.product, appointment?.job_type, appointment?.measure, appointment?.service].filter(Boolean).join(" ").toLowerCase()
  return text.includes("solar")
}

function interpolate(value, appointment) {
  if (value == null) return ""
  const customer = String(appointment?.name || "").trim() || String(appointment?.customer_name || "").trim() || "Customer"
  const replacements = { customer_name: customer, name: customer, postcode: appointment?.postcode || "", address: appointment?.address || "", product: appointment?.product || appointment?.job_type || "" }
  return String(value).replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key) => replacements[key.toLowerCase()] ?? "")
}

function SolarCoverSlide({ slide, appointment }) {
  const settings = slide?.settings || {}
  const customer = String(appointment?.name || "").trim() || String(appointment?.customer_name || "").trim() || "Customer"
  const benefits = Array.isArray(settings.benefits) && settings.benefits.length ? settings.benefits : ["Generate", "Store", "Save"]
  const icons = [Sun, BatteryCharging, PoundSterling]
  const title = interpolate(slide?.title || "", appointment)
  const subtitle = interpolate(slide?.subtitle || "", appointment)
  const eyebrow = interpolate(settings.eyebrow || "", appointment)
  const tagline = interpolate(settings.tagline || "", appointment)

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 0, overflow: "hidden", display: "flex", color: "#fff", background: "radial-gradient(circle at 70% 38%, #12639a 0%, #083f69 35%, #032d50 68%, #021f38 100%)" }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 73% 50%, rgba(75,190,255,.16), transparent 45%), radial-gradient(ellipse at 20% 90%, rgba(0,0,0,.25), transparent 55%)" }} />
      <div style={{ position: "relative", zIndex: 2, width: "58%", padding: "clamp(30px,5vw,68px) clamp(28px,5vw,70px) 38px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxSizing: "border-box" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/homeshield-logo.png" alt="HomeShield Scotland" style={{ width: "clamp(42px,4.2vw,58px)", height: "auto", objectFit: "contain", filter: "drop-shadow(0 4px 8px rgba(0,0,0,.28))" }} />
            <div>
              <div style={{ fontSize: "clamp(10px,1vw,14px)", fontWeight: 800, letterSpacing: ".08em" }}>{settings.brand || "HOMESHIELD SCOTLAND LTD"}</div>
              <div style={{ marginTop: 4, fontSize: "clamp(8px,.8vw,11px)", color: "rgba(255,255,255,.66)" }}>{tagline || "Enhancing Homes Across Scotland"}</div>
            </div>
          </div>
          <div style={{ marginTop: "clamp(45px,8vh,82px)" }}>
            {eyebrow && <div style={{ display: "inline-block", padding: "7px 11px", borderRadius: 999, background: "rgba(125,211,252,.10)", border: "1px solid rgba(125,211,252,.25)", color: "#7dd3fc", fontSize: "clamp(9px,.9vw,12px)", fontWeight: 800, letterSpacing: ".15em", textTransform: "uppercase", marginBottom: 17 }}>{eyebrow}</div>}
            <div style={{ fontSize: "clamp(38px,5.1vw,74px)", lineHeight: .96, fontWeight: 800, letterSpacing: "-.045em" }}>{title}</div>
            {subtitle && <div style={{ marginTop: 20, maxWidth: 560, fontSize: "clamp(14px,1.45vw,21px)", lineHeight: 1.4, color: "rgba(255,255,255,.78)" }}>{subtitle}</div>}
          </div>
        </div>
        <div style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 8, padding: "8px 13px", borderRadius: 999, background: "rgba(0,0,0,.16)", border: "1px solid rgba(255,255,255,.12)", fontSize: "clamp(9px,.9vw,12px)", color: "rgba(255,255,255,.75)" }}><span style={{ width: 6, height: 6, borderRadius: 50, background: "#7dd3fc" }} />Prepared for <strong style={{ color: "#fff" }}>{customer}</strong></div>
      </div>
      <div style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "35px 32px 70px 0", boxSizing: "border-box" }}>
        <div style={{ position: "relative", width: "min(410px,40vw)", aspectRatio: "1.05" }}>
          <div style={{ position: "absolute", top: "2%", right: "6%", width: "24%", aspectRatio: 1, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,221,130,.95), rgba(255,184,70,.22) 42%, transparent 72%)" }} />
          <div style={{ position: "absolute", left: "10%", right: "3%", bottom: "8%", height: "57%", background: "linear-gradient(135deg,#edf6f8,#b7d0da)", clipPath: "polygon(7% 35%,50% 0,93% 35%,93% 100%,7% 100%)", boxShadow: "0 25px 55px rgba(0,0,0,.32)" }} />
          <div style={{ position: "absolute", left: "3%", right: "10%", top: "27%", height: "31%", background: "linear-gradient(180deg,#123f62,#071e35)", clipPath: "polygon(0 100%,50% 0,100% 100%)" }} />
          <div style={{ position: "absolute", left: "17%", right: "20%", top: "30%", height: "22%", transform: "skewX(-10deg)", background: "repeating-linear-gradient(90deg,#123f61 0 17px,#5e91ae 18px 19px),repeating-linear-gradient(0deg,transparent 0 13px,rgba(255,255,255,.35) 14px 15px)", border: "2px solid rgba(255,255,255,.3)", boxShadow: "0 8px 25px rgba(0,0,0,.25)" }} />
          <div style={{ position: "absolute", left: "42%", bottom: "8%", width: "14%", height: "30%", background: "#7893a0", borderRadius: "4px 4px 0 0" }} />
          <div style={{ position: "absolute", left: "16%", bottom: "8%", width: "19%", height: "20%", background: "#183d55", border: "3px solid rgba(255,255,255,.18)" }} />
          <div style={{ position: "absolute", right: "7%", bottom: "7%", width: 66, height: 100, borderRadius: 9, background: "linear-gradient(145deg,#f5fbfd,#b9d6e0)", boxShadow: "0 18px 35px rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.45)" }}><div style={{ margin: 9, height: 5, borderRadius: 5, background: "#2499ed" }} /><div style={{ margin: "15px 12px", height: 40, borderRadius: 5, background: "#d7e7ed", border: "1px solid #a9c3ce" }} /></div>
          <div style={{ position: "absolute", left: "-5%", right: "-5%", bottom: 0, height: 35, borderRadius: "50%", background: "rgba(2,20,35,.55)", filter: "blur(12px)" }} />
        </div>
      </div>
      <div style={{ position: "absolute", zIndex: 4, left: "50%", bottom: 20, transform: "translateX(-50%)", display: "flex", gap: 8, whiteSpace: "nowrap" }}>
        {benefits.map((label, i) => { const Icon = icons[i % icons.length]; return <div key={`${label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "rgba(0,0,0,.16)", border: "1px solid rgba(255,255,255,.1)", fontSize: "clamp(8px,.75vw,10px)", color: "rgba(255,255,255,.72)" }}><Icon size={12} />{interpolate(label, appointment)}</div> })}
      </div>
    </div>
  )
}

export default function SalesPresenter({ appointment, onClose }) {
  const [presentation, setPresentation] = useState(null)
  const [slides, setSlides] = useState([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const type = isSolarAppointment(appointment) ? "solar" : "windows"

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true); setError("")
      const { data: presentationData, error: presentationError } = await supabase.from("sales_presentations").select("id,name,presentation_type,description").eq("presentation_type", type).eq("active", true).order("created_at", { ascending: true }).limit(1).maybeSingle()
      if (presentationError) { if (mounted) { setError(presentationError.message); setLoading(false) }; return }
      if (!presentationData) { if (mounted) { setError("No active sales presentation is configured for this appointment."); setLoading(false) }; return }
      const { data: slideData, error: slideError } = await supabase.from("sales_presentation_slides").select("id,slide_order,title,subtitle,body,image_url,video_url,slide_type,settings").eq("presentation_id", presentationData.id).order("slide_order", { ascending: true })
      if (slideError) { if (mounted) { setError(slideError.message); setLoading(false) }; return }
      if (mounted) { setPresentation(presentationData); setSlides(slideData || []); setIndex(0); setLoading(false) }
    }
    load(); return () => { mounted = false }
  }, [type])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.()
      if (event.key === "ArrowRight") setIndex(value => Math.min(value + 1, Math.max(slides.length - 1, 0)))
      if (event.key === "ArrowLeft") setIndex(value => Math.max(value - 1, 0))
    }
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose, slides.length])

  const slide = slides[index]
  const isSolarCover = slide?.settings?.layout === "solar-cover"

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: "#07111c", color: "#fff", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", borderBottom: "1px solid rgba(255,255,255,.12)", flex: "0 0 auto" }}><div><div style={{ fontSize: 14, fontWeight: 800 }}>{presentation?.name || (type === "solar" ? "Solar Presentation" : "Windows & Doors Presentation")}</div><div style={{ fontSize: 10, opacity: .65, marginTop: 3 }}>{appointment?.name || appointment?.customer_name || "Customer"}</div></div><button type="button" onClick={onClose} style={{ border: 0, background: "rgba(255,255,255,.08)", color: "#fff", width: 36, height: 36, borderRadius: 8, cursor: "pointer" }} aria-label="Close presenter"><X size={18} /></button></div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: isSolarCover ? 0 : 28 }}>
        {loading ? <div style={{ fontSize: 14, opacity: .7 }}>Loading presentation...</div> : error ? <div style={{ maxWidth: 520, textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Presenter unavailable</div><div style={{ fontSize: 12, opacity: .7 }}>{error}</div></div> : slide ? (isSolarCover ? <SolarCoverSlide slide={slide} appointment={appointment} /> : <div style={{ width: "min(1200px,94vw)", height: "min(675px,76vh)", background: "#fff", color: "#172033", borderRadius: 16, overflow: "hidden", boxShadow: "0 25px 80px rgba(0,0,0,.35)", display: "flex", flexDirection: "column" }}>{slide.image_url && <div style={{ flex: "0 0 42%", backgroundImage: `url(${slide.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />}{slide.video_url && <video src={slide.video_url} controls autoPlay style={{ width: "100%", maxHeight: "46%", objectFit: "cover" }} />}<div style={{ flex: 1, minHeight: 0, padding: "clamp(28px,5vw,64px)", display: "flex", flexDirection: "column", justifyContent: "center" }}>{slide.settings?.eyebrow && <div style={{ display: "inline-block", marginBottom: 14, color: "#2499ed", fontSize: "clamp(10px,1vw,13px)", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase" }}>{interpolate(slide.settings.eyebrow, appointment)}</div>}<div style={{ fontSize: "clamp(28px,4vw,54px)", lineHeight: 1.05, fontWeight: 800 }}>{interpolate(slide.title, appointment)}</div>{slide.subtitle && <div style={{ marginTop: 14, fontSize: "clamp(16px,2vw,24px)", color: "#2499ed", fontWeight: 700 }}>{interpolate(slide.subtitle, appointment)}</div>}{slide.body && <div style={{ marginTop: 22, maxWidth: 850, whiteSpace: "pre-wrap", fontSize: "clamp(14px,1.5vw,19px)", lineHeight: 1.6, color: "#52606d" }}>{interpolate(slide.body, appointment)}</div>}</div></div>) : <div style={{ fontSize: 14, opacity: .7 }}>This presentation has no slides yet.</div>}
      </div>
      <div style={{ height: 68, display: "flex", alignItems: "center", justifyContent: "center", gap: 18, flex: "0 0 auto" }}><button type="button" disabled={index === 0 || !slides.length} onClick={() => setIndex(value => Math.max(value - 1, 0))} style={{ width: 42, height: 42, border: 0, borderRadius: 21, background: index === 0 ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.12)", color: "#fff", cursor: index === 0 ? "default" : "pointer" }}><ChevronLeft size={20} /></button><div style={{ display: "flex", alignItems: "center", gap: 6 }}>{slides.map((item, itemIndex) => <button key={item.id} type="button" aria-label={`Go to slide ${itemIndex + 1}`} onClick={() => setIndex(itemIndex)} style={{ width: itemIndex === index ? 22 : 6, height: 6, border: 0, borderRadius: 6, padding: 0, background: itemIndex === index ? "#2499ed" : "rgba(255,255,255,.25)", cursor: "pointer" }} />)}</div><button type="button" disabled={index >= slides.length - 1 || !slides.length} onClick={() => setIndex(value => Math.min(value + 1, slides.length - 1))} style={{ width: 42, height: 42, border: 0, borderRadius: 21, background: index >= slides.length - 1 ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.12)", color: "#fff", cursor: index >= slides.length - 1 ? "default" : "pointer" }}><ChevronRight size={20} /></button></div>
      <div style={{ position: "absolute", right: 22, bottom: 18, fontSize: 9, opacity: .45 }}><Maximize2 size={11} style={{ verticalAlign: "middle", marginRight: 5 }} />Use ← → to navigate · Esc to close</div>
    </div>
  )
}

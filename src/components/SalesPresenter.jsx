import React, { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react"
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
  const customer = appointment?.name || appointment?.customer_name || "Customer"
  const replacements = {
    customer_name: customer,
    name: customer,
    postcode: appointment?.postcode || "",
    address: appointment?.address || "",
    product: appointment?.product || appointment?.job_type || "",
  }
  return String(value).replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key) => replacements[key.toLowerCase()] ?? "")
}

function SolarCoverSlide() {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        color: "#fff",
        background:
          "radial-gradient(circle at 50% 40%, #0c4b78 0%, #06365c 34%, #022b4c 67%, #012642 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at 50% 46%, rgba(39,139,205,.24) 0%, rgba(8,61,99,.10) 40%, rgba(0,27,49,.30) 100%)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          padding: "4vh 5vw 7vh",
          boxSizing: "border-box",
        }}
      >
        <img
          src="/homeshield-logo.png"
          alt="HomeShield Scotland"
          style={{
            width: "clamp(70px, 7vw, 105px)",
            height: "auto",
            objectFit: "contain",
            marginBottom: "clamp(12px, 1.5vh, 20px)",
            filter: "drop-shadow(0 4px 8px rgba(0,0,0,.28))",
          }}
        />

        <div
          style={{
            fontSize: "clamp(18px, 2.05vw, 31px)",
            lineHeight: 1,
            fontWeight: 800,
            letterSpacing: "-.025em",
            textTransform: "uppercase",
          }}
        >
          HOMESHIELD SCOTLAND LTD
        </div>

        <div
          style={{
            marginTop: "clamp(5px, .7vh, 9px)",
            fontSize: "clamp(13px, 1.35vw, 20px)",
            lineHeight: 1,
            fontWeight: 400,
            opacity: .9,
          }}
        >
          Enhancing Homes Across Scotland
        </div>

        <div
          style={{
            marginTop: "clamp(55px, 10vh, 105px)",
            fontSize: "clamp(48px, 7vw, 100px)",
            lineHeight: .96,
            fontWeight: 800,
            letterSpacing: "-.045em",
            whiteSpace: "nowrap",
          }}
        >
          Homeshield Renewables
        </div>

        <div
          style={{
            marginTop: "clamp(8px, 1vh, 14px)",
            fontSize: "clamp(34px, 5.2vw, 75px)",
            lineHeight: .98,
            fontWeight: 400,
            letterSpacing: "-.035em",
            whiteSpace: "nowrap",
          }}
        >
          Solar Energy Systems
        </div>
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
      if (presentationError) {
        if (mounted) { setError(presentationError.message); setLoading(false) }
        return
      }
      if (!presentationData) {
        if (mounted) { setError("No active sales presentation is configured for this appointment."); setLoading(false) }
        return
      }
      const { data: slideData, error: slideError } = await supabase
        .from("sales_presentation_slides")
        .select("id,slide_order,title,subtitle,body,image_url,video_url,slide_type,settings")
        .eq("presentation_id", presentationData.id)
        .order("slide_order", { ascending: true })
      if (slideError) {
        if (mounted) { setError(slideError.message); setLoading(false) }
        return
      }
      if (mounted) {
        setPresentation(presentationData)
        setSlides(slideData || [])
        setIndex(0)
        setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [type])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.()
      if (event.key === "ArrowRight") setIndex((value) => Math.min(value + 1, Math.max(slides.length - 1, 0)))
      if (event.key === "ArrowLeft") setIndex((value) => Math.max(value - 1, 0))
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose, slides.length])

  const slide = slides[index]
  const isSolarCover = type === "solar" && index === 0

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: "#07111c", color: "#fff", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", borderBottom: "1px solid rgba(255,255,255,.12)", flex: "0 0 auto" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{presentation?.name || (type === "solar" ? "Solar Presentation" : "Windows & Doors Presentation")}</div>
          <div style={{ fontSize: 10, opacity: .65, marginTop: 3 }}>{appointment?.name || appointment?.customer_name || "Customer"}</div>
        </div>
        <button type="button" onClick={onClose} style={{ border: 0, background: "rgba(255,255,255,.08)", color: "#fff", width: 36, height: 36, borderRadius: 8, cursor: "pointer" }} aria-label="Close presenter"><X size={18} /></button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: isSolarCover ? 0 : 28 }}>
        {loading ? <div style={{ fontSize: 14, opacity: .7 }}>Loading presentation...</div> : error ? <div style={{ maxWidth: 520, textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Presenter unavailable</div><div style={{ fontSize: 12, opacity: .7 }}>{error}</div></div> : slide ? (
          isSolarCover ? (
            <SolarCoverSlide />
          ) : (
            <div style={{ width: "min(1200px, 94vw)", height: "min(675px, 76vh)", background: "#fff", color: "#172033", borderRadius: 16, overflow: "hidden", boxShadow: "0 25px 80px rgba(0,0,0,.35)", display: "flex", flexDirection: "column" }}>
              {slide.image_url && <div style={{ flex: "0 0 42%", backgroundImage: `url(${slide.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />}
              {slide.video_url && <video src={slide.video_url} controls autoPlay style={{ width: "100%", maxHeight: "46%", objectFit: "cover" }} />}
              <div style={{ flex: 1, minHeight: 0, padding: "clamp(28px,5vw,64px)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ fontSize: "clamp(28px,4vw,54px)", lineHeight: 1.05, fontWeight: 800 }}>{interpolate(slide.title, appointment)}</div>
                {slide.subtitle && <div style={{ marginTop: 14, fontSize: "clamp(16px,2vw,24px)", color: "#2499ed", fontWeight: 700 }}>{interpolate(slide.subtitle, appointment)}</div>}
                {slide.body && <div style={{ marginTop: 22, maxWidth: 850, whiteSpace: "pre-wrap", fontSize: "clamp(14px,1.5vw,19px)", lineHeight: 1.6, color: "#52606d" }}>{interpolate(slide.body, appointment)}</div>}
              </div>
            </div>
          )
        ) : <div style={{ fontSize: 14, opacity: .7 }}>This presentation has no slides yet.</div>}
      </div>

      <div style={{ height: 68, display: "flex", alignItems: "center", justifyContent: "center", gap: 18, flex: "0 0 auto" }}>
        <button type="button" disabled={index === 0 || !slides.length} onClick={() => setIndex((value) => Math.max(value - 1, 0))} style={{ width: 42, height: 42, border: 0, borderRadius: 21, background: index === 0 ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.12)", color: "#fff", cursor: index === 0 ? "default" : "pointer" }}><ChevronLeft size={20} /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{slides.map((item, itemIndex) => <button key={item.id} type="button" aria-label={`Go to slide ${itemIndex + 1}`} onClick={() => setIndex(itemIndex)} style={{ width: itemIndex === index ? 22 : 6, height: 6, border: 0, borderRadius: 6, padding: 0, background: itemIndex === index ? "#2499ed" : "rgba(255,255,255,.25)", cursor: "pointer" }} />)}</div>
        <button type="button" disabled={index >= slides.length - 1 || !slides.length} onClick={() => setIndex((value) => Math.min(value + 1, slides.length - 1))} style={{ width: 42, height: 42, border: 0, borderRadius: 21, background: index >= slides.length - 1 ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.12)", color: "#fff", cursor: index >= slides.length - 1 ? "default" : "pointer" }}><ChevronRight size={20} /></button>
      </div>
      <div style={{ position: "absolute", right: 22, bottom: 18, fontSize: 9, opacity: .45 }}><Maximize2 size={11} style={{ verticalAlign: "middle", marginRight: 5 }} />Use ← → to navigate · Esc to close</div>
    </div>
  )
}

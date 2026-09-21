import React, { useEffect, useMemo, useState } from "react"
import { Plus, Save, Trash2, GripVertical, ChevronLeft, ChevronRight, Eye, Presentation, Image, Video, BarChart3, FileText } from "lucide-react"
import { supabase } from "../lib/supabase"

const EMPTY_SLIDE = { title: "", subtitle: "", body: "", image_url: "", video_url: "", slide_type: "content", settings: {} }

export default function SalesPresentations() {
  const [presentations, setPresentations] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [slides, setSlides] = useState([])
  const [selectedSlideId, setSelectedSlideId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [preview, setPreview] = useState(false)

  const selectedPresentation = useMemo(() => presentations.find((item) => item.id === selectedId) || null, [presentations, selectedId])
  const selectedSlide = useMemo(() => slides.find((item) => item.id === selectedSlideId) || null, [slides, selectedSlideId])

  async function loadPresentations() {
    setLoading(true); setError("")
    const { data, error: queryError } = await supabase.from("sales_presentations").select("*").order("created_at")
    if (queryError) { setError(queryError.message); setLoading(false); return }
    const list = data || []
    setPresentations(list)
    const nextId = selectedId && list.some((item) => item.id === selectedId) ? selectedId : list[0]?.id || null
    setSelectedId(nextId)
    setLoading(false)
  }

  async function loadSlides(presentationId) {
    if (!presentationId) { setSlides([]); setSelectedSlideId(null); return }
    const { data, error: queryError } = await supabase.from("sales_presentation_slides").select("*").eq("presentation_id", presentationId).order("slide_order")
    if (queryError) { setError(queryError.message); return }
    const list = data || []
    setSlides(list)
    setSelectedSlideId(list[0]?.id || null)
  }

  useEffect(() => { loadPresentations() }, [])
  useEffect(() => { loadSlides(selectedId) }, [selectedId])

  async function updatePresentation(changes) {
    if (!selectedPresentation) return
    setSaving(true); setError("")
    const { data, error: updateError } = await supabase.from("sales_presentations").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", selectedPresentation.id).select().single()
    if (updateError) setError(updateError.message)
    else setPresentations((current) => current.map((item) => item.id === data.id ? data : item))
    setSaving(false)
  }

  async function addSlide() {
    if (!selectedPresentation) return
    setSaving(true); setError("")
    const nextOrder = slides.length ? Math.max(...slides.map((item) => item.slide_order || 0)) + 1 : 1
    const { data, error: insertError } = await supabase.from("sales_presentation_slides").insert({ presentation_id: selectedPresentation.id, slide_order: nextOrder, ...EMPTY_SLIDE }).select().single()
    if (insertError) setError(insertError.message)
    else { setSlides((current) => [...current, data]); setSelectedSlideId(data.id) }
    setSaving(false)
  }

  async function saveSlide() {
    if (!selectedSlide) return
    setSaving(true); setError("")
    const { data, error: updateError } = await supabase.from("sales_presentation_slides").update({ title: selectedSlide.title, subtitle: selectedSlide.subtitle, body: selectedSlide.body, image_url: selectedSlide.image_url, video_url: selectedSlide.video_url, slide_type: selectedSlide.slide_type, settings: selectedSlide.settings || {}, updated_at: new Date().toISOString() }).eq("id", selectedSlide.id).select().single()
    if (updateError) setError(updateError.message)
    else setSlides((current) => current.map((item) => item.id === data.id ? data : item))
    setSaving(false)
  }

  async function deleteSlide() {
    if (!selectedSlide || !window.confirm("Delete this slide?")) return
    setSaving(true); setError("")
    const { error: deleteError } = await supabase.from("sales_presentation_slides").delete().eq("id", selectedSlide.id)
    if (deleteError) setError(deleteError.message)
    else { const remaining = slides.filter((item) => item.id !== selectedSlide.id); await resequence(remaining); setSlides(remaining.map((item, index) => ({ ...item, slide_order: index + 1 }))); setSelectedSlideId(remaining[0]?.id || null) }
    setSaving(false)
  }

  async function resequence(items) {
    await Promise.all(items.map((item, index) => supabase.from("sales_presentation_slides").update({ slide_order: index + 1 }).eq("id", item.id)))
  }

  async function moveSlide(direction) {
    if (!selectedSlide) return
    const index = slides.findIndex((item) => item.id === selectedSlide.id)
    const target = index + direction
    if (target < 0 || target >= slides.length) return
    const next = [...slides]; [next[index], next[target]] = [next[target], next[index]]
    setSlides(next.map((item, position) => ({ ...item, slide_order: position + 1 })))
    await resequence(next)
  }

  function updateSlide(field, value) { setSlides((current) => current.map((item) => item.id === selectedSlideId ? { ...item, [field]: value } : item)) }

  function slideIcon(type) { return type === "image" ? <Image size={15} /> : type === "video" ? <Video size={15} /> : type === "stats" ? <BarChart3 size={15} /> : <FileText size={15} /> }

  if (preview && selectedPresentation) {
    return <PresentationPreview presentation={selectedPresentation} slides={slides} onClose={() => setPreview(false)} />
  }

  return <section>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}><Presentation size={24} color="#2499ed" /><div><h1 style={{ margin: 0, fontSize: 22 }}>Sales Presentations</h1><p style={{ margin: "5px 0 0", fontSize: 11, color: "#888" }}>Manage the presentations used by sales appointments.</p></div></div>
      {selectedPresentation && <button onClick={() => setPreview(true)} style={buttonStyle}><Eye size={14} /> Preview</button>}
    </div>
    {error && <div className="error" style={{ marginBottom: 16 }}><b>Database error</b><span>{error}</span></div>}
    {loading ? <div className="card" style={{ padding: 50, textAlign: "center" }}>Loading presentations...</div> : <div style={{ display: "grid", gridTemplateColumns: "260px minmax(0,1fr) 340px", gap: 14, alignItems: "start" }}>
      <div className="card" style={{ padding: 10 }}><div style={panelTitle}>Presentations</div>{presentations.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} style={{ ...listButton, background: item.id === selectedId ? "#eef6ff" : "#fff", borderColor: item.id === selectedId ? "#b8dcff" : "#e8ecef" }}><span><strong>{item.name}</strong><small>{item.presentation_type === "solar" ? "Solar" : "Windows & Doors"}</small></span><span style={{ fontSize: 9, color: item.active ? "#198754" : "#999" }}>{item.active ? "Active" : "Off"}</span></button>)}</div>
      {selectedPresentation ? <>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><div><input value={selectedPresentation.name} onChange={(e) => setPresentations((current) => current.map((item) => item.id === selectedId ? { ...item, name: e.target.value } : item))} onBlur={() => updatePresentation({ name: selectedPresentation.name })} style={titleInput} /><div style={{ fontSize: 10, color: "#8b949e", marginTop: 4 }}>{selectedPresentation.presentation_type === "solar" ? "Solar presentation" : "Windows & Doors presentation"}</div></div><label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 11 }}><input type="checkbox" checked={selectedPresentation.active} onChange={(e) => updatePresentation({ active: e.target.checked })} /> Active</label></div>
          <div style={{ display: "grid", gap: 8 }}>{slides.map((slide, index) => <button key={slide.id} onClick={() => setSelectedSlideId(slide.id)} style={{ ...slideRow, background: slide.id === selectedSlideId ? "#f4f8fc" : "#fff", borderColor: slide.id === selectedSlideId ? "#b8dcff" : "#e5e9ed" }}><GripVertical size={15} color="#aab2b9" /><span style={slideNumber}>{index + 1}</span><span style={{ flex: 1, minWidth: 0, textAlign: "left" }}><strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{slide.title || "Untitled slide"}</strong><small style={{ color: "#8b949e", display: "flex", gap: 5, alignItems: "center", marginTop: 3 }}>{slideIcon(slide.slide_type)} {slide.slide_type}</small></span></button>)}</div>
          <button onClick={addSlide} disabled={saving} style={{ ...buttonStyle, marginTop: 12, width: "100%", justifyContent: "center" }}><Plus size={14} /> Add slide</button>
        </div>
        <div className="card" style={{ padding: 14 }}>{selectedSlide ? <>
          <div style={panelTitle}>Slide {slides.findIndex((item) => item.id === selectedSlideId) + 1}</div>
          <label style={labelStyle}>Slide type<select value={selectedSlide.slide_type} onChange={(e) => updateSlide("slide_type", e.target.value)} style={fieldStyle}><option value="content">Content</option><option value="image">Image</option><option value="stats">Stats</option><option value="video">Video</option></select></label>
          <label style={labelStyle}>Title<input value={selectedSlide.title} onChange={(e) => updateSlide("title", e.target.value)} style={fieldStyle} /></label>
          <label style={labelStyle}>Subtitle<input value={selectedSlide.subtitle || ""} onChange={(e) => updateSlide("subtitle", e.target.value)} style={fieldStyle} /></label>
          <label style={labelStyle}>Body<textarea value={selectedSlide.body || ""} onChange={(e) => updateSlide("body", e.target.value)} rows={7} style={{ ...fieldStyle, resize: "vertical" }} /></label>
          <label style={labelStyle}>Image URL<input value={selectedSlide.image_url || ""} onChange={(e) => updateSlide("image_url", e.target.value)} style={fieldStyle} placeholder="https://..." /></label>
          <label style={labelStyle}>Video URL<input value={selectedSlide.video_url || ""} onChange={(e) => updateSlide("video_url", e.target.value)} style={fieldStyle} placeholder="https://..." /></label>
          <div style={{ display: "flex", gap: 7, marginTop: 14 }}><button onClick={() => moveSlide(-1)} style={iconButton} title="Move up"><ChevronLeft size={15} /></button><button onClick={() => moveSlide(1)} style={iconButton} title="Move down"><ChevronRight size={15} /></button><button onClick={deleteSlide} style={{ ...iconButton, color: "#b42318" }} title="Delete"><Trash2 size={15} /></button><button onClick={saveSlide} disabled={saving} style={{ ...buttonStyle, marginLeft: "auto" }}><Save size={14} /> {saving ? "Saving..." : "Save slide"}</button></div>
        </> : <div style={{ padding: 40, textAlign: "center", color: "#8a939a", fontSize: 11 }}>Select a slide to edit it.</div>}</div>
      </> : <div className="card" style={{ gridColumn: "2 / span 2", padding: 50, textAlign: "center" }}>No presentation selected.</div>}
    </div>}
  </section>
}

function PresentationPreview({ presentation, slides, onClose }) {
  const [index, setIndex] = useState(0)
  const slide = slides[index]
  useEffect(() => { const onKey = (event) => { if (event.key === "Escape") onClose(); if (event.key === "ArrowRight") setIndex((i) => Math.min(i + 1, slides.length - 1)); if (event.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0)) }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey) }, [onClose, slides.length])
  if (!slide) return null
  return <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#101820", color: "#fff", display: "flex", flexDirection: "column" }}><div style={{ height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", borderBottom: "1px solid rgba(255,255,255,.12)" }}><strong>{presentation.name}</strong><button onClick={onClose} style={{ ...buttonStyle, background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.3)" }}>Exit preview</button></div><div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 60, textAlign: "center" }}><div style={{ maxWidth: 1000, width: "100%" }}>{slide.image_url && <img src={slide.image_url} alt="" style={{ maxWidth: "100%", maxHeight: "42vh", objectFit: "contain", borderRadius: 12, marginBottom: 28 }} />}<h1 style={{ fontSize: "clamp(32px,5vw,64px)", margin: 0 }}>{slide.title}</h1>{slide.subtitle && <h2 style={{ fontWeight: 400, fontSize: "clamp(18px,2.5vw,30px)", opacity: .82, margin: "18px 0" }}>{slide.subtitle}</h2>}<div style={{ whiteSpace: "pre-wrap", fontSize: "clamp(15px,1.5vw,21px)", lineHeight: 1.7, opacity: .9 }}>{slide.body}</div>{slide.video_url && <video controls src={slide.video_url} style={{ maxWidth: "80%", maxHeight: "40vh", marginTop: 24 }} />}</div></div><div style={{ height: 72, display: "flex", alignItems: "center", justifyContent: "center", gap: 18, borderTop: "1px solid rgba(255,255,255,.12)" }}><button onClick={() => setIndex((i) => Math.max(i - 1, 0))} disabled={index === 0} style={navButton}><ChevronLeft size={20} /> Previous</button><span style={{ fontSize: 12, opacity: .75 }}>{index + 1} / {slides.length}</span><button onClick={() => setIndex((i) => Math.min(i + 1, slides.length - 1))} disabled={index === slides.length - 1} style={navButton}>Next <ChevronRight size={20} /></button></div></div>
}

const buttonStyle = { display: "inline-flex", alignItems: "center", gap: 7, height: 34, padding: "0 11px", border: "1px solid #d8e0e6", borderRadius: 7, background: "#fff", color: "#344454", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700 }
const iconButton = { ...buttonStyle, width: 34, padding: 0, justifyContent: "center" }
const navButton = { ...buttonStyle, height: 40, background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.25)" }
const panelTitle = { fontSize: 11, fontWeight: 800, color: "#344454", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".04em" }
const listButton = { width: "100%", border: "1px solid", borderRadius: 7, padding: "10px 9px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, textAlign: "left", cursor: "pointer", fontFamily: "inherit", marginBottom: 6 }
const slideRow = { width: "100%", border: "1px solid", borderRadius: 8, padding: "10px 9px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: "inherit" }
const slideNumber = { width: 24, height: 24, borderRadius: 6, background: "#eef2f5", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#52606d" }
const labelStyle = { display: "grid", gap: 5, fontSize: 10, fontWeight: 700, color: "#52606d", marginBottom: 11 }
const fieldStyle = { width: "100%", boxSizing: "border-box", border: "1px solid #d9dfe4", borderRadius: 6, padding: "8px 9px", fontFamily: "inherit", fontSize: 11, color: "#263645", outline: "none" }
const titleInput = { border: 0, outline: "none", padding: 0, fontFamily: "inherit", fontSize: 18, fontWeight: 800, color: "#202a33", width: "100%" }

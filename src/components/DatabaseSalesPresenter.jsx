import React, { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X, ChevronLeft, ChevronRight, LoaderCircle, Maximize2 } from "lucide-react"
import { PDFDocument } from "pdf-lib"
import { supabase } from "../lib/supabase"

const PRESENTER_PATH = "Homeshield-Solar-Presenter-edited.pdf"

export default function DatabaseSalesPresenter({ appointment, onClose }) {
  const [sourceUrl, setSourceUrl] = useState("")
  const [pageUrl, setPageUrl] = useState("")
  const [renderedPage, setRenderedPage] = useState(null)
  const [viewerSize, setViewerSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const pdfContainerRef = React.useRef(null)
  const [page, setPage] = useState(0)
  const [pageCount, setPageCount] = useState(0)
  const [pdfBytes, setPdfBytes] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [renderingPage, setRenderingPage] = useState(false)
  const [sessionUser, setSessionUser] = useState(null)
  const [closeLogged, setCloseLogged] = useState(false)

  async function logPresenterAction(action, details = {}) {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      const user = userData?.user
      const now = new Date().toISOString()
      const { error } = await supabase.from("action_runs").insert({
        action_type: "sales_presenter",
        status: "completed",
        entity_type: "appointment",
        entity_id: appointment?.appointment_row_id || null,
        triggered_by: user?.email || user?.id || "unknown",
        started_at: now,
        completed_at: now,
        input_data: { event: action, appointment_row_id: appointment?.appointment_row_id || null, customer_name: appointment?.name || null, ...details },
        output_data: { event: action, logged_at: now, ...details },
      })
      if (error) throw error
    } catch (err) {
      console.error("Sales Presenter usage logging failed:", err)
    }
  }

  function changePage(nextPage, source = "button") {
    setPage(current => {
      const target = Math.max(0, Math.min(Math.max(0, pageCount - 1), typeof nextPage === "function" ? nextPage(current) : nextPage))
      if (target !== current) logPresenterAction("page_changed", { from_page: current + 1, to_page: target + 1, navigation: source })
      return target
    })
  }

  function closePresenter() {
    if (!closeLogged) {
      setCloseLogged(true)
      logPresenterAction("closed", { final_page: page + 1, page_count: pageCount })
    }
    onClose?.()
  }

  useEffect(() => {
    let cancelled = false
    async function loadPresenter() {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        const token = sessionData?.session?.access_token
        if (!token) throw new Error("Please sign in to the CRM to open the Sales Presenter.")
        const response = await fetch("/api/sales/open-presenter-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ path: PRESENTER_PATH }),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok || !result.url) throw new Error(result.error || "Unable to load the Solar Presenter PDF.")
        const pdfResponse = await fetch(result.url)
        if (!pdfResponse.ok) throw new Error("The presenter PDF could not be downloaded.")
        const bytes = await pdfResponse.arrayBuffer()
        const document = await PDFDocument.load(bytes)
        if (cancelled) return
        setSourceUrl(result.url)
        setPdfBytes(bytes)
        setPageCount(document.getPageCount())
        logPresenterAction("opened", { page_count: document.getPageCount(), presenter: "solar_pdf" })
      } catch (e) {
        if (!cancelled) setError(e?.message || "Unable to load the Solar Presenter PDF.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadPresenter()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!pdfBytes || !pageCount) return
    let cancelled = false
    let renderTask
    async function renderPage() {
      setRenderingPage(true)
      try {
        const pdfjsUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs"
        const pdfjs = await import(/* @vite-ignore */ pdfjsUrl)
        pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs"
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes).slice() }).promise
        const pdfPage = await pdf.getPage(page + 1)
        const base = pdfPage.getViewport({ scale: 1 })
        // Size the PDF from the actual centre column, not the browser viewport.
        // This keeps the rendered page aligned with the space between the nav buttons.
        const availableWidth = Math.max(1, containerSize.width - 152)
        const availableHeight = Math.max(1, containerSize.height - 16)
        const scale = Math.min(availableWidth / base.width, availableHeight / base.height)
        const viewport = pdfPage.getViewport({ scale })
        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d", { alpha: false })
        const ratio = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * ratio)
        canvas.height = Math.floor(viewport.height * ratio)
        context.setTransform(ratio, 0, 0, ratio, 0, 0)
        renderTask = pdfPage.render({ canvasContext: context, viewport })
        await renderTask.promise
        if (!cancelled) setRenderedPage({ canvas, width: viewport.width, height: viewport.height })
      } catch (e) {
        if (!cancelled) setError("Unable to render this slide. Please refresh and try again.")
        console.error("Presenter canvas rendering failed:", e)
      } finally {
        if (!cancelled) setRenderingPage(false)
      }
    }
    renderPage()
    return () => { cancelled = true; try { renderTask?.cancel() } catch {} }
  }, [pdfBytes, page, pageCount, viewerSize, containerSize])

  useEffect(() => {
    const body = document.body
    const html = document.documentElement
    const previousBody = { overflow: body.style.overflow, width: body.style.width, height: body.style.height, margin: body.style.margin }
    const previousHtml = { overflow: html.style.overflow, width: html.style.width, height: html.style.height }
    body.style.overflow = "hidden"
    body.style.width = "100%"
    body.style.height = "100%"
    body.style.margin = "0"
    html.style.overflow = "hidden"
    html.style.width = "100%"
    html.style.height = "100%"
    return () => {
      body.style.overflow = previousBody.overflow
      body.style.width = previousBody.width
      body.style.height = previousBody.height
      body.style.margin = previousBody.margin
      html.style.overflow = previousHtml.overflow
      html.style.width = previousHtml.width
      html.style.height = previousHtml.height
    }
  }, [])

  useEffect(() => {
    const element = pdfContainerRef.current
    if (!element) return
    const measure = () => {
      const rect = element.getBoundingClientRect()
      setContainerSize(previous => previous.width === rect.width && previous.height === rect.height
        ? previous
        : { width: rect.width, height: rect.height })
    }
    measure()
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure)
      observer.observe(element)
      return () => observer.disconnect()
    }
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [loading, error])

  useEffect(() => {
    const resize = () => setViewerSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, [])

  useEffect(() => {
    const onKey = event => {
      if (event.key === "Escape") onClose?.()
      if (event.key === "ArrowLeft") setPage(current => Math.max(0, current - 1))
      if (event.key === "ArrowRight") setPage(current => Math.min(Math.max(0, pageCount - 1), current + 1))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, pageCount, page])

  useEffect(() => () => { if (pageUrl) URL.revokeObjectURL(pageUrl) }, [pageUrl])

  async function enterFullscreen() {
    try {
      const element = document.getElementById("solar-sales-presenter-viewer")
      if (element?.requestFullscreen) { await element.requestFullscreen(); logPresenterAction("fullscreen_entered", { page: page + 1 }) }
    } catch {}
  }

  if (typeof document === "undefined") return null
  return createPortal(
    <div id="solar-sales-presenter-viewer" role="dialog" aria-modal="true" aria-label="Sales Presenter" style={{ position:"fixed", inset:0, zIndex:10000, background:"#07111c", display:"flex", flexDirection:"column", boxSizing:"border-box", color:"#fff" }}>
      <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"10px 18px", background:"#0c1a29", borderBottom:"1px solid #23384a" }}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:12,opacity:.72,marginTop:3}}>{appointment?.name ? `Presenting to ${appointment.name}` : "Homeshield Solar Presenter"}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {pageCount > 0 && <span style={{fontSize:13,fontWeight:700,minWidth:64,textAlign:"center"}}>{page + 1} / {pageCount}</span>}
          <button type="button" onClick={enterFullscreen} title="Full screen" style={controlStyle}><Maximize2 size={17}/><span className="presenter-control-label">Full screen</span></button>
          <button type="button" onClick={closePresenter} title="Close Sales Presenter" style={controlStyle}><X size={18}/><span className="presenter-control-label">Close</span></button>
        </div>
      </header>
      <main style={{flex:1,minHeight:0,width:"100%",minWidth:0,marginLeft:0,marginRight:0,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",padding:0,boxSizing:"border-box",overflow:"hidden"}}>
        {loading ? <div style={{display:"flex",alignItems:"center",gap:10,color:"#fff"}}><LoaderCircle size={22}/>Loading presenter…</div> : error ? <div style={{maxWidth:520,padding:24,textAlign:"center"}}><div style={{fontWeight:700,marginBottom:8}}>Presenter unavailable</div><div style={{fontSize:13,lineHeight:1.6,color:"#d4dbe4"}}>{error}</div></div> : <>
          <div style={{position:"absolute",left:20,top:0,bottom:0,width:48,display:"flex",justifyContent:"center",alignItems:"center",zIndex:2}}><button type="button" aria-label="Previous page" disabled={page===0||renderingPage} onClick={()=>changePage(p=>p-1,"button")} style={{...navStyle,position:"relative",top:"auto",left:"auto",transform:"none",opacity:page===0?.35:1}}><ChevronLeft size={30}/></button></div>
          <div ref={pdfContainerRef} style={{display:"flex",alignItems:"center",justifyContent:"center",minWidth:0,minHeight:0,width:"100%",height:"100%",padding:"0 76px",boxSizing:"border-box",overflow:"hidden"}}>
            {renderingPage ? <LoaderCircle size={26}/> : renderedPage ? <canvas ref={node => { if (node && renderedPage.canvas && node !== renderedPage.canvas) { node.width = renderedPage.canvas.width; node.height = renderedPage.canvas.height; node.style.width = renderedPage.width + "px"; node.style.height = renderedPage.height + "px"; node.getContext("2d").drawImage(renderedPage.canvas,0,0) } }} style={{display:"block",maxWidth:"100%",maxHeight:"100%",objectFit:"contain",boxShadow:"0 4px 18px rgba(0,0,0,.35)"}} /> : null}
          </div>
          <div style={{position:"absolute",right:20,top:0,bottom:0,width:48,display:"flex",justifyContent:"center",alignItems:"center",zIndex:2}}><button type="button" aria-label="Next page" disabled={page>=pageCount-1||renderingPage} onClick={()=>changePage(p=>p+1,"button")} style={{...navStyle,position:"relative",top:"auto",right:"auto",transform:"none",opacity:page>=pageCount-1?.35:1}}><ChevronRight size={30}/></button></div>
        </>}
      </main>
      <footer style={{display:"flex",alignItems:"center",justifyContent:"center",gap:18,padding:"12px 16px",background:"#0c1a29",borderTop:"1px solid #23384a"}}>
        <button type="button" disabled={page===0||loading} onClick={()=>changePage(p=>p-1,"button")} style={bottomButtonStyle} ><ChevronLeft size={17}/>Previous</button>
        <span style={{fontSize:12,color:"#a8b8c8"}}>Use the arrow keys or buttons to navigate</span>
        <button type="button" disabled={!pageCount||page>=pageCount-1||loading} onClick={()=>changePage(p=>p+1,"button")} style={bottomButtonStyle}>Next<ChevronRight size={17}/></button>
      </footer>
      <style>{`@media(max-width:600px){.presenter-control-label{display:none}} #solar-sales-presenter-viewer:fullscreen{background:#07111c}`}</style>
    </div>,
    document.body
  )
}

const controlStyle={display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,padding:"9px 11px",border:"1px solid #334b60",borderRadius:8,color:"#fff",background:"#13263a",cursor:"pointer",fontSize:12}
const navStyle={position:"absolute",top:"50%",transform:"translateY(-50%)",zIndex:2,width:48,height:64,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid #38536a",borderRadius:10,color:"#fff",background:"rgba(12,26,41,.88)",cursor:"pointer"}
const bottomButtonStyle={display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,minWidth:104,padding:"9px 14px",border:"1px solid #38536a",borderRadius:8,color:"#fff",background:"#13263a",cursor:"pointer",fontSize:13}

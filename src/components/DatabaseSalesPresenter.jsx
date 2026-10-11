import React, { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X, ChevronLeft, ChevronRight, LoaderCircle, Maximize2 } from "lucide-react"
import { PDFDocument } from "pdf-lib"
import { supabase } from "../lib/supabase"

const PRESENTER_PATH = "Homeshield-Solar-Presenter-edited.pdf"

export default function DatabaseSalesPresenter({ appointment, onClose }) {
  const [sourceUrl, setSourceUrl] = useState("")
  const [pageUrl, setPageUrl] = useState("")
  const [page, setPage] = useState(0)
  const [pageCount, setPageCount] = useState(0)
  const [pdfBytes, setPdfBytes] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [renderingPage, setRenderingPage] = useState(false)

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
    let objectUrl = ""
    async function renderPage() {
      setRenderingPage(true)
      try {
        const source = await PDFDocument.load(pdfBytes)
        const single = await PDFDocument.create()
        const [copiedPage] = await single.copyPages(source, [page])
        single.addPage(copiedPage)
        const bytes = await single.save()
        const blob = new Blob([bytes], { type: "application/pdf" })
        objectUrl = URL.createObjectURL(blob)
        if (!cancelled) setPageUrl(objectUrl)
      } catch {
        if (!cancelled) setError("Unable to display this page. Please try again.")
      } finally {
        if (!cancelled) setRenderingPage(false)
      }
    }
    renderPage()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [pdfBytes, page, pageCount])

  useEffect(() => {
    const onKey = event => {
      if (event.key === "Escape") onClose?.()
      if (event.key === "ArrowLeft") setPage(current => Math.max(0, current - 1))
      if (event.key === "ArrowRight") setPage(current => Math.min(Math.max(0, pageCount - 1), current + 1))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, pageCount])

  useEffect(() => () => { if (pageUrl) URL.revokeObjectURL(pageUrl) }, [pageUrl])

  async function enterFullscreen() {
    try {
      const element = document.getElementById("solar-sales-presenter-viewer")
      if (element?.requestFullscreen) await element.requestFullscreen()
    } catch {}
  }

  if (typeof document === "undefined") return null
  return createPortal(
    <div id="solar-sales-presenter-viewer" role="dialog" aria-modal="true" aria-label="Sales Presenter" style={{ position:"fixed", inset:0, zIndex:10000, background:"#07111c", display:"flex", flexDirection:"column", boxSizing:"border-box", color:"#fff" }}>
      <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"10px 18px", background:"#0c1a29", borderBottom:"1px solid #23384a" }}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:17,fontWeight:750}}>Sales Presenter</div>
          <div style={{fontSize:12,opacity:.72,marginTop:3}}>{appointment?.name ? `Presenting to ${appointment.name}` : "Homeshield Solar Presenter"}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {pageCount > 0 && <span style={{fontSize:13,fontWeight:700,minWidth:64,textAlign:"center"}}>{page + 1} / {pageCount}</span>}
          <button type="button" onClick={enterFullscreen} title="Full screen" style={controlStyle}><Maximize2 size={17}/><span className="presenter-control-label">Full screen</span></button>
          <button type="button" onClick={onClose} title="Close Sales Presenter" style={controlStyle}><X size={18}/><span className="presenter-control-label">Close</span></button>
        </div>
      </header>
      <main style={{flex:1,minHeight:0,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",padding:"4px 56px",boxSizing:"border-box"}}>
        {loading ? <div style={{display:"flex",alignItems:"center",gap:10,color:"#fff"}}><LoaderCircle size={22}/>Loading presenter…</div> : error ? <div style={{maxWidth:520,padding:24,textAlign:"center"}}><div style={{fontWeight:700,marginBottom:8}}>Presenter unavailable</div><div style={{fontSize:13,lineHeight:1.6,color:"#d4dbe4"}}>{error}</div></div> : <>
          <button type="button" aria-label="Previous page" disabled={page===0||renderingPage} onClick={()=>setPage(p=>Math.max(0,p-1))} style={{...navStyle,left:16,opacity:page===0?.35:1}}><ChevronLeft size={30}/></button>
          <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",minWidth:0,minHeight:0}}>
            {renderingPage ? <LoaderCircle size={26}/> : pageUrl ? <iframe key={pageUrl} title={`Solar Presenter page ${page+1}`} src={pageUrl+"#toolbar=0&navpanes=0&view=Fit"} style={{width:"100%",height:"100%",maxWidth:"none",border:0,background:"#07111c"}} /> : null}
          </div>
          <button type="button" aria-label="Next page" disabled={page>=pageCount-1||renderingPage} onClick={()=>setPage(p=>Math.min(pageCount-1,p+1))} style={{...navStyle,right:16,opacity:page>=pageCount-1?.35:1}}><ChevronRight size={30}/></button>
        </>}
      </main>
      <footer style={{display:"flex",alignItems:"center",justifyContent:"center",gap:18,padding:"12px 16px",background:"#0c1a29",borderTop:"1px solid #23384a"}}>
        <button type="button" disabled={page===0||loading} onClick={()=>setPage(p=>Math.max(0,p-1))} style={bottomButtonStyle} ><ChevronLeft size={17}/>Previous</button>
        <span style={{fontSize:12,color:"#a8b8c8"}}>Use the arrow keys or buttons to navigate</span>
        <button type="button" disabled={!pageCount||page>=pageCount-1||loading} onClick={()=>setPage(p=>Math.min(pageCount-1,p+1))} style={bottomButtonStyle}>Next<ChevronRight size={17}/></button>
      </footer>
      <style>{`@media(max-width:600px){.presenter-control-label{display:none}} #solar-sales-presenter-viewer:fullscreen{background:#07111c}`}</style>
    </div>,
    document.body
  )
}

const controlStyle={display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,padding:"9px 11px",border:"1px solid #334b60",borderRadius:8,color:"#fff",background:"#13263a",cursor:"pointer",fontSize:12}
const navStyle={position:"absolute",top:"50%",transform:"translateY(-50%)",zIndex:2,width:48,height:64,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid #38536a",borderRadius:10,color:"#fff",background:"rgba(12,26,41,.88)",cursor:"pointer"}
const bottomButtonStyle={display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,minWidth:104,padding:"9px 14px",border:"1px solid #38536a",borderRadius:8,color:"#fff",background:"#13263a",cursor:"pointer",fontSize:13}

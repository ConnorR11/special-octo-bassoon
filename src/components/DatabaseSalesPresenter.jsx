import React, { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X, ChevronLeft, ChevronRight, LoaderCircle, Maximize2 } from "lucide-react"
import { PDFDocument } from "pdf-lib"
import { supabase } from "../lib/supabase"

const PRESENTER_PATH = "Homeshield-Solar-Presenter-edited.pdf"


function TandemFinanceSlide() {
  const cyan = "#08c7ed"
  const pale = "#e8f1f8"
  const rows = [
    ["Cash Price", "£10,000.00"],
    ["Deposit", "£0.00"],
    ["Amount Of Credit", "£10,000.00"],
    ["Duration of Agreement", "120"],
    ["Interest Rate % (Fixed p.a.)", "3.6%"],
    ["Representative % APR", "3.6%"],
    ["120 Monthly Payments Of", "£99.08"],
    ["Total Amount Payable", "£11,889.60"],
  ]
  const absolute = (left, top, width, height) => ({ position: "absolute", left, top, width, height, boxSizing: "border-box" })
  return <div style={{ width: "min(100%, calc((100vh - 160px) * 16 / 9))", maxWidth: "100%", aspectRatio: "16 / 9", position: "relative", overflow: "hidden", flex: "0 1 auto", background: "radial-gradient(ellipse at 5% 2%, #0879bb 0%, #032a49 30%, #001629 67%, #001222 100%)", color: "#fff", fontFamily: "Arial, Helvetica, sans-serif", boxSizing: "border-box", boxShadow: "0 4px 22px rgba(0,0,0,.25)" }}>
    <div style={{ ...absolute("2.3%", "3.2%", "58%", "5%"), display: "flex", alignItems: "center", gap: "1.2%", fontSize: "clamp(10px, 1.28vw, 21px)", letterSpacing: ".035em", whiteSpace: "nowrap" }}>
      <span style={{ width: "clamp(18px, 2.1vw, 34px)", height: "clamp(18px, 2.1vw, 34px)", borderRadius: 5, background: cyan, flexShrink: 0 }} /> HOMESHIELD SCOTLAND
    </div>
    <div style={{ ...absolute("69%", "3.5%", "27%", "4.5%"), display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "3%", fontSize: "clamp(8px, 1.05vw, 17px)", whiteSpace: "nowrap", letterSpacing: ".025em" }}>
      SOLAR + BATTERY STORAGE <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "clamp(18px, 2vw, 32px)", height: "clamp(18px, 2vw, 32px)", borderRadius: 5, background: "#fff", color: "#09223a", fontWeight: 900 }}>⌂</span>
    </div>
    <div style={{ ...absolute("3.5%", "13.5%", "55%", "24%"), display: "flex", flexDirection: "column", gap: "1.5%" }}>
      <div style={{ fontSize: "clamp(25px, 4.05vw, 65px)", lineHeight: 1.02, fontWeight: 800, letterSpacing: "-.035em", whiteSpace: "nowrap" }}>Solar &amp; battery finance</div>
      <div style={{ fontSize: "clamp(24px, 3.95vw, 63px)", lineHeight: 1.02, fontWeight: 800, letterSpacing: "-.035em", color: cyan, whiteSpace: "nowrap" }}>with Government support</div>
      <div style={{ marginTop: "1.5%", fontSize: "clamp(11px, 1.85vw, 29px)", lineHeight: 1.3, color: pale, maxWidth: "94%" }}>A lower interest rate, making renewable energy<br/>more affordable for your home.</div>
    </div>
    <div style={{ ...absolute("3.2%", "41%", "54%", "32.5%"), border: "2px solid "+cyan, borderRadius: 17, background: "#fff", color: "#07101d", display: "grid", gridTemplateColumns: "37% 63%", alignItems: "center", padding: "2.5% 3.5%", gap: "3%" }}>
      <div style={{ textAlign: "center", fontSize: "clamp(26px, 5.4vw, 86px)", lineHeight: 1, color: "#080d16" }}>♔</div>
      <div style={{ borderLeft: "2px solid #17243a", paddingLeft: "6%", minWidth: 0 }}>
        <div style={{ fontSize: "clamp(22px, 3.4vw, 54px)", lineHeight: 1.05, fontWeight: 800, color: "#050a12" }}>Funded by<br/>UK Government</div>
        <div style={{ marginTop: "3%", fontSize: "clamp(10px, 1.65vw, 26px)", lineHeight: 1.25, color: "#17243a" }}>This product is supported by the<br/><strong>Warm Homes Loan Scheme.</strong></div>
      </div>
    </div>
    <div style={{ ...absolute("3.6%", "76%", "53%", "17%"), fontSize: "clamp(10px, 1.72vw, 27px)", lineHeight: 1.38, color: pale }}>
      The Warm Homes Loan Scheme helps eligible homeowners and private landlords access more affordable finance for eligible home energy improvements, including solar panels and battery storage.
    </div>
    <div style={{ ...absolute("58.4%", "12%", "38.5%", "82%"), border: "2px solid "+cyan, borderRadius: 20, padding: "2.1% 2.2%", display: "flex", flexDirection: "column", background: "rgba(0,19,35,.58)", boxShadow: "0 5px 24px rgba(0,0,0,.16)" }}>
      <div style={{ textAlign: "center", fontSize: "clamp(8px, 1.12vw, 18px)", letterSpacing: ".22em", whiteSpace: "nowrap" }}>V12 – REPRESENTATIVE EXAMPLE</div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "2%", marginTop: "2%" }}>
        <span style={{ color: cyan, fontSize: "clamp(58px, 9.7vw, 155px)", lineHeight: .9, fontWeight: 900, letterSpacing: "-.07em" }}>3.6%</span>
        <span style={{ color: cyan, fontSize: "clamp(21px, 3.4vw, 54px)", fontWeight: 800 }}>APR</span>
      </div>
      <div style={{ textAlign: "right", fontSize: "clamp(10px, 1.8vw, 28px)", lineHeight: 1.1, marginTop: "-.5%" }}>Representative</div>
      <div style={{ fontSize: "clamp(9px, 1.55vw, 25px)", lineHeight: 1.2, margin: "1.7% 0 2.2%", color: pale }}>10 year finance (120 months) through <strong>V12.</strong></div>
      <div style={{ flex: "1 1 auto", minHeight: 0, border: "1px solid rgba(8,199,237,.6)", borderRadius: 13, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: "0 0 12%", minHeight: 20, display: "flex", alignItems: "center", justifyContent: "center", background: cyan, color: "#001629", fontSize: "clamp(9px, 1.3vw, 21px)", fontWeight: 900, letterSpacing: ".12em" }}>REPRESENTATIVE EXAMPLE</div>
        {rows.map(([label, value], index) => <div key={label} style={{ flex: "1 1 0", minHeight: 0, display: "grid", gridTemplateColumns: "57% 43%", alignItems: "center", borderTop: "1px solid rgba(8,199,237,.45)", padding: "0 3.5%", gap: "2%", fontSize: "clamp(8px, 1.35vw, 21px)", lineHeight: 1.12 }}>
          <span style={{ color: pale }}>{label}</span><strong style={{ color: cyan, whiteSpace: "nowrap" }}>{value}</strong>
        </div>)}
      </div>
      <div style={{ marginTop: "5%", fontSize: "clamp(6px, .78vw, 12px)", lineHeight: 1.35, color: pale }}>Finance subject to status, affordability and scheme eligibility. The Government supports the interest rate but does not provide the loan. Finance is provided by V12, a trading name of Secure Trust Bank PLC. Homeshield Scotland Limited is a credit broker, not a lender. Authorised and regulated by the Financial Conduct Authority, FRN 624069.</div>
    </div>
  </div>
}


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
            {page === 28 ? <TandemFinanceSlide /> : renderingPage ? <LoaderCircle size={26}/> : renderedPage ? <canvas ref={node => { if (node && renderedPage.canvas && node !== renderedPage.canvas) { node.width = renderedPage.canvas.width; node.height = renderedPage.canvas.height; node.style.width = renderedPage.width + "px"; node.style.height = renderedPage.height + "px"; node.getContext("2d").drawImage(renderedPage.canvas,0,0) } }} style={{display:"block",maxWidth:"100%",maxHeight:"100%",objectFit:"contain",boxShadow:"0 4px 18px rgba(0,0,0,.35)"}} /> : null}
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

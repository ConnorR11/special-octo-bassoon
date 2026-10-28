import React, { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X, ChevronLeft, ChevronRight, LoaderCircle, Maximize2 } from "lucide-react"
import { PDFDocument } from "pdf-lib"
import { supabase } from "../lib/supabase"

const PRESENTER_PATH = "Homeshield-Solar-Presenter-edited.pdf"


function TandemFinanceSlide() {
  const cyan = "#08c7ed"
  const pale = "#e6eff7"
  const rows = [
    ["Cash price", "£10,000"],
    ["Deposit", "£0"],
    ["Amount borrowed", "£10,000"],
    ["Term", "120 months (10 years)"],
    ["Monthly repayment", "£103.67"],
    ["Total amount repayable", "£12,440.40"],
    ["APR representative", "4.6%"],
    ["Fixed interest rate", "4.51%"],
  ]
  const benefits = [
    ["▦", "Lower interest rate", "Making renewable energy more affordable for your home."],
    ["♧", "Flexible terms", "Spread the cost over a term that works for you."],
    ["☷", "Simple application", "A quick and straightforward process with a trusted UK provider."],
    ["◉", "Trusted by millions", "Personal finance from a well-established UK lender."],
  ]
  const absolute = (left, top, width, height) => ({ position: "absolute", left, top, width, height, boxSizing: "border-box" })
  return <div style={{ width: "min(100%, calc((100vh - 160px) * 16 / 9))", maxWidth: "100%", aspectRatio: "16 / 9", position: "relative", overflow: "hidden", flex: "0 1 auto", background: "#061725", color: "#fff", fontFamily: "Arial, Helvetica, sans-serif", boxSizing: "border-box", boxShadow: "0 4px 22px rgba(0,0,0,.25)" }}>
    <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(90deg,rgba(2,14,27,.98) 0%,rgba(2,17,31,.94) 35%,rgba(2,17,31,.75) 56%,rgba(2,17,31,.18) 100%), linear-gradient(0deg,rgba(2,14,24,.98) 0%,transparent 33%), url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2000&q=90')", backgroundSize: "cover", backgroundPosition: "center right" }} />
    <div style={{ ...absolute("3.2%", "4.2%", "50%", "4%"), display: "flex", alignItems: "center", gap: "1%", fontSize: "clamp(9px, 1.05vw, 17px)", letterSpacing: ".08em", whiteSpace: "nowrap" }}>
      <span style={{ display: "inline-block", width: "clamp(14px, 1.65vw, 27px)", height: "clamp(14px, 1.65vw, 27px)", borderRadius: 3, background: cyan, flexShrink: 0 }} /> HOMESHIELD SCOTLAND
    </div>
    <div style={{ ...absolute("66%", "4.5%", "31%", "3.5%"), textAlign: "right", fontSize: "clamp(9px, 1.02vw, 16px)", letterSpacing: ".08em", whiteSpace: "nowrap" }}>SOLAR + BATTERY STORAGE</div>
    <div style={{ ...absolute("3.4%", "10.6%", "53%", "15.5%"), display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: 0, textShadow: "0 2px 8px rgba(0,0,0,.2)" }}>
      <div style={{ fontSize: "clamp(25px, 3.55vw, 60px)", lineHeight: 1.02, fontWeight: 800, letterSpacing: "-.035em", whiteSpace: "nowrap" }}>Solar &amp; battery finance</div>
      <div style={{ fontSize: "clamp(23px, 3.45vw, 58px)", lineHeight: 1.03, fontWeight: 800, letterSpacing: "-.035em", color: cyan, whiteSpace: "nowrap" }}>with Government support.</div>
      <div style={{ marginTop: "1.2%", fontSize: "clamp(10px, 1.48vw, 24px)", lineHeight: 1.22, color: pale, maxWidth: "72%" }}>A lower interest rate, making renewable energy more affordable for your home.</div>
    </div>
    <div style={{ ...absolute("3.5%", "35.5%", "45.8%", "22.7%"), background: "#fff", color: "#071321", border: "2px solid "+cyan, borderRadius: 13, display: "grid", gridTemplateColumns: "36% 64%", alignItems: "center", padding: "2.2% 2.6%" }}>
      <div style={{ height: "78%", borderRight: "2px solid #16263d", display: "flex", alignItems: "center", justifyContent: "center", paddingRight: "10%" }}>
        <svg viewBox="0 0 150 150" style={{ width: "84%", height: "100%", maxHeight: "130px" }} aria-label="UK government emblem"><g fill="#101820"><path d="M75 5 87 29 110 18 108 43 137 43 121 64 143 78 119 91 127 117 101 111 91 140 75 119 58 140 49 112 22 118 31 92 7 78 29 63 13 43 42 43 40 18 63 29Z"/><circle cx="75" cy="74" r="31" fill="#fff" stroke="#101820" strokeWidth="5"/><path d="M75 51v45M54 66h42M54 82h42" stroke="#101820" strokeWidth="4"/></g><text x="75" y="79" fontSize="12" fontWeight="bold" textAnchor="middle" fill="#101820">UK</text></svg>
      </div>
      <div style={{ paddingLeft: "8%", minWidth: 0 }}>
        <div style={{ fontSize: "clamp(16px, 2.05vw, 34px)", lineHeight: ".98", fontWeight: 800, letterSpacing: "-.04em" }}>Funded by<br/>UK Government</div>
        <div style={{ marginTop: "4%", fontSize: "clamp(9px, 1.08vw, 17px)", lineHeight: 1.2, color: "#101d38" }}>This product is supported by the <strong>Warm Homes Loan Scheme.</strong></div>
      </div>
    </div>
    <div style={{ ...absolute("3%", "59.7%", "46.3%", "23.2%"), display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: "1.5%" }}>
      {benefits.map(([icon, title, description]) => <div key={title} style={{ display: "grid", gridTemplateColumns: "25% 75%", alignItems: "center", gap: "2%", minWidth: 0, minHeight: 0, border: "1px solid "+cyan, borderRadius: 12, padding: "5% 4%", background: "rgba(2,26,44,.94)", boxSizing: "border-box" }}>
        <div style={{ color: cyan, fontSize: "clamp(22px, 3.2vw, 51px)", fontWeight: 700, lineHeight: 1, textAlign: "center" }}>{icon}</div>
        <div style={{ minWidth: 0 }}><div style={{ fontSize: "clamp(9px, 1.08vw, 17px)", lineHeight: 1.12, fontWeight: 800, marginBottom: "4%" }}>{title}</div><div style={{ fontSize: "clamp(7px, .83vw, 13px)", lineHeight: 1.28, color: pale }}>{description}</div></div>
      </div>)}
    </div>
    <div style={{ ...absolute("72%", "8.5%", "25%", "8.5%"), display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "1%", fontSize: "clamp(24px, 3.35vw, 56px)", fontWeight: 800, letterSpacing: "-.05em", whiteSpace: "nowrap", textShadow: "0 2px 8px rgba(0,0,0,.3)" }}>
      <span style={{ display: "inline-block", width: "clamp(25px, 5.5vw, 88px)", height: "clamp(18px, 3.9vw, 62px)", borderRadius: "55% 0 0 0", background: "linear-gradient(90deg,#08c7ed 0 52%,#176fcb 52% 100%)" }} /><span style={{ display: "inline-block", width: "clamp(16px, 2.6vw, 42px)", height: "clamp(18px, 3.9vw, 62px)", background: "#f53b88", borderRadius: "0 4px 4px 0", marginLeft: "-2.4%" }} /><span style={{ marginLeft: "1%" }}>tandem</span>
    </div>
    <div style={{ ...absolute("50.5%", "22.5%", "30.5%", "61.5%"), border: "2px solid "+cyan, borderRadius: 18, padding: "2.2% 2.4%", background: "rgba(2,19,32,.94)", display: "flex", flexDirection: "column", boxShadow: "0 8px 25px rgba(0,0,0,.25)" }}>
      <div style={{ fontSize: "clamp(7px, .9vw, 14px)", letterSpacing: ".19em", whiteSpace: "nowrap", color: pale }}>TANDEM BANK – REPRESENTATIVE EXAMPLE</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "2%", marginTop: "2%" }}><span style={{ color: cyan, fontSize: "clamp(44px, 7vw, 112px)", lineHeight: .9, fontWeight: 900, letterSpacing: "-.06em" }}>4.6%</span><span style={{ color: cyan, fontSize: "clamp(17px, 2.35vw, 38px)", fontWeight: 800 }}>APR</span></div>
      <div style={{ textAlign: "right", fontSize: "clamp(8px, 1vw, 16px)", lineHeight: 1.1, marginTop: "-.2%" }}>Representative</div>
      <div style={{ fontSize: "clamp(8px, 1.12vw, 18px)", color: pale, lineHeight: 1.2, margin: "1.8% 0 2.2%" }}>10 year finance (120 months) through <strong>Tandem Bank.</strong></div>
      <div style={{ flex: "1 1 auto", minHeight: 0, border: "1px solid rgba(8,199,237,.3)", borderRadius: 12, padding: "0 2.2%", display: "grid", gridTemplateRows: "repeat(8, minmax(0, 1fr))", alignContent: "stretch" }}>
        {rows.map(([label, value], index) => <div key={label} style={{ display: "grid", gridTemplateColumns: "48% 52%", alignItems: "center", minHeight: 0, borderBottom: index === rows.length - 1 ? 0 : "1px solid rgba(8,199,237,.24)", fontSize: "clamp(8px, .92vw, 15px)", lineHeight: 1.1, gap: "2%" }}><span style={{ color: pale }}>{label}</span><span style={{ color: cyan, fontWeight: 800, whiteSpace: "nowrap" }}>{value}</span></div>)}
      </div>
      <div style={{ marginTop: "2.1%", fontSize: "clamp(5px, .63vw, 10px)", lineHeight: 1.25, color: pale }}>Finance subject to status, affordability and scheme eligibility. The Government supports the interest rate but does not provide the loan. Finance is provided by Tandem Bank through Matrix. Homeshield Scotland Limited is a credit broker, not a lender. Authorised and regulated by the Financial Conduct Authority, FRN 624069. Credit is provided by a panel of lenders with whom we have a commercial relationship.</div>
    </div>
    <div style={{ ...absolute("0", "84.4%", "100%", "15.6%"), borderTop: "2px solid "+cyan, background: "rgba(2,14,25,.97)", display: "grid", gridTemplateColumns: "30.5% 69.5%", alignItems: "center", padding: "1.3% 3.2% 1.6%", gap: "2.1%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "18% 82%", alignItems: "center", gap: "3%", height: "100%", borderRight: "2px solid "+cyan, paddingRight: "5%" }}>
        <div style={{ fontSize: "clamp(25px, 3.7vw, 58px)", color: "#28bfff", textAlign: "center", lineHeight: 1 }}>♙</div>
        <div style={{ fontSize: "clamp(7px, .93vw, 15px)", lineHeight: 1.25 }}><strong>Representative example only</strong><div style={{ marginTop: 3, color: pale }}>Your actual payments may vary depending on your circumstances and the lender's assessment.</div></div>
      </div>
      <div style={{ fontSize: "clamp(7px, .86vw, 14px)", lineHeight: 1.35, color: pale }}>Finance subject to status, affordability and scheme eligibility. The Government supports the interest rate but does not provide the loan. Finance is provided by Tandem Bank through Matrix. Homeshield Scotland Limited is a credit broker, not a lender. Authorised and regulated by the Financial Conduct Authority, FRN 624069. Credit is provided by a panel of lenders with whom we have a commercial relationship.</div>
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

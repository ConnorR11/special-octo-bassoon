import React, { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X, ExternalLink, LoaderCircle } from "lucide-react"
import { supabase } from "../lib/supabase"

const PRESENTER_PATH = "Homeshield-Solar-Presenter-edited.pdf"

export default function DatabaseSalesPresenter({ appointment, onClose }) {
  const [url, setUrl] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

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
        if (!cancelled) setUrl(result.url)
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
    const onKey = event => { if (event.key === "Escape") onClose?.() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  if (typeof document === "undefined") return null
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Sales Presenter" style={{ position:"fixed", inset:0, zIndex:10000, background:"rgba(5,12,22,.88)", display:"flex", flexDirection:"column", padding:"clamp(8px,2vw,24px)", boxSizing:"border-box" }}>
      <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, color:"#fff", padding:"4px 2px 12px" }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:17, fontWeight:750 }}>Sales Presenter</div>
          <div style={{ fontSize:12, opacity:.75, marginTop:3 }}>{appointment?.name ? `Presenting to ${appointment.name}` : "Homeshield Solar Presenter"}</div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {url && <a href={url} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:7, color:"#fff", border:"1px solid #526173", borderRadius:7, padding:"8px 11px", fontSize:12, textDecoration:"none" }}><ExternalLink size={14}/>Open in new tab</a>}
          <button type="button" onClick={onClose} aria-label="Close Sales Presenter" style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:38, height:38, border:"1px solid #526173", borderRadius:7, color:"#fff", background:"#1b293a", cursor:"pointer" }}><X size={18}/></button>
        </div>
      </header>
      <div style={{ flex:1, minHeight:0, background:"#202833", border:"1px solid #3a4655", borderRadius:9, overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center" }}>
        {loading ? <div style={{color:"#fff",display:"flex",alignItems:"center",gap:10}}><LoaderCircle size={20}/>Loading presenter…</div> : error ? <div style={{maxWidth:520,padding:24,textAlign:"center",color:"#fff"}}><div style={{fontWeight:700,marginBottom:8}}>Presenter unavailable</div><div style={{fontSize:13,lineHeight:1.6,color:"#d4dbe4"}}>{error}</div><div style={{fontSize:12,lineHeight:1.6,color:"#aeb9c8",marginTop:12}}>Upload the edited PDF to the private Supabase Storage bucket <b>presenters</b> at <code>{PRESENTER_PATH}</code>.</div></div> : <iframe title="Homeshield Solar Sales Presenter PDF" src={url} style={{width:"100%",height:"100%",border:0,background:"#fff"}} />}
      </div>
    </div>,
    document.body
  )
}

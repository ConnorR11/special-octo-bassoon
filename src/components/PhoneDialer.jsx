import React from "react"
import { Device } from "@twilio/voice-sdk"
import { Phone, PhoneOff, Delete, Mic, MicOff, X } from "lucide-react"
import { supabase } from "../lib/supabase"

function PhoneDialer({ onClose }) {
  const [number, setNumber] = React.useState("")
  const [status, setStatus] = React.useState("Ready")
  const [error, setError] = React.useState("")
  const [muted, setMuted] = React.useState(false)
  const [identity, setIdentity] = React.useState("")
  const deviceRef = React.useRef(null)
  const callRef = React.useRef(null)

  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data, error: authError } = await supabase.auth.getUser()
        if (!authError && mounted) setIdentity(data?.user?.id || "")
      } catch (err) {
        console.error("Unable to load current CRM user", err)
      }
    })()
    return () => {
      mounted = false
      try { callRef.current?.disconnect() } catch {}
      try { deviceRef.current?.destroy() } catch {}
    }
  }, [])

  const appendDigit = (digit) => {
    setError("")
    setNumber(current => `${current}${digit}`.slice(0, 20))
  }

  const backspace = () => setNumber(current => current.slice(0, -1))

  const initialiseDevice = async () => {
    if (deviceRef.current) return deviceRef.current
    if (!identity) throw new Error("Unable to identify the logged-in CRM user.")

    const response = await fetch(`/api/twilio/token?identity=${encodeURIComponent(identity)}`)
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload.token) throw new Error(payload.error || "Twilio is not configured yet.")
    if (!Device.isSupported) throw new Error("This browser does not support Twilio Voice calling.")

    const device = new Device(payload.token, { logLevel: 1 })
    device.on("registered", () => setStatus("Ready"))
    device.on("error", (twilioError) => {
      console.error("Twilio device error:", twilioError)
      setStatus("Error")
      setError(twilioError?.message || "Twilio connection error.")
    })
    device.on("unregistered", () => setStatus("Offline"))
    await device.register()
    deviceRef.current = device
    return device
  }

  const call = async () => {
    if (!number.trim()) return
    setError("")
    try {
      setStatus("Connecting...")
      const device = await initialiseDevice()
      const connection = await device.connect({ params: { To: number.trim(), Identity: identity } })
      callRef.current = connection
      setStatus("Calling")
      connection.on("accept", () => setStatus("Connected"))
      connection.on("disconnect", () => { callRef.current = null; setStatus("Ready"); setMuted(false) })
      connection.on("cancel", () => { callRef.current = null; setStatus("Ready") })
      connection.on("reject", () => { callRef.current = null; setStatus("Rejected") })
      connection.on("error", (callError) => { setStatus("Error"); setError(callError?.message || "Call error.") })
    } catch (err) {
      console.error("Twilio call error:", err)
      setStatus("Not connected")
      setError(err?.message || "Unable to start the call.")
    }
  }

  const hangUp = () => {
    try { callRef.current?.disconnect() } catch {}
    try { deviceRef.current?.disconnectAll() } catch {}
    callRef.current = null
    setStatus("Ready")
    setMuted(false)
  }

  const toggleMute = () => {
    const next = !muted
    try { callRef.current?.mute(next) } catch {}
    setMuted(next)
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"]

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 20000, background: "rgba(0,0,0,0.38)", display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: 24 }} onMouseDown={onClose}>
      <div onMouseDown={event => event.stopPropagation()} style={{ width: 340, maxWidth: "calc(100vw - 32px)", background: "#fff", borderRadius: 18, boxShadow: "0 20px 60px rgba(0,0,0,.25)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", background: "#002d49", color: "#fff" }}>
          <div><div style={{ fontSize: 16, fontWeight: 700 }}>Softphone</div><div style={{ fontSize: 11, opacity: .75 }}>Twilio</div></div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 0, background: "transparent", color: "#fff", cursor: "pointer" }}><X size={19} /></button>
        </div>

        <div style={{ padding: 18 }}>
          <div style={{ border: "1px solid #e4e9ee", borderRadius: 12, padding: "12px 14px", marginBottom: 14, background: "#f8fafc" }}>
            <div style={{ fontSize: 11, color: "#7a8792", marginBottom: 5 }}>Number</div>
            <div style={{ minHeight: 30, fontSize: 25, fontWeight: 600, letterSpacing: 1, color: "#17324d", textAlign: "center" }}>{number || "Enter number"}</div>
            <div style={{ textAlign: "center", fontSize: 11, color: status === "Error" ? "#c0392b" : "#7a8792", marginTop: 5 }}>{status}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 9 }}>
            {keys.map(key => <button key={key} type="button" onClick={() => appendDigit(key)} style={{ height: 50, borderRadius: 10, border: "1px solid #e1e7ec", background: "#fff", fontSize: 19, color: "#17324d", cursor: "pointer" }}>{key}</button>)}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            <button type="button" onClick={() => setNumber("")} style={{ border: 0, background: "transparent", color: "#6d7882", cursor: "pointer", padding: 8 }}>Clear</button>
            <button type="button" onClick={backspace} aria-label="Backspace" style={{ border: 0, background: "transparent", color: "#6d7882", cursor: "pointer", padding: 8 }}><Delete size={19} /></button>
          </div>

          {error && <div style={{ marginTop: 8, padding: 10, borderRadius: 9, background: "#fff2f2", color: "#a93226", fontSize: 12 }}>{error}</div>}

          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 14 }}>
            <button type="button" onClick={toggleMute} disabled={!callRef.current} aria-label={muted ? "Unmute" : "Mute"} style={{ width: 48, height: 48, borderRadius: "50%", border: "1px solid #dfe5ea", background: muted ? "#fff0f0" : "#fff", color: muted ? "#c0392b" : "#53616d", cursor: callRef.current ? "pointer" : "not-allowed" }}>{muted ? <MicOff size={19} /> : <Mic size={19} />}</button>
            {callRef.current ? <button type="button" onClick={hangUp} aria-label="Hang up" style={{ width: 58, height: 58, borderRadius: "50%", border: 0, background: "#c0392b", color: "#fff", cursor: "pointer" }}><PhoneOff size={22} /></button> : <button type="button" onClick={call} aria-label="Call" style={{ width: 58, height: 58, borderRadius: "50%", border: 0, background: "#17804b", color: "#fff", cursor: "pointer" }}><Phone size={22} /></button>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PhoneDialer

import React, { useState } from "react"
import { ChevronDown, Check, Lock, Building2, UserRound, Pencil, Plus, RotateCcw } from "lucide-react"
import AllocateBranch from "./AllocateBranch"
import AllocateSalesRep from "./AllocateSalesRep"

export default function AppointmentActions({ appointment, onConfirm, confirming, onResult, onEdit, onOpenPickup }) {
  const [open, setOpen] = useState(false)
  const hasResult = Boolean(String(appointment?.result || appointment?.status || "").trim())
  const confirmed = appointment?.cps_c === true
  const hasBranch = Boolean(String(appointment?.branch || "").trim())
  const closeAnd = (fn) => { setOpen(false); fn?.() }

  return <div style={{ position: "relative" }}>
    <button type="button" onClick={() => setOpen((value) => !value)} style={{ display: "flex", alignItems: "center", gap: 7, height: 40, padding: "0 15px", border: "none", borderRadius: 8, background: "#2499ed", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}><span>Actions</span><ChevronDown size={15} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} /></button>
    {open && <>
      <button type="button" aria-label="Close actions" onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 998, border: 0, background: "transparent", cursor: "default" }} />
      <div style={{ position: "absolute", top: 46, right: 0, width: 270, background: "#fff", border: "1px solid #dfe4e8", borderRadius: 10, boxShadow: "0 14px 35px rgba(0,0,0,.16)", padding: 6, zIndex: 999 }}>
        <div style={{ padding: "7px 10px 6px", fontSize: 9, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" }}>Appointment actions</div>
        <MenuButton icon={Check} disabled={confirmed || confirming} onClick={() => closeAnd(onConfirm)}>{confirming ? "Confirming…" : "Confirm Appointment"}{confirmed && <Done />}</MenuButton>
        {confirmed ? <AllocateBranch appointment={appointment} menuItem onTriggered={() => setOpen(false)} onUpdated={onConfirm} /> : <MenuButton icon={Building2} disabled>Allocate Branch <Lock size={13} color="#b8c0c8" /></MenuButton>}
        {hasBranch ? <AllocateSalesRep appointment={appointment} menuItem onTriggered={() => setOpen(false)} onUpdated={onConfirm} /> : <MenuButton icon={UserRound} disabled>Allocate Sales Rep <Lock size={13} color="#b8c0c8" /></MenuButton>}
        <MenuButton icon={Pencil} onClick={() => closeAnd(onEdit)}>Edit Appointment</MenuButton>
        <MenuButton icon={Plus} onClick={() => closeAnd(onResult)}>Result Appointment</MenuButton>
        <div style={{ height: 1, background: "#eef1f4", margin: "6px 4px" }} />
        <MenuButton disabled={!hasResult} icon={RotateCcw} onClick={() => closeAnd(onOpenPickup)}>Pickup{!hasResult && <Lock size={13} color="#b8c0c8" />}</MenuButton>
      </div>
    </>}
  </div>
}

function MenuButton({ children, icon: Icon, disabled, onClick }) {
  return <button type="button" disabled={disabled} onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, minHeight: 38, padding: "0 10px", border: 0, borderRadius: 7, background: disabled ? "#fff" : "transparent", color: disabled ? "#b4bbc2" : "#243342", cursor: disabled ? "default" : "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, textAlign: "left" }} onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "#f3f7fa" }} onMouseLeave={(e) => { e.currentTarget.style.background = disabled ? "#fff" : "transparent" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 9, flex: 1 }}>{Icon && <Icon size={15} />}{children}</span></button>
}

function Done() { return <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, color: "#16a34a" }}>Completed</span> }

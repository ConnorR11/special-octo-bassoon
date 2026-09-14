import React, { useEffect, useState } from "react"
import { ChevronDown, Check, Lock, Building2, UserRound, Pencil, Plus, RotateCcw, X } from "lucide-react"
import { supabase } from "../lib/supabase"
import AllocateBranch from "./AllocateBranch"
import AllocateSalesRep from "./AllocateSalesRep"
import RepConfirmation from "./RepConfirmation"

function getSubmittedBy(user) {
  const metadataName = String(user?.user_metadata?.full_name || user?.user_metadata?.name || "").trim()
  return metadataName || user?.email || "Unknown"
}

function toDateTimeLocal(value) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function AppointmentActions({ appointment, onUpdated, onConfirmLegacy, onResultLegacy, onOpenPickup }) {
  const [open, setOpen] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState("")
  const [editValues, setEditValues] = useState({})
  const [showEditDetails, setShowEditDetails] = useState(false)

  const hasResult = Boolean(String(appointment?.result || appointment?.status || "").trim())
  const confirmed = appointment?.cps_c === true
  const hasBranch = Boolean(String(appointment?.branch || "").trim())
  const hasAllocatedRep = Boolean(String(appointment?.rep_allocated || "").trim())

  useEffect(() => {
    setEditValues({
      name: appointment?.name || "",
      phone_number_1: appointment?.phone_number_1 || appointment?.phone || "",
      email_address: appointment?.email_address || appointment?.email || "",
      postcode: appointment?.postcode || "",
      address: appointment?.address || "",
      appointment_date: toDateTimeLocal(appointment?.appointment_date),
      product: appointment?.product || "",
      job_type: appointment?.job_type || "",
      lead_source: appointment?.lead_source || "",
      sales_notes: appointment?.sales_notes || "",
    })
  }, [appointment])

  const closeAnd = (fn) => { setOpen(false); fn?.() }
  const handleUpdated = (updatedAppointment) => { setOpen(false); onUpdated?.(updatedAppointment) }

  function openEdit() {
    setEditError("")
    setShowEdit(true)
    setOpen(false)
  }

  async function saveEdit(event) {
    event.preventDefault()
    if (!appointment?.appointment_row_id || savingEdit) return
    setSavingEdit(true)
    setEditError("")
    let actionId = null
    const now = new Date().toISOString()
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      const triggeredBy = getSubmittedBy(userData?.user)
      const inputData = {
        appointment_row_id: appointment.appointment_row_id,
        previous: { name: appointment.name, phone_number_1: appointment.phone_number_1 || appointment.phone || null, email_address: appointment.email_address || appointment.email || null, postcode: appointment.postcode, address: appointment.address, appointment_date: appointment.appointment_date, product: appointment.product, job_type: appointment.job_type, lead_source: appointment.lead_source, sales_notes: appointment.sales_notes },
        changes: editValues,
      }
      const { data: action, error: actionError } = await supabase.from("action_runs").insert({ action_type: "edit_appointment", status: "running", entity_type: "appointment", entity_id: appointment.appointment_row_id, triggered_by: triggeredBy, started_at: now, input_data: inputData }).select("id").single()
      if (actionError) throw actionError
      actionId = action.id
      const updatePayload = {
        name: editValues.name || null,
        phone_number_1: editValues.phone_number_1 || null,
        email_address: editValues.email_address || null,
        postcode: editValues.postcode || null,
        address: editValues.address || null,
        appointment_date: editValues.appointment_date ? new Date(editValues.appointment_date).toISOString() : null,
        product: editValues.product || null,
        job_type: editValues.job_type || null,
        lead_source: editValues.lead_source || null,
        sales_notes: editValues.sales_notes || null,
        record_last_update: now,
      }
      const { data: updatedAppointment, error: updateError } = await supabase.from("appointments").update(updatePayload).eq("appointment_row_id", appointment.appointment_row_id).select("*").single()
      if (updateError) throw updateError
      const { error: actionUpdateError } = await supabase.from("action_runs").update({ status: "completed", completed_at: new Date().toISOString(), output_data: { appointment_row_id: updatedAppointment.appointment_row_id, changes: updatePayload } }).eq("id", actionId)
      if (actionUpdateError) throw actionUpdateError
      setShowEdit(false)
      onUpdated?.({ ...updatedAppointment, phone: updatedAppointment.phone_number_1, email: updatedAppointment.email_address })
    } catch (err) {
      console.error("Edit Appointment action failed:", err)
      const message = err?.message || "Unable to update appointment."
      setEditError(message)
      if (actionId) await supabase.from("action_runs").update({ status: "failed", completed_at: new Date().toISOString(), error_message: message }).eq("id", actionId)
    } finally { setSavingEdit(false) }
  }

  const setField = (field, value) => setEditValues((current) => ({ ...current, [field]: value }))

  return <>
    <div style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((value) => !value)} style={{ display: "flex", alignItems: "center", gap: 7, height: 40, padding: "0 15px", border: "none", borderRadius: 8, background: "#2499ed", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}><span>Actions</span><ChevronDown size={15} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} /></button>
      {open && <>
        <button type="button" aria-label="Close actions" onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 998, border: 0, background: "transparent" }} />
        <div style={{ position: "absolute", top: 46, right: 0, width: 280, background: "#fff", border: "1px solid #dfe4e8", borderRadius: 10, boxShadow: "0 14px 35px rgba(0,0,0,.16)", padding: 6, zIndex: 999 }}>
          <div style={{ padding: "7px 10px 6px", fontSize: 9, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" }}>Appointment actions</div>
          <MenuButton icon={Check} disabled={confirmed} onClick={() => closeAnd(onConfirmLegacy)}>Confirm Appointment{confirmed && <Done />}</MenuButton>
          {confirmed ? <AllocateBranch appointment={appointment} menuItem onUpdated={handleUpdated} /> : <MenuButton icon={Building2} disabled>Allocate Branch <Lock size={13} color="#b8c0c8" /></MenuButton>}
          {hasBranch ? <AllocateSalesRep appointment={appointment} menuItem onUpdated={handleUpdated} /> : <MenuButton icon={UserRound} disabled>Allocate Sales Rep <Lock size={13} color="#b8c0c8" /></MenuButton>}
          {hasAllocatedRep ? <RepConfirmation appointment={appointment} menuItem onUpdated={handleUpdated} /> : <MenuButton icon={Check} disabled>Rep Confirmation <Lock size={13} color="#b8c0c8" /></MenuButton>}
          <MenuButton icon={Pencil} onClick={openEdit}>Edit Appointment</MenuButton>
          <MenuButton icon={Plus} onClick={() => closeAnd(onResultLegacy)}>Result Appointment</MenuButton>
          <div style={{ height: 1, background: "#eef1f4", margin: "6px 4px" }} />
          <MenuButton disabled={!hasResult} icon={RotateCcw} onClick={() => closeAnd(onOpenPickup)}>Pickup{!hasResult && <Lock size={13} color="#b8c0c8" />}</MenuButton>
        </div>
      </>}
    </div>

    {showEdit && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 620, maxHeight: "90vh", overflow: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><h2 style={{ margin: 0, fontSize: 16, color: "#172033" }}>Edit Appointment</h2><p style={{ margin: "4px 0 0", fontSize: 10, color: "#888" }}>{appointment?.name || "Appointment"}</p></div><button type="button" onClick={() => setShowEdit(false)} style={{ border: 0, background: "transparent", color: "#888", cursor: "pointer" }}><X size={18} /></button></div>
        <form onSubmit={saveEdit} style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 14 }}>
            <Field label="Customer name" value={editValues.name} onChange={(v) => setField("name", v)} />
            <Field label="Phone" value={editValues.phone_number_1} onChange={(v) => setField("phone_number_1", v)} />
            <Field label="Email" value={editValues.email_address} onChange={(v) => setField("email_address", v)} />
            <Field label="Postcode" value={editValues.postcode} onChange={(v) => setField("postcode", v)} />
            <Field label="Appointment date & time" type="datetime-local" value={editValues.appointment_date} onChange={(v) => setField("appointment_date", v)} />
            <Field label="Product / measure" value={editValues.product} onChange={(v) => setField("product", v)} />
          </div>
          <Field label="Address" value={editValues.address} onChange={(v) => setField("address", v)} full />
          <button type="button" onClick={() => setShowEditDetails((value) => !value)} style={{ margin: "14px 0 10px", border: 0, background: "transparent", padding: 0, color: "#1679bd", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{showEditDetails ? "Hide additional fields" : "Show additional fields"}</button>
          {showEditDetails && <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 14 }}><Field label="Job type" value={editValues.job_type} onChange={(v) => setField("job_type", v)} /><Field label="Lead source" value={editValues.lead_source} onChange={(v) => setField("lead_source", v)} /></div>}
          <label style={{ display: "block", marginTop: 14, fontSize: 10, fontWeight: 700, color: "#555" }}>Sales notes<textarea value={editValues.sales_notes} onChange={(e) => setField("sales_notes", e.target.value)} style={{ display: "block", width: "100%", minHeight: 80, marginTop: 6, boxSizing: "border-box", border: "1px solid #d9dadd", borderRadius: 7, padding: 10, fontFamily: "inherit", fontSize: 12, resize: "vertical" }} /></label>
          {editError && <div style={{ marginTop: 12, padding: 10, background: "#fbeaea", color: "#8b3333", borderRadius: 6, fontSize: 10 }}>{editError}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18, paddingTop: 14, borderTop: "1px solid #eee" }}><button type="button" onClick={() => setShowEdit(false)} style={{ height: 36, padding: "0 14px", border: "1px solid #dddfe3", borderRadius: 7, background: "#fff", cursor: "pointer", fontSize: 11 }}>Cancel</button><button type="submit" disabled={savingEdit} style={{ height: 36, padding: "0 16px", border: 0, borderRadius: 7, background: "#172554", color: "#fff", cursor: savingEdit ? "default" : "pointer", opacity: savingEdit ? .6 : 1, fontSize: 11, fontWeight: 700 }}>{savingEdit ? "Saving..." : "Save changes"}</button></div>
        </form>
      </div>
    </div>}
  </>
}

function MenuButton({ children, icon: Icon, disabled, onClick }) { return <button type="button" disabled={disabled} onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, minHeight: 38, padding: "0 10px", border: 0, borderRadius: 7, background: disabled ? "#fff" : "transparent", color: disabled ? "#b4bbc2" : "#243342", cursor: disabled ? "default" : "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, textAlign: "left" }} onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "#f3f7fa" }} onMouseLeave={(e) => { e.currentTarget.style.background = disabled ? "#fff" : "transparent" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 9, flex: 1 }}>{Icon && <Icon size={15} />}{children}</span></button> }
function Done() { return <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, color: "#16a34a" }}>Completed</span> }
function Field({ label, value, onChange, type = "text", full = false }) { return <label style={{ display: "block", marginTop: full ? 14 : 0, gridColumn: full ? "1/-1" : undefined, fontSize: 10, fontWeight: 700, color: "#555" }}>{label}<input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} style={{ display: "block", width: "100%", height: 40, boxSizing: "border-box", marginTop: 6, border: "1px solid #d9dadd", borderRadius: 7, padding: "0 10px", fontFamily: "inherit", fontSize: 12, color: "#172033" }} /></label> }

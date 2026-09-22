import React, { useEffect, useState } from "react"

import {
  ArrowLeft,
  Pencil,
  Plus,
  Phone,
  Mail,
  MapPin,
  CalendarDays,
  UserRound,
  Check,
  X,
  Clock,
} from "lucide-react"

import { supabase } from "../lib/supabase"
import EPVSCalculator from "../EPVSCalculator"
import { GenerateSolarContract } from "../contracts/GenerateSolarContract"
import ActionHistory from "../components/ActionHistory"
import AllocateBranch from "../components/AllocateBranch"

function getSubmittedBy(user) {
  const metadataName = String(user?.user_metadata?.full_name || user?.user_metadata?.name || "").trim()
  return metadataName || user?.email || "Unknown"
}

function AppointmentDetail({ appointment, onBack, onUpdated, permissionLevel }) {
  const canViewCPS = Number(permissionLevel) >= 4;
  
  const [showResult, setShowResult] = useState(false)
  const [result, setResult] = useState(appointment?.result || appointment?.status || "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState("")
  const [cpsValues, setCpsValues] = useState({ cps_h: appointment?.cps_h === true, cps_c: appointment?.cps_c === true, cps_p: appointment?.cps_p === true, cps_s: appointment?.cps_s === true })
  const [savingCps, setSavingCps] = useState(false)
  const [cpsError, setCpsError] = useState("")
  const [epvsCalculation, setEpvsCalculation] = useState(appointment?.epvs_calculation || null)
  const isSolar = String(appointment?.product || appointment?.type || appointment?.appointment_type || "").toLowerCase().includes("solar")
  const mapQuery = [appointment?.address, appointment?.postcode].filter(Boolean).join(", ")

  useEffect(() => {
    setResult(appointment?.result || appointment?.status || "")
    setCpsValues({ cps_h: appointment?.cps_h === true, cps_c: appointment?.cps_c === true, cps_p: appointment?.cps_p === true, cps_s: appointment?.cps_s === true })
    setEpvsCalculation(appointment?.epvs_calculation || null)
  }, [appointment])

  async function confirmAppointment() {
    if (!appointment?.appointment_row_id || confirming) return
    setConfirming(true)
    setConfirmError("")
    let actionId = null
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      const submittedBy = getSubmittedBy(userData?.user)
      const now = new Date().toISOString()
      const { data: action, error: actionError } = await supabase
        .from("action_runs")
        .insert({ action_type: "confirm_appointment", status: "running", entity_type: "appointment", entity_id: appointment.appointment_row_id, triggered_by: submittedBy, started_at: now, input_data: { appointment_row_id: appointment.appointment_row_id } })
        .select("id")
        .single()

      if (actionError) throw actionError
      actionId = action.id

      const { data: updatedAppointment, error: updateError } = await supabase
        .from("appointments")
        .update({ cps_c: true })
        .eq("appointment_row_id", appointment.appointment_row_id)
        .select("*")
        .single()

      if (updateError) throw updateError

      const { error: actionUpdateError } = await supabase
        .from("action_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          output_data: {
            appointment_row_id: updatedAppointment.appointment_row_id,
            cps_c: true,
          },
        })
        .eq("id", actionId)

      if (actionUpdateError) throw actionUpdateError

      setCpsValues((current) => ({ ...current, cps_c: true }))
      onUpdated?.(updatedAppointment)
    } catch (err) {
      console.error("Confirm Appointment action failed:", err)
      const message = err?.message || "Unable to confirm appointment."
      setConfirmError(message)

      if (actionId) {
        await supabase
          .from("action_runs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: message,
          })
          .eq("id", actionId)
      }
    } finally {
      setConfirming(false)
    }
  }

  async function saveResult() {
    if (!result) return
    if (!appointment?.appointment_row_id) {
      setError("This appointment does not have an appointment_row_id.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const { data, error: updateError } = await supabase.from("appointments").update({ result }).eq("appointment_row_id", appointment.appointment_row_id).select()
      if (updateError) throw updateError
      if (!data || data.length === 0) throw new Error("No appointment was updated. Check that appointment_row_id matches a row in the appointments table.")
      const updatedAppointment = data[0]
      onUpdated?.(updatedAppointment)
      if (String(result).toLowerCase().trim() === "sold" && isSolar) {
        if (!epvsCalculation) throw new Error("The appointment was saved as Sold, but no EPVS calculation is available. Please complete the EPVS calculation before generating the solar contract.")
        try {
          await GenerateSolarContract({ appointment: updatedAppointment, epvsCalculation })
        } catch (contractError) {
          console.error("Error generating solar contract:", contractError)
          const detail = contractError?.message || String(contractError || "Unknown error")
          setError(`Appointment was saved as Sold, but the solar contract could not be generated: ${detail}`)
          return
        }
      }
      setShowResult(false)
    } catch (err) {
      console.error("Error updating appointment:", err)
      setError(err?.message || "Unable to save result.")
    } finally {
      setSaving(false)
    }
  }

  function toggleCps(field) {
    if (!canViewCPS) return
    setCpsValues((current) => ({ ...current, [field]: !current[field] }))
    setCpsError("")
  }

  async function saveCpsStatus() {
    if (!canViewCPS) return
    setSavingCps(true)
    setCpsError("")
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      const submittedBy = getSubmittedBy(userData?.user)
      const now = new Date().toISOString()
      const { data: action, error: actionError } = await supabase
        .from("action_runs")
        .insert({ action_type: "update_cps_status", status: "running", entity_type: "appointment", entity_id: appointment.appointment_row_id, triggered_by: submittedBy, started_at: now, input_data: { appointment_row_id: appointment.appointment_row_id, cps_h: cpsValues.cps_h, cps_c: cpsValues.cps_c, cps_p: cpsValues.cps_p, cps_s: cpsValues.cps_s } })
        .select("id")
        .single()
      if (actionError) throw actionError
      const { data: updatedAppointment, error: updateError } = await supabase.from("appointments").update({ cps_h: cpsValues.cps_h, cps_c: cpsValues.cps_c, cps_p: cpsValues.cps_p, cps_s: cpsValues.cps_s }).eq("appointment_row_id", appointment.appointment_row_id).select("*").single()
      if (updateError) throw updateError
      const { error: actionUpdateError } = await supabase.from("action_runs").update({ status: "completed", completed_at: new Date().toISOString(), output_data: { appointment_row_id: updatedAppointment.appointment_row_id, cps_h: updatedAppointment.cps_h, cps_c: updatedAppointment.cps_c, cps_p: updatedAppointment.cps_p, cps_s: updatedAppointment.cps_s } }).eq("id", action.id)
      if (actionUpdateError) throw actionUpdateError
      onUpdated?.(updatedAppointment)
    } catch (err) {
      console.error("Save CPS status failed:", err)
      setCpsError(err?.message || "Unable to save CPS status.")
    } finally {
      setSavingCps(false)
    }
  }

  function formatDate(value) {
    if (!value) return "—"
    const dateValue = new Date(value)
    if (Number.isNaN(dateValue.getTime())) return String(value)
    return dateValue.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  }

  function getResultStyle() {
    const value = String(result || "").toLowerCase()
    if (value.includes("sold")) return { background: "#e8f4e2", color: "#315b28" }
    if (value.includes("cancel") || value.includes("lost")) return { background: "#fbeaea", color: "#8b3333" }
    return { background: "#f2f3f5", color: "#555" }
  }

  if (!appointment) return null

  return (
    <section>
      <div style={{ margin: "-24px -24px 0", background: "#002d49", color: "#fff", padding: "10px 28px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px" }}>
          <button type="button" onClick={onBack} style={{ border: 0, background: "transparent", color: "#dce8ef", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}><ArrowLeft size={17} /></button>
          <span style={{ fontSize: "12px", fontWeight: 600 }}>{appointment.rep_allocated || appointment.name || "Appointment"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "20px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "24px", lineHeight: 1.2, fontWeight: 700 }}>{appointment.name || "Unnamed customer"}</h1>
            <div style={{ marginTop: "5px", fontSize: "13px", color: "#c9d8e1" }}>{formatDate(appointment.appointment_date)}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "10px", color: "#c9d8e1", whiteSpace: "nowrap" }}><Clock size={12} /><span>Last updated {formatDate(appointment.record_last_update)}</span></div>
            <div style={{ display: "flex", gap: "8px" }}>
              {!appointment.cps_c && <button type="button" onClick={confirmAppointment} disabled={confirming} style={{ display: "flex", alignItems: "center", gap: "7px", height: "40px", padding: "0 15px", border: "none", borderRadius: "8px", background: "#2d9bf0", color: "#fff", cursor: confirming ? "default" : "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: 700, opacity: confirming ? 0.65 : 1 }}><Check size={17} />{confirming ? "Confirming..." : "Confirm Appointment"}</button>}
              {appointment.cps_c && <AllocateBranch appointment={appointment} onUpdated={onUpdated} />}
              <button type="button" onClick={() => { setError(""); setShowResult(true) }} style={{ display: "flex", alignItems: "center", gap: "7px", height: "40px", padding: "0 15px", border: "none", borderRadius: "8px", background: "#2499ed", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: 700 }}><Plus size={17} />Result</button>
              <button type="button" style={{ display: "flex", alignItems: "center", gap: "7px", height: "40px", padding: "0 15px", border: "1px solid #557287", borderRadius: "8px", background: "#173f59", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: 600 }}><Pencil size={15} />Edit</button>
            </div>
            {confirmError && <div style={{ marginTop: "2px", padding: "7px 9px", background: "#fbeaea", color: "#8b3333", borderRadius: "6px", fontSize: "10px", maxWidth: "320px" }}>{confirmError}</div>}
          </div>
        </div>
      </div>

      <div style={{ marginTop: "8px", borderRadius: "10px", overflow: "hidden", border: "1px solid #dfe2e5", background: "#eef1f3", height: "275px" }}>
        {mapQuery ? <iframe title="Customer location" width="100%" height="100%" style={{ border: 0, display: "block" }} loading="lazy" src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`} /> : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: "12px" }}>No postcode available</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px", marginTop: "18px" }}>
        <InfoCard title="Customer" icon={UserRound}>
          <InfoRow label="Name" value={appointment.name} />
          <InfoRow label="Phone" value={appointment.phone} icon={appointment.phone ? Phone : null} />
          <InfoRow label="Email" value={appointment.email} icon={appointment.email ? Mail : null} />
          <InfoRow label="Postcode" value={appointment.postcode} icon={appointment.postcode ? MapPin : null} />
        </InfoCard>
        <InfoCard title="Appointment" icon={CalendarDays}>
          <InfoRow label="Date" value={formatDate(appointment.appointment_date)} />
          <InfoRow label="Job type" value={appointment.job_type} />
          <InfoRow label="Type" value={appointment.product || appointment.type || appointment.appointment_type} />
          <InfoRow label="Sales Rep" value={appointment.rep_allocated} />
        </InfoCard>
        <InfoCard title="Result" icon={Check}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
            <span style={{ fontSize: "10px", color: "#888" }}>Current result</span>
            {result ? <span style={{ display: "inline-block", padding: "5px 9px", borderRadius: "6px", fontSize: "10px", fontWeight: 700, ...getResultStyle() }}>{result}</span> : <span style={{ fontSize: "10px", color: "#aaa" }}>Not resulted</span>}
          </div>
        </InfoCard>
      </div>

      {canViewCPS && (
      <div style={{ marginTop: "14px", padding: "16px", background: "#fff", border: "1px solid #e2e5e8", borderRadius: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <div><h3 style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "#222" }}>CPS Status</h3><p style={{ margin: "4px 0 0", fontSize: "10px", color: "#999" }}>Update the CPS flags for this appointment.</p></div>
          <button type="button" onClick={saveCpsStatus} disabled={savingCps} style={{ height: "32px", padding: "0 13px", border: 0, borderRadius: "6px", background: "#172554", color: "#fff", cursor: savingCps ? "default" : "pointer", opacity: savingCps ? 0.6 : 1, fontFamily: "inherit", fontSize: "10px", fontWeight: 700 }}>{savingCps ? "Saving..." : "Save CPS status"}</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" }}>
          {[{ field: "cps_h", label: "H" }, { field: "cps_c", label: "C" }, { field: "cps_p", label: "P" }, { field: "cps_s", label: "S" }].map(({ field, label }) => {
            const active = cpsValues[field]
            return <button key={field} type="button" onClick={() => toggleCps(field)} style={{ border: active ? "1px solid #2499ed" : "1px solid #e1e5e9", background: active ? "#eef8ff" : "#f8f9fa", borderRadius: "7px", padding: "12px 8px", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "7px", minHeight: "65px" }}><span style={{ fontSize: "12px", fontWeight: 800, color: active ? "#1679bd" : "#66717b" }}>{label}</span><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "22px", height: "22px", borderRadius: "50%", background: active ? "#2499ed" : "#e9ecef", color: active ? "#fff" : "#9aa3aa" }}>{active ? <Check size={13} /> : <X size={13} />}</span><span style={{ fontSize: "9px", fontWeight: 600, color: active ? "#1679bd" : "#999" }}>{active ? "True" : "False"}</span></button>
          })}
        </div>
        {cpsError && <div style={{ marginTop: "12px", padding: "9px 10px", background: "#fbeaea", borderRadius: "6px", color: "#8b3333", fontSize: "10px" }}>{cpsError}</div>}
      </div>
      )}

      {isSolar && <div style={{ marginTop: "24px" }}><div style={{ marginBottom: "12px" }}><h2 style={{ margin: 0, fontSize: "18px", color: "#222" }}>EPVS Calculator</h2><p style={{ margin: "5px 0 0", fontSize: "11px", color: "#888" }}>Complete the EPVS calculation for this solar appointment.</p></div><EPVSCalculator appointment={appointment} onCalculationChange={setEpvsCalculation} /></div>}

      <div style={{ marginTop: "24px" }}>
        <ActionHistory entityType="appointment" entityId={appointment.appointment_row_id} />
      </div>

      {showResult && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
        <div style={{ width: "420px", background: "#fff", borderRadius: "10px", padding: "20px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
          <h3 style={{ margin: "0 0 15px", fontSize: "15px" }}>Set Appointment Result</h3>
          <label style={{ display: "block", fontSize: "10px", color: "#666", marginBottom: "6px" }}>Result</label>
          <select value={result} onChange={(event) => setResult(event.target.value)} style={{ width: "100%", height: "36px", border: "1px solid #d8dde1", borderRadius: "6px", padding: "0 9px", fontFamily: "inherit", fontSize: "11px", background: "#fff" }}>
            <option value="">Select result...</option>
            <option value="Sold">Sold</option>
            <option value="No Sale">No Sale</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          {error && <div style={{ marginTop: "12px", padding: "10px", background: "#fbeaea", color: "#8b3333", borderRadius: "6px", fontSize: "10px", lineHeight: 1.5 }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "18px" }}>
            <button type="button" onClick={() => setShowResult(false)} style={{ height: "34px", padding: "0 12px", border: "1px solid #d8dde1", borderRadius: "6px", background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: "10px" }}>Cancel</button>
            <button type="button" onClick={saveResult} disabled={saving} style={{ height: "34px", padding: "0 14px", border: 0, borderRadius: "6px", background: "#2499ed", color: "#fff", cursor: saving ? "default" : "pointer", opacity: saving ? 0.65 : 1, fontFamily: "inherit", fontSize: "10px", fontWeight: 700 }}>{saving ? "Saving..." : "Save Result"}</button>
          </div>
        </div>
      </div>}
    </section>
  )
}

function InfoCard({ title, icon: Icon, children }) {
  return <div style={{ background: "#fff", border: "1px solid #e2e5e8", borderRadius: "8px", padding: "14px" }}><div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "11px" }}><Icon size={14} color="#2d9bf0" /><span style={{ fontSize: "11px", fontWeight: 700, color: "#222" }}>{title}</span></div>{children}</div>
}

function InfoRow({ label, value, icon: Icon }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "5px 0", borderBottom: "1px solid #f0f1f2" }}><span style={{ fontSize: "9px", color: "#999" }}>{label}</span><span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "10px", color: "#333", textAlign: "right" }}>{Icon && <Icon size={11} color="#999" />}{value || "—"}</span></div>
}

export default AppointmentDetail

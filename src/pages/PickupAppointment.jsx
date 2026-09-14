import React, { useEffect, useMemo, useState } from "react"
import { ArrowLeft, CalendarDays, CheckCircle2, Loader2, RotateCcw } from "lucide-react"
import { supabase } from "../lib/supabase"

function getSubmittedBy(user) {
  const metadataName = String(user?.user_metadata?.full_name || user?.user_metadata?.name || "").trim()
  return metadataName || user?.email || "Unknown"
}

export default function PickupAppointment({ appointment, onBack, onCreated }) {
  const [appointmentDate, setAppointmentDate] = useState("")
  const [salesNote, setSalesNote] = useState("")
  const [selectedRep, setSelectedRep] = useState("")
  const [salesReps, setSalesReps] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    setAppointmentDate("")
    setSalesNote("")
    setSelectedRep("")
    setError("")
    setSuccess("")
  }, [appointment])

  useEffect(() => {
    async function loadReps() {
      if (!supabase) return
      setLoadingOptions(true)
      const { data, error: profilesError } = await supabase
        .from("profiles")
        .select("full_name, display_name, email, active, role")
        .eq("active", true)
        .eq("role", "Sales Rep")
        .order("full_name", { ascending: true })

      if (profilesError) {
        console.error("Error loading Pickup sales reps:", profilesError)
        setError(profilesError.message)
      } else {
        setSalesReps(data || [])
      }
      setLoadingOptions(false)
    }
    loadReps()
  }, [])

  const selectedRepProfile = useMemo(() => salesReps.find((rep) => rep.email === selectedRep) || null, [salesReps, selectedRep])
  const canSubmit = Boolean(appointment?.appointment_row_id && appointmentDate && selectedRep)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!supabase || !canSubmit || saving) return

    setSaving(true)
    setError("")
    setSuccess("")
    let actionId = null
    const now = new Date().toISOString()

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      const submittedBy = getSubmittedBy(userData?.user)

      const { data: action, error: actionError } = await supabase
        .from("action_runs")
        .insert({
          action_type: "pickup",
          status: "running",
          entity_type: "appointment",
          entity_id: appointment.appointment_row_id,
          triggered_by: submittedBy,
          started_at: now,
          input_data: {
            source_appointment_row_id: appointment.appointment_row_id,
            appointment_date: appointmentDate,
            rep_allocated: selectedRep,
            sales_note: salesNote,
          },
        })
        .select("id")
        .single()

      if (actionError) throw actionError
      actionId = action.id

      const newAppointment = {
        name: appointment.name,
        appointment_date: appointmentDate,
        postcode: appointment.postcode,
        phone_number_1: appointment.phone_number_1 || appointment.phone || null,
        email_address: appointment.email_address || appointment.email || null,
        address: appointment.address,
        product: appointment.product,
        job_type: appointment.job_type,
        lead_source: appointment.lead_source,
        sales_notes: salesNote,
        branch: appointment.branch || null,
        rep_allocated: selectedRep,
        is_pickup: true,
        data_received_date: now,
        submitted_to_sales_app_date: now,
        submitted_to_sales_by: submittedBy,
        appointment_updated_time: now,
        record_last_update: now,
      }

      const { data: created, error: appointmentError } = await supabase
        .from("appointments")
        .insert(newAppointment)
        .select("*")
        .single()

      if (appointmentError) throw appointmentError

      const { data: updatedOriginal, error: originalError } = await supabase
        .from("appointments")
        .update({
          was_picked_up: true,
          pickup_rep: selectedRep,
          appointment_updated_time: now,
          record_last_update: now,
        })
        .eq("appointment_row_id", appointment.appointment_row_id)
        .select("*")
        .single()

      if (originalError) throw originalError

      const { error: actionUpdateError } = await supabase
        .from("action_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          output_data: {
            source_appointment_row_id: appointment.appointment_row_id,
            appointment_row_id: created.appointment_row_id,
            rep_allocated: selectedRep,
            submitted_by: submittedBy,
          },
        })
        .eq("id", actionId)

      if (actionUpdateError) throw actionUpdateError

      setSuccess(`Pickup appointment created for ${selectedRepProfile?.full_name || selectedRep}.`)
      onCreated?.(created, updatedOriginal)
    } catch (err) {
      console.error("Pickup action failed:", err)
      setError(err?.message || "Unable to create Pickup appointment.")
      if (actionId) {
        await supabase.from("action_runs").update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: err?.message || "Unable to create Pickup appointment.",
        }).eq("id", actionId)
      }
    } finally {
      setSaving(false)
    }
  }

  if (!appointment) return null

  return <section className="pickup-appt-page"><style>{`
    .pickup-appt-page{padding:28px 32px 40px;background:#f5f7fa;min-height:calc(100vh - 90px);box-sizing:border-box;color:#0f172a}.pickup-appt-container{max-width:900px;margin:0 auto}.pickup-appt-top{display:flex;align-items:center;gap:14px;margin-bottom:22px}.pickup-appt-back{width:36px;height:36px;border:1px solid #d9e0e7;background:#fff;border-radius:8px;display:grid;place-items:center;color:#475569;cursor:pointer}.pickup-appt-eyebrow{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#0877bd;margin-bottom:5px}.pickup-appt-title{margin:0;font-size:28px;letter-spacing:-.02em}.pickup-appt-subtitle{margin:5px 0 0;color:#64748b;font-size:13px}.pickup-appt-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 2px 10px rgba(15,23,42,.05);overflow:hidden}.pickup-appt-source{padding:16px 22px;background:#f8fafc;border-bottom:1px solid #e8edf2;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.pickup-appt-source-label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8}.pickup-appt-source-value{margin-top:4px;font-size:12px;font-weight:700;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pickup-appt-form{padding:22px}.pickup-appt-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 20px}.pickup-appt-field{display:flex;flex-direction:column;gap:6px}.pickup-appt-field.full{grid-column:1/-1}.pickup-appt-label{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#64748b}.pickup-appt-input,.pickup-appt-textarea{width:100%;box-sizing:border-box;border:1px solid #d7dee7;border-radius:8px;background:#fff;color:#0f172a;font:inherit;font-size:13px;padding:0 11px;height:40px;outline:none}.pickup-appt-textarea{height:88px;padding:10px 11px;resize:vertical}.pickup-appt-input:focus,.pickup-appt-textarea:focus{border-color:#0877bd;box-shadow:0 0 0 3px rgba(8,119,189,.1)}.pickup-appt-input:disabled{background:#f8fafc;color:#94a3b8}.pickup-appt-help{font-size:10px;color:#94a3b8}.pickup-appt-footer{margin-top:22px;padding-top:18px;border-top:1px solid #e8edf2;display:flex;justify-content:flex-end;align-items:center;gap:12px}.pickup-appt-cancel{height:40px;padding:0 14px;border:1px solid #d7dee7;background:#fff;color:#475569;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer}.pickup-appt-submit{height:40px;padding:0 18px;border:0;background:#0877bd;color:#fff;border-radius:8px;font-weight:800;font-size:12px;display:inline-flex;align-items:center;gap:8px;cursor:pointer}.pickup-appt-submit:disabled{opacity:.55;cursor:default}.pickup-appt-message{margin-bottom:16px;padding:11px 13px;border-radius:8px;font-size:12px}.pickup-appt-error{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}.pickup-appt-success{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534}.pickup-appt-spin{animation:pickup-appt-spin 1s linear infinite}@keyframes pickup-appt-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}@media(max-width:700px){.pickup-appt-page{padding:20px 14px}.pickup-appt-grid,.pickup-appt-source{grid-template-columns:1fr}.pickup-appt-field.full{grid-column:auto}.pickup-appt-form{padding:16px}.pickup-appt-footer{flex-direction:column-reverse;align-items:stretch}.pickup-appt-cancel,.pickup-appt-submit{justify-content:center}}
  `}</style><div className="pickup-appt-container"><div className="pickup-appt-top"><button type="button" className="pickup-appt-back" onClick={onBack}><ArrowLeft size={17}/></button><div><div className="pickup-appt-eyebrow">Appointments · Action</div><h1 className="pickup-appt-title">Pickup</h1><p className="pickup-appt-subtitle">Create a new appointment from this previous customer.</p></div></div><div className="pickup-appt-card"><div className="pickup-appt-source"><div><div className="pickup-appt-source-label">Customer</div><div className="pickup-appt-source-value">{appointment.name || "—"}</div></div><div><div className="pickup-appt-source-label">Previous appointment</div><div className="pickup-appt-source-value">{appointment.appointment_date ? new Date(appointment.appointment_date).toLocaleString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—"}</div></div><div><div className="pickup-appt-source-label">Previous result</div><div className="pickup-appt-source-value">{appointment.result || appointment.status || "—"}</div></div></div><form className="pickup-appt-form" onSubmit={handleSubmit}>{error && <div className="pickup-appt-message pickup-appt-error">{error}</div>}{success && <div className="pickup-appt-message pickup-appt-success"><CheckCircle2 size={14} style={{verticalAlign:"-2px",marginRight:6}}/>{success}</div>}<div className="pickup-appt-grid"><label className="pickup-appt-field"><span className="pickup-appt-label">Appointment date & time *</span><div style={{position:"relative"}}><CalendarDays size={15} style={{position:"absolute",left:11,top:12,color:"#64748b"}}/><input className="pickup-appt-input" style={{paddingLeft:34}} type="datetime-local" value={appointmentDate} onChange={(event)=>setAppointmentDate(event.target.value)} /></div></label><label className="pickup-appt-field"><span className="pickup-appt-label">Rep *</span><select className="pickup-appt-input" value={selectedRep} onChange={(event)=>setSelectedRep(event.target.value)} disabled={loadingOptions}><option value="">{loadingOptions ? "Loading sales reps…" : "Select sales rep"}</option>{salesReps.map((rep)=><option key={rep.email} value={rep.email}>{rep.full_name || rep.display_name || rep.email}</option>)}</select><span className="pickup-appt-help">The selected rep's email is saved to rep_allocated and pickup_rep.</span></label><label className="pickup-appt-field"><span className="pickup-appt-label">Job type</span><input className="pickup-appt-input" value={appointment.job_type || ""} disabled /></label><label className="pickup-appt-field"><span className="pickup-appt-label">Lead source</span><input className="pickup-appt-input" value={appointment.lead_source || ""} disabled /></label><label className="pickup-appt-field"><span className="pickup-appt-label">Measure</span><input className="pickup-appt-input" value={appointment.product || ""} disabled /></label><label className="pickup-appt-field"><span className="pickup-appt-label">Address</span><input className="pickup-appt-input" value={appointment.address || ""} disabled /></label><label className="pickup-appt-field full"><span className="pickup-appt-label">Sales note</span><textarea className="pickup-appt-textarea" value={salesNote} placeholder="Add a note for the new appointment" onChange={(event)=>setSalesNote(event.target.value)} /></label></div><div className="pickup-appt-footer"><button type="button" className="pickup-appt-cancel" onClick={onBack}>Cancel</button><button type="submit" className="pickup-appt-submit" disabled={!canSubmit || saving}>{saving ? <><Loader2 size={14} className="pickup-appt-spin"/> Creating…</> : <><RotateCcw size={14}/> Create Pickup</>}</button></div></form></div></div></section>
}

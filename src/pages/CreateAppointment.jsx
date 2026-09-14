import React, { useMemo, useState } from "react"
import { ArrowLeft, CalendarDays, CheckCircle2, Loader2, UserPlus } from "lucide-react"
import { supabase } from "../lib/supabase"

const EMPTY_FORM = {
  name: "",
  postcode: "",
  address: "",
  phone_number_1: "",
  email_address: "",
  appointment_date: "",
  branch: "",
  product: "",
  job_type: "",
  lead_source: "",
  canvasser: "",
  marketing_notes: "",
  rep_allocated: "",
  sales_notes: "",
}

function fieldLabel(label, required = false) {
  return <span className="create-appt-label">{label}{required ? " *" : ""}</span>
}

export default function CreateAppointment({ onBack, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const canSubmit = useMemo(() => form.name.trim() && form.appointment_date, [form.name, form.appointment_date])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setError("")
    setSuccess("")
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!supabase || !canSubmit || saving) return

    setSaving(true)
    setError("")
    setSuccess("")
    const startedAt = new Date().toISOString()
    let actionId = null

    try {
      const actionPayload = {
        action_type: "create_appointment",
        status: "running",
        entity_type: "appointment",
        triggered_by: "crm",
        started_at: startedAt,
        input_data: form,
      }

      const { data: action, error: actionError } = await supabase
        .from("action_runs")
        .insert(actionPayload)
        .select("id")
        .single()

      if (actionError) throw actionError
      actionId = action.id

      const appointment = {
        ...Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim ? value.trim() : value])),
        appointment_updated_time: new Date().toISOString(),
        record_last_update: new Date().toISOString(),
      }

      const { data: created, error: appointmentError } = await supabase
        .from("appointments")
        .insert(appointment)
        .select("*")
        .single()

      if (appointmentError) throw appointmentError

      await supabase
        .from("action_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          entity_id: created.appointment_row_id,
          appointment_row_id: created.appointment_row_id,
          output_data: { appointment_row_id: created.appointment_row_id },
        })
        .eq("id", actionId)

      setForm(EMPTY_FORM)
      setSuccess("Appointment created successfully.")
      if (typeof onCreated === "function") onCreated(created)
    } catch (err) {
      console.error("Create Appointment action failed:", err)
      setError(err?.message || "Unable to create appointment.")

      if (actionId) {
        await supabase
          .from("action_runs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: err?.message || "Unable to create appointment.",
          })
          .eq("id", actionId)
      }
    } finally {
      setSaving(false)
    }
  }

  const input = (field, type = "text", placeholder = "") => (
    <input className="create-appt-input" type={type} value={form[field]} placeholder={placeholder} onChange={(event) => update(field, event.target.value)} />
  )

  return <section className="create-appt-page"><style>{`
    .create-appt-page{padding:28px 32px 40px;background:#f5f7fa;min-height:calc(100vh - 90px);box-sizing:border-box;color:#0f172a}
    .create-appt-container{max-width:1050px;margin:0 auto}
    .create-appt-top{display:flex;align-items:center;gap:14px;margin-bottom:22px}
    .create-appt-back{width:36px;height:36px;border:1px solid #d9e0e7;background:#fff;border-radius:8px;display:grid;place-items:center;color:#475569;cursor:pointer}
    .create-appt-eyebrow{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#0877bd;margin-bottom:5px}
    .create-appt-title{margin:0;font-size:28px;letter-spacing:-.02em}.create-appt-subtitle{margin:5px 0 0;color:#64748b;font-size:13px}
    .create-appt-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 2px 10px rgba(15,23,42,.05);overflow:hidden}
    .create-appt-card-head{padding:18px 22px;border-bottom:1px solid #e8edf2;display:flex;align-items:center;gap:11px}.create-appt-icon{width:34px;height:34px;border-radius:9px;background:#eaf5fc;color:#0877bd;display:grid;place-items:center}.create-appt-card-head h2{margin:0;font-size:17px}.create-appt-card-head p{margin:3px 0 0;font-size:11px;color:#64748b}
    .create-appt-form{padding:22px}.create-appt-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 20px}.create-appt-field{display:flex;flex-direction:column;gap:6px}.create-appt-field.full{grid-column:1/-1}.create-appt-label{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#64748b}.create-appt-input,.create-appt-textarea{width:100%;box-sizing:border-box;border:1px solid #d7dee7;border-radius:8px;background:#fff;color:#0f172a;font:inherit;font-size:13px;padding:0 11px;height:40px;outline:none}.create-appt-textarea{height:88px;padding:10px 11px;resize:vertical}.create-appt-input:focus,.create-appt-textarea:focus{border-color:#0877bd;box-shadow:0 0 0 3px rgba(8,119,189,.1)}
    .create-appt-footer{margin-top:22px;padding-top:18px;border-top:1px solid #e8edf2;display:flex;justify-content:flex-end;align-items:center;gap:12px}.create-appt-cancel{height:40px;padding:0 14px;border:1px solid #d7dee7;background:#fff;color:#475569;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer}.create-appt-submit{height:40px;padding:0 18px;border:0;background:#0877bd;color:#fff;border-radius:8px;font-weight:800;font-size:12px;display:inline-flex;align-items:center;gap:8px;cursor:pointer}.create-appt-submit:disabled{opacity:.55;cursor:default}.create-appt-message{margin-bottom:16px;padding:11px 13px;border-radius:8px;font-size:12px}.create-appt-error{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}.create-appt-success{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534}.create-appt-spin{animation:create-appt-spin 1s linear infinite}@keyframes create-appt-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
    @media(max-width:700px){.create-appt-page{padding:20px 14px}.create-appt-grid{grid-template-columns:1fr}.create-appt-field.full{grid-column:auto}.create-appt-form{padding:16px}.create-appt-footer{flex-direction:column-reverse;align-items:stretch}.create-appt-cancel,.create-appt-submit{justify-content:center}}
  `}</style>
    <div className="create-appt-container">
      <div className="create-appt-top"><button type="button" className="create-appt-back" onClick={onBack}><ArrowLeft size={17}/></button><div><div className="create-appt-eyebrow">Appointments</div><h1 className="create-appt-title">Create Appointment</h1><p className="create-appt-subtitle">Create a new appointment and record the action automatically.</p></div></div>
      <div className="create-appt-card">
        <div className="create-appt-card-head"><div className="create-appt-icon"><UserPlus size={17}/></div><div><h2>Appointment details</h2><p>Enter the information available at the point of booking.</p></div></div>
        <form className="create-appt-form" onSubmit={handleSubmit}>
          {error && <div className="create-appt-message create-appt-error">{error}</div>}
          {success && <div className="create-appt-message create-appt-success"><CheckCircle2 size={14} style={{verticalAlign:"-2px",marginRight:6}}/>{success}</div>}
          <div className="create-appt-grid">
            <label className="create-appt-field">{fieldLabel("Customer name", true)}{input("name","text","Customer name")}</label>
            <label className="create-appt-field">{fieldLabel("Appointment date & time", true)}<div style={{position:"relative"}}><CalendarDays size={15} style={{position:"absolute",left:11,top:12,color:"#64748b"}}/><input className="create-appt-input" style={{paddingLeft:34}} type="datetime-local" value={form.appointment_date} onChange={(event)=>update("appointment_date",event.target.value)}/></div></label>
            <label className="create-appt-field">{fieldLabel("Postcode")}{input("postcode","text","Postcode")}</label>
            <label className="create-appt-field">{fieldLabel("Phone number")}{input("phone_number_1","tel","Phone number")}</label>
            <label className="create-appt-field">{fieldLabel("Email address")}{input("email_address","email","Email address")}</label>
            <label className="create-appt-field">{fieldLabel("Address")}{input("address","text","Address")}</label>
            <label className="create-appt-field">{fieldLabel("Branch")}{input("branch","text","Branch")}</label>
            <label className="create-appt-field">{fieldLabel("Product / measure")}{input("product","text","Product")}</label>
            <label className="create-appt-field">{fieldLabel("Job type")}{input("job_type","text","Job type")}</label>
            <label className="create-appt-field">{fieldLabel("Lead source")}{input("lead_source","text","Lead source")}</label>
            <label className="create-appt-field">{fieldLabel("Canvasser")}{input("canvasser","text","Canvasser")}</label>
            <label className="create-appt-field">{fieldLabel("Sales rep")}{input("rep_allocated","text","Sales rep")}</label>
            <label className="create-appt-field full">{fieldLabel("Marketing notes")}<textarea className="create-appt-textarea" value={form.marketing_notes} placeholder="Marketing notes" onChange={(event)=>update("marketing_notes",event.target.value)}/></label>
            <label className="create-appt-field full">{fieldLabel("Sales notes")}<textarea className="create-appt-textarea" value={form.sales_notes} placeholder="Sales notes" onChange={(event)=>update("sales_notes",event.target.value)}/></label>
          </div>
          <div className="create-appt-footer"><button type="button" className="create-appt-cancel" onClick={onBack}>Cancel</button><button type="submit" className="create-appt-submit" disabled={!canSubmit || saving}>{saving ? <><Loader2 size={14} className="create-appt-spin"/> Creating…</> : <><UserPlus size={14}/> Create Appointment</>}</button></div>
        </form>
      </div>
    </div>
  </section>
}

import React, { useEffect, useMemo, useState } from "react"

import {
  FileText,
  PoundSterling,
  CalendarDays,
  ChevronRight,
  Plus,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react"

import { supabase } from "../lib/supabase"
import Stat from "../components/Stat"
import SalesChart from "../components/SalesChart"
import YearOnYearSalesChart from "../components/YearOnYearSalesChart"
import SalesBreakdown from "../components/SalesBreakdown"
import { formatDate, getInitials, money } from "../utils/formatters"

const EMPTY_FORM = {
  name: "",
  postcode: "",
  address: "",
  phone_number_1: "",
  email_address: "",
  appointment_date: "",
  product: "",
  job_type: "",
  lead_source: "",
  sales_notes: "",
}

function normaliseOptions(rows, field) {
  return Array.from(new Set((rows || []).map((row) => String(row?.[field] ?? "").trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b))
}

function Dashboard({ contracts, total, avg, upcoming, loading, setPage, setSelected }) {
  const [showCreateAppointment, setShowCreateAppointment] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [jobTypes, setJobTypes] = useState([])
  const [leadSources, setLeadSources] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    async function loadOptions() {
      if (!supabase) return
      setLoadingOptions(true)
      const { data, error: optionsError } = await supabase
        .from("appointments")
        .select("job_type, lead_source")

      if (optionsError) {
        console.error("Error loading appointment options:", optionsError)
      } else {
        setJobTypes(normaliseOptions(data, "job_type"))
        setLeadSources(normaliseOptions(data, "lead_source"))
      }
      setLoadingOptions(false)
    }

    loadOptions()
  }, [])

  const canSubmit = useMemo(() => {
    return Boolean(
      form.name.trim() &&
      form.appointment_date &&
      form.postcode.trim() &&
      form.phone_number_1.trim() &&
      form.email_address.trim() &&
      form.address.trim() &&
      form.product.trim() &&
      form.job_type.trim() &&
      form.lead_source.trim()
    )
  }, [form])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setError("")
    setSuccess("")
  }

  function closeCreateAppointment() {
    if (saving) return
    setShowCreateAppointment(false)
    setForm(EMPTY_FORM)
    setError("")
    setSuccess("")
  }

  async function getSubmittedBy() {
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) return "Unknown"

    const metadataName = String(user.user_metadata?.full_name || user.user_metadata?.name || "").trim()
    if (metadataName) return metadataName

    if (user.email) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("email", user.email)
        .maybeSingle()

      const profileName = String(profile?.full_name || "").trim()
      if (profileName) return profileName
      return user.email
    }

    return "Unknown"
  }

  async function createAppointment(event) {
    event.preventDefault()
    if (!supabase || !canSubmit || saving) return

    setSaving(true)
    setError("")
    setSuccess("")
    let actionId = null
    const now = new Date().toISOString()

    try {
      const submittedBy = await getSubmittedBy()

      const { data: action, error: actionError } = await supabase
        .from("action_runs")
        .insert({
          action_type: "create_appointment",
          status: "running",
          entity_type: "appointment",
          triggered_by: submittedBy,
          started_at: now,
          input_data: form,
        })
        .select("id")
        .single()

      if (actionError) throw actionError
      actionId = action.id

      const appointment = Object.fromEntries(
        Object.entries(form).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
      )
      appointment.data_received_date = now
      appointment.submitted_to_sales_app_date = now
      appointment.submitted_to_sales_by = submittedBy
      appointment.appointment_updated_time = now
      appointment.record_last_update = now

      const { data: created, error: appointmentError } = await supabase
        .from("appointments")
        .insert(appointment)
        .select("*")
        .single()

      if (appointmentError) throw appointmentError

      const { error: actionUpdateError } = await supabase
        .from("action_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          entity_id: created.appointment_row_id,
          output_data: {
            appointment_row_id: created.appointment_row_id,
            submitted_by: submittedBy,
          },
        })
        .eq("id", actionId)

      if (actionUpdateError) throw actionUpdateError

      setSuccess("Appointment created successfully.")
      setForm(EMPTY_FORM)
    } catch (err) {
      console.error("Create Appointment action failed:", err)
      const message = err?.message || "Unable to create appointment."
      setError(message)
      if (actionId) {
        await supabase.from("action_runs").update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: message,
        }).eq("id", actionId)
      }
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = { width: "100%", boxSizing: "border-box", height: 38, padding: "0 10px", border: "1px solid #d7dee7", borderRadius: 7, outline: "none", fontFamily: "inherit", fontSize: 12, color: "#0f172a", background: "#fff" }
  const labelStyle = { display: "flex", flexDirection: "column", gap: 5, fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em" }
  const selectStyle = { ...inputStyle, cursor: loadingOptions ? "default" : "pointer" }

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: "#222" }}>Dashboard</h1>
          <p style={{ margin: "5px 0 0", fontSize: 11, color: "#888" }}>Overview of sales performance and activity</p>
        </div>
        <button type="button" onClick={() => setShowCreateAppointment(true)} style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 38, padding: "0 14px", border: 0, borderRadius: 8, background: "#0877bd", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 5px rgba(8,119,189,.18)" }}>
          <Plus size={15} /> Create Appointment
        </button>
      </div>

      <div className="stats">
        <Stat icon={<FileText size={20} />} label="Deals" value={contracts.length} />
        <Stat icon={<PoundSterling size={20} />} label="Net Value" value={money(total)} />
        <Stat icon={<PoundSterling size={20} />} label="Average contract" value={money(avg)} />
        <Stat icon={<CalendarDays size={20} />} label="Upcoming installations" value={upcoming} />
      </div>

      <SalesChart contracts={contracts} />
      <YearOnYearSalesChart contracts={contracts} />

      <div className="grid2">
        <div className="card">
          <div className="card-head">
            <div><h2>Recent contracts</h2><p>Latest sold deals</p></div>
            <button className="link" onClick={() => setPage("contracts")}>View all <ChevronRight size={16} /></button>
          </div>
          {loading ? <div className="empty">Loading…</div> : contracts.length === 0 ? <div className="empty">No contracts found.</div> : (
            <div className="rows">
              {contracts.slice(0, 6).map((contract) => (
                <button className="contract-row" key={contract.id} onClick={() => setSelected(contract)}>
                  <div className="avatar">{getInitials(contract.customer_name || "Customer")}</div>
                  <div className="row-main"><b>{contract.customer_name || "Unnamed customer"}</b><span>{contract.product || "—"}{" · "}{contract.postcode || "—"}</span></div>
                  <div className="row-value"><b>{money(contract.net_value)}</b><span>{contract.sale_date ? formatDate(contract.sale_date) : "—"}</span></div>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head"><div><h2>Sales</h2><p>Contract value by month</p></div></div>
          <SalesBreakdown contracts={contracts} />
        </div>
      </div>

      {showCreateAppointment && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "min(900px, 100%)", maxHeight: "calc(100vh - 40px)", overflowY: "auto", background: "#fff", borderRadius: 14, boxShadow: "0 20px 60px rgba(15,23,42,.22)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid #e8edf2" }}>
              <div><div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#0877bd" }}>Appointments</div><h2 style={{ margin: "4px 0 0", fontSize: 20 }}>Create Appointment</h2><p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>The button below will run the Create Appointment action.</p></div>
              <button type="button" onClick={closeCreateAppointment} disabled={saving} style={{ width: 34, height: 34, border: "1px solid #d7dee7", borderRadius: 7, background: "#fff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }}><X size={16} /></button>
            </div>
            <form onSubmit={createAppointment} style={{ padding: 22 }}>
              {error && <div style={{ marginBottom: 16, padding: "10px 12px", borderRadius: 7, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 12 }}>{error}</div>}
              {success && <div style={{ marginBottom: 16, padding: "10px 12px", borderRadius: 7, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", fontSize: 12 }}><CheckCircle2 size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />{success}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "16px 18px" }}>
                <label style={labelStyle}>Customer name *<input style={inputStyle} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Customer name" /></label>
                <label style={labelStyle}>Appointment date & time *<input style={inputStyle} type="datetime-local" value={form.appointment_date} onChange={(e) => update("appointment_date", e.target.value)} /></label>
                <label style={labelStyle}>Postcode *<input style={inputStyle} value={form.postcode} onChange={(e) => update("postcode", e.target.value)} placeholder="Postcode" /></label>
                <label style={labelStyle}>Phone number *<input style={inputStyle} type="tel" value={form.phone_number_1} onChange={(e) => update("phone_number_1", e.target.value)} placeholder="Phone number" /></label>
                <label style={labelStyle}>Email address *<input style={inputStyle} type="email" value={form.email_address} onChange={(e) => update("email_address", e.target.value)} placeholder="Email address" /></label>
                <label style={labelStyle}>Address *<input style={inputStyle} value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Address" /></label>
                <label style={labelStyle}>Measure *<input style={inputStyle} value={form.product} onChange={(e) => update("product", e.target.value)} placeholder="Measure" /></label>
                <label style={labelStyle}>Job type *<select style={selectStyle} value={form.job_type} onChange={(e) => update("job_type", e.target.value)} disabled={loadingOptions}><option value="">{loadingOptions ? "Loading…" : "Select job type"}</option>{jobTypes.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                <label style={labelStyle}>Lead source *<select style={selectStyle} value={form.lead_source} onChange={(e) => update("lead_source", e.target.value)} disabled={loadingOptions}><option value="">{loadingOptions ? "Loading…" : "Select lead source"}</option>{leadSources.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>Sales note<textarea style={{ ...inputStyle, height: 76, padding: "9px 10px", resize: "vertical" }} value={form.sales_notes} onChange={(e) => update("sales_notes", e.target.value)} placeholder="Sales note" /></label>
              </div>
              <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid #e8edf2", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={closeCreateAppointment} disabled={saving} style={{ height: 40, padding: "0 14px", border: "1px solid #d7dee7", borderRadius: 8, background: "#fff", color: "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={!canSubmit || saving} style={{ height: 40, padding: "0 18px", border: 0, borderRadius: 8, background: "#0877bd", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, opacity: !canSubmit || saving ? .55 : 1 }}>{saving ? <><Loader2 size={14} style={{ animation: "spin .9s linear infinite" }} /> Creating…</> : <><Plus size={14} /> Create Appointment</>}</button>
              </div>
            </form>
          </div>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@media(max-width:700px){.create-appt-grid{grid-template-columns:1fr!important}}`}</style>
        </div>
      )}
    </section>
  )
}

export default Dashboard
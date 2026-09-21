import React, { useEffect, useState } from "react"
import { Search, CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { supabase } from "../lib/supabase"
import CreateAppointment from "./CreateAppointment"

function Appointments({ onSelectAppointment, previewUser = null }) {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [showCreateAppointment, setShowCreateAppointment] = useState(false)
  const pageSize = 50

  async function loadAppointments() {
    setLoading(true); setError("")
    try {
      const from = page * pageSize
      const to = from + pageSize - 1
      let request = supabase.from("appointments").select("*", { count: "exact" }).order("appointment_date", { ascending: false, nullsFirst: false }).range(from, to)
      const search = query.trim()
      if (previewUser?.email) request = request.eq("rep_allocated", previewUser.email)
      if (search) request = request.or([`name.ilike.%${search}%`, `postcode.ilike.%${search}%`, `rep_allocated.ilike.%${search}%`, `phone_number_1.ilike.%${search}%`, `email_address.ilike.%${search}%`].join(","))
      const { data, error: supabaseError, count } = await request
      if (supabaseError) throw supabaseError
      setAppointments(data || []); setTotal(count || 0)
    } catch (err) { console.error("Error loading appointments:", err); setError(err?.message || "Unable to load appointments."); setAppointments([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { setPage(0) }, [previewUser?.id])
  useEffect(() => { loadAppointments() }, [page, query, previewUser?.id, previewUser?.email])
  function handleSearch(value) { setQuery(value); setPage(0) }
  const totalPages = Math.ceil(total / pageSize), canGoBack = page > 0, canGoForward = page < totalPages - 1
  function formatDate(value) { if (!value) return "—"; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) }
  function getResult(appointment) { return appointment.result || appointment.status || "—" }
  function openAppointment(appointment) { onSelectAppointment?.(appointment) }

  if (showCreateAppointment) return <CreateAppointment onBack={() => setShowCreateAppointment(false)} onCreated={() => { setShowCreateAppointment(false); setPage(0); loadAppointments() }} />

  return <section>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 16 }}>
      <div><h1 style={{ margin: 0, fontSize: 22, color: "#222" }}>Appointments</h1><p style={{ margin: "5px 0 0", fontSize: 11, color: "#888" }}>{total.toLocaleString()} appointments{previewUser ? ` · Viewing ${previewUser.full_name || previewUser.email}` : ""}</p></div>
      {!previewUser && <button type="button" onClick={() => setShowCreateAppointment(true)} style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 38, padding: "0 14px", border: 0, borderRadius: 8, background: "#0877bd", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 5px rgba(8,119,189,.18)", whiteSpace: "nowrap" }}><Plus size={15} />Create Appointment</button>}
    </div>
    <div className="card" style={{ marginBottom: 18, padding: "12px 14px" }}><div style={{ position: "relative" }}><Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#999" }} /><input type="text" value={query} onChange={(e) => handleSearch(e.target.value)} placeholder="Search customer, postcode, phone, email or sales rep..." style={{ width: "100%", boxSizing: "border-box", height: 38, padding: "0 12px 0 34px", border: "1px solid #d9dadd", borderRadius: 7, outline: "none", fontFamily: "inherit", fontSize: 12 }} /></div></div>
    {error && <div className="error" style={{ marginBottom: 18 }}><b>Database error</b><span>{error}</span></div>}
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1.4fr 1fr 1fr 1fr 100px", padding: "11px 16px", background: "#f7f7f8", borderBottom: "1px solid #dddfe3", fontSize: 9, fontWeight: 700, color: "#777", textTransform: "uppercase", letterSpacing: "0.04em" }}><div>Customer</div><div>Appointment</div><div>Postcode</div><div>Type</div><div>Sales Rep</div><div>Result</div></div>
      {loading ? <div style={{ padding: "60px 20px", textAlign: "center", color: "#999", fontSize: 12 }}>Loading appointments...</div> : appointments.length === 0 ? <div style={{ padding: "60px 20px", textAlign: "center", color: "#999", fontSize: 12 }}><CalendarDays size={28} style={{ marginBottom: 8 }} /><div>No appointments found.</div></div> : appointments.map((appointment) => <button key={appointment.appointment_row_id} type="button" onClick={() => openAppointment(appointment)} style={{ width: "100%", display: "grid", gridTemplateColumns: "1.7fr 1.4fr 1fr 1fr 1fr 100px", padding: "13px 16px", border: 0, borderBottom: "1px solid #eeeeef", background: "#fff", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#fafbfc" }} onMouseLeave={(e) => { e.currentTarget.style.background = "#fff" }}><div style={{ minWidth: 0 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#222", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{appointment.name || "Unnamed customer"}</div>{appointment.phone_number_1 && <div style={{ marginTop: 3, fontSize: 9, color: "#888" }}>{appointment.phone_number_1}</div>}</div><div style={{ fontSize: 10, color: "#444" }}>{formatDate(appointment.appointment_date)}</div><div style={{ fontSize: 10, color: "#555" }}>{appointment.postcode || "—"}</div><div style={{ fontSize: 10, color: "#555" }}>{appointment.product || appointment.type || appointment.appointment_type || "—"}</div><div style={{ fontSize: 10, color: "#555" }}>{appointment.rep_allocated || "—"}</div><div><span style={{ display: "inline-block", padding: "4px 7px", borderRadius: 5, background: "#f2f3f5", color: "#555", fontSize: 9, fontWeight: 600 }}>{getResult(appointment)}</span></div></button>)}
    </div>
    {totalPages > 1 && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}><div style={{ fontSize: 10, color: "#888" }}>Showing {page * pageSize + 1} – {Math.min((page + 1) * pageSize, total)} of {total.toLocaleString()}</div><div style={{ display: "flex", gap: 6 }}><button type="button" disabled={!canGoBack} onClick={() => setPage((value) => value - 1)} style={{ width: 34, height: 32, border: "1px solid #dddfe3", borderRadius: 7, background: "#fff", cursor: canGoBack ? "pointer" : "default", opacity: canGoBack ? 1 : .4, display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft size={15} /></button><div style={{ minWidth: 70, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#555" }}>Page {page + 1} of {totalPages}</div><button type="button" disabled={!canGoForward} onClick={() => setPage((value) => value + 1)} style={{ width: 34, height: 32, border: "1px solid #dddfe3", borderRadius: 7, background: "#fff", cursor: canGoForward ? "pointer" : "default", opacity: canGoForward ? 1 : .4, display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight size={15} /></button></div></div>}
  </section>
}
export default Appointments

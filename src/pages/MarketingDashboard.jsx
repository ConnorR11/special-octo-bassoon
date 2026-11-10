import React, { useEffect, useMemo, useState } from "react"
import { Megaphone, Target, Phone, CalendarDays, Users, RefreshCw, AlertCircle, BriefcaseBusiness, Filter, X, Clock, MapPin } from "lucide-react"
import Stat from "../components/Stat"
import { supabase } from "../lib/supabase"
import LeadToCall from "./LeadToCall"
import DataSpend from "./DataSpend"
import DataResults from "./DataResults"
import LeadExport from "./LeadExport"
import DataDashboard from "./DataDashboard"
import CanvasserKPI from "./CanvasserKPI"

function getLondonDayBounds() {
  const now = new Date()
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now)
  const values = {}
  parts.forEach((part) => { if (part.type !== "literal") values[part.type] = part.value })
  function londonOffsetMinutes(date) {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", timeZoneName: "longOffset", hour: "2-digit", minute: "2-digit" }).formatToParts(date)
    const offset = parts.find((part) => part.type === "timeZoneName")?.value
    if (!offset || offset === "GMT") return 0
    const match = offset.match(/GMT([+-])(\d{2}):?(\d{2})?/)
    if (!match) return 0
    return (match[1] === "+" ? 1 : -1) * (Number(match[2] || 0) * 60 + Number(match[3] || 0))
  }
  function londonMidnightUtc(year, month, day) {
    const approximate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 0, 0, 0))
    return new Date(approximate.getTime() - londonOffsetMinutes(approximate) * 60 * 1000)
  }
  const start = londonMidnightUtc(values.year, values.month, values.day)
  const nextDay = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + 1))
  const end = londonMidnightUtc(nextDay.getUTCFullYear(), String(nextDay.getUTCMonth() + 1).padStart(2, "0"), String(nextDay.getUTCDate()).padStart(2, "0"))
  return { start: start.toISOString(), end: end.toISOString() }
}

function formatPercent(value) { return Number.isFinite(value) ? `${value.toFixed(1)}%` : "0%" }
function displayValue(value, fallback = "Unassigned") { return String(value || "").trim() || fallback }
function getPostcodeGroup(postcode) {
  const value = String(postcode || "").trim().toUpperCase()
  if (!value) return "Unknown"
  const outward = value.split(/\s+/)[0]
  if (outward.startsWith("G")) return "G"
  const match = outward.match(/^[A-Z]{2}/)
  return match ? match[0] : (outward.match(/^[A-Z]/)?.[0] || "Unknown")
}
function buildBreakdown(appointments, getValue) {
  const counts = {}
  appointments.forEach((appointment) => { const value = getValue(appointment); counts[value] = (counts[value] || 0) + 1 })
  return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}
function formatDateTime(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}
function BreakdownCard({ title, description, icon, rows, total, selectedValue, onSelect, emptyText }) {
  return <div className="card" style={{ height: "100%" }}><div className="card-head" style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 4 }}><div style={{ width: 36, height: 36, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", flexShrink: 0 }}>{icon}</div><div style={{ minWidth: 0 }}><h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2><p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>{description}</p></div></div>{rows.length === 0 ? <div style={{ padding: "30px 10px", textAlign: "center", color: "#64748b", fontSize: 14 }}>{emptyText}</div> : <div style={{ display: "flex", flexDirection: "column" }}>{rows.map((item, index) => { const percentage = total > 0 ? (item.count / total) * 100 : 0; const selected = selectedValue === item.name; return <button key={item.name} type="button" onClick={() => onSelect(item.name)} title={`Filter by ${item.name}`} style={{ appearance: "none", border: 0, background: selected ? "#f1f5f9" : "transparent", width: "100%", textAlign: "left", cursor: "pointer", padding: "13px 9px", borderRadius: 8, borderBottom: index === rows.length - 1 ? "none" : "1px solid #eef2f7" }}><div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 10, alignItems: "center", marginBottom: 7 }}><div style={{ minWidth: 0, fontWeight: selected ? 700 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.name}>{item.name}</div><div style={{ fontWeight: 700, minWidth: 24, textAlign: "right" }}>{item.count}</div><div style={{ color: "#64748b", fontSize: 12, minWidth: 48, textAlign: "right" }}>{formatPercent(percentage)}</div></div><div style={{ height: 7, background: "#eef2f7", borderRadius: 99, overflow: "hidden" }}><div style={{ width: `${percentage}%`, minWidth: item.count > 0 ? 4 : 0, height: "100%", background: selected ? "#0f172a" : "#172554", borderRadius: 99 }} /></div></button>})}<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 9px 0", marginTop: 2, borderTop: "1px solid #e2e8f0", fontWeight: 700 }}><span>Total</span><span>{total} · 100%</span></div></div>}</div>
}
function FilterPill({ label, value, onClear }) { if (!value) return null; return <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 10px", borderRadius: 999, background: "#eef2ff", color: "#1e293b", fontSize: 13, fontWeight: 600 }}><span>{label}: {value}</span><button type="button" onClick={onClear} aria-label={`Clear ${label} filter`} style={{ border: 0, background: "transparent", padding: 0, display: "flex", cursor: "pointer", color: "#64748b" }}><X size={14} /></button></div> }
function AppointmentRow({ appointment, onClick }) {
  return <button type="button" onClick={() => onClick?.(appointment)} style={{ appearance: "none", border: 0, background: "transparent", width: "100%", textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit", display: "grid", gridTemplateColumns: "minmax(180px,1.4fr) minmax(120px,1fr) minmax(110px,1fr) minmax(130px,1fr) minmax(130px,1fr)", gap: 16, alignItems: "center", padding: "14px 0", borderBottom: "1px solid #eef2f7" }}><div style={{ minWidth: 0 }}><div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={appointment?.name || "Unnamed customer"}>{appointment?.name || "Unnamed customer"}</div><div style={{ display: "flex", alignItems: "center", gap: 5, color: "#64748b", fontSize: 12, marginTop: 4 }}><Clock size={12} />Submitted {formatDateTime(appointment?.submission_date)}</div></div><div style={{ minWidth: 0 }}><div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Canvasser</div><div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={appointment?.canvasser_name || appointment?.canvasser}>{displayValue(appointment?.canvasser_name || appointment?.canvasser)}</div></div><div style={{ minWidth: 0 }}><div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Job Type</div><div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayValue(appointment?.job_type)}</div></div><div style={{ minWidth: 0 }}><div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Lead Source</div><div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayValue(appointment?.lead_source)}</div></div><div style={{ minWidth: 0 }}><div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Appointment</div><div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={formatDateTime(appointment?.appointment_date)}><CalendarDays size={13} />{formatDateTime(appointment?.appointment_date)}</div></div></button>
}

function MadeTodayDashboard({ onSelectAppointment }) {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastUpdated, setLastUpdated] = useState(null)
  const [filters, setFilters] = useState({ canvasser: "", jobType: "", leadSource: "", postcode: "" })

  async function loadTodaysAppointments() {
    if (!supabase) { setError("Supabase is not configured. Check your environment variables."); setLoading(false); return }
    setLoading(true); setError("")
    try {
      const { start, end } = getLondonDayBounds()
      const [{ data, error: supabaseError }, { data: profiles, error: profilesError }] = await Promise.all([
        supabase.from("appointments").select("*").gte("submission_date", start).lt("submission_date", end).order("submission_date", { ascending: false }),
        supabase.from("profiles").select("email, full_name, display_name")
      ])
      if (supabaseError) throw supabaseError
      if (profilesError) throw profilesError

      // appointments.canvasser stores the canvasser email. Resolve it to the user's name.
      const profileByEmail = new Map((profiles || []).map((profile) => [String(profile.email || "").trim().toLowerCase(), profile.full_name || profile.display_name || ""]))
      const resolved = (data || []).map((appointment) => {
        const email = String(appointment?.canvasser || "").trim().toLowerCase()
        return { ...appointment, canvasser_name: profileByEmail.get(email) || appointment?.canvasser || "Unassigned" }
      })
      setAppointments(resolved)
      setLastUpdated(new Date())
    } catch (err) {
      console.error("Error loading today's marketing appointments:", err)
      setError(err?.message || "Unable to load today's appointments.")
      setAppointments([])
    } finally { setLoading(false) }
  }

  useEffect(() => { loadTodaysAppointments(); const interval = setInterval(loadTodaysAppointments, 60 * 1000); return () => clearInterval(interval) }, [])

  const canvasserBreakdown = useMemo(() => buildBreakdown(appointments, (a) => displayValue(a?.canvasser_name || a?.canvasser)), [appointments])
  const jobTypeBreakdown = useMemo(() => buildBreakdown(appointments, (a) => displayValue(a?.job_type)), [appointments])
  const leadSourceBreakdown = useMemo(() => buildBreakdown(appointments, (a) => displayValue(a?.lead_source)), [appointments])
  const postcodeBreakdown = useMemo(() => buildBreakdown(appointments, (a) => getPostcodeGroup(a?.postcode)), [appointments])

  const filteredAppointments = useMemo(() => appointments.filter((appointment) => {
    const canvasser = displayValue(appointment?.canvasser_name || appointment?.canvasser)
    return (!filters.canvasser || canvasser === filters.canvasser) && (!filters.jobType || displayValue(appointment?.job_type) === filters.jobType) && (!filters.leadSource || displayValue(appointment?.lead_source) === filters.leadSource) && (!filters.postcode || getPostcodeGroup(appointment?.postcode) === filters.postcode)
  }), [appointments, filters])

  const totalAppointments = appointments.length
  const filteredTotal = filteredAppointments.length
  const topCanvasser = canvasserBreakdown[0]
  const hasFilters = Boolean(filters.canvasser || filters.jobType || filters.leadSource || filters.postcode)
  function setFilter(key, value) { setFilters((current) => ({ ...current, [key]: current[key] === value ? "" : value })) }
  function clearFilters() { setFilters({ canvasser: "", jobType: "", leadSource: "", postcode: "" }) }

  return <section>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20 }}><div><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Megaphone size={22} /><h1 style={{ margin: 0, fontSize: 24 }}>Made Today</h1></div><p style={{ margin: "6px 0 0", color: "#64748b" }}>Appointments submitted today, with performance by canvasser, job type, lead source and postcode.</p></div><button type="button" onClick={loadTodaysAppointments} disabled={loading} style={{ border: "1px solid #d7dee8", background: "#fff", color: "#334155", borderRadius: 8, padding: "10px 14px", display: "inline-flex", alignItems: "center", gap: 8, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1 }}><RefreshCw size={16} />Refresh</button></div>
    {error && <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, marginBottom: 20, borderRadius: 10, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}><AlertCircle size={18} /><span>{error}</span></div>}
    <div className="stats"><Stat icon={<CalendarDays size={20} />} label="Appointments Today" value={loading ? "..." : totalAppointments} /><Stat icon={<Users size={20} />} label="Active Canvassers" value={loading ? "..." : canvasserBreakdown.length} /><Stat icon={<Target size={20} />} label="Top Canvasser" value={loading ? "..." : topCanvasser?.name || "—"} /><Stat icon={<Phone size={20} />} label="Top Canvasser Appointments" value={loading ? "..." : topCanvasser?.count || 0} /></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20, marginTop: 20, alignItems: "stretch" }}>
      <BreakdownCard title="By Canvasser" description="Click a canvasser to filter" icon={<Users size={18} />} rows={canvasserBreakdown} total={totalAppointments} selectedValue={filters.canvasser} onSelect={(value) => setFilter("canvasser", value)} emptyText="No appointments have been generated today." />
      <BreakdownCard title="By Job Type" description="Click a job type to filter" icon={<BriefcaseBusiness size={18} />} rows={jobTypeBreakdown} total={totalAppointments} selectedValue={filters.jobType} onSelect={(value) => setFilter("jobType", value)} emptyText="No job type data available today." />
      <BreakdownCard title="By Lead Source" description="Click a source to filter" icon={<Filter size={18} />} rows={leadSourceBreakdown} total={totalAppointments} selectedValue={filters.leadSource} onSelect={(value) => setFilter("leadSource", value)} emptyText="No lead source data available today." />
      <BreakdownCard title="By Postcode" description="Grouped by postcode area" icon={<MapPin size={18} />} rows={postcodeBreakdown} total={totalAppointments} selectedValue={filters.postcode} onSelect={(value) => setFilter("postcode", value)} emptyText="No postcode data available today." />
    </div>
    {hasFilters && <div className="card" style={{ marginTop: 20, padding: 16 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}><div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}><span style={{ fontWeight: 700 }}>Active filters</span><FilterPill label="Canvasser" value={filters.canvasser} onClear={() => setFilter("canvasser", filters.canvasser)} /><FilterPill label="Job Type" value={filters.jobType} onClear={() => setFilter("jobType", filters.jobType)} /><FilterPill label="Lead Source" value={filters.leadSource} onClear={() => setFilter("leadSource", filters.leadSource)} /><FilterPill label="Postcode" value={filters.postcode} onClear={() => setFilter("postcode", filters.postcode)} /></div><button type="button" onClick={clearFilters} style={{ border: "1px solid #d7dee8", background: "#fff", color: "#334155", borderRadius: 8, padding: "8px 12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 }}><X size={15} />Clear filters</button></div></div>}
    <div className="card" style={{ marginTop: 20 }}><div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}><div><h2 style={{ margin: 0 }}>{hasFilters ? "Filtered Appointments" : "Today's Appointments"}</h2><p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>{hasFilters ? `${filteredTotal} of ${totalAppointments} appointments match the selected filters.` : "Every appointment submitted today. Appointment date is shown for context."}</p></div><div style={{ fontSize: 24, fontWeight: 700 }}>{loading ? "..." : filteredTotal}</div></div>
      {loading ? <div style={{ padding: "35px 0", textAlign: "center", color: "#64748b" }}>Loading today's appointments...</div> : filteredAppointments.length === 0 ? <div style={{ padding: "35px 0", textAlign: "center", color: "#64748b" }}>{hasFilters ? "No appointments match the selected filters." : "No appointments have been generated today."}</div> : <div style={{ overflowX: "auto" }}><div style={{ minWidth: 850 }}><div style={{ display: "grid", gridTemplateColumns: "minmax(180px,1.4fr) minmax(120px,1fr) minmax(110px,1fr) minmax(130px,1fr) minmax(130px,1fr)", gap: 16, padding: "0 0 10px", borderBottom: "1px solid #e2e8f0", color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}><div>Customer</div><div>Canvasser</div><div>Job Type</div><div>Lead Source</div><div>Appointment</div></div>{filteredAppointments.map((appointment) => <AppointmentRow key={appointment.appointment_row_id || `${appointment.name}-${appointment.submission_date}`} appointment={appointment} onClick={onSelectAppointment} />)}</div></div>}
    </div>
    {lastUpdated && <div style={{ marginTop: 16, color: "#94a3b8", fontSize: 12 }}>Last updated {lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · Auto-refreshes every 60 seconds</div>}
  </section>
}


export default function MarketingDashboard({ onSelectAppointment, permissionLevel = 0 }) {
  const [activeSection, setActiveSection] = useState("overview")
  const [activePage, setActivePage] = useState("made-today")
  const canAccessDataResults = Number(permissionLevel) >= 4

  const sections = [
    { id: "overview", label: "Overview", icon: "▦", description: "Daily activity and headline performance", pages: [{ id: "made-today", label: "Made Today" }] },
    { id: "lead-management", label: "Lead Management", icon: "♙", description: "Work, review and manage incoming leads", pages: [{ id: "leads-to-call", label: "Leads To Call" }, { id: "data-kanban", label: "Kanban" }, { id: "data-archived-leads", label: "Archived Leads" }] },
    { id: "lead-acquisition", label: "Lead Acquisition", icon: "◎", description: "Understand lead sources, spend and acquisition costs", pages: [{ id: "lead-sources", label: "Lead Sources", adminOnly: true }, { id: "data-spend", label: "Data Spend" }] },
    { id: "reporting", label: "Reporting", icon: "▤", description: "Detailed performance reports and exports", pages: [{ id: "data-overview", label: "Performance Overview" }, { id: "data-map-appointments", label: "Map of Appointments" }, { id: "canvasser-kpi", label: "Canvasser KPI", minPermission: 3 }, { id: "data-results", label: "Data Results", adminOnly: true }, { id: "lead-export", label: "Lead Export", adminOnly: true }] },
  ]

  const visibleSections = sections.map(section => ({
    ...section,
    pages: section.pages.filter(page => (!page.adminOnly || canAccessDataResults) && (!page.minPermission || Number(permissionLevel) >= page.minPermission)),
  }))
  const currentSection = visibleSections.find(section => section.id === activeSection) || visibleSections[0]
  const currentPage = currentSection.pages.find(page => page.id === activePage) || currentSection.pages[0]

  function openSection(section) {
    const next = visibleSections.find(item => item.id === section)
    if (!next) return
    setActiveSection(section)
    if (!next.pages.some(page => page.id === activePage)) setActivePage(next.pages[0]?.id || "made-today")
  }

  function renderPage() {
    switch (currentPage?.id) {
      case "made-today": return <MadeTodayDashboard onSelectAppointment={onSelectAppointment} />
      case "leads-to-call": return <LeadToCall />
      case "lead-sources": return <DataDashboard standalonePronto embeddedTab="pronto" hideHeader />
      case "data-spend": return <DataSpend />
      case "data-results": return <DataResults embedded />
      case "lead-export": return <LeadExport />
      case "data-overview": return <DataDashboard embeddedTab="overview" hideHeader />
      case "data-map-appointments": return <DataDashboard embeddedTab="map-appointments" hideHeader />
      case "canvasser-kpi": return <CanvasserKPI/>
      case "data-archived-leads": return <DataDashboard embeddedTab="archived-leads" hideHeader />
      case "data-kanban": return <DataDashboard embeddedTab="kanban" hideHeader />
      default: return <MadeTodayDashboard onSelectAppointment={onSelectAppointment} />
    }
  }

  return <section className="marketing-dashboard" style={{ marginTop: -20 }}>
    <div style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, minHeight: 112, padding: "20px 24px", marginBottom: 20, borderRadius: 13, background: "linear-gradient(115deg, #10264a 0%, #173b69 58%, #24558a 100%)", boxShadow: "0 5px 16px rgba(15, 35, 67, .14)" }}>
      <div aria-hidden="true" style={{ position: "absolute", right: -34, top: -95, width: 260, height: 260, border: "1px solid rgba(255,255,255,.10)", borderRadius: "50%", boxShadow: "0 0 0 28px rgba(255,255,255,.035), 0 0 0 58px rgba(255,255,255,.025)" }} />
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 48, height: 48, flex: "0 0 48px", display: "grid", placeItems: "center", borderRadius: 12, background: "rgba(255,255,255,.13)", border: "1px solid rgba(255,255,255,.18)", color: "#fff" }}>
          <Megaphone size={24} strokeWidth={1.9} />
        </div>
        <div>
          <div style={{ marginBottom: 5, color: "#bfdbfe", fontSize: 10, fontWeight: 800, letterSpacing: ".15em", textTransform: "uppercase" }}>Homeshield · Growth & Performance</div>
          <h1 style={{ margin: 0, color: "#fff", fontSize: 27, lineHeight: 1.15, fontWeight: 750, letterSpacing: "-.025em" }}>Marketing Dashboard</h1>
          <p style={{ margin: "6px 0 0", color: "rgba(226,232,240,.88)", fontSize: 12 }}>Your marketing activity, lead management and acquisition performance in one place.</p>
        </div>
      </div>
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 7, padding: "7px 11px", borderRadius: 999, border: "1px solid rgba(255,255,255,.2)", background: "rgba(255,255,255,.09)", color: "#e2e8f0", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", whiteSpace: "nowrap" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#86efac", boxShadow: "0 0 0 3px rgba(134,239,172,.15)" }} />
        MARKETING
      </div>
    </div>

    <div role="tablist" aria-label="Marketing dashboard sections" className="marketing-dashboard-sections" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 20 }}>
      {visibleSections.map(section => {
        const active = activeSection === section.id
        return <button key={section.id} type="button" role="tab" aria-selected={active} onClick={() => openSection(section.id)} style={{ minWidth: 0, minHeight: 68, textAlign: "left", display: "flex", alignItems: "center", gap: 11, padding: "11px 14px", border: active ? "1px solid #93c5fd" : "1px solid #e2e8f0", borderRadius: 10, background: active ? "#eff6ff" : "#fff", color: "#0f172a", cursor: "pointer", boxShadow: active ? "0 1px 3px rgba(37,99,235,.10), inset 0 0 0 1px #bfdbfe" : "0 1px 2px rgba(15,23,42,.025)", transition: "background .15s ease, border-color .15s ease" }}>
          <span aria-hidden="true" style={{ width: 36, height: 36, flex: "0 0 36px", display: "grid", placeItems: "center", borderRadius: 9, background: active ? "#dbeafe" : "#f1f5f9", color: active ? "#1d4ed8" : "#334155", fontSize: 18 }}>{section.icon}</span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 750, color: active ? "#1d4ed8" : "#0f172a" }}>{section.label}</span>
            <span style={{ display: "block", marginTop: 3, fontSize: 10, lineHeight: 1.35, color: "#64748b" }}>{section.description}</span>
          </span>
        </button>
      })}
    </div>

    <div className="marketing-dashboard-workspace" style={{ display: "block", minWidth: 0 }}>
      <div style={{ minWidth: 0, padding: 16, border: "1px solid #bfdbfe", borderTop: "4px solid #3b82f6", borderRadius: 12, background: "linear-gradient(180deg, #eff6ff 0%, #f8fbff 100%)", boxShadow: "0 3px 12px rgba(37,99,235,.07)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #bfdbfe" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
            <span style={{ width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: 8, background: "#dbeafe", color: "#2563eb", fontSize: 16, flexShrink: 0 }}>{currentSection.icon}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "#1d4ed8", fontSize: 13, fontWeight: 800 }}>{currentSection.label} workspace</div>
              <div style={{ color: "#54749b", fontSize: 10 }}>{currentSection.description}</div>
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, color: "#173b69", fontSize: 12, fontWeight: 750, whiteSpace: "nowrap" }}>
            Page
            <select aria-label={"Select " + currentSection.label + " page"} value={currentPage?.id || ""} onChange={event => setActivePage(event.target.value)} style={{ minWidth: 230, maxWidth: "min(360px, 65vw)", padding: "10px 36px 10px 12px", border: "1px solid #93c5fd", borderRadius: 9, background: "#fff", color: "#173b69", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 1px 3px rgba(37,99,235,.08)" }}>
              {currentSection.pages.map(page => <option key={page.id} value={page.id}>{page.label}</option>)}
            </select>
          </label>
        </div>
        {renderPage()}
      </div>
    </div>
    <style>{`@media(max-width:900px){.marketing-dashboard-sections{grid-template-columns:repeat(2,minmax(0,1fr))!important}.marketing-dashboard-workspace{grid-template-columns:minmax(0,1fr)!important;gap:12px!important}.marketing-dashboard-workspace aside[aria-label]{position:static!important}.marketing-dashboard-workspace aside[aria-label] nav{grid-template-columns:repeat(auto-fit,minmax(130px,1fr))!important}}`}</style>
  </section>
}

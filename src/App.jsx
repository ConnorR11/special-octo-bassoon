import React, { useEffect, useMemo, useState } from "react"

import { supabase } from "./lib/supabase"
import EPVSCalculator from "./EPVSCalculator"
import Sidebar from "./components/Sidebar"
import Header from "./components/Header"
import FitSheet from "./components/FitSheet"
import Dashboard from "./pages/Dashboard"
import MarketingTV from "./pages/MarketingTV"
import MarketingDashboard from "./pages/MarketingDashboard"
import Contracts from "./pages/Contracts"
import CustomerDetail from "./pages/CustomerDetail"
import Appointments from "./pages/Appointments"
import AppointmentDetail from "./pages/AppointmentDetail"
import AppointmentActions from "./components/AppointmentActions"
import PickupAppointment from "./pages/PickupAppointment"
import Login from "./pages/Login"
import SalesKPI from "./pages/SalesKPI"
import Users from "./pages/Users"

function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [page, setPage] = useState("dashboard")
  const [mobile, setMobile] = useState(false)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [selected, setSelected] = useState(null)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [pickupAppointment, setPickupAppointment] = useState(null)

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return }
    let mounted = true
    async function loadSession() {
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (!mounted) return
      if (sessionError) { console.error("Error loading auth session:", sessionError); setSession(null) } else setSession(data?.session || null)
      setAuthLoading(false)
    }
    loadSession()
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => { if (mounted) setSession(nextSession || null) })
    return () => { mounted = false; authListener?.subscription?.unsubscribe() }
  }, [])

  async function loadContracts() {
    setLoading(true); setError("")
    if (!supabase) { setError("Supabase is not configured. Check your environment variables."); setLoading(false); return }
    const { data, error: supabaseError } = await supabase.from("deals").select("*").order("sale_date", { ascending: false })
    if (supabaseError) { setError(supabaseError.message); setContracts([]) } else setContracts(data || [])
    setLoading(false)
  }

  useEffect(() => { if (session) loadContracts() }, [session])

  const filteredContracts = useMemo(() => {
    const search = query.toLowerCase().trim()
    return contracts.filter((contract) => {
      const searchableFields = [contract.customer_name, contract.postcode, contract.product, contract.salesperson, contract.contract_number, contract.phone, contract.email]
      const matchesSearch = !search || searchableFields.some((field) => String(field || "").toLowerCase().includes(search))
      const matchesStatus = status === "all" || contract.status === status
      return matchesSearch && matchesStatus
    })
  }, [contracts, query, status])

  const totalValue = contracts.reduce((total, contract) => total + Number(contract.net_value || 0), 0)
  const averageValue = contracts.length > 0 ? totalValue / contracts.length : 0
  const today = new Date().toISOString().slice(0, 10)
  const upcomingInstallations = contracts.filter((contract) => contract.installation_date && contract.installation_date >= today).length

  function handleBackToDeals() { setSelected(null); setPage("contracts"); window.history.pushState({}, "", "/contracts") }
  function handleDealUpdated(updatedDeal) { setContracts((current) => current.map((contract) => contract.id === updatedDeal.id ? updatedDeal : contract)); setSelected(updatedDeal) }
  function handlePageChange(newPage) { setSelected(null); setSelectedAppointment(null); setPickupAppointment(null); setPage(newPage); window.history.pushState({}, "", newPage === "dashboard" ? "/" : `/${newPage}`) }

  function mapAppointment(appointment) { if (!appointment) return null; return { ...appointment, phone: appointment?.phone_number_1, email: appointment?.email_address } }
  function appointmentUrl(appointment) { return `/appointments/${encodeURIComponent(appointment.appointment_row_id)}` }

  function handleAppointmentSelect(appointment) {
    const mappedAppointment = mapAppointment(appointment)
    if (!mappedAppointment?.appointment_row_id) return
    setSelected(null); setPickupAppointment(null); setSelectedAppointment(mappedAppointment); setPage("appointments"); window.history.pushState({}, "", appointmentUrl(mappedAppointment))
  }

  async function loadAppointmentFromUrl(appointmentId) {
    if (!supabase || !appointmentId) return
    setError("")
    const { data, error: appointmentError } = await supabase.from("appointments").select("*").eq("appointment_row_id", appointmentId).maybeSingle()
    if (appointmentError) { console.error("Error loading appointment from URL:", appointmentError); setError(appointmentError.message); return }
    if (!data) { setError("Appointment not found."); window.history.replaceState({}, "", "/appointments"); setPage("appointments"); return }
    setSelected(null); setPickupAppointment(null); setSelectedAppointment(mapAppointment(data)); setPage("appointments")
  }

  useEffect(() => {
    if (!session) return
    function handlePopState() {
      const path = window.location.pathname.replace(/\/+$/, "") || "/"
      const appointmentMatch = path.match(/^\/appointments\/([^/]+)$/)
      if (appointmentMatch) { loadAppointmentFromUrl(decodeURIComponent(appointmentMatch[1])); return }
      setSelected(null); setSelectedAppointment(null); setPickupAppointment(null)
      setPage(path === "/" || path === "/dashboard" ? "dashboard" : path.slice(1))
    }
    handlePopState(); window.addEventListener("popstate", handlePopState); return () => window.removeEventListener("popstate", handlePopState)
  }, [session])

  function handleOpenPickup() { if (selectedAppointment?.result) setPickupAppointment(selectedAppointment) }
  function handleBackToAppointments() { setPickupAppointment(null); setSelectedAppointment(null); setPage("appointments"); window.history.pushState({}, "", "/appointments") }
  function handleBackFromPickup() { setPickupAppointment(null) }
  function handlePickupCreated(created, updatedOriginal) { setSelectedAppointment({ ...selectedAppointment, ...updatedOriginal, phone: updatedOriginal?.phone_number_1, email: updatedOriginal?.email_address }); setPickupAppointment(null) }
  function handleSignOut() { if (supabase) supabase.auth.signOut().catch((err) => console.error("Error signing out:", err)) }

  function handleAppointmentUpdated(updatedAppointment) {
    const mapped = mapAppointment(updatedAppointment)
    setSelectedAppointment((current) => current ? { ...current, ...mapped } : mapped)
  }

  function clickLegacyButton(text) {
    const button = Array.from(document.querySelectorAll("button")).find((candidate) => candidate.textContent.trim() === text)
    if (button) { button.click(); return true }
    return false
  }

  function handleLegacyConfirm() { clickLegacyButton("Confirm Appointment") }
  function handleLegacyResult() { clickLegacyButton("Result") }

  const headerPage = selected ? "customer" : selectedAppointment ? "appointment" : page

  if (authLoading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f7fa", color: "#002d49", fontFamily: "Inter, Arial, sans-serif", fontSize: 14 }}>Loading CRM...</div>
  if (!session) return <Login />

  return <div className="app">
    <Sidebar page={page} setPage={handlePageChange} mobile={mobile} setMobile={setMobile} />
    <main>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, padding: "10px 24px 0", background: "#fff" }}><span style={{ fontSize: 12, color: "#64748b" }}>{session?.user?.email || "Signed in"}</span><button type="button" onClick={handleSignOut} style={{ border: "1px solid #d7dce2", background: "#fff", color: "#002d49", borderRadius: 7, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Sign out</button></div>
      <Header page={headerPage} setMobile={setMobile} onRefresh={loadContracts} />
      {error && page !== "epvs" && <div className="error"><b>Database error</b><span>{error}</span></div>}

      {pickupAppointment ? <PickupAppointment appointment={pickupAppointment} onBack={handleBackFromPickup} onCreated={handlePickupCreated} /> : selectedAppointment ? <div style={{ position: "relative" }}>
        <style>{`.appointment-detail-host > section > div:first-child > div:nth-child(2) > div:nth-child(2){display:none!important}`}</style>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 24px 0", background: "#fff" }}>
          <AppointmentActions appointment={selectedAppointment} onUpdated={handleAppointmentUpdated} onConfirmLegacy={handleLegacyConfirm} onResultLegacy={handleLegacyResult} onOpenPickup={handleOpenPickup} />
        </div>
        <div className="appointment-detail-host"><AppointmentDetail appointment={selectedAppointment} onBack={handleBackToAppointments} onUpdated={handleAppointmentUpdated} /></div>
      </div> : selected ? <CustomerDetail deal={selected} onBack={handleBackToDeals} onUpdated={handleDealUpdated} /> : page === "dashboard" ? <Dashboard contracts={contracts} total={totalValue} avg={averageValue} upcoming={upcomingInstallations} loading={loading} setPage={handlePageChange} setSelected={setSelected} /> : page === "marketing-tv" ? <MarketingTV onSelectAppointment={handleAppointmentSelect} /> : page === "marketing-dashboard" ? <MarketingDashboard contracts={contracts} loading={loading} onSelectAppointment={handleAppointmentSelect} /> : page === "sales-kpi" ? <SalesKPI /> : page === "users" ? <Users /> : page === "contracts" ? <Contracts filtered={filteredContracts} loading={loading} query={query} setQuery={setQuery} status={status} setStatus={setStatus} setSelected={setSelected} /> : page === "appointments" ? <Appointments onSelectAppointment={handleAppointmentSelect} /> : page === "fitsheet" ? <FitSheet contracts={contracts} loading={loading} setSelected={setSelected} onSelectDeal={setSelected} /> : page === "epvs" ? <EPVSCalculator /> : <Dashboard contracts={contracts} total={totalValue} avg={averageValue} upcoming={upcomingInstallations} loading={loading} setPage={handlePageChange} setSelected={setSelected} />}
    </main>
  </div>
}

export default App

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
import AdminUserPreview from "./components/AdminUserPreview"

const DEALS_PAGE_SIZE = 50
const REPORTING_PAGE_SIZE = 1000

function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [previewUser, setPreviewUser] = useState(null)
  const [contracts, setContracts] = useState([])
  const [allDeals, setAllDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [reportingLoading, setReportingLoading] = useState(true)
  const [error, setError] = useState("")
  const [page, setPage] = useState("dashboard")
  const [mobile, setMobile] = useState(false)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [selected, setSelected] = useState(null)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [pickupAppointment, setPickupAppointment] = useState(null)
  const [contractsPage, setContractsPage] = useState(0)
  const [hasMoreContracts, setHasMoreContracts] = useState(false)

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

  useEffect(() => {
    if (!session || !supabase) { setProfile(null); return }
    supabase.from("profiles").select("*").eq("email", session.user.email).maybeSingle().then(({ data, error: profileError }) => {
      if (profileError) console.error("Error loading user profile:", profileError)
      setProfile(data || null)
    })
  }, [session])

  const isAdministrator = Number(profile?.permission_level) >= 4

  useEffect(() => {
    if (page === "users" && !isAdministrator) {
      setPage("dashboard")
      window.history.replaceState({}, "", "/")
    }
  }, [page, isAdministrator])

  async function loadContracts(pageNumber = 0, searchValue = query, statusValue = status) {
    setLoading(true); setError("")
    if (!supabase) { setError("Supabase is not configured. Check your environment variables."); setLoading(false); return }
    const from = pageNumber * DEALS_PAGE_SIZE, to = from + DEALS_PAGE_SIZE - 1, search = String(searchValue || "").trim()
    let request = supabase.from("deals").select("*").order("sale_date", { ascending: false }).range(from, to)
    if (search) { const escaped = search.replace(/[%_]/g, "\\$&").replace(/,/g, "\\,"); request = request.or(`customer_name.ilike.%${escaped}%,postcode.ilike.%${escaped}%,phone.ilike.%${escaped}%,contract_number.ilike.%${escaped}%`) }
    if (statusValue && statusValue !== "all") request = request.eq("status", statusValue)
    const { data, error: supabaseError } = await request
    if (supabaseError) { setError(supabaseError.message); setContracts([]); setHasMoreContracts(false) } else { setContracts(data || []); setContractsPage(pageNumber); setHasMoreContracts((data || []).length === DEALS_PAGE_SIZE) }
    setLoading(false)
  }

  async function loadAllDealsForReporting() {
    if (!supabase) return
    setReportingLoading(true)
    try { const results = []; let from = 0; while (true) { const { data, error: supabaseError } = await supabase.from("deals").select("*").order("sale_date", { ascending: false }).range(from, from + REPORTING_PAGE_SIZE - 1); if (supabaseError) throw supabaseError; const batch = data || []; results.push(...batch); if (batch.length < REPORTING_PAGE_SIZE) break; from += REPORTING_PAGE_SIZE } setAllDeals(results) }
    catch (err) { console.error("Error loading all deals for reporting:", err); setError(err?.message || "Unable to load deals for reporting."); setAllDeals([]) }
    finally { setReportingLoading(false) }
  }

  useEffect(() => { if (!session) return; loadContracts(0, query, status); loadAllDealsForReporting() }, [session])
  const filteredContracts = contracts
  const totalValue = allDeals.reduce((total, contract) => total + Number(contract.net_value || 0), 0)
  const averageValue = allDeals.length > 0 ? totalValue / allDeals.length : 0
  const today = new Date().toISOString().slice(0, 10)
  const upcomingInstallations = allDeals.filter((contract) => contract.installation_date && contract.installation_date >= today).length

  function handleBackToDeals() { setSelected(null); setPage("contracts"); window.history.pushState({}, "", "/contracts") }
  function handleDealUpdated(updatedDeal) { setContracts((current) => current.map((contract) => contract.id === updatedDeal.id ? updatedDeal : contract)); setAllDeals((current) => current.map((contract) => contract.id === updatedDeal.id ? updatedDeal : contract)); setSelected(updatedDeal) }
  function handlePageChange(newPage) {
    if (newPage === "users" && !isAdministrator) return
    setSelected(null); setSelectedAppointment(null); setPickupAppointment(null); setPage(newPage)
    if (newPage === "contracts") { setQuery(""); setStatus("all"); loadContracts(0, "", "all") }
    window.history.pushState({}, "", newPage === "dashboard" ? "/" : `/${newPage}`)
  }
  function handleSearchChange(value) { setQuery(value); loadContracts(0, value, status) }
  function handleStatusChange(value) { setStatus(value); loadContracts(0, query, value) }
  function mapAppointment(appointment) { if (!appointment) return null; return { ...appointment, phone: appointment?.phone_number_1, email: appointment?.email_address } }
  function appointmentUrl(appointment) { return `/appointments/${encodeURIComponent(appointment.appointment_row_id)}` }
  function handleAppointmentSelect(appointment) { const mappedAppointment = mapAppointment(appointment); if (!mappedAppointment?.appointment_row_id) return; setSelected(null); setPickupAppointment(null); setSelectedAppointment(mappedAppointment); setPage("appointments"); window.history.pushState({}, "", appointmentUrl(mappedAppointment)) }
  async function loadAppointmentFromUrl(appointmentId) {
    if (!supabase || !appointmentId) return
    setError("")
    const { data, error: appointmentError } = await supabase.from("appointments").select("*").eq("appointment_row_id", appointmentId).maybeSingle()
    if (appointmentError) { console.error("Error loading appointment from URL:", appointmentError); setError(appointmentError.message); return }
    if (!data || (previewUser?.email && String(data.rep_allocated || "").toLowerCase() !== String(previewUser.email).toLowerCase())) { setError("Appointment not available in this user preview."); window.history.replaceState({}, "", "/appointments"); setPage("appointments"); return }
    setSelected(null); setPickupAppointment(null); setSelectedAppointment(mapAppointment(data)); setPage("appointments")
  }
  useEffect(() => { if (!session) return; function handlePopState() { const path = window.location.pathname.replace(/\/+$/, "") || "/"; const appointmentMatch = path.match(/^\/appointments\/([^/]+)$/); if (appointmentMatch) { loadAppointmentFromUrl(decodeURIComponent(appointmentMatch[1])); return } setSelected(null); setSelectedAppointment(null); setPickupAppointment(null); setPage(path === "/" || path === "/dashboard" ? "dashboard" : path.slice(1)) } handlePopState(); window.addEventListener("popstate", handlePopState); return () => window.removeEventListener("popstate", handlePopState) }, [session, previewUser?.id])
  function handleOpenPickup() { if (selectedAppointment?.result) setPickupAppointment(selectedAppointment) }
  function handleBackToAppointments() { setPickupAppointment(null); setSelectedAppointment(null); setPage("appointments"); window.history.pushState({}, "", "/appointments") }
  function handleBackFromPickup() { setPickupAppointment(null) }
  function handlePickupCreated(created, updatedOriginal) { setSelectedAppointment({ ...selectedAppointment, ...updatedOriginal, phone: updatedOriginal?.phone_number_1, email: updatedOriginal?.email_address }); setPickupAppointment(null) }
  function handleSignOut() { if (supabase) supabase.auth.signOut().catch((err) => console.error("Error signing out:", err)) }
  function handleAppointmentUpdated(updatedAppointment) { const mapped = mapAppointment(updatedAppointment); setSelectedAppointment((current) => current ? { ...current, ...mapped } : mapped) }
  function clickLegacyButton(text) { const host = document.querySelector(".appointment-detail-host"); const button = host ? Array.from(host.querySelectorAll("button")).find((candidate) => candidate.textContent.trim() === text) : null; if (button) { button.click(); return true } return false }
  function handleLegacyConfirm() { clickLegacyButton("Confirm Appointment") }
  function handleLegacyResult() { clickLegacyButton("Result") }
  const headerPage = selected ? "customer" : selectedAppointment ? "appointment" : page
  if (authLoading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f7fa", color: "#002d49", fontFamily: "Inter, Arial, sans-serif", fontSize: 14 }}>Loading CRM...</div>
  if (!session) return <Login />
  return <div className="app"><Sidebar page={page} setPage={handlePageChange} mobile={mobile} setMobile={setMobile} onSignOut={handleSignOut} permissionLevel={profile?.permission_level} /><main><Header page={headerPage} setMobile={setMobile} />{error && page !== "epvs" && <div className="error"><b>Database error</b><span>{error}</span></div>}{isAdministrator && page === "users" && <AdminUserPreview activeUser={previewUser} onStart={(user) => { setPreviewUser(user); setSelected(null); setSelectedAppointment(null); setPickupAppointment(null); setPage("appointments"); window.history.pushState({}, "", "/appointments") }} onStop={() => { setPreviewUser(null); setSelectedAppointment(null); setPickupAppointment(null); setPage("users"); window.history.pushState({}, "", "/users") }} />}{isAdministrator && previewUser && <AdminUserPreview activeUser={previewUser} onStart={() => {}} onStop={() => { setPreviewUser(null); setSelectedAppointment(null); setPage("users"); window.history.pushState({}, "", "/users") }} />}{pickupAppointment ? <PickupAppointment appointment={pickupAppointment} onBack={handleBackFromPickup} onCreated={handlePickupCreated} /> : selectedAppointment ? <div style={{ position: "relative" }}><style>{`.appointment-detail-host > section > div:first-child > div:nth-child(2) > div:nth-child(2){display:none!important}`}</style><div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 24px 0", background: "#fff" }}><AppointmentActions appointment={selectedAppointment} onUpdated={handleAppointmentUpdated} onConfirmLegacy={handleLegacyConfirm} onResultLegacy={handleLegacyResult} onOpenPickup={handleOpenPickup} /></div><div className="appointment-detail-host"><AppointmentDetail appointment={selectedAppointment} onBack={handleBackToAppointments} onUpdated={handleAppointmentUpdated} /></div></div> : selected ? <CustomerDetail deal={selected} onBack={handleBackToDeals} onUpdated={handleDealUpdated} /> : page === "dashboard" ? <Dashboard contracts={allDeals} total={totalValue} avg={averageValue} upcoming={upcomingInstallations} loading={reportingLoading} setPage={handlePageChange} setSelected={setSelected} /> : page === "marketing-tv" ? <MarketingTV onSelectAppointment={handleAppointmentSelect} /> : page === "marketing-dashboard" ? <MarketingDashboard contracts={contracts} loading={loading} onSelectAppointment={handleAppointmentSelect} /> : page === "sales-kpi" ? <SalesKPI /> : page === "users" && isAdministrator ? <Users /> : page === "contracts" ? <Contracts filtered={filteredContracts} loading={loading} query={query} setQuery={handleSearchChange} status={status} setStatus={handleStatusChange} setSelected={setSelected} page={contractsPage} pageSize={DEALS_PAGE_SIZE} hasMore={hasMoreContracts} onPreviousPage={() => loadContracts(Math.max(contractsPage - 1, 0), query, status)} onNextPage={() => loadContracts(contractsPage + 1, query, status)} /> : page === "appointments" ? <Appointments onSelectAppointment={handleAppointmentSelect} previewUser={previewUser} /> : page === "fitsheet" ? <FitSheet contracts={allDeals} loading={reportingLoading} setSelected={setSelected} onSelectDeal={setSelected} /> : page === "epvs" ? <EPVSCalculator /> : <Dashboard contracts={allDeals} total={totalValue} avg={averageValue} upcoming={upcomingInstallations} loading={reportingLoading} setPage={handlePageChange} setSelected={setSelected} />}</main></div>
}
export default App

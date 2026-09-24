import React, { useEffect, useState } from "react"
import { supabase } from "./lib/supabase"
import EPVSCalculator from "./EPVSCalculator"
import Sidebar from "./components/Sidebar"
import Header from "./components/Header"
import FitSheet from "./FitSheet"
import Dashboard from "./pages/Dashboard"
import MarketingTV from "./pages/MarketingTV"
import MarketingDashboard from "./pages/MarketingDashboard"
import Contracts from "./pages/Contracts"
import RTSList from "./pages/RTSList"
import SalesCommission from "./pages/SalesCommission"
import CustomerDetail from "./pages/CustomerDetail"
import Appointments from "./pages/Appointments"
import AppointmentDetail from "./pages/AppointmentDetail"
import AppointmentActions from "./components/AppointmentActions"
import PickupAppointment from "./pages/PickupAppointment"
import Login from "./pages/Login"
import SalesKPI from "./pages/SalesKPI"
import Users from "./pages/Users"
import Tasks from "./pages/Tasks"
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
  const [commissionDeals, setCommissionDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [reportingLoading, setReportingLoading] = useState(true)
  const [commissionLoading, setCommissionLoading] = useState(true)
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
    if (!session || !supabase) { setProfile(null); setPreviewUser(null); return }
    let mounted = true
    async function loadProfileAndPreview() {
      const { data: profileData, error: profileError } = await supabase.from("profiles").select("*").eq("auth_user_id", session.user.id).maybeSingle()
      if (!mounted) return
      if (profileError) console.error("Error loading user profile:", profileError)
      setProfile(profileData || null)
      const { data: previewId, error: previewError } = await supabase.rpc("current_preview_profile_id")
      if (previewError) { console.error("Error loading admin preview:", previewError); return }
      if (!previewId) { setPreviewUser(null); return }
      const { data: previewProfile, error: previewProfileError } = await supabase.from("profiles").select("id, full_name, display_name, email, role, permission_level, branch, active").eq("id", previewId).maybeSingle()
      if (!mounted) return
      if (previewProfileError) console.error("Error loading preview profile:", previewProfileError)
      setPreviewUser(previewProfile || null)
    }
    loadProfileAndPreview()
    return () => { mounted = false }
  }, [session])

  const isAdministrator = Number(profile?.permission_level) >= 4
  const effectivePermissionLevel = previewUser?.permission_level ?? profile?.permission_level ?? 0
  const effectiveRole = previewUser?.role ?? profile?.role ?? ""
  const effectiveUserEmail = previewUser?.email ?? session?.user?.email ?? ""

  useEffect(() => {
    if ((page === "users" || page === "tasks") && !isAdministrator) { setPage("dashboard"); window.history.replaceState({}, "", "/") }
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
    try {
      const results = []; let from = 0
      while (true) {
        const { data, error: supabaseError } = await supabase.from("deals").select("*").order("sale_date", { ascending: false }).range(from, from + REPORTING_PAGE_SIZE - 1)
        if (supabaseError) throw supabaseError
        const batch = data || []; results.push(...batch)
        if (batch.length < REPORTING_PAGE_SIZE) break
        from += REPORTING_PAGE_SIZE
      }
      setAllDeals(results)
    } catch (err) { console.error("Error loading all deals for reporting:", err); setError(err?.message || "Unable to load deals for reporting."); setAllDeals([]) } finally { setReportingLoading(false) }
  }

  async function loadCommissionDeals() {
    if (!supabase) return
    setCommissionLoading(true)
    try {
      const results = []; let from = 0
      while (true) {
        const { data, error: supabaseError } = await supabase
          .from("deals")
          .select("*")
          .not("pipedrive_stage", "in", "(Decline,Customer Cancelled)")
          .is("commission_paid_date", null)
          .order("installation_start_date", { ascending: true })
          .range(from, from + REPORTING_PAGE_SIZE - 1)
        if (supabaseError) throw supabaseError
        const batch = data || []; results.push(...batch)
        if (batch.length < REPORTING_PAGE_SIZE) break
        from += REPORTING_PAGE_SIZE
      }
      setCommissionDeals(results)
    } catch (err) { console.error("Error loading commission deals:", err); setError(err?.message || "Unable to load commission data."); setCommissionDeals([]) } finally { setCommissionLoading(false) }
  }

  useEffect(() => { if (!session) return; loadContracts(0, query, status); loadAllDealsForReporting(); loadCommissionDeals() }, [session, previewUser?.id])

  const filteredContracts = contracts
  const totalValue = allDeals.reduce((total, contract) => total + Number(contract.net_value || 0), 0)
  const averageValue = allDeals.length > 0 ? totalValue / allDeals.length : 0
  const today = new Date().toISOString().slice(0, 10)
  const upcomingInstallations = allDeals.filter((contract) => contract.installation_date && contract.installation_date >= today).length

  function handleBackToDeals() { setSelected(null); setPage("contracts"); window.history.pushState({}, "", "/contracts") }
  function handleDealUpdated(updatedDeal) {
    setContracts(current => current.map(contract => contract.id === updatedDeal.id ? updatedDeal : contract))
    setAllDeals(current => current.map(contract => contract.id === updatedDeal.id ? updatedDeal : contract))
    setCommissionDeals(current => current.map(contract => contract.id === updatedDeal.id ? updatedDeal : contract))
    setSelected(updatedDeal)
  }
  function handlePageChange(newPage) {
    if ((newPage === "users" || newPage === "tasks") && !isAdministrator) return
    setSelected(null); setSelectedAppointment(null); setPickupAppointment(null); setPage(newPage)
    if (newPage === "contracts") { setQuery(""); setStatus("all"); loadContracts(0, "", "all") }
    window.history.pushState({}, "", newPage === "dashboard" ? "/" : `/${newPage}`)
  }
  function handleSearchChange(value) { setQuery(value); loadContracts(0, value, status) }
  function mapAppointment(appointment) { if (!appointment) return null; return { ...appointment, phone: appointment?.phone_number_1, email: appointment?.email_address } }
  function appointmentUrl(appointment) { return `/appointments/${encodeURIComponent(appointment.appointment_row_id)}` }
  function handleAppointmentSelect(appointment) { const mappedAppointment = mapAppointment(appointment); if (!mappedAppointment?.appointment_row_id) return; setSelected(null); setPickupAppointment(null); setSelectedAppointment(mappedAppointment); setPage("appointments"); window.history.pushState({}, "", appointmentUrl(mappedAppointment)) }
  async function loadAppointmentFromUrl(appointmentId) {
    if (!supabase || !appointmentId) return
    setError("")
    const { data, error: appointmentError } = await supabase.from("appointments").select("*").eq("appointment_row_id", appointmentId).maybeSingle()
    if (appointmentError) { console.error("Error loading appointment from URL:", appointmentError); setError(appointmentError.message); return }
    if (!data) { setError("Appointment not available in this user preview."); window.history.replaceState({}, "", "/appointments"); setPage("appointments"); return }
    setSelected(null); setPickupAppointment(null); setSelectedAppointment(mapAppointment(data)); setPage("appointments")
  }
  useEffect(() => {
    if (!session) return
    function handlePopState() {
      const path = window.location.pathname.replace(/\/+$/, "") || "/"
      const appointmentMatch = path.match(/^\/appointments\/([^/]+)$/)
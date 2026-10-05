import React, { useEffect, useState } from "react"
import { supabase } from "./lib/supabase"
import EPVSCalculator from "./EPVSCalculator"
import Sidebar from "./components/Sidebar"
import Header from "./components/Header"
import FitSheet from "./FitSheet"
import Dashboard from "./pages/Dashboard"
import DataDashboard from "./pages/DataDashboard"
import DataClean from "./pages/DataClean"
import SalesPerformance from "./pages/SalesPerformance"
import Installations from "./pages/Installations"
import MarketingTV from "./pages/MarketingTV"
import MarketingDashboard from "./pages/MarketingDashboard"
import Leads from "./pages/Leads"
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
import CanvasserKPI from "./pages/CanvasserKPI"
import Users from "./pages/Users"
import Tasks from "./pages/Tasks"
import SEO from "./pages/SEO"
import MI from "./pages/MI"
import Reviews from "./pages/Reviews"
import IntegrationLogs from "./pages/IntegrationLogs"
import Templates from "./pages/Templates"
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
      if (sessionError) { console.error("Error loading auth session:", sessionError); setSession(null) }
      else setSession(data?.session || null)
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
      if (profileError) console.error("Error loading profile:", profileError)
      setProfile(profileData || null)
    }
    loadProfileAndPreview()
    return () => { mounted = false }
  }, [session])

  useEffect(() => {
    const handleResize = () => setMobile(window.innerWidth < 900)
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  function openAppointment(appointment) {
    setSelectedAppointment(appointment)
    setPage("appointment-detail")
  }

  let pageContent = null
  if (page === "dashboard") {
    pageContent = <Dashboard />
  } else if (page === "data-dashboard") {
    pageContent = <DataDashboard />
  } else if (page === "data-clean") {
    pageContent = <DataClean onOpenAppointment={openAppointment} />
  } else if (page === "sales-performance") {
    pageContent = <SalesPerformance contracts={allDeals} total={totalValue} avg={averageValue} upcoming={upcomingInstallations} setSelected={setSelected}/>
  } else if (page === "epvs") {
    pageContent = <EPVSCalculator />
  } else if (page === "fit-sheet") {
    pageContent = <FitSheet setSelected={setSelected} />
  } else if (page === "marketing-tv") {
    pageContent = <MarketingTV />
  } else if (page === "marketing-dashboard") {
    pageContent = <MarketingDashboard />
  } else if (page === "leads") {
    pageContent = <Leads setSelected={setSelected} />
  } else if (page === "contracts") {
    pageContent = <Contracts />
  } else if (page === "rts") {
    pageContent = <RTSList />
  } else if (page === "sales-commission") {
    pageContent = <SalesCommission deals={commissionDeals} />
  } else if (page === "customer-detail") {
    pageContent = <CustomerDetail customer={selected} setPage={setPage} />
  } else if (page === "appointments") {
    pageContent = <Appointments setSelectedAppointment={setSelectedAppointment} setPage={setPage} />
  } else if (page === "appointment-detail") {
    pageContent = <AppointmentDetail appointment={selectedAppointment} setPage={setPage} />
  } else if (page === "appointment-actions") {
    pageContent = <AppointmentActions appointment={selectedAppointment} setPage={setPage} />
  } else if (page === "pickup-appointment") {
    pageContent = <PickupAppointment appointment={pickupAppointment} setPage={setPage} />
  } else if (page === "sales-kpi") {
    pageContent = <SalesKPI />
  } else if (page === "canvasser-kpi") {
    pageContent = <CanvasserKPI />
  } else if (page === "users") {
    pageContent = <Users />
  } else if (page === "tasks") {
    pageContent = <Tasks />
  } else if (page === "seo") {
    pageContent = <SEO />
  } else if (page === "mi") {
    pageContent = <MI />
  } else if (page === "reviews") {
    pageContent = <Reviews />
  } else if (page === "integration-logs") {
    pageContent = <IntegrationLogs />
  } else if (page === "templates") {
    pageContent = <Templates />
  } else {
    pageContent = <Dashboard />
  }

  if (authLoading) return <div style={{padding:40}}>Loading…</div>
  if (!session) return <Login />

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} profile={profile} mobile={mobile} />
      <div className="app-main">
        <Header profile={profile} query={query} setQuery={setQuery} />
        <main>{pageContent}</main>
      </div>
    </div>
  )
}

export default App

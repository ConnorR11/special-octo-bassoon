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
import SolarAppointmentAnalysis from "./pages/SolarAppointmentAnalysis"
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
    const restrictedPages = { "sales-performance": 2, "marketing-dashboard": 3, "canvasser-kpi": 3, mi: 4, seo: 4, reviews: 4, users: 4, tasks: 4, templates: 4, "integration-logs": 4, "data-dashboard": 4, "data-clean": 4, "solar-appointment-analysis": 4 }
    const requiredPermission = restrictedPages[page]
    if (requiredPermission && effectivePermissionLevel < requiredPermission) {
      setPage("dashboard")
      if (window.location.pathname !== "/") window.history.replaceState({}, "", "/")
    }
  }, [page, effectivePermissionLevel])

  async function loadContracts(pageNumber = 0, searchValue = query, statusValue = status) {
    setLoading(true); setError("")
    if (!supabase) { setError("Supabase is not configured. Check your environment variables."); setLoading(false); return }
    const from = pageNumber * DEALS_PAGE_SIZE; const to = from + DEALS_PAGE_SIZE - 1; const search = String(searchValue || "").trim()
    let request = supabase.from("deals").select("*").order("sale_date", { ascending: false }).range(from, to)
    if (effectivePermissionLevel < 3) {
      const viewerId = previewUser?.id || profile?.id; let visibleSalespersonIds = []
      if (viewerId) {
        const { data: visibleProfiles, error: visibleProfilesError } = await supabase.from("profiles").select("pipedrive_person_id").or(`id.eq.${viewerId},sales_manager.eq.${viewerId},manager_id.eq.${viewerId}`)
        if (visibleProfilesError) throw visibleProfilesError
        visibleSalespersonIds = (visibleProfiles || []).map(row => String(row?.pipedrive_person_id || "").trim()).filter(Boolean)
      }
      if (visibleSalespersonIds.length) request = request.in("salesperson", visibleSalespersonIds)
      else request = request.eq("salesperson", "__NO_VISIBLE_SALESPERSON__")
    }
    if (search) { const escaped = search.replace(/[%_]/g, "\\$&").replace(/,/g, "\\,"); request = request.or(`customer_name.ilike.%${escaped}%,postcode.ilike.%${escaped}%,phone.ilike.%${escaped}%,contract_number.ilike.%${escaped}%`) }
    if (statusValue && statusValue !== "all") request = request.eq("status", statusValue)
    const { data, error: supabaseError } = await request
    if (supabaseError) { setError(supabaseError.message); setContracts([]); setHasMoreContracts(false) }
    else { setContracts(data || []); setContractsPage(pageNumber); setHasMoreContracts((data || []).length === DEALS_PAGE_SIZE) }
    setLoading(false)
  }

  async function loadAllDealsForReporting() {
    if (!supabase) return
    setReportingLoading(true)
    try { const results=[]; let from=0; while(true) { const {data,error:supabaseError}=await supabase.from("deals").select("*").order("sale_date",{ascending:false}).range(from,from+REPORTING_PAGE_SIZE-1); if(supabaseError) throw supabaseError; const batch=data||[]; results.push(...batch); if(batch.length<REPORTING_PAGE_SIZE) break; from+=REPORTING_PAGE_SIZE } setAllDeals(results) }
    catch(err){ console.error("Error loading all deals for reporting:",err); setError(err?.message||"Unable to load deals for reporting."); setAllDeals([]) }
    finally{ setReportingLoading(false) }
  }

  async function loadCommissionDeals() {
    if (!supabase) return
    setCommissionLoading(true)
    try { const results=[]; let from=0; const viewerId=previewUser?.id||profile?.id; let visibleSalespersonIds=[]; if(effectivePermissionLevel<4&&viewerId){const {data:visibleProfiles,error:visibleProfilesError}=await supabase.from("profiles").select("pipedrive_person_id").or(`id.eq.${viewerId},sales_manager.eq.${viewerId},manager_id.eq.${viewerId}`); if(visibleProfilesError) throw visibleProfilesError; visibleSalespersonIds=(visibleProfiles||[]).map(row=>String(row?.pipedrive_person_id||"").trim()).filter(Boolean)} while(true){let request=supabase.from("deals").select("*").not("pipedrive_stage","in","(Decline,Customer Cancelled,Returned To Sales,Awaiting Funds,On Hold,Pending Cancellation)").is("commission_paid_date",null).gte("sale_date","2026-01-01").order("installation_start_date",{ascending:true}).range(from,from+REPORTING_PAGE_SIZE-1); if(effectivePermissionLevel<4) request=visibleSalespersonIds.length?request.in("salesperson",visibleSalespersonIds):request.eq("salesperson","__NO_VISIBLE_SALESPERSON__"); const {data,error:supabaseError}=await request; if(supabaseError) throw supabaseError; const batch=data||[]; results.push(...batch); if(batch.length<REPORTING_PAGE_SIZE) break; from+=REPORTING_PAGE_SIZE } setCommissionDeals(results) }
    catch(err){ console.error("Error loading commission deals:",err); setError(err?.message||"Unable to load commission data."); setCommissionDeals([]) }
    finally{ setCommissionLoading(false) }
  }

  useEffect(() => { if (!session) return; loadContracts(0, query, status); loadAllDealsForReporting(); loadCommissionDeals() }, [session, previewUser?.id])

  const filteredContracts = contracts
  const totalValue = allDeals.reduce((total, contract) => total + Number(contract.net_value || 0), 0)
  const averageValue = allDeals.length > 0 ? totalValue / allDeals.length : 0
  const today = new Date().toISOString().slice(0, 10)
  const upcomingInstallations = allDeals.filter(contract => contract.installation_date && contract.installation_date >= today).length

  function handleBackToDeals(){setSelected(null);setPage("contracts");window.history.pushState({},"","/contracts")}
  function handleDealUpdated(updatedDeal){const excludedCommissionStages=new Set(["decline","customer cancelled","returned to sales","awaiting funds","on hold","pending cancellation"]);const stage=String(updatedDeal?.pipedrive_stage??"").trim().replace(/\s+/g," ").toLowerCase();const shouldRemoveFromCommissions=excludedCommissionStages.has(stage);setContracts(current=>current.map(contract=>contract.id===updatedDeal.id?updatedDeal:contract));setAllDeals(current=>current.map(contract=>contract.id===updatedDeal.id?updatedDeal:contract));setCommissionDeals(current=>shouldRemoveFromCommissions?current.filter(contract=>contract.id!==updatedDeal.id):current.map(contract=>contract.id===updatedDeal.id?updatedDeal:contract));setSelected(updatedDeal)}

  function handlePageChange(newPage) {
    const requiredPermission={"sales-performance":2,"marketing-dashboard":3,"canvasser-kpi":3,mi:4,seo:4,reviews:4,users:4,tasks:4,templates:4,"integration-logs":4,"data-dashboard":4,"data-clean":4,"solar-appointment-analysis":4}[newPage]
    if(requiredPermission&&effectivePermissionLevel<requiredPermission)return
    setSelected(null);setSelectedAppointment(null);setPickupAppointment(null);setPage(newPage)
    if(newPage==="contracts"){setQuery("");setStatus("all");loadContracts(0,"","all")}
    window.history.pushState({},"",newPage==="dashboard"?"/":`/${newPage}`)
  }

  function handleSearchChange(value){setQuery(value);loadContracts(0,value,status)}
  function mapAppointment(appointment){if(!appointment)return null;return {...appointment,phone:appointment?.phone_number_1,email:appointment?.email_address}}
  function appointmentUrl(appointment){return `/appointments/${encodeURIComponent(appointment.appointment_row_id)}`}
  function handleAppointmentSelect(appointment){const mappedAppointment=mapAppointment(appointment);if(!mappedAppointment?.appointment_row_id)return;setSelected(null);setPickupAppointment(null);setSelectedAppointment(mappedAppointment);setPage("appointments");window.history.pushState({},"",appointmentUrl(mappedAppointment))}
  async function loadAppointmentFromUrl(appointmentId){if(!supabase||!appointmentId)return;setError("");const {data,error:appointmentError}=await supabase.from("appointments").select("*").eq("appointment_row_id",appointmentId).maybeSingle();if(appointmentError){console.error("Error loading appointment from URL:",appointmentError);setError(appointmentError.message);return}if(!data){setError("Appointment not available in this user preview.");window.history.replaceState({},"","/appointments");setPage("appointments");return}setSelected(null);setPickupAppointment(null);setSelectedAppointment(mapAppointment(data));setPage("appointments")}

  useEffect(() => {
    if (!session) return
    function handlePopState(){
      const path=window.location.pathname.replace(/\/+$/,"/")||"/"
      const appointmentMatch=path.match(/^\/appointments\/([^/]+)$/)
      if(appointmentMatch){loadAppointmentFromUrl(decodeURIComponent(appointmentMatch[1]));return}
      setSelected(null);setSelectedAppointment(null);setPickupAppointment(null)
      setPage(path==="/"||path==="/dashboard"?"dashboard":path.slice(1))
    }
    handlePopState(); window.addEventListener("popstate",handlePopState); return()=>window.removeEventListener("popstate",handlePopState)
  },[session,previewUser?.id])

  function handleOpenPickup(){if(selectedAppointment?.result)setPickupAppointment(selectedAppointment)}
  function handleBackToAppointments(){setPickupAppointment(null);setSelectedAppointment(null);setPage("appointments");window.history.pushState({},"","/appointments")}
  function handleBackFromPickup(){setPickupAppointment(null)}
  function handlePickupCreated(updatedOriginal){setSelectedAppointment({...selectedAppointment,...updatedOriginal,phone:updatedOriginal?.phone_number_1,email:updatedOriginal?.email_address});setPickupAppointment(null)}
  function handleSignOut(){if(supabase)supabase.auth.signOut().catch(err=>console.error("Error signing out:",err))}
  function handleAppointmentUpdated(updatedAppointment){const mapped=mapAppointment(updatedAppointment);setSelectedAppointment(current=>current?{...current,...mapped}:mapped)}
  function clickLegacyButton(text){const host=document.querySelector(".appointment-detail-host");const button=host?Array.from(host.querySelectorAll("button")).find(candidate=>candidate.textContent.trim()===text):null;if(button){button.click();return true}return false}
  function handleLegacyConfirm(){clickLegacyButton("Confirm Appointment")}
  function handleLegacyResult(){clickLegacyButton("Result")}

  const headerPage=selected?"customer":selectedAppointment?"appointment":page==="canvasser-kpi"?"dashboard":page

  if(authLoading)return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f5f7fa",color:"#002d49",fontFamily:"Inter, Arial, sans-serif",fontSize:14}}>Loading CRM...</div>
  if(!session)return <Login />

  const displayName=previewUser?.display_name||previewUser?.full_name||profile?.display_name||profile?.full_name||session?.user?.user_metadata?.full_name||session?.user?.user_metadata?.name||"there"
  const currentHour=new Date().getHours()
  const greeting=currentHour<12?"Good Morning":currentHour<18?"Good Afternoon":"Good Evening"
  const homeContent=<section><div style={{marginBottom:18}}><h1 style={{margin:0,fontSize:22,color:"#222"}}>{greeting}, {displayName}</h1><p style={{margin:"5px 0 0",fontSize:11,color:"#888"}}>Welcome to the Homeshield Scotland CRM</p></div></section>

  let pageContent
  if (pickupAppointment) {
    pageContent = <PickupAppointment appointment={pickupAppointment} onBack={handleBackFromPickup} onCreated={handlePickupCreated}/>
  } else if (selectedAppointment) {
    pageContent = <div style={{position:"relative"}}>
      <style>{`.appointment-detail-host > section > div:first-child > div:nth-child(2) > div:nth-child(2){display:none!important}`}</style>
      <div style={{display:"flex",justifyContent:"flex-end",padding:"10px 24px 0",background:"#fff"}}>
        <AppointmentActions appointment={selectedAppointment} onUpdated={handleAppointmentUpdated} onConfirm={handleLegacyConfirm} onResult={handleLegacyResult} onOpenPickup={handleOpenPickup}/>
      </div>
      <div className="appointment-detail-host">
        <AppointmentDetail appointment={selectedAppointment} permissionLevel={effectivePermissionLevel} role={effectiveRole} onBack={handleBackToAppointments} onUpdated={handleAppointmentUpdated}/>
      </div>
    </div>
  } else if (selected) {
    pageContent = <CustomerDetail deal={selected} onBack={handleBackToDeals} onUpdated={handleDealUpdated}/>
  } else if (page === "dashboard") {
    pageContent = homeContent
  } else if (page === "data-dashboard") {
    pageContent = <DataDashboard/>
  } else if (page === "data-clean") {
    pageContent = <DataClean onOpenAppointment={handleAppointmentSelect}/>
  } else if (page === "solar-appointment-analysis") {
    pageContent = <SolarAppointmentAnalysis onSelectAppointment={handleAppointmentSelect}/>
  } else if (page === "sales-performance") {
    pageContent = <SalesPerformance contracts={allDeals} total={totalValue} avg={averageValue} upcoming={upcomingInstallations} setSelected={setSelected}/>
  } else if (page === "epvs") {
    pageContent = <EPVSCalculator/>
  } else if (page === "fit-sheet") {
    pageContent = <FitSheet/>
  } else if (page === "contracts") {
    pageContent = <Contracts contracts={filteredContracts} loading={loading} query={query} status={status} onSearchChange={handleSearchChange} onStatusChange={value=>{setStatus(value);loadContracts(0,query,value)}} onNext={()=>loadContracts(contractsPage+1)} onPrev={()=>loadContracts(Math.max(contractsPage-1,0))} hasNext={hasMoreContracts} hasPrev={contractsPage>0} onSelect={deal=>{setSelected(deal);setPage("contracts");window.history.pushState({},"",`/contracts/${deal.id}`)}} onNewContract={()=>{}}/>
  } else if (page === "installations") {
    pageContent = <Installations/>
  } else if (page === "marketing-tv") {
    pageContent = <MarketingTV onSelectAppointment={handleAppointmentSelect}/>
  } else if (page === "marketing-dashboard") {
    pageContent = <MarketingDashboard/>
  } else if (page === "leads") {
    pageContent = <Leads/>
  } else if (page === "rts-list") {
    pageContent = <RTSList/>
  } else if (page === "commissions") {
    pageContent = <SalesCommission/>
  } else if (page === "appointments") {
    pageContent = <Appointments onSelect={handleAppointmentSelect}/>
  } else if (page === "sales-kpi") {
    pageContent = <SalesKPI deals={allDeals} loading={reportingLoading}/>
  } else if (page === "canvasser-kpi") {
    pageContent = <CanvasserKPI deals={allDeals} loading={reportingLoading}/>
  } else if (page === "users") {
    pageContent = <Users/>
  } else if (page === "tasks") {
    pageContent = <Tasks/>
  } else if (page === "seo") {
    pageContent = <SEO/>
  } else if (page === "mi") {
    pageContent = <MI/>
  } else if (page === "reviews") {
    pageContent = <Reviews setMobile={setMobile}/>
  } else if (page === "integration-logs") {
    pageContent = <IntegrationLogs setMobile={setMobile}/>
  } else if (page === "templates") {
    pageContent = <Templates/>
  } else {
    pageContent = <Dashboard deals={allDeals}/>
  }

  return <div className="app">
    <Sidebar page={page} setPage={handlePageChange} mobile={mobile} setMobile={setMobile} onSignOut={handleSignOut} permissionLevel={effectivePermissionLevel}/>
    <main>
      <Header page={headerPage} setMobile={setMobile}/>
      {error&&page!=="epvs"&&<div className="error"><b>Database error</b><span>{error}</span></div>}
      {isAdministrator&&page==="users"&&<AdminUserPreview activeUser={previewUser} onStart={user=>{setPreviewUser(user);setSelected(null);setSelectedAppointment(null);setPickupAppointment(null);setPage("appointments");window.history.pushState({},"","/appointments")}} onStop={async()=>{setPreviewUser(null);setSelectedAppointment(null);setPickupAppointment(null);setPage("users");window.history.pushState({},"","/users")}}/>}
      {isAdministrator&&previewUser&&page!=="users"&&<AdminUserPreview activeUser={previewUser} onStart={()=>{}} onStop={async()=>{setPreviewUser(null);setSelectedAppointment(null);setPickupAppointment(null);setPage("users");window.history.pushState({},"","/users")}}/>}
      {pageContent}
    </main>
  </div>
}

export default App
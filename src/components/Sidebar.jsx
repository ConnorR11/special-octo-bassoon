import React from "react"
import {
  LayoutDashboard, FileText, ChevronDown, ChevronRight, BarChart3, CalendarDays,
  Wrench, PoundSterling, CreditCard, Headphones, Settings, Target, ClipboardCheck,
  Megaphone, Phone, Handshake, Trophy, AlertTriangle, Receipt, UserRound,
  MessageCircle, UserCog, FileCheck, LogOut, ClipboardList, Lock, KanbanSquare,
  Presentation, Clipboard, Calculator, ShoppingCart, Building2, Search, Database, Star,
} from "lucide-react"
import CallLog from "../pages/CallLog"
import PhoneDialer from "./PhoneDialer"

function Sidebar({ page, setPage, mobile, setMobile, onSignOut, permissionLevel = 1, department = "" }) {
  const numericPermissionLevel = Number(permissionLevel) || 0
  const isAdministrator = numericPermissionLevel >= 4
  const canAccessMarketingDashboard = numericPermissionLevel >= 3
  const canAccessCanvasserKPI = numericPermissionLevel >= 3
  const canAccessSalesPerformance = numericPermissionLevel >= 2

  const [openFolders, setOpenFolders] = React.useState({
    sales: false, marketing: false, installation: false, finance: false,
    customerService: false, admin: false, procurement: false,
    headOffice: false, digitalTeam: false,
  })
  const [showPhoneDialer, setShowPhoneDialer] = React.useState(false)
  const [showCallLog, setShowCallLog] = React.useState(false)

  const toggleFolder = (folder) => setOpenFolders(current => ({ ...current, [folder]: !current[folder] }))
  const navigate = (pageName) => { setPage(pageName); setMobile(false) }
  const isActive = (pageName) => page === pageName

  const canAccessRoute = (route) => {
    const requiredPermission = {
      "sales-performance": 2,
      "marketing-dashboard": 3,
      "canvasser-kpi": 3,
      mi: 4, seo: 4, reviews: 4, users: 4, tasks: 4,
      templates: 4, "integration-logs": 4, "data-dashboard": 4, "data-clean": 4, "solar-appointment-analysis": 4, "open-solar-ids": 4,
    }[route]
    return !requiredPermission || numericPermissionLevel >= requiredPermission
  }

  React.useEffect(() => {
    if (!numericPermissionLevel) return
    const path = window.location.pathname.replace(/^\/+|\/+$/g, "")
    const route = path === "" ? "dashboard" : path.split("/")[0]
    if (!canAccessRoute(route)) {
      setPage("dashboard")
      if (window.location.pathname !== "/") window.history.replaceState({}, "", "/")
      window.dispatchEvent(new PopStateEvent("popstate"))
    }
  }, [numericPermissionLevel])

  const callLogOverlay = showCallLog && typeof document !== "undefined"
    ? <CallLog onClose={() => setShowCallLog(false)} />
    : null

  return (
    <>
      <style>{`@media (max-width:900px){.sidebar{transform:translateX(-100%);transition:transform .2s ease;z-index:1000}.sidebar.sidebar-open{transform:translateX(0)}.sidebar-overlay{display:block;position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:999}main{margin-left:0;width:100%;padding:22px 18px}.mobile-menu{display:inline-flex}}`}</style>
      {mobile && <div className="sidebar-overlay" onClick={() => setMobile(false)} />}
      <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">C</div>
          <div><strong>Homeshield Scotland</strong><span>CRM</span></div>
        </div>

        <nav className="sidebar-nav">
          <button type="button" className={`sidebar-item ${isActive("dashboard") ? "active" : ""}`} onClick={() => navigate("dashboard")}>
            <LayoutDashboard size={18}/><span>Home</span>
          </button>
          <button type="button" className="sidebar-item" onClick={() => setShowPhoneDialer(true)}>
            <Phone size={18}/><span>Softphone</span>
          </button>
          <div className="sidebar-divider" />

          <Folder title="Marketing" icon={Megaphone} open={openFolders.marketing} onClick={() => toggleFolder("marketing")}>
            <NavItem icon={BarChart3} label="Marketing Dashboard" active={isActive("marketing-dashboard")} onClick={() => navigate("marketing-dashboard")} disabled={!canAccessMarketingDashboard} locked={!canAccessMarketingDashboard}/>
            <NavItem icon={Target} label="Leads" active={isActive("leads")} onClick={() => navigate("leads")}/>
            <NavItem icon={Phone} label="Call Log" onClick={() => setShowCallLog(true)}/>
            <NavItem icon={CalendarDays} label="Booked Leads" disabled/>
            <NavItem icon={Handshake} label="Commissions" disabled/>
            <NavItem icon={Trophy} label="Canvasser KPI" active={isActive("canvasser-kpi")} onClick={() => navigate("canvasser-kpi")} disabled={!canAccessCanvasserKPI} locked={!canAccessCanvasserKPI}/>
          </Folder>

          <Folder title="Sales" icon={Target} open={openFolders.sales} onClick={() => toggleFolder("sales")}>
            <NavItem icon={LayoutDashboard} label="Mastersheet" active={isActive("marketing-tv")} onClick={() => navigate("marketing-tv")}/>
            <NavItem icon={CalendarDays} label="Appointments" active={isActive("appointments")} onClick={() => navigate("appointments")}/>
            <NavItem icon={FileText} label="Deals" active={isActive("contracts")} onClick={() => navigate("contracts")}/>
            <NavItem icon={FileCheck} label="RTS List" active={isActive("rts-list")} onClick={() => navigate("rts-list")}/>
            <NavItem icon={PoundSterling} label="Commissions" active={isActive("commissions")} onClick={() => navigate("commissions")}/>
            <NavItem icon={Trophy} label="Sales KPI" active={isActive("sales-kpi")} onClick={() => navigate("sales-kpi")}/>
            <NavItem icon={BarChart3} label="Sales Performance" active={isActive("sales-performance")} onClick={() => navigate("sales-performance")} disabled={!canAccessSalesPerformance} locked={!canAccessSalesPerformance}/>
          </Folder>

          <Folder title="Procurement" icon={Clipboard} open={openFolders.procurement} onClick={() => toggleFolder("procurement")}>
            <NavItem icon={ClipboardCheck} label="Surveys" disabled/>
            <NavItem icon={CalendarDays} label="Cover Calls" disabled/>
            <NavItem icon={Calculator} label="Costing" disabled/>
            <NavItem icon={ShoppingCart} label="Ordering" disabled/>
          </Folder>

          <Folder title="Installations" icon={Wrench} open={openFolders.installation} onClick={() => toggleFolder("installation")}>
            <NavItem icon={ClipboardCheck} label="Fit Sheet" active={isActive("fitsheet")} onClick={() => navigate("fitsheet")}/>
            <NavItem icon={KanbanSquare} label="Kanban" active={isActive("installations")} onClick={() => navigate("installations")}/>
            <NavItem icon={AlertTriangle} label="Installation Issues" disabled/>
          </Folder>

          <Folder title="Remedials" icon={Headphones} open={openFolders.customerService} onClick={() => toggleFolder("customerService")}>
            <NavItem icon={UserRound} label="Customers" disabled/>
            <NavItem icon={MessageCircle} label="Follow-ups" disabled/>
            <NavItem icon={AlertTriangle} label="Complaints" disabled/>
          </Folder>

          <Folder title="Accounts" icon={PoundSterling} open={openFolders.finance} onClick={() => toggleFolder("finance")}>
            <NavItem icon={PoundSterling} label="Revenue" disabled/>
            <NavItem icon={CreditCard} label="Payments" disabled/>
            <NavItem icon={Receipt} label="Invoices" disabled/>
          </Folder>

          <Folder title="Head Office" icon={Building2} open={openFolders.headOffice} onClick={() => toggleFolder("headOffice")}>
            <NavItem icon={BarChart3} label="MI" active={isActive("mi")} onClick={() => navigate("mi")}/>
            <NavItem icon={Star} label="Reviews" active={isActive("reviews")} onClick={() => navigate("reviews")}/>
            <NavItem icon={FileText} label="Daily Reports" disabled/>
            <NavItem icon={Database} label="Data Results" disabled/>
            <NavItem icon={Building2} label="Fleet" disabled/>
            <NavItem icon={Handshake} label="Agency Agreements" disabled/>
            <NavItem icon={ClipboardList} label="Training Log" disabled/>
            <NavItem icon={CalendarDays} label="Holidays / RTO" disabled/>
            <NavItem icon={FileText} label="Documents / Brochures" disabled/>
          </Folder>

          <Folder title="Digital Team" icon={Search} open={openFolders.digitalTeam} onClick={() => toggleFolder("digitalTeam")}>
            <NavItem icon={Search} label="SEO" active={isActive("seo")} onClick={() => navigate("seo")}/>
          </Folder>

          {isAdministrator && <Folder title="Administration" icon={Settings} open={openFolders.admin} onClick={() => toggleFolder("admin")}>
            <NavItem icon={BarChart3} label="Data Dashboard" active={isActive("data-dashboard")} onClick={() => navigate("data-dashboard")}/>
            <NavItem icon={Database} label="Data Clean" active={isActive("data-clean")} onClick={() => navigate("data-clean")}/>
            <NavItem icon={CalendarDays} label="Solar Appointment Analysis" active={isActive("solar-appointment-analysis")} onClick={() => navigate("solar-appointment-analysis")}/>
            <NavItem icon={Database} label="OpenSolar IDs" active={isActive("open-solar-ids")} onClick={() => navigate("open-solar-ids")}/>
            <NavItem icon={UserCog} label="Users" active={isActive("users")} onClick={() => navigate("users")}/>
            <NavItem icon={ClipboardList} label="Tasks" active={isActive("tasks")} onClick={() => navigate("tasks")}/>
            <NavItem icon={Presentation} label="Templates" active={isActive("templates")} onClick={() => navigate("templates")}/>
            <NavItem icon={Database} label="API & Webhooks" active={isActive("integration-logs")} onClick={() => navigate("integration-logs")}/>
            <NavItem icon={Settings} label="Settings" disabled/>
          </Folder>}
        </nav>

        <div className="sidebar-footer" style={{marginTop:"auto",flexDirection:"column",alignItems:"stretch",gap:10}}>
          <button type="button" onClick={onSignOut} style={{width:"100%",border:0,background:"transparent",color:"inherit",display:"flex",alignItems:"center",gap:10,padding:"8px 0",cursor:"pointer",font:"inherit",textAlign:"left"}}>
            <LogOut size={16}/><span style={{fontWeight:600}}>Sign out</span>
          </button>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div className="sidebar-footer-icon"><Settings size={16}/></div>
            <div><strong>CRM System</strong><span>v1.0</span></div>
          </div>
        </div>
      </aside>

      {callLogOverlay}
      {showPhoneDialer && <PhoneDialer onClose={() => setShowPhoneDialer(false)}/>} 
    </>
  )
}

function Folder({ title, icon: Icon, open, onClick, children }) {
  return <div className="sidebar-folder">
    <button type="button" className="sidebar-folder-header" onClick={onClick}>
      <span className="sidebar-folder-left"><Icon size={17}/><span>{title}</span></span>
      {open ? <ChevronDown size={15}/> : <ChevronRight size={15}/>} 
    </button>
    {open && <div className="sidebar-folder-items">{children}</div>}
  </div>
}

function NavItem({ icon: Icon, label, active = false, onClick, disabled = false, locked = false }) {
  return <button type="button" className={`sidebar-subitem ${active ? "active" : ""} ${disabled ? "disabled" : ""}`} onClick={disabled ? undefined : onClick} disabled={disabled}>
    <span className="sidebar-subitem-icon"><Icon size={15}/></span>
    <span>{label}</span>
    {locked ? <Lock size={13} color="#b8c0c8" style={{marginLeft:"auto"}}/> : disabled ? <span className="coming-soon">Soon</span> : null}
  </button>
}

export default Sidebar

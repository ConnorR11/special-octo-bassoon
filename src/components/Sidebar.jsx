import React, { useEffect, useState } from "react"

import {
  LayoutDashboard, FileText, Calculator, ChevronDown, ChevronRight, Sun, Users,
  BarChart3, CalendarDays, Wrench, PoundSterling, CreditCard, Headphones, Settings,
  Target, ClipboardCheck, Megaphone, Phone, Handshake, Trophy, AlertTriangle, Receipt,
  PanelsTopLeft, UserRound, MessageCircle, Files, FilePlus, UserCog, FileCheck, LogOut,
} from "lucide-react"

function normaliseDepartment(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
}

function getDepartmentFolder(department) {
  const value = normaliseDepartment(department)

  const departmentMap = {
    marketing: "marketing",
    sales: "sales",
    "central confirmation": "sales",
    "central confirmation manager": "sales",
    procurement: "procurement",
    installations: "installation",
    installation: "installation",
    remedials: "customerService",
    "customer service": "customerService",
    accounts: "finance",
    finance: "finance",
    solar: "solar",
    documents: "documents",
  }

  return departmentMap[value] || null
}

function Sidebar({
  page,
  setPage,
  mobile,
  setMobile,
  onSignOut,
  permissionLevel = 1,
  department = "",
}) {
  const numericPermissionLevel = Number(permissionLevel) || 0
  const isRestrictedDepartmentUser =
    numericPermissionLevel === 1 ||
    numericPermissionLevel === 2

  const departmentFolder =
    getDepartmentFolder(department)

  const canSeeFolder = (folder) => {
    if (!isRestrictedDepartmentUser) return true
    return departmentFolder === folder
  }

  const [openFolders, setOpenFolders] = useState({
    sales: false,
    marketing: false,
    installation: false,
    finance: false,
    solar: false,
    customerService: false,
    documents: false,
    admin: false,
    procurement: false,
  })

  useEffect(() => {
    if (!isRestrictedDepartmentUser || !departmentFolder) {
      return
    }

    setOpenFolders((current) => ({
      ...current,
      [departmentFolder]: true,
    }))
  }, [isRestrictedDepartmentUser, departmentFolder])

  const toggleFolder = (folder) =>
    setOpenFolders((current) => ({
      ...current,
      [folder]: !current[folder],
    }))

  const navigate = (pageName) => {
    setPage(pageName)
    setMobile(false)
  }

  const isActive = (pageName) => page === pageName
  const isAdministrator = numericPermissionLevel >= 4

  return (
    <>
      {mobile && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobile(false)}
        />
      )}

      <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>

        <div className="sidebar-brand">
          <div className="brand-mark">C</div>

          <div>
            <strong>Homeshield Scotland</strong>
            <span>CRM</span>
          </div>
        </div>

        <nav className="sidebar-nav">

          {/* HOME */}
          <button
            type="button"
            className={`sidebar-item ${
              isActive("dashboard") ? "active" : ""
            }`}
            onClick={() => navigate("dashboard")}
          >
            <LayoutDashboard size={18} />
            <span>Home</span>
          </button>

          <div className="sidebar-divider" />

          {/* MARKETING */}
          {canSeeFolder("marketing") && (
            <Folder
              title="Marketing"
              icon={Megaphone}
              open={openFolders.marketing}
              onClick={() => toggleFolder("marketing")}
            >
              <NavItem
                icon={BarChart3}
                label="Marketing Dashboard"
                active={isActive("marketing-dashboard")}
                onClick={() => navigate("marketing-dashboard")}
              />

              <NavItem icon={Target} label="Leads" disabled />
              <NavItem icon={Phone} label="Call Log" disabled />
              <NavItem icon={CalendarDays} label="Booked Leads" disabled />
              <NavItem icon={Handshake} label="Commissions" disabled />
              <NavItem icon={Trophy} label="Canvasser KPI" disabled />
            </Folder>
          )}

          {/* SALES */}
          {canSeeFolder("sales") && (
            <Folder
              title="Sales"
              icon={Target}
              open={openFolders.sales}
              onClick={() => toggleFolder("sales")}
            >
              <NavItem
                icon={LayoutDashboard}
                label="Mastersheet"
                active={isActive("marketing-tv")}
                onClick={() => navigate("marketing-tv")}
              />

              <NavItem
                icon={CalendarDays}
                label="Appointments"
                active={isActive("appointments")}
                onClick={() => navigate("appointments")}
              />

              <NavItem
                icon={FileText}
                label="Deals"
                active={isActive("contracts")}
                onClick={() => navigate("contracts")}
              />

              <NavItem icon={FileCheck} label="Overstays" disabled />
              <NavItem icon={FileCheck} label="ECOFs" disabled />
              <NavItem icon={PoundSterling} label="Commissions" disabled />

              <NavItem
                icon={Trophy}
                label="Sales KPI"
                active={isActive("sales-kpi")}
                onClick={() => navigate("sales-kpi")}
              />

              <NavItem icon={BarChart3} label="Sales Performance" disabled />
            </Folder>
          )}

          {/* PROCUREMENT */}
          {canSeeFolder("procurement") && (
            <Folder
              title="Procurement"
              icon={Wrench}
              open={openFolders.procurement}
              onClick={() => toggleFolder("procurement")}
            >
              <NavItem icon={ClipboardCheck} label="Surveys" disabled />
              <NavItem icon={CalendarDays} label="Cover Calls" disabled />
              <NavItem icon={AlertTriangle} label="Costing" disabled />
              <NavItem icon={AlertTriangle} label="Ordering" disabled />
            </Folder>
          )}

          {/* INSTALLATIONS */}
          {canSeeFolder("installation") && (
            <Folder
              title="Installations"
              icon={Wrench}
              open={openFolders.installation}
              onClick={() => toggleFolder("installation")}
            >
              <NavItem
                icon={ClipboardCheck}
                label="Fit Sheet"
                active={isActive("fitsheet")}
                onClick={() => navigate("fitsheet")}
              />

              <NavItem icon={CalendarDays} label="Installations" disabled />
              <NavItem icon={AlertTriangle} label="Installation Issues" disabled />
            </Folder>
          )}

          {/* REMEDIALS */}
          {canSeeFolder("customerService") && (
            <Folder
              title="Remedials"
              icon={Headphones}
              open={openFolders.customerService}
              onClick={() => toggleFolder("customerService")}
            >
              <NavItem icon={UserRound} label="Customers" disabled />
              <NavItem icon={MessageCircle} label="Follow-ups" disabled />
              <NavItem icon={AlertTriangle} label="Complaints" disabled />
            </Folder>
          )}

          {/* ACCOUNTS */}
          {canSeeFolder("finance") && (
            <Folder
              title="Accounts"
              icon={PoundSterling}
              open={openFolders.finance}
              onClick={() => toggleFolder("finance")}
            >
              <NavItem icon={PoundSterling} label="Revenue" disabled />
              <NavItem icon={CreditCard} label="Payments" disabled />
              <NavItem icon={Receipt} label="Invoices" disabled />
            </Folder>
          )}

          {/* DOCUMENTS */}
          {canSeeFolder("documents") && (
            <Folder
              title="Documents"
              icon={Files}
              open={openFolders.documents}
              onClick={() => toggleFolder("documents")}
            >
              <NavItem icon={FileText} label="Company Brochures" disabled />
              <NavItem icon={Files} label="Customer Documents" disabled />

              <NavItem
                icon={FilePlus}
                label="Templates"
                active={isActive("templates")}
                onClick={() => navigate("templates")}
              />
            </Folder>
          )}

          {/* ADMINISTRATION */}
          {isAdministrator && (
            <Folder
              title="Administration"
              icon={Settings}
              open={openFolders.admin}
              onClick={() => toggleFolder("admin")}
            >
              <NavItem
                icon={UserCog}
                label="Users"
                active={isActive("users")}
                onClick={() => navigate("users")}
              />

              <NavItem icon={Settings} label="Settings" disabled />
            </Folder>
          )}

        </nav>

        {/* FOOTER */}
        <div
          className="sidebar-footer"
          style={{
            marginTop: "auto",
            flexDirection: "column",
            alignItems: "stretch",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onSignOut}
            style={{
              width: "100%",
              border: 0,
              background: "transparent",
              color: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 0",
              cursor: "pointer",
              font: "inherit",
              textAlign: "left",
            }}
          >
            <LogOut size={16} />
            <span style={{ fontWeight: 600 }}>
              Sign out
            </span>
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div className="sidebar-footer-icon">
              <Settings size={16} />
            </div>

            <div>
              <strong>CRM System</strong>
              <span>v1.0</span>
            </div>
          </div>
        </div>

      </aside>
    </>
  )
}

function Folder({
  title,
  icon: Icon,
  open,
  onClick,
  children,
}) {
  return (
    <div className="sidebar-folder">
      <button
        type="button"
        className="sidebar-folder-header"
        onClick={onClick}
      >
        <span className="sidebar-folder-left">
          <Icon size={17} />
          <span>{title}</span>
        </span>

        {open ? (
          <ChevronDown size={15} />
        ) : (
          <ChevronRight size={15} />
        )}
      </button>

      {open && (
        <div className="sidebar-folder-items">
          {children}
        </div>
      )}
    </div>
  )
}

function NavItem({
  icon: Icon,
  label,
  active = false,
  onClick,
  disabled = false,
}) {
  return (
    <button
      type="button"
      className={`sidebar-subitem ${
        active ? "active" : ""
      } ${disabled ? "disabled" : ""}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <span className="sidebar-subitem-icon">
        <Icon size={15} />
      </span>

      <span>{label}</span>

      {disabled && (
        <span className="coming-soon">
          Soon
        </span>
      )}
    </button>
  )
}

export default Sidebar

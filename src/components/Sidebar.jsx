import React, { useState } from "react"

import {
  LayoutDashboard,
  FileText,
  Calculator,
  ChevronDown,
  ChevronRight,
  Sun,
  Users,
  BarChart3,
  CalendarDays,
  Wrench,
  PoundSterling,
  CreditCard,
  Headphones,
  Settings,
  Target,
  ClipboardCheck,
} from "lucide-react"

function Sidebar({ page, setPage, mobile, setMobile }) {
  const [openFolders, setOpenFolders] = useState({
    sales: false,
    marketing:false,
    installation: false,
    finance: false,
    solar: false,
    customerService: false,
    documents: false,
    admin: false,
  })

  const toggleFolder = (folder) => {
    setOpenFolders((current) => ({
      ...current,
      [folder]: !current[folder],
    }))
  }

  const navigate = (pageName) => {
    setPage(pageName)
    setMobile(false)
  }

  const isActive = (pageName) => page === pageName

  return (
    <>
      {mobile && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobile(false)}
        />
      )}

      <aside
        className={`sidebar ${
          mobile ? "sidebar-open" : ""
        }`}
      >
        {/* BRAND */}

        <div className="sidebar-brand">
          <div className="brand-mark">C</div>

          <div>
            <strong>CRM</strong>
            <span>Home Improvements</span>
          </div>
        </div>

        <nav className="sidebar-nav">

          {/* DASHBOARD */}

          <button
            type="button"
            className={`sidebar-item ${
              isActive("dashboard") ? "active" : ""
            }`}
            onClick={() => navigate("dashboard")}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>

          <div className="sidebar-divider" />

          {/* MARKETING */}

          <Folder
            title="Marketing"
            icon={Target}
            open={openFolders.Marketing}
            onClick={() => toggleFolder("sales")}
          >
            <NavItem
              icon={FileText}
              label="Leads"
              active={isActive("contracts")}
              onClick={() => navigate("contracts")}
            />

            <NavItem
              icon={Users}
              label="Call Log"
              disabled
            />

            <NavItem
              icon={Users}
              label="Booked Leads"
              disabled
            />

            <NavItem
              icon={Users}
              label="Commissions"
              disabled
            />

            <NavItem
              icon={Users}
              label="Canvasser KPI"
              disabled
            />
          </Folder>

          {/* SALES */}

          <Folder
            title="Sales"
            icon={Target}
            open={openFolders.sales}
            onClick={() => toggleFolder("sales")}
          >
            <NavItem
              icon={FileText}
              label="Sold Contracts"
              active={isActive("contracts")}
              onClick={() => navigate("contracts")}
            />

            <NavItem
              icon={Users}
              label="Leads To Issue"
              disabled
            />

            <NavItem
              icon={Users}
              label="Booked Leads"
              disabled
            />

            <NavItem
              icon={Users}
              label="ECOF"
              disabled
            />

            <NavItem
              icon={Users}
              label="Commissions"
              disabled
            />

            <NavItem
              icon={Users}
              label="Sales KPI"
              disabled
            />

            <NavItem
              icon={BarChart3}
              label="Sales Performance"
              disabled
            />
          </Folder>

          

          {/* SURVEY & INSTALLATION */}

          <Folder
            title="Survey & Installation"
            icon={Wrench}
            open={openFolders.installation}
            onClick={() =>
              toggleFolder("installation")
            }
          >
            <NavItem
              icon={ClipboardCheck}
              label="Surveys"
              disabled
            />

            <NavItem
              icon={CalendarDays}
              label="Installations"
              disabled
            />

            <NavItem
              icon={Wrench}
              label="Installation Issues"
              disabled
            />
          </Folder>

          {/* FINANCE */}

          <Folder
            title="Finance"
            icon={PoundSterling}
            open={openFolders.finance}
            onClick={() =>
              toggleFolder("finance")
            }
          >
            <NavItem
              icon={PoundSterling}
              label="Revenue"
              disabled
            />

            <NavItem
              icon={CreditCard}
              label="Payments"
              disabled
            />

            <NavItem
              icon={FileText}
              label="Invoices"
              disabled
            />
          </Folder>

          {/* SOLAR / EPVS */}

          <Folder
            title="Solar / EPVS"
            icon={Sun}
            open={openFolders.solar}
            onClick={() =>
              toggleFolder("solar")
            }
          >
            <NavItem
              icon={Calculator}
              label="EPVS Calculator"
              active={isActive("epvs")}
              onClick={() => navigate("epvs")}
            />

            <NavItem
              icon={FileText}
              label="EPVS Calculations"
              disabled
            />

            <NavItem
              icon={Sun}
              label="Solar Systems"
              disabled
            />
          </Folder>

          {/* CUSTOMER SERVICE */}

          <Folder
            title="Customer Service"
            icon={Headphones}
            open={openFolders.customerService}
            onClick={() =>
              toggleFolder("customerService")
            }
          >
            <NavItem
              icon={Users}
              label="Customers"
              disabled
            />

            <NavItem
              icon={Headphones}
              label="Follow-ups"
              disabled
            />

            <NavItem
              icon={FileText}
              label="Complaints"
              disabled
            />
          </Folder>

          {/* DOCUMENTS */}

          <Folder
            title="Documents"
            icon={FileText}
            open={openFolders.documents}
            onClick={() =>
              toggleFolder("documents")
            }
          >
            <NavItem
              icon={FileText}
              label="Company Brochures"
              disabled
            />

            <NavItem
              icon={FileText}
              label="Customer Documents"
              disabled
            />

            <NavItem
              icon={FileText}
              label="Templates"
              disabled
            />
          </Folder>

          {/* ADMINISTRATION */}

          <Folder
            title="Administration"
            icon={Settings}
            open={openFolders.admin}
            onClick={() =>
              toggleFolder("admin")
            }
          >
            <NavItem
              icon={Users}
              label="Users"
              disabled
            />

            <NavItem
              icon={Settings}
              label="Settings"
              disabled
            />
          </Folder>

        </nav>

        {/* FOOTER */}

        <div className="sidebar-footer">
          <div className="sidebar-footer-icon">
            <Settings size={16} />
          </div>

          <div>
            <strong>CRM System</strong>
            <span>v1.0</span>
          </div>
        </div>
      </aside>
    </>
  )
}


/* ================================= */
/* FOLDER                            */
/* ================================= */

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


/* ================================= */
/* NAV ITEM                          */
/* ================================= */

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
      } ${
        disabled ? "disabled" : ""
      }`}
      onClick={
        disabled ? undefined : onClick
      }
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
import React from "react"

import {
  LayoutDashboard,
  FileText,
  Calculator,
  Menu,
} from "lucide-react"

function Sidebar({ page, setPage, mobile, setMobile }) {
  const navigate = (nextPage) => {
    setPage(nextPage)
    setMobile(false)
  }

  return (
    <aside className={mobile ? "sidebar open" : "sidebar"}>
      <div className="brand">
        <div className="logo">SC</div>
        <div>
          <b>Sold Contracts</b>
          <span>Customer CRM</span>
        </div>
      </div>

      <nav>
        <button
          className={page === "dashboard" ? "active" : ""}
          onClick={() => navigate("dashboard")}
        >
          <LayoutDashboard size={18} />
          Dashboard
        </button>

        <button
          className={page === "contracts" ? "active" : ""}
          onClick={() => navigate("contracts")}
        >
          <FileText size={18} />
          Contracts
        </button>

        <button
          className={page === "epvs" ? "active" : ""}
          onClick={() => navigate("epvs")}
        >
          <Calculator size={18} />
          EPVS Calculator
        </button>
      </nav>

      <div className="sidebar-bottom">
        <span>Supabase connected</span>
        <i />
      </div>
    </aside>
  )
}

export default Sidebar

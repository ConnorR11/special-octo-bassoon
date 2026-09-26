import React from "react"
import { Menu } from "lucide-react"

function Header({ page, setMobile }) {
  const pageTitle = {
    dashboard: "Home",
    "sales-performance": "Sales Performance",
    contracts: "Deals",
    "rts-list": "RTS List",
    epvs: "EPVS Calculator",
  }[page]

  const pageSubtitle = {
    dashboard: "Welcome to the Homeshield Scotland CRM",
    "sales-performance": "Overview of your sales performance and activity",
    contracts: "Search and manage deals",
    "rts-list": "Deals currently in the RTS sales stages",
    epvs: "Build and review an EPVS calculation",
  }[page]

  return (
    <header>
      <div className="header-left">
        <button
          className="mobile-menu"
          onClick={() => setMobile((current) => !current)}
        >
          <Menu size={20} />
        </button>

        <div>
          <h1>{pageTitle}</h1>
          <p>{pageSubtitle}</p>
        </div>
      </div>
    </header>
  )
}

export default Header

import React from "react"
import { Menu } from "lucide-react"

function Header({ page, setMobile }) {
  if (page === "dashboard") {
    return (
      <div className="home-mobile-menu">
        <button
          className="mobile-menu"
          onClick={() => setMobile((current) => !current)}
          aria-label="Open menu"
          type="button"
        >
          <Menu size={20} />
        </button>
      </div>
    )
  }

  const pageTitle = {
    "sales-performance": "Sales Performance",
    contracts: "Deals",
    "rts-list": "RTS List",
    epvs: "EPVS Calculator",
  }[page]

  const pageSubtitle = {
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
          aria-label="Open menu"
          type="button"
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

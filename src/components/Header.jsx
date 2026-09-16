import React from "react"
import { Menu } from "lucide-react"

function Header({ page, setMobile }) {
  const pageTitle = {
    dashboard: "Dashboard",
    contracts: "Deals",
  }[page]

  const pageSubtitle = {
    dashboard: "Overview of your deals",
    contracts: "Search and manage deals",
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

        {pageTitle && (
          <div>
            <h1>{pageTitle}</h1>
            <p>{pageSubtitle}</p>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header

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
    pronto: "Pronto",
    "sales-performance": "Sales Performance",
    "installations-performance": "Installations Performance",
    "outstanding-solar-surveys": "Outstanding Solar Surveys",
    contracts: "Deals",
    balances: "Balances",
    "rts-list": "RTS List",
    epvs: "EPVS Calculator",
  }[page]

  const pageSubtitle = {
    pronto: "Pronto lead and campaign performance",
    "sales-performance": "Overview of your sales performance and activity",
    "installations-performance": "Jobs grouped by installation start date",
    "outstanding-solar-surveys": "Solar deals with a digital contract but no generated survey",
    contracts: "Search and manage deals",
    balances: "Jobs with an outstanding balance",
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

import { Menu, RefreshCw } from "lucide-react"

function Header({ page, setMobile, onRefresh }) {
  const pageTitle = {
    dashboard: "Dashboard",
    contracts: "Sold contracts",
    epvs: "EPVS Calculator",
  }[page]

  const pageSubtitle = {
    dashboard: "Overview of your sold customer contracts",
    contracts: "Search and manage sold contracts",
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

      {page !== "epvs" && (
        <button className="refresh" onClick={onRefresh} title="Refresh">
          <RefreshCw size={17} />
        </button>
      )}
    </header>
  )
}

export default Header

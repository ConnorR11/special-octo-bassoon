import React from "react"

import {
  FileText,
  PoundSterling,
  CalendarDays,
  ChevronRight,
} from "lucide-react"

import Stat from "../components/Stat"
import SalesChart from "../components/SalesChart"
import YearOnYearSalesChart from "../components/YearOnYearSalesChart"
import SalesBreakdown from "../components/SalesBreakdown"
import { formatDate, getInitials, money } from "../utils/formatters"

function Dashboard({ contracts, total, avg, upcoming, loading, setPage, setSelected }) {
  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: "#222" }}>Dashboard</h1>
          <p style={{ margin: "5px 0 0", fontSize: 11, color: "#888" }}>Overview of sales performance and activity</p>
        </div>
      </div>

      <div className="stats">
        <Stat icon={<FileText size={20} />} label="Deals" value={contracts.length} />
        <Stat icon={<PoundSterling size={20} />} label="Net Value" value={money(total)} />
        <Stat icon={<PoundSterling size={20} />} label="Average contract" value={money(avg)} />
        <Stat icon={<CalendarDays size={20} />} label="Upcoming installations" value={upcoming} />
      </div>

      <SalesChart contracts={contracts} />
      <YearOnYearSalesChart contracts={contracts} />

      <div className="grid2">
        <div className="card">
          <div className="card-head">
            <div><h2>Recent contracts</h2><p>Latest sold deals</p></div>
            <button className="link" onClick={() => setPage("contracts")}>View all <ChevronRight size={16} /></button>
          </div>
          {loading ? <div className="empty">Loading…</div> : contracts.length === 0 ? <div className="empty">No contracts found.</div> : (
            <div className="rows">
              {contracts.slice(0, 6).map((contract) => (
                <button className="contract-row" key={contract.id} onClick={() => setSelected(contract)}>
                  <div className="avatar">{getInitials(contract.customer_name || "Customer")}</div>
                  <div className="row-main"><b>{contract.customer_name || "Unnamed customer"}</b><span>{contract.product || "—"}{" · "}{contract.postcode || "—"}</span></div>
                  <div className="row-value"><b>{money(contract.net_value)}</b><span>{contract.sale_date ? formatDate(contract.sale_date) : "—"}</span></div>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head"><div><h2>Sales</h2><p>Contract value by month</p></div></div>
          <SalesBreakdown contracts={contracts} />
        </div>
      </div>
    </section>
  )
}

export default Dashboard

import React from "react"

import {
  FileText,
  PoundSterling,
  CalendarDays,
  ChevronRight,
} from "lucide-react"

import Stat from "../components/Stat"
import SalesChart from "../components/SalesChart"
import ProductBreakdown from "../components/ProductBreakdown"

import {
  formatDate,
  getInitials,
  money,
} from "../utils/formatters"

function Dashboard({
  contracts,
  total,
  avg,
  upcoming,
  loading,
  setPage,
  setSelected,
}) {
  return (
    <section>
      <div className="stats">
        <Stat
          icon={<FileText size={20} />}
          label="Sold contracts"
          value={contracts.length}
        />
        <Stat
          icon={<PoundSterling size={20} />}
          label="Contract value"
          value={money(total)}
        />
        <Stat
          icon={<PoundSterling size={20} />}
          label="Average contract"
          value={money(avg)}
        />
        <Stat
          icon={<CalendarDays size={20} />}
          label="Upcoming installations"
          value={upcoming}
        />
      </div>

      <SalesChart contracts={contracts} />

      <div className="grid2">
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Recent contracts</h2>
              <p>Latest sold deals</p>
            </div>

            <button className="link" onClick={() => setPage("contracts")}>
              View all <ChevronRight size={16} />
            </button>
          </div>

          {loading ? (
            <div className="empty">Loading…</div>
          ) : contracts.length === 0 ? (
            <div className="empty">No contracts found.</div>
          ) : (
            <div className="rows">
              {contracts.slice(0, 6).map((contract) => (
                <button
                  className="contract-row"
                  key={contract.id}
                  onClick={() => setSelected(contract)}
                >
                  <div className="avatar">
                    {getInitials(contract.customer_name)}
                  </div>

                  <div className="row-main">
                    <b>
                      {contract.customer_name || "Unnamed customer"}
                    </b>
                    <span>
                      {contract.product || "—"} ·{" "}
                      {contract.postcode || "—"}
                    </span>
                  </div>

                  <div className="row-value">
                    <b>{money(contract.deal_value)}</b>
                    <span>{formatDate(contract.sale_date)}</span>
                  </div>

                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h2>By product</h2>
              <p>Contract value by product</p>
            </div>
          </div>

          <ProductBreakdown contracts={contracts} />
        </div>
      </div>
    </section>
  )
}

export default Dashboard

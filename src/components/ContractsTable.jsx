import { Search } from "lucide-react"
import { formatDate, getInitials, money, statusLabel } from "../utils/formatters"

function ContractsTable({
  filtered,
  loading,
  query,
  setQuery,
  status,
  setStatus,
  setSelected,
}) {
  const statuses = [
    ...new Set(
      filtered.map((contract) => contract.status).filter(Boolean)
    ),
  ]

  return (
    <section>
      <div className="toolbar">
        <div className="search">
          <Search size={18} />

          <input
            placeholder="Search customer, postcode, product…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">All statuses</option>

          {statuses.map((value) => (
            <option key={value} value={value}>
              {statusLabel(value)}
            </option>
          ))}
        </select>
      </div>

      <div className="table-card">
        <div className="table-head">
          <span>Customer</span>
          <span>Product</span>
          <span>Value</span>
          <span>Salesperson</span>
          <span>Sold</span>
          <span>Status</span>
        </div>

        {loading ? (
          <div className="empty">Loading contracts…</div>
        ) : filtered.length === 0 ? (
          <div className="empty">No contracts found.</div>
        ) : (
          filtered.map((contract) => (
            <button
              className="table-row"
              key={contract.id}
              onClick={() => setSelected(contract)}
            >
              <div className="customer">
                <div className="avatar">
                  {getInitials(contract.customer_name)}
                </div>

                <div>
                  <b>
                    {contract.customer_name || "Unnamed customer"}
                  </b>
                  <span>{contract.postcode || "—"}</span>
                </div>
              </div>

              <span>{contract.product || "—"}</span>
              <b>{money(contract.deal_value)}</b>
              <span>{contract.salesperson || "—"}</span>
              <span>{formatDate(contract.sale_date)}</span>

              <em
                className={`pill ${contract.status || "sold"}`}
              >
                {statusLabel(contract.status)}
              </em>
            </button>
          ))
        )}
      </div>
    </section>
  )
}

export default ContractsTable

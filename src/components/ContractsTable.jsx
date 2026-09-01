import React from "react"
import {
  FileText,
  CalendarDays,
  PoundSterling,
  ChevronRight,
} from "lucide-react"

import {
  formatDate,
  getInitials,
  money,
  statusLabel,
} from "../utils/formatters"

function ContractsTable({
  contracts,
  filtered,
  loading = false,
  setSelected,
}) {
  // Support either prop name
  const rows = contracts ?? filtered ?? []

  if (loading) {
    return (
      <div className="contracts-table">
        <div className="table-loading">
          Loading contracts...
        </div>
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="contracts-table">
        <div className="table-empty">
          <FileText size={32} />

          <strong>
            No contracts found
          </strong>

          <span>
            Try changing your search or filters.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="contracts-table">

      {/* TABLE HEADER */}

      <div className="contracts-table-header">
        <div>Customer</div>
        <div>Contract</div>
        <div>Product</div>
        <div>Sale Date</div>
        <div>Value</div>
        <div>Status</div>
        <div></div>
      </div>

      {/* TABLE ROWS */}

      <div className="contracts-table-body">

        {rows.map((contract) => (

          <button
            key={contract.id}
            type="button"
            className="contracts-table-row"
            onClick={() => setSelected?.(contract)}
          >

            {/* CUSTOMER */}

            <div className="contract-customer">

              <div className="customer-avatar">
                {getInitials(
                  contract.customer_name ||
                    "Customer"
                )}
              </div>

              <div className="customer-details">

                <strong>
                  {contract.customer_name ||
                    "Unnamed Customer"}
                </strong>

                <span>
                  {contract.postcode ||
                    "No postcode"}
                </span>

              </div>

            </div>

            {/* CONTRACT NUMBER */}

            <div className="contract-number">

              <FileText size={15} />

              <span>
                {contract.contract_number ||
                  "—"}
              </span>

            </div>

            {/* PRODUCT */}

            <div className="contract-product">
              {contract.product || "—"}
            </div>

            {/* SALE DATE */}

            <div className="contract-date">

              <CalendarDays size={15} />

              <span>
                {contract.sale_date
                  ? formatDate(
                      contract.sale_date
                    )
                  : "—"}
              </span>

            </div>

            {/* VALUE */}

            <div className="contract-value">

              <PoundSterling size={15} />

              <strong>
                {money(
                  Number(
                    contract.deal_value || 0
                  )
                )}
              </strong>

            </div>

            {/* STATUS */}

            <div>

              <span
                className={`status-badge status-${String(
                  contract.status ||
                    "unknown"
                )
                  .toLowerCase()
                  .replace(/\s+/g, "-")}`}
              >
                {statusLabel(
                  contract.status
                )}
              </span>

            </div>

            {/* ARROW */}

            <div className="contract-arrow">
              <ChevronRight size={18} />
            </div>

          </button>

        ))}

      </div>

    </div>
  )
}

export default ContractsTable
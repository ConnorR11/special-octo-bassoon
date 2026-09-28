import React from "react"
import { X, ExternalLink } from "lucide-react"

import { formatDate, money, statusLabel } from "../utils/formatters"

function ContractDrawer({ contract, close }) {
  const pipedriveDealId = contract?.pipedrive_deal_id
  const pipedriveUrl = pipedriveDealId
    ? `https://homeshield-scotland.pipedrive.com/deal/${pipedriveDealId}`
    : null

  return (
    <div className="overlay" onMouseDown={close}>
      <aside
        className="drawer"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-head">
          <div>
            <span className="eyebrow">Contract</span>
            <h2>{contract.contract_number || "Deals"}</h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {pipedriveUrl && (
              <a
                href={pipedriveUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open deal in Pipedrive"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "#f4f7fb",
                  color: "#163b65",
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  border: "1px solid #dbe4ef",
                }}
              >
                <ExternalLink size={15} />
                Pipedrive
              </a>
            )}

            <button onClick={close}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="drawer-value">
          <span>Contract value</span>
          <strong>{money(contract.deal_value)}</strong>

          <em className={`pill ${contract.status || "sold"}`}>
            {statusLabel(contract.status)}
          </em>
        </div>

        <div className="details">
          <Detail title="Customer" value={contract.customer_name} />
          <Detail title="Phone" value={contract.phone} />
          <Detail title="Email" value={contract.email} />
          <Detail title="Address" value={contract.address} />
          <Detail title="Postcode" value={contract.postcode} />
          <Detail title="Product" value={contract.product} />
          <Detail title="Salesperson" value={contract.salesperson} />
          <Detail title="Sale date" value={formatDate(contract.sale_date)} />
          <Detail
            title="Installation date"
            value={formatDate(contract.installation_date)}
          />
          <Detail title="Notes" value={contract.notes} />
          <Detail
            title="Pipedrive deal ID"
            value={contract.pipedrive_deal_id}
          />
        </div>
      </aside>
    </div>
  )
}

function Detail({ title, value }) {
  return (
    <div className="detail">
      <span>{title}</span>
      <b>{value || "—"}</b>
    </div>
  )
}

export default ContractDrawer

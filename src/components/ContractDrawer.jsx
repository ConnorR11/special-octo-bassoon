import React from "react"
import { X } from "lucide-react"

import { formatDate, money, statusLabel } from "../utils/formatters"

function ContractDrawer({ contract, close }) {
  return (
    <div className="overlay" onMouseDown={close}>
      <aside
        className="drawer"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-head">
          <div>
            <span className="eyebrow">Contract</span>
            <h2>{contract.contract_number || "Sold contract"}</h2>
          </div>

          <button onClick={close}>
            <X size={20} />
          </button>
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

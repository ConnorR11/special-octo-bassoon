import React, { useEffect, useState } from "react"
import { FileText, CalendarDays, PoundSterling, ChevronRight, ChevronLeft, Search, X } from "lucide-react"
import { formatDate, getInitials, money, statusLabel } from "../utils/formatters"

function ContractsTable({ contracts, filtered, loading = false, setSelected, query = "", setQuery, page = 0, pageSize = 50, hasMore = false, onPreviousPage, onNextPage }) {
  const rows = contracts ?? filtered ?? []
  const [searchInput, setSearchInput] = useState(query)

  useEffect(() => { setSearchInput(query) }, [query])

  function submitSearch(event) {
    event?.preventDefault()
    setQuery?.(searchInput.trim())
  }

  function clearSearch() {
    setSearchInput("")
    setQuery?.("")
  }

  const firstRow = rows.length ? page * pageSize + 1 : 0
  const lastRow = page * pageSize + rows.length

  return (
    <div className="contracts-table">
      <form onSubmit={submitSearch} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 620 }}>
          <Search size={18} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search by name, postcode, phone number or contract number..." aria-label="Search deals" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d7dee8", borderRadius: 9, padding: "11px 40px 11px 40px", fontSize: 14, outline: "none", background: "#fff" }} />
          {searchInput && <button type="button" onClick={clearSearch} aria-label="Clear search" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: 0, background: "transparent", padding: 4, cursor: "pointer", color: "#64748b", display: "flex" }}><X size={16} /></button>}
        </div>
        <button type="submit" style={{ border: "1px solid #d7dee8", background: "#002d49", color: "#fff", borderRadius: 9, padding: "11px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Search</button>
      </form>

      {loading ? <div className="table-loading">Loading contracts...</div> : !rows.length ? <div className="table-empty"><FileText size={32} /><strong>No contracts found</strong><span>{query ? `No deals found matching “${query}”.` : "Try changing your search or filters."}</span></div> : <>
        <div className="contracts-table-header"><div>Customer</div><div>Contract</div><div>Product</div><div>Sale Date</div><div>Value</div><div>Status</div><div></div></div>
        <div className="contracts-table-body">
          {rows.map((contract) => (
            <button key={contract.id} type="button" className="contracts-table-row" onClick={() => setSelected?.(contract)}>
              <div className="contract-customer"><div className="customer-avatar">{getInitials(contract.customer_name || "Customer")}</div><div className="customer-details"><strong>{contract.customer_name || "Unnamed Customer"}</strong><span>{contract.postcode || "No postcode"}</span></div></div>
              <div className="contract-number"><FileText size={15} /><span>{contract.contract_number || "—"}</span></div>
              <div className="contract-product">{contract.product || "—"}</div>
              <div className="contract-date"><CalendarDays size={15} /><span>{contract.sale_date ? formatDate(contract.sale_date) : "—"}</span></div>
              <div className="contract-value"><PoundSterling size={15} /><strong>{money(Number(contract.deal_value || 0))}</strong></div>
              <div><span className={`status-badge status-${String(contract.status || "unknown").toLowerCase().replace(/\s+/g, "-")}`}>{statusLabel(contract.status)}</span></div>
              <div className="contract-arrow"><ChevronRight size={18} /></div>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 4px 4px", marginTop: 4, borderTop: "1px solid #e2e8f0" }}>
          <span style={{ fontSize: 13, color: "#64748b" }}>Showing {firstRow}–{lastRow}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#64748b", marginRight: 4 }}>Page {page + 1}</span>
            <button type="button" onClick={onPreviousPage} disabled={page === 0 || loading} style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid #d7dee8", background: "#fff", color: "#334155", borderRadius: 7, padding: "7px 10px", cursor: page === 0 || loading ? "default" : "pointer", opacity: page === 0 || loading ? 0.45 : 1 }}><ChevronLeft size={15} />Previous</button>
            <button type="button" onClick={onNextPage} disabled={!hasMore || loading} style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid #d7dee8", background: "#fff", color: "#334155", borderRadius: 7, padding: "7px 10px", cursor: !hasMore || loading ? "default" : "pointer", opacity: !hasMore || loading ? 0.45 : 1 }}>Next<ChevronRight size={15} /></button>
          </div>
        </div>
      </>}
    </div>
  )
}

export default ContractsTable

import React, { useMemo, useState } from "react"
import { CalendarDays, ChevronRight, FileCheck, MapPin, PoundSterling, Search, UserRound, X } from "lucide-react"
import { formatDate, getInitials, money } from "../utils/formatters"

const RTS_STAGES = ["Awaiting Funds", "Returned To Sales", "Pending Cancellation", "Long Term"]

function normalise(value) {
  return String(value || "").trim().toLowerCase()
}

function getRepName(deal) {
  return deal?.salesperson || deal?.sales_rep || deal?.rep_name || deal?.rep_allocated || "Unallocated"
}

function getNetValue(deal) {
  const value = deal?.net_value ?? deal?.netValue ?? deal?.net_amount ?? deal?.deal_value
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function getDealDate(deal) {
  return deal?.sale_date || deal?.appointment_date || deal?.created_at
}

export default function RTSList({ deals = [], loading = false, setSelected }) {
  const [query, setQuery] = useState("")
  const [stage, setStage] = useState("all")

  const rtsDeals = useMemo(() => {
    const allowed = new Set(RTS_STAGES.map(normalise))
    return (deals || []).filter((deal) => allowed.has(normalise(deal?.pipedrive_stage)))
  }, [deals])

  const filteredDeals = useMemo(() => {
    const search = query.trim().toLowerCase()
    return rtsDeals.filter((deal) => {
      const matchesStage = stage === "all" || normalise(deal?.pipedrive_stage) === normalise(stage)
      if (!matchesStage) return false
      if (!search) return true
      return [
        deal?.customer_name,
        deal?.name,
        deal?.postcode,
        deal?.contract_number,
        deal?.product,
        deal?.salesperson,
        deal?.sales_rep,
        deal?.rep_name,
        deal?.rep_allocated,
        deal?.branch,
        deal?.pipedrive_stage,
      ].filter(Boolean).join(" ").toLowerCase().includes(search)
    })
  }, [rtsDeals, query, stage])

  const totalValue = filteredDeals.reduce((total, deal) => total + getNetValue(deal), 0)

  return (
    <section>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FileCheck size={24} color="#2499ed" />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, color: "#222" }}>RTS List</h1>
            <p style={{ margin: "5px 0 0", fontSize: 11, color: "#888" }}>Deals currently sitting in the RTS stages of the installation Kanban.</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ padding: "8px 11px", border: "1px solid #dfe5e9", borderRadius: 8, background: "#fff", fontSize: 11, color: "#66737d" }}>
            <strong style={{ color: "#263645" }}>{filteredDeals.length}</strong> deals
          </div>
          <div style={{ padding: "8px 11px", border: "1px solid #dfe5e9", borderRadius: 8, background: "#fff", fontSize: 11, color: "#66737d" }}>
            <strong style={{ color: "#263645" }}>{money(totalValue)}</strong>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 620 }}>
          <Search size={17} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, postcode, contract, rep or stage..." aria-label="Search RTS deals" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d7dee8", borderRadius: 8, padding: "10px 38px 10px 38px", fontSize: 12, outline: "none", background: "#fff" }} />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search" style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", border: 0, background: "transparent", padding: 4, cursor: "pointer", color: "#64748b", display: "flex" }}><X size={15} /></button>}
        </div>
        <select value={stage} onChange={(event) => setStage(event.target.value)} style={{ height: 37, minWidth: 190, border: "1px solid #d7dee8", borderRadius: 8, background: "#fff", color: "#334155", padding: "0 10px", fontSize: 11 }}>
          <option value="all">All RTS stages</option>
          {RTS_STAGES.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>

      <div style={{ border: "1px solid #e0e5e9", borderRadius: 10, background: "#fff", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1.25fr 1.1fr 1fr .9fr .95fr 30px", gap: 12, alignItems: "center", padding: "11px 14px", background: "#f8fafc", borderBottom: "1px solid #e4e8eb", color: "#687782", fontSize: 9, fontWeight: 800, textTransform: "uppercase" }}>
          <div>Customer</div><div>RTS Stage</div><div>Sales Rep</div><div>Sale Date</div><div>Value</div><div>Postcode</div><div />
        </div>

        {loading ? <div style={{ padding: 35, textAlign: "center", color: "#89939c", fontSize: 11 }}>Loading RTS deals...</div> : !filteredDeals.length ? <div style={{ padding: 40, textAlign: "center" }}><FileCheck size={30} color="#b3bdc5" /><div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: "#56636d" }}>No RTS deals found</div><div style={{ marginTop: 4, fontSize: 10, color: "#9aa5ad" }}>{query || stage !== "all" ? "Try changing your search or stage filter." : "There are currently no deals in the RTS stages."}</div></div> : <div>
          {filteredDeals.map((deal) => {
            const customer = deal?.customer_name || deal?.name || "Unnamed customer"
            const currentStage = RTS_STAGES.find((item) => normalise(item) === normalise(deal?.pipedrive_stage)) || deal?.pipedrive_stage || "—"
            return <button key={deal?.id || deal?.deal_id} type="button" onClick={() => setSelected?.(deal)} style={{ width: "100%", display: "grid", gridTemplateColumns: "1.7fr 1.25fr 1.1fr 1fr .9fr .95fr 30px", gap: 12, alignItems: "center", padding: "13px 14px", border: 0, borderBottom: "1px solid #eef1f3", background: "#fff", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}><div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", background: "#e8f4fd", color: "#1676b8", fontSize: 9, fontWeight: 800 }}>{getInitials(customer)}</div><div style={{ minWidth: 0 }}><div style={{ fontSize: 11, fontWeight: 700, color: "#263645", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customer}</div><div style={{ marginTop: 3, fontSize: 9, color: "#8a959d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{deal?.contract_number || deal?.product || "No contract number"}</div></div></div>
              <div><span style={{ display: "inline-flex", alignItems: "center", maxWidth: "100%", padding: "5px 8px", borderRadius: 12, background: "#e0f2fe", color: "#075985", fontSize: 9, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentStage}</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#53616b", fontSize: 10, minWidth: 0 }}><UserRound size={13} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getRepName(deal)}</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#53616b", fontSize: 10 }}><CalendarDays size={13} /><span>{getDealDate(deal) ? formatDate(getDealDate(deal)) : "—"}</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#263645", fontSize: 10 }}><PoundSterling size={13} /><strong>{money(getNetValue(deal))}</strong></div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#66737d", fontSize: 10 }}><MapPin size={13} /><span>{deal?.postcode || "—"}</span></div>
              <div style={{ display: "flex", justifyContent: "flex-end", color: "#9aa5ad" }}><ChevronRight size={17} /></div>
            </button>
          })}
        </div>}
      </div>
    </section>
  )
}

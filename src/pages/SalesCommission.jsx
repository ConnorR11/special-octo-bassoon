import React, { useEffect, useMemo, useState } from "react"
import {
  ChevronRight,
  Download,
  Filter,
  MapPin,
  PoundSterling,
  Search,
  UserRound,
  X,
} from "lucide-react"
import * as XLSX from "xlsx"
import { supabase } from "../lib/supabase"
import { useVisibility } from "../context/VisibilityContext"
import { formatDate, getInitials, money } from "../utils/formatters"

function getRepName(deal) {
  return deal?.salesperson || deal?.sales_rep || deal?.rep_name || deal?.rep_allocated || "Unallocated"
}

function getBranchName(deal) {
  return deal?.branch || deal?.branch_name || "Unallocated"
}

function getNetSalesValue(deal) {
  const parsed = Number(String(deal?.net_value ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function getSurveyCosting(deal) {
  const value = deal?.survey_costing
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

function getCommission(deal) {
  const value = deal?.estimated_commission_due
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

function getAdminFee(deal) {
  const value = Number(deal?.admin_fee_amount)
  if (value === 299 || value === 399) return 199
  return "query"
}

const EXCLUDED_COMMISSION_STAGES = new Set([
  "decline",
  "customer cancelled",
  "returned to sales",
  "awaiting funds",
  "on hold",
])

function isExcludedCommissionStage(deal) {
  const stage = String(deal?.pipedrive_stage ?? "").trim().replace(/\s+/g, " ").toLowerCase()
  return EXCLUDED_COMMISSION_STAGES.has(stage)
}

function getCommissionDate(deal, source = "commission") {
  const sourceDate = source === "admin" ? deal?.admin_fee_received_date : deal?.installation_start_date
  if (!sourceDate) return null

  const value = String(sourceDate).slice(0, 10)
  const parts = value.split("-").map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null

  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
  if (Number.isNaN(date.getTime())) return null

  const day = date.getUTCDay()
  const daysBackToMonday = day === 0 ? 6 : day - 1
  date.setUTCDate(date.getUTCDate() - daysBackToMonday)
  date.setUTCDate(date.getUTCDate() + 21)

  return date.toISOString().slice(0, 10)
}

const columns = ".65fr .95fr 1.55fr 1.25fr 1fr .9fr 1fr 1.1fr .95fr 30px"

function DealRow({ deal, setSelected, type, repName }) {
  const isAdmin = type === "ADMIN"
  const customer = deal?.customer_name || deal?.name || "Unnamed customer"
  const paymentDate = getCommissionDate(deal, isAdmin ? "admin" : "commission")
  const surveyCosting = getSurveyCosting(deal)
  const commission = getCommission(deal)
  const adminFee = getAdminFee(deal)
  const paymentDateLabel = isAdmin && !deal?.admin_fee_received_date
    ? "Outstanding"
    : paymentDate
      ? formatDate(paymentDate)
      : "Not Booked"

  return (
    <button
      type="button"
      onClick={() => setSelected?.(deal)}
      style={{ width: "100%", display: "grid", gridTemplateColumns: columns, gap: 12, alignItems: "center", padding: "13px 14px", border: 0, borderBottom: "1px solid #eef1f3", background: "#fff", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}
    >
      <div>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "4px 7px", borderRadius: 5, background: isAdmin ? "#fff1e8" : "#e8f4fd", color: isAdmin ? "#c45b18" : "#1676b8", fontSize: 9, fontWeight: 800 }}>
          {type}
        </span>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: paymentDate ? "#263645" : "#a0a8ae", whiteSpace: "nowrap" }}>
        {paymentDateLabel}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "#e8f4fd", color: "#1676b8", fontSize: 9, fontWeight: 800 }}>
          {getInitials(customer)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#263645", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customer}</div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: "#53616b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {deal?.contract_number || deal?.product || "—"}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, color: isAdmin ? "#a0a8ae" : "#263645", fontSize: 10 }}>
        {!isAdmin && <PoundSterling size={13} />}
        <strong>{isAdmin ? "—" : money(getNetSalesValue(deal))}</strong>
      </div>
      <div style={{ fontSize: 10, color: isAdmin ? "#a0a8ae" : surveyCosting === null ? "#a0a8ae" : "#263645", fontWeight: !isAdmin && surveyCosting !== null ? 700 : 400 }}>
        {isAdmin ? "—" : surveyCosting === null ? "—" : surveyCosting.toLocaleString("en-GB")}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#66737d", fontSize: 10 }}>
        <MapPin size={13} />
        <span>{getBranchName(deal)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#53616b", fontSize: 10, minWidth: 0 }}>
        <UserRound size={13} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{repName}</span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, color: isAdmin ? adminFee === "query" ? "#c45b18" : "#1676b8" : commission === null ? "#a0a8ae" : "#1676b8" }}>
        {isAdmin ? adminFee === "query" ? "query" : money(adminFee) : commission === null ? "—" : money(commission)}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", color: "#9aa5ad" }}><ChevronRight size={17} /></div>
    </button>
  )
}

export default function SalesCommission({ deals = [], loading = false, setSelected }) {
  const { canSeeAll, visibleSalespersonIds, loading: visibilityLoading, canSeeDeal } = useVisibility()

  const [adminDeals, setAdminDeals] = useState([])
  const [adminLoading, setAdminLoading] = useState(false)
  const [query, setQuery] = useState("")
  const [rep, setRep] = useState("all")
  const [branch, setBranch] = useState("all")
  const [commissionDate, setCommissionDate] = useState("all")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [salespersonNames, setSalespersonNames] = useState({})

  const displayRepName = deal => {
    const salespersonId = String(deal?.salesperson || "").trim()
    return salespersonNames[salespersonId] || getRepName(deal)
  }

  useEffect(() => {
    let cancelled = false

    async function loadAdmin() {
      if (!supabase || visibilityLoading) return

      setAdminLoading(true)

      let request = supabase
        .from("deals")
        .select("*")
        .is("admin_fee_paid_out_date", null)
        .not("pipedrive_stage", "in", "(Decline,Customer Cancelled,Returned To Sales,Awaiting Funds,On Hold)")
        .gte("sale_date", "2026-01-01")
        .order("admin_fee_received_date", { ascending: true })

      // Visibility is now controlled centrally by VisibilityContext.
      // Level 3+ loads everything; restricted users only load the salesperson IDs
      // that the central context has determined they may see.
      if (!canSeeAll) {
        if (!visibleSalespersonIds?.length) {
          setAdminDeals([])
          setAdminLoading(false)
          return
        }
        request = request.in("salesperson", visibleSalespersonIds)
      }

      const { data, error } = await request
      if (cancelled) return

      if (error) {
        console.error("Error loading admin fee deals:", error)
        setAdminDeals([])
      } else {
        setAdminDeals((data || []).filter(deal => {
          if (!canSeeDeal(deal)) return false
          if (isExcludedCommissionStage(deal)) return false

          const raw = deal?.admin_fee_amount
          if (raw === null || raw === undefined || String(raw).trim() === "") return false

          const value = Number(String(raw).replace(/[^0-9.-]/g, ""))
          return Number.isFinite(value) && value !== 0
        }))
      }

      setAdminLoading(false)
    }

    loadAdmin()
    return () => { cancelled = true }
  }, [canSeeAll, visibleSalespersonIds, visibilityLoading, canSeeDeal])

  useEffect(() => {
    let cancelled = false

    async function loadSalespersonNames() {
      if (!supabase) return

      const ids = Array.from(new Set(
        [...deals, ...adminDeals]
          .map(deal => String(deal?.salesperson || "").trim())
          .filter(Boolean)
      ))

      if (!ids.length) {
        setSalespersonNames({})
        return
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("pipedrive_person_id, full_name, display_name")
        .in("pipedrive_person_id", ids)

      if (cancelled) return
      if (error) {
        console.error("Error loading salesperson names:", error)
        return
      }

      const names = {}
      ;(data || []).forEach(profile => {
        const id = String(profile?.pipedrive_person_id || "").trim()
        const name = profile?.full_name || profile?.display_name
        if (id && name) names[id] = name
      })
      setSalespersonNames(names)
    }

    loadSalespersonNames()
    return () => { cancelled = true }
  }, [deals, adminDeals])

  const visibleDeals = useMemo(
    () => deals.filter(deal => canSeeDeal(deal)),
    [deals, canSeeDeal]
  )

  const reps = useMemo(
    () => Array.from(new Set([...visibleDeals, ...adminDeals].map(displayRepName))).sort((a, b) => a.localeCompare(b)),
    [visibleDeals, adminDeals, salespersonNames]
  )

  const branches = useMemo(
    () => Array.from(new Set([...visibleDeals, ...adminDeals].map(getBranchName))).sort((a, b) => a.localeCompare(b)),
    [visibleDeals, adminDeals]
  )

  const combined = useMemo(() => [
    ...visibleDeals
      .filter(deal => getNetSalesValue(deal) !== 0 && !isExcludedCommissionStage(deal) && String(deal?.sale_date || "").slice(0, 10) >= "2026-01-01")
      .map(deal => ({ deal, type: "COMMS" })),
    ...adminDeals
      .filter(deal => canSeeDeal(deal) && !isExcludedCommissionStage(deal))
      .map(deal => ({ deal, type: "ADMIN" })),
  ], [visibleDeals, adminDeals, canSeeDeal])

  const commissionDates = useMemo(
    () => Array.from(new Set(
      combined
        .map(({ deal, type }) => getCommissionDate(deal, type === "ADMIN" ? "admin" : "commission"))
        .filter(Boolean)
    )).sort((a, b) => new Date(a) - new Date(b)),
    [combined]
  )

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()

    return combined
      .filter(({ deal, type }) => {
        const date = getCommissionDate(deal, type === "ADMIN" ? "admin" : "commission")
        if (rep !== "all" && displayRepName(deal) !== rep) return false
        if (branch !== "all" && getBranchName(deal) !== branch) return false
        if (commissionDate !== "all" && date !== commissionDate) return false
        if (!search) return true

        return [
          deal?.customer_name,
          deal?.name,
          deal?.contract_number,
          deal?.postcode,
          displayRepName(deal),
          getBranchName(deal),
          type,
        ].filter(Boolean).join(" ").toLowerCase().includes(search)
      })
      .sort((a, b) => {
        const ad = getCommissionDate(a.deal, a.type === "ADMIN" ? "admin" : "commission")
        const bd = getCommissionDate(b.deal, b.type === "ADMIN" ? "admin" : "commission")

        if (!ad && !bd) {
          const branchCompare = getBranchName(a.deal).localeCompare(getBranchName(b.deal))
          if (branchCompare) return branchCompare
          const repCompare = displayRepName(a.deal).localeCompare(displayRepName(b.deal))
          if (repCompare) return repCompare
          return a.type.localeCompare(b.type)
        }
        if (!ad) return 1
        if (!bd) return -1

        const dateCompare = ad.localeCompare(bd)
        if (dateCompare) return dateCompare

        const branchCompare = getBranchName(a.deal).localeCompare(getBranchName(b.deal))
        if (branchCompare) return branchCompare
        const repCompare = displayRepName(a.deal).localeCompare(displayRepName(b.deal))
        if (repCompare) return repCompare
        return a.type.localeCompare(b.type)
      })
  }, [combined, query, rep, branch, commissionDate, salespersonNames])

  const commsDeals = filtered.filter(({ type }) => type === "COMMS")
  const adminRows = filtered.filter(({ type }) => type === "ADMIN")
  const commsBooked = commsDeals.filter(({ deal }) => !!deal?.installation_start_date).length
  const commsNotBooked = commsDeals.length - commsBooked
  const adminPaidIn = adminRows.filter(({ deal }) => !!deal?.admin_fee_received_date).length
  const adminOutstanding = adminRows.length - adminPaidIn
  const totalCommission = filtered.reduce((total, { deal, type }) => total + (type === "COMMS" ? getCommission(deal) ?? 0 : 0), 0)
  const totalAdmin = filtered.reduce((total, { deal, type }) => total + (type === "ADMIN" ? (getAdminFee(deal) === "query" ? 0 : getAdminFee(deal)) : 0), 0)

  function exportRows() {
    const rows = filtered.map(({ deal, type }) => ({
      Type: type,
      "Payment Date": getCommissionDate(deal, type === "ADMIN" ? "admin" : "commission") || "",
      Customer: deal?.customer_name || deal?.name || "",
      Contract: deal?.contract_number || "",
      "Net Sales Value": type === "COMMS" ? getNetSalesValue(deal) : "",
      "Survey Costing": type === "COMMS" ? getSurveyCosting(deal) ?? "" : "",
      Branch: getBranchName(deal),
      Salesperson: displayRepName(deal),
      Commission: type === "COMMS" ? getCommission(deal) ?? "" : "",
      "Admin Fee": type === "ADMIN" ? (getAdminFee(deal) === "query" ? "query" : getAdminFee(deal)) : "",
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Commissions")
    XLSX.writeFile(workbook, "sales-commission.xlsx")
  }

  const isLoading = loading || adminLoading || visibilityLoading

  return (
    <section style={{ padding: "18px 24px 28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: "#263645" }}>Sales Commission</h1>
          <p style={{ margin: "5px 0 0", fontSize: 11, color: "#8b969e" }}>Commission and administration fee tracking</p>
        </div>
        <button type="button" onClick={exportRows} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid #d7dee8", background: "#fff", color: "#334155", borderRadius: 8, padding: "9px 12px", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
          <Download size={15} />Export
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 14 }}>
        <div style={{ background: "#e8f4fd", border: "1px solid #c9e4f5", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, color: "#1676b8", marginBottom: 5, fontWeight: 800 }}>COMMS</div>
          <strong style={{ fontSize: 19, color: "#263645" }}>{commsDeals.length}</strong>
          <div style={{ fontSize: 10, color: "#66737d", marginTop: 2 }}>{commsBooked} booked · {commsNotBooked} not booked</div>
        </div>
        <div style={{ background: "#f0f8fd", border: "1px solid #d5ebf8", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, color: "#1676b8", marginBottom: 5, fontWeight: 800 }}>COMMISSION</div>
          <strong style={{ fontSize: 19, color: "#1676b8" }}>{money(totalCommission)}</strong>
        </div>
        <div style={{ background: "#fff1e8", border: "1px solid #f6d7c2", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, color: "#c45b18", marginBottom: 5, fontWeight: 800 }}>ADMIN FEES</div>
          <strong style={{ fontSize: 19, color: "#263645" }}>{adminRows.length}</strong>
          <div style={{ fontSize: 10, color: "#66737d", marginTop: 2 }}>{adminPaidIn} received · {adminOutstanding} outstanding</div>
        </div>
        <div style={{ background: "#fff7f1", border: "1px solid #f6dfce", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, color: "#c45b18", marginBottom: 5, fontWeight: 800 }}>ADMIN VALUE</div>
          <strong style={{ fontSize: 19, color: "#c45b18" }}>{money(totalAdmin)}</strong>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e4e9ee", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", borderBottom: "1px solid #eef1f3", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 260px", minWidth: 220 }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9aa5ad" }} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search customer, contract, salesperson..." style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d7dee8", borderRadius: 7, padding: "8px 34px 8px 31px", fontSize: 11, outline: "none" }} />
            {query && <button type="button" onClick={() => setQuery("")} style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", border: 0, background: "transparent", padding: 2, cursor: "pointer", color: "#64748b" }}><X size={14} /></button>}
          </div>
          <button type="button" onClick={() => setFiltersOpen(value => !value)} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #d7dee8", background: filtersOpen ? "#f4f8fb" : "#fff", color: "#334155", borderRadius: 7, padding: "8px 10px", cursor: "pointer", fontSize: 11 }}><Filter size={14} />Filters</button>
        </div>

        {filtersOpen && <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(160px, 1fr))", gap: 10, padding: "12px 14px", background: "#f8fafc", borderBottom: "1px solid #eef1f3" }}>
          <label style={{ fontSize: 10, color: "#64748b" }}>Salesperson
            <select value={rep} onChange={e => setRep(e.target.value)} style={{ display: "block", width: "100%", marginTop: 4, border: "1px solid #d7dee8", borderRadius: 6, padding: "7px 8px", background: "#fff", fontSize: 11 }}>
              <option value="all">All salespeople</option>
              {reps.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 10, color: "#64748b" }}>Branch
            <select value={branch} onChange={e => setBranch(e.target.value)} style={{ display: "block", width: "100%", marginTop: 4, border: "1px solid #d7dee8", borderRadius: 6, padding: "7px 8px", background: "#fff", fontSize: 11 }}>
              <option value="all">All branches</option>
              {branches.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 10, color: "#64748b" }}>Payment date
            <select value={commissionDate} onChange={e => setCommissionDate(e.target.value)} style={{ display: "block", width: "100%", marginTop: 4, border: "1px solid #d7dee8", borderRadius: 6, padding: "7px 8px", background: "#fff", fontSize: 11 }}>
              <option value="all">All payment dates</option>
              {commissionDates.map(value => <option key={value} value={value}>{formatDate(value)}</option>)}
            </select>
          </label>
        </div>}

        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 1180 }}>
            <div style={{ display: "grid", gridTemplateColumns: columns, gap: 12, alignItems: "center", padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #e4e9ee", color: "#7b8790", fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".04em" }}>
              <div>Type</div><div>Payment Date</div><div>Customer</div><div>Contract</div><div>Net Value</div><div>Survey Cost</div><div>Branch</div><div>Salesperson</div><div>Amount</div><div></div>
            </div>
            {isLoading ? (
              <div style={{ padding: 36, textAlign: "center", color: "#8b969e", fontSize: 12 }}>Loading commission data...</div>
            ) : !filtered.length ? (
              <div style={{ padding: 36, textAlign: "center", color: "#8b969e", fontSize: 12 }}>No commission records found.</div>
            ) : filtered.map(({ deal, type }) => (
              <DealRow key={`${type}-${deal.id}`} deal={deal} type={type} repName={displayRepName(deal)} setSelected={setSelected} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

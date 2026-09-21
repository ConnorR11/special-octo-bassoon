import React, { useEffect, useMemo, useState } from "react"
import { Search, CalendarDays, MapPin, UserRound, RefreshCw, KanbanSquare, ChevronDown } from "lucide-react"
import { supabase } from "../lib/supabase"

function isCentralConfirmationManager(role) {
  const normalized = String(role || "").trim().toLowerCase()
  return normalized === "central confirmation manager" || normalized === "central confirmer manager"
}

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function getStageLabel(value) { return String(value || "").trim() }
function getCustomerName(deal) { return deal?.customer_name || deal?.name || "Unnamed customer" }
function getRepName(deal) { return deal?.salesperson || deal?.sales_rep || deal?.rep_name || deal?.rep_allocated || "Unallocated" }
function getDealDate(deal) { return deal?.installation_date || deal?.appointment_date || deal?.sale_date || deal?.created_at }
function getDealId(deal) { return deal?.id || deal?.deal_id }

const GROUPS = [
  { key: "rts", label: "RTS", stages: ["Awaiting Funds", "Returned To Sales"], background: "#e0f2fe", border: "#bae6fd", text: "#075985", badge: "#bae6fd" },
]
const UNGROUPED = { key: "ungrouped", label: "Ungrouped", background: "#f1f5f9", border: "#e2e8f0", text: "#334155", badge: "#e2e8f0" }

export default function Installations({ setSelected }) {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [profile, setProfile] = useState(null)
  const [collapsedGroups, setCollapsedGroups] = useState({})

  async function loadInstallations(showRefresh = false) {
    if (!supabase) {
      setError("Supabase is not configured.")
      setLoading(false)
      return
    }
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setError("")

    try {
      let viewerProfile = profile
      if (!viewerProfile) {
        let previewId = null
        const { data: previewData, error: previewError } = await supabase.rpc("current_preview_profile_id")
        if (!previewError) previewId = previewData || null

        if (previewId) {
          const { data, error: previewProfileError } = await supabase.from("profiles").select("id, auth_user_id, email, full_name, role, permission_level, branch").eq("id", previewId).maybeSingle()
          if (previewProfileError) throw previewProfileError
          viewerProfile = data || null
        }

        if (!viewerProfile) {
          const { data: authData, error: authError } = await supabase.auth.getUser()
          if (authError) throw authError
          const authUserId = authData?.user?.id
          if (authUserId) {
            const { data, error: profileError } = await supabase.from("profiles").select("id, auth_user_id, email, full_name, role, permission_level, branch").eq("auth_user_id", authUserId).maybeSingle()
            if (profileError) throw profileError
            viewerProfile = data || null
          }
        }
        setProfile(viewerProfile)
      }

      const permissionLevel = Number(viewerProfile?.permission_level) || 0
      const role = viewerProfile?.role || ""
      const canViewAll = permissionLevel >= 3 || isCentralConfirmationManager(role)
      const canViewBranch = permissionLevel >= 2

      let request = supabase.from("deals").select("*").not("pipedrive_stage", "is", null).neq("pipedrive_stage", "").order("sale_date", { ascending: false, nullsFirst: false })

      if (!canViewAll) {
        const branch = String(viewerProfile?.branch || "").trim()
        if (canViewBranch && branch) request = request.eq("branch", branch)
        else {
          const email = String(viewerProfile?.email || "").trim().toLowerCase()
          if (email) request = request.ilike("salesperson", email)
        }
      }

      const { data, error: dealsError } = await request
      if (dealsError) throw dealsError
      setDeals(data || [])
    } catch (err) {
      console.error("Error loading installations:", err)
      setError(err?.message || "Unable to load installations.")
      setDeals([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { loadInstallations() }, [])

  const filteredDeals = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return deals
    return deals.filter((deal) => [deal?.customer_name, deal?.name, deal?.postcode, deal?.product, deal?.salesperson, deal?.sales_rep, deal?.rep_name, deal?.rep_allocated, deal?.branch, deal?.pipedrive_stage].filter(Boolean).join(" ").toLowerCase().includes(search))
  }, [deals, query])

  const groups = useMemo(() => {
    const rtsStages = new Set(GROUPS[0].stages)
    const rtsDeals = filteredDeals.filter((deal) => rtsStages.has(getStageLabel(deal?.pipedrive_stage)))
    const ungroupedDeals = filteredDeals.filter((deal) => !rtsStages.has(getStageLabel(deal?.pipedrive_stage)))
    return [
      { ...GROUPS[0], items: rtsDeals },
      { ...UNGROUPED, items: ungroupedDeals },
    ]
  }, [filteredDeals])

  function toggleGroup(key) {
    setCollapsedGroups((current) => ({ ...current, [key]: !current[key] }))
  }

  function openDeal(deal) {
    if (!deal || !setSelected) return
    setSelected(deal)
  }

  function DealCard({ deal }) {
    return (
      <button
        type="button"
        onClick={() => openDeal(deal)}
        style={{ width: "100%", padding: 12, border: "1px solid #e0e5e9", borderRadius: 8, background: "#fff", textAlign: "left", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}
        onMouseEnter={(event) => { event.currentTarget.style.borderColor = "#b9c8d3"; event.currentTarget.style.boxShadow = "0 3px 10px rgba(0,0,0,.07)" }}
        onMouseLeave={(event) => { event.currentTarget.style.borderColor = "#e0e5e9"; event.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,.04)" }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2933", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getCustomerName(deal)}</div>
        <div style={{ marginTop: 9, display: "grid", gap: 6 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", color: "#687782", fontSize: 9.5 }}><CalendarDays size={13} /><span>{formatDate(getDealDate(deal))}</span></div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", color: "#687782", fontSize: 9.5 }}><MapPin size={13} /><span>{deal?.postcode || "No postcode"}</span></div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", color: "#687782", fontSize: 9.5 }}><UserRound size={13} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getRepName(deal)}</span></div>
        </div>
        <div style={{ marginTop: 10, paddingTop: 9, borderTop: "1px solid #eef1f3", display: "flex", justifyContent: "space-between", gap: 8, fontSize: 9, color: "#7b8790" }}>
          <span>{deal?.product || deal?.job_type || "—"}</span><span>{deal?.branch || ""}</span>
        </div>
      </button>
    )
  }

  return (
    <section>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <KanbanSquare size={24} color="#2499ed" />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, color: "#222" }}>Kanban</h1>
            <p style={{ margin: "5px 0 0", fontSize: 11, color: "#888" }}>Read-only installation board grouped by Pipedrive stage</p>
          </div>
        </div>
        <button type="button" onClick={() => loadInstallations(true)} disabled={loading || refreshing} style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 12px", border: "1px solid #dfe4e8", borderRadius: 7, background: "#fff", color: "#344454", cursor: loading || refreshing ? "default" : "pointer", opacity: loading || refreshing ? 0.6 : 1, fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}>
          <RefreshCw size={14} />Refresh
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: "12px 14px" }}>
        <div style={{ position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#999" }} />
          <input type="text" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, postcode, product, sales rep or stage..." style={{ width: "100%", height: 38, boxSizing: "border-box", padding: "0 12px 0 34px", border: "1px solid #d9dadd", borderRadius: 7, outline: "none", fontFamily: "inherit", fontSize: 12 }} />
        </div>
      </div>

      {error && <div className="error" style={{ marginBottom: 16 }}><b>Database error</b><span>{error}</span></div>}

      {loading ? (
        <div className="card" style={{ padding: 60, textAlign: "center", color: "#888", fontSize: 12 }}>Loading installations...</div>
      ) : filteredDeals.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: "center", color: "#888", fontSize: 12 }}>No installations found.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {groups.filter((group) => group.items.length > 0).map((group) => {
            const collapsed = Boolean(collapsedGroups[group.key])
            return (
              <div key={group.key} style={{ border: `1px solid ${group.border}`, borderRadius: 10, overflow: "hidden", background: "#fff" }}>
                <button type="button" onClick={() => toggleGroup(group.key)} aria-expanded={!collapsed} style={{ width: "100%", minHeight: 50, display: "flex", alignItems: "center", gap: 10, padding: "0 15px", border: 0, borderBottom: collapsed ? 0 : `1px solid ${group.border}`, background: group.background, color: group.text, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                  <ChevronDown size={17} style={{ flex: "0 0 auto", transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform .15s ease" }} />
                  <span style={{ fontSize: 13, fontWeight: 800, flex: 1 }}>{group.label}</span>
                  <span style={{ minWidth: 28, height: 24, padding: "0 7px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 12, background: group.badge, color: group.text, fontSize: 10, fontWeight: 800 }}>{group.items.length}</span>
                </button>

                {!collapsed && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10, padding: 12, background: "#f8fafc" }}>
                    {group.items.map((deal) => <DealCard key={getDealId(deal)} deal={deal} />)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

import React, { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"
import { supabase } from "./lib/supabase"
import { money } from "./utils/formatters"

function FitSheet({ setSelected }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekDeals, setWeekDeals] = useState([])
  const [weekIssues, setWeekIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  function getMonday(date) {
    const d = new Date(date)
    const day = d.getDay()
    const difference = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + difference)
    d.setHours(0, 0, 0, 0)
    return d
  }

  const currentWeek = useMemo(() => {
    const monday = getMonday(new Date())
    monday.setDate(monday.getDate() + weekOffset * 7)
    return monday
  }, [weekOffset])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(currentWeek)
    date.setDate(currentWeek.getDate() + index)
    return date
  }), [currentWeek])

  function formatDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ""
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  const weekStart = formatDate(weekDays[0])
  const weekEnd = formatDate(weekDays[6])

  const weekTitle = useMemo(() => {
    const start = weekDays[0]
    const end = weekDays[6]
    if (!start || !end) return ""
    return `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
  }, [weekDays])

  useEffect(() => {
    let mounted = true

    async function loadWeek() {
      if (!supabase) {
        setWeekDeals([])
        setWeekIssues([])
        setLoading(false)
        return
      }

      setLoading(true)
      setLoadError("")

      const dealSelect = "id,customer_name,postcode,contract_number,deal_value,balance_outstanding,installation_start_date,fit_team_1,pipedrive_stage"
      const issueSelect = "id,customer_name,postcode,contract_number,deal_value,balance_outstanding,installations_issues_start_date,installation_issues_fit_team,pipedrive_stage"

      const [normalResult, issueResult] = await Promise.all([
        supabase.from("deals").select(dealSelect).gte("installation_start_date", weekStart).lte("installation_start_date", weekEnd).order("installation_start_date", { ascending: true }),
        supabase.from("deals").select(issueSelect).gte("installations_issues_start_date", weekStart).lte("installations_issues_start_date", weekEnd).order("installations_issues_start_date", { ascending: true }),
      ])

      if (!mounted) return

      if (normalResult.error || issueResult.error) {
        const message = normalResult.error?.message || issueResult.error?.message || "Unable to load Fit Sheet data."
        console.error("Error loading Fit Sheet week:", normalResult.error || issueResult.error)
        setLoadError(message)
      }

      setWeekDeals(Array.isArray(normalResult.data) ? normalResult.data : [])
      setWeekIssues(Array.isArray(issueResult.data) ? issueResult.data : [])
      setLoading(false)
    }

    loadWeek().catch((err) => {
      if (!mounted) return
      console.error("Unexpected error loading Fit Sheet week:", err)
      setLoadError(err?.message || "Unable to load Fit Sheet data.")
      setWeekDeals([])
      setWeekIssues([])
      setLoading(false)
    })

    return () => { mounted = false }
  }, [weekStart, weekEnd])

  const safeWeekDeals = Array.isArray(weekDeals) ? weekDeals : []
  const safeWeekIssues = Array.isArray(weekIssues) ? weekIssues : []

  const fitTeams = useMemo(() => {
    const normalTeams = safeWeekDeals.map(deal => deal?.fit_team_1).filter(Boolean).map(team => String(team).trim()).filter(Boolean)
    const issueTeams = safeWeekIssues.map(deal => deal?.installation_issues_fit_team).filter(Boolean).map(team => String(team).trim()).filter(Boolean)
    return [...new Set([...normalTeams, ...issueTeams])].sort((a, b) => a.localeCompare(b))
  }, [safeWeekDeals, safeWeekIssues])

  const safeFitTeams = Array.isArray(fitTeams) ? fitTeams : []
  const freshFitsCount = safeWeekDeals.length
  const freshFitsValue = safeWeekDeals.reduce((total, deal) => total + (Number(deal?.deal_value) || 0), 0)
  const freshFitsBalance = safeWeekDeals.reduce((total, deal) => total + (Number(deal?.balance_outstanding) || 0), 0)
  const issueFitsCount = safeWeekIssues.length

  function getDeals(team, date) {
    const dateString = formatDate(date)
    return safeWeekDeals.filter(deal => String(deal?.installation_start_date || "").slice(0, 10) === dateString && String(deal?.fit_team_1 || "").trim() === team)
  }

  function getIssues(team, date) {
    const dateString = formatDate(date)
    return safeWeekIssues.filter(deal => String(deal?.installations_issues_start_date || "").slice(0, 10) === dateString && String(deal?.installation_issues_fit_team || "").trim() === team)
  }

  const todayString = formatDate(new Date())

  function openDeal(deal) {
    if (typeof setSelected === "function") setSelected(deal)
  }

  function cardHoverIn(event) {
    event.currentTarget.style.boxShadow = "0 2px 7px rgba(0,0,0,0.10)"
    event.currentTarget.style.transform = "translateY(-1px)"
  }

  function cardHoverOut(event) {
    event.currentTarget.style.boxShadow = "none"
    event.currentTarget.style.transform = "translateY(0)"
  }

  function renderDealCard(deal) {
    return <button key={`fit-${deal.id}`} type="button" onClick={() => openDeal(deal)} onMouseEnter={cardHoverIn} onMouseLeave={cardHoverOut} style={{ width: "100%", textAlign: "left", border: "1px solid #cbd8c5", borderRadius: "5px", background: "#e8f4e2", padding: "8px", marginBottom: "5px", cursor: "pointer", fontFamily: "inherit", transition: "box-shadow 0.15s ease, transform 0.15s ease" }}>
      <div style={{ fontSize: "10px", fontWeight: 700, color: "#263522", lineHeight: "1.3" }}>{deal.customer_name || "Unnamed customer"}</div>
      {deal.pipedrive_stage && <div style={{ marginTop: "3px", fontSize: "8px", fontWeight: 700, color: "#40523a" }}>{deal.pipedrive_stage}</div>}
      {deal.postcode && <div style={{ marginTop: "3px", fontSize: "9px", color: "#596455" }}>{deal.postcode}</div>}
      {deal.contract_number && <div style={{ marginTop: "3px", fontSize: "9px", color: "#596455" }}>{deal.contract_number}</div>}
      {(deal.deal_value != null || deal.balance_outstanding != null) && <div style={{ marginTop: "5px", fontSize: "9px", fontWeight: 700, color: "#263522" }}>{money(deal.deal_value || 0)} <span style={{ color: "#777", fontWeight: 600 }}>|</span> <span style={{ color: "#8a4a4a" }}>{money(deal.balance_outstanding || 0)}</span></div>}
    </button>
  }

  function renderIssueCard(deal) {
    return <button key={`issue-${deal.id}`} type="button" onClick={() => openDeal(deal)} onMouseEnter={cardHoverIn} onMouseLeave={cardHoverOut} style={{ width: "100%", textAlign: "left", border: "1px solid #f0b8b8", borderRadius: "5px", background: "#fde8e8", padding: "8px", marginBottom: "5px", cursor: "pointer", fontFamily: "inherit", transition: "box-shadow 0.15s ease, transform 0.15s ease" }}>
      <div style={{ fontSize: "8px", fontWeight: 800, color: "#b42318", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "3px" }}>Issue</div>
      <div style={{ fontSize: "10px", fontWeight: 700, color: "#5f2020", lineHeight: "1.3" }}>{deal.customer_name || "Unnamed customer"}</div>
      {deal.pipedrive_stage && <div style={{ marginTop: "3px", fontSize: "8px", fontWeight: 700, color: "#8a4a4a" }}>{deal.pipedrive_stage}</div>}
      {deal.postcode && <div style={{ marginTop: "3px", fontSize: "9px", color: "#7f4a4a" }}>{deal.postcode}</div>}
      {deal.contract_number && <div style={{ marginTop: "3px", fontSize: "9px", color: "#7f4a4a" }}>{deal.contract_number}</div>}
    </button>
  }

  const statCard = (label, value, valueColor = "#172554") => <div className="card" style={{ flex: 1, minWidth: "180px", padding: "18px 20px", margin: 0 }}>
    <div style={{ fontSize: "10px", fontWeight: 700, color: "#777", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
    <div style={{ marginTop: "7px", fontSize: "28px", lineHeight: 1.1, fontWeight: 800, color: valueColor }}>{value}</div>
  </div>

  return <section>
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "18px" }}>
      {statCard("Fresh fits", freshFitsCount)}
      {statCard("Fresh fit value", money(freshFitsValue))}
      {statCard("Fresh fit balance", money(freshFitsBalance), "#8a4a4a")}
      {statCard("Issue fits", issueFitsCount, "#b42318")}
    </div>

    <div className="card" style={{ marginBottom: "18px", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <CalendarDays size={20} color="#172554" />
          <div><h1 style={{ margin: 0, fontSize: "20px", lineHeight: 1.2 }}>FitSheet</h1><p style={{ margin: "4px 0 0", fontSize: "11px", color: "#888" }}>{weekTitle}</p></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button type="button" onClick={() => setWeekOffset(value => value - 1)} style={{ width: "34px", height: "34px", border: "1px solid #dddfe3", borderRadius: "7px", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft size={16} /></button>
          <button type="button" onClick={() => setWeekOffset(0)} style={{ height: "34px", padding: "0 12px", border: "1px solid #dddfe3", borderRadius: "7px", background: "#fff", cursor: "pointer", fontSize: "11px", fontWeight: 600 }}>This week</button>
          <button type="button" onClick={() => setWeekOffset(value => value + 1)} style={{ width: "34px", height: "34px", border: "1px solid #dddfe3", borderRadius: "7px", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight size={16} /></button>
        </div>
      </div>
    </div>

    <div className="card" style={{ padding: 0, overflow: "auto" }}>
      <div style={{ minWidth: "1250px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "190px repeat(7, minmax(150px, 1fr))", borderBottom: "2px solid #172554", position: "sticky", top: 0, zIndex: 10, background: "#fff" }}>
          <div style={{ padding: "10px 12px", background: "#f2f3f5", borderRight: "1px solid #d9dadd", fontSize: "10px", fontWeight: 700, color: "#555", textTransform: "uppercase" }}>Fit Team</div>
          {weekDays.map(date => { const dateString = formatDate(date); const isToday = dateString === todayString; return <div key={dateString} style={{ padding: "8px 10px", textAlign: "center", background: isToday ? "#eef2ff" : "#f2f3f5", borderRight: "1px solid #d9dadd" }}><div style={{ fontSize: "10px", fontWeight: 700, color: isToday ? "#172554" : "#555", textTransform: "uppercase" }}>{date.toLocaleDateString("en-GB", { weekday: "short" })}</div><div style={{ marginTop: "3px", fontSize: "12px", fontWeight: 600, color: isToday ? "#172554" : "#333" }}>{date.getDate()} {date.toLocaleDateString("en-GB", { month: "short" })}</div></div> })}
        </div>

        {loadError && <div style={{ padding: "8px 12px", background: "#fff4f4", color: "#b42318", fontSize: "10px", borderBottom: "1px solid #f0b8b8" }}>Unable to load Fit Sheet data: {loadError}</div>}
        {loading ? <div style={{ padding: "60px 20px", textAlign: "center", color: "#999", fontSize: "12px" }}>Loading this week's fits...</div> : safeFitTeams.length === 0 ? <div style={{ padding: "60px 20px", textAlign: "center", color: "#999", fontSize: "12px" }}>No fits or issues found for this week.</div> : safeFitTeams.map(team => <div key={team} style={{ display: "grid", gridTemplateColumns: "190px repeat(7, minmax(150px, 1fr))", minHeight: "160px", borderBottom: "1px solid #d9dadd" }}><div style={{ padding: "14px 12px", background: "#f7f7f8", borderRight: "1px solid #d9dadd", fontSize: "11px", fontWeight: 600, color: "#333", display: "flex", alignItems: "center" }}>{team}</div>{weekDays.map(date => { const deals = getDeals(team, date); const issues = getIssues(team, date); return <div key={`${team}-${formatDate(date)}`} style={{ padding: "6px", borderRight: "1px solid #d9dadd", background: "#fff", minHeight: "160px" }}>{deals.map(renderDealCard)}{issues.map(renderIssueCard)}</div> })}</div>)}
      </div>
    </div>
  </section>
}

export default FitSheet

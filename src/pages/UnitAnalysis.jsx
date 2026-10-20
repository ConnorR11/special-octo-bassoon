import React, { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw, Search, ChevronDown, ChevronRight, Boxes } from "lucide-react"
import { supabase } from "../lib/supabase"

const PAGE_SIZE = 1000
const money = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }) : "—"
const dimension = value => Number(value).toLocaleString("en-GB", { maximumFractionDigits: 1 })
const text = value => String(value ?? "").trim()
const normaliseType = value => text(value) || "Unspecified type"
const normaliseStyle = value => text(value) || "Unspecified style"

function getCostMetrics(rows) {
  const costed = rows.filter(row => row.netCost != null && Number.isFinite(row.netCost) && row.netCost > 0)
  const discCosted = costed.filter(row => row.cost != null && Number.isFinite(row.cost))
  const costs = costed.map(row => row.netCost)
  return {
    ordered: rows.length,
    costed: costed.length,
    average: costs.length ? costs.reduce((sum, value) => sum + value, 0) / costs.length : null,
    lowest: costs.length ? Math.min(...costs) : null,
    highest: costs.length ? Math.max(...costs) : null,
    averageDisc: discCosted.length ? discCosted.reduce((sum, row) => sum + row.cost, 0) / discCosted.length : null
  }
}

function MetricCells({ rows }) {
  const metrics = getCostMetrics(rows)
  return <>
    <td>{metrics.ordered.toLocaleString("en-GB")}</td>
    <td>{metrics.costed.toLocaleString("en-GB")}</td>
    <td>{metrics.average == null ? "—" : money(metrics.average)}</td>
    <td>{metrics.lowest == null ? "—" : money(metrics.lowest)}</td>
    <td>{metrics.highest == null ? "—" : money(metrics.highest)}</td>
    <td>{metrics.averageDisc == null ? "—" : money(metrics.averageDisc)}</td>
  </>
}

function buildConfigurationGroups(rows) {
  const configurations = new Map()
  rows.forEach(row => {
    const openers = text(row.openers_choice) || "Unspecified"
    const fixed = text(row.fixed_choice) || "Unspecified"
    const key = JSON.stringify([openers, fixed])
    if (!configurations.has(key)) configurations.set(key, { key, openers, fixed, rows: [] })
    configurations.get(key).rows.push(row)
  })
  return [...configurations.values()].sort((a, b) => {
    const openerDiff = (Number(a.openers) || 0) - (Number(b.openers) || 0)
    if (openerDiff) return openerDiff
    const fixedDiff = (Number(a.fixed) || 0) - (Number(b.fixed) || 0)
    if (fixedDiff) return fixedDiff
    return a.openers.localeCompare(b.openers) || a.fixed.localeCompare(b.fixed)
  })
}

function buildSizeGroups(rows, tolerance = 50) {
  const sorted = [...rows].sort((a, b) => a.width - b.width || a.height - b.height)
  const groups = []
  sorted.forEach(row => {
    let target = groups.find(group =>
      Math.max(group.maxWidth, row.width) - Math.min(group.minWidth, row.width) <= tolerance &&
      Math.max(group.maxHeight, row.height) - Math.min(group.minHeight, row.height) <= tolerance
    )
    if (!target) {
      target = {
        key: `${row.width}x${row.height}-${groups.length}`,
        anchorWidth: row.width,
        anchorHeight: row.height,
        minWidth: row.width,
        maxWidth: row.width,
        minHeight: row.height,
        maxHeight: row.height,
        rows: []
      }
      groups.push(target)
    }
    target.rows.push(row)
    target.minWidth = Math.min(target.minWidth, row.width)
    target.maxWidth = Math.max(target.maxWidth, row.width)
    target.minHeight = Math.min(target.minHeight, row.height)
    target.maxHeight = Math.max(target.maxHeight, row.height)
  })
  return groups.map(group => {
    const widths = group.rows.map(row => row.width)
    const heights = group.rows.map(row => row.height)
    return {
      ...group,
      minWidth: Math.min(...widths),
      maxWidth: Math.max(...widths),
      minHeight: Math.min(...heights),
      maxHeight: Math.max(...heights)
    }
  }).sort((a, b) => a.anchorWidth - b.anchorWidth || a.anchorHeight - b.anchorHeight)
}

function buildColourGroups(rows) {
  const byColour = new Map()
  rows.forEach(row => {
    const colour = text(row.colour_choice) || "Unspecified colour"
    if (!byColour.has(colour)) byColour.set(colour, [])
    byColour.get(colour).push(row)
  })
  return [...byColour.entries()]
    .map(([colour, colourRows]) => ({
      key: colour,
      colour,
      rows: colourRows,
      sizeGroups: buildSizeGroups(colourRows)
    }))
    .sort((a, b) => a.colour.localeCompare(b.colour))
}

function buildGroups(rows) {
  const validRows = rows
    .filter(row => Boolean(row.ordered_date))
    .map(row => ({
      ...row,
      width: Number(row.width),
      height: Number(row.height),
      cost: row.discountable == null || row.discountable === "" ? null : Number(row.discountable),
      netCost: row.net_product_cost == null || row.net_product_cost === "" ? null : Number(row.net_product_cost),
      ordered: true,
      style: normaliseStyle(row.style_choice)
    }))
    .filter(row => Number.isFinite(row.width) && row.width > 0 && Number.isFinite(row.height) && row.height > 0)
  const byStyle = new Map()
  validRows.forEach(row => {
    if (!byStyle.has(row.style)) byStyle.set(row.style, [])
    byStyle.get(row.style).push(row)
  })
  return [...byStyle.entries()].map(([style, styleRows]) => ({
    key: style,
    style,
    rows: styleRows.sort((a, b) => a.width - b.width || a.height - b.height || String(a.UUID).localeCompare(String(b.UUID)))
  })).sort((a, b) => a.style.localeCompare(b.style))
}

function StatCard({ label, value, note }) {
  return <div className="unit-analysis-stat"><div className="unit-analysis-stat-label">{label}</div><div className="unit-analysis-stat-value">{value}</div><div className="unit-analysis-stat-note">{note}</div></div>
}

export default function UnitAnalysis() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [styleFilter, setStyleFilter] = useState("all")
  const [expanded, setExpanded] = useState({})
  const [configurationExpanded, setConfigurationExpanded] = useState({})
  const [colourExpanded, setColourExpanded] = useState({})
  const [sizeExpanded, setSizeExpanded] = useState({})
  const [lastUpdated, setLastUpdated] = useState(null)
  const [dealRecords, setDealRecords] = useState([])
  const [dealsLoading, setDealsLoading] = useState(false)
  const [dealsError, setDealsError] = useState("")
  const [dealSearch, setDealSearch] = useState("")
  const [expandedDeals, setExpandedDeals] = useState({})

  const loadUnits = useCallback(async () => {
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return }
    setLoading(true)
    setError("")
    try {
      const all = []
      let from = 0
      while (true) {
        const { data, error: fetchError } = await supabase
          .from("units")
          .select('"UUID", appointment_id, location, created_by, created_date, unit_type, style_choice, colour_choice, colour_value, openers_choice, fixed_choice, width, height, discountable, net_product_cost, ordered_date, contract_number, department, supplier, added_to_supabase_date')
          .eq("unit_type", "Window")
          .eq("department", "SURVEY")
          .range(from, from + PAGE_SIZE - 1)
        if (fetchError) throw fetchError
        const batch = data || []
        all.push(...batch)
        if (batch.length < PAGE_SIZE) break
        from += PAGE_SIZE
      }
      setRows(all)
      setLastUpdated(new Date())
    } catch (err) {
      console.error("Unable to load unit analysis:", err)
      setError(err?.message || "Unable to load units.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUnits() }, [loadUnits])

  useEffect(() => {
    let cancelled = false
    async function loadDealUnitAnalysis() {
      if (!supabase) return
      const costedRows = rows.filter(row =>
        Boolean(row.ordered_date) &&
        row.net_product_cost != null &&
        row.net_product_cost !== "" &&
        Number.isFinite(Number(row.net_product_cost)) &&
        Number(row.net_product_cost) > 0 &&
        text(row.appointment_id)
      )
      const appointmentIds = [...new Set(costedRows.map(row => text(row.appointment_id)))]
      if (!appointmentIds.length) {
        setDealRecords([])
        setDealsError("")
        setDealsLoading(false)
        return
      }
      setDealsLoading(true)
      setDealsError("")
      try {
        const matchedDeals = []
        for (let i = 0; i < appointmentIds.length; i += 100) {
          const batch = appointmentIds.slice(i, i + 100)
          const { data, error: dealFetchError } = await supabase
            .from("deals")
            .select("appointment_row_id, net_value, survey_costing, pipedrive_stage, customer_name")
            .in("appointment_row_id", batch)
          if (dealFetchError) throw dealFetchError
          matchedDeals.push(...(data || []))
        }
        if (cancelled) return
        const byAppointment = new Map()
        matchedDeals.forEach(deal => {
          const key = text(deal.appointment_row_id)
          if (key && !byAppointment.has(key)) byAppointment.set(key, deal)
        })
        const aggregate = new Map()
        costedRows.forEach(unit => {
          const appointmentId = text(unit.appointment_id)
          const deal = byAppointment.get(appointmentId)
          if (!deal) return
          const key = appointmentId
          if (!aggregate.has(key)) aggregate.set(key, {
            key,
            appointmentId,
            customerName: text(deal.customer_name) || text(unit.contract_number) || appointmentId,
            netValue: Number.isFinite(Number(deal.net_value)) ? Number(deal.net_value) : 0,
            surveyCosting: deal.survey_costing == null || deal.survey_costing === "" || !Number.isFinite(Number(deal.survey_costing)) ? null : Number(deal.survey_costing),
            stage: text(deal.pipedrive_stage) || "—",
            units: [],
            byType: new Map(),
            unitSpend: 0,
            discountableTotal: 0
          })
          const entry = aggregate.get(key)
          const cost = Number(unit.net_product_cost)
          entry.units.push(unit)
          entry.unitSpend += cost
          const discountable = unit.discountable == null || unit.discountable === "" ? 0 : Number(unit.discountable)
          if (Number.isFinite(discountable)) entry.discountableTotal += discountable
          const unitType = text(unit.unit_type) || "Unspecified type"
          const style = text(unit.style_choice) || "Unspecified style"
          const typeKey = `${unitType}::${style}`
          if (!entry.byType.has(typeKey)) entry.byType.set(typeKey, { unitType, style, count: 0, spend: 0 })
          const typeEntry = entry.byType.get(typeKey)
          typeEntry.count += 1
          typeEntry.spend += cost
        })
        setDealRecords([...aggregate.values()].map(deal => {
          const unitCount = deal.units.length
          const cos = deal.unitSpend + (200 * unitCount)
          const cosPercent = deal.netValue > 0 ? (cos / deal.netValue) * 100 : null
          return {
            ...deal,
            marginAfterUnits: deal.netValue - deal.unitSpend,
            unitCount,
            cos,
            cosPercent,
            byType: [...deal.byType.values()].sort((a, b) => a.unitType.localeCompare(b.unitType) || a.style.localeCompare(b.style))
          }
        }).filter(deal => deal.cosPercent != null && deal.cosPercent > 50).sort((a, b) => b.cosPercent - a.cosPercent))
      } catch (err) {
        console.error("Unable to load deal unit analysis:", err)
        if (!cancelled) {
          setDealsError(err?.message || "Unable to load deal and unit comparisons.")
          setDealRecords([])
        }
      } finally {
        if (!cancelled) setDealsLoading(false)
      }
    }
    loadDealUnitAnalysis()
    return () => { cancelled = true }
  }, [rows])

  const groups = useMemo(() => buildGroups(rows), [rows])
  const styleOptions = useMemo(() => [...new Set(groups.map(group => group.style))].sort((a, b) => a.localeCompare(b)), [groups])
  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase()
    return groups.filter(group => {
      if (styleFilter !== "all" && group.style !== styleFilter) return false
      if (term && ![group.style, ...group.rows.map(row => String(row.contract_number || "") + " " + String(row.unit_type || "") + " " + row.width + " " + row.height)].some(value => String(value ?? "").toLowerCase().includes(term))) return false
      return true
    })
  }, [groups, search, styleFilter])

  const orderedRows = rows.filter(row => Boolean(row.ordered_date)).map(row => ({
    ...row,
    netCost: row.net_product_cost == null || row.net_product_cost === "" ? null : Number(row.net_product_cost),
    cost: row.discountable == null || row.discountable === "" ? null : Number(row.discountable)
  }))
  const orderedMetrics = getCostMetrics(orderedRows)
  const orderedUnits = orderedRows.length
  const averageOrderedNet = orderedMetrics.average



  return <div className="unit-analysis-page">
    <style>{`
      .unit-analysis-page{color:#17212b;font-family:inherit;max-width:1600px;margin:0 auto;padding:8px 0 36px}
      .unit-analysis-header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:24px}
      .unit-analysis-eyebrow{font-size:11px;font-weight:750;letter-spacing:1px;text-transform:uppercase;color:#64748b}
      .unit-analysis-header h1{font-size:28px;line-height:1.2;margin:6px 0 7px;color:#14202b}
      .unit-analysis-subtitle{font-size:13px;color:#667085;margin:0;max-width:720px;line-height:1.55}
      .unit-analysis-refresh{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #d0d5dd;background:#fff;color:#344054;border-radius:8px;padding:10px 13px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}
      .unit-analysis-refresh:disabled{opacity:.55;cursor:wait}
      .unit-analysis-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:22px}
      .unit-analysis-stat{background:#fff;border:1px solid #e4e7ec;border-radius:12px;padding:17px 18px;min-width:0}
      .unit-analysis-stat-label{font-size:12px;color:#667085;font-weight:600}
      .unit-analysis-stat-value{font-size:25px;font-weight:750;letter-spacing:-.5px;color:#101828;margin:9px 0 5px;overflow-wrap:anywhere}
      .unit-analysis-stat-note{font-size:11px;color:#98a2b3}
      .unit-analysis-panel{background:#fff;border:1px solid #e4e7ec;border-radius:12px;overflow:hidden}
      .unit-analysis-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px;border-bottom:1px solid #e4e7ec;flex-wrap:wrap}
      .unit-analysis-toolbar-title{font-size:15px;font-weight:750;color:#101828}
      .unit-analysis-toolbar-subtitle{font-size:11px;color:#667085;margin-top:4px}
      .unit-analysis-filters{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
      .unit-analysis-search{display:flex;align-items:center;gap:7px;border:1px solid #d0d5dd;border-radius:8px;padding:0 10px;height:36px;background:#fff;min-width:220px}
      .unit-analysis-search input{border:0;outline:0;min-width:0;width:100%;font:inherit;font-size:12px}
      .unit-analysis-select{height:36px;border:1px solid #d0d5dd;border-radius:8px;padding:0 9px;background:#fff;color:#344054;font:inherit;font-size:12px;max-width:200px}
      .unit-analysis-count{font-size:11px;color:#667085;padding:12px 16px 0}
      .unit-analysis-table-wrap{width:100%;overflow:auto}
      .unit-analysis-table{border-collapse:collapse;width:100%;min-width:900px;font-size:12px}
      .unit-analysis-table th{background:#f8fafc;color:#475467;font-size:10px;letter-spacing:.3px;text-transform:uppercase;text-align:right;padding:12px 13px;border-bottom:1px solid #e4e7ec;white-space:nowrap}
      .unit-analysis-table th:first-child,.unit-analysis-table td:first-child{text-align:left}
      .unit-analysis-table td{padding:12px 13px;border-bottom:1px solid #eaecf0;text-align:right;white-space:nowrap}
      .unit-analysis-table tbody tr:hover{background:#f9fafb}
      .unit-analysis-table .unit-analysis-group-row{cursor:pointer}
      .unit-analysis-type{font-weight:750;color:#1d2939}
      .unit-analysis-size{font-weight:650;color:#344054}
      .unit-analysis-muted{font-size:10px;color:#667085;margin-top:4px}
      .unit-analysis-pill{display:inline-flex;align-items:center;border-radius:20px;background:#ecfdf3;color:#027a48;padding:4px 8px;font-size:10px;font-weight:750}
      .unit-analysis-empty{padding:36px 16px!important;text-align:center!important;color:#667085!important}
      .unit-analysis-error{margin-bottom:16px;padding:12px 14px;border:1px solid #fecdca;background:#fef3f2;border-radius:8px;color:#b42318;font-size:12px}
      .unit-analysis-footnote{font-size:11px;color:#667085;line-height:1.5;padding:13px 16px}
      .unit-analysis-detail td{background:#fbfcfd;font-size:11px}
      .unit-analysis-detail-head th{background:#f2f4f7}
      @media(max-width:1000px){.unit-analysis-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:650px){.unit-analysis-page{padding-top:0}.unit-analysis-header{padding-left:48px;align-items:flex-start}.unit-analysis-header h1{font-size:24px}.unit-analysis-refresh{padding:9px}.unit-analysis-stats{gap:9px}.unit-analysis-stat{padding:13px}.unit-analysis-stat-value{font-size:21px}.unit-analysis-toolbar{align-items:stretch}.unit-analysis-filters{display:grid;grid-template-columns:1fr 1fr;width:100%}.unit-analysis-search{grid-column:1/-1;min-width:0}.unit-analysis-select{width:100%;max-width:none}}
    `}</style>
    <div className="unit-analysis-header">
      <div><div className="unit-analysis-eyebrow">Administration</div><h1>Unit Analysis</h1><p className="unit-analysis-subtitle">Analyse ordered windows only, grouped by style, colour, approximate size, opener/fixed configuration and individual unit.</p></div>
      <button className="unit-analysis-refresh" type="button" onClick={loadUnits} disabled={loading}><RefreshCw size={14}/>{loading ? "Loading…" : "Refresh"}</button>
    </div>
    {error && <div className="unit-analysis-error">{error}</div>}
    <div className="unit-analysis-stats">
      <StatCard label="Windows ordered" value={orderedUnits.toLocaleString("en-GB")} note="Only units with an order date"/>
      <StatCard label="Average Net Cost" value={averageOrderedNet == null ? "—" : money(averageOrderedNet)} note="Ordered units with a positive recorded net cost"/>
    </div>
    <section className="unit-analysis-panel">
      <div className="unit-analysis-toolbar">
        <div><div className="unit-analysis-toolbar-title">Breakdown by style</div><div className="unit-analysis-toolbar-subtitle">Ordered windows only · style → colour choice → size within 50 mm → openers/fixed → individual units.</div></div>
        <div className="unit-analysis-filters">
          <label className="unit-analysis-search"><Search size={14} color="#667085"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search style, size or contract"/></label>
          <select className="unit-analysis-select" value={styleFilter} onChange={event => setStyleFilter(event.target.value)} aria-label="Filter by style"><option value="all">All styles</option>{styleOptions.map(style => <option key={style} value={style}>{style}</option>)}</select>
        </div>
      </div>
      <div className="unit-analysis-count">{loading ? "Loading units…" : `Showing ${filteredGroups.length.toLocaleString("en-GB")} styles · ${orderedRows.length.toLocaleString("en-GB")} ordered windows`}</div>
      <div className="unit-analysis-table-wrap">
        <table className="unit-analysis-table">
          <thead><tr><th style={{textAlign:"left"}}>Style</th><th>Ordered</th><th>Costed</th><th>Avg. Net Cost</th><th>Lowest</th><th>Highest</th><th>Avg. Disc Total</th></tr></thead>
          <tbody>
            {loading && rows.length === 0 ? <tr><td colSpan="7" className="unit-analysis-empty">Loading unit records…</td></tr> :
              filteredGroups.length === 0 ? <tr><td colSpan="7" className="unit-analysis-empty">{error ? "Unit data could not be loaded." : "No units match these filters."}</td></tr> :
              filteredGroups.map(group => <React.Fragment key={group.key}>
                <tr className="unit-analysis-group-row" onClick={() => setExpanded(current => ({...current,[group.key]:!current[group.key]}))}>
                  <td style={{textAlign:"left"}}><div style={{display:"flex",alignItems:"center",gap:8}}>{expanded[group.key] ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}<div><div className="unit-analysis-type">{group.style}</div><div className="unit-analysis-muted">{new Set(group.rows.map(row => normaliseType(row.unit_type))).size} unit types · {group.rows.length} total units</div></div></div></td>
                  <MetricCells rows={group.rows}/>
                </tr>
                {expanded[group.key] && <tr className="unit-analysis-detail"><td colSpan="7" style={{padding:0}}>
                  <table className="unit-analysis-table" style={{minWidth:900}}><thead className="unit-analysis-detail-head"><tr><th style={{textAlign:"left"}}>Colour</th><th>Ordered</th><th>Costed</th><th>Avg. Net Cost</th><th>Lowest</th><th>Highest</th><th>Avg. Disc Total</th></tr></thead><tbody>
                    {buildColourGroups(group.rows).map(colourGroup => {
                      const colourNetCosted = colourGroup.rows.filter(row => row.netCost != null && Number.isFinite(row.netCost))
                      const colourCosted = colourNetCosted.filter(row => row.cost != null && Number.isFinite(row.cost))
                      const colourOrdered = colourGroup.rows.filter(row => row.ordered)
                      const colourKey = `${group.key}::colour::${colourGroup.key}`
                      return <React.Fragment key={colourKey}>
                        <tr className="unit-analysis-group-row" style={{background:"#eef2f6"}} onClick={() => setColourExpanded(current => ({...current,[colourKey]:!current[colourKey]}))}>
                          <td style={{textAlign:"left"}}><div style={{display:"flex",alignItems:"center",gap:8}}>{colourExpanded[colourKey] ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}<div><div className="unit-analysis-type">{colourGroup.colour}</div><div className="unit-analysis-muted">{colourGroup.rows.length.toLocaleString("en-GB")} units</div></div></div></td>
                          <MetricCells rows={colourGroup.rows}/>
                        </tr>
                        {colourExpanded[colourKey] && <tr className="unit-analysis-detail"><td colSpan="7" style={{padding:0}}>
                          <table className="unit-analysis-table" style={{minWidth:900}}><thead className="unit-analysis-detail-head"><tr><th style={{textAlign:"left"}}>Approx. size (W × H)</th><th>Ordered</th><th>Costed</th><th>Avg. Net Cost</th><th>Lowest</th><th>Highest</th><th>Avg. Disc Total</th></tr></thead><tbody>
                            {colourGroup.sizeGroups.map(sizeGroup => {
                              const sizeNetCosted = sizeGroup.rows.filter(row => row.netCost != null && Number.isFinite(row.netCost))
                              const sizeCosted = sizeNetCosted.filter(row => row.cost != null && Number.isFinite(row.cost))
                              const sizeOrdered = sizeGroup.rows.filter(row => row.ordered)
                              const sizeKey = `${colourKey}::size::${sizeGroup.key}`
                              const rangeLabel = (min, max) => min === max ? `${dimension(min)} mm` : `${dimension(min)}–${dimension(max)} mm`
                              return <React.Fragment key={sizeKey}>
                                <tr className="unit-analysis-group-row" style={{background:"#f5f7fa"}} onClick={() => setSizeExpanded(current => ({...current,[sizeKey]:!current[sizeKey]}))}>
                                  <td style={{textAlign:"left"}}><div style={{display:"flex",alignItems:"center",gap:8}}>{sizeExpanded[sizeKey] ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}<div><div className="unit-analysis-type">{rangeLabel(sizeGroup.minWidth,sizeGroup.maxWidth)} × {rangeLabel(sizeGroup.minHeight,sizeGroup.maxHeight)}</div><div className="unit-analysis-muted">{sizeGroup.rows.length.toLocaleString("en-GB")} units</div></div></div></td>
                                  <MetricCells rows={sizeGroup.rows}/>
                                </tr>
                                {sizeExpanded[sizeKey] && <tr className="unit-analysis-detail"><td colSpan="7" style={{padding:0}}>
                                  <table className="unit-analysis-table" style={{minWidth:900}}><thead className="unit-analysis-detail-head"><tr><th style={{textAlign:"left"}}>Openers / fixed</th><th>Ordered</th><th>Costed</th><th>Avg. Net Cost</th><th>Lowest</th><th>Highest</th><th>Avg. Disc Total</th></tr></thead><tbody>
                                    {buildConfigurationGroups(sizeGroup.rows).map(configuration => {
                                      const configNetCosted = configuration.rows.filter(row => row.netCost != null && Number.isFinite(row.netCost))
                                      const configCosted = configNetCosted.filter(row => row.cost != null && Number.isFinite(row.cost))
                                      const configOrdered = configuration.rows.filter(row => row.ordered)
                                      const configKey = `${sizeKey}::${configuration.key}`
                                      return <React.Fragment key={configuration.key}>
                                        <tr className="unit-analysis-group-row" style={{background:"#f8fafc"}} onClick={() => setConfigurationExpanded(current => ({...current,[configKey]:!current[configKey]}))}>
                                          <td style={{textAlign:"left"}}><div style={{display:"flex",alignItems:"center",gap:8}}>{configurationExpanded[configKey] ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}<span className="unit-analysis-type">{configuration.openers} openers · {configuration.fixed} fixed</span><span className="unit-analysis-muted">{configuration.rows.length.toLocaleString("en-GB")} units</span></div></td>
                                          <MetricCells rows={configuration.rows}/>
                                        </tr>
                                        {configurationExpanded[configKey] && <tr className="unit-analysis-detail"><td colSpan="7" style={{padding:0}}>
                                          <table className="unit-analysis-table" style={{minWidth:750}}><thead className="unit-analysis-detail-head"><tr><th style={{textAlign:"left"}}>Unit / contract</th><th>Colour choice</th><th>Width</th><th>Height</th><th>Disc Total</th><th>Net Cost</th><th>Supplier</th><th>Ordered date</th></tr></thead><tbody>
                                            {configuration.rows.map((row,index) => <tr key={row.UUID || `${configKey}-${index}`}><td style={{textAlign:"left"}}>{text(row.contract_number) || text(row.UUID) || "Unit"}<div className="unit-analysis-muted">{text(row.location) || text(row.appointment_id) || "—"}</div></td><td>{text(row.colour_choice) || "—"}</td><td>{dimension(row.width)} mm</td><td>{dimension(row.height)} mm</td><td>{row.cost == null || !Number.isFinite(row.cost) ? "—" : money(row.cost)}</td><td>{row.netCost == null || !Number.isFinite(row.netCost) ? "—" : money(row.netCost)}</td><td>{text(row.supplier) || "—"}</td><td>{row.ordered_date ? new Date(row.ordered_date).toLocaleDateString("en-GB") : "—"}</td></tr>)}
                                          </tbody></table>
                                        </td></tr>}
                                      </React.Fragment>
                                    })}
                                  </tbody></table>
                                </td></tr>}
                              </React.Fragment>
                            })}
                          </tbody></table>
                        </td></tr>}
                      </React.Fragment>
                    })}
                  </tbody></table>
                </td></tr>}
              </React.Fragment>)
            }
          </tbody>
        </table>
      </div>
      <div className="unit-analysis-footnote">Only records where unit_type is “Window”, department is “SURVEY” and ordered_date is populated are included. Groups follow style_choice → colour_choice → width/height within 50 mm → openers_choice/fixed_choice → individual units. Average, lowest and highest Net Cost use positive numeric net_product_cost values; Average Disc Total uses units with a positive net cost and a numeric discountable value. Size groups show ranges and may contain different exact dimensions.</div>
    </section>
    
    <section className="unit-analysis-panel" style={{marginTop:24}}>
      <div className="unit-analysis-toolbar">
        <div><div className="unit-analysis-toolbar-title">Deals with costed units</div><div className="unit-analysis-toolbar-subtitle">Only jobs with COS% above 50%. COS = recorded unit spend + £200 per unit.</div></div>
        <label className="unit-analysis-search"><Search size={14} color="#667085"/><input value={dealSearch} onChange={event => setDealSearch(event.target.value)} placeholder="Search deal or appointment"/></label>
      </div>
      {dealsError && <div className="unit-analysis-error" style={{margin:12}}>{dealsError}</div>}
      <div className="unit-analysis-count">{dealsLoading ? "Loading deal comparisons…" : `${dealRecords.filter(deal => !dealSearch.trim() || `${deal.customerName} ${deal.appointmentId} ${deal.stage}`.toLowerCase().includes(dealSearch.trim().toLowerCase())).length.toLocaleString("en-GB")} jobs with COS% over 50%`}</div>
      <div className="unit-analysis-table-wrap">
        <table className="unit-analysis-table" style={{minWidth:1000}}>
          <thead><tr><th style={{textAlign:"left"}}>Deal / appointment</th><th>Stage</th><th>Units costed</th><th>Deal net value</th><th>Discountable total</th><th>Survey costing</th><th>Unit spend</th><th>COS</th><th>COS%</th></tr></thead>
          <tbody>
            {dealsLoading && dealRecords.length === 0 ? <tr><td colSpan="9" className="unit-analysis-empty">Loading deals…</td></tr> :
              dealRecords.filter(deal => !dealSearch.trim() || `${deal.customerName} ${deal.appointmentId} ${deal.stage}`.toLowerCase().includes(dealSearch.trim().toLowerCase())).length === 0 ?
                <tr><td colSpan="9" className="unit-analysis-empty">{dealsError ? "Deal comparisons could not be loaded." : "No jobs have COS% over 50% matching this search."}</td></tr> :
                dealRecords.filter(deal => !dealSearch.trim() || `${deal.customerName} ${deal.appointmentId} ${deal.stage}`.toLowerCase().includes(dealSearch.trim().toLowerCase())).map(deal => <React.Fragment key={deal.key}>
                  <tr className="unit-analysis-group-row" onClick={() => setExpandedDeals(current => ({...current,[deal.key]:!current[deal.key]}))}>
                    <td style={{textAlign:"left"}}><div style={{display:"flex",alignItems:"center",gap:8}}>{expandedDeals[deal.key] ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}<div><div className="unit-analysis-type">{deal.customerName}</div><div className="unit-analysis-muted">Appointment {deal.appointmentId}</div></div></div></td>
                    <td>{deal.stage}</td><td>{deal.unitCount.toLocaleString("en-GB")}</td><td>{money(deal.netValue)}</td><td>{money(deal.discountableTotal)}</td><td>{deal.surveyCosting == null ? "—" : `${deal.surveyCosting.toFixed(1)}%`}</td><td>{money(deal.unitSpend)}</td><td style={{fontWeight:750}}>{money(deal.cos)}</td><td style={{fontWeight:800,color:deal.cosPercent > 70 ? "#b42318" : "#b54708"}}>{deal.cosPercent.toFixed(1)}%</td>
                  </tr>
                  {expandedDeals[deal.key] && <tr className="unit-analysis-detail"><td colSpan="9" style={{padding:0}}>
                    <table className="unit-analysis-table" style={{minWidth:1050}}><thead className="unit-analysis-detail-head"><tr><th style={{textAlign:"left"}}>Unit / contract</th><th>Discountable</th><th>After Discount</th><th>Survey Costing</th><th>Gross Price</th><th>Net Sold Price</th><th>Net Cost</th><th>Product Cost %</th></tr></thead><tbody>
                      {deal.units.map((unit, index) => {
                        const discountable = unit.discountable == null || unit.discountable === "" || !Number.isFinite(Number(unit.discountable)) ? null : Number(unit.discountable)
                        const discountRate = deal.discountableTotal >= 12000 ? 0.30 : 0.25
                        const afterDiscount = discountable == null ? null : discountable * (1 - discountRate)
                        const surveyRate = deal.surveyCosting == null ? null : deal.surveyCosting / 100
                        const grossPrice = afterDiscount == null || surveyRate == null ? null : Math.abs(afterDiscount * surveyRate)
                        const netSoldPrice = grossPrice == null ? null : grossPrice / 1.2
                        const netCost = unit.net_product_cost == null || unit.net_product_cost === "" || !Number.isFinite(Number(unit.net_product_cost)) ? null : Number(unit.net_product_cost)
                        const productCostPercent = netSoldPrice > 0 && netCost != null ? (netCost / netSoldPrice) * 100 : null
                        return <tr key={unit.UUID || `${deal.key}-unit-${index}`}>
                          <td style={{textAlign:"left"}}>{text(unit.contract_number) || text(unit.UUID) || "Unit"}<div className="unit-analysis-muted">{text(unit.unit_type) || "Window"} · {text(unit.style_choice) || "Unspecified style"} · {unit.width && unit.height ? `${dimension(Number(unit.width))} × ${dimension(Number(unit.height))} mm` : ""}</div></td>
                          <td>{discountable == null ? "—" : money(discountable)}</td>
                          <td>{afterDiscount == null ? "—" : money(afterDiscount)}</td>
                          <td>{deal.surveyCosting == null ? "—" : `${deal.surveyCosting.toFixed(1)}%`}</td>
                          <td>{grossPrice == null ? "—" : money(grossPrice)}</td>
                          <td>{netSoldPrice == null ? "—" : money(netSoldPrice)}</td>
                          <td>{netCost == null ? "—" : money(netCost)}</td>
                          <td style={{fontWeight:750,color:productCostPercent != null && productCostPercent > 100 ? "#b42318" : "#344054"}}>{productCostPercent == null ? "—" : `${productCostPercent.toFixed(1)}%`}</td>
                        </tr>
                      })}
                      <tr><td style={{textAlign:"left",fontWeight:800}}>Total</td><td style={{fontWeight:800}}>{money(deal.discountableTotal)}</td><td style={{fontWeight:800}}>{money(deal.discountableTotal * (1 - (deal.discountableTotal >= 12000 ? 0.30 : 0.25)))}</td><td>{deal.surveyCosting == null ? "—" : `${deal.surveyCosting.toFixed(1)}%`}</td><td style={{fontWeight:800}}>{money(Math.abs(deal.discountableTotal * (1 - (deal.discountableTotal >= 12000 ? 0.30 : 0.25)) * (deal.surveyCosting ?? 0) / 100))}</td><td style={{fontWeight:800}}>{money(Math.abs(deal.discountableTotal * (1 - (deal.discountableTotal >= 12000 ? 0.30 : 0.25)) * (deal.surveyCosting ?? 0) / 100) / 1.2)}</td><td style={{fontWeight:800}}>{money(deal.unitSpend)}</td><td>—</td></tr>
                    </tbody></table>
                  </td></tr>}
                </React.Fragment>)
            }
          </tbody>
        </table>
      </div>
      <div className="unit-analysis-footnote">Includes ordered units from this page's current scope (unit_type = Window, department = SURVEY) where net_product_cost is positive and an appointment_id matches deals.appointment_row_id. COS is recorded unit net cost plus £200 per unit; COS% = COS ÷ deal net value × 100. Only jobs with positive net value and COS% strictly above 50% are shown. “Net value less units” is a comparison only; it is not gross profit because it excludes other job costs.</div>
    </section>

    {lastUpdated && <div style={{fontSize:10,color:"#98a2b3",marginTop:10,textAlign:"right"}}>Last refreshed {lastUpdated.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</div>}
  </div>
}

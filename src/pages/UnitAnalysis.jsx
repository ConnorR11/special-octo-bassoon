import React, { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw, Search, ChevronDown, ChevronRight, Boxes } from "lucide-react"
import { supabase } from "../lib/supabase"

const PAGE_SIZE = 1000
const money = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }) : "—"
const dimension = value => Number(value).toLocaleString("en-GB", { maximumFractionDigits: 1 })
const text = value => String(value ?? "").trim()
const normaliseType = value => text(value) || "Unspecified type"
const normaliseStyle = value => text(value) || "Unspecified style"

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

function buildGroups(rows) {
  const validRows = rows.map(row => ({
    ...row,
    width: Number(row.width),
    height: Number(row.height),
    cost: row.discountable == null || row.discountable === "" ? null : Number(row.discountable),
    netCost: row.net_product_cost == null || row.net_product_cost === "" ? null : Number(row.net_product_cost),
    ordered: Boolean(row.ordered_date),
    style: normaliseStyle(row.style_choice)
  })).filter(row => Number.isFinite(row.width) && row.width > 0 && Number.isFinite(row.height) && row.height > 0)
  const byStyle = new Map()
  validRows.forEach(row => {
    if (!byStyle.has(row.style)) byStyle.set(row.style, [])
    byStyle.get(row.style).push(row)
  })
  const groups = []
  for (const [style, styleRows] of byStyle) {
    const netCosted = styleRows.filter(row => row.netCost !== null && Number.isFinite(row.netCost))
    const costed = netCosted.filter(row => row.cost !== null && Number.isFinite(row.cost))
    const ordered = styleRows.filter(row => row.ordered)
    const orderedCosted = ordered.filter(row => row.netCost !== null && Number.isFinite(row.netCost) && row.cost !== null && Number.isFinite(row.cost))
    const orderedNetCosted = ordered.filter(row => row.netCost !== null && Number.isFinite(row.netCost))
    styleRows.sort((a, b) => a.width - b.width || a.height - b.height || String(a.UUID).localeCompare(String(b.UUID)))
    groups.push({
      key: style, style, rows: styleRows,
      costedCount: costed.length, orderedCount: ordered.length,
      averageCosted: costed.length ? costed.reduce((sum, row) => sum + row.cost, 0) / costed.length : null,
      averageNetCost: netCosted.length ? netCosted.reduce((sum, row) => sum + row.netCost, 0) / netCosted.length : null,
      averageOrdered: orderedCosted.length ? orderedCosted.reduce((sum, row) => sum + row.cost, 0) / orderedCosted.length : null,
      averageOrderedNetCost: orderedNetCosted.length ? orderedNetCosted.reduce((sum, row) => sum + row.netCost, 0) / orderedNetCosted.length : null,
      totalCosted: costed.reduce((sum, row) => sum + row.cost, 0)
    })
  }
  return groups.sort((a, b) => a.style.localeCompare(b.style))
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
  const [orderedFilter, setOrderedFilter] = useState("all")
  const [expanded, setExpanded] = useState({})
  const [configurationExpanded, setConfigurationExpanded] = useState({})
  const [sizeExpanded, setSizeExpanded] = useState({})
  const [lastUpdated, setLastUpdated] = useState(null)

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
          .select('"UUID", appointment_id, location, created_by, created_date, unit_type, style_choice, openers_choice, fixed_choice, width, height, discountable, net_product_cost, ordered_date, contract_number, department, supplier, added_to_supabase_date')
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

  const groups = useMemo(() => buildGroups(rows), [rows])
  const styleOptions = useMemo(() => [...new Set(groups.map(group => group.style))].sort((a, b) => a.localeCompare(b)), [groups])
  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase()
    return groups.filter(group => {
      if (styleFilter !== "all" && group.style !== styleFilter) return false
      if (orderedFilter === "ordered" && group.orderedCount === 0) return false
      if (orderedFilter === "not-ordered" && group.orderedCount > 0) return false
      if (term && ![group.style, ...group.rows.map(row => String(row.contract_number || "") + " " + String(row.unit_type || "") + " " + row.width + " " + row.height)].some(value => String(value ?? "").toLowerCase().includes(term))) return false
      return true
    })
  }, [groups, search, styleFilter, orderedFilter])

  const totalCosted = rows.filter(row => row.net_product_cost != null && row.net_product_cost !== "" && Number.isFinite(Number(row.net_product_cost)))
  const totalNetCosted = rows.filter(row => row.net_product_cost != null && row.net_product_cost !== "" && Number.isFinite(Number(row.net_product_cost)))
  const totalOrdered = rows.filter(row => Boolean(row.ordered_date))
  const orderedCosted = totalOrdered.filter(row => row.discountable != null && row.discountable !== "" && Number.isFinite(Number(row.discountable)))
  const orderedNetCosted = totalOrdered.filter(row => row.net_product_cost != null && row.net_product_cost !== "" && Number.isFinite(Number(row.net_product_cost)))
  const totalDiscCosted = totalCosted.filter(row => row.discountable != null && row.discountable !== "" && Number.isFinite(Number(row.discountable)))
  const overallAverage = totalDiscCosted.length ? totalDiscCosted.reduce((sum, row) => sum + Number(row.discountable), 0) / totalDiscCosted.length : null
  const overallAverageNet = totalNetCosted.length ? totalNetCosted.reduce((sum, row) => sum + Number(row.net_product_cost), 0) / totalNetCosted.length : null
  const orderedAverage = orderedCosted.length ? orderedCosted.reduce((sum, row) => sum + Number(row.discountable), 0) / orderedCosted.length : null
  const orderedAverageNet = orderedNetCosted.length ? orderedNetCosted.reduce((sum, row) => sum + Number(row.net_product_cost), 0) / orderedNetCosted.length : null


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
      <div><div className="unit-analysis-eyebrow">Administration</div><h1>Unit Analysis</h1><p className="unit-analysis-subtitle">Compare costed and ordered units grouped by style. Expand a style to see combined opener/fixed and approximate-size totals, then expand a row to see its individual units.</p></div>
      <button className="unit-analysis-refresh" type="button" onClick={loadUnits} disabled={loading}><RefreshCw size={14}/>{loading ? "Loading…" : "Refresh"}</button>
    </div>
    {error && <div className="unit-analysis-error">{error}</div>}
    <div className="unit-analysis-stats">
      <StatCard label="Units costed" value={totalCosted.length.toLocaleString("en-GB")} note="Units with a recorded net product cost"/>
      <StatCard label="Units ordered" value={totalOrdered.length.toLocaleString("en-GB")} note="Units with an order date"/>
      <StatCard label="Average Disc Total" value={overallAverage == null ? "—" : money(overallAverage)} note="Costed units with a recorded discountable total"/>
      <StatCard label="Average Net Cost" value={overallAverageNet == null ? "—" : money(overallAverageNet)} note="Units with a recorded net product cost"/>
    </div>
    <section className="unit-analysis-panel">
      <div className="unit-analysis-toolbar">
        <div><div className="unit-analysis-toolbar-title">Breakdown by style</div><div className="unit-analysis-toolbar-subtitle">Each row combines the opener/fixed configuration with a width and height group within 50 mm. Expand a row to see the individual windows.</div></div>
        <div className="unit-analysis-filters">
          <label className="unit-analysis-search"><Search size={14} color="#667085"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search type, size or contract"/></label>
          <select className="unit-analysis-select" value={styleFilter} onChange={event => setStyleFilter(event.target.value)} aria-label="Filter by style"><option value="all">All styles</option>{styleOptions.map(style => <option key={style} value={style}>{style}</option>)}</select>
          <select className="unit-analysis-select" value={orderedFilter} onChange={event => setOrderedFilter(event.target.value)} aria-label="Filter by order status"><option value="all">All order statuses</option><option value="ordered">Ordered only</option><option value="not-ordered">Not ordered</option></select>
        </div>
      </div>
      <div className="unit-analysis-count">{loading ? "Loading units…" : `Showing ${filteredGroups.length.toLocaleString("en-GB")} styles · ${rows.length.toLocaleString("en-GB")} units loaded`}</div>
      <div className="unit-analysis-table-wrap">
        <table className="unit-analysis-table">
          <thead><tr><th style={{textAlign:"left"}}>Style</th><th>Units costed</th><th>Units ordered</th><th>Avg. Disc Total</th><th>Avg. Net Cost</th><th>Total Disc Total</th></tr></thead>
          <tbody>
            {loading && rows.length === 0 ? <tr><td colSpan="6" className="unit-analysis-empty">Loading unit records…</td></tr> :
              filteredGroups.length === 0 ? <tr><td colSpan="6" className="unit-analysis-empty">{error ? "Unit data could not be loaded." : "No units match these filters."}</td></tr> :
              filteredGroups.map(group => <React.Fragment key={group.key}>
                <tr className="unit-analysis-group-row" onClick={() => setExpanded(current => ({...current,[group.key]:!current[group.key]}))}>
                  <td style={{textAlign:"left"}}><div style={{display:"flex",alignItems:"center",gap:8}}>{expanded[group.key] ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}<div><div className="unit-analysis-type">{group.style}</div><div className="unit-analysis-muted">{new Set(group.rows.map(row => normaliseType(row.unit_type))).size} unit types · {group.rows.length} total units</div></div></div></td>
                  <td>{group.costedCount.toLocaleString("en-GB")}</td><td>{group.orderedCount.toLocaleString("en-GB")}</td><td>{group.averageCosted == null ? "—" : money(group.averageCosted)}</td><td>{group.averageNetCost == null ? "—" : money(group.averageNetCost)}</td><td>{money(group.totalCosted)}</td>
                </tr>
                {expanded[group.key] && <tr className="unit-analysis-detail"><td colSpan="6" style={{padding:0}}>
                  <table className="unit-analysis-table" style={{minWidth:900}}><thead className="unit-analysis-detail-head"><tr><th style={{textAlign:"left"}}>Configuration · approximate size (W × H)</th><th>Units costed</th><th>Units ordered</th><th>Avg. Disc Total</th><th>Avg. Net Cost</th><th>Total Disc Total</th></tr></thead><tbody>
                    {buildConfigurationGroups(group.rows).flatMap(configuration => buildSizeGroups(configuration.rows).map(sizeGroup => {
                      const sizeNetCosted = sizeGroup.rows.filter(row => row.netCost != null && Number.isFinite(row.netCost))
                      const sizeCosted = sizeNetCosted.filter(row => row.cost != null && Number.isFinite(row.cost))
                      const sizeOrdered = sizeGroup.rows.filter(row => row.ordered)
                      const sizeKey = `${group.key}::${configuration.key}::${sizeGroup.key}`
                      const rangeLabel = (min, max) => min === max ? `${dimension(min)} mm` : `${dimension(min)}–${dimension(max)} mm`
                      return {configuration, sizeGroup, sizeNetCosted, sizeCosted, sizeOrdered, sizeKey, rangeLabel}
                    })).map(({configuration,sizeGroup,sizeNetCosted,sizeCosted,sizeOrdered,sizeKey,rangeLabel}) => <React.Fragment key={sizeKey}>
                      <tr className="unit-analysis-group-row" style={{background:"#eef2f6"}} onClick={() => setSizeExpanded(current => ({...current,[sizeKey]:!current[sizeKey]}))}>
                        <td style={{textAlign:"left"}}><div style={{display:"flex",alignItems:"center",gap:8}}>{sizeExpanded[sizeKey] ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}<div><div className="unit-analysis-type">{configuration.openers} openers · {configuration.fixed} fixed</div><div className="unit-analysis-muted">{rangeLabel(sizeGroup.minWidth,sizeGroup.maxWidth)} × {rangeLabel(sizeGroup.minHeight,sizeGroup.maxHeight)} · {sizeGroup.rows.length.toLocaleString("en-GB")} units</div></div></div></td>
                        <td>{sizeCosted.length.toLocaleString("en-GB")}</td><td>{sizeOrdered.length.toLocaleString("en-GB")}</td><td>{sizeCosted.length ? money(sizeCosted.reduce((sum,row) => sum + row.cost,0) / sizeCosted.length) : "—"}</td><td>{sizeNetCosted.length ? money(sizeNetCosted.reduce((sum,row) => sum + row.netCost,0) / sizeNetCosted.length) : "—"}</td><td>{money(sizeCosted.reduce((sum,row) => sum + row.cost,0))}</td>
                      </tr>
                      {sizeExpanded[sizeKey] && <tr className="unit-analysis-detail"><td colSpan="6" style={{padding:0}}>
                        <table className="unit-analysis-table" style={{minWidth:750}}><thead className="unit-analysis-detail-head"><tr><th style={{textAlign:"left"}}>Unit / contract</th><th>Width</th><th>Height</th><th>Disc Total</th><th>Net Cost</th><th>Order status</th><th>Supplier</th><th>Created</th></tr></thead><tbody>
                          {sizeGroup.rows.map((row,index) => <tr key={row.UUID || `${sizeKey}-${index}`}><td style={{textAlign:"left"}}>{text(row.contract_number) || text(row.UUID) || "Unit"}<div className="unit-analysis-muted">{text(row.location) || text(row.appointment_id) || "—"}</div></td><td>{dimension(row.width)} mm</td><td>{dimension(row.height)} mm</td><td>{row.cost == null || !Number.isFinite(row.cost) ? "—" : money(row.cost)}</td><td>{row.netCost == null || !Number.isFinite(row.netCost) ? "—" : money(row.netCost)}</td><td>{row.ordered ? <span className="unit-analysis-pill">Ordered</span> : "Not ordered"}</td><td>{text(row.supplier) || "—"}</td><td>{row.added_to_supabase_date || row.created_date ? new Date(row.added_to_supabase_date || row.created_date).toLocaleDateString("en-GB") : "—"}</td></tr>)}
                        </tbody></table>
                      </td></tr>}
                    </React.Fragment>)}
                  </tbody></table>
                </td></tr>}
              </React.Fragment>)
            }
          </tbody>
        </table>
      </div>
      <div className="unit-analysis-footnote">Only records where unit_type is “Window” and department is “SURVEY” are included. Windows are grouped by style_choice, then by openers_choice and fixed_choice, then by width and height clustered within 50 mm of each size group’s anchor dimensions; blank opener/fixed values appear as “Unspecified”. Average Disc Total includes only costed units with a numeric discountable value; Average Net Cost includes units with a numeric net_product_cost. “Ordered” is determined by a populated ordered_date.</div>
    </section>
    {lastUpdated && <div style={{fontSize:10,color:"#98a2b3",marginTop:10,textAlign:"right"}}>Last refreshed {lastUpdated.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</div>}
  </div>
}

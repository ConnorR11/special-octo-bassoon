import React, { useEffect, useMemo, useState } from "react"
import { CalendarDays, Download, Filter, ChevronDown } from "lucide-react"
import { supabase } from "../lib/supabase"

function londonToday() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function startOfWeek(value) {
  const date = new Date(`${value}T12:00:00`)
  const day = date.getDay()
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0
  const parsed = Number(String(value).replace(/£/g, "").replace(/,/g, "").replace(/%/g, "").trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(toNumber(value))
}

function formatPercent(value) {
  return `${toNumber(value).toFixed(1)}%`
}

function csvEscape(value) {
  const text = String(value ?? "")
  return /[",\\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const PRODUCT_TYPES = [
  "Windows",
  "Solar",
  "Air Source Heat Pump",
  "ASHP",
  "Boiler",
  "ECO4",
  "Garden Room",
  "Garden Rooms",
  "Roofline",
  "Roughcast",
  "Roughcasting",
]

function lastWeekRange() {
  const start = new Date(`${startOfWeek(londonToday())}T12:00:00`)
  start.setDate(start.getDate() - 7)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const format = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  return { start: format(start), end: format(end) }
}

export default function CanvasserKPI() {
  const [startDate, setStartDate] = useState(() => lastWeekRange().start)
  const [endDate, setEndDate] = useState(() => lastWeekRange().end)
  const [allRows, setAllRows] = useState([])
  const [totals, setTotals] = useState({ h: 0, c: 0, p: 0, s: 0, net: 0, hToP: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)
  const [canvasserFilter, setCanvasserFilter] = useState("all")
  const [productFilter, setProductFilter] = useState("all")
  const [leadSourceGroup, setLeadSourceGroup] = useState("all")

  async function loadData() {
    if (!supabase) {
      setError("Supabase is not configured. Check your environment variables.")
      setLoading(false)
      return
    }
    if (!startDate || !endDate) return
    if (startDate > endDate) {
      setError("Start date must be before or equal to the end date.")
      setAllRows([])
      setTotals({ h: 0, c: 0, p: 0, s: 0, net: 0, hToP: 0 })
      setLoading(false)
      return
    }

    setLoading(true)
    setError("")
    try {
      const { data, error: rpcError } = await supabase.rpc("get_canvasser_results", {
        p_start_date: startDate,
        p_end_date: endDate,
        p_canvasser: null,
        p_job_type: productFilter === "all" ? null : productFilter,
        p_lead_source_group: leadSourceGroup === "all" ? null : leadSourceGroup,
      })
      if (rpcError) throw rpcError

      const resultRows = (data || []).map((row) => ({
        name: String(row.name || "Unassigned"),
        h: toNumber(row.h),
        c: toNumber(row.c),
        p: toNumber(row.p),
        s: toNumber(row.s),
        net: toNumber(row.net),
        hToP: toNumber(row.h_to_p),
        isTotal: row.is_total === true,
      }))
      const totalRow = resultRows.find((row) => row.isTotal)
      setTotals(totalRow || { h: 0, c: 0, p: 0, s: 0, net: 0, hToP: 0 })
      setAllRows(resultRows.filter((row) => !row.isTotal))
    } catch (err) {
      console.error("Error loading canvasser KPI data:", err)
      setError(err?.message || "Unable to load canvasser KPI data.")
      setAllRows([])
      setTotals({ h: 0, c: 0, p: 0, s: 0, net: 0, hToP: 0 })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [startDate, endDate, productFilter, leadSourceGroup])

  const rows = useMemo(
    () => canvasserFilter === "all" ? allRows : allRows.filter((row) => row.name === canvasserFilter),
    [allRows, canvasserFilter]
  )

  const visibleTotals = useMemo(() => {
    if (canvasserFilter === "all") return totals
    const stats = rows.reduce((total, row) => ({
      h: total.h + row.h,
      c: total.c + row.c,
      p: total.p + row.p,
      s: total.s + row.s,
      net: total.net + row.net,
    }), { h: 0, c: 0, p: 0, s: 0, net: 0 })
    return { ...stats, hToP: stats.h > 0 ? stats.p / stats.h * 100 : 0 }
  }, [rows, totals, canvasserFilter])

  function downloadCsv() {
    const header = ["Name", "H", "C", "P", "S", "NET", "H TO P"]
    const total = ["Total", visibleTotals.h, visibleTotals.c, visibleTotals.p, visibleTotals.s, toNumber(visibleTotals.net).toFixed(2), formatPercent(visibleTotals.hToP)]
    const data = rows.map((row) => [row.name, row.h, row.c, row.p, row.s, toNumber(row.net).toFixed(2), formatPercent(row.hToP)])
    // Use real CRLF row separators (not the literal characters "\\n") so Excel
    // opens each canvasser on its own row and keeps the seven fields aligned.
    const csv = "\uFEFF" + [header, total, ...data].map((line) => line.map(csvEscape).join(",")).join("\r\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    const productSuffix = productFilter !== "all" ? `-${productFilter.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : ""
    const sourceSuffix = leadSourceGroup !== "all" ? `-${leadSourceGroup}` : ""
    const canvasserSuffix = canvasserFilter !== "all" ? `- ${canvasserFilter.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : ""
    link.download = `canvasser-results-${startDate}-to-${endDate}${productSuffix}${sourceSuffix}${canvasserSuffix}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const hasActiveFilters = canvasserFilter !== "all" || productFilter !== "all" || leadSourceGroup !== "all"

  return <section className="canvasser-kpi-page">
    <style>{`
      .canvasser-kpi-page{margin:-24px;min-height:calc(100vh - 90px);padding:10px 14px 24px;background:#fff;color:#111;font-family:Inter,Arial,sans-serif}
      .ckpi-card{background:#fff;border:1px solid #e5e7eb;border-radius:9px;overflow:visible}
      .ckpi-hero{min-height:126px;padding:18px 54px;display:grid;grid-template-columns:1fr 460px;align-items:center;gap:35px}
      .ckpi-title{font-size:47px;line-height:1;font-weight:700;letter-spacing:-1.8px;margin:0}
      .ckpi-date-grid{display:grid;gap:12px}
      .ckpi-date-field label{display:block;font-size:11px;font-weight:700;margin:0 0 7px;color:#111}
      .ckpi-date-wrap{position:relative}
      .ckpi-date-icon{position:absolute;left:10px;top:9px;color:#666;pointer-events:none}
      .ckpi-date-input{height:34px;width:100%;box-sizing:border-box;border:0;border-radius:7px;background:#eee;color:#333;padding:0 11px 0 34px;font:12px Inter,Arial,sans-serif;outline:none}
      .ckpi-date-input:focus{box-shadow:0 0 0 2px rgba(45,155,240,.18)}
      .ckpi-results{margin-top:20px;padding:13px 27px 19px;overflow:visible}
      .ckpi-toolbar{height:42px;display:flex;justify-content:flex-end;align-items:center;gap:8px}
      .ckpi-download,.ckpi-filter-button{display:inline-flex;align-items:center;gap:7px;border:0;border-radius:7px;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer}
      .ckpi-download{background:#0789e8;color:#fff}.ckpi-download:hover{background:#087ed3}.ckpi-download:disabled{opacity:.55;cursor:default}
      .ckpi-filter-wrap{position:relative}.ckpi-filter-button{background:#f0f0f0;color:#777;min-width:114px;justify-content:center}.ckpi-filter-button.active{color:#087ed3;background:#eaf5ff}.ckpi-filter-button:hover{background:#e8e8e8}
      .ckpi-filter-menu{position:absolute;right:0;top:42px;z-index:20;width:245px;padding:14px;background:#fff;border:1px solid #e0e4e8;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12)}
      .ckpi-filter-menu label{display:block;font-size:10px;font-weight:700;color:#667085;margin:0 0 6px}.ckpi-filter-menu select{width:100%;height:36px;border:1px solid #dfe3e8;border-radius:6px;background:#fff;padding:0 8px;font-size:12px;outline:none;margin-bottom:12px}.ckpi-filter-menu select:last-of-type{margin-bottom:0}
      .ckpi-source-list{max-height:190px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:6px;padding:5px;margin:0 0 12px}.ckpi-source-option{display:flex!important;align-items:center;gap:8px;padding:6px 5px;margin:0!important;font-size:12px!important;font-weight:500!important;color:#344054!important;cursor:pointer}.ckpi-source-option input{margin:0;accent-color:#0789e8}.ckpi-source-empty{padding:8px;color:#98a2b3;font-size:11px}.ckpi-filter-actions{display:flex;justify-content:space-between;align-items:center;margin-top:12px;gap:8px}.ckpi-filter-clear{border:0;background:transparent;color:#087ed3;font-size:11px;font-weight:700;cursor:pointer;padding:5px 0}
      .ckpi-table{overflow:hidden;border-radius:2px}.ckpi-table-head,.ckpi-table-total,.ckpi-table-row{display:grid;grid-template-columns:minmax(300px,1fr) 65px 65px 65px 65px 120px 100px;align-items:center}
      .ckpi-table-head{min-height:31px;font-size:8px;color:#555;font-weight:700}.ckpi-table-head>div:not(:first-child){text-align:center}
      .ckpi-table-total{min-height:38px;background:#002d49;color:#fff;font-size:12px;font-weight:700}.ckpi-table-total>div{padding:0 7px}.ckpi-table-total>div:not(:first-child){text-align:center}
      .ckpi-table-row{min-height:38px;font-size:12px}.ckpi-table-row:nth-child(odd){background:#f7f7f7}.ckpi-table-row:nth-child(even){background:#fff}.ckpi-table-row>div{padding:0 7px;min-width:0}.ckpi-table-row>div:not(:first-child){text-align:center}
      .ckpi-name{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ckpi-empty,.ckpi-loading{text-align:center;color:#8a8f98;font-size:12px;background:#fafafa;padding:34px 10px}.ckpi-error{margin:8px 0;padding:9px 12px;border-radius:6px;background:#fff2f2;color:#b42318;font-size:11px}
      @media(max-width:850px){.ckpi-hero{grid-template-columns:1fr;padding:20px 24px}.ckpi-title{font-size:36px}.ckpi-table-head,.ckpi-table-total,.ckpi-table-row{grid-template-columns:minmax(180px,1fr) 48px 48px 48px 48px 90px 75px}.ckpi-results{padding:10px 12px 16px}}
      @media(max-width:600px){.ckpi-title{font-size:31px}.ckpi-results{overflow-x:auto}.ckpi-table-head,.ckpi-table-total,.ckpi-table-row{min-width:650px}.ckpi-hero{padding:18px}.ckpi-results{padding:10px}.ckpi-toolbar{justify-content:flex-end}}
    `}</style>

    <div className="ckpi-card">
      <div className="ckpi-hero">
        <h1 className="ckpi-title">Canvasser Results</h1>
        <div className="ckpi-date-grid">
          <div className="ckpi-date-field"><label htmlFor="canvasser-start-date">Start Date</label><div className="ckpi-date-wrap"><CalendarDays className="ckpi-date-icon" size={15} /><input id="canvasser-start-date" className="ckpi-date-input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div></div>
          <div className="ckpi-date-field"><label htmlFor="canvasser-end-date">End Date</label><div className="ckpi-date-wrap"><CalendarDays className="ckpi-date-icon" size={15} /><input id="canvasser-end-date" className="ckpi-date-input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div></div>
        </div>
      </div>
    </div>

    <div className="ckpi-card ckpi-results">
      <div className="ckpi-toolbar">
        <div className="ckpi-filter-wrap">
          <button type="button" className={`ckpi-filter-button ${hasActiveFilters ? "active" : ""}`} onClick={() => setFilterOpen((value) => !value)}><Filter size={13} /> Filter {hasActiveFilters ? "•" : ""} <ChevronDown size={13} /></button>
          {filterOpen && <div className="ckpi-filter-menu">
            <label htmlFor="canvasser-product-filter">Product type</label>
            <select id="canvasser-product-filter" value={productFilter} onChange={(event) => setProductFilter(event.target.value)}>
              <option value="all">All product types</option>
              {PRODUCT_TYPES.map((product) => <option key={product} value={product}>{product}</option>)}
            </select>
            <label htmlFor="canvasser-lead-source-filter">Lead source</label>
            <select id="canvasser-lead-source-filter" value={leadSourceGroup} onChange={(event) => setLeadSourceGroup(event.target.value)}>
              <option value="all">All lead sources</option>
              <option value="core">Core</option>
              <option value="hotkeys">Hotkeys</option>
            </select>
            <label htmlFor="canvasser-filter">Canvasser</label>
            <select id="canvasser-filter" value={canvasserFilter} onChange={(event) => setCanvasserFilter(event.target.value)}>
              <option value="all">All Canvassers</option>
              {allRows.map((row) => <option key={row.name} value={row.name}>{row.name}</option>)}
            </select>
            <div className="ckpi-filter-actions"><button type="button" className="ckpi-filter-clear" onClick={() => { setProductFilter("all"); setCanvasserFilter("all"); setLeadSourceGroup("all") }}>Clear filters</button><button type="button" className="ckpi-filter-clear" onClick={() => setFilterOpen(false)}>Done</button></div>
          </div>}
        </div>
        <button type="button" className="ckpi-download" onClick={downloadCsv} disabled={loading || !rows.length}><Download size={15} /> Download</button>
      </div>
      {error && <div className="ckpi-error">{error}</div>}
      <div className="ckpi-table">
        <div className="ckpi-table-head"><div>NAME</div><div>H</div><div>C</div><div>P</div><div>S</div><div>NET</div><div>H TO P</div></div>
        <div className="ckpi-table-total"><div>Total</div><div>{visibleTotals.h}</div><div>{visibleTotals.c}</div><div>{visibleTotals.p}</div><div>{visibleTotals.s}</div><div>{formatCurrency(visibleTotals.net)}</div><div>{formatPercent(visibleTotals.hToP)}</div></div>
        {loading ? <div className="ckpi-loading">Loading canvasser results…</div> : rows.length ? rows.map((row) => <div className="ckpi-table-row" key={row.name}><div className="ckpi-name">{row.name}</div><div>{row.h}</div><div>{row.c}</div><div>{row.p}</div><div>{row.s}</div><div>{formatCurrency(row.net)}</div><div>{formatPercent(row.hToP)}</div></div>) : <div className="ckpi-empty">No canvasser results found for the selected dates.</div>}
      </div>
    </div>
  </section>
}

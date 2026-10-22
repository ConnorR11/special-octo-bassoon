import React, { useMemo, useState } from "react"
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts"
import { CalendarDays, RefreshCw, TrendingUp } from "lucide-react"
import { STAGE_GROUPS, getStageGroup } from "../lib/stageGroups"

function parseLocalDate(value) {
  if (!value) return null
  const date = new Date(String(value).slice(0, 10) + "T00:00:00")
  return Number.isNaN(date.getTime()) ? null : date
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function startOfWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7))
  return result
}

function getBucket(date, grouping) {
  const year = date.getFullYear()
  if (grouping === "year") return { key: String(year), label: String(year), start: new Date(year, 0, 1) }
  if (grouping === "quarter") {
    const quarter = Math.floor(date.getMonth() / 3) + 1
    return { key: `${year}-Q${quarter}`, label: `Q${quarter} ${year}`, start: new Date(year, (quarter - 1) * 3, 1) }
  }
  if (grouping === "week") {
    const start = startOfWeek(date)
    const jan1 = new Date(start.getFullYear(), 0, 1)
    const week = Math.floor((start - startOfWeek(jan1)) / 604800000) + 1
    return { key: dateKey(start), label: `W${String(week).padStart(2, "0")} ${start.getFullYear()}`, hoverLabel: `Week commencing ${start.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`, start }
  }
  return { key: `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`, label: date.toLocaleDateString("en-GB", { month: "short", year: "numeric" }), start: new Date(year, date.getMonth(), 1) }
}

function makeBuckets(dates, grouping) {
  if (!dates.length) return []
  const valid = dates.filter(Boolean).sort((a, b) => a - b)
  if (!valid.length) return []
  const first = getBucket(valid[0], grouping).start
  const last = getBucket(valid[valid.length - 1], grouping).start
  const rows = []
  const cursor = new Date(first)
  while (cursor <= last) {
    const bucket = getBucket(cursor, grouping)
    rows.push({ key: bucket.key, period: bucket.label, hoverLabel: bucket.hoverLabel || bucket.label, start: bucket.start.getTime() })
    if (grouping === "year") cursor.setFullYear(cursor.getFullYear() + 1)
    else if (grouping === "quarter") cursor.setMonth(cursor.getMonth() + 3, 1)
    else if (grouping === "week") cursor.setDate(cursor.getDate() + 7)
    else cursor.setMonth(cursor.getMonth() + 1, 1)
  }
  return rows
}

const SERIES_COLORS = ["#1683c7", "#f59e0b", "#7c3aed", "#10b981", "#ef4444", "#64748b", "#db2777", "#84cc16", "#0d9488", "#a16207"]
const STAGE_COLORS = ["#1683c7", "#f59e0b", "#7c3aed", "#10b981", "#ef4444", "#64748b", "#db2777", "#0d9488", "#a16207", "#84cc16"]

function productLabel(deal) {
  const value = String(deal.product || "").trim()
  if (!value) return "Other"
  const normalized = value.toLowerCase()
  if (normalized.includes("window") || normalized.includes("door")) return "Windows"
  if (normalized.includes("solar") || normalized.includes("pv")) return "Solar"
  if (normalized.includes("ashp") || normalized.includes("air source") || normalized.includes("heat pump")) return "ASHP"
  return "Other"
}

export default function InstallationsPerformance({ deals = [], loading = false, onRefresh }) {
  const [grouping, setGrouping] = useState("month")
  const [yearFilter, setYearFilter] = useState("all")
  const [productFilter, setProductFilter] = useState("all")
  const [metric, setMetric] = useState("count")
  const datedDeals = useMemo(() => (Array.isArray(deals) ? deals : []).map(deal => ({ ...deal, parsedInstallationDate: parseLocalDate(deal.installation_start_date) })).filter(deal => deal.parsedInstallationDate), [deals])
  const years = useMemo(() => [...new Set(datedDeals.map(deal => String(deal.parsedInstallationDate.getFullYear())))].sort((a, b) => Number(b) - Number(a)), [datedDeals])
  const products = useMemo(() => [...new Set(datedDeals.map(productLabel))].sort((a, b) => {
    if (a.toLowerCase().includes("window")) return b.toLowerCase().includes("window") ? a.localeCompare(b) : -1
    if (b.toLowerCase().includes("window")) return 1
    return a.localeCompare(b)
  }), [datedDeals])
  const filteredDeals = useMemo(() => datedDeals.filter(deal => {
    const matchesYear = yearFilter === "all" || String(deal.parsedInstallationDate.getFullYear()) === yearFilter
    const matchesProduct = productFilter === "all" || productLabel(deal) === productFilter
    return matchesYear && matchesProduct
  }), [datedDeals, yearFilter, productFilter])
  const chartData = useMemo(() => {
    if (grouping === "ytd") {
      const yesterday = new Date()
      yesterday.setHours(0, 0, 0, 0)
      yesterday.setDate(yesterday.getDate() - 1)
      const cutoffMonth = yesterday.getMonth()
      const cutoffDay = yesterday.getDate()
      const allYears = [...new Set(datedDeals.map(deal => deal.parsedInstallationDate.getFullYear()))].sort((a, b) => a - b)
      return allYears
        .filter(year => yearFilter === "all" || String(year) === yearFilter)
        .map(year => {
          const cutoff = new Date(year, cutoffMonth, cutoffDay)
          const row = { key: String(year), period: String(year), hoverLabel: `1 Jan – ${cutoff.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${year}`, start: new Date(year, 0, 1).getTime() }
          datedDeals.forEach(deal => {
            const date = deal.parsedInstallationDate
            if (date.getFullYear() !== year || date > cutoff || date.getMonth() > cutoffMonth || (date.getMonth() === cutoffMonth && date.getDate() > cutoffDay)) return
            if (productFilter !== "all" && productLabel(deal) !== productFilter) return
            const product = productLabel(deal)
            row[product] = (row[product] || 0) + (metric === "value" ? (Number(deal.net_value) || 0) : 1)
          })
          return row
        })
    }
    const rows = makeBuckets(filteredDeals.map(deal => deal.parsedInstallationDate), grouping)
    const rowMap = new Map(rows.map(row => [row.key, row]))
    filteredDeals.forEach(deal => {
      const bucket = getBucket(deal.parsedInstallationDate, grouping)
      const row = rowMap.get(bucket.key)
      if (row) {
        const product = productLabel(deal)
        row[product] = (row[product] || 0) + (metric === "value" ? (Number(deal.net_value) || 0) : 1)
      }
    })
    return rows
  }, [datedDeals, filteredDeals, grouping, yearFilter, productFilter, metric])
  const todayKey = dateKey(new Date())
  const upcoming = datedDeals.filter(deal => dateKey(deal.parsedInstallationDate) >= todayKey).length
  const thisYear = datedDeals.filter(deal => deal.parsedInstallationDate.getFullYear() === new Date().getFullYear()).length
  const total = filteredDeals.length
  const leadTimeByYear = useMemo(() => {
    const byYear = new Map()
    const lineProducts = ["Windows", "Solar", "ASHP", "Other"]
    ;(Array.isArray(deals) ? deals : []).forEach(deal => {
      const soldDate = parseLocalDate(deal.sale_date)
      const fitDate = parseLocalDate(deal.installation_start_date)
      if (!soldDate || !fitDate || fitDate < soldDate) return
      const product = productLabel(deal)
      const year = fitDate.getFullYear()
      const days = Math.round((fitDate.getTime() - soldDate.getTime()) / 86400000)
      const key = String(year)
      const current = byYear.get(key) || { year: key, jobs: {}, totalDays: {} }
      current.jobs[product] = (current.jobs[product] || 0) + 1
      current.totalDays[product] = (current.totalDays[product] || 0) + days
      byYear.set(key, current)
    })
    return [...byYear.values()].sort((a, b) => Number(a.year) - Number(b.year)).map(row => {
      const result = { year: row.year }
      lineProducts.forEach(product => {
        const jobs = row.jobs[product] || 0
        result[product] = jobs ? Math.round((row.totalDays[product] / jobs) * 10) / 10 : null
        result[`${product}Jobs`] = jobs
      })
      return result
    })
  }, [deals])
  const [expandedBalanceGroups, setExpandedBalanceGroups] = useState({})
  const balanceByStage = useMemo(() => {
    const groups = new Map()
    ;(Array.isArray(deals) ? deals : []).forEach(deal => {
      const stage = String(deal.pipedrive_stage || "Unknown stage").trim() || "Unknown stage"
      const balance = Number(String(deal.balance_outstanding ?? 0).replace(/[^0-9.-]/g, "")) || 0
      if (balance <= 0 || ["customer cancelled", "decline"].includes(stage.toLowerCase())) return
      const group = getStageGroup(stage)
      const key = group.key
      const current = groups.get(key) || { key, stage: group.label, label: group.label, jobs: 0, balance: 0, color: group.text, stages: new Map() }
      current.jobs += 1
      current.balance += balance
      const stageEntry = current.stages.get(stage) || { stage, jobs: 0, balance: 0 }
      stageEntry.jobs += 1
      stageEntry.balance += balance
      current.stages.set(stage, stageEntry)
      groups.set(key, current)
    })
    return [...groups.values()].map(group => ({ ...group, stages: [...group.stages.values()].sort((a, b) => b.jobs - a.jobs) })).sort((a, b) => { const aIndex = a.key === "ungrouped" ? STAGE_GROUPS.length : STAGE_GROUPS.findIndex(group => group.key === a.key); const bIndex = b.key === "ungrouped" ? STAGE_GROUPS.length : STAGE_GROUPS.findIndex(group => group.key === b.key); return aIndex - bIndex })
  }, [deals])

  const cardStyle = { background: "#fff", border: "1px solid #e2e5e8", borderRadius: 12, padding: "18px 20px", minWidth: 0 }
  const selectStyle = { border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", padding: "8px 10px", fontSize: 12, color: "#17212b" }

  return <section>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <CalendarDays size={24} color="#2499ed" />
        <div><h1 style={{ margin: 0, fontSize: 22, color: "#222" }}>Installations Performance</h1><p style={{ margin: "5px 0 0", fontSize: 11, color: "#888" }}>Jobs grouped by installation start date</p></div>
      </div>
      {onRefresh && <button type="button" onClick={onRefresh} disabled={loading} style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 12px", border: "1px solid #dfe4e8", borderRadius: 7, background: "#fff", color: "#344454", cursor: loading ? "default" : "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}><RefreshCw size={14}/>Refresh data</button>}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 18 }}>
      <div style={cardStyle}><div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontSize: 11 }}><CalendarDays size={16}/> Jobs with start dates {yearFilter !== "all" ? `· ${yearFilter}` : "· all time"}</div><div style={{ marginTop: 10, fontSize: 30, fontWeight: 750, color: "#17212b" }}>{loading ? "—" : total.toLocaleString("en-GB")}</div></div>
      <div style={cardStyle}><div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontSize: 11 }}><TrendingUp size={16}/> Scheduled this year</div><div style={{ marginTop: 10, fontSize: 30, fontWeight: 750, color: "#17212b" }}>{loading ? "—" : thisYear.toLocaleString("en-GB")}</div></div>
      <div style={cardStyle}><div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontSize: 11 }}><CalendarDays size={16}/> Upcoming jobs</div><div style={{ marginTop: 10, fontSize: 30, fontWeight: 750, color: "#17212b" }}>{loading ? "—" : upcoming.toLocaleString("en-GB")}</div></div>
    </div>
    <div style={{ background: "#fff", border: "1px solid #e2e5e8", borderRadius: 12, padding: "20px 18px", marginBottom: 18, minWidth: 0, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12 }}><div><h2 style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "#17212b" }}>Outstanding balances by stage</h2><p style={{ margin: 0, fontSize: 11, color: "#818891" }}>Jobs with a balance outstanding above £0, excluding Customer Cancelled and Decline.</p></div><div style={{ textAlign: "right", padding: "8px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 9, flex: "0 0 auto" }}><div style={{ fontSize: 10, color: "#64748b", marginBottom: 3 }}>TOTAL OUTSTANDING</div><div style={{ fontSize: 19, fontWeight: 750, color: "#17212b" }}>{balanceByStage.reduce((sum, entry) => sum + entry.balance, 0).toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 })}</div></div></div>
      {loading ? <div style={{ padding: 32, textAlign: "center", color: "#818891", fontSize: 12 }}>Loading balance data…</div> : balanceByStage.length === 0 ? <div style={{ padding: 32, textAlign: "center", color: "#818891", fontSize: 12 }}>No outstanding balances found for the included stages.</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, alignItems: "center" }}>
        <ResponsiveContainer width="100%" height={280}><PieChart><Pie data={balanceByStage} dataKey="jobs" nameKey="stage" cx="50%" cy="50%" outerRadius={95} paddingAngle={2}>{balanceByStage.map((entry, index) => <Cell key={entry.stage} fill={entry.color}/>)}</Pie><Tooltip formatter={(value, name, props) => [Number(value).toLocaleString("en-GB") + " jobs · " + Number(props.payload.balance).toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }) + " outstanding", name]}/><Legend verticalAlign="bottom" height={44} wrapperStyle={{ fontSize: 11 }}/></PieChart></ResponsiveContainer>
        <div style={{ display: "grid", gap: 6 }}>{balanceByStage.map(entry => <div key={entry.key} style={{ borderBottom: "1px solid #eef1f3" }}><button type="button" onClick={() => setExpandedBalanceGroups(current => ({ ...current, [entry.key]: !current[entry.key] }))} aria-expanded={!!expandedBalanceGroups[entry.key]} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 2px", border: 0, background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: 12 }}><span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: entry.color, flex: "0 0 auto" }}/><span style={{ fontWeight: 700 }}>{expandedBalanceGroups[entry.key] ? "▾" : "▸"} {entry.label}</span></span><span style={{ textAlign: "right", whiteSpace: "nowrap", color: "#475569" }}><strong>{entry.jobs.toLocaleString("en-GB")} deals</strong><br/>{entry.balance.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 })}</span></button>{expandedBalanceGroups[entry.key] && <div style={{ padding: "0 0 8px 18px", display: "grid", gap: 2 }}>{entry.stages.map(stage => <div key={stage.stage} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "7px 8px", background: "#f8fafc", borderRadius: 6, fontSize: 11 }}><span style={{ color: "#475569" }}>{stage.stage}</span><span style={{ textAlign: "right", whiteSpace: "nowrap", color: "#475569" }}><strong>{stage.jobs.toLocaleString("en-GB")} deals</strong><br/>{stage.balance.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 })}</span></div>)}</div>}</div>)}</div>
      </div>}
    </div>
    <div style={{ background: "#fff", border: "1px solid #e2e5e8", borderRadius: 12, padding: "20px 18px 10px", minWidth: 0, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div><h2 style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "#17212b" }}>Jobs by installation start date</h2><p style={{ margin: 0, fontSize: 11, color: "#818891" }}>Compare installation job counts or net value, stacked by product. Year to date compares each year through the same date (yesterday).</p></div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12, color: "#475569" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 7 }}>Period<select value={grouping} onChange={event => setGrouping(event.target.value)} style={selectStyle}><option value="week">Week</option><option value="month">Month</option><option value="quarter">Quarter</option><option value="year">Year</option><option value="ytd">Year to date</option></select></label>
          <label style={{ display: "flex", alignItems: "center", gap: 7 }}>Year<select value={yearFilter} onChange={event => setYearFilter(event.target.value)} style={selectStyle}><option value="all">All time</option>{years.map(year => <option key={year} value={year}>{year}</option>)}</select></label>
          <label style={{ display: "flex", alignItems: "center", gap: 7 }}>Display<select value={metric} onChange={event => setMetric(event.target.value)} style={selectStyle}><option value="count">Job count</option><option value="value">Net value</option></select></label>
          <label style={{ display: "flex", alignItems: "center", gap: 7 }}>Product<select value={productFilter} onChange={event => setProductFilter(event.target.value)} style={selectStyle}><option value="all">All products</option>{products.map(product => <option key={product} value={product}>{product}</option>)}</select></label>
        </div>
      </div>
      {loading ? <div style={{ padding: 48, textAlign: "center", color: "#818891", fontSize: 12 }}>Loading installation data…</div> : chartData.length === 0 ? <div style={{ padding: 48, textAlign: "center", color: "#818891", fontSize: 12 }}>No jobs have an installation start date for this selection.</div> : <ResponsiveContainer width="100%" height={380}>
        <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 6 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb"/>
          <XAxis dataKey="period" interval="preserveStartEnd" minTickGap={24} axisLine={false} tickLine={false} tick={{ fill: "#8a8a8a", fontSize: 10 }}/>
          <YAxis allowDecimals={metric === "value"} tickFormatter={value => metric === "value" ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", notation: "compact", maximumFractionDigits: 1 }).format(value) : value} axisLine={false} tickLine={false} tick={{ fill: "#777", fontSize: 10 }} width={metric === "value" ? 64 : 42}/>
          <Tooltip content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const row = payload[0].payload
            const entries = payload.filter(item => Number(item.value) > 0)
            return <div style={{ background: "#fff", border: "1px solid #e2e5e8", borderRadius: 8, padding: "10px 12px", fontSize: 11, boxShadow: "0 2px 8px rgba(0,0,0,.08)", maxWidth: 240 }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: "#17212b" }}>{row.hoverLabel || label}</div>
              {entries.map(item => <div key={item.dataKey} style={{ color: item.color, display: "flex", justifyContent: "space-between", gap: 16, marginTop: 3 }}><span>{item.name}</span><strong>{metric === "value" ? Number(item.value).toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }) : Number(item.value).toLocaleString("en-GB")}</strong></div>)}
              <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 7, paddingTop: 6, fontWeight: 700 }}>Total: {metric === "value" ? entries.reduce((sum, item) => sum + Number(item.value || 0), 0).toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }) : entries.reduce((sum, item) => sum + Number(item.value || 0), 0).toLocaleString("en-GB")}</div>
            </div>
          }}/>
          <Legend verticalAlign="bottom" height={34} wrapperStyle={{ fontSize: 11, paddingTop: 8 }}/>
          {products.filter(product => productFilter === "all" || product === productFilter).map((product, index) => <Bar key={product} dataKey={product} name={product} stackId="products" fill={SERIES_COLORS[index % SERIES_COLORS.length]} radius={product.toLowerCase().includes("window") ? [0, 0, 0, 0] : [3, 3, 0, 0]}/>)}
        </BarChart>
      </ResponsiveContainer>}
    </div>
    <div style={{ background: "#fff", border: "1px solid #e2e5e8", borderRadius: 12, padding: "20px 18px 10px", marginTop: 18, minWidth: 0, boxSizing: "border-box" }}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "#17212b" }}>Average days from sale to fit start</h2>
        <p style={{ margin: 0, fontSize: 11, color: "#818891" }}>Average calendar days between sold date and installation start date, grouped by fit start year. Jobs without both dates, or with a fit date before the sold date, are excluded.</p>
      </div>
      {loading ? <div style={{ padding: 40, textAlign: "center", color: "#818891", fontSize: 12 }}>Loading installation data…</div> : leadTimeByYear.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "#818891", fontSize: 12 }}>No jobs have both a sold date and fit start date.</div> : <ResponsiveContainer width="100%" height={300}>
        <LineChart data={leadTimeByYear} margin={{ top: 8, right: 18, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb"/>
          <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#777", fontSize: 11 }}/>
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#777", fontSize: 10 }} width={48} label={{ value: "Average days", angle: -90, position: "insideLeft", style: { fill: "#64748b", fontSize: 11 } }}/>
          <Tooltip formatter={(value, name, props) => [Number(value).toLocaleString("en-GB", { maximumFractionDigits: 1 }) + " days (" + (props.payload[`${name}Jobs`] || 0) + " jobs)", name]} labelFormatter={label => "Fit start year: " + label}/>
          <Legend verticalAlign="bottom" height={30} wrapperStyle={{ fontSize: 11, paddingTop: 8 }}/>
          <Line type="monotone" dataKey="Windows" name="Windows" stroke="#1683c7" strokeWidth={3} connectNulls dot={{ r: 4 }} activeDot={{ r: 6 }}/>
          <Line type="monotone" dataKey="Solar" name="Solar" stroke="#f59e0b" strokeWidth={3} connectNulls dot={{ r: 4 }} activeDot={{ r: 6 }}/>
          <Line type="monotone" dataKey="ASHP" name="ASHP" stroke="#7c3aed" strokeWidth={3} connectNulls dot={{ r: 4 }} activeDot={{ r: 6 }}/>
          <Line type="monotone" dataKey="Other" name="Other" stroke="#10b981" strokeWidth={3} connectNulls dot={{ r: 4 }} activeDot={{ r: 6 }}/>
        </LineChart>
      </ResponsiveContainer>}
    </div>
  </section>
}

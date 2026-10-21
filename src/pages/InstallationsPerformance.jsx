import React, { useMemo, useState } from "react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"
import { CalendarDays, RefreshCw, TrendingUp } from "lucide-react"

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
    rows.push({ key: bucket.key, period: bucket.label, hoverLabel: bucket.hoverLabel || bucket.label, count: 0, start: bucket.start.getTime() })
    if (grouping === "year") cursor.setFullYear(cursor.getFullYear() + 1)
    else if (grouping === "quarter") cursor.setMonth(cursor.getMonth() + 3, 1)
    else if (grouping === "week") cursor.setDate(cursor.getDate() + 7)
    else cursor.setMonth(cursor.getMonth() + 1, 1)
  }
  return rows
}

export default function InstallationsPerformance({ deals = [], loading = false, onRefresh }) {
  const [grouping, setGrouping] = useState("month")
  const [yearFilter, setYearFilter] = useState("all")
  const [productFilter, setProductFilter] = useState("all")
  const datedDeals = useMemo(() => (Array.isArray(deals) ? deals : []).map(deal => ({ ...deal, parsedInstallationDate: parseLocalDate(deal.installation_start_date) })).filter(deal => deal.parsedInstallationDate), [deals])
  const years = useMemo(() => [...new Set(datedDeals.map(deal => String(deal.parsedInstallationDate.getFullYear())))].sort((a, b) => Number(b) - Number(a)), [datedDeals])
  const products = useMemo(() => [...new Set(datedDeals.map(deal => String(deal.product || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [datedDeals])
  const filteredDeals = useMemo(() => datedDeals.filter(deal => {
    const matchesYear = yearFilter === "all" || String(deal.parsedInstallationDate.getFullYear()) === yearFilter
    const matchesProduct = productFilter === "all" || String(deal.product || "").trim() === productFilter
    return matchesYear && matchesProduct
  }), [datedDeals, yearFilter, productFilter])
  const chartData = useMemo(() => {
    const rows = makeBuckets(filteredDeals.map(deal => deal.parsedInstallationDate), grouping)
    const rowMap = new Map(rows.map(row => [row.key, row]))
    filteredDeals.forEach(deal => {
      const bucket = getBucket(deal.parsedInstallationDate, grouping)
      const row = rowMap.get(bucket.key)
      if (row) row.count += 1
    })
    return rows
  }, [filteredDeals, grouping])
  const todayKey = dateKey(new Date())
  const upcoming = datedDeals.filter(deal => dateKey(deal.parsedInstallationDate) >= todayKey).length
  const thisYear = datedDeals.filter(deal => deal.parsedInstallationDate.getFullYear() === new Date().getFullYear()).length
  const total = filteredDeals.length

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
    <div style={{ background: "#fff", border: "1px solid #e2e5e8", borderRadius: 12, padding: "20px 18px 10px", minWidth: 0, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div><h2 style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "#17212b" }}>Jobs by installation start date</h2><p style={{ margin: 0, fontSize: 11, color: "#818891" }}>Counts deals with a populated installation_start_date field</p></div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12, color: "#475569" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 7 }}>Period<select value={grouping} onChange={event => setGrouping(event.target.value)} style={selectStyle}><option value="week">Week</option><option value="month">Month</option><option value="quarter">Quarter</option><option value="year">Year</option></select></label>
          <label style={{ display: "flex", alignItems: "center", gap: 7 }}>Year<select value={yearFilter} onChange={event => setYearFilter(event.target.value)} style={selectStyle}><option value="all">All time</option>{years.map(year => <option key={year} value={year}>{year}</option>)}</select></label>
          <label style={{ display: "flex", alignItems: "center", gap: 7 }}>Product<select value={productFilter} onChange={event => setProductFilter(event.target.value)} style={selectStyle}><option value="all">All products</option>{products.map(product => <option key={product} value={product}>{product}</option>)}</select></label>
        </div>
      </div>
      {loading ? <div style={{ padding: 48, textAlign: "center", color: "#818891", fontSize: 12 }}>Loading installation data…</div> : chartData.length === 0 ? <div style={{ padding: 48, textAlign: "center", color: "#818891", fontSize: 12 }}>No jobs have an installation start date for this selection.</div> : <ResponsiveContainer width="100%" height={360}>
        <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 6 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb"/>
          <XAxis dataKey="period" interval="preserveStartEnd" minTickGap={24} axisLine={false} tickLine={false} tick={{ fill: "#8a8a8a", fontSize: 10 }}/>
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#777", fontSize: 10 }} width={42}/>
          <Tooltip content={({ active, payload, label }) => { if (!active || !payload?.length) return null; const row = payload[0].payload; return <div style={{ background: "#fff", border: "1px solid #e2e5e8", borderRadius: 8, padding: "10px 12px", fontSize: 11, boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}><div style={{ fontWeight: 700, marginBottom: 5, color: "#17212b" }}>{row.hoverLabel || label}</div><div style={{ color: "#1683c7" }}>Jobs with start dates: {Number(row.count).toLocaleString("en-GB")}</div></div> }}/>
          <Bar dataKey="count" name="Jobs" fill="#1683c7" radius={[4, 4, 0, 0]}/>
        </BarChart>
      </ResponsiveContainer>}
    </div>
  </section>
}

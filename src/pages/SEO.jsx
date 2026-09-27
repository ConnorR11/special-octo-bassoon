import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Search, MousePointerClick, Eye, TrendingUp, Globe2, BarChart3, ExternalLink, RefreshCw } from "lucide-react"

const MetricCard = ({ icon: Icon, label, value, note }) => (
  <div className="seo-metric-card">
    <div className="seo-metric-icon"><Icon size={18} /></div>
    <div className="seo-metric-label">{label}</div>
    <div className="seo-metric-value">{value}</div>
    <div className="seo-metric-note">{note}</div>
  </div>
)

const number = (value) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(Number(value || 0))
const percent = (value) => `${(Number(value || 0) * 100).toFixed(2)}%`
const position = (value) => Number(value || 0).toFixed(1)
const toInputDate = (date) => date.toISOString().slice(0, 10)

function SEO() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [range, setRange] = useState("28")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")

  const defaultCustomDates = useMemo(() => {
    const end = new Date()
    end.setDate(end.getDate() - 3)
    const start = new Date(end)
    start.setDate(start.getDate() - 27)
    return { start: toInputDate(start), end: toInputDate(end) }
  }, [])

  const loadData = useCallback(async (selectedRange = range, selectedStart = customStart, selectedEnd = customEnd) => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (selectedRange === "custom") {
        if (!selectedStart || !selectedEnd) throw new Error("Please choose both a start date and an end date.")
        params.set("startDate", selectedStart)
        params.set("endDate", selectedEnd)
      } else {
        params.set("range", selectedRange)
      }

      const response = await fetch(`/api/gsc-data?${params.toString()}`, { credentials: "include" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to load Google Search Console data.")
      setData(result)
    } catch (err) {
      setError(err?.message || "Unable to load Google Search Console data.")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [range, customStart, customEnd])

  useEffect(() => {
    if (!customStart || !customEnd) {
      setCustomStart(defaultCustomDates.start)
      setCustomEnd(defaultCustomDates.end)
    }
  }, [defaultCustomDates, customStart, customEnd])

  useEffect(() => {
    loadData("28", customStart, customEnd)
    const params = new URLSearchParams(window.location.search)
    if (params.get("gsc_connected") || params.get("gsc_error")) {
      window.history.replaceState({}, "", "/seo")
    }
  }, [])

  const connect = () => { window.location.href = "/api/gsc-auth" }
  const handleRangeChange = (value) => {
    setRange(value)
    if (value !== "custom") loadData(value, customStart, customEnd)
  }
  const applyCustomRange = () => loadData("custom", customStart, customEnd)
  const totals = data?.totals || {}
  const connected = Boolean(data?.connected)

  const rangeLabel = data?.startDate && data?.endDate
    ? `${data.startDate} to ${data.endDate}`
    : "Last 28 available days"

  return (
    <section className="seo-page">
      <style>{`
        .seo-page{min-height:calc(100vh - 90px);padding:28px 32px 40px;background:#f5f7fa;color:#172033;font-family:Inter,Arial,sans-serif;box-sizing:border-box}
        .seo-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:18px}
        .seo-eyebrow{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:7px}
        .seo-head h1{margin:0;font-size:30px;line-height:1.1;color:#0f172a}
        .seo-head p{margin:8px 0 0;color:#64748b;font-size:13px}
        .seo-actions{display:flex;gap:8px}
        .seo-button{height:36px;padding:0 12px;border:1px solid #d7dee7;border-radius:8px;background:#fff;color:#334155;font:600 12px Inter,Arial,sans-serif;display:flex;align-items:center;gap:7px;cursor:pointer}
        .seo-button.primary{background:#00304b;border-color:#00304b;color:#fff}
        .seo-button:disabled{opacity:.55;cursor:default}
        .seo-range-bar{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:16px;box-shadow:0 1px 2px rgba(15,23,42,.03)}
        .seo-range-left{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
        .seo-range-label{font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.04em}
        .seo-range-select,.seo-date-input{height:34px;border:1px solid #d7dee7;border-radius:7px;background:#fff;color:#334155;font:600 12px Inter,Arial,sans-serif;padding:0 10px;box-sizing:border-box}
        .seo-date-group{display:flex;align-items:flex-end;gap:8px}
        .seo-date-field{display:flex;flex-direction:column;gap:4px}
        .seo-date-field label{font-size:9px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
        .seo-apply{height:34px;padding:0 12px;border:1px solid #00304b;border-radius:7px;background:#00304b;color:#fff;font:600 12px Inter,Arial,sans-serif;cursor:pointer}
        .seo-range-note{font-size:10px;color:#94a3b8;white-space:nowrap}
        .seo-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}
        .seo-metric-card,.seo-panel{background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 1px 2px rgba(15,23,42,.03)}
        .seo-metric-card{padding:16px}
        .seo-metric-icon{width:32px;height:32px;border-radius:8px;background:#eef5f8;color:#00304b;display:flex;align-items:center;justify-content:center;margin-bottom:12px}
        .seo-metric-label{font-size:11px;color:#64748b;font-weight:700}
        .seo-metric-value{font-size:24px;font-weight:800;color:#0f172a;margin-top:4px}
        .seo-metric-note{font-size:10px;color:#94a3b8;margin-top:4px}
        .seo-columns{display:grid;grid-template-columns:1.35fr .65fr;gap:16px}
        .seo-panel{padding:18px}
        .seo-panel-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
        .seo-panel-title{font-size:14px;font-weight:800;color:#0f172a}
        .seo-panel-subtitle{font-size:11px;color:#94a3b8;margin-top:3px}
        .seo-empty{border:1px dashed #cbd5e1;border-radius:9px;padding:28px 20px;text-align:center;background:#f8fafc}
        .seo-empty-icon{width:42px;height:42px;border-radius:50%;background:#e8f1f5;color:#00304b;display:flex;align-items:center;justify-content:center;margin:0 auto 12px}
        .seo-empty strong{display:block;font-size:13px;color:#334155}
        .seo-empty span{display:block;max-width:480px;margin:7px auto 0;font-size:11px;line-height:1.5;color:#64748b}
        .seo-table{width:100%;border-collapse:collapse}
        .seo-table th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;padding:8px;border-bottom:1px solid #e2e8f0}
        .seo-table td{font-size:11px;color:#475569;padding:11px 8px;border-bottom:1px solid #f1f5f9}
        .seo-table td.num,.seo-table th.num{text-align:right}
        .seo-table td:first-child{max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .seo-status{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:700;color:#64748b}
        .seo-dot{width:7px;height:7px;border-radius:50%;background:#cbd5e1}
        .seo-dot.connected{background:#22c55e}
        .seo-error{margin-bottom:16px;border:1px solid #fecaca;background:#fff1f2;color:#b91c1c;border-radius:8px;padding:10px 12px;font-size:12px}
        .seo-site{font-size:10px;color:#64748b;margin-top:4px;max-width:500px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        @media(max-width:900px){.seo-page{padding:22px 18px 30px}.seo-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.seo-columns{grid-template-columns:1fr}.seo-head{flex-direction:column}.seo-actions{width:100%}.seo-range-bar{align-items:flex-start;flex-direction:column}.seo-range-note{white-space:normal}}
        @media(max-width:520px){.seo-grid{grid-template-columns:1fr}.seo-head h1{font-size:25px}.seo-actions{flex-wrap:wrap}.seo-date-group{width:100%;flex-wrap:wrap}.seo-date-field{flex:1;min-width:130px}.seo-date-input{width:100%}}
      `}</style>

      <div className="seo-head">
        <div>
          <div className="seo-eyebrow">Head Office</div>
          <h1>SEO Dashboard</h1>
          <p>Organic search performance for the Homeshield Scotland website.</p>
          {data?.siteUrl && <div className="seo-site">Property: {data.siteUrl} · {rangeLabel}</div>}
        </div>
        <div className="seo-actions">
          <button className="seo-button" onClick={() => loadData()} disabled={loading}><RefreshCw size={14}/> {loading ? "Refreshing..." : "Refresh"}</button>
          <button className="seo-button primary" onClick={connect}><Search size={14}/> {connected ? "Reconnect Search Console" : "Connect Search Console"}</button>
        </div>
      </div>

      <div className="seo-range-bar">
        <div className="seo-range-left">
          <span className="seo-range-label">Date range</span>
          <select className="seo-range-select" value={range} onChange={(event) => handleRangeChange(event.target.value)} disabled={loading}>
            <option value="7">Last 7 days</option>
            <option value="28">Last 28 days</option>
            <option value="3m">Last 3 months</option>
            <option value="6m">Last 6 months</option>
            <option value="12m">Last 12 months</option>
            <option value="custom">Custom range</option>
          </select>
          {range === "custom" && (
            <div className="seo-date-group">
              <div className="seo-date-field"><label>From</label><input className="seo-date-input" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></div>
              <div className="seo-date-field"><label>To</label><input className="seo-date-input" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></div>
              <button className="seo-apply" onClick={applyCustomRange} disabled={loading}>Apply</button>
            </div>
          )}
        </div>
        <div className="seo-range-note">Search Console data is normally available with a short processing delay.</div>
      </div>

      {error && <div className="seo-error">{error}</div>}

      <div className="seo-grid">
        <MetricCard icon={MousePointerClick} label="Organic clicks" value={connected ? number(totals.clicks) : "—"} note={connected ? rangeLabel : "Connect Search Console"} />
        <MetricCard icon={Eye} label="Impressions" value={connected ? number(totals.impressions) : "—"} note={connected ? rangeLabel : "Connect Search Console"} />
        <MetricCard icon={TrendingUp} label="Average position" value={connected ? position(totals.position) : "—"} note={connected ? rangeLabel : "Connect Search Console"} />
        <MetricCard icon={BarChart3} label="Organic CTR" value={connected ? percent(totals.ctr) : "—"} note={connected ? rangeLabel : "Connect Search Console"} />
      </div>

      <div className="seo-columns">
        <div className="seo-panel">
          <div className="seo-panel-head">
            <div><div className="seo-panel-title">Search performance</div><div className="seo-panel-subtitle">Clicks, impressions and average position</div></div>
            <span className="seo-status"><span className={`seo-dot ${connected ? "connected" : ""}`}/>{connected ? "Connected" : "Not connected"}</span>
          </div>
          {!connected ? (
            <div className="seo-empty"><div className="seo-empty-icon"><Globe2 size={20}/></div><strong>Google Search Console is not connected</strong><span>Connect the existing Homeshield Search Console account to populate the dashboard.</span></div>
          ) : (
            <div className="seo-empty"><div className="seo-empty-icon"><TrendingUp size={20}/></div><strong>Search Console data connected</strong><span>{number(totals.clicks)} clicks from {number(totals.impressions)} impressions. Average position {position(totals.position)} with a {percent(totals.ctr)} CTR.</span></div>
          )}
        </div>

        <div className="seo-panel">
          <div className="seo-panel-head"><div><div className="seo-panel-title">Top keywords</div><div className="seo-panel-subtitle">Highest-performing search queries</div></div></div>
          <table className="seo-table"><thead><tr><th>Keyword</th><th className="num">Position</th><th className="num">Clicks</th></tr></thead>
            <tbody>{data?.queries?.length ? data.queries.map((row) => <tr key={row.query}><td title={row.query}>{row.query}</td><td className="num">{position(row.position)}</td><td className="num">{number(row.clicks)}</td></tr>) : <tr><td colSpan="3" style={{textAlign:"center",color:"#94a3b8",padding:"28px 8px"}}>{loading ? "Loading..." : "No data yet"}</td></tr>}</tbody>
          </table>
        </div>

        <div className="seo-panel">
          <div className="seo-panel-head"><div><div className="seo-panel-title">Top landing pages</div><div className="seo-panel-subtitle">Organic traffic by page</div></div><ExternalLink size={15} color="#94a3b8"/></div>
          <table className="seo-table"><thead><tr><th>Page</th><th className="num">Clicks</th><th className="num">CTR</th></tr></thead>
            <tbody>{data?.pages?.length ? data.pages.map((row) => <tr key={row.page}><td title={row.page}>{row.page}</td><td className="num">{number(row.clicks)}</td><td className="num">{percent(row.ctr)}</td></tr>) : <tr><td colSpan="3" style={{textAlign:"center",color:"#94a3b8",padding:"28px 8px"}}>{loading ? "Loading..." : "No data yet"}</td></tr>}</tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default SEO

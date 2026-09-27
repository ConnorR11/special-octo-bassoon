import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Search, MousePointerClick, Eye, TrendingUp, Globe2, BarChart3, ExternalLink, RefreshCw } from "lucide-react"

const fmt = (n) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(Number(n || 0))
const pct = (n) => `${(Number(n || 0) * 100).toFixed(2)}%`
const pos = (n) => Number(n || 0).toFixed(1)
const inputDate = (d) => d.toISOString().slice(0, 10)
const pctChange = (a, b) => Number(b) ? ((Number(a || 0) - Number(b)) / Number(b)) * 100 : null

function Metric({ icon: Icon, label, value, note, comparison }) {
  return <div className="seo-metric"><div className="seo-icon"><Icon size={18}/></div><div className="seo-label">{label}</div><div className="seo-value">{value}</div>{comparison && <div className={`seo-change ${comparison.type}`}>{comparison.text}</div>}<div className="seo-note">{note}</div></div>
}

function Chart({ rows }) {
  const [metric, setMetric] = useState("clicks")
  const [hover, setHover] = useState(null)
  const settings = {
    clicks: { label: "Clicks", format: fmt },
    impressions: { label: "Impressions", format: fmt },
    position: { label: "Average position", format: pos },
  }
  const cfg = settings[metric]
  if (!rows?.length) return <div className="chart-empty">No daily Search Console data is available for this range.</div>

  const W = 1000, H = 320, left = 58, right = 24, top = 24, bottom = 48
  const plotW = W - left - right, plotH = H - top - bottom
  const values = rows.map(r => Number(r[metric] || 0))
  const min = metric === "position" ? 0 : 0
  const max = Math.max(...values, 1)
  const range = Math.max(max - min, 1)
  const x = i => left + (rows.length === 1 ? plotW / 2 : i * plotW / (rows.length - 1))
  const y = v => top + plotH - ((Number(v) - min) / range) * plotH
  const points = rows.map((r, i) => `${x(i)},${y(r[metric])}`).join(" ")
  const labels = rows.length <= 7 ? rows.map((_, i) => i) : [0, Math.floor((rows.length - 1) / 2), rows.length - 1]
  const grid = [0, .25, .5, .75, 1]

  return <div>
    <div className="chart-toolbar"><div className="chart-tabs">{Object.entries(settings).map(([key, item]) => <button key={key} className={`chart-tab ${metric === key ? "active" : ""}`} onClick={() => setMetric(key)}>{item.label}</button>)}</div><span>Daily data</span></div>
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" preserveAspectRatio="none" onMouseLeave={() => setHover(null)}>
        {grid.map((r, i) => { const yy = top + plotH - r * plotH; const value = min + r * range; return <g key={i}><line x1={left} x2={W-right} y1={yy} y2={yy} className="grid-line"/><text x={left-10} y={yy+4} textAnchor="end" className="axis">{cfg.format(value)}</text></g> })}
        <polyline points={points} className="chart-line" fill="none"/>
        {rows.map((row, i) => <circle key={row.date} cx={x(i)} cy={y(row[metric])} r={hover === i ? 5 : 3} className="chart-point" onMouseEnter={() => setHover(i)}/>)}
        {labels.map(i => <text key={i} x={x(i)} y={H-14} textAnchor={i === 0 ? "start" : i === rows.length-1 ? "end" : "middle"} className="axis">{rows[i].date}</text>)}
      </svg>
      {hover !== null && <div className="chart-tip" style={{left: `${(x(hover)/W)*100}%`}}><strong>{rows[hover].date}</strong><span>{cfg.label}: {cfg.format(rows[hover][metric])}</span></div>}
    </div>
  </div>
}

function SEO() {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState("")
  const [range, setRange] = useState("28"), [customStart, setCustomStart] = useState(""), [customEnd, setCustomEnd] = useState("")
  const defaults = useMemo(() => { const end = new Date(); end.setDate(end.getDate()-3); const start = new Date(end); start.setDate(start.getDate()-27); return {start: inputDate(start), end: inputDate(end)} }, [])

  const load = useCallback(async (r=range, start=customStart, end=customEnd) => {
    setLoading(true); setError("")
    try {
      const p = new URLSearchParams()
      if (r === "custom") { if (!start || !end) throw new Error("Please choose both a start date and an end date."); p.set("startDate", start); p.set("endDate", end) } else p.set("range", r)
      const response = await fetch(`/api/gsc-data?${p}`, {credentials:"include"})
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unable to load Google Search Console data.")
      setData(result)
    } catch (e) { setError(e?.message || "Unable to load Google Search Console data."); setData(null) } finally { setLoading(false) }
  }, [range, customStart, customEnd])

  useEffect(() => { if (!customStart || !customEnd) { setCustomStart(defaults.start); setCustomEnd(defaults.end) } }, [defaults, customStart, customEnd])
  useEffect(() => { load("28", customStart, customEnd); const p = new URLSearchParams(window.location.search); if (p.get("gsc_connected") || p.get("gsc_error")) window.history.replaceState({}, "", "/seo") }, [])

  const connected = Boolean(data?.connected), totals = data?.totals || {}, previous = data?.comparison?.totals || null
  const rangeLabel = data?.startDate && data?.endDate ? `${data.startDate} to ${data.endDate}` : "Last 28 available days"
  const previousLabel = data?.comparison?.startDate && data?.comparison?.endDate ? `${data.comparison.startDate} to ${data.comparison.endDate}` : "previous period"
  const change = (a,b,invert=false) => { if (!data?.comparison?.available || b === null || b === undefined) return null; const v=pctChange(a,b); if(v===null) return null; return {type: v===0?"flat":(invert ? v<0?"up":"down" : v>0?"up":"down"), text:`${v>0?"+":""}${v.toFixed(1)}% vs previous`} }
  const positionChange = connected && previous ? Number(totals.position||0)-Number(previous.position||0) : null

  return <section className="seo-page">
    <style>{`
      .seo-page{min-height:calc(100vh - 90px);padding:28px 32px 40px;background:#f5f7fa;color:#172033;font-family:Inter,Arial,sans-serif;box-sizing:border-box}.seo-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:18px}.seo-eyebrow{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:7px}.seo-head h1{margin:0;font-size:30px;line-height:1.1;color:#0f172a}.seo-head p{margin:8px 0 0;color:#64748b;font-size:13px}.seo-actions{display:flex;gap:8px}.seo-btn{height:36px;padding:0 12px;border:1px solid #d7dee7;border-radius:8px;background:#fff;color:#334155;font:600 12px Inter,Arial,sans-serif;display:flex;align-items:center;gap:7px;cursor:pointer}.seo-btn.primary{background:#00304b;border-color:#00304b;color:#fff}.seo-btn:disabled{opacity:.55}.seo-range{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:16px}.range-left{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.range-label{font-size:11px;font-weight:800;color:#475569;text-transform:uppercase}.range-select,.date-input{height:34px;border:1px solid #d7dee7;border-radius:7px;background:#fff;color:#334155;font:600 12px Inter,Arial,sans-serif;padding:0 10px}.date-group{display:flex;align-items:flex-end;gap:8px}.date-field{display:flex;flex-direction:column;gap:4px}.date-field label{font-size:9px;color:#94a3b8;font-weight:700;text-transform:uppercase}.apply{height:34px;padding:0 12px;border:1px solid #00304b;border-radius:7px;background:#00304b;color:#fff;font:600 12px Inter,Arial,sans-serif}.range-note{font-size:10px;color:#94a3b8;white-space:nowrap}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:10px}.seo-metric,.panel{background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 1px 2px rgba(15,23,42,.03)}.seo-metric{padding:16px}.seo-icon{width:32px;height:32px;border-radius:8px;background:#eef5f8;color:#00304b;display:flex;align-items:center;justify-content:center;margin-bottom:12px}.seo-label{font-size:11px;color:#64748b;font-weight:700}.seo-value{font-size:24px;font-weight:800;color:#0f172a;margin-top:4px}.seo-note{font-size:10px;color:#94a3b8;margin-top:4px}.seo-change{font-size:10px;font-weight:800;margin-top:7px}.seo-change.up{color:#15803d}.seo-change.down{color:#b91c1c}.seo-change.flat{color:#64748b}.comparison{font-size:10px;color:#94a3b8;margin:0 0 16px 2px}.panel{padding:18px;margin-bottom:16px}.panel-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.panel-title{font-size:14px;font-weight:800;color:#0f172a}.panel-sub{font-size:11px;color:#94a3b8;margin-top:3px}.status{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:700;color:#64748b}.dot{width:7px;height:7px;border-radius:50%;background:#cbd5e1}.dot.on{background:#22c55e}.empty{border:1px dashed #cbd5e1;border-radius:9px;padding:28px 20px;text-align:center;background:#f8fafc}.empty-icon{width:42px;height:42px;border-radius:50%;background:#e8f1f5;color:#00304b;display:flex;align-items:center;justify-content:center;margin:0 auto 12px}.empty strong{display:block;font-size:13px;color:#334155}.empty span{display:block;max-width:480px;margin:7px auto 0;font-size:11px;color:#64748b}.error{margin-bottom:16px;border:1px solid #fecaca;background:#fff1f2;color:#b91c1c;border-radius:8px;padding:10px 12px;font-size:12px}.site{font-size:10px;color:#64748b;margin-top:4px}.chart-toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.chart-tabs{display:flex;gap:5px;flex-wrap:wrap}.chart-tab{border:1px solid #dbe3ea;background:#fff;color:#64748b;border-radius:7px;padding:6px 10px;font:700 10px Inter,Arial,sans-serif;cursor:pointer}.chart-tab.active{background:#00304b;border-color:#00304b;color:#fff}.chart-toolbar>span{font-size:10px;color:#94a3b8}.chart-wrap{position:relative}.chart{width:100%;height:320px;display:block}.grid-line{stroke:#e9eef3;stroke-width:1}.axis{fill:#94a3b8;font:10px Inter,Arial,sans-serif}.chart-line{stroke:#00304b;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.chart-point{fill:#fff;stroke:#00304b;stroke-width:2}.chart-tip{position:absolute;top:8px;transform:translateX(-50%);background:#172033;color:#fff;border-radius:7px;padding:7px 9px;display:flex;flex-direction:column;gap:2px;white-space:nowrap;font-size:10px;pointer-events:none;box-shadow:0 5px 16px rgba(15,23,42,.15)}.chart-tip span{color:#cbd5e1}.chart-empty{height:300px;border:1px dashed #cbd5e1;border-radius:9px;background:#f8fafc;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px}.columns{display:grid;grid-template-columns:1.35fr .65fr;gap:16px}.table{width:100%;border-collapse:collapse}.table th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;padding:8px;border-bottom:1px solid #e2e8f0}.table td{font-size:11px;color:#475569;padding:11px 8px;border-bottom:1px solid #f1f5f9}.table td.num,.table th.num{text-align:right}.table td:first-child{max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(max-width:900px){.seo-page{padding:22px 18px 30px}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.columns{grid-template-columns:1fr}.seo-head{flex-direction:column}.seo-actions{width:100%}.seo-range{align-items:flex-start;flex-direction:column}.range-note{white-space:normal}}@media(max-width:520px){.metrics{grid-template-columns:1fr}.seo-head h1{font-size:25px}.seo-actions{flex-wrap:wrap}.date-group{width:100%;flex-wrap:wrap}.date-field{flex:1;min-width:130px}.date-input{width:100%}.chart{height:240px}}
    `}</style>

    <div className="seo-head"><div><div className="seo-eyebrow">Head Office</div><h1>SEO Dashboard</h1><p>Organic search performance for the Homeshield Scotland website.</p>{data?.siteUrl && <div className="site">Property: {data.siteUrl} · {rangeLabel}</div>}</div><div className="seo-actions"><button className="seo-btn" onClick={() => load()} disabled={loading}><RefreshCw size={14}/>{loading ? "Refreshing..." : "Refresh"}</button><button className="seo-btn primary" onClick={() => {window.location.href="/api/gsc-auth"}}><Search size={14}/>{connected ? "Reconnect Search Console" : "Connect Search Console"}</button></div></div>

    <div className="seo-range"><div className="range-left"><span className="range-label">Date range</span><select className="range-select" value={range} onChange={e => {setRange(e.target.value); if(e.target.value !== "custom") load(e.target.value)}} disabled={loading}><option value="7">Last 7 days</option><option value="28">Last 28 days</option><option value="3m">Last 3 months</option><option value="6m">Last 6 months</option><option value="12m">Last 12 months</option><option value="custom">Custom range</option></select>{range === "custom" && <div className="date-group"><div className="date-field"><label>From</label><input className="date-input" type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)}/></div><div className="date-field"><label>To</label><input className="date-input" type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)}/></div><button className="apply" onClick={()=>load("custom",customStart,customEnd)} disabled={loading}>Apply</button></div>}</div><div className="range-note">Search Console data is normally available with a short processing delay.</div></div>
    {error && <div className="error">{error}</div>}

    <div className="metrics">
      <Metric icon={MousePointerClick} label="Organic clicks" value={connected?fmt(totals.clicks):"—"} note={connected?rangeLabel:"Connect Search Console"} comparison={connected?change(totals.clicks,previous?.clicks):null}/>
      <Metric icon={Eye} label="Impressions" value={connected?fmt(totals.impressions):"—"} note={connected?rangeLabel:"Connect Search Console"} comparison={connected?change(totals.impressions,previous?.impressions):null}/>
      <Metric icon={TrendingUp} label="Average position" value={connected?pos(totals.position):"—"} note={connected?rangeLabel:"Connect Search Console"} comparison={connected&&positionChange!==null?{type:positionChange<0?"up":positionChange>0?"down":"flat",text:`${positionChange>0?"+":""}${positionChange.toFixed(1)} positions vs previous`}:null}/>
      <Metric icon={BarChart3} label="Organic CTR" value={connected?pct(totals.ctr):"—"} note={connected?rangeLabel:"Connect Search Console"} comparison={connected?change(totals.ctr,previous?.ctr):null}/>
    </div>
    {connected&&data?.comparison&&<div className="comparison">Comparing {rangeLabel} against {previousLabel}</div>}

    <div className="panel"><div className="panel-head"><div><div className="panel-title">Search performance</div><div className="panel-sub">Daily clicks, impressions and average position</div></div><span className="status"><span className={`dot ${connected?"on":""}`}/>{connected?"Connected":"Not connected"}</span></div>{connected?<Chart rows={data?.daily||[]}/>:<div className="empty"><div className="empty-icon"><Globe2 size={20}/></div><strong>Google Search Console is not connected</strong><span>Connect the existing Homeshield Search Console account to populate the dashboard.</span></div>}</div>

    <div className="columns"><div className="panel"><div className="panel-head"><div><div className="panel-title">Top keywords</div><div className="panel-sub">Highest-performing search queries</div></div></div><table className="table"><thead><tr><th>Keyword</th><th className="num">Position</th><th className="num">Clicks</th></tr></thead><tbody>{data?.queries?.length?data.queries.map(r=><tr key={r.query}><td title={r.query}>{r.query}</td><td className="num">{pos(r.position)}</td><td className="num">{fmt(r.clicks)}</td></tr>):<tr><td colSpan="3" style={{textAlign:"center",color:"#94a3b8",padding:"28px 8px"}}>{loading?"Loading...":"No data yet"}</td></tr>}</tbody></table></div><div className="panel"><div className="panel-head"><div><div className="panel-title">Top landing pages</div><div className="panel-sub">Organic traffic by page</div></div><ExternalLink size={15} color="#94a3b8"/></div><table className="table"><thead><tr><th>Page</th><th className="num">Clicks</th><th className="num">CTR</th></tr></thead><tbody>{data?.pages?.length?data.pages.map(r=><tr key={r.page}><td title={r.page}>{r.page}</td><td className="num">{fmt(r.clicks)}</td><td className="num">{pct(r.ctr)}</td></tr>):<tr><td colSpan="3" style={{textAlign:"center",color:"#94a3b8",padding:"28px 8px"}}>{loading?"Loading...":"No data yet"}</td></tr>}</tbody></table></div></div>
  </section>
}

export default SEO

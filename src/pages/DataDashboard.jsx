import React, { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

function parseDate(value) {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null
  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) return d
  const normalized = raw.replace(" ", "T")
  const fallback = new Date(normalized)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

function minutesBetween(received, firstCalled) {
  const start = parseDate(received)
  const end = parseDate(firstCalled)
  if (!start || !end || end < start) return null
  return (end.getTime() - start.getTime()) / 60000
}

function formatMinutes(value) {
  if (value == null || !Number.isFinite(value)) return "—"
  if (value < 1) return `${Math.round(value * 60)} sec`
  if (value < 60) return `${value.toFixed(1)} min`
  const hours = Math.floor(value / 60)
  const mins = Math.round(value % 60)
  return `${hours}h ${mins}m`
}

export default function DataDashboard() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!supabase) return
      setLoading(true)
      setError("")
      try {
        const results = []
        let from = 0
        const pageSize = 1000
        while (true) {
          const { data, error: queryError } = await supabase
            .from("leads")
            .select("received_at,received_at_parsed,first_time_called")
            .not("first_time_called", "is", null)
            .neq("first_time_called", "")
            .range(from, from + pageSize - 1)
          if (queryError) throw queryError
          const batch = data || []
          results.push(...batch)
          if (batch.length < pageSize) break
          from += pageSize
        }
        if (mounted) setRows(results)
      } catch (err) {
        if (mounted) {
          setRows([])
          setError(err?.message || "Unable to load lead data.")
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const monthly = useMemo(() => {
    const map = new Map()
    for (const row of rows) {
      const received = row.received_at_parsed || row.received_at
      const called = row.first_time_called
      const receivedDate = parseDate(received)
      const minutes = minutesBetween(received, called)
      if (!receivedDate || minutes == null) continue
      const key = `${receivedDate.getFullYear()}-${String(receivedDate.getMonth() + 1).padStart(2, "0")}`
      const current = map.get(key) || { key, year: receivedDate.getFullYear(), month: receivedDate.getMonth(), total: 0, speedTotal: 0 }
      current.total += 1
      current.speedTotal += minutes
      map.set(key, current)
    }
    return Array.from(map.values()).sort((a,b) => a.key.localeCompare(b.key)).map(item => ({ ...item, average: item.speedTotal / item.total }))
  }, [rows])

  const average = useMemo(() => {
    if (!rows.length) return null
    let total = 0
    let count = 0
    for (const row of rows) {
      const minutes = minutesBetween(row.received_at_parsed || row.received_at, row.first_time_called)
      if (minutes != null) { total += minutes; count += 1 }
    }
    return count ? total / count : null
  }, [rows])

  const chart = useMemo(() => {
    const width = 1100
    const height = 420
    const pad = { top: 35, right: 30, bottom: 65, left: 75 }
    const plotW = width - pad.left - pad.right
    const plotH = height - pad.top - pad.bottom
    const max = Math.max(10, ...monthly.map(x => x.average))
    const step = monthly.length > 1 ? plotW / (monthly.length - 1) : plotW
    const points = monthly.map((item, index) => {
      const x = monthly.length === 1 ? pad.left + plotW / 2 : pad.left + index * step
      const y = pad.top + plotH - (item.average / max) * plotH
      return { ...item, x, y }
    })
    const path = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
    return { width, height, pad, plotW, plotH, max, points, path }
  }, [monthly])

  return (
    <section style={{ padding: "24px", maxWidth: 1250, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 24, color: "#222" }}>Data Dashboard</h1>
        <p style={{ margin: "6px 0 0", color: "#777", fontSize: 13 }}>Speed to lead and lead volume</p>
      </div>

      {error && <div style={{ padding: 14, marginBottom: 18, background: "#fff1f1", border: "1px solid #f0caca", borderRadius: 8, color: "#9b2226" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 14, marginBottom: 18 }}>
        <div style={{ background: "#fff", border: "1px solid #e7eaee", borderRadius: 10, padding: 18 }}>
          <div style={{ color: "#777", fontSize: 12 }}>Leads with first call</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 5 }}>{loading ? "—" : rows.length.toLocaleString()}</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e7eaee", borderRadius: 10, padding: 18 }}>
          <div style={{ color: "#777", fontSize: 12 }}>Average speed to lead</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 5 }}>{loading ? "—" : formatMinutes(average)}</div>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e7eaee", borderRadius: 10, padding: 20, overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17 }}>Speed to Lead</h2>
            <div style={{ marginTop: 4, color: "#888", fontSize: 12 }}>Average time from lead received to first call. Only leads with a recorded first call are included.</div>
          </div>
        </div>
        {loading ? <div style={{ height: 420, display: "grid", placeItems: "center", color: "#777" }}>Loading lead data…</div> : !monthly.length ? <div style={{ height: 420, display: "grid", placeItems: "center", color: "#777" }}>No completed speed-to-lead data found.</div> : (
          <svg viewBox={`0 0 ${chart.width} ${chart.height}`} style={{ width: "100%", minWidth: 760, display: "block" }} role="img" aria-label="Speed to lead by month">
            {[0, .25, .5, .75, 1].map(ratio => {
              const y = chart.pad.top + chart.plotH - ratio * chart.plotH
              const value = chart.max * ratio
              return <g key={ratio}><line x1={chart.pad.left} x2={chart.width - chart.pad.right} y1={y} y2={y} stroke="#e7eaee"/><text x={chart.pad.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#777">{formatMinutes(value)}</text></g>
            })}
            <path d={chart.path} fill="none" stroke="#1479b8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {chart.points.map((p, i) => <g key={p.key}><circle cx={p.x} cy={p.y} r="4" fill="#1479b8"/><text x={p.x} y={chart.height - 37} textAnchor="middle" fontSize="10" fill="#666">{MONTHS[p.month]} {p.year}</text><title>{`${MONTHS[p.month]} ${p.year}: ${formatMinutes(p.average)} average · ${p.total.toLocaleString()} leads`}</title></g>)}
            <text x={chart.pad.left} y={18} fontSize="11" fill="#777">Average speed to lead</text>
            <text x={chart.width / 2} y={chart.height - 8} textAnchor="middle" fontSize="11" fill="#777">Year / Month</text>
          </svg>
        )}
      </div>
    </section>
  )
}

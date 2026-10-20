import React, { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Copy, RefreshCw } from "lucide-react"
import { supabase } from "./lib/supabase"

const FRAME_FIELDS = [
  ["window_count", "W"],
  ["door_count", "D"],
  ["sp/tl_count", "SP/TL"],
  ["fd/pd_count", "FD/PD"],
  ["velux_count", "Velux"],
]
const pad = (n) => String(n).padStart(2, "0")
const dateString = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const mondayOf = (date) => {
  const d = new Date(date)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  d.setHours(0, 0, 0, 0)
  return d
}
const addDays = (date, days) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}
const formatFrames = (deal) => FRAME_FIELDS
  .map(([field, label]) => ({ label, count: Number(deal?.[field] || 0) }))
  .filter((item) => item.count > 0)
  .map((item) => `${item.count}${item.label}`)
  .join(" · ")

export default function TeamDiaryOutput({ onClose }) {
  const monday = useMemo(() => mondayOf(new Date()), [])
  const [startDate, setStartDate] = useState(dateString(monday))
  const [endDate, setEndDate] = useState(dateString(addDays(monday, 4)))
  const [selectedTeam, setSelectedTeam] = useState("")
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  async function loadJobs() {
    if (!supabase) {
      setError("Supabase is not configured.")
      return
    }
    if (!startDate || !endDate || startDate > endDate) {
      setError("Choose a valid date range.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const select = 'id,customer_name,postcode,contract_number,installation_start_date,fit_team_1,window_count,door_count,"sp/tl_count","fd/pd_count",velux_count,installation_roof_start_date,installation_roof_team,installation_electrics_start_date,installation_electrics_team,remedial_start_date,remedial_fit_team,installations_issues_start_date,installation_issues_fit_team'
      const jobsResult = []
      const jobSources = [
        ["Fit", "installation_start_date", "fit_team_1"],
        ["Roofer", "installation_roof_start_date", "installation_roof_team"],
        ["Electrics", "installation_electrics_start_date", "installation_electrics_team"],
        ["Remedial", "remedial_start_date", "remedial_fit_team"],
        ["Issue", "installations_issues_start_date", "installation_issues_fit_team"],
      ]
      for (const [type, dateField, teamField] of jobSources) {
        let from = 0
        while (true) {
          const { data, error: queryError } = await supabase
            .from("deals")
            .select(select)
            .gte(dateField, startDate)
            .lte(dateField, endDate)
            .not(teamField, "is", null)
            .order(dateField, { ascending: true })
            .range(from, from + 999)
          if (queryError) throw queryError
          ;(data || []).forEach((deal) => {
            const date = String(deal[dateField] || "").slice(0, 10)
            if (date >= startDate && date <= endDate && String(deal[teamField] || "").trim()) {
              jobsResult.push({ ...deal, date, jobType: type, team: String(deal[teamField]).trim() })
            }
          })
          if (!data || data.length < 1000) break
          from += 1000
        }
      }
      setJobs(jobsResult)
    } catch (e) {
      setError(e?.message || "Unable to load team diary jobs for this date range.")
      setJobs([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { loadJobs() }, [])

  const teams = useMemo(() => [...new Set(jobs.map((job) => String(job.team || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })), [jobs])

  useEffect(() => {
    if (!teams.length) setSelectedTeam("")
    else if (!teams.includes(selectedTeam)) setSelectedTeam(teams[0])
  }, [teams, selectedTeam])

  const teamJobs = useMemo(() => jobs
    .filter((job) => String(job.team || "").trim() === selectedTeam)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.customer_name || "").localeCompare(String(b.customer_name || ""))),
  [jobs, selectedTeam])

  const output = useMemo(() => {
    if (!selectedTeam) return ""
    const lines = [selectedTeam.toLocaleUpperCase(), ""]
    const dayJobs = new Map()
    teamJobs.forEach((job) => {
      if (!dayJobs.has(job.date)) dayJobs.set(job.date, [])
      dayJobs.get(job.date).push(job)
    })
    const cursor = new Date(startDate + "T12:00:00")
    const end = new Date(endDate + "T12:00:00")
    while (cursor <= end) {
      const date = dateString(cursor)
      const entries = dayJobs.get(date) || []
      if (entries.length) {
        lines.push(`${cursor.toLocaleDateString("en-GB", { weekday: "long" }).toLocaleUpperCase()} ${cursor.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`)
        entries.forEach((job, index) => {
          const frames = formatFrames(job)
          lines.push(`${job.jobType ? `[${job.jobType.toUpperCase()}] ` : ""}${job.customer_name || "Customer"} - ${job.postcode || "No postcode"} - ${job.contract_number || "No contract"}${frames ? ` - ${frames}` : ""}`)
          if (index < entries.length - 1) lines.push("&")
        })
        lines.push("")
      }
      cursor.setDate(cursor.getDate() + 1)
    }
    return lines.join("\n").trim()
  }, [selectedTeam, teamJobs, startDate, endDate])

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError("Unable to copy automatically. Select the output text and copy it manually.")
    }
  }

  return (
    <section className="card" style={{ padding: 22, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <button type="button" onClick={onClose} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: 0, background: "transparent", color: "#475569", padding: "0 0 10px", cursor: "pointer" }}><ArrowLeft size={15} /> Back to Fit Sheet</button>
          <h2 style={{ margin: 0, color: "#172554", fontSize: 22 }}>Team Diary Output</h2>
          <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 13 }}>Create a ready-to-send diary of all job types allocated to an individual team.</p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "end", gap: 12, flexWrap: "wrap", padding: 14, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 18 }}>
        <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "#334155" }}>From date<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff" }} /></label>
        <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "#334155" }}>To date<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff" }} /></label>
        <button type="button" onClick={loadJobs} disabled={loading} style={{ height: 37, padding: "0 13px", border: 0, borderRadius: 7, background: "#172554", color: "#fff", fontWeight: 700, cursor: loading ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 7 }}><RefreshCw size={14} /> {loading ? "Loading…" : "Load date range"}</button>
        <div style={{ flexBasis: "100%", height: 0 }} />
        <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "#334155" }}>Fitting team
          <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} disabled={!teams.length} style={{ minWidth: 240, padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff" }}>
            {!teams.length && <option value="">No teams found in this date range</option>}
            {teams.map((team) => <option key={team} value={team}>{team}</option>)}
          </select>
        </label>
        <span style={{ color: "#64748b", fontSize: 12 }}>{teamJobs.length} job{teamJobs.length === 1 ? "" : "s"} for this team</span>
      </div>

      {error && <div role="alert" style={{ padding: 11, marginBottom: 14, borderRadius: 7, background: "#fff1f2", color: "#be123c", fontSize: 13 }}>{error}</div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <strong style={{ color: "#334155", fontSize: 13 }}>Message preview</strong>
        <button type="button" onClick={copyOutput} disabled={!output} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 13px", border: 0, borderRadius: 7, background: output ? "#166534" : "#94a3b8", color: "#fff", fontWeight: 700, cursor: output ? "pointer" : "not-allowed" }}><Copy size={14} /> {copied ? "Copied!" : "Copy team diary"}</button>
      </div>
      <textarea readOnly value={output || (loading ? "Loading jobs…" : "No jobs found for this team and date range.")} rows={Math.min(24, Math.max(8, output.split("\n").length))} style={{ width: "100%", boxSizing: "border-box", resize: "vertical", padding: 15, border: "1px solid #cbd5e1", borderRadius: 9, background: "#fff", color: "#0f172a", font: "13px/1.65 ui-monospace, SFMono-Regular, Menlo, monospace" }} />
      <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: 12 }}>Includes Fit, Roofer, Electrics, Remedial and Issue jobs allocated to the selected team. Frame counts are shown where available; zero counts are omitted.</p>
    </section>
  )
}

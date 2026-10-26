import React from "react"
import { RefreshCw, Eye, Play, AlertTriangle, CheckCircle2, XCircle, Clock3 } from "lucide-react"
import { supabase } from "../lib/supabase"

const JOBS = [
  { id: "backfill-pipedrive-stages", title: "Backfill Pipedrive stages", description: "Find deals with a Pipedrive deal ID but no saved stage, then retrieve the current stage from Pipedrive.", kind: "bulk" },
  { id: "backfill-installation-start-dates", title: "Backfill installation start dates", description: "Find Contract Complete deals with a missing installation start date and retrieve the date from Pipedrive.", kind: "bulk" },
  { id: "glide-live-leads", title: "Sync live Glide leads", description: "Compare Glide rows with existing CRM leads, then update matched leads only. Blank Glide values are skipped; no new leads are inserted.", kind: "glide" },
]

export default function BulkUpdater() {
  const [job, setJob] = React.useState(JOBS[0].id)
  const [limit, setLimit] = React.useState("1000000")
  const [result, setResult] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [confirmExecute, setConfirmExecute] = React.useState(false)
  const [offset, setOffset] = React.useState("0")
  const selectedJob = JOBS.find(item => item.id === job) || JOBS[0]

  async function getSessionToken() {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    const token = data?.session?.access_token
    if (!token) throw new Error("Your session has expired. Please sign in again.")
    return token
  }

  async function runGlideSync(execute) {
    const token = await getSessionToken()
    const response = await fetch("/api/admin/glide-leads-preview", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ limit: Math.max(1, Number.parseInt(limit, 10) || 100), offset: Math.max(0, Number.parseInt(offset, 10) || 0), execute })
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.error || payload?.message || "Glide sync request failed (HTTP " + response.status + ").")
    setResult({ ...payload, dryRun: !execute, results: payload.sampleChangedRows || [], requested: payload.sourceRowsTested, previewed: payload.proposedFieldChanges, updated: payload.updated || 0, skipped: payload.notMatched || 0, failed: payload.errors?.length || 0 })
    setMessage(execute ? "Glide sync finished. Review the counts and any reported errors below." : "Glide preview ready. No lead records were changed.")
  }

  async function runUpdater(execute = false) {
    setBusy(true); setError(""); setMessage(""); setConfirmExecute(false)
    try {
      if (selectedJob.kind === "glide") {
        await runGlideSync(execute)
        return
      }
      const token = await getSessionToken()
      const params = new URLSearchParams({ job, limit: String(Math.min(250, Math.max(1, Number.parseInt(limit, 10) || 250))), offset: String(Math.max(0, Number.parseInt(offset, 10) || 0)) })
      if (execute) params.set("execute", "true")
      const response = await fetch("/api/admin/bulk-updates?" + params.toString(), { headers: { Authorization: "Bearer " + token, Accept: "application/json" } })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok && response.status !== 207) {
        const raw = payload?.error
        const detail = typeof raw === "string" ? raw : raw?.message || raw?.details || raw?.hint || (raw ? JSON.stringify(raw) : "")
        throw new Error(detail || "Bulk update failed (HTTP " + response.status + ").")
      }
      setResult(payload)
      setMessage(execute ? "Run finished: " + (payload.updated || 0) + " updated, " + (payload.skipped || 0) + " skipped, " + (payload.failed || 0) + " failed." : "Preview ready: " + (payload.previewed || 0) + " potential updates identified. No deal records were changed.")
    } catch (err) { setError(err?.message || "Could not run the bulk updater.") }
    finally { setBusy(false) }
  }

  const counts = result ? [
    { label: "Scanned", value: result.requested ?? result.sourceRowsTested ?? 0 },
    { label: "Eligible leads", value: result.eligibleRowsTotal ?? result.eligibleForUpdate ?? result.matchedUnique ?? 0 },
    { label: "Proposed changes", value: result.proposedFieldChanges ?? result.previewed ?? 0 },
    { label: "Same timestamp skipped", value: result.skippedSameLastCall ?? 0 },
    { label: "Updated", value: result.updated ?? 0 },
    { label: "Unmatched / failed", value: (result.notMatched ?? result.skipped ?? 0) + (result.multipleMatches ?? 0) + (result.errors?.length ?? result.failed ?? 0) },
  ] : []

  return <div className="bulk-updater-page">
    <style>{`
      .bulk-updater-page{padding:28px;background:#f5f7fa;min-height:calc(100vh - 70px);color:#102a43;box-sizing:border-box}.bulk-updater-wrap{max-width:1400px;margin:0 auto}
      .bulk-updater-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:24px}.bulk-updater-heading h1{margin:0 0 8px;font-size:28px;color:#101828}.bulk-updater-heading p{margin:0;color:#667085;line-height:1.5;max-width:760px}
      .bulk-updater-card{background:#fff;border:1px solid #e4e7ec;border-radius:12px;padding:22px;margin-bottom:18px}.bulk-updater-card h2{font-size:17px;margin:0 0 8px;color:#101828}.bulk-updater-muted{color:#667085;font-size:13px;line-height:1.5}
      .bulk-updater-form{display:grid;grid-template-columns:minmax(220px,2fr) minmax(110px,.7fr) minmax(110px,.7fr);gap:16px;margin-top:20px}.bulk-updater-field{display:flex;flex-direction:column;gap:7px}.bulk-updater-field label{font-size:13px;font-weight:600;color:#344054}
      .bulk-updater-field select,.bulk-updater-field input{height:42px;padding:0 11px;border:1px solid #d0d5dd;border-radius:8px;background:white;color:#101828;font:inherit;min-width:0}
      .bulk-updater-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.bulk-updater-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #d0d5dd;border-radius:8px;padding:10px 15px;background:white;color:#344054;font-weight:600;cursor:pointer}
      .bulk-updater-btn.primary{background:#175cd3;border-color:#175cd3;color:white}.bulk-updater-btn.danger{background:#b42318;border-color:#b42318;color:white}.bulk-updater-btn:disabled{opacity:.55;cursor:not-allowed}
      .bulk-updater-notice{display:flex;gap:10px;align-items:flex-start;padding:13px 15px;border-radius:9px;margin-top:16px;font-size:13px;line-height:1.5}.bulk-updater-notice.warning{background:#fffaeb;border:1px solid #fedf89;color:#93370d}.bulk-updater-notice.success{background:#ecfdf3;border:1px solid #abefc6;color:#067647}.bulk-updater-notice.error{background:#fef3f2;border:1px solid #fecdca;color:#b42318}
      .bulk-updater-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin:18px 0}.bulk-updater-stat{border:1px solid #eaecf0;border-radius:9px;padding:14px}.bulk-updater-stat span{display:block;color:#667085;font-size:12px;margin-bottom:7px}.bulk-updater-stat strong{font-size:24px;color:#101828}
      .bulk-updater-table-wrap{overflow:auto}.bulk-updater-table{width:100%;border-collapse:collapse;font-size:13px}.bulk-updater-table th,.bulk-updater-table td{text-align:left;padding:11px 12px;border-bottom:1px solid #eaecf0;white-space:nowrap}.bulk-updater-table th{color:#667085;background:#f9fafb;font-weight:600}.bulk-updater-status{display:inline-flex;align-items:center;gap:5px;text-transform:capitalize}.bulk-updater-confirm{border:1px solid #fda29b;background:#fff6f5;padding:16px;border-radius:9px;margin-top:16px}
      @media(max-width:700px){.bulk-updater-page{padding:18px 12px}.bulk-updater-form{grid-template-columns:1fr}.bulk-updater-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.bulk-updater-heading h1{font-size:23px}}
    `}</style>
    <div className="bulk-updater-wrap">
      <div className="bulk-updater-heading"><div><h1>Bulk Updater</h1><p>Run controlled batch updates against CRM records. Preview changes first, then explicitly confirm before any records are written.</p></div></div>
      <section className="bulk-updater-card">
        <h2>Choose an update</h2><p className="bulk-updater-muted">Only the listed, supported maintenance jobs can run here. Each job is authenticated and recorded in Integration Logs.</p>
        <div className="bulk-updater-form">
          <div className="bulk-updater-field"><label htmlFor="bulk-job">Bulk update job</label><select id="bulk-job" value={job} onChange={e=>{setJob(e.target.value);setResult(null);setMessage("");setError("");setConfirmExecute(false)}}>{JOBS.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select><span className="bulk-updater-muted">{selectedJob.description}</span></div>
          <div className="bulk-updater-field"><label htmlFor="bulk-limit">Batch size {selectedJob.kind==="glide"?"(all matching leads allowed)":"(max 250)"}</label><input id="bulk-limit" type="number" min="1" max={selectedJob.kind==="glide"?undefined:250} value={limit} onChange={e=>setLimit(e.target.value)}/></div>
          <div className="bulk-updater-field"><label htmlFor="bulk-offset">Offset</label><input id="bulk-offset" type="number" min="0" step="1" value={offset} onChange={e=>setOffset(e.target.value)}/></div>
        </div>
        <div className="bulk-updater-actions">
          <button className="bulk-updater-btn primary" disabled={busy} onClick={()=>runUpdater(false)}><Eye size={16}/>{busy?"Working…":"Preview changes"}</button>
          <button className="bulk-updater-btn" disabled={busy||!result||!((result.proposedFieldChanges ?? result.previewed ?? 0)>0)} onClick={()=>setConfirmExecute(true)}><Play size={16}/>{selectedJob.kind==="glide"?"Update leads in Supabase":"Review & run updates"}</button>
          {busy&&<span className="bulk-updater-muted" style={{alignSelf:"center"}}><RefreshCw size={14} style={{verticalAlign:"middle"}}/> Processing request…</span>}
        </div>
        <div className="bulk-updater-notice warning"><AlertTriangle size={18} style={{flexShrink:0}}/><div><strong>{selectedJob.kind==="glide"?"Glide live sync is protected.":"Preview before execution."}</strong> {selectedJob.kind==="glide"?"Only leads whose Glide last-time-called value differs from the CRM value are eligible for comparison and display. Leads with the same timestamp or a blank Glide timestamp are skipped. Preview is read-only; execution writes only differing, nonblank fields.":"Preview mode does not update deals. Execution writes only the fields targeted by the selected maintenance job. The batch size is capped at 250 records."}</div></div>
        {confirmExecute&&<div className="bulk-updater-confirm"><strong>Confirm production update</strong><p className="bulk-updater-muted">You are about to run “{selectedJob.title}” for up to {Math.min(selectedJob.kind==="glide"?Number.MAX_SAFE_INTEGER:250,Math.max(1,Number.parseInt(limit,10)||100))} records. This will write changes to Supabase. For Glide, only existing matched leads will be updated; blank source fields are skipped and no leads are inserted.</p><div className="bulk-updater-actions"><button className="bulk-updater-btn danger" disabled={busy} onClick={()=>runUpdater(true)}><Play size={16}/>Confirm and execute</button><button className="bulk-updater-btn" disabled={busy} onClick={()=>setConfirmExecute(false)}>Cancel</button></div></div>}
        {message&&<div className="bulk-updater-notice success"><CheckCircle2 size={18} style={{flexShrink:0}}/><span>{message}</span></div>}
        {error&&<div className="bulk-updater-notice error"><XCircle size={18} style={{flexShrink:0}}/><span>{error}</span></div>}
      </section>
      {result&&<><section className="bulk-updater-card"><h2>Run summary</h2><p className="bulk-updater-muted">{result.dryRun?"Preview only — no lead/deal records were changed.":"Execution results for this batch."} {result.totalMissing!=null?"Eligible records with missing values: "+result.totalMissing+".":""}</p><div className="bulk-updater-stats">{counts.map(item=><div className="bulk-updater-stat" key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></section>
        <section className="bulk-updater-card"><h2>Record details</h2><div className="bulk-updater-table-wrap"><table className="bulk-updater-table"><thead><tr><th>Row ID</th><th>Customer</th><th>Postcode</th><th>Changed fields</th><th>Details</th></tr></thead><tbody>
          {(result.sampleChangedRows||result.results||[]).map((row,index)=><tr key={row.rowId||row.dealId||index}><td>{row.rowId||row.dealId||"—"}</td><td>{[row.firstName,row.lastName].filter(Boolean).join(" ")||row.customerName||"—"}</td><td>{row.postcode||"—"}</td><td>{Array.isArray(row.changedFields)?row.changedFields.join(", "):row.installationStartDate||"—"}</td><td>{row.error||"—"}</td></tr>)}
          {!(result.sampleChangedRows||result.results||[]).length&&<tr><td colSpan="5">No differences returned for this run.</td></tr>}
        </tbody></table></div></section></>}
    </div>
  </div>
}

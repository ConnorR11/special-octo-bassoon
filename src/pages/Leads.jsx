import React, { useEffect, useMemo, useState } from "react"
import {
  Phone,
  PhoneCall,
  User,
  MapPin,
  Clock,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  CalendarDays,
  MessageSquare,
  ChevronRight,
  Timer,
  UserRound,
} from "lucide-react"
import { supabase } from "../lib/supabase"
import PhoneDialer from "../components/PhoneDialer"

const QUEUE_SELECT = [
  "delete_row_id",
  "first_name",
  "last_name",
  "salutations",
  "primary_phone_number",
  "secondary_phone_number",
  "email",
  "address",
  "postcode",
  "campaign",
  "lead_type",
  "disposition",
  "last_disposition",
  "marketing_note",
  "marketing_note_sales_app",
  "sales_note",
  "call_note",
  "last_call_note",
  "call_counter",
  "last_time_called",
  "last_called_by",
  "first_time_called",
  "first_called_by",
  "received_date_time",
  "received_at_parsed",
  "claimed_by",
  "claimed_at",
  "claim_expires_at",
  "call_count",
].join(",")

const RESULT_OPTIONS = [
  { key: "No Contact", label: "No Contact", icon: XCircle },
  { key: "Contacted", label: "Contacted", icon: CheckCircle2 },
  { key: "Appointment", label: "Appointment", icon: CalendarDays },
  { key: "Callback", label: "Callback", icon: Clock },
  { key: "Declined", label: "Declined", icon: XCircle },
  { key: "Invalid", label: "Invalid", icon: User },
]

function formatDateTime(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatAgo(value) {
  if (!value) return "Never"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const diff = Math.max(0, Date.now() - date.getTime())
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function displayName(lead) {
  const parts = [lead?.salutations, lead?.first_name, lead?.last_name]
    .map(value => String(value || "").trim())
    .filter(Boolean)
  return parts.join(" ") || "Unnamed lead"
}

function normaliseCount(value) {
  const n = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function isWithinThreeHours(value) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  return Date.now() - date.getTime() < 3 * 60 * 60 * 1000
}

function cardStyle(extra = {}) {
  return {
    background: "#fff",
    border: "1px solid #e4e9ef",
    borderRadius: 14,
    ...extra,
  }
}

export default function Leads() {
  const [currentLead, setCurrentLead] = useState(null)
  const [queuePreview, setQueuePreview] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingQueue, setLoadingQueue] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState("")
  const [note, setNote] = useState("")
  const [search, setSearch] = useState("")
  const [showDialer, setShowDialer] = useState(false)

  async function getCurrentUserId() {
    const { data, error: authError } = await supabase.auth.getUser()
    if (authError) throw authError
    return data?.user?.id || null
  }

  async function loadQueuePreview() {
    if (!supabase) return
    setLoadingQueue(true)
    try {
      const now = new Date().toISOString()
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()

      const { data, error: queryError } = await supabase
        .from("leads")
        .select(QUEUE_SELECT)
        .or(`last_called_at.is.null,last_called_at.lte.${threeHoursAgo}`)
        .or(`claim_expires_at.is.null,claim_expires_at.lte.${now}`)
        .order("call_count", { ascending: true })
        .order("received_at_parsed", { ascending: false, nullsFirst: false })
        .limit(12)

      if (queryError) throw queryError
      setQueuePreview(data || [])
    } catch (err) {
      console.error("Error loading leads queue:", err)
      setError(err?.message || "Unable to load leads queue.")
    } finally {
      setLoadingQueue(false)
    }
  }

  async function claimNextLead() {
    if (!supabase || loading) return
    setLoading(true)
    setError("")
    setResult("")
    setNote("")
    try {
      const { data, error: rpcError } = await supabase.rpc("claim_next_lead")
      if (rpcError) throw rpcError
      setCurrentLead(data || null)
      await loadQueuePreview()
    } catch (err) {
      console.error("Error claiming lead:", err)
      setError(err?.message || "Unable to claim the next lead.")
    } finally {
      setLoading(false)
    }
  }
  async function releaseCurrentLead() {
    if (!currentLead || !supabase) return
    try {
      const { error: releaseError } = await supabase.rpc("release_claimed_lead", {
        p_lead_id: currentLead.delete_row_id,
      })
      if (releaseError) throw releaseError
      setCurrentLead(null)
      setResult("")
      setNote("")
      await loadQueuePreview()
    } catch (err) {
      console.error("Error releasing lead:", err)
      setError(err?.message || "Unable to release the lead.")
    }
  }
  async function submitResult() {
    if (!currentLead || !result || saving || !supabase) return
    setSaving(true)
    setError("")
    try {
      const { error: resultError } = await supabase.rpc("result_claimed_lead", {
        p_lead_id: currentLead.delete_row_id,
        p_result: result,
        p_note: note || null,
      })
      if (resultError) throw resultError
      setCurrentLead(null)
      setResult("")
      setNote("")
      await loadQueuePreview()
    } catch (err) {
      console.error("Error saving lead result:", err)
      setError(err?.message || "Unable to save the lead result.")
      return
    } finally {
      setSaving(false)
    }
    await claimNextLead()
  }
  useEffect(() => {
    loadQueuePreview()
  }, [])

  const filteredPreview = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return queuePreview
    return queuePreview.filter(lead =>
      [displayName(lead), lead.primary_phone_number, lead.postcode, lead.campaign]
        .some(value => String(value || "").toLowerCase().includes(q))
    )
  }, [queuePreview, search])

  const leadAge = currentLead?.received_at_parsed
    ? formatAgo(currentLead.received_at_parsed)
    : formatAgo(currentLead?.received_date_time)

  return (
    <section>
      <style>{`
        .leads-page-grid {
          display:grid;
          grid-template-columns:minmax(0,1fr) 350px;
          gap:20px;
          align-items:start;
        }
        .leads-action-grid {
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:10px;
        }
        @media (max-width: 1050px) {
          .leads-page-grid { grid-template-columns:1fr; }
        }
        @media (max-width: 700px) {
          .leads-action-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
        }
      `}</style>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, marginBottom:20 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <PhoneCall size={23} />
            <h1 style={{ margin:0, fontSize:24 }}>Leads</h1>
          </div>
          <p style={{ margin:"6px 0 0", color:"#64748b" }}>
            Call-centre queue · freshest lead within the lowest call count first
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadQueuePreview()}
          disabled={loadingQueue}
          style={{ border:"1px solid #d7dee8", background:"#fff", color:"#334155", borderRadius:8, padding:"10px 14px", display:"inline-flex", alignItems:"center", gap:8, cursor:loadingQueue ? "default" : "pointer" }}
        >
          <RefreshCw size={16} className={loadingQueue ? "spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ ...cardStyle({ background:"#fff6f6", borderColor:"#fecaca", color:"#991b1b", padding:14, marginBottom:18, display:"flex", gap:10, alignItems:"center" }) }}>
          <XCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="leads-page-grid">
        <div>
          <div style={cardStyle({ padding:22 })}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:15, marginBottom:18 }}>
              <div>
                <div style={{ fontSize:12, textTransform:"uppercase", letterSpacing:"0.06em", color:"#94a3b8", fontWeight:800 }}>Current Lead</div>
                <h2 style={{ margin:"6px 0 0", fontSize:30 }}>{currentLead ? displayName(currentLead) : "No lead selected"}</h2>
              </div>
              {currentLead && (
                <div style={{ padding:"7px 11px", borderRadius:999, background:"#eef6ff", color:"#1d4ed8", fontWeight:800, fontSize:12 }}>
                  {normaliseCount(currentLead.call_count)} calls
                </div>
              )}
            </div>

            {!currentLead ? (
              <div style={{ textAlign:"center", padding:"65px 20px" }}>
                <div style={{ width:64, height:64, borderRadius:16, margin:"0 auto 16px", display:"flex", alignItems:"center", justifyContent:"center", background:"#f1f5f9" }}>
                  <Phone size={28} color="#17324d" />
                </div>
                <div style={{ fontSize:18, fontWeight:700, color:"#17324d" }}>Ready for the next lead</div>
                <div style={{ marginTop:7, color:"#64748b", fontSize:14 }}>
                  Fresh leads are prioritised, then older leads move up as call attempts increase.
                </div>
                <button
                  type="button"
                  onClick={claimNextLead}
                  disabled={loading}
                  style={{ marginTop:24, border:0, background:"#002d49", color:"#fff", borderRadius:10, padding:"13px 21px", fontSize:15, fontWeight:800, cursor:loading ? "default" : "pointer", display:"inline-flex", alignItems:"center", gap:9 }}
                >
                  <PhoneCall size={18} />
                  {loading ? "Finding lead…" : "Get Next Lead"}
                </button>
              </div>
            ) : (
              <>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:12, marginBottom:18 }}>
                  <Info label="Phone" value={currentLead.primary_phone_number || "—"} icon={<Phone size={16} />} />
                  <Info label="Campaign" value={currentLead.campaign || "—"} icon={<TargetIcon />} />
                  <Info label="Lead Age" value={leadAge} icon={<Clock size={16} />} />
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:14 }}>
                  <div style={cardStyle({ padding:16, background:"#fbfcfe" })}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9, fontWeight:800, color:"#17324d" }}>
                      <MapPin size={16} />
                      Address
                    </div>
                    <div style={{ color:"#475569", lineHeight:1.6 }}>
                      {currentLead.address || "—"}<br />
                      {currentLead.postcode || ""}
                    </div>
                  </div>

                  <div style={cardStyle({ padding:16, background:"#fbfcfe" })}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9, fontWeight:800, color:"#17324d" }}>
                      <MessageSquare size={16} />
                      Marketing Notes
                    </div>
                    <div style={{ color:"#475569", lineHeight:1.6, whiteSpace:"pre-wrap" }}>
                      {currentLead.marketing_note || currentLead.marketing_note_sales_app || "No notes"}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop:16, padding:16, borderRadius:12, background:"#f8fafc", border:"1px solid #e2e8f0" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:11 }}>
                    <div style={{ fontWeight:800, color:"#17324d" }}>Call outcome</div>
                    <div style={{ fontSize:12, color:"#64748b" }}>{currentLead.last_time_called ? `Last called ${formatAgo(currentLead.last_time_called)}` : "Fresh lead"}</div>
                  </div>
                  <div className="leads-action-grid">
                    {RESULT_OPTIONS.map(option => {
                      const Icon = option.icon
                      const active = result === option.key
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setResult(option.key)}
                          style={{
                            border:`1px solid ${active ? "#17324d" : "#dce3ea"}`,
                            background:active ? "#17324d" : "#fff",
                            color:active ? "#fff" : "#334155",
                            borderRadius:9,
                            padding:"12px 11px",
                            cursor:"pointer",
                            display:"flex",
                            alignItems:"center",
                            justifyContent:"center",
                            gap:7,
                            fontWeight:700,
                          }}
                        >
                          <Icon size={16} />
                          {option.label}
                        </button>
                      )
                    })}
                  </div>

                  <textarea
                    value={note}
                    onChange={event => setNote(event.target.value)}
                    placeholder="Add a call note…"
                    rows={3}
                    style={{ width:"100%", boxSizing:"border-box", marginTop:13, border:"1px solid #d7dee8", borderRadius:9, padding:"11px 12px", resize:"vertical", font:"inherit" }}
                  />

                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, marginTop:12 }}>
                    <button
                      type="button"
                      onClick={releaseCurrentLead}
                      disabled={saving}
                      style={{ border:"1px solid #d7dee8", background:"#fff", color:"#475569", borderRadius:9, padding:"11px 14px", cursor:saving ? "default" : "pointer" }}
                    >
                      Release
                    </button>
                    <button
                      type="button"
                      onClick={submitResult}
                      disabled={!result || saving}
                      style={{ border:0, background:!result || saving ? "#cbd5e1" : "#17804b", color:"#fff", borderRadius:9, padding:"11px 18px", fontWeight:800, cursor:!result || saving ? "default" : "pointer", display:"inline-flex", alignItems:"center", gap:8 }}
                    >
                      <CheckCircle2 size={17} />
                      {saving ? "Saving…" : "Save Result & Next Lead"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ ...cardStyle({ padding:18 }) }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, marginBottom:13 }}>
            <div>
              <div style={{ fontSize:11, textTransform:"uppercase", color:"#94a3b8", fontWeight:800, letterSpacing:"0.06em" }}>Queue</div>
              <h3 style={{ margin:"4px 0 0", fontSize:20 }}>Next Leads</h3>
            </div>
            <div style={{ fontSize:12, color:"#64748b" }}>{queuePreview.length} shown</div>
          </div>

          <div style={{ position:"relative", marginBottom:13 }}>
            <Search size={16} style={{ position:"absolute", left:11, top:11, color:"#94a3b8" }} />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search queue…"
              style={{ width:"100%", boxSizing:"border-box", padding:"10px 11px 10px 34px", border:"1px solid #d7dee8", borderRadius:9, font:"inherit" }}
            />
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {filteredPreview.length === 0 ? (
              <div style={{ textAlign:"center", color:"#64748b", padding:"35px 8px" }}>
                {loadingQueue ? "Loading queue…" : "No eligible leads found."}
              </div>
            ) : (
              filteredPreview.map((lead, index) => (
                <button
                  key={lead.delete_row_id || index}
                  type="button"
                  onClick={async () => {
                    setCurrentLead(lead)
                    setError("")
                    try {
                      const userId = await getCurrentUserId()
                      const now = new Date().toISOString()
                      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString()
                      const { data: claimed, error: claimError } = await supabase
                        .from("leads")
                        .update({ claimed_by:userId, claimed_at:now, claim_expires_at:expires })
                        .eq("delete_row_id", lead.delete_row_id)
                        .or(`claim_expires_at.is.null,claim_expires_at.lte.${now}`)
                        .select(QUEUE_SELECT)
                        .maybeSingle()
                      if (claimError) throw claimError
                      if (!claimed) {
                        setCurrentLead(null)
                        await loadQueuePreview()
                        setError("That lead was just claimed by another canvasser. The queue has been refreshed.")
                        return
                      }
                      setCurrentLead(claimed)
                      await loadQueuePreview()
                    } catch (err) {
                      console.error("Error claiming queue lead:", err)
                      setCurrentLead(null)
                      setError(err?.message || "Unable to claim that lead.")
                    }
                  }}
                  style={{ border:"1px solid #e6ebf0", background:"#fff", borderRadius:10, padding:11, textAlign:"left", cursor:"pointer", display:"grid", gridTemplateColumns:"1fr auto", gap:10, alignItems:"center" }}
                >
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:800, color:"#17324d", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{displayName(lead)}</div>
                    <div style={{ fontSize:12, color:"#64748b", marginTop:3 }}>
                      {lead.primary_phone_number || "No phone"} · {lead.postcode || "No postcode"}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:7, marginTop:6, fontSize:11, color:"#94a3b8" }}>
                      <span style={{ fontWeight:800, color:"#475569" }}>{normaliseCount(lead.call_count)} calls</span>
                      <span>·</span>
                      <span>{lead.received_at_parsed ? formatDateTime(lead.received_at_parsed) : "Received time unavailable"}</span>
                    </div>
                  </div>
                  <ChevronRight size={17} color="#94a3b8" />
                </button>
              ))
            )}
          </div>

          <div style={{ marginTop:15, paddingTop:14, borderTop:"1px solid #eef2f7", display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <MiniStat icon={<Timer size={15} />} label="3h rule" value="Enabled" />
            <MiniStat icon={<UserRound size={15} />} label="Claim lease" value="10 min" />
          </div>
        </div>
      </div>
    </section>
  )
}

function Info({ label, value, icon }) {
  return (
    <div style={cardStyle({ padding:14, background:"#fbfcfe" })}>
      <div style={{ display:"flex", alignItems:"center", gap:7, color:"#64748b", fontSize:11, textTransform:"uppercase", letterSpacing:"0.05em", fontWeight:800 }}>{icon}{label}</div>
      <div style={{ marginTop:7, color:"#17324d", fontWeight:800, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{value}</div>
    </div>
  )
}

function MiniStat({ icon, label, value }) {
  return (
    <div style={{ padding:10, borderRadius:9, background:"#f8fafc", border:"1px solid #eef2f7" }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, color:"#64748b", fontSize:11 }}>{icon}{label}</div>
      <div style={{ marginTop:4, fontWeight:800, color:"#17324d", fontSize:13 }}>{value}</div>
    </div>
  )
}

function TargetIcon() {
  return <span style={{ display:"inline-flex", width:16, justifyContent:"center" }}>◎</span>
}

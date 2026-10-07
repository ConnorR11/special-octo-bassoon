import React from "react"
import { Menu } from "lucide-react"
import { supabase } from "../lib/supabase"

const TRUSTPILOT_BREAKDOWN = [
  { rating: 5, label: "Excellent" },
  { rating: 4, label: "Great" },
  { rating: 3, label: "Average" },
  { rating: 2, label: "Poor" },
  { rating: 1, label: "Bad" },
]

export default function Reviews({ setMobile }) {
  const [reviews, setReviews] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [source, setSource] = React.useState("all")
  const [syncingGoogle, setSyncingGoogle] = React.useState(false)
  const [findingGoogleLocation, setFindingGoogleLocation] = React.useState(false)
  const [googleSyncMessage, setGoogleSyncMessage] = React.useState("")
  const [googleLocation, setGoogleLocation] = React.useState(null)

  React.useEffect(() => {
    loadReviews()
    const params = new URLSearchParams(window.location.search)
    if (params.get("google_reviews_connected") === "1") {
      setGoogleSyncMessage("Google Reviews connected. You can now find the Business Profile ID or import the reviews.")
      window.history.replaceState({}, "", window.location.pathname)
    }
    const googleError = params.get("google_reviews_error")
    if (googleError) {
      setGoogleSyncMessage(`Google Reviews connection failed: ${googleError}`)
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [])

  async function loadReviews() {
    setLoading(true)
    const { data, error } = await supabase.from("reviews").select("*").order("review_date", { ascending: false })
    if (!error) setReviews(data || [])
    setLoading(false)
  }

  function connectGoogleReviews() { window.location.href = "/api/google-reviews/auth" }

  async function findGoogleLocation() {
    setFindingGoogleLocation(true)
    setGoogleSyncMessage("")
    try {
      const response = await fetch("/api/google-reviews/find-location", { method: "POST" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const locationList = Array.isArray(data.locations) && data.locations.length
          ? ` Available profiles: ${data.locations.map((location) => `${location.businessName || "Unnamed"} (${location.locationId || "no location ID"})`).join(", ")}`
          : ""
        throw new Error(`${data.error || "Unable to find Google Business Profile."}${locationList}`)
      }
      setGoogleLocation(data)
      setGoogleSyncMessage(`Google Business Profile found: ${data.businessName || "Profile"}. Account ID: ${data.accountId}. Location ID: ${data.locationId}.`)
    } catch (error) {
      setGoogleSyncMessage(error instanceof Error ? error.message : String(error))
    } finally { setFindingGoogleLocation(false) }
  }

  async function syncGoogleReviews() {
    setSyncingGoogle(true)
    setGoogleSyncMessage("")
    try {
      const response = await fetch("/api/google-reviews/sync", { method: "POST" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok && response.status !== 207) throw new Error(data.error || "Google Reviews sync failed")
      const message = data.status === "partial"
        ? `Google Reviews partially imported: ${data.imported || 0} imported, ${data.failed || 0} failed.`
        : `Google Reviews imported successfully: ${data.imported || 0} review(s).`
      setGoogleSyncMessage(message)
      await loadReviews()
    } catch (error) {
      setGoogleSyncMessage(error instanceof Error ? error.message : String(error))
    } finally { setSyncingGoogle(false) }
  }

  const filteredReviews = source === "all" ? reviews : reviews.filter((review) => String(review.source || "").toLowerCase() === source)
  const matchedCount = filteredReviews.filter((review) => review.customer_id !== null && review.customer_id !== undefined && review.customer_id !== "").length

  const trustpilotReviews = reviews.filter((review) => String(review.source || "").toLowerCase() === "trustpilot" && !review.is_deleted)
  const googleReviews = reviews.filter((review) => String(review.source || "").toLowerCase() === "google" && !review.is_deleted)
  const trustpilotCount = trustpilotReviews.length
  const googleCount = googleReviews.length
  const realTrustpilotAverage = trustpilotCount
    ? trustpilotReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / trustpilotCount
    : null
  const googleRating = googleCount
    ? (googleReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / googleCount).toFixed(1)
    : "—"

  const latestByReviewer = new Map()
  for (const review of trustpilotReviews) {
    const key = String(review.reviewer_email || review.reviewer_name || review.external_review_id || review.id || "").trim().toLowerCase()
    const existing = latestByReviewer.get(key)
    if (!existing || new Date(review.review_date || review.created_at || 0) > new Date(existing.review_date || existing.created_at || 0)) {
      latestByReviewer.set(key, review)
    }
  }
  const scoreReviews = Array.from(latestByReviewer.values())
  const halfLifeDays = 365
  const now = new Date()
  let weightedTotal = 0
  let totalWeight = 0
  for (const review of scoreReviews) {
    const date = new Date(review.review_date || review.created_at || 0)
    const ageDays = Math.max(0, (now.getTime() - date.getTime()) / 86400000)
    const weight = Math.pow(0.5, ageDays / halfLifeDays)
    weightedTotal += Number(review.rating || 0) * weight
    totalWeight += weight
  }
  const priorWeight = 7
  const trustpilotStyleScore = totalWeight
    ? ((weightedTotal + 3.5 * priorWeight) / (totalWeight + priorWeight)).toFixed(1)
    : "—"

  const starCounts = React.useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    for (const review of trustpilotReviews) {
      const rating = Number(review.rating)
      if (counts[rating] !== undefined) counts[rating] += 1
    }
    return counts
  }, [trustpilotReviews])

  const newTrustpilotReviews = React.useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return trustpilotReviews.filter((review) => new Date(review.review_date || review.created_at || 0) >= start)
  }, [trustpilotReviews, now])

  const awaitingTrustpilotReply = React.useMemo(
    () => trustpilotReviews.filter((review) => !review.response_text || !String(review.response_text).trim()).length,
    [trustpilotReviews],
  )

  const starPercent = (rating) => trustpilotCount ? (starCounts[rating] / trustpilotCount) * 100 : 0

  return (
    <div className="reviews-page">
      <style>{`
        .reviews-page{box-sizing:border-box;width:100%;min-height:100vh;padding:28px;background:#f5f7fa}.reviews-container{width:100%;max-width:1500px;margin:0 auto}.reviews-mobile-menu{display:none;position:fixed;top:12px;left:12px;z-index:1100;width:44px;height:44px;border:1px solid #d0d5dd;border-radius:9px;background:#fff;color:#344054;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.12);cursor:pointer}.reviews-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:18px}.reviews-title{margin:0;font-size:28px;line-height:1.2}.reviews-subtitle{margin:6px 0 0;color:#667085;font-size:14px}.reviews-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;flex-shrink:0}.reviews-button{min-height:42px;padding:10px 15px;border-radius:8px;cursor:pointer;font-weight:600;white-space:nowrap;box-sizing:border-box}.reviews-button-secondary{border:1px solid #d0d5dd;background:#fff;color:#101828}.reviews-button-primary{border:1px solid #111827;background:#111827;color:#fff}.reviews-button-primary:disabled{background:#d1d5db;border-color:#d1d5db;color:#667085;cursor:default}.reviews-message{margin-top:14px;padding:11px 14px;border-radius:8px;background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3;font-size:14px;overflow-wrap:anywhere}.reviews-location{margin-top:14px;padding:14px;border-radius:8px;background:#fff;border:1px solid #d0d5dd;font-size:13px}.reviews-location-row{display:flex;gap:20px;flex-wrap:wrap;margin-top:8px}.reviews-location-value{font-family:monospace;word-break:break-all}
        .reviews-top-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(330px,.95fr);gap:16px;align-items:stretch;margin:0 0 24px}.trustpilot-dashboard{margin:0}.google-review-card{box-sizing:border-box;background:#fff;border:1px solid #dadce0;border-radius:14px;padding:20px;min-width:0;box-shadow:0 1px 2px rgba(60,64,67,.08)}.google-review-header{display:flex;align-items:center;justify-content:space-between;gap:12px}.google-review-brand{display:flex;align-items:center;gap:10px;font-size:18px;font-weight:600;color:#202124}.google-logo{font-size:24px;font-weight:700;font-family:Arial,sans-serif;background:linear-gradient(90deg,#4285f4 0 25%,#34a853 25% 50%,#fbbc05 50% 75%,#ea4335 75%);-webkit-background-clip:text;background-clip:text;color:transparent}.google-review-label{font-size:12px;color:#5f6368}.google-review-rating-row{display:flex;align-items:center;gap:10px;margin-top:18px}.google-review-rating{font-size:32px;line-height:1;font-weight:500;color:#202124}.google-review-stars{display:flex;gap:2px;color:#fbbc04;font-size:21px;line-height:1}.google-review-count{margin-top:7px;font-size:12px;color:#5f6368}.google-review-divider{height:1px;background:#e8eaed;margin:17px 0 15px}.google-review-summary{display:flex;align-items:center;gap:14px}.google-review-summary-rating{font-size:34px;line-height:1;font-weight:500;color:#202124}.google-review-summary-details{display:flex;flex-direction:column;gap:6px}.google-review-summary-stars{display:flex;gap:2px;color:#fbbc04;font-size:22px;line-height:1}.google-review-summary-count{font-size:12px;color:#5f6368}.google-review-footer{margin-top:16px;font-size:11px;color:#5f6368}.google-review-footer strong{color:#202124}.trustpilot-dashboard-title{margin:0 0 10px;font-size:16px;font-weight:600;color:#101828}.trustpilot-dashboard-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(210px,.7fr) minmax(210px,.7fr);gap:14px}.trustpilot-card{box-sizing:border-box;background:#fff;border:1px solid #ddd9d4;border-radius:14px;padding:22px;min-height:128px}.trustpilot-score-card{position:relative}.trustpilot-card-title{font-size:13px;color:#344054;display:flex;align-items:center;gap:6px}.trustpilot-info{display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;border-radius:50%;background:#667085;color:#fff;font-size:9px;font-weight:700}.trustpilot-score-row{display:flex;align-items:center;gap:9px;margin-top:7px}.trustpilot-score{font-size:28px;line-height:1;font-weight:700;color:#101828}.trustpilot-stars{display:flex;gap:2px}.trustpilot-star-box{display:flex;align-items:center;justify-content:center;width:22px;height:22px;background:#00b67a;color:#fff;font-size:15px;line-height:1}.trustpilot-card-subtitle{margin-top:9px;font-size:12px;color:#475467}.trustpilot-new-value{margin-top:8px;font-size:25px;line-height:1;font-weight:700;color:#101828}.trustpilot-new-date{margin-top:9px;font-size:11px;color:#667085}.trustpilot-new-date:before{content:"▣";margin-right:7px;color:#98a2b3}.trustpilot-awaiting{margin-top:9px;font-size:13px;color:#475467;line-height:1.45}.trustpilot-awaiting strong{color:#101828}.trustpilot-breakdown{margin-top:14px}.trustpilot-breakdown-card{padding:18px 22px}.trustpilot-breakdown-title{font-size:13px;color:#344054;margin-bottom:16px}.trustpilot-breakdown-row{display:grid;grid-template-columns:60px minmax(80px,1fr) 45px;align-items:center;gap:10px;margin:10px 0}.trustpilot-breakdown-label{font-size:13px;color:#101828}.trustpilot-bar-track{height:9px;background:#eeeae6;border-radius:4px;overflow:hidden}.trustpilot-bar-fill{height:100%;background:#00b67a;border-radius:4px;min-width:0}.trustpilot-breakdown-percent{text-align:right;font-size:13px;color:#101828}.trustpilot-dashboard-note{margin-top:8px;font-size:11px;color:#667085}
        .reviews-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:0 0 22px}.reviews-stat{min-width:0;box-sizing:border-box;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px}.reviews-stat-title{font-size:13px;color:#667085}.reviews-stat-value{margin-top:6px;font-size:26px;line-height:1.2;font-weight:700}.reviews-stat-subtitle{margin-top:5px;font-size:12px;color:#667085}.reviews-stat-trustpilot{border-left:4px solid #00b67a}.reviews-stat-google{border-left:4px solid #4285f4}.reviews-stat-real{border-left:4px solid #667085}.reviews-panel{box-sizing:border-box;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px}.reviews-panel-header{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:18px}.reviews-panel-title{margin:0;font-size:18px}.reviews-panel-description{margin:4px 0 0;color:#667085;font-size:13px}.reviews-filter{flex:0 0 auto;box-sizing:border-box;min-height:38px;padding:8px 12px;border:1px solid #d0d5dd;border-radius:8px;background:#fff;color:#101828}.reviews-table-wrap{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}.reviews-table{width:100%;min-width:720px;border-collapse:collapse;table-layout:fixed}.reviews-table th{text-align:left;padding:11px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#667085;font-weight:600}.reviews-table td{padding:13px 10px;border-bottom:1px solid #f2f4f7;vertical-align:top;overflow-wrap:anywhere;word-break:break-word}.reviews-source{font-weight:600;text-transform:capitalize}.reviews-rating{white-space:nowrap;letter-spacing:1px}.reviews-review{max-width:500px;line-height:1.45}.reviews-date,.reviews-status{white-space:nowrap}.reviews-empty{padding:50px 20px;text-align:center;color:#667085}
        @media(max-width:1100px){.reviews-top-grid{grid-template-columns:1fr}.trustpilot-dashboard-grid{grid-template-columns:1fr 1fr}.trustpilot-breakdown-card{grid-column:1/-1}.reviews-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:900px){.reviews-page{padding:20px}.reviews-header{flex-direction:column;gap:16px}.reviews-actions{width:100%;justify-content:flex-start}.reviews-button{flex:1 1 220px}.reviews-mobile-menu{display:flex}.trustpilot-dashboard-grid{grid-template-columns:1fr 1fr}}
        @media(max-width:700px){.reviews-page{padding:14px}.reviews-title{font-size:24px}.reviews-subtitle{font-size:13px}.reviews-actions{display:grid;grid-template-columns:1fr;width:100%}.reviews-button{width:100%}.trustpilot-dashboard{margin-bottom:18px}.trustpilot-dashboard-grid{grid-template-columns:1fr;gap:10px}.trustpilot-card{min-height:0;padding:16px}.trustpilot-breakdown-card{padding:16px}.trustpilot-score{font-size:25px}.trustpilot-breakdown-row{grid-template-columns:60px minmax(60px,1fr) 42px;gap:8px}.reviews-stats{grid-template-columns:1fr;gap:10px;margin-bottom:14px}.reviews-stat{padding:14px}.reviews-stat-value{font-size:23px}.reviews-panel{padding:14px;border-radius:10px}.reviews-panel-header{flex-direction:column;align-items:stretch;gap:12px}.reviews-filter{width:100%}.reviews-table{min-width:0;table-layout:auto}.reviews-table th,.reviews-table td{padding:10px 7px}.reviews-table th:nth-child(1),.reviews-table td:nth-child(1),.reviews-table th:nth-child(5),.reviews-table td:nth-child(5),.reviews-table th:nth-child(6),.reviews-table td:nth-child(6){display:none}.reviews-table th:nth-child(2){width:28%}.reviews-table th:nth-child(3){width:22%}.reviews-table th:nth-child(4){width:50%}.reviews-rating{letter-spacing:0;font-size:13px}.reviews-review{max-width:none;line-height:1.4}}
        @media(max-width:420px){.reviews-page{padding:10px}.reviews-panel{padding:11px}.reviews-title{font-size:22px}.reviews-table th,.reviews-table td{padding:9px 5px;font-size:12px}.reviews-table th{font-size:11px}}
      `}</style>
      {setMobile && <button type="button" className="reviews-mobile-menu" onClick={() => setMobile((current) => !current)} aria-label="Open menu"><Menu size={22} /></button>}
      <div className="reviews-container">
        <div className="reviews-header">
          <div><h1 className="reviews-title">Reviews</h1><p className="reviews-subtitle">Google and Trustpilot reviews linked to CRM customers.</p></div>
          <div className="reviews-actions"><button type="button" onClick={connectGoogleReviews} className="reviews-button reviews-button-secondary">Connect Google Reviews</button><button type="button" onClick={findGoogleLocation} disabled={findingGoogleLocation} className="reviews-button reviews-button-secondary">{findingGoogleLocation ? "Finding Profile…" : "Find Google Business Profile ID"}</button><button type="button" onClick={syncGoogleReviews} disabled={syncingGoogle} className="reviews-button reviews-button-primary">{syncingGoogle ? "Importing…" : "Import Google Reviews"}</button></div>
        </div>

        <div className="reviews-top-grid">
          <section className="trustpilot-dashboard">
          <h2 className="trustpilot-dashboard-title">Service reviews</h2>
          <div className="trustpilot-dashboard-grid">
            <div className="trustpilot-card trustpilot-score-card">
              <div className="trustpilot-card-title">Current TrustScore <span className="trustpilot-info">i</span></div>
              <div className="trustpilot-score-row"><div className="trustpilot-score">{trustpilotStyleScore}</div><div className="trustpilot-stars" aria-label={`${trustpilotStyleScore} out of 5`}>{[1,2,3,4,5].map((star) => <span key={star} className="trustpilot-star-box">★</span>)}</div></div>
              <div className="trustpilot-card-subtitle">Based on {trustpilotCount.toLocaleString("en-GB")} Trustpilot reviews stored in the CRM</div>
            </div>
            <div className="trustpilot-card"><div className="trustpilot-card-title">New service reviews <span className="trustpilot-info">i</span></div><div className="trustpilot-new-value">{newTrustpilotReviews.length.toLocaleString("en-GB")}</div><div className="trustpilot-new-date">Since {new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div></div>
            <div className="trustpilot-card"><div className="trustpilot-card-title">Awaiting reply <span className="trustpilot-info">i</span></div><div className="trustpilot-new-value">{awaitingTrustpilotReply.toLocaleString("en-GB")}</div><div className="trustpilot-awaiting">{awaitingTrustpilotReply === 0 ? "All Trustpilot reviews have a CRM response." : <><strong>{awaitingTrustpilotReply}</strong> Trustpilot reviews currently have no response in the CRM.</>}</div></div>
            <div className="trustpilot-card trustpilot-breakdown-card">
              <div className="trustpilot-breakdown-title">Distribution of stars <span className="trustpilot-info">i</span></div>
              {TRUSTPILOT_BREAKDOWN.map(({ rating, label }) => <div className="trustpilot-breakdown-row" key={rating}><div className="trustpilot-breakdown-label">{label}</div><div className="trustpilot-bar-track"><div className="trustpilot-bar-fill" style={{ width: `${starPercent(rating)}%` }} /></div><div className="trustpilot-breakdown-percent">{starPercent(rating).toFixed(0)}%</div></div>)}
              <div className="trustpilot-dashboard-note">Distribution is calculated from the active Trustpilot reviews currently stored in the CRM.</div>
            </div>
          </div>
        </section>

          <aside className="google-review-card">
            <div className="google-review-header">
              <div className="google-review-brand"><span className="google-logo">G</span><span>Google</span></div>
              <span className="google-review-label">Reviews</span>
            </div>
            <div className="google-review-summary">
              <div className="google-review-summary-rating">{googleRating}</div>
              <div className="google-review-summary-details">
                <div className="google-review-summary-stars" aria-label="Google rating">{[1,2,3,4,5].map((star) => <span key={star}>★</span>)}</div>
                <div className="google-review-summary-count">{googleCount.toLocaleString("en-GB")} reviews</div>
              </div>
            </div>
            <div className="google-review-divider" />
            <div className="google-review-footer">Based on <strong>{googleCount.toLocaleString("en-GB")}</strong> Google reviews stored in the CRM.</div>
          </aside>
        </div>

        <div className="reviews-stats">
          <div className="reviews-stat reviews-stat-trustpilot"><div className="reviews-stat-title">Trustpilot Style Score</div><div className="reviews-stat-value">{trustpilotStyleScore === "—" ? "—" : `${trustpilotStyleScore} / 5`}</div><div className="reviews-stat-subtitle">CRM estimate using the stored review history</div></div>
          <div className="reviews-stat reviews-stat-real"><div className="reviews-stat-title">Trustpilot Real Average</div><div className="reviews-stat-value">{realTrustpilotAverage === null ? "—" : `${realTrustpilotAverage.toFixed(2)} / 5`}</div><div className="reviews-stat-subtitle">Simple average of stored reviews</div></div>
          <div className="reviews-stat reviews-stat-google"><div className="reviews-stat-title">Google Reviews</div><div className="reviews-stat-value">{googleCount.toLocaleString("en-GB")}</div><div className="reviews-stat-subtitle">{googleRating === "—" ? "No Google reviews imported" : `${googleRating} / 5 average`}</div></div>
          <Stat title="Matched to Customers" value={matchedCount} />
        </div>

        {googleSyncMessage && <div className="reviews-message">{googleSyncMessage}</div>}
        {googleLocation && <div className="reviews-location"><strong>{googleLocation.businessName || "Google Business Profile"}</strong><div className="reviews-location-row"><div>Account ID: <span className="reviews-location-value">{googleLocation.accountId}</span></div><div>Location ID: <span className="reviews-location-value">{googleLocation.locationId}</span></div></div></div>}

        <div className="reviews-panel">
          <div className="reviews-panel-header"><div><h2 className="reviews-panel-title">Review Database</h2><p className="reviews-panel-description">Reviews will appear here once connected to Google or Trustpilot.</p></div><select value={source} onChange={(e) => setSource(e.target.value)} className="reviews-filter"><option value="all">All Sources</option><option value="google">Google</option><option value="trustpilot">Trustpilot</option></select></div>
          {loading ? <div className="reviews-empty">Loading reviews…</div> : filteredReviews.length === 0 ? <div className="reviews-empty">No reviews have been imported yet.</div> : <div className="reviews-table-wrap"><table className="reviews-table"><thead><tr><th>Source</th><th>Customer</th><th>Rating</th><th>Review</th><th>Date</th><th>Status</th></tr></thead><tbody>{filteredReviews.map((review) => <tr key={review.id}><td className="reviews-source">{review.source}</td><td>{review.reviewer_name || "Unknown"}</td><td className="reviews-rating">{"★".repeat(Number(review.rating || 0))}</td><td className="reviews-review">{review.review_text || "—"}</td><td className="reviews-date">{review.review_date ? new Date(review.review_date).toLocaleDateString("en-GB") : "—"}</td><td className="reviews-status">{review.customer_id !== null && review.customer_id !== undefined && review.customer_id !== "" ? "Matched" : "Unmatched"}</td></tr>)}</tbody></table></div>}
        </div>
      </div>
    </div>
  )
}

function Stat({ title, value }) { return <div className="reviews-stat"><div className="reviews-stat-title">{title}</div><div className="reviews-stat-value">{value}</div></div> }

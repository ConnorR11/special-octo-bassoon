import React from "react"
import { Menu } from "lucide-react"
import { supabase } from "../lib/supabase"

const TRUSTPILOT_RATING = "4.8 / 5"
const TRUSTPILOT_COUNT = 2302
const GOOGLE_RATING = "4.9 / 5"
const GOOGLE_COUNT = 1358

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

  const filteredReviews = source === "all" ? reviews : reviews.filter((review) => review.source === source)
  const matchedCount = filteredReviews.filter((review) => review.customer_id !== null && review.customer_id !== undefined && review.customer_id !== "").length

  return (
    <div className="reviews-page">
      <style>{`
        .reviews-page{box-sizing:border-box;width:100%;min-height:100vh;padding:28px;background:#f5f7fa}.reviews-container{width:100%;max-width:1500px;margin:0 auto}.reviews-mobile-menu{display:none;position:fixed;top:12px;left:12px;z-index:1100;width:44px;height:44px;border:1px solid #d0d5dd;border-radius:9px;background:#fff;color:#344054;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.12);cursor:pointer}.reviews-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:18px}.reviews-title{margin:0;font-size:28px;line-height:1.2}.reviews-subtitle{margin:6px 0 0;color:#667085;font-size:14px}.reviews-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;flex-shrink:0}.reviews-button{min-height:42px;padding:10px 15px;border-radius:8px;cursor:pointer;font-weight:600;white-space:nowrap;box-sizing:border-box}.reviews-button-secondary{border:1px solid #d0d5dd;background:#fff;color:#101828}.reviews-button-primary{border:1px solid #111827;background:#111827;color:#fff}.reviews-button-primary:disabled{background:#d1d5db;border-color:#d1d5db;color:#667085;cursor:default}.reviews-message{margin-top:14px;padding:11px 14px;border-radius:8px;background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3;font-size:14px;overflow-wrap:anywhere}.reviews-location{margin-top:14px;padding:14px;border-radius:8px;background:#fff;border:1px solid #d0d5dd;font-size:13px}.reviews-location-row{display:flex;gap:20px;flex-wrap:wrap;margin-top:8px}.reviews-location-value{font-family:monospace;word-break:break-all}.reviews-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:0 0 22px}.reviews-stat{min-width:0;box-sizing:border-box;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px}.reviews-stat-title{font-size:13px;color:#667085}.reviews-stat-value{margin-top:6px;font-size:26px;line-height:1.2;font-weight:700}.reviews-stat-subtitle{margin-top:5px;font-size:12px;color:#667085}.reviews-stat-trustpilot{border-left:4px solid #00b67a}.reviews-stat-google{border-left:4px solid #4285f4}.reviews-panel{box-sizing:border-box;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px}.reviews-panel-header{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:18px}.reviews-panel-title{margin:0;font-size:18px}.reviews-panel-description{margin:4px 0 0;color:#667085;font-size:13px}.reviews-filter{flex:0 0 auto;box-sizing:border-box;min-height:38px;padding:8px 12px;border:1px solid #d0d5dd;border-radius:8px;background:#fff;color:#101828}.reviews-table-wrap{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}.reviews-table{width:100%;min-width:720px;border-collapse:collapse;table-layout:fixed}.reviews-table th{text-align:left;padding:11px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#667085;font-weight:600}.reviews-table td{padding:13px 10px;border-bottom:1px solid #f2f4f7;vertical-align:top;overflow-wrap:anywhere;word-break:break-word}.reviews-source{font-weight:600;text-transform:capitalize}.reviews-rating{white-space:nowrap;letter-spacing:1px}.reviews-review{max-width:500px;line-height:1.45}.reviews-date,.reviews-status{white-space:nowrap}.reviews-empty{padding:50px 20px;text-align:center;color:#667085}@media(max-width:1100px){.reviews-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:900px){.reviews-page{padding:20px}.reviews-header{flex-direction:column;gap:16px}.reviews-actions{width:100%;justify-content:flex-start}.reviews-button{flex:1 1 220px}.reviews-mobile-menu{display:flex}}@media(max-width:700px){.reviews-page{padding:14px}.reviews-title{font-size:24px}.reviews-subtitle{font-size:13px}.reviews-actions{display:grid;grid-template-columns:1fr;width:100%}.reviews-button{width:100%}.reviews-stats{grid-template-columns:1fr;gap:10px;margin-bottom:14px}.reviews-stat{padding:14px}.reviews-stat-value{font-size:23px}.reviews-panel{padding:14px;border-radius:10px}.reviews-panel-header{flex-direction:column;align-items:stretch;gap:12px}.reviews-filter{width:100%}.reviews-table{min-width:0;table-layout:auto}.reviews-table th,.reviews-table td{padding:10px 7px}.reviews-table th:nth-child(1),.reviews-table td:nth-child(1),.reviews-table th:nth-child(5),.reviews-table td:nth-child(5),.reviews-table th:nth-child(6),.reviews-table td:nth-child(6){display:none}.reviews-table th:nth-child(2){width:28%}.reviews-table th:nth-child(3){width:22%}.reviews-table th:nth-child(4){width:50%}.reviews-rating{letter-spacing:0;font-size:13px}.reviews-review{max-width:none;line-height:1.4}}@media(max-width:420px){.reviews-page{padding:10px}.reviews-panel{padding:11px}.reviews-title{font-size:22px}.reviews-table th,.reviews-table td{padding:9px 5px;font-size:12px}.reviews-table th{font-size:11px}}
      `}</style>
      {setMobile && <button type="button" className="reviews-mobile-menu" onClick={() => setMobile((current) => !current)} aria-label="Open menu"><Menu size={22} /></button>}
      <div className="reviews-container">
        <div className="reviews-header">
          <div><h1 className="reviews-title">Reviews</h1><p className="reviews-subtitle">Google and Trustpilot reviews linked to CRM customers.</p></div>
          <div className="reviews-actions"><button type="button" onClick={connectGoogleReviews} className="reviews-button reviews-button-secondary">Connect Google Reviews</button><button type="button" onClick={findGoogleLocation} disabled={findingGoogleLocation} className="reviews-button reviews-button-secondary">{findingGoogleLocation ? "Finding Profile…" : "Find Google Business Profile ID"}</button><button type="button" onClick={syncGoogleReviews} disabled={syncingGoogle} className="reviews-button reviews-button-primary">{syncingGoogle ? "Importing…" : "Import Google Reviews"}</button></div>
        </div>
        <div className="reviews-stats">
          <div className="reviews-stat reviews-stat-trustpilot"><div className="reviews-stat-title">Trustpilot Rating</div><div className="reviews-stat-value">{TRUSTPILOT_RATING}</div><div className="reviews-stat-subtitle">{TRUSTPILOT_COUNT.toLocaleString("en-GB")} reviews</div></div>
          <div className="reviews-stat reviews-stat-google"><div className="reviews-stat-title">Google Reviews</div><div className="reviews-stat-value">{GOOGLE_COUNT.toLocaleString("en-GB")}</div><div className="reviews-stat-subtitle">{GOOGLE_RATING}</div></div>
          <Stat title="CRM Reviews" value={reviews.length} />
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

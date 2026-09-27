import React from "react"
import { supabase } from "../lib/supabase"

export default function Reviews() {
  const [reviews, setReviews] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [source, setSource] = React.useState("all")

  React.useEffect(() => {
    loadReviews()
  }, [])

  async function loadReviews() {
    setLoading(true)
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .order("review_date", { ascending: false })

    if (!error) setReviews(data || [])
    setLoading(false)
  }

  const filteredReviews = source === "all" ? reviews : reviews.filter((review) => review.source === source)
  const average = filteredReviews.length
    ? (filteredReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / filteredReviews.length).toFixed(1)
    : "—"
  const matchedCount = filteredReviews.filter((review) => review.customer_id !== null && review.customer_id !== undefined && review.customer_id !== "").length

  return (
    <div style={{ padding: 28, background: "#f5f7fa", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1500, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 28 }}>Reviews</h1>
          <p style={{ margin: "6px 0 0", color: "#667085" }}>Google and Trustpilot reviews linked to CRM customers.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 22 }}>
          <Stat title="Total Reviews" value={filteredReviews.length} />
          <Stat title="Average Rating" value={average === "—" ? average : `${average} / 5`} />
          <Stat title="Matched to Customers" value={matchedCount} />
        </div>

        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Review Database</h2>
              <p style={{ margin: "4px 0 0", color: "#667085", fontSize: 13 }}>Reviews will appear here once connected to Google or Trustpilot.</p>
            </div>
            <select value={source} onChange={(e) => setSource(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #d0d5dd", borderRadius: 8 }}>
              <option value="all">All Sources</option>
              <option value="google">Google</option>
              <option value="trustpilot">Trustpilot</option>
            </select>
          </div>

          {loading ? <div style={{ padding: 30, textAlign: "center", color: "#667085" }}>Loading reviews…</div> : filteredReviews.length === 0 ? (
            <div style={{ padding: 50, textAlign: "center", color: "#667085" }}>No reviews have been imported yet.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Source", "Customer", "Rating", "Review", "Date", "Status"].map((heading) => <th key={heading} style={{ textAlign: "left", padding: "11px 10px", borderBottom: "1px solid #e5e7eb", fontSize: 12, color: "#667085" }}>{heading}</th>)}</tr></thead>
                <tbody>{filteredReviews.map((review) => <tr key={review.id}>
                  <td style={{ padding: "13px 10px", borderBottom: "1px solid #f2f4f7", fontWeight: 600, textTransform: "capitalize" }}>{review.source}</td>
                  <td style={{ padding: "13px 10px", borderBottom: "1px solid #f2f4f7" }}>{review.reviewer_name || "Unknown"}</td>
                  <td style={{ padding: "13px 10px", borderBottom: "1px solid #f2f4f7" }}>{"★".repeat(Number(review.rating || 0))}</td>
                  <td style={{ padding: "13px 10px", borderBottom: "1px solid #f2f4f7", maxWidth: 500 }}>{review.review_text || "—"}</td>
                  <td style={{ padding: "13px 10px", borderBottom: "1px solid #f2f4f7", whiteSpace: "nowrap" }}>{review.review_date ? new Date(review.review_date).toLocaleDateString("en-GB") : "—"}</td>
                  <td style={{ padding: "13px 10px", borderBottom: "1px solid #f2f4f7" }}>{review.customer_id !== null && review.customer_id !== undefined && review.customer_id !== "" ? "Matched" : "Unmatched"}</td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ title, value }) {
  return <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18 }}><div style={{ fontSize: 13, color: "#667085" }}>{title}</div><div style={{ marginTop: 6, fontSize: 26, fontWeight: 700 }}>{value}</div></div>
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => {
    const index = part.indexOf("=")
    if (index < 0) return [part.trim(), ""]
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]
  }).filter(([key]) => key))
}

async function getAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  })
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  const data = await response.json()
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "Unable to refresh Google access token")
  return data.access_token
}

async function gsc(accessToken, path, options = {}) {
  const response = await fetch(`https://searchconsole.googleapis.com${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(options.headers || {}) },
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || data.error || "Google Search Console request failed")
  return data
}

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function dateRange(days = 28) {
  const end = new Date()
  end.setDate(end.getDate() - 3)
  const start = new Date(end)
  start.setDate(start.getDate() - days + 1)
  return { startDate: isoDate(start), endDate: isoDate(end) }
}

export default async function handler(req, res) {
  const refreshToken = parseCookies(req.headers.cookie).gsc_refresh_token
  if (!refreshToken) return res.status(401).json({ connected: false, error: "Google Search Console is not connected." })

  try {
    const accessToken = await getAccessToken(refreshToken)
    const sites = await gsc(accessToken, "/webmasters/v3/sites")
    const requestedSite = process.env.GSC_SITE_URL
    const site = (sites.siteEntry || []).find((item) => requestedSite ? item.siteUrl === requestedSite : /homeshield/i.test(item.siteUrl)) || sites.siteEntry?.[0]

    if (!site) return res.status(404).json({ connected: true, sites: [] })

    const { startDate, endDate } = dateRange(28)
    const query = async (dimensions, rowLimit = 10) => gsc(accessToken, `/webmasters/v3/sites/${encodeURIComponent(site.siteUrl)}/searchAnalytics/query`, {
      method: "POST",
      body: JSON.stringify({ startDate, endDate, dimensions, rowLimit, dataState: "final" }),
    })

    const [summary, queries, pages] = await Promise.all([
      query([], 1),
      query(["query"], 10),
      query(["page"], 10),
    ])

    const totals = summary.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 }
    return res.status(200).json({
      connected: true,
      siteUrl: site.siteUrl,
      startDate,
      endDate,
      totals: {
        clicks: totals.clicks || 0,
        impressions: totals.impressions || 0,
        ctr: totals.ctr || 0,
        position: totals.position || 0,
      },
      queries: (queries.rows || []).map((row) => ({ query: row.keys?.[0] || "", clicks: row.clicks || 0, impressions: row.impressions || 0, ctr: row.ctr || 0, position: row.position || 0 })),
      pages: (pages.rows || []).map((row) => ({ page: row.keys?.[0] || "", clicks: row.clicks || 0, impressions: row.impressions || 0, ctr: row.ctr || 0, position: row.position || 0 })),
    })
  } catch (err) {
    console.error("GSC data error:", err)
    return res.status(502).json({ connected: true, error: err?.message || "Unable to load Google Search Console data." })
  }
}

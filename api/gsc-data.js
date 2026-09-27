function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => {
    const index = part.indexOf("=")
    if (index < 0) return [part.trim(), ""]
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]
  }).filter(([key]) => key))
}

async function getAccessToken(refreshToken) {
  const body = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", refresh_token: refreshToken, grant_type: "refresh_token" })
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body })
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

async function fetchText(url) {
  const response = await fetch(url, { headers: { "User-Agent": "Homeshield-CRM-SEO/1.0" } })
  if (!response.ok) throw new Error(`Unable to fetch ${url}: ${response.status}`)
  return response.text()
}

async function getSitemapPages(siteUrl) {
  try {
    const origin = new URL(siteUrl).origin
    const sitemapUrl = `${origin}/sitemap.xml`
    const xml = await fetchText(sitemapUrl)
    const locs = [...xml.matchAll(/<loc>\\s*([^<]+?)\\s*<\\/loc>/gi)].map((match) => match[1].trim())

    if (/sitemapindex/i.test(xml)) {
      const nested = await Promise.all(locs.slice(0, 10).map(async (url) => {
        try {
          const childXml = await fetchText(url)
          return [...childXml.matchAll(/<loc>\\s*([^<]+?)\\s*<\\/loc>/gi)].map((match) => match[1].trim())
        } catch {
          return []
        }
      }))
      return [...new Set(nested.flat())]
    }

    return [...new Set(locs)]
  } catch (error) {
    console.warn("Sitemap unavailable:", error?.message || error)
    return []
  }
}

function isoDate(date) { return date.toISOString().slice(0, 10) }
function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function getDateRange(req) {
  const availableEnd = new Date()
  availableEnd.setUTCHours(0, 0, 0, 0)
  availableEnd.setUTCDate(availableEnd.getUTCDate() - 3)
  const requestedStart = req.query?.startDate
  const requestedEnd = req.query?.endDate

  if (requestedStart || requestedEnd) {
    const start = parseDate(requestedStart)
    const requestedEndDate = parseDate(requestedEnd)
    if (!start || !requestedEndDate) throw new Error("Invalid date range. Please choose valid start and end dates.")
    const end = requestedEndDate > availableEnd ? availableEnd : requestedEndDate
    if (start > end) throw new Error("The start date must be before the end date.")
    return { startDate: isoDate(start), endDate: isoDate(end), rangeKey: "custom" }
  }

  const rangeKey = String(req.query?.range || "28")
  const start = new Date(availableEnd)
  if (rangeKey === "3m") start.setUTCMonth(start.getUTCMonth() - 3)
  else if (rangeKey === "6m") start.setUTCMonth(start.getUTCMonth() - 6)
  else if (rangeKey === "12m") start.setUTCFullYear(start.getUTCFullYear() - 1)
  else start.setUTCDate(start.getUTCDate() - (["7", "28"].includes(rangeKey) ? Number(rangeKey) : 28) + 1)
  return { startDate: isoDate(start), endDate: isoDate(availableEnd), rangeKey: ["7", "28", "3m", "6m", "12m"].includes(rangeKey) ? rangeKey : "28" }
}

function getPreviousRange(startDate, endDate) {
  const start = parseDate(startDate)
  const end = parseDate(endDate)
  const durationDays = Math.round((end - start) / 86400000) + 1
  const previousEnd = new Date(start)
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1)
  const previousStart = new Date(previousEnd)
  previousStart.setUTCDate(previousStart.getUTCDate() - durationDays + 1)
  return { startDate: isoDate(previousStart), endDate: isoDate(previousEnd) }
}

function totalsFromRows(rows) {
  const row = rows?.[0]
  if (!row) return null
  return { clicks: row.clicks || 0, impressions: row.impressions || 0, ctr: row.ctr || 0, position: row.position || 0 }
}

function normaliseQueryRows(rows) {
  return (rows || []).map((row) => ({ query: row.keys?.[0] || "", clicks: row.clicks || 0, impressions: row.impressions || 0, ctr: row.ctr || 0, position: row.position || 0 }))
}

function normalisePageRows(rows) {
  return (rows || []).map((row) => ({ page: row.keys?.[0] || "", clicks: row.clicks || 0, impressions: row.impressions || 0, ctr: row.ctr || 0, position: row.position || 0 }))
}

function normaliseDailyRows(rows) {
  return (rows || []).map((row) => ({ date: row.keys?.[0] || "", clicks: row.clicks || 0, impressions: row.impressions || 0, ctr: row.ctr || 0, position: row.position || 0 })).sort((a, b) => a.date.localeCompare(b.date))
}

function buildMovement(currentRows, previousRows, key) {
  const previousMap = new Map(previousRows.map((row) => [row[key], row]))
  const currentMap = new Map(currentRows.map((row) => [row[key], row]))
  const items = new Set([...currentMap.keys(), ...previousMap.keys()])

  return [...items]
    .map((name) => {
      const current = currentMap.get(name)
      const previous = previousMap.get(name)
      const positionChange = current && previous ? Number(previous.position || 0) - Number(current.position || 0) : null
      let status = "unchanged"
      if (!previous && current) status = "new"
      else if (previous && !current) status = "lost"
      else if (positionChange > 0.2) status = "improved"
      else if (positionChange < -0.2) status = "declined"
      return {
        [key]: name,
        position: current?.position ?? null,
        previousPosition: previous?.position ?? null,
        positionChange,
        clicks: current?.clicks || 0,
        previousClicks: previous?.clicks || 0,
        impressions: current?.impressions || 0,
        previousImpressions: previous?.impressions || 0,
        ctr: current?.ctr || 0,
        previousCtr: previous?.ctr || 0,
        status,
      }
    })
    .sort((a, b) => {
      const movementA = a.positionChange === null ? -Infinity : Math.abs(a.positionChange)
      const movementB = b.positionChange === null ? -Infinity : Math.abs(b.positionChange)
      if (movementA !== movementB) return movementB - movementA
      return Number(b.clicks || 0) - Number(a.clicks || 0)
    })
    .slice(0, 50)
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate")

  const refreshToken = parseCookies(req.headers.cookie).gsc_refresh_token
  if (!refreshToken) return res.status(401).json({ connected: false, error: "Google Search Console is not connected." })

  try {
    const accessToken = await getAccessToken(refreshToken)
    const sites = await gsc(accessToken, "/webmasters/v3/sites")
    const requestedSite = process.env.GSC_SITE_URL
    const site = (sites.siteEntry || []).find((item) => requestedSite ? item.siteUrl === requestedSite : /homeshield/i.test(item.siteUrl)) || sites.siteEntry?.[0]
    if (!site) return res.status(404).json({ connected: true, sites: [] })

    const { startDate, endDate, rangeKey } = getDateRange(req)
    const previous = getPreviousRange(startDate, endDate)
    const query = async (range, dimensions, rowLimit = 10) => gsc(accessToken, `/webmasters/v3/sites/${encodeURIComponent(site.siteUrl)}/searchAnalytics/query`, {
      method: "POST",
      body: JSON.stringify({ startDate: range.startDate, endDate: range.endDate, dimensions, rowLimit, dataState: "final" }),
    })

    const [summary, queries, pages, previousSummary, daily, previousDaily, previousQueries, previousPages, sitemapPages] = await Promise.all([
      query({ startDate, endDate }, [], 1),
      query({ startDate, endDate }, ["query"], 50),
      query({ startDate, endDate }, ["page"], 50),
      query(previous, [], 1),
      query({ startDate, endDate }, ["date"], 500),
      query(previous, ["date"], 500),
      query(previous, ["query"], 50),
      query(previous, ["page"], 50),
      getSitemapPages(site.siteUrl),
    ])

    const totals = totalsFromRows(summary.rows) || { clicks: 0, impressions: 0, ctr: 0, position: 0 }
    const previousTotals = totalsFromRows(previousSummary.rows)
    const currentQueryRows = normaliseQueryRows(queries.rows)
    const previousQueryRows = normaliseQueryRows(previousQueries.rows)
    const currentPageRows = normalisePageRows(pages.rows)
    const previousPageRows = normalisePageRows(previousPages.rows)

    const currentPageMap = new Map(currentPageRows.map((row) => [row.page, row]))
    const previousPageMap = new Map(previousPageRows.map((row) => [row.page, row]))
    for (const url of sitemapPages) {
      if (!currentPageMap.has(url)) currentPageMap.set(url, { page: url, clicks: 0, impressions: 0, ctr: 0, position: null })
      if (!previousPageMap.has(url)) previousPageMap.set(url, { page: url, clicks: 0, impressions: 0, ctr: 0, position: null })
    }

    const sitemapAwareCurrentPages = [...currentPageMap.values()]
    const sitemapAwarePreviousPages = [...previousPageMap.values()]

    return res.status(200).json({
      connected: true,
      siteUrl: site.siteUrl,
      startDate,
      endDate,
      rangeKey,
      totals,
      comparison: { startDate: previous.startDate, endDate: previous.endDate, totals: previousTotals, available: Boolean(previousTotals) },
      daily: normaliseDailyRows(daily.rows),
      previousDaily: normaliseDailyRows(previousDaily.rows),
      queries: currentQueryRows.slice(0, 10),
      pages: sitemapAwareCurrentPages,
      sitemapPages,
      keywordMovement: buildMovement(currentQueryRows, previousQueryRows, "query"),
      pageMovement: buildMovement(sitemapAwareCurrentPages, sitemapAwarePreviousPages, "page"),
    })
  } catch (err) {
    console.error("GSC data error:", err)
    return res.status(502).json({ connected: true, error: err?.message || "Unable to load Google Search Console data." })
  }
}

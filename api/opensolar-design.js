export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" })
  const projectId = String(req.body?.projectId || "").trim()
  const orgId = String(process.env.OPENSOLAR_ORG_ID || "").trim()
  const token = String(process.env.OPENSOLAR_API_TOKEN || "").trim()
  if (!projectId) return res.status(400).json({ success: false, error: "OpenSolar project ID is required." })
  if (!orgId || !token) return res.status(500).json({ success: false, error: "OpenSolar API credentials are not configured on Vercel." })
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" }
  try {
    const url = new URL(`https://api.opensolar.com/api/orgs/${encodeURIComponent(orgId)}/projects/${encodeURIComponent(projectId)}/systems/details/`)
    url.searchParams.set("include_parts", "mcs")
    const response = await fetch(url, { headers })
    const text = await response.text()
    let payload; try { payload = JSON.parse(text) } catch { payload = null }
    if (!response.ok) return res.status(response.status).json({ success: false, error: payload?.detail || payload?.error || `OpenSolar returned HTTP ${response.status}.` })
    const systems = Array.isArray(payload?.systems) ? payload.systems : []
    const firstSystem = systems.find(system => system?.uuid)
    let systemImageUrl = ""
    if (firstSystem?.uuid) {
      const imageUrl = new URL(`https://api.opensolar.com/api/orgs/${encodeURIComponent(orgId)}/projects/${encodeURIComponent(projectId)}/systems/${encodeURIComponent(firstSystem.uuid)}/image/`)
      imageUrl.searchParams.set("width", "1200"); imageUrl.searchParams.set("height", "800")
      const imageResponse = await fetch(imageUrl, { headers: { Authorization: `Bearer ${token}`, Accept: "image/*" }, redirect: "follow" })
      if (imageResponse.ok) systemImageUrl = imageResponse.url || imageUrl.toString()
    }
    return res.status(200).json({ success: true, projectId, systemImageUrl })
  } catch (error) {
    console.error("OpenSolar design lookup failed", error)
    return res.status(500).json({ success: false, error: error?.message || "Unable to retrieve the OpenSolar design." })
  }
}

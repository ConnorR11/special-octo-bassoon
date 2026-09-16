export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" })

  const projectId = String(req.body?.projectId || "").trim()
  const orgId = String(process.env.OPENSOLAR_ORG_ID || "").trim()
  const token = String(process.env.OPENSOLAR_API_TOKEN || "").trim()

  if (!projectId) return res.status(400).json({ success: false, error: "OpenSolar project ID is required." })
  if (!orgId || !token) return res.status(500).json({ success: false, error: "OpenSolar API credentials are not configured on Vercel." })

  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" }
  const base = `https://api.opensolar.com/api/orgs/${encodeURIComponent(orgId)}`

  try {
    const response = await fetch(`${base}/projects/${encodeURIComponent(projectId)}/systems/details/?include_parts=mcs`, { headers })
    const text = await response.text()
    let payload = null
    try { payload = JSON.parse(text) } catch {}
    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: payload?.detail || payload?.error || `OpenSolar returned HTTP ${response.status}.` })
    }

    const systems = Array.isArray(payload?.systems) ? payload.systems : []
    const firstSystem = systems.find((s) => s?.uuid) || systems[0] || null

    const parseData = (value) => {
      if (!value) return {}
      if (typeof value === "object") return value
      try { return JSON.parse(value) } catch { return {} }
    }

    const fetchList = async (name) => {
      try {
        const r = await fetch(`${base}/${name}/`, { headers })
        if (!r.ok) return []
        const v = await r.json()
        return Array.isArray(v) ? v : (Array.isArray(v?.results) ? v.results : [])
      } catch { return [] }
    }

    const [inverters, batteries] = await Promise.all([
      fetchList("component_inverter_activations"),
      fetchList("component_battery_activations"),
    ])

    const findActivation = (part, list) => {
      const code = String(part?.code || "").trim().toLowerCase()
      const manufacturer = String(part?.manufacturer_name || "").trim().toLowerCase()
      return list.find((x) => String(x?.code || "").trim().toLowerCase() === code && String(x?.manufacturer_name || "").trim().toLowerCase() === manufacturer)
        || list.find((x) => String(x?.code || "").trim().toLowerCase() === code)
        || null
    }

    const inverterParts = (Array.isArray(firstSystem?.inverters) ? firstSystem.inverters : []).map((part) => {
      const activation = findActivation(part, inverters)
      const d = parseData(activation?.data)
      const capacity = Number(d?.max_power_rating ?? d?.max_power_kw ?? part?.max_power_rating ?? 0)
      return {
        manufacturer: String(part?.manufacturer_name || activation?.manufacturer_name || ""),
        model: String(part?.code || activation?.code || ""),
        quantity: Math.max(1, Number(part?.quantity || 1)),
        capacityKw: Number.isFinite(capacity) ? capacity : 0,
      }
    })

    const batteryParts = (Array.isArray(firstSystem?.batteries) ? firstSystem.batteries : []).map((part) => {
      const activation = findActivation(part, batteries)
      const d = parseData(activation?.data)
      const capacity = Number(d?.kwh_optimal ?? d?.capacity_kwh ?? part?.kwh_optimal ?? 0)
      return {
        manufacturer: String(part?.manufacturer_name || activation?.manufacturer_name || ""),
        model: String(part?.code || activation?.code || ""),
        quantity: Math.max(1, Number(part?.quantity || 1)),
        capacityKwh: Number.isFinite(capacity) ? capacity : 0,
      }
    })

    const hardware = {
      inverter: {
        manufacturer: inverterParts[0]?.manufacturer || "",
        model: inverterParts[0]?.model || "",
        quantity: inverterParts.reduce((n, p) => n + p.quantity, 0),
        capacityKw: inverterParts.reduce((n, p) => n + p.capacityKw * p.quantity, 0),
        parts: inverterParts,
      },
      battery: {
        manufacturer: batteryParts[0]?.manufacturer || "",
        model: batteryParts[0]?.model || "",
        quantity: batteryParts.reduce((n, p) => n + p.quantity, 0),
        capacityKwh: batteryParts.reduce((n, p) => n + p.capacityKwh * p.quantity, 0),
        parts: batteryParts,
      },
    }

    return res.status(200).json({
      success: true,
      projectId,
      hardware,
      systems: systems.map((s) => ({ id: s?.id, uuid: s?.uuid, name: s?.name, kwStc: s?.kw_stc, totalModuleQuantity: s?.total_module_quantity })),
    })
  } catch (error) {
    console.error("OpenSolar hardware lookup failed", error)
    return res.status(500).json({ success: false, error: error?.message || "Unable to retrieve the OpenSolar hardware." })
  }
}

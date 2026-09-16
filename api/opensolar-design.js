export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" })

  const projectId = String(req.body?.projectId || "").trim()
  const orgId = String(process.env.OPENSOLAR_ORG_ID || "").trim()
  const token = String(process.env.OPENSOLAR_API_TOKEN || "").trim()
  if (!projectId) return res.status(400).json({ success: false, error: "OpenSolar project ID is required." })
  if (!orgId || !token) return res.status(500).json({ success: false, error: "OpenSolar API credentials are not configured on Vercel." })

  const apiHeaders = { Authorization: `Bearer ${token}`, Accept: "application/json" }
  const base = `https://api.opensolar.com/api/orgs/${encodeURIComponent(orgId)}`
  const parseJsonData = (value) => { if (!value) return {}; if (typeof value === "object") return value; try { return JSON.parse(value) } catch { return {} } }
  const numberOrNull = (...values) => { for (const value of values) { const n = Number(value); if (Number.isFinite(n) && n > 0) return n } return null }
  const normalise = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9.]+/g, "")

  const fetchAllActivations = async (path) => {
    const results = []
    let page = 1
    const limit = 100
    for (let guard = 0; guard < 50; guard += 1) {
      const url = new URL(`${base}/${path}/`); url.searchParams.set("page", String(page)); url.searchParams.set("limit", String(limit))
      const response = await fetch(url, { headers: apiHeaders }); if (!response.ok) break
      const payload = await response.json(); const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : []
      results.push(...rows); if (rows.length < limit) break; page += 1
    }
    return results
  }

  const findActivation = (part, activations, kind) => {
    const partData = parseJsonData(part?.data)
    const candidateIds = [part?.[`${kind}_activation_id`], part?.activation_id, partData?.[`${kind}_activation_id`], partData?.activation_id, part?.activation?.id].map((v) => String(v || "").trim()).filter(Boolean)
    for (const id of candidateIds) { const direct = activations.find((item) => String(item?.id || "") === id); if (direct) return direct }
    const codes = [part?.code, partData?.code, part?.model, partData?.model, part?.sku, partData?.sku].map(normalise).filter(Boolean)
    const manufacturers = [part?.manufacturer_name, partData?.manufacturer_name, partData?.manufacturer, part?.manufacturer].map(normalise).filter(Boolean)
    return activations.find((item) => { const data = parseJsonData(item?.data); const code = normalise(item?.code || data?.code); const manufacturer = normalise(item?.manufacturer_name || data?.manufacturer_name || data?.manufacturer); return codes.includes(code) && (!manufacturers.length || !manufacturer || manufacturers.includes(manufacturer)) }) || activations.find((item) => { const data = parseJsonData(item?.data); return codes.includes(normalise(item?.code || data?.code)) }) || null
  }

  const collectComponentParts = (system, type) => {
    const data = parseJsonData(system?.data)
    const keys = type === "inverter"
      ? ["inverters", "inverter", "inverterParts"]
      : type === "battery"
        ? ["batteries", "battery", "batteryParts"]
        : ["ev_chargers", "evChargers", "electric_vehicle_chargers", "evCharger", "ev_charger"]
    const found = []
    const add = (value) => { if (Array.isArray(value)) value.forEach((item) => item && found.push(item)); else if (value && typeof value === "object") found.push(value) }
    keys.forEach((key) => { add(system?.[key]); add(data?.[key]); add(data?.components?.[key]); add(data?.hardware?.[key]) })
    ;[data?.design, data?.system, data?.proposal_data].forEach((container) => { const parsed = parseJsonData(container); keys.forEach((key) => add(parsed?.[key])) })
    const unique = []; const seen = new Set()
    for (const item of found) { const key = `${item?.id || ""}|${item?.code || item?.model || ""}|${item?.manufacturer_name || item?.manufacturer || ""}`; if (!seen.has(key)) { seen.add(key); unique.push(item) } }
    return unique
  }

  try {
    const detailsUrl = new URL(`${base}/projects/${encodeURIComponent(projectId)}/systems/details/`); detailsUrl.searchParams.set("include_parts", "mcs")
    const response = await fetch(detailsUrl, { headers: apiHeaders }); const text = await response.text(); let payload; try { payload = JSON.parse(text) } catch { payload = null }
    if (!response.ok) return res.status(response.status).json({ success: false, error: payload?.detail || payload?.error || `OpenSolar returned HTTP ${response.status}.` })
    const systems = Array.isArray(payload?.systems) ? payload.systems : []
    const firstSystem = systems.find((system) => system?.uuid) || systems[0] || null
    const [inverterActivations, batteryActivations, evChargerActivations] = await Promise.all([fetchAllActivations("component_inverter_activations"), fetchAllActivations("component_battery_activations"), fetchAllActivations("component_ev_charger_activations")])
    const systemInverters = systems.flatMap((system) => collectComponentParts(system, "inverter"))
    const systemBatteries = systems.flatMap((system) => collectComponentParts(system, "battery"))
    const systemEvChargers = systems.flatMap((system) => collectComponentParts(system, "ev_charger"))

    const inverterParts = systemInverters.map((part) => {
      const activation = findActivation(part, inverterActivations, "inverter")
      const partData = parseJsonData(part?.data); const activationData = parseJsonData(activation?.data)
      const capacityKw = numberOrNull(
        activationData?.max_power_kw, activation?.max_power_kw,
        activationData?.specs?.max_power_kw, activation?.specs?.max_power_kw,
        partData?.max_power_kw, part?.max_power_kw,
        activationData?.max_power_rating, activation?.max_power_rating,
        activationData?.power_kw, activation?.power_kw,
        partData?.max_power_rating, part?.max_power_rating,
        partData?.power_kw, part?.power_kw,
      )
      const efficiency = numberOrNull(activationData?.efficiency, partData?.efficiency, part?.efficiency)
      return { manufacturer: String(part?.manufacturer_name || activation?.manufacturer_name || activationData?.manufacturer_name || ""), model: String(part?.code || activation?.code || activationData?.code || ""), quantity: Math.max(1, Number(part?.quantity || 1)), capacityKw: capacityKw ? (capacityKw > 100 ? capacityKw / 1000 : capacityKw) : 0, efficiencyPercent: efficiency }
    })

    const batteryParts = systemBatteries.map((part) => {
      const activation = findActivation(part, batteryActivations, "battery")
      const partData = parseJsonData(part?.data); const activationData = parseJsonData(activation?.data)
      const capacity = numberOrNull(
        activationData?.kwh_optimal, activation?.kwh_optimal,
        activationData?.capacity_kwh, activation?.capacity_kwh,
        activationData?.battery_total_kwh, activation?.battery_total_kwh,
        activationData?.nominal_capacity_kwh, activation?.nominal_capacity_kwh,
        activationData?.usable_capacity_kwh, activation?.usable_capacity_kwh,
        activationData?.energy_capacity_kwh, activation?.energy_capacity_kwh,
        activationData?.specs?.capacity_kwh, activation?.specs?.capacity_kwh,
        activationData?.specs?.kwh_optimal, activation?.specs?.kwh_optimal,
        partData?.kwh_optimal, partData?.capacity_kwh, partData?.battery_total_kwh,
        partData?.nominal_capacity_kwh, partData?.usable_capacity_kwh, partData?.energy_capacity_kwh,
        part?.kwh_optimal, part?.capacity_kwh, part?.battery_total_kwh,
      )
      return { manufacturer: String(part?.manufacturer_name || activation?.manufacturer_name || activationData?.manufacturer_name || ""), model: String(part?.code || activation?.code || activationData?.code || ""), quantity: Math.max(1, Number(part?.quantity || 1)), capacityKwh: capacity || 0 }
    })

    const evChargerParts = systemEvChargers.map((part) => {
      const activation = findActivation(part, evChargerActivations, "ev_charger")
      const partData = parseJsonData(part?.data); const activationData = parseJsonData(activation?.data)
      const power = numberOrNull(activationData?.max_power_rating, activationData?.max_power_kw, activationData?.power_kw, partData?.max_power_rating, partData?.max_power_kw, partData?.power_kw, part?.max_power_rating, part?.max_power_kw, part?.power_kw)
      return { manufacturer: String(part?.manufacturer_name || activation?.manufacturer_name || activationData?.manufacturer_name || ""), model: String(part?.code || activation?.code || activationData?.code || ""), quantity: Math.max(1, Number(part?.quantity || 1)), powerKw: power || 0 }
    })

    const inverterCapacity = inverterParts.reduce((total, part) => total + part.capacityKw * part.quantity, 0)
    const batteryCapacity = batteryParts.reduce((total, part) => total + part.capacityKwh * part.quantity, 0)
    const evChargerPower = evChargerParts.reduce((total, part) => total + part.powerKw * part.quantity, 0)
    const diagnosticInverters = systemInverters.map((part) => { const activation = findActivation(part, inverterActivations, "inverter"); const partData = parseJsonData(part?.data); const activationData = parseJsonData(activation?.data); return { part: { id: part?.id, code: part?.code, model: part?.model, manufacturer: part?.manufacturer_name || part?.manufacturer, quantity: part?.quantity }, activation: activation ? { id: activation?.id, code: activation?.code, manufacturer: activation?.manufacturer_name || activation?.manufacturer } : null, max_power_kw: { activationData: activationData?.max_power_kw ?? null, activation: activation?.max_power_kw ?? null, activationSpecs: activation?.specs?.max_power_kw ?? null, activationDataSpecs: activationData?.specs?.max_power_kw ?? null, partData: partData?.max_power_kw ?? null, part: part?.max_power_kw ?? null }, resolvedCapacityKw: numberOrNull(activationData?.max_power_kw, activation?.max_power_kw, activationData?.specs?.max_power_kw, activation?.specs?.max_power_kw, partData?.max_power_kw, part?.max_power_kw) || 0 } })

    let systemImageUrl = ""
    if (firstSystem?.uuid) {
      const imageUrl = new URL(`${base}/projects/${encodeURIComponent(projectId)}/systems/${encodeURIComponent(firstSystem.uuid)}/image/`); imageUrl.searchParams.set("width", "1200"); imageUrl.searchParams.set("height", "800")
      try { const imageResponse = await fetch(imageUrl, { headers: { Authorization: `Bearer ${token}`, Accept: "image/*" }, redirect: "follow" }); if (imageResponse.ok) systemImageUrl = imageResponse.url || "" } catch (imageError) { console.warn("OpenSolar system image lookup failed", imageError) }
    }

    return res.status(200).json({ success: true, projectId, numberOfArrays: 0, arrays: [], truncated: false, systemImageUrl, hardware: { inverter: { manufacturer: inverterParts[0]?.manufacturer || "", model: inverterParts[0]?.model || "", quantity: inverterParts.reduce((total, part) => total + part.quantity, 0), capacityKw: inverterCapacity, efficiencyPercent: null, parts: inverterParts }, battery: { manufacturer: batteryParts[0]?.manufacturer || "", model: batteryParts[0]?.model || "", quantity: batteryParts.reduce((total, part) => total + part.quantity, 0), capacityKwh: batteryCapacity, roundTripEfficiencyPercent: null, depthOfDischargePercent: null, endOfLifeCapacityPercent: null, warrantyYears: null, parts: batteryParts }, evCharger: { manufacturer: evChargerParts[0]?.manufacturer || "", model: evChargerParts[0]?.model || "", quantity: evChargerParts.reduce((total, part) => total + part.quantity, 0), powerKw: evChargerPower, parts: evChargerParts }, diagnostic: { inverterParts: diagnosticInverters, activationCount: inverterActivations.length, systemInverterCount: systemInverters.length } })
  } catch (error) { console.error("OpenSolar design lookup failed", error); return res.status(500).json({ success: false, error: error?.message || "Unable to retrieve the OpenSolar design." }) }
}
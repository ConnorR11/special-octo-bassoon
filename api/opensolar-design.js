export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" })

  const projectId = String(req.body?.projectId || "").trim()
  const orgId = String(process.env.OPENSOLAR_ORG_ID || "").trim()
  const token = String(process.env.OPENSOLAR_API_TOKEN || "").trim()

  if (!projectId) return res.status(400).json({ success: false, error: "OpenSolar project ID is required." })
  if (!orgId || !token) return res.status(500).json({ success: false, error: "OpenSolar API credentials are not configured on Vercel." })

  const url = new URL(`https://api.opensolar.com/api/orgs/${encodeURIComponent(orgId)}/projects/${encodeURIComponent(projectId)}/systems/details/`)
  url.searchParams.set("include_parts", "mcs")

  const apiHeaders = { Authorization: `Bearer ${token}`, Accept: "application/json" }

  try {
    const response = await fetch(url, { headers: apiHeaders })
    const text = await response.text()
    let payload
    try { payload = JSON.parse(text) } catch { payload = null }

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: payload?.detail || payload?.error || `OpenSolar returned HTTP ${response.status}.`,
      })
    }

    const systems = Array.isArray(payload?.systems) ? payload.systems : []
    const firstSystem = systems.find((system) => system?.uuid) || systems[0] || null

    const parseJsonData = (value) => {
      if (!value) return {}
      if (typeof value === "object") return value
      try { return JSON.parse(value) } catch { return {} }
    }

    const fetchActivationList = async (path) => {
      try {
        const activationResponse = await fetch(
          `https://api.opensolar.com/api/orgs/${encodeURIComponent(orgId)}/${path}/`,
          { headers: apiHeaders }
        )
        if (!activationResponse.ok) return []
        const activationPayload = await activationResponse.json()
        return Array.isArray(activationPayload)
          ? activationPayload
          : Array.isArray(activationPayload?.results) ? activationPayload.results : []
      } catch { return [] }
    }

    const [inverterActivations, batteryActivations, evChargerActivations] = await Promise.all([
      fetchActivationList("component_inverter_activations"),
      fetchActivationList("component_battery_activations"),
      fetchActivationList("component_ev_charger_activations"),
    ])

    const findActivation = (part, activations) => {
      const code = String(part?.code || "").trim().toLowerCase()
      const manufacturer = String(part?.manufacturer_name || "").trim().toLowerCase()
      return activations.find(
        (item) =>
          String(item?.code || "").trim().toLowerCase() === code &&
          String(item?.manufacturer_name || "").trim().toLowerCase() === manufacturer
      ) || activations.find(
        (item) => String(item?.code || "").trim().toLowerCase() === code
      ) || null
    }

    const systemInverters = Array.isArray(firstSystem?.inverters) ? firstSystem.inverters : []
    const systemBatteries = Array.isArray(firstSystem?.batteries) ? firstSystem.batteries : []
    const systemEvChargers = [
      ...(Array.isArray(firstSystem?.ev_chargers) ? firstSystem.ev_chargers : []),
      ...(Array.isArray(firstSystem?.evChargers) ? firstSystem.evChargers : []),
      ...(Array.isArray(firstSystem?.electric_vehicle_chargers) ? firstSystem.electric_vehicle_chargers : []),
      ...(Array.isArray(firstSystem?.chargers) ? firstSystem.chargers : []),
    ]

    const inverterParts = systemInverters.map((part) => {
      const activation = findActivation(part, inverterActivations)
      const activationData = parseJsonData(activation?.data)
      const capacity = Number(activationData?.max_power_rating ?? activationData?.max_power_kw ?? part?.max_power_rating ?? 0)
      const efficiency = Number(activationData?.efficiency ?? part?.efficiency ?? NaN)
      return {
        manufacturer: String(part?.manufacturer_name || activation?.manufacturer_name || ""),
        model: String(part?.code || activation?.code || ""),
        quantity: Number(part?.quantity || 1),
        capacityKw: Number.isFinite(capacity) ? capacity : 0,
        efficiencyPercent: Number.isFinite(efficiency) ? efficiency : null,
      }
    })

    const batteryParts = systemBatteries.map((part) => {
      const activation = findActivation(part, batteryActivations)
      const activationData = parseJsonData(activation?.data)
      const capacity = Number(activationData?.kwh_optimal ?? activationData?.capacity_kwh ?? part?.kwh_optimal ?? 0)
      const efficiency = Number(activationData?.efficiency_factor ?? activationData?.round_trip_efficiency ?? part?.efficiency_factor ?? NaN)
      const dod = Number(activationData?.depth_of_discharge_factor ?? part?.depth_of_discharge_factor ?? NaN)
      const endOfLifeCapacity = Number(activationData?.end_of_life_capacity ?? NaN)
      const warrantyYears = Number(activation?.product_warranty ?? activationData?.product_warranty ?? NaN)
      return {
        manufacturer: String(part?.manufacturer_name || activation?.manufacturer_name || ""),
        model: String(part?.code || activation?.code || ""),
        quantity: Number(part?.quantity || 1),
        capacityKwh: Number.isFinite(capacity) ? capacity : 0,
        roundTripEfficiencyPercent: Number.isFinite(efficiency) ? efficiency * 100 : null,
        depthOfDischargePercent: Number.isFinite(dod) ? dod * 100 : null,
        endOfLifeCapacityPercent: Number.isFinite(endOfLifeCapacity) ? endOfLifeCapacity * 100 : null,
        warrantyYears: Number.isFinite(warrantyYears) ? warrantyYears : null,
      }
    })

    const evChargerParts = systemEvChargers.map((part) => {
      const activation = findActivation(part, evChargerActivations)
      const activationData = parseJsonData(activation?.data)
      const power = Number(
        activationData?.max_power_rating ??
        activationData?.max_power_kw ??
        activationData?.power_kw ??
        part?.max_power_rating ??
        part?.max_power_kw ??
        part?.power_kw ??
        0
      )
      return {
        manufacturer: String(part?.manufacturer_name || activation?.manufacturer_name || ""),
        model: String(part?.code || activation?.code || ""),
        quantity: Math.max(1, Number(part?.quantity || 1)),
        powerKw: Number.isFinite(power) ? power : 0,
      }
    })

    const inverterCapacity = inverterParts.reduce((total, part) => total + part.capacityKw * Math.max(1, part.quantity), 0)
    const batteryCapacity = batteryParts.reduce((total, part) => total + part.capacityKwh * Math.max(1, part.quantity), 0)
    const evChargerPower = evChargerParts.reduce((total, part) => total + part.powerKw * Math.max(1, part.quantity), 0)

    const weighted = (parts, valueKey, capacityKey, quantityKey = "quantity") => {
      let numerator = 0
      let denominator = 0
      parts.forEach((part) => {
        const value = Number(part?.[valueKey])
        const weight = Number(part?.[capacityKey] || 0) * Math.max(1, Number(part?.[quantityKey] || 1))
        if (Number.isFinite(value) && weight > 0) {
          numerator += value * weight
          denominator += weight
        }
      })
      return denominator > 0 ? numerator / denominator : null
    }

    const inverterEfficiency = weighted(inverterParts, "efficiencyPercent", "capacityKw")
    const batteryRTE = weighted(batteryParts, "roundTripEfficiencyPercent", "capacityKwh")
    const batteryDoD = weighted(batteryParts, "depthOfDischargePercent", "capacityKwh")
    const batteryEOL = weighted(batteryParts, "endOfLifeCapacityPercent", "capacityKwh")
    const batteryWarrantyYears = weighted(batteryParts, "warrantyYears", "capacityKwh")

    const arrays = systems.flatMap((system) => {
      const shadeFactor = Number(system?.data?.mcs?.shadingFactor ?? 1)
      const specificYield = String(system?.data?.mcs?.mcsSpecificYieldBeforeShading || "")
        .split(/\n+/)
        .map((line) => {
          const match = line.match(/:\s*([0-9]+(?:\.[0-9]+)?)/)
          return match ? Number(match[1]) : null
        })
        .filter((value) => Number.isFinite(value))

      return (Array.isArray(system?.module_groups) ? system.module_groups : []).map((group, index) => {
        const azimuth = Number(group?.azimuth ?? 180)
        const orientation = Math.round(Math.abs(((azimuth - 180 + 540) % 360) - 180))
        return {
          panelCount: Number(group?.module_quantity || 0),
          orientation,
          pitch: Math.round(Number(group?.slope || 0)),
          shading: Number.isFinite(shadeFactor) ? shadeFactor : 1,
          irradiance: Number(specificYield[index] || 0),
        }
      })
    })

    let systemImageUrl = ""
    if (firstSystem?.uuid) {
      const imageUrl = new URL(`https://api.opensolar.com/api/orgs/${encodeURIComponent(orgId)}/projects/${encodeURIComponent(projectId)}/systems/${encodeURIComponent(firstSystem.uuid)}/image/`)
      imageUrl.searchParams.set("width", "1200")
      imageUrl.searchParams.set("height", "800")
      try {
        const imageResponse = await fetch(imageUrl, {
          headers: { Authorization: `Bearer ${token}`, Accept: "image/*" },
          redirect: "follow",
        })
        if (imageResponse.ok) systemImageUrl = imageResponse.url || ""
      } catch (imageError) {
        console.warn("OpenSolar system image lookup failed", imageError)
      }
    }

    return res.status(200).json({
      success: true,
      projectId,
      numberOfArrays: arrays.length,
      arrays: arrays.slice(0, 3),
      truncated: arrays.length > 3,
      systemImageUrl,
      hardware: {
        inverter: {
          manufacturer: inverterParts[0]?.manufacturer || "",
          model: inverterParts[0]?.model || "",
          quantity: inverterParts.reduce((total, part) => total + Math.max(1, part.quantity), 0),
          capacityKw: inverterCapacity,
          efficiencyPercent: inverterEfficiency,
          parts: inverterParts,
        },
        battery: {
          manufacturer: batteryParts[0]?.manufacturer || "",
          model: batteryParts[0]?.model || "",
          quantity: batteryParts.reduce((total, part) => total + Math.max(1, part.quantity), 0),
          capacityKwh: batteryCapacity,
          roundTripEfficiencyPercent: batteryRTE,
          depthOfDischargePercent: batteryDoD,
          endOfLifeCapacityPercent: batteryEOL,
          warrantyYears: batteryWarrantyYears,
          parts: batteryParts,
        },
        evCharger: {
          manufacturer: evChargerParts[0]?.manufacturer || "",
          model: evChargerParts[0]?.model || "",
          quantity: evChargerParts.reduce((total, part) => total + Math.max(1, part.quantity), 0),
          powerKw: evChargerPower,
          parts: evChargerParts,
        },
      },
      systems: systems.map((system) => ({
        id: system?.id,
        uuid: system?.uuid,
        name: system?.name,
        kwStc: system?.kw_stc,
        totalModuleQuantity: system?.total_module_quantity,
      })),
    })
  } catch (error) {
    console.error("OpenSolar design lookup failed", error)
    return res.status(500).json({ success: false, error: error?.message || "Unable to retrieve the OpenSolar design." })
  }
}

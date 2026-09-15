export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" })
  }

  const projectId = String(req.body?.projectId || "").trim()
  const orgId = String(process.env.OPENSOLAR_ORG_ID || "").trim()
  const token = String(process.env.OPENSOLAR_API_TOKEN || "").trim()

  if (!projectId) {
    return res.status(400).json({ success: false, error: "OpenSolar project ID is required." })
  }

  if (!orgId || !token) {
    return res.status(500).json({
      success: false,
      error: "OpenSolar API credentials are not configured on Vercel.",
    })
  }

  const url = new URL(
    `https://api.opensolar.com/api/orgs/${encodeURIComponent(orgId)}/projects/${encodeURIComponent(projectId)}/systems/details/`
  )

  // We only need the system/module layout and MCS values. Keeping this request
  // focused also follows OpenSolar's recommendation to minimise large responses.
  url.searchParams.set("include_parts", "mcs")

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    })

    const text = await response.text()
    let payload
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error:
          payload?.detail ||
          payload?.error ||
          `OpenSolar returned HTTP ${response.status}.`,
      })
    }

    const systems = Array.isArray(payload?.systems) ? payload.systems : []

    // OpenSolar exposes each roof/array as a module_group. If a project has
    // multiple systems, flatten their groups into the calculator's three rows.
    const arrays = systems.flatMap((system) => {
      const shadeFactor = Number(system?.data?.mcs?.shadingFactor ?? 1)
      const specificYield = String(system?.data?.mcs?.mcsSpecificYieldBeforeShading || "")
        .split(/\n+/)
        .map((line) => {
          const match = line.match(/:\s*([0-9]+(?:\.[0-9]+)?)/)
          return match ? Number(match[1]) : null
        })
        .filter((value) => Number.isFinite(value))

      return (Array.isArray(system?.module_groups) ? system.module_groups : []).map(
        (group, index) => {
          const azimuth = Number(group?.azimuth ?? 180)
          const orientation = Math.abs(((azimuth - 180 + 540) % 360) - 180)

          return {
            panelCount: Number(group?.module_quantity || 0),
            orientation,
            pitch: Number(group?.slope || 0),
            shading: Number.isFinite(shadeFactor) ? shadeFactor : 1,
            irradiance: Number(specificYield[index] || 0),
          }
        }
      )
    })

    return res.status(200).json({
      success: true,
      projectId,
      numberOfArrays: arrays.length,
      arrays: arrays.slice(0, 3),
      truncated: arrays.length > 3,
      systems: systems.map((system) => ({
        id: system?.id,
        name: system?.name,
        kwStc: system?.kw_stc,
        totalModuleQuantity: system?.total_module_quantity,
      })),
    })
  } catch (error) {
    console.error("OpenSolar design lookup failed", error)
    return res.status(500).json({
      success: false,
      error: error?.message || "Unable to retrieve the OpenSolar design.",
    })
  }
}

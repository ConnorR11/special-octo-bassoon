import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
const text = fs.readFileSync(path, "utf8")
let next = text

if (!next.includes('import OpenSolarDesignButton from "./components/EPVS/OpenSolarDesignButton"')) {
  const importMarker = 'import ThirtyYearBreakdown from "./components/EPVS/ThirtyYearBreakdown"'
  if (!next.includes(importMarker)) throw new Error("Could not locate the EPVS breakdown imports")
  next = next.replace(importMarker, `${importMarker}\nimport OpenSolarDesignButton from "./components/EPVS/OpenSolarDesignButton"`)
}

if (!next.includes("const handleOpenSolarDesignLoaded")) {
  const marker = `  const arrayGeometryKey = data.arrays\n`
  const handler = `  const [openSolarImageUrl, setOpenSolarImageUrl] = useState(String(appointment?.open_solar_image || ""))\n  const [openSolarHardware, setOpenSolarHardware] = useState({ batteries: [], inverters: [], evChargers: [] })\n\n  useEffect(() => {\n    setOpenSolarImageUrl(String(appointment?.open_solar_image || ""))\n  }, [appointment?.appointment_row_id, appointment?.open_solar_image])\n\n  const handleOpenSolarDesignLoaded = async (payload) => {\n    const imported = Array.isArray(payload?.arrays) ? payload.arrays : []\n    const hardware = payload?.hardware && typeof payload.hardware === "object"\n      ? payload.hardware\n      : { batteries: [], inverters: [], evChargers: [] }\n    const batteries = Array.isArray(hardware.batteries) ? hardware.batteries : []\n    const inverters = Array.isArray(hardware.inverters) ? hardware.inverters : []\n    const evChargers = Array.isArray(hardware.evChargers) ? hardware.evChargers : []\n    const imageUrl = String(payload?.imageUrl || payload?.systemImageUrl || "")\n    if (imageUrl) setOpenSolarImageUrl(imageUrl)\n    setOpenSolarHardware({ batteries, inverters, evChargers })\n\n    if (!imported.length) {\n      setFluxRateError("OpenSolar did not return any array/module groups for this project.")\n      return\n    }\n\n    if (payload?.truncated) {\n      setFluxRateError("OpenSolar returned more than 3 arrays. The calculator can display the first 3.")\n    } else {\n      setFluxRateError("")\n    }\n\n    const nextArrays = [0, 1, 2].map((index) => {\n      const importedArray = imported[index]\n      if (!importedArray) return createArray()\n      return {\n        ...createArray(),\n        panelCount: Number(importedArray.panelCount || 0),\n        panelWattage: Number(importedArray.panelWattage || 460),\n        orientation: Number(importedArray.orientation || 0),\n        pitch: Number(importedArray.pitch || 0),\n        irradiance: Number(importedArray.irradiance || 0),\n        shading: Number(importedArray.shading ?? 1),\n      }\n    })\n\n    const nextData = {\n      ...data,\n      arrays: nextArrays,\n      ...(batteries[0]?.capacity ? { batteryCapacity: Number(batteries[0].capacity) * Math.max(1, Number(batteries[0].quantity || 1)) } : {}),\n      ...(inverters[0]?.capacity ? { inverterCapacity: Number(inverters[0].capacity) } : {}),\n    }\n\n    setData(nextData)\n\n    const appointmentRowId = appointment?.appointment_row_id\n    if (!appointmentRowId) {\n      setSaveError("This appointment does not have an appointment ID, so the OpenSolar information cannot be saved.")\n      return\n    }\n\n    try {\n      setSaveError("")\n      setSaveMessage("")\n\n      const existingCalculation =\n        appointment?.epvs_calculation &&\n        typeof appointment.epvs_calculation === "object"\n          ? appointment.epvs_calculation\n          : {}\n\n      const payloadToSave = {\n        ...existingCalculation,\n        version: existingCalculation.version || 1,\n        savedAt: new Date().toISOString(),\n        data: nextData,\n      }\n\n      const { error } = await supabase\n        .from("appointments")\n        .update({ epvs_calculation: payloadToSave })\n        .eq("appointment_row_id", appointmentRowId)\n\n      if (error) throw error\n\n      setSaveMessage("OpenSolar information saved")\n    } catch (error) {\n      console.error("Error saving OpenSolar information:", error)\n      setSaveError(error?.message || "Unable to save OpenSolar information.")\n    }\n  }\n\n`
  if (!next.includes(marker)) throw new Error("Could not locate the EPVS array geometry key")
  next = next.replace(marker, handler + marker)
}

// The OpenSolar heading is rendered by the dedicated toolbar below. Leave the
// outer Solar card without a title/header so the heading is not duplicated.
const solarCardMarker = `<Card\n  title="Solar PV arrays"\n  subtitle="Enter the EPVS information for each roof / array."\n>`
const solarCardReplacement = `<Card\n  title=""\n  subtitle=""\n>`
if (next.includes(solarCardMarker)) {
  next = next.replace(solarCardMarker, solarCardReplacement)
}

const arrayTableMarker = `  {/* ARRAYS TABLE */}`
if (next.includes(arrayTableMarker) && !next.includes("openSolarImageUrl || \"/opensolar-system-placeholder.svg\"")) {
  const toolbar = `  <div\n    className="opensolar-header"\n    style={{\n      display: "flex",\n      alignItems: "center",\n      justifyContent: "space-between",\n      gap: 12,\n      marginBottom: 12,\n    }}\n  >\n    <div style={{ minWidth: 0 }}>\n      <h2\n        style={{\n          margin: 0,\n          fontSize: 15,\n          fontWeight: 700,\n          lineHeight: 1.3,\n          color: "#172554",\n        }}\n      >\n        OpenSolar System Design\n      </h2>\n      <p\n        style={{\n          margin: "3px 0 0",\n          fontSize: 11,\n          lineHeight: 1.4,\n          color: "#64748b",\n        }}\n      >\n        Enter the EPVS information for each roof / array.\n      </p>\n    </div>\n    <OpenSolarDesignButton\n      projectId={appointment?.open_solar_id}\n      onDesignLoaded={handleOpenSolarDesignLoaded}\n    />\n  </div>\n\n  <div\n    style={{\n      marginBottom: 16,\n      border: "1px solid #e2e8f0",\n      borderRadius: 12,\n      overflow: "hidden",\n      background: "#f8fafc",\n    }}\n  >\n    <img\n      src={openSolarImageUrl || "/opensolar-system-placeholder.svg"}\n      alt={openSolarImageUrl ? "OpenSolar system design" : "OpenSolar system design placeholder"}\n      style={{\n        display: "block",\n        width: "100%",\n        maxHeight: 520,\n        objectFit: "contain",\n        background: "#f8fafc",\n      }}\n    />\n  </div>\n\n`
  next = next.replace(arrayTableMarker, toolbar + arrayTableMarker)
}

// Replace the manual battery/inverter controls with a read-only OpenSolar
// hardware display. The underlying EPVS fields are still populated by the
// OpenSolar import so existing calculations continue to use the imported data.
if (!next.includes("OpenSolarHardwareDisplay")) {
  const batteryCardRegex = /  <Card\n    title="Battery & Inverter"[\s\S]*?\n  <\/Card>/
  const batteryCardReplacement = `  <Card\n    title="Battery, Inverter & EV Charger"\n    subtitle="Equipment imported directly from the OpenSolar system design."\n  >\n    <div style={{ display: "grid", gap: 12 }}>\n      {[\n        ["Battery", openSolarHardware.batteries, "kWh"],\n        ["Inverter", openSolarHardware.inverters, "kW"],\n        ["EV Charger", openSolarHardware.evChargers, "kW"],\n      ].map(([label, items, unit]) => (\n        <div\n          key={label}\n          style={{\n            display: "grid",\n            gridTemplateColumns: "150px minmax(0, 1fr)",\n            gap: 16,\n            alignItems: "center",\n            padding: "10px 0",\n            borderBottom: "1px solid #e5e7eb",\n          }}\n        >\n          <strong style={{ color: "#172554", fontSize: 13 }}>{label}</strong>\n          <div style={{ display: "grid", gap: 3 }}>\n            {items.length ? items.map((item, index) => (\n              <div key={index} style={{ fontSize: 13, color: "#334155" }}>\n                <strong>{item.model || "Model not provided"}</strong>\n                {item.manufacturer ? ` · \\${item.manufacturer}` : ""}\n                {Number(item.capacity) > 0 ? ` · \\${item.capacity} \\${unit}` : ""}\n                {` · Qty \\${Number(item.quantity || 1)}`}\n              </div>\n            )) : (\n              <span style={{ fontSize: 13, color: "#64748b" }}>Not specified in OpenSolar</span>\n            )}\n          </div>\n        </div>\n      ))}\n    </div>\n  </Card>`
  const replaced = next.replace(batteryCardRegex, batteryCardReplacement)
  if (replaced !== next) next = replaced
}

if (next === text) {
  console.log("OpenSolar UI already applied; nothing to change.")
  process.exit(0)
}

fs.writeFileSync(path, next)
console.log("OpenSolar UI patch applied with single header and read-only hardware display.")

import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
const text = fs.readFileSync(path, "utf8")
let next = text

const importMarker = 'import ThirtyYearBreakdown from "./components/EPVS/ThirtyYearBreakdown"'
const importStatement = 'import OpenSolarDesignButton from "./components/EPVS/OpenSolarDesignButton"'
if (!next.includes(importStatement) && next.includes(importMarker)) next = next.replace(importMarker, `${importMarker}\n${importStatement}`)

const oldHandler = /  const \[openSolarImageUrl, setOpenSolarImageUrl\] = useState\([\s\S]*?\n  \}\n\n/;
const newHandler = `  const [openSolarImageUrl, setOpenSolarImageUrl] = useState(String(appointment?.open_solar_image || ""))\n\n  useEffect(() => {\n    setOpenSolarImageUrl(String(appointment?.open_solar_image || ""))\n  }, [appointment?.open_solar_image])\n\n  const handleOpenSolarDesignLoaded = async (payload) => {\n    const imported = Array.isArray(payload?.arrays) ? payload.arrays : []\n    const imageUrl = String(payload?.systemImageUrl || "")\n    const hardware = payload?.hardware || {}\n\n    setOpenSolarImageUrl(imageUrl)\n\n    if (imageUrl && appointment?.appointment_row_id) {\n      const { error: imageSaveError } = await supabase.from("appointments").update({ open_solar_image: imageUrl }).eq("appointment_row_id", appointment.appointment_row_id)\n      if (imageSaveError) console.error("Unable to save OpenSolar image to appointment", imageSaveError)\n    }\n\n    // Always replace the hardware state, even when OpenSolar returns no arrays.\n    // This is important because an appointment can have no EV charger and must\n    // not retain the previous appointment's EV charger.\n    setData((current) => ({\n      ...current,\n      batteryCapacity: Number(hardware?.battery?.capacityKwh || 0),\n      batteryManufacturer: String(hardware?.battery?.manufacturer || ""),\n      batteryModel: String(hardware?.battery?.model || ""),\n      batteryQuantity: Number(hardware?.battery?.quantity || 0),\n      inverterCapacity: Number(hardware?.inverter?.capacityKw || 0),\n      inverterManufacturer: String(hardware?.inverter?.manufacturer || ""),\n      inverterModel: String(hardware?.inverter?.model || ""),\n      inverterQuantity: Number(hardware?.inverter?.quantity || 0),\n      evChargerManufacturer: String(hardware?.evCharger?.manufacturer || ""),\n      evChargerModel: String(hardware?.evCharger?.model || ""),\n      evChargerQuantity: Number(hardware?.evCharger?.quantity || 0),\n      evChargerPowerKw: Number(hardware?.evCharger?.powerKw || 0),\n      arrays: [0, 1, 2].map((index) => {\n        const importedArray = imported[index]\n        if (!importedArray) return createArray()\n        return {\n          ...createArray(),\n          panelCount: Number(importedArray.panelCount || 0),\n          orientation: Number(importedArray.orientation || 0),\n          pitch: Number(importedArray.pitch || 0),\n          irradiance: Number(importedArray.irradiance || 0),\n          shading: Number(importedArray.shading ?? 1),\n        }\n      }),\n    }))\n\n    if (!imported.length) {\n      setFluxRateError("OpenSolar did not return any array/module groups for this project.")\n      return\n    }\n\n    setFluxRateError(payload?.truncated ? "OpenSolar returned more than 3 arrays. The calculator can display the first 3." : "")\n  }\n\n`

if (oldHandler.test(next)) next = next.replace(oldHandler, newHandler)

if (!next.includes('action={\n    <OpenSolarDesignButton')) {
  const solarCard = /<Card\n  title="Solar System Design"[\s\S]*?\n>/
  if (solarCard.test(next)) next = next.replace(solarCard, `<Card\n  title="Solar System Design"\n  subtitle="Press get current design to download the system design from open solar"\n  action={\n    <OpenSolarDesignButton\n      projectId={appointment?.open_solar_id}\n      onDesignLoaded={handleOpenSolarDesignLoaded}\n    />\n  }\n>`)
}

const cardSignature = /function Card\(\{\n  title,\n  subtitle,\n  children,\n\}\) \{/s
if (cardSignature.test(next) && !next.includes("  action,\n")) next = next.replace(cardSignature, `function Card({\n  title,\n  subtitle,\n  action,\n  children,\n}) {`)

const cardHeaderPattern = /      <div\n        className="card-head"\n      >\n        <div>\n          <h2>\{title\}<\/h2>\n\n          <p>\n            \{subtitle\}\n          <\/p>\n        <\/div>\n      <\/div>/s
if (cardHeaderPattern.test(next) && !next.includes("{action && <div")) next = next.replace(cardHeaderPattern, `      <div className="card-head" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>\n        <div><h2>{title}</h2><p>{subtitle}</p></div>\n        {action && <div style={{ marginLeft: "auto", flexShrink: 0 }}>{action}</div>}\n      </div>`)

if (next === text) { console.log("OpenSolar UI already applied; nothing to change."); process.exit(0) }
fs.writeFileSync(path, next)
console.log("OpenSolar UI patch applied.")
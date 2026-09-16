import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
const text = fs.readFileSync(path, "utf8")
let next = text

if (!next.includes('import OpenSolarDesignButton from "./components/EPVS/OpenSolarDesignButton"')) {
  const importMarker = 'import ThirtyYearBreakdown from "./components/EPVS/ThirtyYearBreakdown"'
  if (!next.includes(importMarker)) throw new Error("Could not locate the EPVS breakdown imports")
  next = next.replace(importMarker, `${importMarker}\nimport OpenSolarDesignButton from "./components/EPVS/OpenSolarDesignButton"`)
}

const oldHandler = /  const \[openSolarImageUrl, setOpenSolarImageUrl\] = useState\(""\)\n\n  const handleOpenSolarDesignLoaded = \(payload\) => \{[\s\S]*?\n  \}\n\n/;
const newHandler = `  const [openSolarImageUrl, setOpenSolarImageUrl] = useState(\n    String(appointment?.open_solar_image || "")\n  )\n\n  useEffect(() => {\n    setOpenSolarImageUrl(String(appointment?.open_solar_image || ""))\n  }, [appointment?.open_solar_image])\n\n  const handleOpenSolarDesignLoaded = async (payload) => {\n    const imported = Array.isArray(payload?.arrays) ? payload.arrays : []\n    const imageUrl = String(payload?.systemImageUrl || "")\n    const hardware = payload?.hardware || {}\n\n    setOpenSolarImageUrl(imageUrl)\n\n    if (imageUrl && appointment?.appointment_row_id) {\n      const { error: imageSaveError } = await supabase\n        .from("appointments")\n        .update({ open_solar_image: imageUrl })\n        .eq("appointment_row_id", appointment.appointment_row_id)\n\n      if (imageSaveError) console.error("Unable to save OpenSolar image to appointment", imageSaveError)\n    }\n\n    if (!imported.length) {\n      setFluxRateError("OpenSolar did not return any array/module groups for this project.")\n      return\n    }\n\n    setFluxRateError(payload?.truncated ? "OpenSolar returned more than 3 arrays. The calculator can display the first 3." : "")\n\n    setData((current) => ({\n      ...current,\n      batteryCapacity: Number(hardware?.battery?.capacityKwh || 0),\n      batteryManufacturer: String(hardware?.battery?.manufacturer || ""),\n      batteryModel: String(hardware?.battery?.model || ""),\n      batteryQuantity: Number(hardware?.battery?.quantity || 0),\n      inverterCapacity: Number(hardware?.inverter?.capacityKw || 0),\n      inverterManufacturer: String(hardware?.inverter?.manufacturer || ""),\n      inverterModel: String(hardware?.inverter?.model || ""),\n      inverterQuantity: Number(hardware?.inverter?.quantity || 0),\n      evChargerManufacturer: String(hardware?.evCharger?.manufacturer || ""),\n      evChargerModel: String(hardware?.evCharger?.model || ""),\n      evChargerQuantity: Number(hardware?.evCharger?.quantity || 0),\n      evChargerPowerKw: Number(hardware?.evCharger?.powerKw || 0),\n      arrays: [0, 1, 2].map((index) => {\n        const importedArray = imported[index]\n        if (!importedArray) return createArray()\n        return {\n          ...createArray(),\n          panelCount: Number(importedArray.panelCount || 0),\n          orientation: Number(importedArray.orientation || 0),\n          pitch: Number(importedArray.pitch || 0),\n          irradiance: Number(importedArray.irradiance || 0),\n          shading: Number(importedArray.shading ?? 1),\n        }\n      }),\n    }))\n  }\n\n`

if (oldHandler.test(next)) next = next.replace(oldHandler, newHandler)
else if (!next.includes("const [openSolarImageUrl, setOpenSolarImageUrl]")) {
  const marker = `  const arrayGeometryKey = data.arrays\n`
  if (!next.includes(marker)) throw new Error("Could not locate the EPVS array geometry key")
  next = next.replace(marker, newHandler + marker)
}

next = next.replace(
  'title="Solar PV arrays"\n  subtitle="Enter the EPVS information for each roof / array."',
  'title="Solar System Design"\n  subtitle="Press get current design to download the system design from open solar"',
)

const solarCardPattern = /<Card\n  title="Solar System Design"\n  subtitle="Press get current design to download the system design from open solar"\n>/
if (solarCardPattern.test(next) && !next.includes("projectId={appointment?.open_solar_id}")) {
  next = next.replace(solarCardPattern, `<Card\n  title="Solar System Design"\n  subtitle="Press get current design to download the system design from open solar"\n  action={\n    <OpenSolarDesignButton\n      projectId={appointment?.open_solar_id}\n      onDesignLoaded={handleOpenSolarDesignLoaded}\n    />\n  }\n>`)
}

const cardSignature = /function Card\(\{\n  title,\n  subtitle,\n  children,\n\}\) \{/s
if (cardSignature.test(next) && !next.includes("  action,\n")) {
  next = next.replace(cardSignature, `function Card({\n  title,\n  subtitle,\n  action,\n  children,\n}) {`)
}

const cardHeaderPattern = /      <div\n        className="card-head"\n      >\n        <div>\n          <h2>\{title\}<\/h2>\n\n          <p>\n            \{subtitle\}\n          <\/p>\n        <\/div>\n      <\/div>/s
if (cardHeaderPattern.test(next) && !next.includes("{action && <div")) {
  next = next.replace(cardHeaderPattern, `      <div\n        className="card-head"\n        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}\n      >\n        <div>\n          <h2>{title}</h2>\n          <p>{subtitle}</p>\n        </div>\n        {action && <div style={{ marginLeft: "auto", flexShrink: 0 }}>{action}</div>}\n      </div>`)
}

const hardwareCardPattern = /<Card\n  title="Battery & Inverter"\n  subtitle="Configure the proposed battery and inverter\."\n>[\s\S]*?<\/Card>/
const hardwareCard = `<Card\n  title="Battery & Inverter"\n  subtitle="Hardware information is pulled directly from OpenSolar."\n>\n  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>\n    {[\n      { label: "Battery", manufacturer: data.batteryManufacturer, model: data.batteryModel, value: data.batteryCapacity ? Number(data.batteryCapacity).toLocaleString("en-GB") + " kWh" : "—", quantity: data.batteryQuantity },\n      { label: "Inverter", manufacturer: data.inverterManufacturer, model: data.inverterModel, value: data.inverterCapacity ? Number(data.inverterCapacity).toLocaleString("en-GB") + " kW" : "—", quantity: data.inverterQuantity },\n      { label: "EV Charger", manufacturer: data.evChargerManufacturer, model: data.evChargerModel, value: data.evChargerPowerKw ? Number(data.evChargerPowerKw).toLocaleString("en-GB") + " kW" : "—", quantity: data.evChargerQuantity },\n    ].map((item) => (\n      <div key={item.label} style={{ minWidth: 0, border: "1px solid #dbe3ec", borderRadius: 10, padding: "12px 14px", background: "#f8fafc", color: "#172554" }}>\n        <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 8 }}>{item.label}</div>\n        <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.manufacturer || "Not returned by OpenSolar"}</div>\n        <div style={{ marginTop: 3, fontSize: 11, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.model || "—"}</div>\n        <div style={{ marginTop: 9, display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: "#64748b" }}><span>Capacity / power</span><strong style={{ color: "#172554" }}>{item.value}</strong></div>\n        <div style={{ marginTop: 3, display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: "#64748b" }}><span>Quantity</span><strong style={{ color: "#172554" }}>{item.quantity || 0}</strong></div>\n      </div>\n    ))}\n  </div>\n</Card>`
if (hardwareCardPattern.test(next)) next = next.replace(hardwareCardPattern, hardwareCard)

const arrayTableMarker = `  {/* ARRAYS TABLE */}`
if (next.includes(arrayTableMarker) && !next.includes("openSolarImageUrl || \"/opensolar-system-placeholder.svg\"")) {
  const imageBlock = `  <div style={{ marginBottom: 16, border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "#f8fafc", aspectRatio: "12 / 7" }}>\n    <img src={openSolarImageUrl || "/opensolar-system-placeholder.svg"} alt={openSolarImageUrl ? "OpenSolar system design" : "OpenSolar system design placeholder"} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", background: "#f8fafc" }} />\n  </div>\n\n`
  next = next.replace(arrayTableMarker, imageBlock + arrayTableMarker)
}

if (next === text) {
  console.log("OpenSolar UI already applied; nothing to change.")
  process.exit(0)
}

fs.writeFileSync(path, next)
console.log("OpenSolar UI patch applied.")

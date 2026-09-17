import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
const text = fs.readFileSync(path, "utf8")
let next = text

const importMarker = 'import ThirtyYearBreakdown from "./components/EPVS/ThirtyYearBreakdown"'
const importStatement = 'import OpenSolarDesignButton from "./components/EPVS/OpenSolarDesignButton"'
if (!next.includes(importStatement) && next.includes(importMarker)) {
  next = next.replace(importMarker, `${importMarker}\n${importStatement}`)
}

if (!next.includes("const handleOpenSolarDesignLoaded")) {
  const marker = `  const arrayGeometryKey = data.arrays\n`
  const handler = `  const [openSolarImageUrl, setOpenSolarImageUrl] = useState(String(appointment?.open_solar_image || ""))\n\n  useEffect(() => {\n    setOpenSolarImageUrl(String(appointment?.open_solar_image || ""))\n  }, [appointment?.open_solar_image])\n\n  const handleOpenSolarDesignLoaded = async (payload) => {\n    const imported = Array.isArray(payload?.arrays) ? payload.arrays : []\n    const imageUrl = String(payload?.systemImageUrl || "")\n\n    setOpenSolarImageUrl(imageUrl)\n\n    if (imageUrl && appointment?.appointment_row_id) {\n      const { error: imageSaveError } = await supabase\n        .from("appointments")\n        .update({ open_solar_image: imageUrl })\n        .eq("appointment_row_id", appointment.appointment_row_id)\n\n      if (imageSaveError) {\n        console.error("Unable to save OpenSolar image to appointment", imageSaveError)\n      }\n    }\n\n    if (!imported.length) {\n      setFluxRateError("OpenSolar did not return any array/module groups for this project.")\n      return\n    }\n\n    if (payload?.truncated) {\n      setFluxRateError("OpenSolar returned more than 3 arrays. The calculator can display the first 3.")\n    } else {\n      setFluxRateError("")\n    }\n\n    setData((current) => ({\n      ...current,\n      arrays: [0, 1, 2].map((index) => {\n        const importedArray = imported[index]\n        if (!importedArray) return createArray()\n\n        return {\n          ...createArray(),\n          panelCount: Number(importedArray.panelCount || 0),\n          orientation: Number(importedArray.orientation || 0),\n          pitch: Number(importedArray.pitch || 0),\n          irradiance: Number(importedArray.irradiance || 0),\n          shading: Number(importedArray.shading ?? 1),\n        }\n      }),\n    }))\n  }\n\n`
  if (next.includes(marker)) next = next.replace(marker, handler + marker)
}

const solarCardPattern = /<Card\n  title="Solar PV arrays"\n  subtitle="Enter the EPVS information for each roof \/ array\."\n>/
if (solarCardPattern.test(next) && !next.includes("projectId={appointment?.open_solar_id}")) {
  next = next.replace(
    solarCardPattern,
    `<Card\n  title="Solar PV arrays"\n  subtitle="Enter the EPVS information for each roof / array."\n  action={\n    <OpenSolarDesignButton\n      projectId={appointment?.open_solar_id}\n      onDesignLoaded={handleOpenSolarDesignLoaded}\n    />\n  }\n>`
  )
}

const imageMarker = "data-opensolar-system-image"
if (!next.includes(imageMarker)) {
  const cardOpening = `<Card\n  title="Solar PV arrays"\n  subtitle="Enter the EPVS information for each roof / array."\n  action={\n    <OpenSolarDesignButton\n      projectId={appointment?.open_solar_id}\n      onDesignLoaded={handleOpenSolarDesignLoaded}\n    />\n  }\n>`
  const imageBlock = `{openSolarImageUrl && (\n  <div data-opensolar-system-image style={{ marginBottom: 18, padding: 12, border: "1px solid #e2e8f0", borderRadius: 10, background: "#f8fafc" }}>\n    <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 700, color: "#172554" }}>OpenSolar System Design</div>\n    <div style={{ width: "100%", minHeight: 240, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 8, background: "#fff" }}>\n      <img src={openSolarImageUrl} alt="OpenSolar system design" style={{ display: "block", width: "100%", maxHeight: 650, objectFit: "contain" }} />\n    </div>\n  </div>\n)}\n\n`
  if (next.includes(cardOpening)) next = next.replace(cardOpening, `${cardOpening}\n${imageBlock}`)
}

const cardSignature = /function Card\(\{\n  title,\n  subtitle,\n  children,\n\}\) \{/s
if (cardSignature.test(next) && !next.includes("  action,\n")) {
  next = next.replace(cardSignature, `function Card({\n  title,\n  subtitle,\n  action,\n  children,\n}) {`)
}

const cardHeaderPattern = /      <div\n        className="card-head"\n      >\n        <div>\n          <h2>\{title\}<\/h2>\n\n          <p>\n            \{subtitle\}\n          <\/p>\n        <\/div>\n      <\/div>/s
if (cardHeaderPattern.test(next) && !next.includes("{action && <div")) {
  next = next.replace(
    cardHeaderPattern,
    `      <div\n        className="card-head"\n        style={{\n          display: "flex",\n          alignItems: "flex-start",\n          justifyContent: "space-between",\n          gap: 16,\n        }}\n      >\n        <div>\n          <h2>{title}</h2>\n\n          <p>\n            {subtitle}\n          </p>\n        </div>\n\n        {action && <div style={{ marginLeft: "auto", flexShrink: 0 }}>{action}</div>}\n      </div>`
  )
}

if (next === text) {
  console.log("OpenSolar UI already applied; nothing to change.")
} else {
  fs.writeFileSync(path, next)
  console.log("OpenSolar button and image UI patch applied.")
}

// The OpenSolar image URL is stored on the appointment row. Render that stored
// URL in AppointmentDetail as well as inside the EPVS calculator so the image
// remains visible after the appointment is re-opened.
const appointmentPath = "src/pages/AppointmentDetail.jsx"
if (fs.existsSync(appointmentPath)) {
  const appointmentText = fs.readFileSync(appointmentPath, "utf8")
  let appointmentNext = appointmentText
  const imageMarker = "data-opensolar-system-image"
  const epvsMarker = "      {isSolar && <div style={{ marginTop: \"24px\" }}><div style={{ marginBottom: \"12px\" }}><h2 style={{ margin: 0, fontSize: \"18px\", color: \"#222\" }}>EPVS Calculator</h2>"
  if (!appointmentNext.includes(imageMarker) && appointmentNext.includes(epvsMarker)) {
    const imageBlock = `      {isSolar && appointment?.open_solar_image && <div data-opensolar-system-image style={{ marginTop: \"24px\", padding: \"16px\", background: \"#fff\", border: \"1px solid #e2e5e8\", borderRadius: \"8px\" }}>\n        <div style={{ marginBottom: \"12px\" }}>\n          <h2 style={{ margin: 0, fontSize: \"16px\", color: \"#222\" }}>OpenSolar System Design</h2>\n          <p style={{ margin: \"5px 0 0\", fontSize: \"11px\", color: \"#888\" }}>System design imported from OpenSolar.</p>\n        </div>\n        <div style={{ width: \"100%\", minHeight: \"240px\", display: \"flex\", alignItems: \"center\", justifyContent: \"center\", overflow: \"hidden\", borderRadius: \"6px\", background: \"#f6f8f9\" }}>\n          <img src={String(appointment.open_solar_image)} alt=\"OpenSolar system design\" style={{ display: \"block\", width: \"100%\", maxHeight: \"650px\", objectFit: \"contain\" }} />\n        </div>\n      </div>}\n\n`
    appointmentNext = appointmentNext.replace(epvsMarker, `${imageBlock}${epvsMarker}`)
    fs.writeFileSync(appointmentPath, appointmentNext)
    console.log("OpenSolar appointment image UI patch applied.")
  }
}

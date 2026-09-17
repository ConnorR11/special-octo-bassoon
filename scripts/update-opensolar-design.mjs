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
  const handler = `  const [openSolarImageUrl, setOpenSolarImageUrl] = useState(String(appointment?.open_solar_image || ""))\n\n  useEffect(() => {\n    setOpenSolarImageUrl(String(appointment?.open_solar_image || ""))\n  }, [appointment?.appointment_row_id, appointment?.open_solar_image])\n\n  const handleOpenSolarDesignLoaded = async (payload) => {\n    const imported = Array.isArray(payload?.arrays) ? payload.arrays : []\n    const imageUrl = String(payload?.imageUrl || payload?.systemImageUrl || "")\n    if (imageUrl) setOpenSolarImageUrl(imageUrl)\n\n    if (!imported.length) {\n      setFluxRateError("OpenSolar did not return any array/module groups for this project.")\n      return\n    }\n\n    if (payload?.truncated) {\n      setFluxRateError("OpenSolar returned more than 3 arrays. The calculator can display the first 3.")\n    } else {\n      setFluxRateError("")\n    }\n\n    const nextArrays = [0, 1, 2].map((index) => {\n      const importedArray = imported[index]\n      if (!importedArray) return createArray()\n      return {\n        ...createArray(),\n        panelCount: Number(importedArray.panelCount || 0),\n        panelWattage: Number(importedArray.panelWattage || 460),\n        orientation: Number(importedArray.orientation || 0),\n        pitch: Number(importedArray.pitch || 0),\n        irradiance: Number(importedArray.irradiance || 0),\n        shading: Number(importedArray.shading ?? 1),\n      }\n    })\n\n    const nextData = {\n      ...data,\n      arrays: nextArrays,\n    }\n\n    setData(nextData)\n\n    const appointmentRowId = appointment?.appointment_row_id\n    if (!appointmentRowId) {\n      setSaveError("This appointment does not have an appointment ID, so the OpenSolar information cannot be saved.")\n      return\n    }\n\n    try {\n      setSaveError("")\n      setSaveMessage("")\n\n      const existingCalculation =\n        appointment?.epvs_calculation &&\n        typeof appointment.epvs_calculation === "object"\n          ? appointment.epvs_calculation\n          : {}\n\n      const payloadToSave = {\n        ...existingCalculation,\n        version: existingCalculation.version || 1,\n        savedAt: new Date().toISOString(),\n        data: nextData,\n      }\n\n      const { error } = await supabase\n        .from("appointments")\n        .update({ epvs_calculation: payloadToSave })\n        .eq("appointment_row_id", appointmentRowId)\n\n      if (error) throw error\n\n      setSaveMessage("OpenSolar information saved")\n    } catch (error) {\n      console.error("Error saving OpenSolar information:", error)\n      setSaveError(error?.message || "Unable to save OpenSolar information.")\n    }\n  }\n\n`
  if (!next.includes(marker)) throw new Error("Could not locate the EPVS array geometry key")
  next = next.replace(marker, handler + marker)
}

const arrayTableMarker = `  {/* ARRAYS TABLE */}`
if (next.includes(arrayTableMarker) && !next.includes("openSolarImageUrl || \"/opensolar-system-placeholder.svg\"")) {
  const toolbar = `  <div\n    className="opensolar-header"\n    style={{\n      display: "flex",\n      alignItems: "center",\n      justifyContent: "space-between",\n      gap: 12,\n      marginBottom: 12,\n    }}\n  >\n    <h2\n      style={{\n        margin: 0,\n        fontSize: 15,\n        fontWeight: 700,\n        lineHeight: 1.3,\n        color: "#172554",\n      }}\n    >\n      OpenSolar System Design\n    </h2>\n    <OpenSolarDesignButton\n      projectId={appointment?.open_solar_id}\n      onDesignLoaded={handleOpenSolarDesignLoaded}\n    />\n  </div>\n\n  <div\n    style={{\n      marginBottom: 16,\n      border: "1px solid #e2e8f0",\n      borderRadius: 12,\n      overflow: "hidden",\n      background: "#f8fafc",\n    }}\n  >\n    <img\n      src={openSolarImageUrl || "/opensolar-system-placeholder.svg"}\n      alt={openSolarImageUrl ? "OpenSolar system design" : "OpenSolar system design placeholder"}\n      style={{\n        display: "block",\n        width: "100%",\n        maxHeight: 520,\n        objectFit: "contain",\n        background: "#f8fafc",\n      }}\n    />\n  </div>\n\n`
  next = next.replace(arrayTableMarker, toolbar + arrayTableMarker)
}

if (next === text) {
  console.log("OpenSolar UI already applied; nothing to change.")
  process.exit(0)
}

fs.writeFileSync(path, next)
console.log("OpenSolar UI patch applied with isolated header styling.")

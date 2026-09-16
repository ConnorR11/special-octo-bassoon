import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
const text = fs.readFileSync(path, "utf8")
let next = text

if (!next.includes('import OpenSolarDesignButton from "./components/EPVS/OpenSolarDesignButton"')) {
  const importMarker = 'import ThirtyYearBreakdown from "./components/ThirtyYearBreakdown"'
  if (!next.includes(importMarker)) throw new Error("Could not locate the EPVS breakdown imports")
  next = next.replace(importMarker, `${importMarker}\nimport OpenSolarDesignButton from "./components/EPVS/OpenSolarDesignButton"`)
}

const oldHandler = /  const \[openSolarImageUrl, setOpenSolarImageUrl\] = useState\(""\)\n\n  const handleOpenSolarDesignLoaded = \(payload\) => \{[\s\S]*?\n  \}\n\n/;
const newHandler = `  const [openSolarImageUrl, setOpenSolarImageUrl] = useState(\n    String(appointment?.open_solar_image || "")\n  )\n\n  useEffect(() => {\n    setOpenSolarImageUrl(String(appointment?.open_solar_image || ""))\n  }, [appointment?.open_solar_image])\n\n  const handleOpenSolarDesignLoaded = async (payload) => {\n    const imported = Array.isArray(payload?.arrays) ? payload.arrays : []\n    const imageUrl = String(payload?.systemImageUrl || "")\n\n    setOpenSolarImageUrl(imageUrl)\n\n    if (imageUrl && appointment?.appointment_row_id) {\n      const { error: imageSaveError } = await supabase\n        .from("appointments")\n        .update({ open_solar_image: imageUrl })\n        .eq("appointment_row_id", appointment.appointment_row_id)\n\n      if (imageSaveError) {\n        console.error("Unable to save OpenSolar image to appointment", imageSaveError)\n      }\n    }\n\n    if (!imported.length) {\n      setFluxRateError("OpenSolar did not return any array/module groups for this project.")\n      return\n    }\n\n    if (payload?.truncated) {\n      setFluxRateError("OpenSolar returned more than 3 arrays. The calculator can display the first 3.")\n    } else {\n      setFluxRateError("")\n    }\n\n    setData((current) => ({\n      ...current,\n      arrays: [0, 1, 2].map((index) => {\n        const importedArray = imported[index]\n        if (!importedArray) return createArray()\n        return {\n          ...createArray(),\n          panelCount: Number(importedArray.panelCount || 0),\n          orientation: Number(importedArray.orientation || 0),\n          pitch: Number(importedArray.pitch || 0),\n          irradiance: Number(importedArray.irradiance || 0),\n          shading: Number(importedArray.shading ?? 1),\n        }\n      }),\n    }))\n  }\n\n`

if (oldHandler.test(next)) {
  next = next.replace(oldHandler, newHandler)
} else if (!next.includes("const [openSolarImageUrl, setOpenSolarImageUrl]")) {
  const marker = `  const arrayGeometryKey = data.arrays\n`
  if (!next.includes(marker)) throw new Error("Could not locate the EPVS array geometry key")
  next = next.replace(marker, newHandler + marker)
}

const solarCardPattern = /<Card\n  title="Solar PV arrays"\n  subtitle="Enter the EPVS information for each roof \/ array\."\n>/
if (solarCardPattern.test(next) && !next.includes("projectId={appointment?.open_solar_id}")) {
  next = next.replace(solarCardPattern, `<Card\n  title="Solar PV arrays"\n  subtitle="Enter the EPVS information for each roof / array."\n  action={\n    <OpenSolarDesignButton\n      projectId={appointment?.open_solar_id}\n      onDesignLoaded={handleOpenSolarDesignLoaded}\n    />\n  }\n>`)
}

const cardSignature = /function Card\(\{\n  title,\n  subtitle,\n  children,\n\}\) \{/s
if (cardSignature.test(next) && !next.includes("  action,\n")) {
  next = next.replace(cardSignature, `function Card({\n  title,\n  subtitle,\n  action,\n  children,\n}) {`)
}

const cardHeaderPattern = /      <div\n        className="card-head"\n      >\n        <div>\n          <h2>\{title\}<\/h2>\n\n          <p>\n            \{subtitle\}\n          <\/p>\n        <\/div>\n      <\/div>/s
if (cardHeaderPattern.test(next) && !next.includes("{action && <div")) {
  next = next.replace(cardHeaderPattern, `      <div\n        className="card-head"\n        style={{\n          display: "flex",\n          alignItems: "flex-start",\n          justifyContent: "space-between",\n          gap: 16,\n        }}\n      >\n        <div>\n          <h2>{title}</h2>\n\n          <p>\n            {subtitle}\n          </p>\n        </div>\n\n        {action && <div style={{ marginLeft: "auto", flexShrink: 0 }}>{action}</div>}\n      </div>`)
}

const arrayTableMarker = `  {/* ARRAYS TABLE */}`
if (next.includes(arrayTableMarker) && !next.includes("openSolarImageUrl || \"/opensolar-system-placeholder.svg\"")) {
  const imageBlock = `  <div\n    style={{\n      marginBottom: 16,\n      border: "1px solid #e2e8f0",\n      borderRadius: 12,\n      overflow: "hidden",\n      background: "#f8fafc",\n      aspectRatio: "12 / 7",\n    }}\n  >\n    <img\n      src={openSolarImageUrl || "/opensolar-system-placeholder.svg"}\n      alt={openSolarImageUrl ? "OpenSolar system design" : "OpenSolar system design placeholder"}\n      style={{\n        display: "block",\n        width: "100%",\n        height: "100%",\n        objectFit: "cover",\n        background: "#f8fafc",\n      }}\n    />\n  </div>\n\n`
  next = next.replace(arrayTableMarker, imageBlock + arrayTableMarker)
}

// Keep the real OpenSolar image and the placeholder in the exact same frame.
next = next.replace(
  '        maxHeight: 520,\n        objectFit: "contain",',
  '        height: "100%",\n        objectFit: "cover",',
)
next = next.replace(
  '      background: "#f8fafc",\n    }}\n  >\n    <img',
  '      background: "#f8fafc",\n      aspectRatio: "12 / 7",\n    }}\n  >\n    <img',
)

if (next === text) {
  console.log("OpenSolar UI already applied; nothing to change.")
  process.exit(0)
}

fs.writeFileSync(path, next)
console.log("OpenSolar UI patch applied.")

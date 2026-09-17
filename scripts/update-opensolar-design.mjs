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
  const handler = `  const [openSolarImageUrl, setOpenSolarImageUrl] = useState(String(appointment?.open_solar_image || ""))\n\n  useEffect(() => {\n    setOpenSolarImageUrl(String(appointment?.open_solar_image || ""))\n  }, [appointment?.appointment_row_id, appointment?.open_solar_image])\n\n  const handleOpenSolarDesignLoaded = (payload) => {\n    const imported = Array.isArray(payload?.arrays) ? payload.arrays : []\n    const imageUrl = String(payload?.imageUrl || payload?.systemImageUrl || "")\n    if (imageUrl) setOpenSolarImageUrl(imageUrl)\n\n    if (!imported.length) {\n      setFluxRateError("OpenSolar did not return any array/module groups for this project.")\n      return\n    }\n\n    if (payload?.truncated) {\n      setFluxRateError("OpenSolar returned more than 3 arrays. The calculator can display the first 3.")\n    } else {\n      setFluxRateError("")\n    }\n\n    setData((current) => ({\n      ...current,\n      arrays: [0, 1, 2].map((index) => {\n        const importedArray = imported[index]\n        if (!importedArray) return createArray()\n        return {\n          ...createArray(),\n          panelCount: Number(importedArray.panelCount || 0),\n          panelWattage: Number(importedArray.panelWattage || 460),\n          orientation: Number(importedArray.orientation || 0),\n          pitch: Number(importedArray.pitch || 0),\n          irradiance: Number(importedArray.irradiance || 0),\n          shading: Number(importedArray.shading ?? 1),\n        }\n      }),\n    }))\n  }\n\n`
  if (!next.includes(marker)) throw new Error("Could not locate the EPVS array geometry key")
  next = next.replace(marker, handler + marker)
}

const arrayTableMarker = `  {/* ARRAYS TABLE */}`
if (next.includes(arrayTableMarker) && !next.includes("openSolarImageUrl || \"/opensolar-system-placeholder.svg\"")) {
  const toolbar = `  <div\n    className="card-head"\n    style={{\n      alignItems: "center",\n      marginBottom: 12,\n    }}\n  >\n    <div>\n      <h2>OpenSolar System Design</h2>\n    </div>\n    <OpenSolarDesignButton\n      projectId={appointment?.open_solar_id}\n      onDesignLoaded={handleOpenSolarDesignLoaded}\n    />\n  </div>\n\n  <div\n    style={{\n      marginBottom: 16,\n      border: "1px solid #e2e8f0",\n      borderRadius: 12,\n      overflow: "hidden",\n      background: "#f8fafc",\n    }}\n  >\n    <img\n      src={openSolarImageUrl || "/opensolar-system-placeholder.svg"}\n      alt={openSolarImageUrl ? "OpenSolar system design" : "OpenSolar system design placeholder"}\n      style={{\n        display: "block",\n        width: "100%",\n        maxHeight: 520,\n        objectFit: "contain",\n        background: "#f8fafc",\n      }}\n    />\n  </div>\n\n`
  next = next.replace(arrayTableMarker, toolbar + arrayTableMarker)
}

if (next === text) {
  console.log("OpenSolar UI already applied; nothing to change.")
  process.exit(0)
}

fs.writeFileSync(path, next)
console.log("OpenSolar UI patch applied with card-style title and aligned action.")

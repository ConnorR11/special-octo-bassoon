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
  const handler = `  const [openSolarImageUrl, setOpenSolarImageUrl] = useState("")\n\n  const handleOpenSolarDesignLoaded = (payload) => {\n    const imported = Array.isArray(payload?.arrays) ? payload.arrays : []\n\n    setOpenSolarImageUrl(String(payload?.systemImageUrl || ""))\n\n    if (!imported.length) {\n      setFluxRateError("OpenSolar did not return any array/module groups for this project.")\n      return\n    }\n\n    if (payload?.truncated) {\n      setFluxRateError("OpenSolar returned more than 3 arrays. The calculator can display the first 3.")\n    } else {\n      setFluxRateError("")\n    }\n\n    setData((current) => ({\n      ...current,\n      arrays: [0, 1, 2].map((index) => {\n        const importedArray = imported[index]\n        if (!importedArray) return createArray()\n        return {\n          ...createArray(),\n          panelCount: Number(importedArray.panelCount || 0),\n          orientation: Number(importedArray.orientation || 0),\n          pitch: Number(importedArray.pitch || 0),\n          irradiance: Number(importedArray.irradiance || 0),\n          shading: Number(importedArray.shading ?? 1),\n        }\n      }),\n    }))\n  }\n\n`
  if (!next.includes(marker)) throw new Error("Could not locate the EPVS array geometry key")
  next = next.replace(marker, handler + marker)
}

if (next.includes("const handleOpenSolarDesignLoaded") && !next.includes("irradiance: Number(importedArray.irradiance")) {
  const oldLine = `          pitch: Number(importedArray.pitch || 0),\n          shading: Number(importedArray.shading ?? 1),`
  const newLines = `          pitch: Number(importedArray.pitch || 0),\n          irradiance: Number(importedArray.irradiance || 0),\n          shading: Number(importedArray.shading ?? 1),`
  if (!next.includes(oldLine)) throw new Error("Could not locate the existing OpenSolar array mapping")
  next = next.replace(oldLine, newLines)
}

if (next.includes("const handleOpenSolarDesignLoaded") && !next.includes("setOpenSolarImageUrl(String(payload?.systemImageUrl || \"\"))")) {
  const handlerMarker = `  const handleOpenSolarDesignLoaded = (payload) => {\n    const imported = Array.isArray(payload?.arrays) ? payload.arrays : []\n`
  if (!next.includes(handlerMarker)) throw new Error("Could not locate the existing OpenSolar design handler")
  next = next.replace(handlerMarker, `${handlerMarker}\n    setOpenSolarImageUrl(String(payload?.systemImageUrl || ""))\n`)
}

if (next.includes("const handleOpenSolarDesignLoaded") && !next.includes("const [openSolarImageUrl, setOpenSolarImageUrl]")) {
  const marker = `  const handleOpenSolarDesignLoaded = (payload) => {\n`
  if (!next.includes(marker)) throw new Error("Could not locate the OpenSolar design handler")
  next = next.replace(marker, `  const [openSolarImageUrl, setOpenSolarImageUrl] = useState("")\n\n${marker}`)
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
  const imageBlock = `  <div\n    style={{\n      marginBottom: 16,\n      border: "1px solid #e2e8f0",\n      borderRadius: 12,\n      overflow: "hidden",\n      background: "#f8fafc",\n    }}\n  >\n    <img\n      src={openSolarImageUrl || "/opensolar-system-placeholder.svg"}\n      alt={openSolarImageUrl ? "OpenSolar system design" : "OpenSolar system design placeholder"}\n      style={{\n        display: "block",\n        width: "100%",\n        maxHeight: 520,\n        objectFit: "contain",\n        background: "#f8fafc",\n      }}\n    />\n  </div>\n\n`
  next = next.replace(arrayTableMarker, imageBlock + arrayTableMarker)
}

if (next === text) {
  console.log("OpenSolar UI already applied; nothing to change.")
  process.exit(0)
}

fs.writeFileSync(path, next)
console.log("OpenSolar UI patch applied.")

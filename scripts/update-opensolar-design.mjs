import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
const text = fs.readFileSync(path, "utf8")
let next = text

if (!next.includes('import OpenSolarDesignButton from "./components/EPVS/OpenSolarDesignButton"')) {
  const importMarker = 'import ThirtyYearBreakdown from "./components/EPVS/ThirtyYearBreakdown"'
  if (!next.includes(importMarker)) {
    throw new Error("Could not locate the EPVS breakdown imports")
  }
  next = next.replace(
    importMarker,
    `${importMarker}\nimport OpenSolarDesignButton from "./components/EPVS/OpenSolarDesignButton"`
  )
}

if (!next.includes("const handleOpenSolarDesignLoaded")) {
  const marker = `  const arrayGeometryKey = data.arrays\n`
  const handler = `  const handleOpenSolarDesignLoaded = (payload) => {\n    const imported = Array.isArray(payload?.arrays) ? payload.arrays : []\n\n    if (!imported.length) {\n      setFluxRateError("OpenSolar did not return any array/module groups for this project.")\n      return\n    }\n\n    if (payload?.truncated) {\n      setFluxRateError("OpenSolar returned more than 3 arrays. The calculator can display the first 3.")\n    } else {\n      setFluxRateError("")\n    }\n\n    setData((current) => ({\n      ...current,\n      arrays: [0, 1, 2].map((index) => {\n        const importedArray = imported[index]\n        if (!importedArray) return createArray()\n\n        return {\n          ...createArray(),\n          panelCount: Number(importedArray.panelCount || 0),\n          orientation: Number(importedArray.orientation || 0),\n          pitch: Number(importedArray.pitch || 0),\n          shading: Number(importedArray.shading ?? 1),\n        }\n      }),\n    }))\n  }\n\n`
  if (!next.includes(marker)) {
    throw new Error("Could not locate the EPVS array geometry key")
  }
  next = next.replace(marker, handler + marker)
}

const solarCardPattern = /<Card\n  title="Solar PV arrays"\n  subtitle="Enter the EPVS information for each roof \/ array\."\n>\n/
if (solarCardPattern.test(next) && !next.includes("projectId={appointment?.open_solar_id}")) {
  next = next.replace(
    solarCardPattern,
    `<Card\n  title="Solar PV arrays"\n  subtitle="Enter the EPVS information for each roof / array."\n  action={\n    <OpenSolarDesignButton\n      projectId={appointment?.open_solar_id}\n      onDesignLoaded={handleOpenSolarDesignLoaded}\n    />\n  }\n>\n`
  )
}

const cardSignature = /function Card\(\{\n  title,\n  subtitle,\n  children,\n\}\) \{/s
if (cardSignature.test(next) && !next.includes("  action,\n")) {
  next = next.replace(
    cardSignature,
    `function Card({\n  title,\n  subtitle,\n  action,\n  children,\n}) {`
  )
}

const cardHeaderPattern = /      <div\n        className="card-head"\n      >\n        <div>\n          <h2>\{title\}<\/h2>\n\n          <p>\n            \{subtitle\}\n          <\/p>\n        <\/div>\n      <\/div>/s
if (cardHeaderPattern.test(next) && !next.includes("{action && <div")) {
  next = next.replace(
    cardHeaderPattern,
    `      <div\n        className="card-head"\n        style={{\n          display: "flex",\n          alignItems: "flex-start",\n          justifyContent: "space-between",\n          gap: 16,\n        }}\n      >\n        <div>\n          <h2>{title}</h2>\n\n          <p>\n            {subtitle}\n          </p>\n        </div>\n\n        {action && <div style={{ marginLeft: "auto", flexShrink: 0 }}>{action}</div>}\n      </div>`
  )
}

if (next === text) {
  throw new Error("OpenSolar UI patch made no changes")
}

fs.writeFileSync(path, next)

import fs from "node:fs"

const path = "src/EPVSCalculator.jsx"
const text = fs.readFileSync(path, "utf8")
let next = text

const saveCardMarker = `          <Card\n            title="Energy"\n            subtitle="Electricity usage and existing solar PV."\n          >`
const saveCardReplacement = `          <Card\n            title="Energy"\n            subtitle="Electricity usage and existing solar PV."\n            className="epvs-energy-card"\n            action={\n              <button\n                type="button"\n                onClick={saveCalculation}\n                disabled={savingCalculation || !hasRequiredEnergyInputs}\n                style={{\n                  ...styles.primary,\n                  opacity: savingCalculation || !hasRequiredEnergyInputs ? 0.65 : 1,\n                  cursor: savingCalculation || !hasRequiredEnergyInputs ? "default" : "pointer",\n                  whiteSpace: "nowrap",\n                }}\n              >\n                {savingCalculation ? "Saving..." : "Save Current Bill Info"}\n              </button>\n            }\n          >`
if (next.includes(saveCardMarker) && !next.includes("Save Current Bill Info")) {
  next = next.replace(saveCardMarker, saveCardReplacement)
}

// Add stable semantic classes to the three EPVS cards so their styling does not
// depend on DOM position. These replacements are independent of the save-button
// patch and therefore also run when the save UI has already been applied.
const energyCardWithoutClass = `          <Card\n            title="Energy"\n            subtitle="Electricity usage and existing solar PV."\n          >`
const energyCardWithClass = `          <Card\n            title="Energy"\n            subtitle="Electricity usage and existing solar PV."\n            className="epvs-energy-card"\n          >`
if (next.includes(energyCardWithoutClass)) {
  next = next.replace(energyCardWithoutClass, energyCardWithClass)
}

const solarCardWithoutClass = `<Card\n  title=""\n  subtitle=""\n>`
const solarCardWithClass = `<Card\n  title=""\n  subtitle=""\n  className="epvs-solar-card"\n>`
if (next.includes(solarCardWithoutClass)) {
  next = next.replace(solarCardWithoutClass, solarCardWithClass)
}

const batteryCardWithoutClass = `<Card\n  title="Battery & Inverter"\n  subtitle="Configure the proposed battery and inverter."\n>`
const batteryCardWithClass = `<Card\n  title="Battery & Inverter"\n  subtitle="Configure the proposed battery and inverter."\n  className="epvs-battery-card"\n>`
if (next.includes(batteryCardWithoutClass)) {
  next = next.replace(batteryCardWithoutClass, batteryCardWithClass)
}

const cardSignature = `function Card({\n  title,\n  subtitle,\n  children,\n}) {`
const cardSignatureReplacement = `function Card({\n  title,\n  subtitle,\n  className,\n  action,\n  children,\n}) {`
if (next.includes(cardSignature)) {
  next = next.replace(cardSignature, cardSignatureReplacement)
}

const cardRoot = `      className="card"\n      style={{\n        marginBottom: 20,\n      }}`
const cardRootReplacement = `      className={["card", className].filter(Boolean).join(" ")}\n      style={{\n        marginBottom: 20,\n      }}`
if (next.includes(cardRoot)) {
  next = next.replace(cardRoot, cardRootReplacement)
}

const cardHeader = `      <div\n        className="card-head"\n      >\n        <div>\n          <h2>{title}</h2>\n\n          <p>\n            {subtitle}\n          </p>\n        </div>\n      </div>`
const cardHeaderReplacement = `      {(title || subtitle || action) && (\n        <div\n          className="card-head"\n          style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}\n        >\n          <div>\n            <h2>{title}</h2>\n\n            <p>\n              {subtitle}\n            </p>\n          </div>\n          {action && <div style={{ marginLeft: "auto", flexShrink: 0 }}>{action}</div>}\n        </div>\n      )}`
if (next.includes(cardHeader) && !next.includes("{action && <div")) {
  next = next.replace(cardHeader, cardHeaderReplacement)
}

const saveBar = `          <div\n            style={{\n              display: "flex",\n              alignItems: "center",\n              justifyContent: "flex-end",\n              gap: 12,\n              marginTop: -4,\n              marginBottom: 20,\n              padding: "12px 0",\n            }}\n          >\n            <div\n              style={{\n                marginRight: "auto",\n                fontSize: 11,\n                color: saveError ? "#b42318" : "#299d48",\n                fontWeight: 600,\n              }}\n            >\n              {saveError || saveMessage}\n            </div>\n\n            <button\n              type="button"\n              onClick={saveCalculation}\n              disabled={savingCalculation || !hasRequiredEnergyInputs}\n              style={{\n                ...styles.primary,\n                opacity: savingCalculation || !hasRequiredEnergyInputs ? 0.65 : 1,\n                cursor: savingCalculation || !hasRequiredEnergyInputs ? "default" : "pointer",\n              }}\n            >\n              {savingCalculation ? "Saving..." : "Save calculation"}\n            </button>\n          </div>`
const saveBarReplacement = `          {(saveError || saveMessage) && (\n            <div\n              style={{\n                marginTop: 8,\n                marginBottom: 20,\n                fontSize: 11,\n                color: saveError ? "#b42318" : "#299d48",\n                fontWeight: 600,\n              }}\n            >\n              {saveError || saveMessage}\n            </div>\n          )}`
if (next.includes(saveBar)) {
  next = next.replace(saveBar, saveBarReplacement)
}

if (next === text) {
  console.log("Current bill save/card UI already applied; nothing to change.")
  process.exit(0)
}

fs.writeFileSync(path, next)
console.log("Current bill save/card UI patch applied with single OpenSolar header.")

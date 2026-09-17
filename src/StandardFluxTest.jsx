import React, { useMemo, useState } from "react"
import { calculateStandardFlux } from "./standardFluxEngine"

const initial = {
  generationKwh: 7000,
  annualGridConsumptionKwh: 5000,
  inverterCapacityKw: 5,
  batteryCapacityKwh: 9.5,
  sunshineHours: 3.38,
  numberOfStrings: 2,
  inverterEuEfficiency: 97,
  batteryDoD: 95,
  batteryRTE: 94,
  existingGenerationKwh: 0,
  existingSolarSelfConsumptionPercent: 50,
  currentImportRatePence: 30,
  currentExportRatePence: 4.42,
  currentStandingChargePence: 62.83,
  fluxDayImportPence: 24.96,
  fluxDayExportPence: 9.55,
  fluxImportRatePence: 14.98,
  fluxPeakImportPence: 34.94,
  fluxPeakExportPence: 27.19,
  fluxStandingChargePence: 62.83,
}

const fields = [
  ["generationKwh", "Generation (kWh)", 0.01],
  ["annualGridConsumptionKwh", "Grid consumption (kWh)", 0.01],
  ["inverterCapacityKw", "Inverter (kW)", 0.01],
  ["batteryCapacityKwh", "Battery (kWh)", 0.01],
  ["sunshineHours", "Sunshine hours", 0.01],
  ["numberOfStrings", "Number of strings", 1],
  ["inverterEuEfficiency", "Inverter EU efficiency (%)", 0.1],
  ["batteryDoD", "Battery DoD (%)", 0.1],
  ["batteryRTE", "Battery RTE (%)", 0.1],
  ["existingGenerationKwh", "Existing generation (kWh)", 0.01],
  ["existingSolarSelfConsumptionPercent", "Existing solar SC (%)", 0.1],
  ["currentImportRatePence", "Current import (p/kWh)", 0.01],
  ["currentExportRatePence", "Current export (p/kWh)", 0.01],
  ["currentStandingChargePence", "Current standing charge (p/day)", 0.01],
  ["fluxDayImportPence", "Flux Day import (p/kWh)", 0.01],
  ["fluxDayExportPence", "Flux Day export (p/kWh)", 0.01],
  ["fluxImportRatePence", "Flux import (p/kWh)", 0.01],
  ["fluxPeakImportPence", "Flux Peak import (p/kWh)", 0.01],
  ["fluxPeakExportPence", "Flux Peak export (p/kWh)", 0.01],
  ["fluxStandingChargePence", "Flux standing charge (p/day)", 0.01],
]

const money = (value) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

const number = (value) => Number(value || 0).toLocaleString("en-GB", { maximumFractionDigits: 2 })

function Result({ label, value, suffix = "" }) {
  return (
    <div style={styles.result}>
      <span>{label}</span>
      <strong>{typeof value === "number" ? number(value) : value}{suffix}</strong>
    </div>
  )
}

export default function StandardFluxTest() {
  const [input, setInput] = useState(initial)

  const result = useMemo(() => calculateStandardFlux(input), [input])

  function update(key, value) {
    setInput((current) => ({ ...current, [key]: Number(value) }))
  }

  return (
    <section style={styles.container}>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>DEVELOPMENT TEST</div>
          <h2 style={styles.title}>Standard Flux Engine</h2>
          <p style={styles.subtitle}>
            This panel runs the isolated Standard Flux engine directly. It does not replace the existing EPVS calculator results.
          </p>
        </div>
        <div style={styles.badge}>Standard Flux only</div>
      </div>

      <div style={styles.grid}>
        <div style={styles.inputs}>
          <h3 style={styles.sectionTitle}>Test inputs</h3>
          <div style={styles.inputGrid}>
            {fields.map(([key, label, step]) => (
              <label key={key} style={styles.field}>
                <span>{label}</span>
                <input
                  type="number"
                  step={step}
                  value={input[key]}
                  onChange={(event) => update(key, event.target.value)}
                />
              </label>
            ))}
          </div>
        </div>

        <div style={styles.outputs}>
          <h3 style={styles.sectionTitle}>Engine output</h3>

          <div style={styles.cards}>
            <Result label="Generation" value={result.generationKwh} suffix=" kWh" />
            <Result label="GC solar SC" value={result.gc.solarSC} suffix=" kWh" />
            <Result label="GC battery SC" value={result.gc.batterySC} suffix=" kWh" />
            <Result label="Force charge" value={result.forceCharge.importCapacity} suffix=" kWh" />
            <Result label="Capped export" value={result.export.cappedExportKwh} suffix=" kWh" />
            <Result label="Export benefit" value={money(result.export.cappedExportKwh * (Number(input.fluxDayExportPence || 0) / 100))} />
            <Result label="Annual saving" value={money(result.bill.annualSaving)} />
            <Result label="Number of strings" value={result.numberOfStrings} />
          </div>

          <div style={styles.breakdown}>
            <h4>Calculation breakdown</h4>
            <Result label="GC Peak solar SC" value={result.gc.peakSolarSC} suffix=" kWh" />
            <Result label="GC Day solar SC" value={result.gc.daySolarSC} suffix=" kWh" />
            <Result label="GC Peak battery SC" value={result.gc.peakBatterySC} suffix=" kWh" />
            <Result label="GC Day battery SC" value={result.gc.dayBatterySC} suffix=" kWh" />
            <Result label="GC Flux battery SC" value={result.gc.fluxBatterySC} suffix=" kWh" />
            <Result label="Peak export capacity" value={result.forceCharge.peakExportCapacity} suffix=" kWh" />
            <Result label="SP solar SC" value={result.sp.solarSC} suffix=" kWh" />
            <Result label="SP battery SC" value={result.sp.batterySC} suffix=" kWh" />
          </div>

          <details style={styles.details}>
            <summary>Show raw engine result</summary>
            <pre style={styles.pre}>{JSON.stringify(result, null, 2)}</pre>
          </details>
        </div>
      </div>
    </section>
  )
}

const styles = {
  container: {
    margin: "24px",
    padding: "24px",
    border: "1px solid #dbe3ea",
    borderRadius: 16,
    background: "#fff",
    boxShadow: "0 4px 18px rgba(15, 23, 42, 0.06)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    alignItems: "flex-start",
    marginBottom: 24,
  },
  eyebrow: { fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: "#64748b" },
  title: { margin: "4px 0 4px", fontSize: 22, color: "#002d49" },
  subtitle: { margin: 0, color: "#64748b", fontSize: 13, maxWidth: 720, lineHeight: 1.5 },
  badge: { padding: "7px 10px", borderRadius: 999, background: "#eef6ff", color: "#175985", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" },
  grid: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 24 },
  inputs: { minWidth: 0 },
  outputs: { minWidth: 0 },
  sectionTitle: { margin: "0 0 14px", fontSize: 15, color: "#002d49" },
  inputGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#475569" },
  cards: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 },
  result: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: "#f8fafc", fontSize: 12, color: "#475569" },
  breakdown: { marginTop: 16, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 },
  details: { marginTop: 16, fontSize: 12, color: "#475569" },
  pre: { marginTop: 10, maxHeight: 420, overflow: "auto", padding: 14, borderRadius: 10, background: "#0f172a", color: "#e2e8f0", fontSize: 11 },
}

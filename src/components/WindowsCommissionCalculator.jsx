import React, { useMemo, useState } from "react"

const COMMISSION_BANDS = [
  { min: -5.99, max: 0, type: "percentage", value: 10, label: "0% to -5.99%" },
  { min: -6.99, max: -6, type: "percentage", value: 9, label: "-6% to -6.99%" },
  { min: -7.99, max: -7, type: "percentage", value: 8, label: "-7% to -7.99%" },
  { min: -8.99, max: -8, type: "percentage", value: 7, label: "-8% to -8.99%" },
  { min: -9.99, max: -9, type: "percentage", value: 6, label: "-9% to -9.99%" },
  { min: -19.99, max: -10, type: "percentage", value: 5, label: "-10% to -19.99%" },
]

const FIXED_BANDS = [
  { min: 0, max: 1999, value: 50 },
  { min: 2000, max: 3999, value: 100 },
  { min: 4000, max: 4999, value: 150 },
  { min: 5000, max: 5999, value: 200 },
  { min: 6000, max: 9999, value: 250 },
  { min: 10000, max: 14999, value: 300 },
  { min: 15000, max: Infinity, value: 500 },
]

const inputStyle = {
  width: "100%",
  height: 42,
  padding: "0 12px",
  border: "1px solid #d7dee5",
  borderRadius: 7,
  background: "#fff",
  color: "#263645",
  fontFamily: "inherit",
  fontSize: 12,
  boxSizing: "border-box",
  outline: "none",
}

const money = value => `£${Math.round(Number(value) || 0).toLocaleString("en-GB")}`

function parseMoney(value) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function getCommissionBand(discountPercent, netValue) {
  if (discountPercent > 0) return null

  const percentageBand = COMMISSION_BANDS.find(band => discountPercent >= band.min && discountPercent <= band.max)
  if (percentageBand) return percentageBand

  if (discountPercent >= -29.99 && discountPercent <= -20) {
    const fixedBand = FIXED_BANDS.find(band => netValue >= band.min && netValue <= band.max)
    return fixedBand
      ? { ...fixedBand, type: "fixed", label: "-20% to -29.99%" }
      : null
  }

  if (discountPercent >= -39.99 && discountPercent <= -30) {
    return { type: "fixed", value: 50, label: "-30% to -39.99%" }
  }

  if (discountPercent <= -40) {
    return { type: "fixed", value: 0, label: "Over -40%" }
  }

  return null
}

export default function WindowsCommissionCalculator({ initialNetValue = "", initialSurveyCosting = "" }) {
  const [netValue, setNetValue] = useState(initialNetValue)
  const [surveyCosting, setSurveyCosting] = useState(initialSurveyCosting)

  const calculation = useMemo(() => {
    const net = parseMoney(netValue)
    const costing = parseMoney(surveyCosting)

    if (costing <= 0) {
      return { net, costing, discountPercent: null, band: null, commission: 0 }
    }

    // survey_costing is the full survey value and net_value is the sold value.
    // A sale below survey_costing therefore produces a negative discount.
    const discountPercent = ((net - costing) / costing) * 100
    const band = getCommissionBand(discountPercent, net)

    let commission = 0
    if (band) {
      commission = band.type === "percentage" ? net * (band.value / 100) : band.value
    }

    return { net, costing, discountPercent, band, commission }
  }, [netValue, surveyCosting])

  const hasCalculation = calculation.costing > 0
  const discountDisplay = hasCalculation && calculation.discountPercent !== null
    ? `${calculation.discountPercent.toFixed(2)}%`
    : "—"

  return (
    <section style={{ width: "100%", border: "1px solid #dfe5ea", borderRadius: 10, background: "#fff", overflow: "hidden" }}>
      <div style={{ padding: "15px 18px", background: "#0b79bd", color: "#fff" }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Windows Commission Calculator</div>
        <div style={{ marginTop: 3, fontSize: 10, opacity: 0.85 }}>Calculate commission from survey costing, net value and the applicable discount band.</div>
      </div>

      <div style={{ padding: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", marginBottom: 6, fontSize: 10, fontWeight: 700, color: "#59636c" }}>Survey Costing</span>
            <input type="number" min="0" step="0.01" value={surveyCosting} onChange={event => setSurveyCosting(event.target.value)} placeholder="e.g. 10000" style={inputStyle} />
          </label>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", marginBottom: 6, fontSize: 10, fontWeight: 700, color: "#59636c" }}>Net Sales Value</span>
            <input type="number" min="0" step="0.01" value={netValue} onChange={event => setNetValue(event.target.value)} placeholder="e.g. 8500" style={inputStyle} />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginTop: 16 }}>
          <div style={{ padding: "11px 12px", border: "1px solid #e1e7eb", borderRadius: 7, background: "#fafbfc" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#7b8790", textTransform: "uppercase" }}>Survey Costing</div>
            <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800, color: "#263645" }}>{money(calculation.costing)}</div>
          </div>
          <div style={{ padding: "11px 12px", border: "1px solid #e1e7eb", borderRadius: 7, background: "#fafbfc" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#7b8790", textTransform: "uppercase" }}>Discount</div>
            <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800, color: calculation.discountPercent !== null && calculation.discountPercent <= -20 ? "#c23b3b" : "#263645" }}>{discountDisplay}</div>
          </div>
          <div style={{ padding: "11px 12px", border: "1px solid #cfe2ef", borderRadius: 7, background: "#f7fbff" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#6d8495", textTransform: "uppercase" }}>Net Sales Value</div>
            <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800, color: "#1676b8" }}>{money(calculation.net)}</div>
          </div>
        </div>

        <div style={{ marginTop: 14, padding: "13px 14px", borderRadius: 8, background: "#f5f7f9", border: "1px solid #e1e6ea" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 15 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#7b8790", textTransform: "uppercase" }}>Commission Band</div>
              <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: "#263645" }}>{hasCalculation ? calculation.band?.label || "No commission band" : "Enter survey costing"}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#7b8790", textTransform: "uppercase" }}>Commission</div>
              <div style={{ marginTop: 2, fontSize: 22, fontWeight: 900, color: "#1676b8" }}>{money(calculation.commission)}</div>
            </div>
          </div>
          {hasCalculation && calculation.band && <div style={{ marginTop: 7, fontSize: 10, color: "#66737d" }}>{calculation.band.type === "percentage" ? `${calculation.band.value}% of ${money(calculation.net)}` : `${money(calculation.band.value)} fixed commission`}</div>}
        </div>
      </div>
    </section>
  )
}

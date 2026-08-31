import {
  Sun,
  Battery,
  Zap,
  ArrowUpRight,
  PoundSterling,
} from "lucide-react"

import { money } from "../../utils/formatters"

function AnnualBreakdown({ results }) {
  const rows = [
    {
      label: "Solar self-consumption",
      description:
        "Solar electricity generated and used directly in the property.",
      kwh: results?.solarSelfConsumption || 0,
      value: results?.solarBenefit || 0,
      icon: Sun,
    },
    {
      label: "Battery self-consumption",
      description:
        "Solar electricity stored in the battery and used later in the property.",
      kwh: results?.batteryContribution || 0,
      value: results?.batterySelfConsumptionBenefit || 0,
      icon: Battery,
    },
    {
      label: "Battery force charging",
      description:
        "Electricity purchased from the grid at a lower tariff and stored in the battery.",
      kwh: 0,
      value: results?.forceChargeBenefit || 0,
      icon: Zap,
    },
    {
      label: "Export",
      description:
        "Surplus electricity exported to the grid.",
      kwh: results?.exportKwh || 0,
      value: results?.exportBenefit || 0,
      icon: ArrowUpRight,
    },
  ]

  const totalValue = rows.reduce(
    (total, row) => total + Number(row.value || 0),
    0
  )

  return (
    <div className="card annual-breakdown">
      <div className="card-head">
        <div>
          <h2>Annual savings breakdown</h2>
          <p>
            Estimated annual financial benefit from the proposed system.
          </p>
        </div>

        <div className="annual-breakdown-total">
          <span>Total annual benefit</span>
          <strong>{money(totalValue)}</strong>
        </div>
      </div>

      <div className="annual-breakdown-table">
        <div className="annual-breakdown-header">
          <span>Benefit</span>
          <span>Energy</span>
          <span>Annual value</span>
        </div>

        {rows.map((row) => {
          const Icon = row.icon

          return (
            <div className="annual-breakdown-row" key={row.label}>
              <div className="annual-breakdown-benefit">
                <div className="annual-breakdown-icon">
                  <Icon size={18} />
                </div>

                <div>
                  <strong>{row.label}</strong>
                  <p>{row.description}</p>
                </div>
              </div>

              <div className="annual-breakdown-energy">
                {Math.round(Number(row.kwh || 0)).toLocaleString("en-GB")} kWh
              </div>

              <div className="annual-breakdown-value">
                {money(row.value)}
              </div>
            </div>
          )
        })}

        <div className="annual-breakdown-total-row">
          <strong>Total annual benefit</strong>

          <span>—</span>

          <strong>{money(totalValue)}</strong>
        </div>
      </div>

      <div className="annual-breakdown-footer">
        <PoundSterling size={16} />

        <span>
          This breakdown separates the individual sources of annual financial
          benefit.
        </span>
      </div>
    </div>
  )
}

export default AnnualBreakdown
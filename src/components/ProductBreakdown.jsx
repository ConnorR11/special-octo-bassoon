import { money } from "../utils/formatters"

function ProductBreakdown({ contracts }) {
  const map = {}

  contracts.forEach((contract) => {
    const product = contract.product || "Other"
    map[product] = (map[product] || 0) + Number(contract.deal_value || 0)
  })

  const items = Object.entries(map).sort((a, b) => b[1] - a[1])
  const max = items[0]?.[1] || 1

  if (items.length === 0) {
    return <div className="empty">No product data available.</div>
  }

  return (
    <div className="breakdown">
      {items.map(([product, value]) => (
        <div className="bar-row" key={product}>
          <div>
            <span>{product}</span>
            <b>{money(value)}</b>
          </div>

          <div className="bar">
            <i style={{ width: `${(value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default ProductBreakdown

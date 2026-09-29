import React from "react"

import {
  FileText,
  PoundSterling,
  CalendarDays,
} from "lucide-react"

import Stat from "../components/Stat"
import SalesChart from "../components/SalesChart"
import Installations from "./Installations"
import { money } from "../utils/formatters"

function SalesPerformance({
  contracts = [],
  total = 0,
  avg = 0,
  upcoming = 0,
  setSelected,
} = {}) {
  const safeContracts = Array.isArray(contracts) ? contracts : []
  const safeTotal = Number.isFinite(Number(total)) ? Number(total) : 0
  const safeAvg = Number.isFinite(Number(avg)) ? Number(avg) : 0
  const safeUpcoming = Number.isFinite(Number(upcoming)) ? Number(upcoming) : 0

  if (window.location.pathname === "/installations") {
    return <Installations setSelected={setSelected} />
  }

  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: "#222" }}>
            Sales Performance
          </h1>
          <p style={{ margin: "5px 0 0", fontSize: 11, color: "#888" }}>
            Overview of sales performance and activity
          </p>
        </div>
      </div>

      <div className="stats">
        <Stat
          icon={<FileText size={20} />}
          label="Deals (since 2018)"
          value={safeContracts.length}
        />
        <Stat
          icon={<PoundSterling size={20} />}
          label="Net Value (since 2018)"
          value={money(safeTotal)}
        />
        <Stat
          icon={<PoundSterling size={20} />}
          label="Average contract"
          value={money(safeAvg)}
        />
        <Stat
          icon={<CalendarDays size={20} />}
          label="Upcoming installations"
          value={safeUpcoming}
        />
      </div>

      <SalesChart contracts={safeContracts} />
    </section>
  )
}

export default SalesPerformance

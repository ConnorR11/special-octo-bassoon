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

function Dashboard({ contracts, total, avg, upcoming, setSelected }) {
  if (window.location.pathname === "/installations") {
    return <Installations setSelected={setSelected} />
  }

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: "#222" }}>Dashboard</h1>
          <p style={{ margin: "5px 0 0", fontSize: 11, color: "#888" }}>Overview of sales performance and activity</p>
        </div>
      </div>

      <div className="stats">
        <Stat icon={<FileText size={20} />} label="Deals (since 2018)" value={contracts.length} />
        <Stat icon={<PoundSterling size={20} />} label="Net Value (since 2018)" value={money(total)} />
        <Stat icon={<PoundSterling size={20} />} label="Average contract" value={money(avg)} />
        <Stat icon={<CalendarDays size={20} />} label="Upcoming installations" value={upcoming} />
      </div>

      <SalesChart contracts={contracts} />
    </section>
  )
}

export default Dashboard

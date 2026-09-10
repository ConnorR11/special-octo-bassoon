import React from "react"

import {
  Megaphone,
  Target,
  Phone,
  CalendarDays,
  Users,
  PoundSterling,
} from "lucide-react"

import Stat from "../components/Stat"


export default function MarketingDashboard({
  contracts = [],
  loading = false,
}) {

  return (
    <section>

      <div className="stats">

        <Stat
          icon={<Megaphone size={20} />}
          label="Marketing"
          value="Dashboard"
        />

        <Stat
          icon={<Target size={20} />}
          label="Leads"
          value="—"
        />

        <Stat
          icon={<Phone size={20} />}
          label="Calls"
          value="—"
        />

        <Stat
          icon={<CalendarDays size={20} />}
          label="Booked leads"
          value="—"
        />

      </div>


      <div className="grid2">

        <div className="card">

          <div className="card-head">
            <div>
              <h2>Marketing Dashboard</h2>
              <p>
                Marketing performance will be built here separately from the Home dashboard.
              </p>
            </div>
          </div>

          <div className="empty">
            <Megaphone size={28} />
            <p>
              Marketing reporting is ready for the next stage.
            </p>
          </div>

        </div>


        <div className="card">

          <div className="card-head">
            <div>
              <h2>Marketing data</h2>
              <p>
                This page is intentionally separate from sales and contract reporting.
              </p>
            </div>
          </div>

          <div className="rows">

            <div className="contract-row">
              <Users size={18} />
              <div className="row-main">
                <b>Contracts currently loaded</b>
                <span>
                  Available to use for future marketing attribution.
                </span>
              </div>
              <div className="row-value">
                <b>{loading ? "…" : contracts.length}</b>
              </div>
            </div>

            <div className="contract-row">
              <PoundSterling size={18} />
              <div className="row-main">
                <b>Marketing revenue attribution</b>
                <span>
                  Not connected yet.
                </span>
              </div>
              <div className="row-value">
                <b>—</b>
              </div>
            </div>

          </div>

        </div>

      </div>

    </section>
  )
}

```jsx
import React, { useEffect, useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"
import { supabase } from "../../lib/supabase"

function londonDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  )

  return `${values.year}-${values.month}-${values.day}`
}

function lastWeekDates() {
  const today = new Date(`${londonDate()}T12:00:00`)
  const day = today.getDay()

  const monday = new Date(today)
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1))

  const start = new Date(monday)
  start.setDate(start.getDate() - 7)

  const end = new Date(monday)
  end.setDate(end.getDate() - 1)

  return {
    start: londonDate(start),
    end: londonDate(end),
  }
}

function isTrue(value) {
  if (value === true) return true

  if (typeof value === "string") {
    return ["true", "t", "1", "yes", "y"].includes(
      value.trim().toLowerCase()
    )
  }

  return value === 1
}

function normalise(value) {
  return String(value ?? "").trim().toLowerCase()
}

function display(value, fallback = "Unassigned") {
  const text = String(value ?? "").trim()
  return text || fallback
}

function isSolar(appointment) {
  if (!appointment) return false

  return [
    appointment.product,
    appointment.type,
    appointment.appointment_type,
    appointment.job_type,
    appointment.product_type,
    appointment.service,
  ].some((value) => normalise(value).includes("solar")) ||
    Boolean(appointment.epvs_calculation)
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === "string") {
    const cleaned = value
      .replace(/£/g, "")
      .replace(/,/g, "")
      .replace(/%/g, "")
      .trim()

    if (!cleaned) return 0

    const number = Number(cleaned)

    return Number.isFinite(number) ? number : 0
  }

  const number = Number(value)

  return Number.isFinite(number) ? number : 0
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(toNumber(value))
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-GB").format(toNumber(value))
}

function formatRatio(p, s) {
  return s > 0 ? (p / s).toFixed(1) : "—"
}

function financeAmount(appointment) {
  const calculation = appointment?.epvs_calculation

  if (!calculation || typeof calculation !== "object") {
    return 0
  }

  const value = toNumber(
    calculation.financeAmount ??
      calculation.finance_amount ??
      calculation.finance ??
      0
  )

  return Math.max(0, value)
}

function decorateAppointment(appointment, deal) {
  const netValue = toNumber(
    deal?.net_value ??
      appointment?.net_value ??
      appointment?.contract_value ??
      appointment?.sale_value ??
      0
  )

  const stage = String(
    deal?.pipedrive_stage || ""
  ).trim()

  const solidValue =
    !["Deal Lost", "Sales"].includes(stage) &&
    Number.isFinite(netValue)
      ? netValue
      : 0

  return {
    ...appointment,
    net_value: netValue,
    solid_value: solidValue,
    finance_value: financeAmount(appointment),
  }
}

function makeStats(rows) {
  return rows.reduce(
    (total, row) => {
      if (isTrue(row.cps_h)) total.h += 1
      if (isTrue(row.cps_c)) total.c += 1
      if (isTrue(row.cps_p)) total.p += 1
      if (isTrue(row.cps_s)) total.s += 1

      total.net += toNumber(row.net_value)
      total.finance += toNumber(row.finance_value)
      total.solid += toNumber(row.solid_value)

      return total
    },
    {
      h: 0,
      c: 0,
      p: 0,
      s: 0,
      net: 0,
      finance: 0,
      solid: 0,
    }
  )
}

function metrics(stats) {
  return {
    ...stats,

    conv:
      stats.s > 0
        ? stats.p / stats.s
        : 0,

    aov:
      stats.s > 0
        ? stats.net / stats.s
        : 0,

    rpp:
      stats.p > 0
        ? stats.solid / stats.p
        : 0,
  }
}

function Table({
  rows,
  showRep = false,
  title,
}) {
  const total = useMemo(
    () =>
      metrics(
        makeStats(
          rows.flatMap(
            (row) => row.rows || []
          )
        )
      ),
    [rows]
  )

  const columns = [
    "C",
    "P",
    "S",
    "Net",
    "Finance",
    "Conv",
    "AOV",
    "Solid",
    "RPP",
  ]

  return (
    <div className="sales-mi-report-table-wrap">
      <div className="sales-mi-report-title">
        {title}
      </div>

      <div className="sales-mi-scroll">
        <table className="sales-mi-table">
          <colgroup>
            <col className="sales-mi-name-column" />

            {columns.map((column) => (
              <col
                key={column}
                className="sales-mi-value-column"
              />
            ))}
          </colgroup>

          <thead>
            <tr>
              <th>
                {showRep
                  ? "Sales Rep"
                  : "Windows"}
              </th>

              {columns.map((column) => (
                <th key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const stats = metrics(
                makeStats(
                  row.rows || []
                )
              )

              return (
                <tr key={row.name}>
                  <td>{row.name}</td>

                  <td>
                    {formatNumber(stats.c)}
                  </td>

                  <td>
                    {formatNumber(stats.p)}
                  </td>

                  <td>
                    {formatNumber(stats.s)}
                  </td>

                  <td>
                    {formatCurrency(stats.net)}
                  </td>

                  <td>
                    {formatCurrency(
                      stats.finance
                    )}
                  </td>

                  <td>
                    {formatRatio(
                      stats.p,
                      stats.s
                    )}
                  </td>

                  <td>
                    {formatCurrency(
                      stats.aov
                    )}
                  </td>

                  <td>
                    {formatCurrency(
                      stats.solid
                    )}
                  </td>

                  <td>
                    {formatCurrency(
                      stats.rpp
                    )}
                  </td>
                </tr>
              )
            })}

            <tr className="sales-mi-total">
              <td>
                {showRep
                  ? "Company Total"
                  : "Total"}
              </td>

              <td>
                {formatNumber(total.c)}
              </td>

              <td>
                {formatNumber(total.p)}
              </td>

              <td>
                {formatNumber(total.s)}
              </td>

              <td>
                {formatCurrency(total.net)}
              </td>

              <td>
                {formatCurrency(
                  total.finance
                )}
              </td>

              <td>
                {formatRatio(
                  total.p,
                  total.s
                )}
              </td>

              <td>
                {formatCurrency(
                  total.aov
                )}
              </td>

              <td>
                {formatCurrency(
                  total.solid
                )}
              </td>

              <td>
                {formatCurrency(
                  total.rpp
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function SalesMI() {
  const [appointments, setAppointments] =
    useState([])

  const [profiles, setProfiles] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState("")

  const dates = useMemo(
    () => lastWeekDates(),
    []
  )

  async function loadReport() {
    if (!supabase) {
      setError(
        "Supabase is not configured."
      )

      setLoading(false)

      return
    }

    setLoading(true)
    setError("")

    try {
      const endExclusive =
        new Date(
          `${dates.end}T12:00:00`
        )

      endExclusive.setDate(
        endExclusive.getDate() + 1
      )

      const end =
        londonDate(endExclusive)

      const [
        appointmentsResult,
        profilesResult,
      ] = await Promise.all([
        supabase
          .from("appointments")
          .select(
            "*, deals(net_value, pipedrive_stage)"
          )
          .gte(
            "appointment_date",
            `${dates.start}T00:00:00`
          )
          .lt(
            "appointment_date",
            `${end}T00:00:00`
          )
          .order(
            "appointment_date",
            {
              ascending: true,
            }
          ),

        supabase
          .from("profiles")
          .select(
            "email, full_name"
          )
          .order(
            "full_name",
            {
              ascending: true,
            }
          ),
      ])

      if (appointmentsResult.error) {
        throw appointmentsResult.error
      }

      if (profilesResult.error) {
        throw profilesResult.error
      }

      const decoratedAppointments =
        (
          appointmentsResult.data ||
          []
        ).map((appointment) => {
          const deal = Array.isArray(
            appointment.deals
          )
            ? appointment.deals[0]
            : appointment.deals

          return decorateAppointment(
            appointment,
            deal
          )
        })

      setAppointments(
        decoratedAppointments
      )

      setProfiles(
        profilesResult.data || []
      )
    } catch (err) {
      console.error(
        "Error loading Sales MI:",
        err
      )

      setError(
        err?.message ||
          "Unable to load Sales MI."
      )

      setAppointments([])
      setProfiles([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReport()
  }, [])

  const repNameByEmail = useMemo(
    () =>
      profiles.reduce(
        (map, profile) => {
          const email =
            normalise(
              profile.email
            )

          const name =
            String(
              profile.full_name ||
                ""
            ).trim()

          if (email && name) {
            map[email] = name
          }

          return map
        },
        {}
      ),
    [profiles]
  )

  const branchRows = useMemo(() => {
    const branchNames = [
      ...new Set(
        appointments.map(
          (appointment) =>
            display(
              appointment.branch
            )
        )
      ),
    ].sort((a, b) =>
      a.localeCompare(b)
    )

    return branchNames.map(
      (branch) => ({
        name: branch,

        rows:
          appointments.filter(
            (appointment) =>
              display(
                appointment.branch
              ) === branch
          ),
      })
    )
  }, [appointments])

  const windowRows = useMemo(
    () =>
      branchRows
        .map((branch) => ({
          ...branch,

          rows:
            branch.rows.filter(
              (appointment) =>
                !isSolar(
                  appointment
                )
            ),
        }))
        .filter(
          (branch) =>
            branch.rows.length > 0
        ),
    [branchRows]
  )

  const renewableRows = useMemo(
    () =>
      branchRows
        .map((branch) => ({
          ...branch,

          rows:
            branch.rows.filter(
              isSolar
            ),
        }))
        .filter(
          (branch) =>
            branch.rows.length > 0
        ),
    [branchRows]
  )

  const totalBranchRows = useMemo(
    () =>
      branchRows.map(
        (branch) => ({
          name: branch.name,
          rows: branch.rows,
        })
      ),
    [branchRows]
  )

  const repRows = useMemo(() => {
    const reps = new Map()

    appointments.forEach(
      (appointment) => {
        const email =
          normalise(
            appointment.rep_allocated
          )

        const name =
          repNameByEmail[email] ||
          display(
            appointment.rep_allocated,
            "Unallocated"
          )

        const key =
          email ||
          "__unallocated__"

        if (!reps.has(key)) {
          reps.set(key, {
            name,
            rows: [],
          })
        }

        reps
          .get(key)
          .rows.push(
            appointment
          )
      }
    )

    return [
      ...reps.values(),
    ].sort((a, b) =>
      a.name.localeCompare(
        b.name
      )
    )
  }, [
    appointments,
    repNameByEmail,
  ])

  return (
    <div className="sales-mi">
      <style>{`
        .sales-mi{
          width:100%;
          color:#172033;
          font-family:Inter,Arial,sans-serif
        }

        .sales-mi-top{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          margin-bottom:14px
        }

        .sales-mi-period{
          font-size:11px;
          font-weight:700;
          color:#64748b
        }

        .sales-mi-refresh{
          display:inline-flex;
          align-items:center;
          gap:6px;
          border:1px solid #d8e0e7;
          background:#fff;
          border-radius:7px;
          padding:7px 10px;
          color:#64748b;
          font-size:10px;
          font-weight:700;
          cursor:pointer
        }

        .sales-mi-refresh:disabled{
          opacity:.55;
          cursor:default
        }

        .sales-mi-report{
          margin-top:12px
        }

        .sales-mi-report-title{
          background:#0877bd;
          color:#fff;
          font-style:italic;
          font-weight:800;
          font-size:18px;
          line-height:1;
          padding:6px 10px
        }

        .sales-mi-scroll{
          width:100%;
          overflow-x:auto
        }

        .sales-mi-table{
          width:100%;
          min-width:1000px;
          border-collapse:collapse;
          table-layout:fixed;
          font-size:13px;
          background:#fff
        }

        .sales-mi-table col.sales-mi-name-column{
          width:22%
        }

        .sales-mi-table col.sales-mi-value-column{
          width:8.666%
        }

        .sales-mi-table th,
        .sales-mi-table td{
          border:1px solid #202020;
          padding:4px 8px;
          white-space:nowrap;
          vertical-align:middle;
          overflow:hidden;
          text-overflow:ellipsis
        }

        .sales-mi-table th{
          background:#777;
          color:#fff;
          font-weight:800;
          text-align:center
        }

        .sales-mi-table th:first-child{
          text-align:left
        }

        .sales-mi-table td{
          text-align:center
        }

        .sales-mi-table td:first-child{
          text-align:left
        }

        .sales-mi-table tbody tr:nth-child(even){
          background:#f8f8f8
        }

        .sales-mi-total td{
          background:#777;
          color:#fff;
          font-weight:800;
          text-align:center
        }

        .sales-mi-total td:first-child{
          text-align:left
        }

        .sales-mi-error{
          padding:12px;
          background:#fff5f5;
          border:1px solid #efcaca;
          border-radius:8px;
          color:#a33b3b;
          font-size:11px
        }

        .sales-mi-loading{
          padding:25px;
          text-align:center;
          color:#64748b;
          font-size:11px
        }

        .sales-mi-spacer{
          height:14px
        }

        @media(max-width:900px){
          .sales-mi-top{
            align-items:flex-start
          }

          .sales-mi-period{
            font-size:10px
          }

          .sales-mi-table{
            min-width:1000px;
            font-size:12px
          }

          .sales-mi-report-title{
            font-size:16px
          }

          .sales-mi-table th,
          .sales-mi-table td{
            padding:4px 7px
          }
        }
      `}</style>

      <div className="sales-mi-top">
        <div className="sales-mi-period">
          Last week: {dates.start} to{" "}
          {dates.end} (Monday–Sunday)
        </div>

        <button
          type="button"
          className="sales-mi-refresh"
          onClick={loadReport}
          disabled={loading}
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="sales-mi-error">
          {error}
        </div>
      ) : loading ? (
        <div className="sales-mi-loading">
          Loading Sales MI...
        </div>
      ) : (
        <>
          <Table
            title="Branch KPI — Windows"
            rows={windowRows}
          />

          <div className="sales-mi-spacer" />

          <Table
            title="Branch KPI — Renewables"
            rows={renewableRows}
          />

          <div className="sales-mi-spacer" />

          <Table
            title="Branch KPI — Total"
            rows={totalBranchRows}
          />

          <div className="sales-mi-spacer" />

          <Table
            title="Sales Rep KPI"
            rows={repRows}
            showRep
          />
        </>
      )}
    </div>
  )
}
```

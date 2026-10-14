import React, { useEffect, useMemo, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react"
import { supabase } from "./lib/supabase"
import { money } from "./utils/formatters"

function FitSheet({ setSelected }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekDeals, setWeekDeals] = useState([])
  const [weekIssues, setWeekIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [installationTypeFilter, setInstallationTypeFilter] =
    useState("all")
  const [windowTeamsExpanded, setWindowTeamsExpanded] = useState(true)
  const [windowsRenewablesExpanded, setWindowsRenewablesExpanded] = useState(true)
  const [heatPumpExpanded, setHeatPumpExpanded] = useState(true)
  const [roofExpanded, setRoofExpanded] = useState(true)
  const [electricsExpanded, setElectricsExpanded] = useState(true)
  const [renewableRemedialsExpanded, setRenewableRemedialsExpanded] = useState(true)

  function getMonday(date) {
    const d = new Date(date)
    const day = d.getDay()
    const difference = day === 0 ? -6 : 1 - day

    d.setDate(d.getDate() + difference)
    d.setHours(0, 0, 0, 0)

    return d
  }

  const currentWeek = useMemo(() => {
    const monday = getMonday(new Date())

    monday.setDate(
      monday.getDate() + weekOffset * 7
    )

    return monday
  }, [weekOffset])

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = new Date(currentWeek)

        date.setDate(
          currentWeek.getDate() + index
        )

        return date
      }),
    [currentWeek]
  )

  function formatDate(date) {
    if (
      !(date instanceof Date) ||
      Number.isNaN(date.getTime())
    ) {
      return ""
    }

    const year = date.getFullYear()

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0")

    const day = String(
      date.getDate()
    ).padStart(2, "0")

    return `${year}-${month}-${day}`
  }

  const weekStart = formatDate(
    weekDays[0]
  )

  const weekEnd = formatDate(
    weekDays[6]
  )

  const weekTitle = useMemo(() => {
    const start = weekDays[0]
    const end = weekDays[6]

    if (!start || !end) return ""

    return `${start.toLocaleDateString(
      "en-GB",
      {
        day: "numeric",
        month: "short",
      }
    )} – ${end.toLocaleDateString(
      "en-GB",
      {
        day: "numeric",
        month: "short",
      }
    )}`
  }, [weekDays])

  /*
   * ------------------------------------------------------------
   * LOAD WEEK
   * ------------------------------------------------------------
   */

  useEffect(() => {
    let mounted = true

    async function loadWeek() {
      if (!supabase) {
        setWeekDeals([])
        setWeekIssues([])
        setLoading(false)
        return
      }

      setLoading(true)
      setLoadError("")

      const dealSelect =
        "id,customer_name,postcode,contract_number,deal_value,balance_outstanding,product,installation_start_date,fit_team_1,installation_roof_start_date,installation_roof_team,installation_electrics_start_date,installation_electrics_team,remedial_start_date,remedial_fit_team,pipedrive_stage"

      const issueSelect =
        "id,customer_name,postcode,contract_number,deal_value,balance_outstanding,product,installations_issues_start_date,installation_issues_fit_team,pipedrive_stage"

      const [
        normalResult,
        issueResult,
      ] = await Promise.all([
        supabase
          .from("deals")
          .select(dealSelect)
          .or(
            `installation_start_date.gte.${weekStart},installation_roof_start_date.gte.${weekStart},installation_electrics_start_date.gte.${weekStart},remedial_start_date.gte.${weekStart}`
          )
          .order(
            "installation_start_date",
            {
              ascending: true,
            }
          ),

        supabase
          .from("deals")
          .select(issueSelect)
          .gte(
            "installations_issues_start_date",
            weekStart
          )
          .lte(
            "installations_issues_start_date",
            weekEnd
          )
          .order(
            "installations_issues_start_date",
            {
              ascending: true,
            }
          ),
      ])

      if (!mounted) return

      if (
        normalResult.error ||
        issueResult.error
      ) {
        const message =
          normalResult.error?.message ||
          issueResult.error?.message ||
          "Unable to load Fit Sheet data."

        console.error(
          "Error loading Fit Sheet week:",
          normalResult.error ||
            issueResult.error
        )

        setLoadError(message)
      }

      const rawDeals =
        Array.isArray(normalResult.data)
          ? normalResult.data
          : []

      const filteredDeals =
        rawDeals.filter((deal) => {
          const dates = [
            deal?.installation_start_date,
            deal?.installation_roof_start_date,
            deal?.installation_electrics_start_date,
            deal?.remedial_start_date,
          ]

          return dates.some((value) => {
            const date = String(
              value || ""
            ).slice(0, 10)

            return (
              date >= weekStart &&
              date <= weekEnd
            )
          })
        })

      setWeekDeals(filteredDeals)

      setWeekIssues(
        Array.isArray(issueResult.data)
          ? issueResult.data
          : []
      )

      setLoading(false)
    }

    loadWeek().catch((err) => {
      if (!mounted) return

      console.error(
        "Unexpected error loading Fit Sheet week:",
        err
      )

      setLoadError(
        err?.message ||
          "Unable to load Fit Sheet data."
      )

      setWeekDeals([])
      setWeekIssues([])
      setLoading(false)
    })

    return () => {
      mounted = false
    }
  }, [weekStart, weekEnd])

  const safeWeekDeals =
    Array.isArray(weekDeals)
      ? weekDeals
      : []

  const safeWeekIssues =
    Array.isArray(weekIssues)
      ? weekIssues
      : []

  /*
   * ------------------------------------------------------------
   * JOB COLOURS
   * ------------------------------------------------------------
   */

  const jobTypes = {
    fit: {
      label: "Fit",
      background: "#e8f4e2",
      border: "#cbd8c5",
      text: "#263522",
    },

    roofer: {
      label: "Roofer",
      background: "#fff0df",
      border: "#f1c89b",
      text: "#8a541f",
    },

    electrics: {
      label: "Electrics",
      background: "#e3f0ff",
      border: "#b8d4f2",
      text: "#24527a",
    },

    remedial: {
      label: "Remedial",
      background: "#eee5fa",
      border: "#d2bce8",
      text: "#67408a",
    },

    issue: {
      label: "Issue",
      background: "#fde8e8",
      border: "#f0b8b8",
      text: "#b42318",
    },
  }

  /*
   * ------------------------------------------------------------
   * BUILD JOBS
   * ------------------------------------------------------------
   */

  const jobs = useMemo(() => {
    const result = []

    safeWeekDeals.forEach((deal) => {
      const entries = [
        [
          "fit",
          deal?.installation_start_date,
          deal?.fit_team_1,
        ],
        [
          "roofer",
          deal?.installation_roof_start_date,
          deal?.installation_roof_team,
        ],
        [
          "electrics",
          deal?.installation_electrics_start_date,
          deal?.installation_electrics_team,
        ],
        [
          "remedial",
          deal?.remedial_start_date,
          deal?.remedial_fit_team,
        ],
      ]

      entries.forEach(
        ([type, rawDate, rawTeam]) => {
          if (!rawDate || !rawTeam) return

          const date =
            String(rawDate).slice(0, 10)

          if (
            date < weekStart ||
            date > weekEnd
          ) {
            return
          }

          result.push({
            id: `${type}-${deal.id}`,
            deal,
            type,
            date,
            team: String(
              rawTeam
            ).trim(),
            product: String(
              deal.product || ""
            ).trim(),
          })
        }
      )
    })

    /*
     * ISSUES
     */

    safeWeekIssues.forEach((deal) => {
      if (
        !deal?.installations_issues_start_date ||
        !deal?.installation_issues_fit_team
      ) {
        return
      }

      const date =
        String(
          deal.installations_issues_start_date
        ).slice(0, 10)

      if (
        date < weekStart ||
        date > weekEnd
      ) {
        return
      }

      result.push({
        id: `issue-${deal.id}`,
        deal,
        type: "issue",
        date,
        team: String(
          deal.installation_issues_fit_team
        ).trim(),
        product: String(
          deal.product || ""
        ).trim(),
      })
    })

    return result
  }, [
    safeWeekDeals,
    safeWeekIssues,
    weekStart,
    weekEnd,
  ])

  /*
   * ------------------------------------------------------------
   * INSTALLATION TYPE FILTER
   * ------------------------------------------------------------
   */

  const filteredJobs = useMemo(() => {
    if (
      installationTypeFilter ===
      "all"
    ) {
      return jobs
    }

    return jobs.filter(
      (job) =>
        job.type ===
        installationTypeFilter
    )
  }, [
    jobs,
    installationTypeFilter,
  ])

  /*
   * ------------------------------------------------------------
   * ONLY SHOW TEAMS WITH JOBS THIS WEEK
   * ------------------------------------------------------------
   */

  const fitTeamGroups = useMemo(() => {
    const configuredGroups = [
      { label: "ABERDEEN", teams: ["Paul Duncan", "Paul Falconer", "Jamie Adamson"] },
      { label: "FIFE", teams: ["Jon Gray"] },
      { label: "EDINBURGH", teams: ["Vladimir Ivanovs", "Vlad Team 2"] },
      { label: "TEAMS 1–11", teams: ["Darren Green", "Nicky McHugh", "Ian Kidd", "Daniel Barron", "Dmytro Mykhailenko Team 1", "John Cannon", "Andrei Vlasov", "Lloyd Reid", "Matt White", "David Coyle", "James Clarke"] },
    ]
    const normalise = (value) => String(value || "").trim().toLocaleLowerCase()
    const actualTeams = [...new Set(jobs.map((job) => String(job.team || "").trim()).filter(Boolean))]
    const assigned = new Set()
    const groups = configuredGroups.map((group) => ({
      label: group.label,
      teams: group.teams.map((expected) => {
        const actual = actualTeams.find((team) => normalise(team) === normalise(expected))
        const name = actual || expected
        assigned.add(normalise(name))
        return name
      }),
    }))
    const renewablesNames = ["Bryan Cartridge", "Gordon Pender", "Ken Murdoch"]
    const renewablesTeams = renewablesNames.map((expected) => {
      const actual = actualTeams.find((team) => normalise(team) === normalise(expected))
      if (actual) assigned.add(normalise(actual))
      return actual || expected
    })
    const heatPumpNames = ["Gordon Frew", "Ian Hogg", "Alan Gowans"]
    const heatPumpTeams = heatPumpNames.map((expected) => {
      const actual = actualTeams.find((team) => normalise(team) === normalise(expected))
      if (actual) assigned.add(normalise(actual))
      return actual || expected
    })
    const roofNames = ["Summers", "Marcin", "Craig Marshall", "JP McPhail", "Ross White", "Anton"]
    const roofTeams = roofNames.map((expected) => {
      const actual = actualTeams.find((team) => normalise(team) === normalise(expected))
      if (actual) assigned.add(normalise(actual))
      return actual || expected
    })
    const electricsNames = ["Mariusz", "Gregor King", "Lloyd Reilly", "Jordan Chadwick", "James Wilson", "Bruce Davidson", "Paul Connolly"]
    const electricsTeams = electricsNames.map((expected) => {
      const actual = actualTeams.find((team) => normalise(team) === normalise(expected))
      if (actual) assigned.add(normalise(actual))
      return actual || expected
    })
    const renewableRemedialsNames = ["Scott Harley"]
    const renewableRemedialsTeams = renewableRemedialsNames.map((expected) => {
      const actual = actualTeams.find((team) => normalise(team) === normalise(expected))
      if (actual) assigned.add(normalise(actual))
      return actual || expected
    })
    const unorganised = actualTeams.filter((team) => !assigned.has(normalise(team))).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
    if (unorganised.length) groups.push({ label: "UNORGANISED", teams: unorganised })
    return { windowGroups: groups, renewablesTeams, heatPumpTeams, roofTeams, electricsTeams, renewableRemedialsTeams }
  }, [jobs])

  const windowGroups = fitTeamGroups.windowGroups
  const renewablesTeams = fitTeamGroups.renewablesTeams
  const heatPumpTeams = fitTeamGroups.heatPumpTeams
  const roofTeams = fitTeamGroups.roofTeams
  const electricsTeams = fitTeamGroups.electricsTeams
  const renewableRemedialsTeams = fitTeamGroups.renewableRemedialsTeams

  const fitTeams = useMemo(
    () => [...windowGroups.flatMap((group) => group.teams), ...renewablesTeams, ...heatPumpTeams, ...roofTeams, ...electricsTeams, ...renewableRemedialsTeams],
    [windowGroups, renewablesTeams, heatPumpTeams, roofTeams, electricsTeams, renewableRemedialsTeams]
  )

  /*
   * ------------------------------------------------------------
   * JOB LOOKUP
   * ------------------------------------------------------------
   */

  function getJobs(
    team,
    date
  ) {
    const dateString =
      formatDate(date)

    return filteredJobs.filter(
      (job) =>
        job.team === team &&
        job.date === dateString
    )
  }

  const todayString =
    formatDate(new Date())

  function openDeal(deal) {
    if (
      typeof setSelected ===
      "function"
    ) {
      setSelected(deal)
    }
  }

  /*
   * ------------------------------------------------------------
   * JOB CARD
   * ------------------------------------------------------------
   */

  function renderJobCard(job) {
    const colours =
      jobTypes[job.type]

    const deal =
      job.deal

    return (
      <button
        key={job.id}
        type="button"
        onClick={() =>
          openDeal(deal)
        }
        style={{
          width: "100%",
          textAlign: "left",
          border: `1px solid ${colours.border}`,
          borderRadius: "5px",
          background:
            colours.background,
          padding: "8px",
          marginBottom: "5px",
          cursor: "pointer",
          fontFamily: "inherit",
          transition:
            "box-shadow 0.15s ease, transform 0.15s ease",
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.boxShadow =
            "0 2px 7px rgba(0,0,0,0.10)"

          event.currentTarget.style.transform =
            "translateY(-1px)"
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.boxShadow =
            "none"

          event.currentTarget.style.transform =
            "translateY(0)"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            gap: "5px",
            marginBottom: "4px",
          }}
        >
          <div
            style={{
              fontSize: "8px",
              fontWeight: 800,
              color: colours.text,
              textTransform:
                "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {colours.label}
          </div>

          {job.type ===
            "issue" && (
            <div
              style={{
                fontSize: "8px",
                fontWeight: 800,
                color: "#b42318",
              }}
            >
              !
            </div>
          )}
        </div>

        <div
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color: colours.text,
            lineHeight: "1.3",
          }}
        >
          {deal.customer_name ||
            "Unnamed customer"}
        </div>

        {deal.pipedrive_stage && (
          <div
            style={{
              marginTop: "3px",
              fontSize: "8px",
              fontWeight: 700,
              color: colours.text,
              opacity: 0.85,
            }}
          >
            {deal.pipedrive_stage}
          </div>
        )}

        {deal.postcode && (
          <div
            style={{
              marginTop: "3px",
              fontSize: "9px",
              color: colours.text,
              opacity: 0.8,
            }}
          >
            {deal.postcode}
          </div>
        )}

        {deal.contract_number && (
          <div
            style={{
              marginTop: "3px",
              fontSize: "9px",
              color: colours.text,
              opacity: 0.8,
            }}
          >
            {deal.contract_number}
          </div>
        )}

        {deal.product && (
          <div
            style={{
              marginTop: "4px",
              fontSize: "8px",
              fontWeight: 700,
              color: colours.text,
              opacity: 0.75,
            }}
          >
            {deal.product}
          </div>
        )}

        {job.type === "fit" &&
          (deal.deal_value != null ||
            deal.balance_outstanding !=
              null) && (
            <div
              style={{
                marginTop: "5px",
                fontSize: "9px",
                fontWeight: 700,
                color: colours.text,
              }}
            >
              {money(
                deal.deal_value || 0
              )}

              <span
                style={{
                  color: "#777",
                  fontWeight: 600,
                  margin: "0 3px",
                }}
              >
                |
              </span>

              <span
                style={{
                  color: "#8a4a4a",
                }}
              >
                {money(
                  deal.balance_outstanding ||
                    0
                )}
              </span>
            </div>
          )}
      </button>
    )
  }

  /*
   * ------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------
   */

  return (
    <section>
      {/* HEADER */}

      <div
        className="card"
        style={{
          marginBottom: "18px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            padding: "18px 20px",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <CalendarDays
              size={20}
              color="#172554"
            />

            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "20px",
                  lineHeight: 1.2,
                }}
              >
                FitSheet
              </h1>

              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "11px",
                  color: "#888",
                }}
              >
                {weekTitle}
              </p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            {/* INSTALLATION TYPE FILTER */}

            <select
              value={
                installationTypeFilter
              }
              onChange={(event) =>
                setInstallationTypeFilter(
                  event.target.value
                )
              }
              style={{
                height: "34px",
                padding: "0 10px",
                border:
                  "1px solid #dddfe3",
                borderRadius: "7px",
                background: "#fff",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: 600,
                color: "#333",
              }}
            >
              <option value="all">
                All installation types
              </option>

              <option value="fit">
                Fit
              </option>

              <option value="roofer">
                Roofer
              </option>

              <option value="electrics">
                Electrics
              </option>

              <option value="remedial">
                Remedial
              </option>

              <option value="issue">
                Issue
              </option>
            </select>

            {/* LEGEND */}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                flexWrap: "wrap",
                marginRight: "5px",
              }}
            >
              {Object.entries(
                jobTypes
              ).map(
                ([key, type]) => (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                      fontSize: "9px",
                      color: "#555",
                    }}
                  >
                    <span
                      style={{
                        width: "9px",
                        height: "9px",
                        borderRadius: "2px",
                        background:
                          type.background,
                        border: `1px solid ${type.border}`,
                      }}
                    />

                    {type.label}
                  </div>
                )
              )}
            </div>

            {/* PREVIOUS WEEK */}

            <button
              type="button"
              onClick={() =>
                setWeekOffset(
                  (value) =>
                    value - 1
                )
              }
              style={{
                width: "34px",
                height: "34px",
                border:
                  "1px solid #dddfe3",
                borderRadius: "7px",
                background: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent:
                  "center",
              }}
            >
              <ChevronLeft
                size={16}
              />
            </button>

            {/* THIS WEEK */}

            <button
              type="button"
              onClick={() =>
                setWeekOffset(0)
              }
              style={{
                height: "34px",
                padding: "0 12px",
                border:
                  "1px solid #dddfe3",
                borderRadius: "7px",
                background: "#fff",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: 600,
              }}
            >
              This week
            </button>

            {/* NEXT WEEK */}

            <button
              type="button"
              onClick={() =>
                setWeekOffset(
                  (value) =>
                    value + 1
                )
              }
              style={{
                width: "34px",
                height: "34px",
                border:
                  "1px solid #dddfe3",
                borderRadius: "7px",
                background: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent:
                  "center",
              }}
            >
              <ChevronRight
                size={16}
              />
            </button>
          </div>
        </div>
      </div>

      {/* FIT SHEET */}

      <div
        className="card"
        style={{
          padding: 0,
          overflow: "auto",
          maxHeight:
            "calc(100vh - 220px)",
        }}
      >
        <div
          style={{
            minWidth: "1250px",
          }}
        >
          {/* STICKY HEADER */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "150px 190px repeat(7, minmax(150px, 1fr))",
              borderBottom:
                "2px solid #172554",
              position: "sticky",
              top: 0,
              zIndex: 20,
              background: "#fff",
              boxShadow:
                "0 2px 5px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                padding: "10px 12px",
                background: "#f2f3f5",
                borderRight:
                  "1px solid #d9dadd",
                fontSize: "10px",
                fontWeight: 700,
                color: "#555",
                textTransform:
                  "uppercase",
                position: "sticky",
                left: 0,
                zIndex: 21,
              }}
            >
              Area
            </div>
            <div style={{ padding: "10px 12px", background: "#f2f3f5", borderRight: "1px solid #d9dadd", fontSize: "10px", fontWeight: 700, color: "#555", textTransform: "uppercase", position: "sticky", left: 150, zIndex: 21 }}>
              Fit Team
            </div>

            {weekDays.map(
              (date) => {
                const dateString =
                  formatDate(date)

                const isToday =
                  dateString ===
                  todayString

                return (
                  <div
                    key={dateString}
                    style={{
                      padding:
                        "8px 10px",
                      textAlign:
                        "center",
                      background:
                        isToday
                          ? "#eef2ff"
                          : "#f2f3f5",
                      borderRight:
                        "1px solid #d9dadd",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color:
                          isToday
                            ? "#172554"
                            : "#555",
                        textTransform:
                          "uppercase",
                      }}
                    >
                      {date.toLocaleDateString(
                        "en-GB",
                        {
                          weekday:
                            "short",
                        }
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: "3px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color:
                          isToday
                            ? "#172554"
                            : "#333",
                      }}
                    >
                      {date.getDate()}{" "}
                      {date.toLocaleDateString(
                        "en-GB",
                        {
                          month:
                            "short",
                        }
                      )}
                    </div>
                  </div>
                )
              }
            )}
          </div>

          {loadError && (
            <div
              style={{
                padding: "8px 12px",
                background: "#fff4f4",
                color: "#b42318",
                fontSize: "10px",
                borderBottom:
                  "1px solid #f0b8b8",
              }}
            >
              Unable to load Fit Sheet
              data: {loadError}
            </div>
          )}

          {loading ? (
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
                color: "#999",
                fontSize: "12px",
              }}
            >
              Loading this week's
              fits...
            </div>
          ) : fitTeams.length ===
            0 ? (
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
                color: "#999",
                fontSize: "12px",
              }}
            >
              No jobs found for the selected week/filter.
            </div>
          ) : (
            <>
              <div role="button" tabIndex={0} onClick={() => setWindowTeamsExpanded((value) => !value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setWindowTeamsExpanded((value) => !value) } }} style={{ display: "grid", gridTemplateColumns: "150px 190px repeat(7, minmax(150px, 1fr))", minHeight: "42px", cursor: "pointer", borderBottom: "1px solid #c9d2df", background: "#e8eef5" }}>
                <div style={{ padding: "12px", background: "#dce6f0", borderRight: "1px solid #c4d1df", fontSize: "11px", fontWeight: 800, color: "#172554", letterSpacing: "0.5px", position: "sticky", left: 0, zIndex: 5 }}>WINDOW TEAMS</div>
                <div style={{ gridColumn: "span 8", padding: "12px", fontSize: "10px", fontWeight: 700, color: "#52627a" }}>{fitTeams.length} teams · {windowTeamsExpanded ? "click to collapse" : "click to expand"}</div>
              </div>
              {windowTeamsExpanded && windowGroups.map((group) => (
                <div key={group.label} style={{ display: "grid", gridTemplateColumns: "150px minmax(0, 1fr)", borderBottom: "1px solid #d9dadd" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gridRow: "span " + group.teams.length, minHeight: (group.teams.length * 160) + "px", padding: "12px 4px", borderRight: "2px solid #111", background: "#fff", color: "#111", fontSize: "20px", fontWeight: 500, letterSpacing: "1px", writingMode: "vertical-rl", transform: "rotate(180deg)", textAlign: "center" }}>{group.label}</div>
                  <div>
                    {group.teams.map((team) => (
                      <div key={team} style={{ display: "grid", gridTemplateColumns: "190px repeat(7, minmax(150px, 1fr))", minHeight: "160px", borderBottom: "1px solid #111" }}>
                        <div style={{ padding: "14px 12px", background: "#fff", borderRight: "2px solid #111", fontSize: "11px", fontWeight: 600, color: "#111", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>{team}</div>
                        {weekDays.map((date) => {
                          const dayJobs = getJobs(team, date)
                          return <div key={team + "-" + formatDate(date)} style={{ padding: "6px", borderRight: "1px solid #d9dadd", background: "#fff", minHeight: "160px" }}>{dayJobs.map(renderJobCard)}</div>
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div role="button" tabIndex={0} onClick={() => setWindowsRenewablesExpanded((value) => !value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setWindowsRenewablesExpanded((value) => !value) } }} style={{ display: "grid", gridTemplateColumns: "150px 190px repeat(7, minmax(150px, 1fr))", minHeight: "42px", cursor: "pointer", borderBottom: "1px solid #c9d2df", background: "#e8eef5" }}>
                <div style={{ padding: "12px", background: "#dce6f0", borderRight: "1px solid #c4d1df", fontSize: "11px", fontWeight: 800, color: "#172554", letterSpacing: "0.5px", position: "sticky", left: 0, zIndex: 5 }}>WINDOW REMEDIALS</div>
                <div style={{ gridColumn: "span 8", padding: "12px", fontSize: "10px", fontWeight: 700, color: "#52627a" }}>{renewablesTeams.length} teams · {windowsRenewablesExpanded ? "click to collapse" : "click to expand"}</div>
              </div>
              {windowsRenewablesExpanded && (
                <div style={{ display: "grid", gridTemplateColumns: "150px minmax(0, 1fr)", borderBottom: "1px solid #d9dadd" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gridRow: "span " + renewablesTeams.length, minHeight: (renewablesTeams.length * 160) + "px", padding: "12px 4px", borderRight: "2px solid #111", background: "#fff", color: "#111", fontSize: "20px", fontWeight: 500, letterSpacing: "1px", writingMode: "vertical-rl", transform: "rotate(180deg)", textAlign: "center" }}>WINDOW REMEDIALS</div>
                  <div>
                    {renewablesTeams.map((team) => (
                      <div key={team} style={{ display: "grid", gridTemplateColumns: "190px repeat(7, minmax(150px, 1fr))", minHeight: "160px", borderBottom: "1px solid #111" }}>
                        <div style={{ padding: "14px 12px", background: "#fff", borderRight: "2px solid #111", fontSize: "11px", fontWeight: 600, color: "#111", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>{team}</div>
                        {weekDays.map((date) => {
                          const dayJobs = getJobs(team, date)
                          return <div key={team + "-" + formatDate(date)} style={{ padding: "6px", borderRight: "1px solid #d9dadd", background: "#fff", minHeight: "160px" }}>{dayJobs.map(renderJobCard)}</div>
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div role="button" tabIndex={0} onClick={() => setHeatPumpExpanded((value) => !value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setHeatPumpExpanded((value) => !value) } }} style={{ display: "grid", gridTemplateColumns: "150px 190px repeat(7, minmax(150px, 1fr))", minHeight: "42px", cursor: "pointer", borderBottom: "1px solid #c9d2df", background: "#e8eef5" }}>
                <div style={{ padding: "12px", background: "#dce6f0", borderRight: "1px solid #c4d1df", fontSize: "11px", fontWeight: 800, color: "#172554", letterSpacing: "0.5px", position: "sticky", left: 0, zIndex: 5 }}>HEAT PUMP</div>
                <div style={{ gridColumn: "span 8", padding: "12px", fontSize: "10px", fontWeight: 700, color: "#52627a" }}>{heatPumpTeams.length} fitters · {heatPumpExpanded ? "click to collapse" : "click to expand"}</div>
              </div>
              {heatPumpExpanded && (
                <div style={{ display: "grid", gridTemplateColumns: "150px minmax(0, 1fr)", borderBottom: "1px solid #d9dadd" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gridRow: "span " + heatPumpTeams.length, minHeight: (heatPumpTeams.length * 160) + "px", padding: "12px 4px", borderRight: "2px solid #111", background: "#f2f2f2", color: "#111", fontSize: "20px", fontWeight: 500, letterSpacing: "1px", writingMode: "vertical-rl", transform: "rotate(180deg)", textAlign: "center" }}>HEAT PUMP</div>
                  <div>
                    {heatPumpTeams.map((team) => (
                      <div key={team} style={{ display: "grid", gridTemplateColumns: "190px repeat(7, minmax(150px, 1fr))", minHeight: "160px", borderBottom: "1px solid #111" }}>
                        <div style={{ padding: "14px 12px", background: "#f2f2f2", borderRight: "2px solid #111", fontSize: "11px", fontWeight: 600, color: "#111", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>{team}</div>
                        {weekDays.map((date) => {
                          const dayJobs = getJobs(team, date)
                          return <div key={team + "-" + formatDate(date)} style={{ padding: "6px", borderRight: "1px solid #d9dadd", background: "#fff", minHeight: "160px" }}>{dayJobs.map(renderJobCard)}</div>
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div role="button" tabIndex={0} onClick={() => setRoofExpanded((value) => !value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setRoofExpanded((value) => !value) } }} style={{ display: "grid", gridTemplateColumns: "150px 190px repeat(7, minmax(150px, 1fr))", minHeight: "42px", cursor: "pointer", borderBottom: "1px solid #c9d2df", background: "#e8eef5" }}>
                <div style={{ padding: "12px", background: "#dce6f0", borderRight: "1px solid #c4d1df", fontSize: "11px", fontWeight: 800, color: "#172554", letterSpacing: "0.5px", position: "sticky", left: 0, zIndex: 5 }}>ROOF</div>
                <div style={{ gridColumn: "span 8", padding: "12px", fontSize: "10px", fontWeight: 700, color: "#52627a" }}>{roofTeams.length} fitters · {roofExpanded ? "click to collapse" : "click to expand"}</div>
              </div>
              {roofExpanded && (
                <div style={{ display: "grid", gridTemplateColumns: "150px minmax(0, 1fr)", borderBottom: "1px solid #d9dadd" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gridRow: "span " + roofTeams.length, minHeight: (roofTeams.length * 160) + "px", padding: "12px 4px", borderRight: "2px solid #111", background: "#f2f2f2", color: "#111", fontSize: "20px", fontWeight: 500, letterSpacing: "1px", writingMode: "vertical-rl", transform: "rotate(180deg)", textAlign: "center" }}>ROOF</div>
                  <div>
                    {roofTeams.map((team) => (
                      <div key={team} style={{ display: "grid", gridTemplateColumns: "190px repeat(7, minmax(150px, 1fr))", minHeight: "160px", borderBottom: "1px solid #111" }}>
                        <div style={{ padding: "14px 12px", background: "#f2f2f2", borderRight: "2px solid #111", fontSize: "11px", fontWeight: 600, color: "#111", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>{team}</div>
                        {weekDays.map((date) => {
                          const dayJobs = getJobs(team, date)
                          return <div key={team + "-" + formatDate(date)} style={{ padding: "6px", borderRight: "1px solid #d9dadd", background: "#fff", minHeight: "160px" }}>{dayJobs.map(renderJobCard)}</div>
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div role="button" tabIndex={0} onClick={() => setElectricsExpanded((value) => !value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setElectricsExpanded((value) => !value) } }} style={{ display: "grid", gridTemplateColumns: "150px 190px repeat(7, minmax(150px, 1fr))", minHeight: "42px", cursor: "pointer", borderBottom: "1px solid #c9d2df", background: "#e8eef5" }}>
                <div style={{ padding: "12px", background: "#dce6f0", borderRight: "1px solid #c4d1df", fontSize: "11px", fontWeight: 800, color: "#172554", letterSpacing: "0.5px", position: "sticky", left: 0, zIndex: 5 }}>ELECTRICS</div>
                <div style={{ gridColumn: "span 8", padding: "12px", fontSize: "10px", fontWeight: 700, color: "#52627a" }}>{electricsTeams.length} fitters · {electricsExpanded ? "click to collapse" : "click to expand"}</div>
              </div>
              {electricsExpanded && (
                <div style={{ display: "grid", gridTemplateColumns: "150px minmax(0, 1fr)", borderBottom: "1px solid #d9dadd" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gridRow: "span " + electricsTeams.length, minHeight: (electricsTeams.length * 160) + "px", padding: "12px 4px", borderRight: "2px solid #111", background: "#f2f2f2", color: "#111", fontSize: "20px", fontWeight: 500, letterSpacing: "1px", writingMode: "vertical-rl", transform: "rotate(180deg)", textAlign: "center" }}>ELECTRICS</div>
                  <div>
                    {electricsTeams.map((team) => (
                      <div key={team} style={{ display: "grid", gridTemplateColumns: "190px repeat(7, minmax(150px, 1fr))", minHeight: "160px", borderBottom: "1px solid #111" }}>
                        <div style={{ padding: "14px 12px", background: "#f2f2f2", borderRight: "2px solid #111", fontSize: "11px", fontWeight: 600, color: "#111", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>{team}</div>
                        {weekDays.map((date) => {
                          const dayJobs = getJobs(team, date)
                          return <div key={team + "-" + formatDate(date)} style={{ padding: "6px", borderRight: "1px solid #d9dadd", background: "#fff", minHeight: "160px" }}>{dayJobs.map(renderJobCard)}</div>
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div role="button" tabIndex={0} onClick={() => setRenewableRemedialsExpanded((value) => !value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setRenewableRemedialsExpanded((value) => !value) } }} style={{ display: "grid", gridTemplateColumns: "150px 190px repeat(7, minmax(150px, 1fr))", minHeight: "42px", cursor: "pointer", borderBottom: "1px solid #c9d2df", background: "#e8eef5" }}>
                <div style={{ padding: "12px", background: "#dce6f0", borderRight: "1px solid #c4d1df", fontSize: "11px", fontWeight: 800, color: "#172554", letterSpacing: "0.5px", position: "sticky", left: 0, zIndex: 5 }}>RENEWABLE REMEDIALS</div>
                <div style={{ gridColumn: "span 8", padding: "12px", fontSize: "10px", fontWeight: 700, color: "#52627a" }}>{renewableRemedialsTeams.length} fitters · {renewableRemedialsExpanded ? "click to collapse" : "click to expand"}</div>
              </div>
              {renewableRemedialsExpanded && (
                <div style={{ display: "grid", gridTemplateColumns: "150px minmax(0, 1fr)", borderBottom: "1px solid #d9dadd" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gridRow: "span " + renewableRemedialsTeams.length, minHeight: (renewableRemedialsTeams.length * 160) + "px", padding: "12px 4px", borderRight: "2px solid #111", background: "#f2f2f2", color: "#111", fontSize: "20px", fontWeight: 500, letterSpacing: "1px", writingMode: "vertical-rl", transform: "rotate(180deg)", textAlign: "center" }}>RENEWABLE REMEDIALS</div>
                  <div>
                    {renewableRemedialsTeams.map((team) => (
                      <div key={team} style={{ display: "grid", gridTemplateColumns: "190px repeat(7, minmax(150px, 1fr))", minHeight: "160px", borderBottom: "1px solid #111" }}>
                        <div style={{ padding: "14px 12px", background: "#f2f2f2", borderRight: "2px solid #111", fontSize: "11px", fontWeight: 600, color: "#111", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>{team}</div>
                        {weekDays.map((date) => {
                          const dayJobs = getJobs(team, date)
                          return <div key={team + "-" + formatDate(date)} style={{ padding: "6px", borderRight: "1px solid #d9dadd", background: "#fff", minHeight: "160px" }}>{dayJobs.map(renderJobCard)}</div>
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

export default FitSheet

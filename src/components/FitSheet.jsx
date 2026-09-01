import React, { useMemo, useState } from "react"

import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react"

import { money } from "../utils/formatters"

function FitSheet({
  contracts = [],
  onSelectDeal,
}) {
  const [weekOffset, setWeekOffset] =
    useState(0)

  /*
   * =========================================================
   * GET MONDAY FOR A DATE
   * =========================================================
   */

  function getMonday(date) {
    const d = new Date(date)

    const day = d.getDay()

    const difference =
      day === 0
        ? -6
        : 1 - day

    d.setDate(
      d.getDate() + difference
    )

    d.setHours(0, 0, 0, 0)

    return d
  }

  /*
   * =========================================================
   * CURRENT WEEK
   * =========================================================
   */

  const currentWeek = useMemo(() => {
    const monday =
      getMonday(new Date())

    monday.setDate(
      monday.getDate() +
        weekOffset * 7
    )

    return monday
  }, [weekOffset])

  /*
   * =========================================================
   * BUILD THE 7 DAYS
   * =========================================================
   */

  const weekDays = useMemo(() => {
    return Array.from(
      { length: 7 },
      (_, index) => {
        const date =
          new Date(currentWeek)

        date.setDate(
          currentWeek.getDate() +
            index
        )

        return date
      }
    )
  }, [currentWeek])

  /*
   * =========================================================
   * FORMAT DATE AS YYYY-MM-DD
   * =========================================================
   */

  function formatDate(date) {
    const year =
      date.getFullYear()

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, "0")

    const day =
      String(
        date.getDate()
      ).padStart(2, "0")

    return `${year}-${month}-${day}`
  }

  /*
   * =========================================================
   * WEEK TITLE
   * =========================================================
   */

  const weekTitle = useMemo(() => {
    const start =
      weekDays[0]

    const end =
      weekDays[6]

    const startText =
      start.toLocaleDateString(
        "en-GB",
        {
          day: "numeric",
          month: "short",
        }
      )

    const endText =
      end.toLocaleDateString(
        "en-GB",
        {
          day: "numeric",
          month: "short",
        }
      )

    return `${startText} – ${endText}`
  }, [weekDays])

  /*
   * =========================================================
   * FIND ALL FIT TEAMS
   * =========================================================
   */

  const fitTeams = useMemo(() => {
    const teams = contracts
      .map(
        (contract) =>
          contract.fit_team_1
      )
      .filter(Boolean)
      .map((team) =>
        String(team).trim()
      )
      .filter(Boolean)

    return [
      ...new Set(teams),
    ].sort((a, b) =>
      a.localeCompare(b)
    )
  }, [contracts])

  /*
   * =========================================================
   * ONLY DEALS FOR THE CURRENT WEEK
   * =========================================================
   */

  const weekDeals = useMemo(() => {
    const start =
      formatDate(weekDays[0])

    const end =
      formatDate(weekDays[6])

    return contracts.filter(
      (contract) => {
        if (
          !contract.installation_start_date
        ) {
          return false
        }

        const installationDate =
          String(
            contract.installation_start_date
          ).slice(0, 10)

        return (
          installationDate >=
            start &&
          installationDate <=
            end
        )
      }
    )
  }, [contracts, weekDays])

  /*
   * =========================================================
   * GET DEALS FOR A TEAM AND DAY
   * =========================================================
   */

  function getDeals(
    team,
    date
  ) {
    const dateString =
      formatDate(date)

    return weekDeals.filter(
      (deal) => {
        const dealDate =
          String(
            deal.installation_start_date
          ).slice(0, 10)

        const dealTeam =
          String(
            deal.fit_team_1 || ""
          ).trim()

        return (
          dealDate ===
            dateString &&
          dealTeam === team
        )
      }
    )
  }

  /*
   * =========================================================
   * TODAY
   * =========================================================
   */

  const todayString =
    formatDate(new Date())

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <section>

      {/* =====================================================
          PAGE HEADER
          ===================================================== */}

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
            padding:
              "18px 20px",
          }}
        >

          {/* TITLE */}

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
                  margin:
                    "4px 0 0",
                  fontSize: "11px",
                  color: "#888",
                }}
              >
                {weekTitle}
              </p>

            </div>

          </div>


          {/* WEEK NAVIGATION */}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >

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
                borderRadius:
                  "7px",
                background:
                  "#fff",
                cursor:
                  "pointer",
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
              }}
            >
              <ChevronLeft
                size={16}
              />
            </button>


            <button
              type="button"
              onClick={() =>
                setWeekOffset(0)
              }
              style={{
                height: "34px",
                padding:
                  "0 12px",
                border:
                  "1px solid #dddfe3",
                borderRadius:
                  "7px",
                background:
                  "#fff",
                cursor:
                  "pointer",
                fontSize: "11px",
                fontWeight: 600,
              }}
            >
              This week
            </button>


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
                borderRadius:
                  "7px",
                background:
                  "#fff",
                cursor:
                  "pointer",
                display: "flex",
                alignItems:
                  "center",
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


      {/* =====================================================
          FIT SHEET
          ===================================================== */}

      <div
        className="card"
        style={{
          padding: 0,
          overflow: "auto",
        }}
      >

        <div
          style={{
            minWidth:
              "1250px",
          }}
        >

          {/* =================================================
              COLUMN HEADERS
              ================================================= */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "190px repeat(7, minmax(150px, 1fr))",
              borderBottom:
                "2px solid #172554",
              position:
                "sticky",
              top: 0,
              zIndex: 10,
              background:
                "#fff",
            }}
          >

            {/* FIT TEAM HEADER */}

            <div
              style={{
                padding:
                  "10px 12px",
                background:
                  "#f2f3f5",
                borderRight:
                  "1px solid #d9dadd",
                fontSize: "10px",
                fontWeight: 700,
                color: "#555",
                textTransform:
                  "uppercase",
              }}
            >
              Fit Team
            </div>


            {/* DAYS */}

            {weekDays.map(
              (date) => {
                const dateString =
                  formatDate(date)

                const isToday =
                  dateString ===
                  todayString

                return (
                  <div
                    key={
                      dateString
                    }
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
                        fontSize:
                          "10px",
                        fontWeight:
                          700,
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
                        marginTop:
                          "3px",
                        fontSize:
                          "12px",
                        fontWeight:
                          600,
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


          {/* =================================================
              FIT TEAM ROWS
              ================================================= */}

          {fitTeams.length ===
          0 ? (

            <div
              style={{
                padding:
                  "60px 20px",
                textAlign:
                  "center",
                color: "#999",
                fontSize: "12px",
              }}
            >
              No fit teams found in
              the database.
            </div>

          ) : (

            fitTeams.map(
              (team) => (

                <div
                  key={team}
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "190px repeat(7, minmax(150px, 1fr))",
                    minHeight:
                      "160px",
                    borderBottom:
                      "1px solid #d9dadd",
                  }}
                >

                  {/* =================================================
                      TEAM
                      ================================================= */}

                  <div
                    style={{
                      padding:
                        "14px 12px",
                      background:
                        "#f7f7f8",
                      borderRight:
                        "1px solid #d9dadd",
                      fontSize:
                        "11px",
                      fontWeight:
                        600,
                      color:
                        "#333",
                      display:
                        "flex",
                      alignItems:
                        "center",
                    }}
                  >
                    {team}
                  </div>


                  {/* =================================================
                      DAYS
                      ================================================= */}

                  {weekDays.map(
                    (date) => {

                      const deals =
                        getDeals(
                          team,
                          date
                        )

                      return (
                        <div
                          key={`${team}-${formatDate(
                            date
                          )}`}
                          style={{
                            padding:
                              "6px",
                            borderRight:
                              "1px solid #d9dadd",
                            background:
                              "#fff",
                            minHeight:
                              "160px",
                          }}
                        >

                          {deals.map(
                            (deal) => (

                              <button
                                key={
                                  deal.id
                                }
                                type="button"
                                onClick={() =>
                                  onSelectDeal?.(
                                    deal
                                  )
                                }
                                style={{
                                  width:
                                    "100%",
                                  textAlign:
                                    "left",
                                  border:
                                    "1px solid #cbd8c5",
                                  borderRadius:
                                    "5px",
                                  background:
                                    "#e8f4e2",
                                  padding:
                                    "8px",
                                  marginBottom:
                                    "5px",
                                  cursor:
                                    onSelectDeal
                                      ? "pointer"
                                      : "default",
                                  fontFamily:
                                    "inherit",
                                  transition:
                                    "box-shadow 0.15s ease",
                                }}
                                onMouseEnter={(
                                  e
                                ) => {
                                  e.currentTarget.style.boxShadow =
                                    "0 2px 7px rgba(0,0,0,0.10)"
                                }}
                                onMouseLeave={(
                                  e
                                ) => {
                                  e.currentTarget.style.boxShadow =
                                    "none"
                                }}
                              >

                                {/* CUSTOMER */}

                                <div
                                  style={{
                                    fontSize:
                                      "10px",
                                    fontWeight:
                                      700,
                                    color:
                                      "#263522",
                                    lineHeight:
                                      "1.3",
                                  }}
                                >
                                  {deal.customer_name ||
                                    "Unnamed customer"}
                                </div>


                                {/* POSTCODE */}

                                {deal.postcode && (
                                  <div
                                    style={{
                                      marginTop:
                                        "3px",
                                      fontSize:
                                        "9px",
                                      color:
                                        "#596455",
                                    }}
                                  >
                                    {
                                      deal.postcode
                                    }
                                  </div>
                                )}


                                {/* CONTRACT */}

                                {deal.contract_number && (
                                  <div
                                    style={{
                                      marginTop:
                                        "3px",
                                      fontSize:
                                        "9px",
                                      color:
                                        "#596455",
                                    }}
                                  >
                                    {
                                      deal.contract_number
                                    }
                                  </div>
                                )}


                                {/* VALUE */}

                                {deal.deal_value !=
                                  null && (
                                  <div
                                    style={{
                                      marginTop:
                                        "5px",
                                      fontSize:
                                        "9px",
                                      fontWeight:
                                        700,
                                      color:
                                        "#263522",
                                    }}
                                  >
                                    {money(
                                      deal.deal_value
                                    )}
                                  </div>
                                )}

                              </button>

                            )
                          )}

                        </div>
                      )
                    }
                  )}

                </div>

              )
            )

          )}

        </div>

      </div>

    </section>
  )
}

export default FitSheet
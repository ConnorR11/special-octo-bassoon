import React, {
  useEffect,
  useState,
} from "react"

import {
  Search,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import { supabase } from "../lib/supabase"


function Appointments({
  onSelectAppointment,
}) {

  const [appointments, setAppointments] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState("")

  const [query, setQuery] =
    useState("")

  const [page, setPage] =
    useState(0)

  const [total, setTotal] =
    useState(0)

  const pageSize = 50


  /*
   * =========================================================
   * LOAD APPOINTMENTS
   * =========================================================
   *
   * IMPORTANT:
   *
   * We are NOT loading all 50,000 records.
   *
   * Supabase only returns 50 appointments at a time.
   *
   * This keeps the React app fast.
   *
   * =========================================================
   */

  async function loadAppointments() {

    setLoading(true)
    setError("")

    if (!supabase) {

      setError(
        "Supabase is not configured. Check your environment variables."
      )

      setLoading(false)

      return
    }


    try {

      const from =
        page * pageSize

      const to =
        from + pageSize - 1


      let request =
        supabase
          .from("appointments")
          .select("*", {
            count: "exact",
          })
          .order(
            "appointment_date",
            {
              ascending: false,
              nullsFirst: false,
            }
          )
          .range(
            from,
            to
          )


      /*
       * =====================================================
       * SEARCH
       * =====================================================
       */

      const search =
        query.trim()


      if (search) {

        /*
         * Search across the main
         * appointment/customer fields.
         */

        request =
          request.or(
            [
              `customer_name.ilike.%${search}%`,
              `postcode.ilike.%${search}%`,
              `salesperson.ilike.%${search}%`,
              `phone.ilike.%${search}%`,
              `email.ilike.%${search}%`,
            ].join(",")
          )
      }


      const {
        data,
        error:
          supabaseError,
        count,
      } =
        await request


      if (supabaseError) {
        throw supabaseError
      }


      setAppointments(
        data || []
      )

      setTotal(
        count || 0
      )


    } catch (err) {

      console.error(
        "Error loading appointments:",
        err
      )

      setError(
        err?.message ||
          "Unable to load appointments."
      )

      setAppointments([])

      setTotal(0)


    } finally {

      setLoading(false)

    }
  }


  /*
   * =========================================================
   * LOAD WHEN PAGE OR SEARCH CHANGES
   * =========================================================
   */

  useEffect(() => {

    loadAppointments()

  }, [
    page,
    query,
  ])


  /*
   * =========================================================
   * SEARCH
   * =========================================================
   */

  function handleSearch(
    value
  ) {

    /*
     * Always return to page 1
     * when a new search is made.
     */

    setPage(0)

    setQuery(value)

  }


  /*
   * =========================================================
   * PAGINATION
   * =========================================================
   */

  const totalPages =
    Math.ceil(
      total /
        pageSize
    )


  const canGoBack =
    page > 0


  const canGoForward =
    page <
    totalPages - 1


  /*
   * =========================================================
   * FORMAT DATE
   * =========================================================
   */

  function formatDate(
    value
  ) {

    if (!value) {
      return "—"
    }


    const date =
      new Date(value)


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value
    }


    return date.toLocaleString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    )
  }


  /*
   * =========================================================
   * RESULT
   * =========================================================
   */

  function getResult(
    appointment
  ) {

    return (
      appointment.result ||
      appointment.status ||
      "—"
    )
  }


  /*
   * =========================================================
   * RESULT BADGE STYLE
   * =========================================================
   */

  function getResultStyle(
    appointment
  ) {

    const result =
      String(
        getResult(
          appointment
        )
      )
        .toLowerCase()
        .trim()


    if (
      result === "sold" ||
      result === "sale"
    ) {

      return {
        background:
          "#e8f4e2",
        color:
          "#2d5724",
      }

    }


    if (
      result === "cancelled" ||
      result === "cancelled"
    ) {

      return {
        background:
          "#fbe9e9",
        color:
          "#8b2e2e",
      }

    }


    if (
      result === "no sale" ||
      result === "not sold"
    ) {

      return {
        background:
          "#f4eeee",
        color:
          "#7b4a4a",
      }

    }


    return {
      background:
        "#f2f3f5",
      color:
        "#555",
    }
  }


  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <section>


      {/* =====================================================
          HEADER
          ===================================================== */}

      <div
        style={{
          display:
            "flex",
          alignItems:
            "center",
          justifyContent:
            "space-between",
          marginBottom:
            "18px",
        }}
      >

        <div>

          <h1
            style={{
              margin: 0,
              fontSize:
                "22px",
              color:
                "#222",
            }}
          >
            Appointments
          </h1>


          <p
            style={{
              margin:
                "5px 0 0",
              fontSize:
                "11px",
              color:
                "#888",
            }}
          >
            {total.toLocaleString()}{" "}
            appointments
          </p>

        </div>

      </div>


      {/* =====================================================
          SEARCH
          ===================================================== */}

      <div
        className="card"
        style={{
          marginBottom:
            "18px",
          padding:
            "12px 14px",
        }}
      >

        <div
          style={{
            position:
              "relative",
          }}
        >

          <Search
            size={15}
            style={{
              position:
                "absolute",
              left:
                "11px",
              top:
                "50%",
              transform:
                "translateY(-50%)",
              color:
                "#999",
            }}
          />


          <input
            type="text"
            value={
              query
            }
            onChange={(
              e
            ) =>
              handleSearch(
                e.target.value
              )
            }
            placeholder="Search customer, postcode, phone, email or salesperson..."
            style={{
              width:
                "100%",
              boxSizing:
                "border-box",
              height:
                "38px",
              padding:
                "0 12px 0 34px",
              border:
                "1px solid #d9dadd",
              borderRadius:
                "7px",
              outline:
                "none",
              fontFamily:
                "inherit",
              fontSize:
                "12px",
            }}
          />

        </div>

      </div>


      {/* =====================================================
          ERROR
          ===================================================== */}

      {error && (

        <div
          className="error"
          style={{
            marginBottom:
              "18px",
          }}
        >

          <b>
            Database error
          </b>

          <span>
            {error}
          </span>

        </div>

      )}


      {/* =====================================================
          TABLE
          ===================================================== */}

      <div
        className="card"
        style={{
          padding: 0,
          overflow:
            "hidden",
        }}
      >


        {/* ===================================================
            TABLE HEADER
            =================================================== */}

        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "1.7fr 1.4fr 1fr 1fr 1fr 100px",
            padding:
              "11px 16px",
            background:
              "#f7f7f8",
            borderBottom:
              "1px solid #dddfe3",
            fontSize:
              "9px",
            fontWeight:
              700,
            color:
              "#777",
            textTransform:
              "uppercase",
            letterSpacing:
              "0.04em",
          }}
        >

          <div>
            Customer
          </div>

          <div>
            Appointment
          </div>

          <div>
            Postcode
          </div>

          <div>
            Type
          </div>

          <div>
            Salesperson
          </div>

          <div>
            Result
          </div>

        </div>


        {/* ===================================================
            LOADING
            =================================================== */}

        {loading ? (

          <div
            style={{
              padding:
                "60px 20px",
              textAlign:
                "center",
              color:
                "#999",
              fontSize:
                "12px",
            }}
          >

            Loading appointments...

          </div>


        ) : appointments.length === 0 ? (

          <div
            style={{
              padding:
                "60px 20px",
              textAlign:
                "center",
              color:
                "#999",
              fontSize:
                "12px",
            }}
          >

            <CalendarDays
              size={28}
              style={{
                marginBottom:
                  "8px",
              }}
            />

            <div>
              No appointments found.
            </div>

          </div>


        ) : (

          /*
           * =================================================
           * APPOINTMENT ROWS
           * =================================================
           */

          appointments.map(
            (
              appointment
            ) => (

              <button
                key={
                  appointment.id
                }
                type="button"
                onClick={() =>
                  onSelectAppointment?.(
                    appointment
                  )
                }
                style={{
                  width:
                    "100%",
                  display:
                    "grid",
                  gridTemplateColumns:
                    "1.7fr 1.4fr 1fr 1fr 1fr 100px",
                  padding:
                    "13px 16px",
                  border:
                    0,
                  borderBottom:
                    "1px solid #eeeeef",
                  background:
                    "#fff",
                  textAlign:
                    "left",
                  cursor:
                    onSelectAppointment
                      ? "pointer"
                      : "default",
                  fontFamily:
                    "inherit",
                  transition:
                    "background 0.12s ease",
                }}
                onMouseEnter={(
                  e
                ) => {

                  e.currentTarget.style.background =
                    "#fafbfc"

                }}
                onMouseLeave={(
                  e
                ) => {

                  e.currentTarget.style.background =
                    "#fff"

                }}
              >


                {/* =========================================
                    CUSTOMER
                    ========================================= */}

                <div
                  style={{
                    minWidth:
                      0,
                  }}
                >

                  <div
                    style={{
                      fontSize:
                        "11px",
                      fontWeight:
                        600,
                      color:
                        "#222",
                      whiteSpace:
                        "nowrap",
                      overflow:
                        "hidden",
                      textOverflow:
                        "ellipsis",
                    }}
                  >

                    {appointment.customer_name ||
                      "Unnamed customer"}

                  </div>


                  {appointment.phone && (

                    <div
                      style={{
                        marginTop:
                          "3px",
                        fontSize:
                          "9px",
                        color:
                          "#888",
                      }}
                    >

                      {
                        appointment.phone
                      }

                    </div>

                  )}

                </div>


                {/* =========================================
                    APPOINTMENT DATE
                    ========================================= */}

                <div
                  style={{
                    fontSize:
                      "10px",
                    color:
                      "#444",
                  }}
                >

                  {formatDate(
                    appointment.appointment_date
                  )}

                </div>


                {/* =========================================
                    POSTCODE
                    ========================================= */}

                <div
                  style={{
                    fontSize:
                      "10px",
                    color:
                      "#555",
                  }}
                >

                  {appointment.postcode ||
                    "—"}

                </div>


                {/* =========================================
                    TYPE
                    ========================================= */}

                <div
                  style={{
                    fontSize:
                      "10px",
                    color:
                      "#555",
                  }}
                >

                  {
                    appointment.product ||
                    appointment.type ||
                    appointment.appointment_type ||
                    "—"
                  }

                </div>


                {/* =========================================
                    SALESPERSON
                    ========================================= */}

                <div
                  style={{
                    fontSize:
                      "10px",
                    color:
                      "#555",
                  }}
                >

                  {appointment.salesperson ||
                    "—"}

                </div>


                {/* =========================================
                    RESULT
                    ========================================= */}

                <div>

                  <span
                    style={{
                      display:
                        "inline-block",
                      padding:
                        "4px 7px",
                      borderRadius:
                        "5px",
                      fontSize:
                        "9px",
                      fontWeight:
                        600,
                      ...getResultStyle(
                        appointment
                      ),
                    }}
                  >

                    {getResult(
                      appointment
                    )}

                  </span>

                </div>


              </button>

            )
          )

        )}

      </div>


      {/* =====================================================
          PAGINATION
          ===================================================== */}

      {totalPages > 1 && (

        <div
          style={{
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "space-between",
            marginTop:
              "14px",
          }}
        >


          {/* ===============================================
              RESULTS COUNT
              =============================================== */}

          <div
            style={{
              fontSize:
                "10px",
              color:
                "#888",
            }}
          >

            Showing{" "}

            {page *
              pageSize +
              1}

            {" – "}

            {Math.min(
              (page + 1) *
                pageSize,
              total
            )}

            {" of "}

            {total.toLocaleString()}

          </div>


          {/* ===============================================
              PAGINATION CONTROLS
              =============================================== */}

          <div
            style={{
              display:
                "flex",
              gap:
                "6px",
            }}
          >


            {/* PREVIOUS */}

            <button
              type="button"
              disabled={
                !canGoBack
              }
              onClick={() =>
                setPage(
                  (
                    value
                  ) =>
                    value - 1
                )
              }
              style={{
                width:
                  "34px",
                height:
                  "32px",
                border:
                  "1px solid #dddfe3",
                borderRadius:
                  "7px",
                background:
                  "#fff",
                cursor:
                  canGoBack
                    ? "pointer"
                    : "default",
                opacity:
                  canGoBack
                    ? 1
                    : 0.4,
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
              }}
            >

              <ChevronLeft
                size={15}
              />

            </button>


            {/* PAGE NUMBER */}

            <div
              style={{
                minWidth:
                  "70px",
                height:
                  "32px",
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                fontSize:
                  "10px",
                color:
                  "#555",
              }}
            >

              Page{" "}
              {page + 1}{" "}
              of{" "}
              {totalPages}

            </div>


            {/* NEXT */}

            <button
              type="button"
              disabled={
                !canGoForward
              }
              onClick={() =>
                setPage(
                  (
                    value
                  ) =>
                    value + 1
                )
              }
              style={{
                width:
                  "34px",
                height:
                  "32px",
                border:
                  "1px solid #dddfe3",
                borderRadius:
                  "7px",
                background:
                  "#fff",
                cursor:
                  canGoForward
                    ? "pointer"
                    : "default",
                opacity:
                  canGoForward
                    ? 1
                    : 0.4,
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
              }}
            >

              <ChevronRight
                size={15}
              />

            </button>

          </div>

        </div>

      )}

    </section>
  )
}


export default Appointments
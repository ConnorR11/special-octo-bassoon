import React, { useState } from "react"

import {
  ArrowLeft,
  Pencil,
  Plus,
  Phone,
  Mail,
  MapPin,
  CalendarDays,
  UserRound,
  Check,
  X,
} from "lucide-react"

import { supabase } from "../lib/supabase"
import EPVSCalculator from "../EPVSCalculator"

import jsPDF from "jspdf"

function AppointmentDetail({
  appointment,
  onBack,
  onUpdated,
}) {
  const [showResult, setShowResult] =
    useState(false)

  const [result, setResult] =
    useState(
      appointment?.result ||
        appointment?.status ||
        ""
    )

  const [saving, setSaving] =
    useState(false)

  const [error, setError] =
    useState("")

  /*
   * =========================================================
   * EPVS CALCULATION
   * =========================================================
   *
   * The calculator continuously sends its current data and
   * results back here.
   */

  const [
    epvsCalculation,
    setEpvsCalculation,
  ] = useState(null)

  /*
   * =========================================================
   * SOLAR CHECK
   * =========================================================
   */

  const isSolar =
    String(
      appointment?.job_type || ""
    )
      .toLowerCase()
      .trim() === "solar"

  /*
   * =========================================================
   * DATE
   * =========================================================
   */

  function formatDate(value) {
    if (!value) {
      return "—"
    }

    const date = new Date(value)

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
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    )
  }

  /*
   * =========================================================
   * PDF
   * =========================================================
   */

  function generateSoldPdf() {
    if (!appointment) {
      return
    }

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const pageWidth =
      pdf.internal.pageSize.getWidth()

    let y = 20

    /*
     * ---------------------------------------------------------
     * HEADER
     * ---------------------------------------------------------
     */

    pdf.setFillColor(
      0,
      45,
      73
    )

    pdf.rect(
      0,
      0,
      pageWidth,
      32,
      "F"
    )

    pdf.setTextColor(
      255,
      255,
      255
    )

    pdf.setFontSize(20)

    pdf.setFont(
      "helvetica",
      "bold"
    )

    pdf.text(
      "HomeShield",
      20,
      14
    )

    pdf.setFontSize(10)

    pdf.setFont(
      "helvetica",
      "normal"
    )

    pdf.text(
      "Solar PV & EPVS Calculation",
      20,
      22
    )

    pdf.setFontSize(9)

    pdf.text(
      "SOLD",
      pageWidth - 20,
      18,
      {
        align: "right",
      }
    )

    pdf.setTextColor(
      0,
      0,
      0
    )

    y = 45

    /*
     * ---------------------------------------------------------
     * CUSTOMER
     * ---------------------------------------------------------
     */

    pdf.setFontSize(14)

    pdf.setFont(
      "helvetica",
      "bold"
    )

    pdf.text(
      "Customer",
      20,
      y
    )

    y += 8

    pdf.setFontSize(10)

    pdf.setFont(
      "helvetica",
      "normal"
    )

    const customerRows = [
      [
        "Name",
        appointment.name ||
          epvsCalculation?.data
            ?.customerName ||
          "—",
      ],

      [
        "Address",
        appointment.address ||
          epvsCalculation?.data
            ?.address ||
          "—",
      ],

      [
        "Postcode",
        appointment.postcode ||
          epvsCalculation?.data
            ?.postcode ||
          "—",
      ],

      [
        "Phone",
        appointment.phone ||
          "—",
      ],

      [
        "Email",
        appointment.email ||
          "—",
      ],
    ]

    customerRows.forEach(
      ([label, value]) => {
        pdf.setFont(
          "helvetica",
          "bold"
        )

        pdf.text(
          `${label}:`,
          20,
          y
        )

        pdf.setFont(
          "helvetica",
          "normal"
        )

        pdf.text(
          String(value),
          55,
          y
        )

        y += 6
      }
    )

    y += 6

    /*
     * ---------------------------------------------------------
     * APPOINTMENT
     * ---------------------------------------------------------
     */

    pdf.setFont(
      "helvetica",
      "bold"
    )

    pdf.setFontSize(14)

    pdf.text(
      "Appointment",
      20,
      y
    )

    y += 8

    pdf.setFontSize(10)

    const appointmentRows = [
      [
        "Date",
        formatDate(
          appointment.appointment_date
        ),
      ],

      [
        "Job type",
        appointment.job_type ||
          "—",
      ],

      [
        "Salesperson",
        appointment.salesperson ||
          "—",
      ],

      [
        "Result",
        "Sold",
      ],
    ]

    appointmentRows.forEach(
      ([label, value]) => {
        pdf.setFont(
          "helvetica",
          "bold"
        )

        pdf.text(
          `${label}:`,
          20,
          y
        )

        pdf.setFont(
          "helvetica",
          "normal"
        )

        pdf.text(
          String(value),
          55,
          y
        )

        y += 6
      }
    )

    /*
     * ---------------------------------------------------------
     * EPVS
     * ---------------------------------------------------------
     */

    if (
      isSolar &&
      epvsCalculation
    ) {
      y += 8

      pdf.setFont(
        "helvetica",
        "bold"
      )

      pdf.setFontSize(14)

      pdf.text(
        "EPVS Calculation",
        20,
        y
      )

      y += 9

      const {
        data,
        results,
      } = epvsCalculation

      const epvsRows = [
        [
          "System size",
          `${Number(
            results.systemSize || 0
          ).toFixed(2)} kWp`,
        ],

        [
          "Panel wattage",
          `${Number(
            data.panelWattage || 0
          )} W`,
        ],

        [
          "Number of panels",
          `${Number(
            data.panelCount || 0
          )}`,
        ],

        [
          "Annual consumption",
          `${Math.round(
            Number(
              data.annualConsumption ||
                0
            )
          ).toLocaleString(
            "en-GB"
          )} kWh`,
        ],

        [
          "Estimated generation",
          `${Math.round(
            Number(
              results.generation || 0
            )
          ).toLocaleString(
            "en-GB"
          )} kWh`,
        ],

        [
          "Solar self-consumption",
          `${Math.round(
            Number(
              results.solarSelfConsumption ||
                0
            )
          ).toLocaleString(
            "en-GB"
          )} kWh`,
        ],

        [
          "Battery",
          data.batteryEnabled
            ? `${Number(
                data.batteryCapacity ||
                  0
              )} kWh`
            : "Not included",
        ],

        [
          "Battery contribution",
          `${Math.round(
            Number(
              results.batteryContribution ||
                0
            )
          ).toLocaleString(
            "en-GB"
          )} kWh`,
        ],

        [
          "Estimated export",
          `${Math.round(
            Number(
              results.exportKwh || 0
            )
          ).toLocaleString(
            "en-GB"
          )} kWh`,
        ],

        [
          "Inverter",
          `${Number(
            data.inverterCapacity ||
              0
          )} kW`,
        ],

        [
          "Tariff",
          data.tariff || "—",
        ],

        [
          "Import rate",
          `£${Number(
            data.importRate || 0
          ).toFixed(3)}/kWh`,
        ],

        [
          "Export rate",
          `£${Number(
            data.exportRate || 0
          ).toFixed(3)}/kWh`,
        ],

        [
          "Annual saving",
          `£${Math.round(
            Number(
              results.annualSaving ||
                0
            )
          ).toLocaleString(
            "en-GB"
          )}`,
        ],

        [
          "System cost",
          `£${Math.round(
            Number(
              data.systemCost || 0
            )
          ).toLocaleString(
            "en-GB"
          )}`,
        ],

        [
          "Deposit",
          `£${Math.round(
            Number(
              data.deposit || 0
            )
          ).toLocaleString(
            "en-GB"
          )}`,
        ],

        [
          "Finance term",
          `${Number(
            data.financeTerm || 0
          )} years`,
        ],

        [
          "Interest rate",
          `${Number(
            data.financeRate || 0
          ).toFixed(1)}%`,
        ],

        [
          "Monthly finance",
          `£${Math.round(
            Number(
              results.monthlyPayment ||
                0
            )
          ).toLocaleString(
            "en-GB"
          )}`,
        ],

        [
          "Simple payback",
          results.simplePayback
            ? `${Number(
                results.simplePayback
              ).toFixed(1)} years`
            : "—",
        ],
      ]

      /*
       * -------------------------------------------------------
       * EPVS TABLE
       * -------------------------------------------------------
       */

      const tableX = 20
      const labelX = 23
      const valueX =
        pageWidth - 23
      const rowHeight = 6

      const tableWidth =
        pageWidth - 40

      epvsRows.forEach(
        ([label, value], index) => {
          /*
           * Start a new page if necessary.
           */

          if (
            y >
            pdf.internal.pageSize.getHeight() -
              25
          ) {
            pdf.addPage()
            y = 20
          }

          if (index % 2 === 0) {
            pdf.setFillColor(
              245,
              247,
              249
            )

            pdf.rect(
              tableX,
              y - 4,
              tableWidth,
              rowHeight,
              "F"
            )
          }

          pdf.setTextColor(
            60,
            60,
            60
          )

          pdf.setFont(
            "helvetica",
            "bold"
          )

          pdf.setFontSize(8)

          pdf.text(
            label,
            labelX,
            y
          )

          pdf.setFont(
            "helvetica",
            "normal"
          )

          pdf.text(
            String(value),
            valueX,
            y,
            {
              align: "right",
            }
          )

          y += rowHeight
        }
      )

      /*
       * -------------------------------------------------------
       * FOOTER NOTE
       * -------------------------------------------------------
       */

      y += 8

      if (
        y >
        pdf.internal.pageSize.getHeight() -
          25
      ) {
        pdf.addPage()
        y = 20
      }

      pdf.setFontSize(8)

      pdf.setTextColor(
        120,
        120,
        120
      )

      pdf.setFont(
        "helvetica",
        "italic"
      )

      pdf.text(
        "This document contains the EPVS calculation information recorded for this appointment.",
        20,
        y
      )
    }

    /*
     * ---------------------------------------------------------
     * FOOTER ON ALL PAGES
     * ---------------------------------------------------------
     */

    const pageCount =
      pdf.getNumberOfPages()

    for (
      let page = 1;
      page <= pageCount;
      page++
    ) {
      pdf.setPage(page)

      const height =
        pdf.internal.pageSize.getHeight()

      pdf.setDrawColor(
        220,
        220,
        220
      )

      pdf.line(
        20,
        height - 15,
        pageWidth - 20,
        height - 15
      )

      pdf.setFontSize(7)

      pdf.setTextColor(
        130,
        130,
        130
      )

      pdf.setFont(
        "helvetica",
        "normal"
      )

      pdf.text(
        `Appointment ${appointment.id || ""}`,
        20,
        height - 9
      )

      pdf.text(
        `Page ${page} of ${pageCount}`,
        pageWidth - 20,
        height - 9,
        {
          align: "right",
        }
      )
    }

    /*
     * ---------------------------------------------------------
     * DOWNLOAD
     * ---------------------------------------------------------
     */

    const customerName =
      String(
        appointment.name ||
          "Customer"
      )
        .replace(
          /[^a-z0-9]+/gi,
          "-"
        )
        .replace(
          /^-+|-+$/g,
          ""
        )

    pdf.save(
      `HomeShield-${customerName}-EPVS.pdf`
    )
  }

  /*
   * =========================================================
   * SAVE RESULT
   * =========================================================
   */

  async function saveResult() {
    if (!result) {
      return
    }

    setSaving(true)
    setError("")

    try {
      const {
        data,
        error: updateError,
      } = await supabase
        .from("appointments")
        .update({
          result,
        })
        .eq(
          "id",
          appointment.id
        )
        .select()
        .single()

      if (updateError) {
        throw updateError
      }

      /*
       * Update the appointment first.
       */

      onUpdated?.(data)

      setShowResult(false)

      /*
       * If the appointment was sold, generate the PDF.
       *
       * We deliberately do this AFTER Supabase confirms the
       * result has been saved.
       */

      if (
        String(result)
          .toLowerCase()
          .trim() === "sold"
      ) {
        /*
         * Give React a moment to finish updating the UI/state
         * before creating the document.
         */

        setTimeout(() => {
          generateSoldPdf()
        }, 100)
      }
    } catch (err) {
      console.error(
        "Error updating appointment:",
        err
      )

      setError(
        err?.message ||
          "Unable to save result."
      )
    } finally {
      setSaving(false)
    }
  }

  /*
   * =========================================================
   * MAP
   * =========================================================
   */

  const mapQuery =
    appointment?.postcode || ""

  /*
   * =========================================================
   * RESULT COLOUR
   * =========================================================
   */

  function getResultStyle() {
    const value =
      String(result || "")
        .toLowerCase()

    if (
      value.includes("sold")
    ) {
      return {
        background: "#e8f4e2",
        color: "#315b28",
      }
    }

    if (
      value.includes("cancel") ||
      value.includes("lost")
    ) {
      return {
        background: "#fbeaea",
        color: "#8b3333",
      }
    }

    return {
      background: "#f2f3f5",
      color: "#555",
    }
  }

  if (!appointment) {
    return null
  }

  return (
    <section>

      {/* HERO */}

      <div
        style={{
          margin:
            "-24px -24px 0",
          background:
            "#002d49",
          color:
            "#fff",
          padding:
            "10px 28px 24px",
        }}
      >
        <div
          style={{
            display:
              "flex",
            alignItems:
              "center",
            gap:
              "8px",
            marginBottom:
              "18px",
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              border: 0,
              background:
                "transparent",
              color:
                "#dce8ef",
              cursor:
                "pointer",
              padding:
                "4px",
              display:
                "flex",
              alignItems:
                "center",
              justifyContent:
                "center",
            }}
          >
            <ArrowLeft
              size={17}
            />
          </button>

          <span
            style={{
              fontSize:
                "12px",
              fontWeight:
                600,
            }}
          >
            {appointment.salesperson ||
              appointment.name ||
              "Appointment"}
          </span>
        </div>

        <div
          style={{
            display:
              "flex",
            alignItems:
              "flex-start",
            justifyContent:
              "space-between",
            gap:
              "20px",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize:
                  "24px",
                lineHeight:
                  1.2,
                fontWeight:
                  700,
              }}
            >
              {appointment.name ||
                "Unnamed customer"}
            </h1>

            <div
              style={{
                marginTop:
                  "5px",
                fontSize:
                  "13px",
                color:
                  "#c9d8e1",
              }}
            >
              {formatDate(
                appointment.appointment_date
              )}
            </div>
          </div>

          <div
            style={{
              display:
                "flex",
              gap:
                "8px",
              flexShrink:
                0,
            }}
          >
            <button
              type="button"
              onClick={() =>
                setShowResult(
                  true
                )
              }
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap:
                  "7px",
                height:
                  "40px",
                padding:
                  "0 15px",
                border:
                  "none",
                borderRadius:
                  "8px",
                background:
                  "#2499ed",
                color:
                  "#fff",
                cursor:
                  "pointer",
                fontFamily:
                  "inherit",
                fontSize:
                  "12px",
                fontWeight:
                  700,
              }}
            >
              <Plus
                size={17}
              />
              Result
            </button>

            <button
              type="button"
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap:
                  "7px",
                height:
                  "40px",
                padding:
                  "0 15px",
                border:
                  "1px solid #557287",
                borderRadius:
                  "8px",
                background:
                  "#173f59",
                color:
                  "#fff",
                cursor:
                  "pointer",
                fontFamily:
                  "inherit",
                fontSize:
                  "12px",
                fontWeight:
                  600,
              }}
            >
              <Pencil
                size={15}
              />
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* MAP */}

      <div
        style={{
          marginTop:
            "8px",
          borderRadius:
            "10px",
          overflow:
            "hidden",
          border:
            "1px solid #dfe2e5",
          background:
            "#eef1f3",
          height:
            "275px",
        }}
      >
        {mapQuery ? (
          <iframe
            title="Customer location"
            width="100%"
            height="100%"
            style={{
              border: 0,
              display:
                "block",
            }}
            loading="lazy"
            src={`https://www.google.com/maps?q=${encodeURIComponent(
              mapQuery
            )}&output=embed`}
          />
        ) : (
          <div
            style={{
              height:
                "100%",
              display:
                "flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              color:
                "#888",
              fontSize:
                "12px",
            }}
          >
            No postcode available
          </div>
        )}
      </div>

      {/* INFORMATION */}

      <div
        style={{
          display:
            "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0, 1fr))",
          gap:
            "14px",
          marginTop:
            "18px",
        }}
      >
        <InfoCard
          title="Customer"
          icon={UserRound}
        >
          <InfoRow
            label="Name"
            value={
              appointment.name
            }
          />

          <InfoRow
            label="Phone"
            value={
              appointment.phone
            }
            icon={
              appointment.phone
                ? Phone
                : null
            }
          />

          <InfoRow
            label="Email"
            value={
              appointment.email
            }
            icon={
              appointment.email
                ? Mail
                : null
            }
          />

          <InfoRow
            label="Postcode"
            value={
              appointment.postcode
            }
            icon={
              appointment.postcode
                ? MapPin
                : null
            }
          />
        </InfoCard>

        <InfoCard
          title="Appointment"
          icon={CalendarDays}
        >
          <InfoRow
            label="Date"
            value={formatDate(
              appointment.appointment_date
            )}
          />

          <InfoRow
            label="Job type"
            value={
              appointment.job_type
            }
          />

          <InfoRow
            label="Type"
            value={
              appointment.product ||
              appointment.type ||
              appointment.appointment_type
            }
          />

          <InfoRow
            label="Salesperson"
            value={
              appointment.salesperson
            }
          />
        </InfoCard>

        <InfoCard
          title="Result"
          icon={Check}
        >
          <div
            style={{
              display:
                "flex",
              alignItems:
                "center",
              justifyContent:
                "space-between",
              gap:
                "10px",
            }}
          >
            <span
              style={{
                fontSize:
                  "10px",
                color:
                  "#888",
              }}
            >
              Current result
            </span>

            {result ? (
              <span
                style={{
                  display:
                    "inline-block",
                  padding:
                    "5px 9px",
                  borderRadius:
                    "6px",
                  fontSize:
                    "10px",
                  fontWeight:
                    700,
                  ...getResultStyle(),
                }}
              >
                {result}
              </span>
            ) : (
              <span
                style={{
                  fontSize:
                    "10px",
                  color:
                    "#aaa",
                }}
              >
                Not resulted
              </span>
            )}
          </div>
        </InfoCard>
      </div>

      {/* EPVS */}

      {isSolar && (
        <div
          style={{
            marginTop:
              "24px",
          }}
        >
          <div
            style={{
              marginBottom:
                "12px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize:
                  "18px",
                color:
                  "#222",
              }}
            >
              EPVS Calculator
            </h2>

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
              Complete the EPVS calculation for
              this solar appointment.
            </p>
          </div>

          <EPVSCalculator
            appointment={
              appointment
            }
            onCalculationChange={
              setEpvsCalculation
            }
          />
        </div>
      )}

      {/* RESULT MODAL */}

      {showResult && (
        <div
          style={{
            position:
              "fixed",
            inset: 0,
            background:
              "rgba(0,0,0,0.35)",
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            zIndex:
              1000,
            padding:
              "20px",
          }}
        >
          <div
            style={{
              width:
                "100%",
              maxWidth:
                "440px",
              background:
                "#fff",
              borderRadius:
                "10px",
              boxShadow:
                "0 15px 50px rgba(0,0,0,0.20)",
              overflow:
                "hidden",
            }}
          >
            <div
              style={{
                padding:
                  "18px 20px",
                borderBottom:
                  "1px solid #eee",
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "space-between",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize:
                      "16px",
                  }}
                >
                  Result appointment
                </h2>

                <p
                  style={{
                    margin:
                      "4px 0 0",
                    fontSize:
                      "10px",
                    color:
                      "#888",
                  }}
                >
                  {appointment.name}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowResult(
                    false
                  )
                }
                style={{
                  border: 0,
                  background:
                    "transparent",
                  cursor:
                    "pointer",
                  color:
                    "#888",
                }}
              >
                <X
                  size={18}
                />
              </button>
            </div>

            <div
              style={{
                padding:
                  "20px",
              }}
            >
              <label
                style={{
                  display:
                    "block",
                  fontSize:
                    "10px",
                  fontWeight:
                    700,
                  color:
                    "#555",
                  marginBottom:
                    "7px",
                  textTransform:
                    "uppercase",
                }}
              >
                Result
              </label>

              <select
                value={result}
                onChange={(e) =>
                  setResult(
                    e.target.value
                  )
                }
                style={{
                  width:
                    "100%",
                  height:
                    "40px",
                  border:
                    "1px solid #d9dadd",
                  borderRadius:
                    "7px",
                  padding:
                    "0 10px",
                  fontFamily:
                    "inherit",
                  fontSize:
                    "12px",
                  background:
                    "#fff",
                }}
              >
                <option value="">
                  Select result...
                </option>

                <option value="Sold">
                  Sold
                </option>

                <option value="Not Sold">
                  Not Sold
                </option>

                <option value="No Contact">
                  No Contact
                </option>

                <option value="Cancelled">
                  Cancelled
                </option>

                <option value="Rescheduled">
                  Rescheduled
                </option>
              </select>

              {result
                .toLowerCase()
                .trim() ===
                "sold" &&
                isSolar && (
                  <div
                    style={{
                      marginTop:
                        "12px",
                      padding:
                        "10px",
                      background:
                        "#eef7ff",
                      borderRadius:
                        "6px",
                      color:
                        "#245579",
                      fontSize:
                        "10px",
                    }}
                  >
                    Saving as Sold will generate
                    the EPVS PDF automatically.
                  </div>
                )}

              {error && (
                <div
                  style={{
                    marginTop:
                      "12px",
                    padding:
                      "10px",
                    background:
                      "#fbeaea",
                    borderRadius:
                      "6px",
                    color:
                      "#8b3333",
                    fontSize:
                      "10px",
                  }}
                >
                  {error}
                </div>
              )}
            </div>

            <div
              style={{
                padding:
                  "14px 20px",
                borderTop:
                  "1px solid #eee",
                display:
                  "flex",
                justifyContent:
                  "flex-end",
                gap:
                  "8px",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setShowResult(
                    false
                  )
                }
                style={{
                  height:
                    "36px",
                  padding:
                    "0 13px",
                  border:
                    "1px solid #dddfe3",
                  borderRadius:
                    "7px",
                  background:
                    "#fff",
                  cursor:
                    "pointer",
                  fontFamily:
                    "inherit",
                  fontSize:
                    "11px",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  !result ||
                  saving
                }
                onClick={
                  saveResult
                }
                style={{
                  height:
                    "36px",
                  padding:
                    "0 15px",
                  border: 0,
                  borderRadius:
                    "7px",
                  background:
                    "#172554",
                  color:
                    "#fff",
                  cursor:
                    result &&
                    !saving
                      ? "pointer"
                      : "default",
                  opacity:
                    result &&
                    !saving
                      ? 1
                      : 0.5,
                  fontFamily:
                    "inherit",
                  fontSize:
                    "11px",
                  fontWeight:
                    600,
                }}
              >
                {saving
                  ? "Saving..."
                  : "Save result"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

/* =========================================================
   INFO CARD
   ========================================================= */

function InfoCard({
  title,
  icon: Icon,
  children,
}) {
  return (
    <div
      className="card"
      style={{
        padding:
          "16px",
      }}
    >
      <div
        style={{
          display:
            "flex",
          alignItems:
            "center",
          gap:
            "7px",
          marginBottom:
            "14px",
        }}
      >
        <Icon
          size={15}
          color="#172554"
        />

        <h3
          style={{
            margin: 0,
            fontSize:
              "12px",
            fontWeight:
              700,
          }}
        >
          {title}
        </h3>
      </div>

      <div
        style={{
          display:
            "flex",
          flexDirection:
            "column",
          gap:
            "10px",
        }}
      >
        {children}
      </div>
    </div>
  )
}

/* =========================================================
   INFO ROW
   ========================================================= */

function InfoRow({
  label,
  value,
  icon: Icon,
}) {
  return (
    <div
      style={{
        display:
          "flex",
        justifyContent:
          "space-between",
        alignItems:
          "center",
        gap:
          "12px",
      }}
    >
      <span
        style={{
          fontSize:
            "9px",
          color:
            "#999",
          display:
            "flex",
          alignItems:
            "center",
          gap:
            "4px",
        }}
      >
        {Icon && (
          <Icon size={11} />
        )}

        {label}
      </span>

      <span
        style={{
          fontSize:
            "10px",
          color:
            "#333",
          fontWeight:
            500,
          textAlign:
            "right",
          overflow:
            "hidden",
          textOverflow:
            "ellipsis",
          whiteSpace:
            "nowrap",
        }}
      >
        {value || "—"}
      </span>
    </div>
  )
}

export default AppointmentDetail
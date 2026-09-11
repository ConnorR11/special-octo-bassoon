import React, { useEffect, useState } from "react"

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
import { GenerateSolarContract } from "../contracts/GenerateSolarContract"

function AppointmentDetail({
  appointment,
  onBack,
  onUpdated,
}) {
  const [showResult, setShowResult] = useState(false)

  const [result, setResult] = useState(
    appointment?.result ||
      appointment?.status ||
      ""
  )

  const [saving, setSaving] = useState(false)

  const [error, setError] = useState("")

  // =========================================================
  // CPS STATUS
  // =========================================================

  const [cpsValues, setCpsValues] = useState({
    cps_h: appointment?.cps_h === true,
    cps_c: appointment?.cps_c === true,
    cps_p: appointment?.cps_p === true,
    cps_s: appointment?.cps_s === true,
  })

  const [savingCps, setSavingCps] = useState(false)

  const [cpsError, setCpsError] = useState("")

  // Keep CPS values in sync if a different appointment is opened
  useEffect(() => {
    setCpsValues({
      cps_h: appointment?.cps_h === true,
      cps_c: appointment?.cps_c === true,
      cps_p: appointment?.cps_p === true,
      cps_s: appointment?.cps_s === true,
    })

    setCpsError("")
  }, [appointment])

  /*
   * The EPVS calculator sends the complete calculation
   * back to this component.
   *
   * {
   *   data,
   *   results,
   *   thirtyYearProjection
   * }
   *
   * This is used when generating the solar contract.
   *
   * IMPORTANT:
   * The 30 year breakdown is NOT rendered here.
   * EPVSCalculator renders it itself on the Results step.
   */

  const [epvsCalculation, setEpvsCalculation] =
    useState(null)

  // =========================================================
  // SOLAR CHECK
  // =========================================================

  const isSolar =
    String(appointment?.job_type || "")
      .toLowerCase()
      .trim() === "solar"

  // =========================================================
  // DATE
  // =========================================================

  function formatDate(value) {
    if (!value) {
      return "—"
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return String(value)
    }

    return date.toLocaleString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // =========================================================
  // SAVE RESULT
  // =========================================================

  async function saveResult() {
    if (!result) {
      return
    }

    if (!appointment?.appointment_row_id) {
      setError(
        "This appointment does not have an appointment_row_id."
      )

      return
    }

    setSaving(true)
    setError("")

    try {
      // =======================================================
      // UPDATE APPOINTMENT
      // =======================================================

      const {
        data,
        error: updateError,
      } = await supabase
        .from("appointments")
        .update({
          result: result,
        })
        .eq(
          "appointment_row_id",
          appointment.appointment_row_id
        )
        .select()

      if (updateError) {
        throw updateError
      }

      if (!data || data.length === 0) {
        throw new Error(
          "No appointment was updated. Check that appointment_row_id matches a row in the appointments table."
        )
      }

      // =======================================================
      // UPDATED APPOINTMENT
      // =======================================================

      const updatedAppointment = data[0]

      onUpdated?.(updatedAppointment)

      // =======================================================
      // SOLAR CONTRACT
      // =======================================================

      if (
        String(result)
          .toLowerCase()
          .trim() === "sold" &&
        isSolar
      ) {
        /*
         * A solar appointment marked as Sold requires
         * the completed EPVS calculation.
         */

        if (!epvsCalculation) {
          throw new Error(
            "The appointment was saved as Sold, but no EPVS calculation is available. Please complete the EPVS calculation before generating the solar contract."
          )
        }

        try {
          /*
           * Pass the complete EPVS calculation to the
           * contract generator.
           *
           * This includes:
           *
           * data
           * results
           * thirtyYearProjection
           */

          await GenerateSolarContract({
            appointment: updatedAppointment,
            epvsCalculation,
          })
        } catch (contractError) {
          console.error(
            "Error generating solar contract:",
            contractError
          )

          setError(
            "Appointment was saved as Sold, but the solar contract could not be generated."
          )

          return
        }
      }

      // =======================================================
      // CLOSE MODAL
      // =======================================================

      setShowResult(false)
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

  // =========================================================
  // TOGGLE CPS VALUE
  // =========================================================

  function toggleCps(field) {
    setCpsValues((current) => ({
      ...current,
      [field]: !current[field],
    }))

    setCpsError("")
  }

  // =========================================================
  // SAVE CPS STATUS
  // =========================================================

  async function saveCpsStatus() {
    if (!appointment?.appointment_row_id) {
      setCpsError(
        "This appointment does not have an appointment_row_id."
      )

      return
    }

    setSavingCps(true)
    setCpsError("")

    try {
      const {
        data,
        error: updateError,
      } = await supabase
        .from("appointments")
        .update({
          cps_h: cpsValues.cps_h,
          cps_c: cpsValues.cps_c,
          cps_p: cpsValues.cps_p,
          cps_s: cpsValues.cps_s,
        })
        .eq(
          "appointment_row_id",
          appointment.appointment_row_id
        )
        .select()

      if (updateError) {
        throw updateError
      }

      if (!data || data.length === 0) {
        throw new Error(
          "No appointment was updated. Check that appointment_row_id matches a row in the appointments table."
        )
      }

      const updatedAppointment = data[0]

      // Keep parent/detail view in sync
      onUpdated?.(updatedAppointment)

      // Re-sync local values with the database response
      setCpsValues({
        cps_h: updatedAppointment.cps_h === true,
        cps_c: updatedAppointment.cps_c === true,
        cps_p: updatedAppointment.cps_p === true,
        cps_s: updatedAppointment.cps_s === true,
      })
    } catch (err) {
      console.error(
        "Error updating CPS status:",
        err
      )

      setCpsError(
        err?.message ||
          "Unable to save CPS status."
      )
    } finally {
      setSavingCps(false)
    }
  }

  // =========================================================
  // MAP
  // =========================================================

  const mapQuery =
    appointment?.postcode || ""

  // =========================================================
  // RESULT COLOUR
  // =========================================================

  function getResultStyle() {
    const value = String(result || "")
      .toLowerCase()

    if (value.includes("sold")) {
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

  // =========================================================
  // NO APPOINTMENT
  // =========================================================

  if (!appointment) {
    return null
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <section>

      {/* =====================================================
          HERO
      ===================================================== */}

      <div
        style={{
          margin: "-24px -24px 0",
          background: "#002d49",
          color: "#fff",
          padding: "10px 28px 24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "18px",
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              border: 0,
              background: "transparent",
              color: "#dce8ef",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={17} />
          </button>

          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            {appointment.rep_allocated ||
              appointment.name ||
              "Appointment"}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "20px",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "24px",
                lineHeight: 1.2,
                fontWeight: 700,
              }}
            >
              {appointment.name ||
                "Unnamed customer"}
            </h1>

            <div
              style={{
                marginTop: "5px",
                fontSize: "13px",
                color: "#c9d8e1",
              }}
            >
              {formatDate(
                appointment.appointment_date
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "8px",
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setError("")
                setShowResult(true)
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "7px",
                height: "40px",
                padding: "0 15px",
                border: "none",
                borderRadius: "8px",
                background: "#2499ed",
                color: "#fff",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              <Plus size={17} />
              Result
            </button>

            <button
              type="button"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "7px",
                height: "40px",
                padding: "0 15px",
                border: "1px solid #557287",
                borderRadius: "8px",
                background: "#173f59",
                color: "#fff",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              <Pencil size={15} />
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================
          MAP
      ===================================================== */}

      <div
        style={{
          marginTop: "8px",
          borderRadius: "10px",
          overflow: "hidden",
          border: "1px solid #dfe2e5",
          background: "#eef1f3",
          height: "275px",
        }}
      >
        {mapQuery ? (
          <iframe
            title="Customer location"
            width="100%"
            height="100%"
            style={{
              border: 0,
              display: "block",
            }}
            loading="lazy"
            src={`https://www.google.com/maps?q=${encodeURIComponent(
              mapQuery
            )}&output=embed`}
          />
        ) : (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#888",
              fontSize: "12px",
            }}
          >
            No postcode available
          </div>
        )}
      </div>

      {/* =====================================================
          INFORMATION
      ===================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0, 1fr))",
          gap: "14px",
          marginTop: "18px",
        }}
      >

        <InfoCard
          title="Customer"
          icon={UserRound}
        >
          <InfoRow
            label="Name"
            value={appointment.name}
          />

          <InfoRow
            label="Phone"
            value={appointment.phone}
            icon={
              appointment.phone
                ? Phone
                : null
            }
          />

          <InfoRow
            label="Email"
            value={appointment.email}
            icon={
              appointment.email
                ? Mail
                : null
            }
          />

          <InfoRow
            label="Postcode"
            value={appointment.postcode}
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
            value={appointment.job_type}
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
            label="Sales Rep"
            value={
              appointment.rep_allocated
            }
          />
        </InfoCard>

        <InfoCard
          title="Result"
          icon={Check}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
            }}
          >
            <span
              style={{
                fontSize: "10px",
                color: "#888",
              }}
            >
              Current result
            </span>

            {result ? (
              <span
                style={{
                  display: "inline-block",
                  padding: "5px 9px",
                  borderRadius: "6px",
                  fontSize: "10px",
                  fontWeight: 700,
                  ...getResultStyle(),
                }}
              >
                {result}
              </span>
            ) : (
              <span
                style={{
                  fontSize: "10px",
                  color: "#aaa",
                }}
              >
                Not resulted
              </span>
            )}
          </div>
        </InfoCard>

      </div>

      {/* =====================================================
          CPS STATUS
      ===================================================== */}

      <div
        style={{
          marginTop: "14px",
          padding: "16px",
          background: "#fff",
          border: "1px solid #e2e5e8",
          borderRadius: "8px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "14px",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "12px",
                fontWeight: 700,
                color: "#222",
              }}
            >
              CPS Status
            </h3>

            <p
              style={{
                margin: "4px 0 0",
                fontSize: "10px",
                color: "#999",
              }}
            >
              Update the CPS flags for this appointment.
            </p>
          </div>

          <button
            type="button"
            onClick={saveCpsStatus}
            disabled={savingCps}
            style={{
              height: "32px",
              padding: "0 13px",
              border: 0,
              borderRadius: "6px",
              background: "#172554",
              color: "#fff",
              cursor: savingCps
                ? "default"
                : "pointer",
              opacity: savingCps ? 0.6 : 1,
              fontFamily: "inherit",
              fontSize: "10px",
              fontWeight: 700,
            }}
          >
            {savingCps
              ? "Saving..."
              : "Save CPS status"}
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: "10px",
          }}
        >
          {[
            {
              field: "cps_h",
              label: "H",
            },
            {
              field: "cps_c",
              label: "C",
            },
            {
              field: "cps_p",
              label: "P",
            },
            {
              field: "cps_s",
              label: "S",
            },
          ].map(({ field, label }) => {
            const active =
              cpsValues[field]

            return (
              <button
                key={field}
                type="button"
                onClick={() =>
                  toggleCps(field)
                }
                style={{
                  border: active
                    ? "1px solid #2499ed"
                    : "1px solid #e1e5e9",
                  background: active
                    ? "#eef8ff"
                    : "#f8f9fa",
                  borderRadius: "7px",
                  padding: "12px 8px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "7px",
                  minHeight: "65px",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 800,
                    color: active
                      ? "#1679bd"
                      : "#66717b",
                  }}
                >
                  {label}
                </span>

                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: active
                      ? "#2499ed"
                      : "#e9ecef",
                    color: active
                      ? "#fff"
                      : "#9aa3aa",
                  }}
                >
                  {active ? (
                    <Check size={13} />
                  ) : (
                    <X size={13} />
                  )}
                </span>

                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 600,
                    color: active
                      ? "#1679bd"
                      : "#999",
                  }}
                >
                  {active
                    ? "True"
                    : "False"}
                </span>
              </button>
            )
          })}
        </div>

        {cpsError && (
          <div
            style={{
              marginTop: "12px",
              padding: "9px 10px",
              background: "#fbeaea",
              borderRadius: "6px",
              color: "#8b3333",
              fontSize: "10px",
            }}
          >
            {cpsError}
          </div>
        )}
      </div>

      {/* =====================================================
          EPVS CALCULATOR
      ===================================================== */}

      {isSolar && (
        <div
          style={{
            marginTop: "24px",
          }}
        >
          <div
            style={{
              marginBottom: "12px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "18px",
                color: "#222",
              }}
            >
              EPVS Calculator
            </h2>

            <p
              style={{
                margin: "5px 0 0",
                fontSize: "11px",
                color: "#888",
              }}
            >
              Complete the EPVS calculation for
              this solar appointment.
            </p>
          </div>

          <EPVSCalculator
            appointment={appointment}
            onCalculationChange={
              setEpvsCalculation
            }
          />
        </div>
      )}

      {/* =====================================================
          RESULT MODAL
      ===================================================== */}

      {showResult && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "440px",
              background: "#fff",
              borderRadius: "10px",
              boxShadow:
                "0 15px 50px rgba(0,0,0,0.20)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid #eee",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "16px",
                  }}
                >
                  Result appointment
                </h2>

                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "10px",
                    color: "#888",
                  }}
                >
                  {appointment.name}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowResult(false)
                }
                style={{
                  border: 0,
                  background: "transparent",
                  cursor: "pointer",
                  color: "#888",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                padding: "20px",
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#555",
                  marginBottom: "7px",
                  textTransform: "uppercase",
                }}
              >
                Result
              </label>

              <select
                value={result}
                onChange={(e) =>
                  setResult(e.target.value)
                }
                style={{
                  width: "100%",
                  height: "40px",
                  border:
                    "1px solid #d9dadd",
                  borderRadius: "7px",
                  padding: "0 10px",
                  fontFamily: "inherit",
                  fontSize: "12px",
                  background: "#fff",
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
                .trim() === "sold" &&
                isSolar && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "10px",
                      background: "#eef7ff",
                      borderRadius: "6px",
                      color: "#245579",
                      fontSize: "10px",
                    }}
                  >
                    {epvsCalculation ? (
                      <>
                        Saving as Sold will generate
                        the solar contract PDF using
                        the completed EPVS calculation,
                        including the 30-year benefit
                        projection.
                      </>
                    ) : (
                      <>
                        Please complete the EPVS
                        calculation before saving this
                        appointment as Sold.
                      </>
                    )}
                  </div>
                )}

              {error && (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "10px",
                    background: "#fbeaea",
                    borderRadius: "6px",
                    color: "#8b3333",
                    fontSize: "10px",
                  }}
                >
                  {error}
                </div>
              )}
            </div>

            <div
              style={{
                padding: "14px 20px",
                borderTop: "1px solid #eee",
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setShowResult(false)
                }
                style={{
                  height: "36px",
                  padding: "0 13px",
                  border:
                    "1px solid #dddfe3",
                  borderRadius: "7px",
                  background: "#fff",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "11px",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  !result ||
                  saving ||
                  (result
                    .toLowerCase()
                    .trim() === "sold" &&
                    isSolar &&
                    !epvsCalculation)
                }
                onClick={saveResult}
                style={{
                  height: "36px",
                  padding: "0 15px",
                  border: 0,
                  borderRadius: "7px",
                  background: "#172554",
                  color: "#fff",
                  cursor:
                    result &&
                    !saving &&
                    !(
                      result
                        .toLowerCase()
                        .trim() === "sold" &&
                      isSolar &&
                      !epvsCalculation
                    )
                      ? "pointer"
                      : "default",
                  opacity:
                    result &&
                    !saving &&
                    !(
                      result
                        .toLowerCase()
                        .trim() === "sold" &&
                      isSolar &&
                      !epvsCalculation
                    )
                      ? 1
                      : 0.5,
                  fontFamily: "inherit",
                  fontSize: "11px",
                  fontWeight: 600,
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

// =========================================================
// INFO CARD
// =========================================================

function InfoCard({
  title,
  icon: Icon,
  children,
}) {
  return (
    <div
      className="card"
      style={{
        padding: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "7px",
          marginBottom: "14px",
        }}
      >
        <Icon
          size={15}
          color="#172554"
        />

        <h3
          style={{
            margin: 0,
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          {title}
        </h3>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {children}
      </div>
    </div>
  )
}

// =========================================================
// INFO ROW
// =========================================================

function InfoRow({
  label,
  value,
  icon: Icon,
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <span
        style={{
          fontSize: "9px",
          color: "#999",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        {Icon && <Icon size={11} />}

        {label}
      </span>

      <span
        style={{
          fontSize: "10px",
          color: "#333",
          fontWeight: 500,
          textAlign: "right",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value || "—"}
      </span>
    </div>
  )
}

export default AppointmentDetail
import React, { useState } from "react"
import {
  ArrowLeft,
  Save,
  MapPin,
  ExternalLink,
} from "lucide-react"

import { supabase } from "../lib/supabase"

function CustomerDetail({
  deal,
  onBack,
  onUpdated,
}) {
  const [salesperson, setSalesperson] =
    useState(deal?.salesperson || "")

  const [address, setAddress] =
    useState(deal?.address || "")

  const [postcode, setPostcode] =
    useState(deal?.postcode || "")

  const [saving, setSaving] =
    useState(false)

  const [message, setMessage] =
    useState("")

  if (!deal) {
    return null
  }

  /*
   * FULL ADDRESS
   */

  const fullAddress = [
    address,
    postcode,
  ]
    .filter(Boolean)
    .join(", ")

  /*
   * GOOGLE MAPS LINKS
   */

  const mapsUrl = fullAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        fullAddress
      )}`
    : null

  /*
   * SAVE CHANGES
   */

  async function handleSave() {
    setSaving(true)
    setMessage("")

    try {
      const updatedSalesperson =
        salesperson.trim()

      const updatedAddress =
        address.trim()

      const updatedPostcode =
        postcode.trim()

      const { error } = await supabase
        .from("deals")
        .update({
          salesperson:
            updatedSalesperson,
          address:
            updatedAddress,
          postcode:
            updatedPostcode,
        })
        .eq("id", deal.id)

      if (error) {
        throw error
      }

      const updatedDeal = {
        ...deal,
        salesperson:
          updatedSalesperson,
        address:
          updatedAddress,
        postcode:
          updatedPostcode,
      }

      onUpdated?.(updatedDeal)

      setMessage(
        "Changes saved successfully."
      )
    } catch (error) {
      console.error(
        "Error saving deal:",
        error
      )

      setMessage(
        error?.message ||
          "Unable to save changes."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>

      {/* =====================================================
          PAGE HEADER
          ===================================================== */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
          marginBottom: "20px",
        }}
      >

        <button
          type="button"
          onClick={onBack}
          style={{
            display: "flex",
            alignItems:
              "center",
            gap: "6px",
            border: 0,
            background:
              "transparent",
            padding: 0,
            cursor: "pointer",
            color: "#666",
            fontSize: "12px",
          }}
        >

          <ArrowLeft size={16} />

          Back to Deals

        </button>


        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            display: "flex",
            alignItems:
              "center",
            gap: "7px",
            padding:
              "9px 14px",
            border: 0,
            borderRadius:
              "7px",
            background:
              "#172554",
            color: "#fff",
            fontSize:
              "11px",
            fontWeight: 600,
            cursor:
              saving
                ? "default"
                : "pointer",
            opacity:
              saving ? 0.6 : 1,
          }}
        >

          <Save size={15} />

          {saving
            ? "Saving..."
            : "Save changes"}

        </button>

      </div>


      {/* =====================================================
          CUSTOMER + MAP
          ===================================================== */}

      <div
        className="card"
        style={{
          marginBottom:
            "18px",
          overflow:
            "hidden",
        }}
      >

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(260px, 0.8fr) minmax(450px, 1.7fr)",
            minHeight:
              "360px",
          }}
        >

          {/* CUSTOMER INFORMATION */}

          <div
            style={{
              padding:
                "30px",
              display: "flex",
              flexDirection:
                "column",
              justifyContent:
                "center",
            }}
          >

            <span
              style={{
                display:
                  "block",
                fontSize:
                  "10px",
                color:
                  "#888",
                textTransform:
                  "uppercase",
                letterSpacing:
                  "0.08em",
                marginBottom:
                  "8px",
              }}
            >
              Customer
            </span>


            <h1
              style={{
                margin: 0,
                fontSize:
                  "26px",
                lineHeight:
                  "1.2",
                color:
                  "#222",
              }}
            >
              {deal.customer_name ||
                "Unnamed customer"}
            </h1>


            {/* CONTRACT */}

            <div
              style={{
                marginTop:
                  "14px",
                display: "flex",
                alignItems:
                  "center",
                gap: "7px",
              }}
            >

              <span
                style={{
                  fontSize:
                    "11px",
                  color:
                    "#888",
                }}
              >
                Contract
              </span>

              <strong
                style={{
                  fontSize:
                    "12px",
                  color:
                    "#444",
                }}
              >
                {deal.contract_number ||
                  "—"}
              </strong>

            </div>


            {/* ADDRESS */}

            {fullAddress && (
              <div
                style={{
                  marginTop:
                    "24px",
                  display: "flex",
                  gap: "9px",
                  alignItems:
                    "flex-start",
                }}
              >

                <MapPin
                  size={17}
                  style={{
                    marginTop:
                      "1px",
                    flexShrink: 0,
                    color:
                      "#172554",
                  }}
                />

                <div>

                  <span
                    style={{
                      display:
                        "block",
                      fontSize:
                        "10px",
                      color:
                        "#888",
                      textTransform:
                        "uppercase",
                      letterSpacing:
                        "0.05em",
                      marginBottom:
                        "4px",
                    }}
                  >
                    Address
                  </span>

                  <span
                    style={{
                      display:
                        "block",
                      fontSize:
                        "12px",
                      color:
                        "#444",
                      lineHeight:
                        "1.5",
                    }}
                  >
                    {fullAddress}
                  </span>

                </div>

              </div>
            )}


            {/* GOOGLE MAPS BUTTON */}

            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display:
                    "inline-flex",
                  alignItems:
                    "center",
                  gap:
                    "6px",
                  width:
                    "fit-content",
                  marginTop:
                    "22px",
                  padding:
                    "8px 11px",
                  border:
                    "1px solid #dddfe3",
                  borderRadius:
                    "7px",
                  color:
                    "#172554",
                  background:
                    "#fff",
                  textDecoration:
                    "none",
                  fontSize:
                    "10px",
                  fontWeight:
                    600,
                }}
              >

                <MapPin size={13} />

                Open in Google Maps

                <ExternalLink
                  size={12}
                />

              </a>
            )}

          </div>


          {/* MAP */}

          <div
            style={{
              minHeight:
                "360px",
              background:
                "#eef0f2",
            }}
          >

            {fullAddress ? (

              <iframe
                title="Customer location"
                src={`https://www.google.com/maps?q=${encodeURIComponent(
                  fullAddress
                )}&output=embed`}
                width="100%"
                height="100%"
                style={{
                  border: 0,
                  display:
                    "block",
                  minHeight:
                    "360px",
                }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />

            ) : (

              <div
                style={{
                  height:
                    "100%",
                  minHeight:
                    "360px",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  color:
                    "#999",
                  fontSize:
                    "12px",
                }}
              >

                <div
                  style={{
                    textAlign:
                      "center",
                  }}
                >

                  <MapPin
                    size={28}
                    style={{
                      marginBottom:
                        "8px",
                    }}
                  />

                  <div>
                    No address available
                  </div>

                </div>

              </div>

            )}

          </div>

        </div>

      </div>


      {/* =====================================================
          DEAL INFORMATION
          ===================================================== */}

      <div className="card">

        <div
          className="card-head"
        >

          <div>

            <h2>
              Deal information
            </h2>

            <p>
              Customer and deal
              information
            </p>

          </div>

        </div>


        <div
          style={{
            padding:
              "0 20px 20px",
          }}
        >

          {/* CUSTOMER */}

          <div
            style={{
              marginBottom:
                "18px",
            }}
          >

            <label
              style={{
                display:
                  "block",
                fontSize:
                  "10px",
                fontWeight:
                  600,
                color:
                  "#777",
                marginBottom:
                  "6px",
              }}
            >
              Customer
            </label>

            <div
              style={{
                padding:
                  "10px 12px",
                background:
                  "#f7f7f8",
                border:
                  "1px solid #e5e5e7",
                borderRadius:
                  "7px",
                fontSize:
                  "12px",
              }}
            >
              {deal.customer_name ||
                "—"}
            </div>

          </div>


          {/* CONTRACT NUMBER */}

          <div
            style={{
              marginBottom:
                "18px",
            }}
          >

            <label
              style={{
                display:
                  "block",
                fontSize:
                  "10px",
                fontWeight:
                  600,
                color:
                  "#777",
                marginBottom:
                  "6px",
              }}
            >
              Contract number
            </label>

            <div
              style={{
                padding:
                  "10px 12px",
                background:
                  "#f7f7f8",
                border:
                  "1px solid #e5e5e7",
                borderRadius:
                  "7px",
                fontSize:
                  "12px",
              }}
            >
              {deal.contract_number ||
                "—"}
            </div>

          </div>


          {/* ADDRESS */}

          <div
            style={{
              marginBottom:
                "18px",
            }}
          >

            <label
              htmlFor="address"
              style={{
                display:
                  "block",
                fontSize:
                  "10px",
                fontWeight:
                  600,
                color:
                  "#777",
                marginBottom:
                  "6px",
              }}
            >
              Address
            </label>

            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) =>
                setAddress(
                  e.target.value
                )
              }
              placeholder="Enter address"
              style={{
                width:
                  "100%",
                boxSizing:
                  "border-box",
                height:
                  "40px",
                padding:
                  "0 12px",
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


          {/* POSTCODE */}

          <div
            style={{
              marginBottom:
                "18px",
            }}
          >

            <label
              htmlFor="postcode"
              style={{
                display:
                  "block",
                fontSize:
                  "10px",
                fontWeight:
                  600,
                color:
                  "#777",
                marginBottom:
                  "6px",
              }}
            >
              Postcode
            </label>

            <input
              id="postcode"
              type="text"
              value={postcode}
              onChange={(e) =>
                setPostcode(
                  e.target.value
                )
              }
              placeholder="Enter postcode"
              style={{
                width:
                  "100%",
                boxSizing:
                  "border-box",
                height:
                  "40px",
                padding:
                  "0 12px",
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


          {/* SALESPERSON */}

          <div>

            <label
              htmlFor="salesperson"
              style={{
                display:
                  "block",
                fontSize:
                  "10px",
                fontWeight:
                  600,
                color:
                  "#777",
                marginBottom:
                  "6px",
              }}
            >
              Salesperson
            </label>

            <input
              id="salesperson"
              type="text"
              value={salesperson}
              onChange={(e) =>
                setSalesperson(
                  e.target.value
                )
              }
              placeholder="Enter salesperson"
              style={{
                width:
                  "100%",
                boxSizing:
                  "border-box",
                height:
                  "40px",
                padding:
                  "0 12px",
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


          {/* SAVE MESSAGE */}

          {message && (
            <div
              style={{
                marginTop:
                  "14px",
                padding:
                  "10px 12px",
                borderRadius:
                  "7px",
                background:
                  message.includes(
                    "successfully"
                  )
                    ? "#e8f4ed"
                    : "#fff0f0",
                color:
                  message.includes(
                    "successfully"
                  )
                    ? "#28734c"
                    : "#a33b3b",
                fontSize:
                  "11px",
              }}
            >
              {message}
            </div>
          )}

        </div>

      </div>

    </section>
  )
}

export default CustomerDetail
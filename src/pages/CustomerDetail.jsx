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
   * ADDRESS USED FOR MAP
   */

  const fullAddress = [
    address,
    postcode,
  ]
    .filter(Boolean)
    .join(", ")

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

      /*
       * Update the local deal
       */

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

      {/* HEADER */}

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
            borderRadius: "7px",
            background:
              "#172554",
            color: "#fff",
            fontSize: "11px",
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


      {/* MAP */}

      {fullAddress && (
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
              height: "400px",
              position:
                "relative",
              background:
                "#eef0f2",
            }}
          >

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
              }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />

            {/* ADDRESS OVERLAY */}

            <div
              style={{
                position:
                  "absolute",
                left: "14px",
                bottom: "14px",
                background:
                  "#fff",
                borderRadius:
                  "8px",
                padding:
                  "10px 12px",
                boxShadow:
                  "0 2px 8px rgba(0,0,0,0.15)",
                display:
                  "flex",
                alignItems:
                  "center",
                gap: "8px",
                maxWidth:
                  "calc(100% - 28px)",
              }}
            >

              <MapPin size={16} />

              <div
                style={{
                  fontSize:
                    "11px",
                  fontWeight:
                    600,
                }}
              >
                {fullAddress}
              </div>

            </div>

          </div>

          <div
            style={{
              padding:
                "10px 14px",
              display:
                "flex",
              justifyContent:
                "flex-end",
              borderTop:
                "1px solid #eee",
            }}
          >

            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap:
                  "5px",
                fontSize:
                  "11px",
                color:
                  "#172554",
                textDecoration:
                  "none",
                fontWeight:
                  600,
              }}
            >

              Open in Google Maps

              <ExternalLink
                size={13}
              />

            </a>

          </div>

        </div>
      )}


      {/* CUSTOMER HEADER */}

      <div
        className="card"
        style={{
          marginBottom:
            "18px",
        }}
      >

        <div
          style={{
            padding:
              "24px",
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
                "0.06em",
              marginBottom:
                "7px",
            }}
          >
            Customer
          </span>

          <h1
            style={{
              margin: 0,
              fontSize:
                "24px",
            }}
          >
            {deal.customer_name ||
              "Unnamed customer"}
          </h1>

          <div
            style={{
              marginTop:
                "8px",
              fontSize:
                "12px",
              color:
                "#888",
            }}
          >

            Contract{" "}

            <strong
              style={{
                color:
                  "#555",
              }}
            >
              {deal.contract_number ||
                "—"}
            </strong>

          </div>

        </div>

      </div>


      {/* DEAL INFORMATION */}

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
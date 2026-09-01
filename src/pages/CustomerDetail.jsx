import React, { useState } from "react"
import { ArrowLeft, Save } from "lucide-react"

import { supabase } from "../lib/supabase"

function CustomerDetail({
  deal,
  onBack,
}) {
  const [salesperson, setSalesperson] =
    useState(deal?.salesperson || "")

  const [saving, setSaving] =
    useState(false)

  const [message, setMessage] =
    useState("")

  if (!deal) {
    return null
  }

  async function handleSave() {
    setSaving(true)
    setMessage("")

    try {
      const { error } = await supabase
        .from("deals")
        .update({
          salesperson:
            salesperson.trim(),
        })
        .eq("id", deal.id)

      if (error) {
        throw error
      }

      /*
       * Keep the selected deal up to date
       */

      deal.salesperson =
        salesperson.trim()

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
          marginBottom: "24px",
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

      {/* CUSTOMER HEADER */}

      <div
        className="card"
        style={{
          marginBottom: "18px",
        }}
      >

        <div
          style={{
            padding: "24px",
          }}
        >

          <span
            style={{
              display:
                "block",
              fontSize: "10px",
              color: "#888",
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
              fontSize: "24px",
            }}
          >
            {deal.customer_name ||
              "Unnamed customer"}
          </h1>

          <div
            style={{
              marginTop:
                "8px",
              fontSize: "12px",
              color: "#888",
            }}
          >
            Contract{" "}
            <strong
              style={{
                color: "#555",
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
              Basic information
              for this deal
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
                fontSize: "10px",
                fontWeight: 600,
                color: "#777",
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
                fontSize: "10px",
                fontWeight: 600,
                color: "#777",
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

          {/* SALESPERSON */}

          <div>

            <label
              htmlFor="salesperson"
              style={{
                display:
                  "block",
                fontSize: "10px",
                fontWeight: 600,
                color: "#777",
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
                width: "100%",
                boxSizing:
                  "border-box",
                height: "40px",
                padding:
                  "0 12px",
                border:
                  "1px solid #d9dadd",
                borderRadius:
                  "7px",
                outline: "none",
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

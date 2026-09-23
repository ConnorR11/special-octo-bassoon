import React, { useState } from "react"

const columns = [
  ["location", "LOCATION", "14%"],
  ["unitType", "CHOICE", "13%"],
  ["size", "SIZE", "12%"],
  ["product", "PRODUCT", "11%"],
  ["finish", "CHOICE", "14%"],
  ["finishFactor", "F", "5%"],
  ["opener", "O", "5%"],
  ["counts", "COUNTS", "9%"],
  ["discountable", "DISCOUNTABLE", "10%"],
  ["nonDiscountable", "NON DISCOUNTABLE", "10%"],
]

const grid = columns.map(column => column[2]).join(" ")

function money(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return "£0"
  return number.toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

const cell = {
  display: "flex",
  alignItems: "center",
  minWidth: 0,
  padding: "0 5px",
}

const input = {
  width: "100%",
  minWidth: 0,
  height: "28px",
  padding: "0 6px",
  border: "1px solid #e0e4e7",
  borderRadius: "5px",
  background: "#fff",
  color: "#333",
  fontFamily: "inherit",
  fontSize: "9px",
  outline: "none",
  boxSizing: "border-box",
}

export default function WindowCosting({ appointment }) {
  const [units, setUnits] = useState([])

  if (
    appointment?.job_type &&
    String(appointment.job_type).trim().toLowerCase() !== "windows"
  ) {
    return null
  }

  const addUnit = () => {
    setUnits(current => [
      ...current,
      {
        id: crypto.randomUUID(),
        unitNumber: current.length + 1,
        location: "",
        unitType: "",
        size: "",
        product: "Window",
        finish: "",
        finishFactor: 0,
        opener: 0,
        counts: 1,
        discountable: 0,
        nonDiscountable: 0,
      },
    ])
  }

  const removeUnit = id => {
    setUnits(current =>
      current
        .filter(unit => unit.id !== id)
        .map((unit, index) => ({ ...unit, unitNumber: index + 1 }))
    )
  }

  const updateUnit = (id, field, value) => {
    setUnits(current =>
      current.map(unit =>
        unit.id === id ? { ...unit, [field]: value } : unit
      )
    )
  }

  const totalDiscountable = units.reduce(
    (total, unit) => total + Number(unit.discountable || 0),
    0
  )

  const totalNonDiscountable = units.reduce(
    (total, unit) => total + Number(unit.nonDiscountable || 0),
    0
  )

  return (
    <section
      style={{
        width: "100%",
        marginTop: "14px",
        background: "#fff",
        border: "1px solid #e2e5e8",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "13px 14px",
          borderBottom: "1px solid #e6e8ea",
        }}
      >
        <div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#2499ed" }}>
            Units
          </div>
          <div style={{ marginTop: "2px", fontSize: "9px", color: "#92999f" }}>
            {units.length === 0
              ? "Add individual window units for this appointment."
              : `${units.length} ${units.length === 1 ? "unit" : "units"}`}
          </div>
        </div>

        <button
          type="button"
          onClick={addUnit}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            height: "30px",
            padding: "0 13px",
            border: 0,
            borderRadius: "7px",
            background: "#2499ed",
            color: "#fff",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "10px",
            fontWeight: 700,
            boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
          }}
        >
          <span style={{ fontSize: "15px", lineHeight: 1 }}>+</span>
          Add Unit
        </button>
      </div>

      <div style={{ width: "100%", overflowX: "auto" }}>
        <div style={{ minWidth: "1050px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: grid,
              alignItems: "center",
              minHeight: "34px",
              padding: "0 12px",
              background: "#fafbfc",
              borderBottom: "1px solid #e5e7e9",
            }}
          >
            {columns.map(([key, label]) => (
              <div
                key={key}
                style={{
                  padding: "0 5px",
                  fontSize: "8px",
                  fontWeight: 700,
                  color: "#68717a",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </div>
            ))}
            <div />
          </div>

          {units.length === 0 && (
            <div
              style={{
                padding: "25px 20px",
                textAlign: "center",
                borderBottom: "1px solid #edf0f2",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#59636c" }}>
                No window units added
              </div>
              <div style={{ marginTop: "4px", fontSize: "9px", color: "#9aa1a7" }}>
                Click “Add Unit” to add the first window.
              </div>
            </div>
          )}

          {units.map((unit, index) => (
            <div
              key={unit.id}
              style={{
                display: "grid",
                gridTemplateColumns: grid,
                alignItems: "center",
                minHeight: "47px",
                padding: "0 12px",
                borderBottom:
                  index === units.length - 1 ? "none" : "1px solid #edf0f2",
              }}
            >
              <div style={cell}>
                <input
                  value={unit.location}
                  onChange={event => updateUnit(unit.id, "location", event.target.value)}
                  placeholder="Location"
                  style={input}
                />
              </div>
              <div style={cell}>
                <input
                  value={unit.unitType}
                  onChange={event => updateUnit(unit.id, "unitType", event.target.value)}
                  placeholder="Choice"
                  style={input}
                />
              </div>
              <div style={cell}>
                <input
                  value={unit.size}
                  onChange={event => updateUnit(unit.id, "size", event.target.value)}
                  placeholder="960 × 1440"
                  style={input}
                />
              </div>
              <div style={cell}>
                <span style={{ fontSize: "10px", color: "#333" }}>
                  {unit.product || "Window"}
                </span>
              </div>
              <div style={cell}>
                <input
                  value={unit.finish}
                  onChange={event => updateUnit(unit.id, "finish", event.target.value)}
                  placeholder="Choice"
                  style={input}
                />
              </div>
              <div style={{ ...cell, justifyContent: "center" }}>
                <span style={{ fontSize: "10px", color: "#333" }}>{unit.finishFactor || 0}</span>
              </div>
              <div style={{ ...cell, justifyContent: "center" }}>
                <span style={{ fontSize: "10px", color: "#333" }}>{unit.opener || 0}</span>
              </div>
              <div style={{ ...cell, justifyContent: "center" }}>
                <span style={{ fontSize: "10px", color: "#333" }}>{unit.counts || 1}</span>
              </div>
              <div style={cell}>
                <span style={{ fontSize: "10px", color: "#333" }}>
                  {money(unit.discountable)}
                </span>
              </div>
              <div style={cell}>
                <span style={{ fontSize: "10px", color: "#333" }}>
                  {money(unit.nonDiscountable)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  title="Remove unit"
                  onClick={() => removeUnit(unit.id)}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "#858c92",
                    cursor: "pointer",
                    fontSize: "15px",
                    lineHeight: 1,
                    padding: "4px",
                  }}
                >
                  ⋯
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {units.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "24px",
            padding: "11px 14px",
            background: "#fafbfc",
            borderTop: "1px solid #e5e7e9",
          }}
        >
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "8px", color: "#8b939a", fontWeight: 700 }}>
              DISCOUNTABLE
            </div>
            <div style={{ marginTop: "2px", fontSize: "12px", fontWeight: 700 }}>
              {money(totalDiscountable)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "8px", color: "#8b939a", fontWeight: 700 }}>
              NON DISCOUNTABLE
            </div>
            <div style={{ marginTop: "2px", fontSize: "12px", fontWeight: 700 }}>
              {money(totalNonDiscountable)}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

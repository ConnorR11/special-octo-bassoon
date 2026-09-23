import React, { useEffect, useMemo, useState } from "react"
import { supabase } from "./lib/supabase"

const EMPTY_FORM = {
  location: "",
  unitType: "",
  width: "",
  height: "",
  colour: "",
  shape: "",
  finish: "",
  glass: "",
  style: "",
  openers: 0,
  fixed: 0,
  handle: "",
  extras: "",
}

const inputStyle = {
  width: "100%",
  height: "38px",
  boxSizing: "border-box",
  border: "1px solid #d8dde1",
  borderRadius: "7px",
  background: "#fff",
  padding: "0 10px",
  fontFamily: "inherit",
  fontSize: "11px",
  color: "#222",
}

const selectStyle = {
  ...inputStyle,
  cursor: "pointer",
}

function normalise(value) {
  return String(value ?? "").trim().toLowerCase()
}

function Field({ label, required, children }) {
  return (
    <label style={{ display: "block" }}>
      <span
        style={{
          display: "block",
          marginBottom: "6px",
          fontSize: "10px",
          fontWeight: 700,
          color: "#59636c",
        }}
      >
        {label}
        {required && <span style={{ color: "#2499ed" }}> *</span>}
      </span>
      {children}
    </label>
  )
}

function getChoices(rows, categories, unitType) {
  const categorySet = new Set(categories.map(normalise))
  const selectedType = normalise(unitType)

  return Array.from(
    new Set(
      rows
        .filter((row) => {
          const category = normalise(row.category)
          const rowType = normalise(row.unit_type)

          if (!categorySet.has(category)) return false

          if (
            rowType &&
            selectedType &&
            rowType !== selectedType
          ) {
            return false
          }

          return true
        })
        .map((row) => String(row.choice ?? "").trim())
        .filter(Boolean)
    )
  )
}

function getChoiceRow(rows, categories, unitType, selectedChoice) {
  if (!selectedChoice) return null

  const categorySet = new Set(categories.map(normalise))
  const selectedType = normalise(unitType)
  const selected = normalise(selectedChoice)

  return (
    rows.find((row) => {
      const category = normalise(row.category)
      const rowType = normalise(row.unit_type)
      const choice = normalise(row.choice)

      if (!categorySet.has(category)) return false
      if (choice !== selected) return false

      if (
        rowType &&
        selectedType &&
        rowType !== selectedType
      ) {
        return false
      }

      return true
    }) || null
  )
}

function getSubmittedBy(user) {
  const metadataName = String(
    user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      ""
  ).trim()

  return metadataName || user?.email || user?.id || "Unknown"
}

function mapDatabaseUnit(row) {
  return {
    id: row.UUID,
    unitNumber: 0,
    location: row.location || "",
    unitType: row.unit_type || "",
    width: row.width ?? "",
    height: row.height ?? "",
    colour: row.colour_choice || "",
    shape: row.shape_choice || "",
    finish: row.finish_choice || "",
    glass: row.glass_choice || "",
    style: row.style_choice || "",
    openers: Number(row.openers_choice) || 0,
    fixed: Number(row.fixed_choice) || 0,
    handle: row.handle_choice || "",
    extras: row.extras_choice || "",
    discountable: row.discountable,
    netProductCost: row.net_product_cost,
  }
}

export default function WindowCosting({ appointment }) {
  const [units, setUnits] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [choices, setChoices] = useState([])
  const [loadingChoices, setLoadingChoices] = useState(false)
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [savingUnit, setSavingUnit] = useState(false)
  const [error, setError] = useState("")

  const isWindows = normalise(appointment?.job_type) === "windows"
  const appointmentId = appointment?.appointment_row_id

  useEffect(() => {
    if (!isWindows) return

    let cancelled = false

    async function loadChoices() {
      setLoadingChoices(true)
      setError("")

      const { data, error: fetchError } = await supabase
        .from("unit_choices")
        .select(
          "unit_type, category, charge_type, choice, value_type, value"
        )
        .order("unit_type", { ascending: true })
        .order("category", { ascending: true })
        .order("choice", { ascending: true })

      if (cancelled) return

      if (fetchError) {
        console.error("Unable to load unit choices:", fetchError)
        setError(fetchError.message || "Unable to load window choices.")
        setChoices([])
      } else {
        setChoices(data || [])
      }

      setLoadingChoices(false)
    }

    loadChoices()

    return () => {
      cancelled = true
    }
  }, [isWindows])

  useEffect(() => {
    if (!isWindows || !appointmentId) return

    let cancelled = false

    async function loadUnits() {
      setLoadingUnits(true)

      const { data, error: fetchError } = await supabase
        .from("units")
        .select("*")
        .eq("appointment_id", String(appointmentId))
        .order("created_date", { ascending: true })

      if (cancelled) return

      if (fetchError) {
        console.error("Unable to load units:", fetchError)
        setError(fetchError.message || "Unable to load saved units.")
        setUnits([])
      } else {
        const mapped = (data || []).map(mapDatabaseUnit).map((unit, index) => ({
          ...unit,
          unitNumber: index + 1,
        }))
        setUnits(mapped)
      }

      setLoadingUnits(false)
    }

    loadUnits()

    return () => {
      cancelled = true
    }
  }, [isWindows, appointmentId])

  const typeOptions = useMemo(() => {
    return Array.from(
      new Set(
        choices
          .map((row) => String(row.unit_type ?? "").trim())
          .filter(Boolean)
      )
    )
  }, [choices])

  const options = useMemo(() => {
    return {
      colour: getChoices(choices, ["colour"], form.unitType),
      shape: getChoices(choices, ["shape"], form.unitType),
      finish: getChoices(choices, ["finish"], form.unitType),
      glass: getChoices(choices, ["glass", "glass optionals"], form.unitType),
      style: getChoices(choices, ["style"], form.unitType),
      handle: getChoices(choices, ["handle"], form.unitType),
      extras: getChoices(choices, ["extras"], form.unitType),
    }
  }, [choices, form.unitType])

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
    setError("")
  }

  function openForm() {
    setForm({
      ...EMPTY_FORM,
      unitType: typeOptions[0] || "",
    })
    setError("")
    setShowForm(true)
  }

  function closeForm() {
    if (savingUnit) return

    setShowForm(false)
    setForm({ ...EMPTY_FORM })
    setError("")
  }

  async function addUnit(event) {
    event.preventDefault()

    if (!appointmentId) {
      setError("This appointment does not have an appointment ID.")
      return
    }

    if (!form.location.trim()) {
      setError("Please enter a location.")
      return
    }

    if (!form.unitType) {
      setError("Please select a type.")
      return
    }

    if (!form.width || !form.height) {
      setError("Please enter the width and height.")
      return
    }

    setSavingUnit(true)
    setError("")

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser()

      if (userError) throw userError

      const createdBy = getSubmittedBy(userData?.user)
      const now = new Date().toISOString()
      const width = Number(form.width)
      const height = Number(form.height)
      const openers = Number(form.openers) || 0
      const fixed = Number(form.fixed) || 0

      const colourRow = getChoiceRow(
        choices,
        ["colour"],
        form.unitType,
        form.colour
      )
      const shapeRow = getChoiceRow(
        choices,
        ["shape"],
        form.unitType,
        form.shape
      )
      const finishRow = getChoiceRow(
        choices,
        ["finish"],
        form.unitType,
        form.finish
      )
      const glassRow = getChoiceRow(
        choices,
        ["glass", "glass optionals"],
        form.unitType,
        form.glass
      )
      const styleRow = getChoiceRow(
        choices,
        ["style"],
        form.unitType,
        form.style
      )
      const handleRow = getChoiceRow(
        choices,
        ["handle"],
        form.unitType,
        form.handle
      )
      const extrasRow = getChoiceRow(
        choices,
        ["extras"],
        form.unitType,
        form.extras
      )

      const unitToInsert = {
        appointment_id: String(appointmentId),
        location: form.location.trim(),
        created_by: createdBy,
        created_date: now,
        unit_type: form.unitType,
        size_choice: `${width} x ${height}`,
        height,
        width,
        colour_choice: form.colour || null,
        colour_value: colourRow?.value ?? null,
        shape_choice: form.shape || null,
        shape_value: shapeRow?.value ?? null,
        finish_choice: form.finish || null,
        finish_value: finishRow?.value ?? null,
        style_choice: form.style || null,
        style_value: styleRow?.value ?? null,
        glass_choice: form.glass || null,
        glass_value: glassRow?.value ?? null,
        handle_choice: form.handle || null,
        handle_value: handleRow?.value ?? null,
        fixed_choice: form.unitType === "" ? null : String(fixed),
        openers_choice: form.unitType === "" ? null : String(openers),
        extras_choice: form.extras || null,
        extras_value: extrasRow?.value ?? null,
      }

      const { data, error: insertError } = await supabase
        .from("units")
        .insert(unitToInsert)
        .select("*")
        .single()

      if (insertError) throw insertError

      const savedUnit = {
        ...mapDatabaseUnit(data),
        unitNumber: units.length + 1,
      }

      setUnits((current) => [...current, savedUnit])
      setShowForm(false)
      setForm({ ...EMPTY_FORM })
    } catch (err) {
      console.error("Unable to save unit:", err)
      setError(err?.message || "Unable to save the unit.")
    } finally {
      setSavingUnit(false)
    }
  }

  async function removeUnit(id) {
    setError("")

    const unit = units.find((item) => item.id === id)
    if (!unit) return

    const { error: deleteError } = await supabase
      .from("units")
      .delete()
      .eq("UUID", id)

    if (deleteError) {
      console.error("Unable to delete unit:", deleteError)
      setError(deleteError.message || "Unable to delete the unit.")
      return
    }

    setUnits((current) =>
      current
        .filter((item) => item.id !== id)
        .map((item, index) => ({
          ...item,
          unitNumber: index + 1,
        }))
    )
  }

  if (!isWindows) return null

  const renderSelect = (field, label, optionsList) => {
    if (loadingChoices || !optionsList || optionsList.length === 0) {
      return null
    }

    return (
      <Field label={label}>
        <select
          value={form[field]}
          onChange={(event) => updateForm(field, event.target.value)}
          style={{
            ...selectStyle,
            color: form[field] ? "#222" : "#777",
          }}
        >
          <option value="">Select {label.toLowerCase()}...</option>
          {optionsList.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </Field>
    )
  }

  return (
    <section style={{ width: "100%", marginTop: "24px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#222" }}>
            Windows
          </h2>
          <p style={{ margin: "5px 0 0", fontSize: "11px", color: "#888" }}>
            Add and configure individual window units.
          </p>
        </div>

        <button
          type="button"
          onClick={openForm}
          style={{
            height: "34px",
            padding: "0 14px",
            border: 0,
            borderRadius: "7px",
            background: "#2499ed",
            color: "#fff",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "10px",
            fontWeight: 700,
          }}
        >
          + Add Unit
        </button>
      </div>

      {error && !showForm && (
        <div
          style={{
            marginBottom: "10px",
            padding: "9px 10px",
            borderRadius: "6px",
            background: "#fbeaea",
            color: "#8b3333",
            fontSize: "10px",
          }}
        >
          {error}
        </div>
      )}

      {loadingUnits ? (
        <div
          style={{
            padding: "24px",
            border: "1px dashed #d8dde1",
            borderRadius: "8px",
            background: "#fafbfc",
            textAlign: "center",
            fontSize: "10px",
            color: "#888",
          }}
        >
          Loading saved units...
        </div>
      ) : units.length === 0 ? (
        <div
          style={{
            padding: "24px",
            border: "1px dashed #d8dde1",
            borderRadius: "8px",
            background: "#fafbfc",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#555" }}>
            No window units added
          </div>
          <div style={{ marginTop: "4px", fontSize: "10px", color: "#999" }}>
            Click “Add Unit” to add the first window.
          </div>
        </div>
      ) : (
        <div
          style={{
            border: "1px solid #e2e5e8",
            borderRadius: "8px",
            background: "#fff",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr .9fr 1fr 1fr .9fr .45fr .45fr .8fr .9fr 32px",
              gap: "10px",
              alignItems: "center",
              padding: "10px 12px",
              borderBottom: "1px solid #e5e7e9",
              background: "#fafbfc",
              fontSize: "8px",
              fontWeight: 700,
              color: "#6d757c",
              textTransform: "uppercase",
            }}
          >
            <span>Location</span>
            <span>Type</span>
            <span>Size</span>
            <span>Style</span>
            <span>Colour</span>
            <span>F</span>
            <span>O</span>
            <span>Discountable</span>
            <span>Price</span>
            <span />
          </div>

          {units.map((unit) => (
            <div
              key={unit.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr .9fr 1fr 1fr .9fr .45fr .45fr .8fr .9fr 32px",
                gap: "10px",
                alignItems: "center",
                padding: "11px 12px",
                borderBottom: "1px solid #eef0f2",
                fontSize: "10px",
                color: "#333",
              }}
            >
              <strong>{unit.location}</strong>
              <span>{unit.unitType || "—"}</span>
              <span>{unit.width} × {unit.height}</span>
              <span>{unit.style || "—"}</span>
              <span>{unit.colour || "—"}</span>
              <span>{unit.fixed}</span>
              <span>{unit.openers}</span>
              <span>{unit.discountable ?? "—"}</span>
              <strong>
                {unit.netProductCost != null
                  ? `£${Number(unit.netProductCost).toFixed(2)}`
                  : "—"}
              </strong>
              <button
                type="button"
                onClick={() => removeUnit(unit.id)}
                title="Remove unit"
                style={{
                  border: 0,
                  background: "transparent",
                  color: "#888",
                  cursor: "pointer",
                  fontSize: "14px",
                  padding: 0,
                }}
              >
                ⋯
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <form
            onSubmit={addUnit}
            style={{
              width: "680px",
              maxWidth: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: "10px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "17px 20px",
                borderBottom: "1px solid #e6e8ea",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "15px", color: "#222" }}>
                  Add Window Unit
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "10px", color: "#888" }}>
                  Enter the details for this individual unit.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={savingUnit}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "#777",
                  cursor: savingUnit ? "default" : "pointer",
                  fontSize: "20px",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: "20px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "15px",
                }}
              >
                <Field label="Location" required>
                  <input
                    value={form.location}
                    onChange={(event) => updateForm("location", event.target.value)}
                    placeholder="e.g. Living room"
                    style={inputStyle}
                    autoFocus
                  />
                </Field>

                <Field label="Type" required>
                  <select
                    value={form.unitType}
                    onChange={(event) => {
                      updateForm("unitType", event.target.value)
                      setForm((current) => ({
                        ...current,
                        unitType: event.target.value,
                        colour: "",
                        shape: "",
                        finish: "",
                        glass: "",
                        style: "",
                        handle: "",
                        extras: "",
                      }))
                    }}
                    style={selectStyle}
                    disabled={loadingChoices || typeOptions.length === 0}
                  >
                    <option value="">
                      {loadingChoices
                        ? "Loading..."
                        : typeOptions.length === 0
                        ? "No types available"
                        : "Select type..."}
                    </option>
                    {typeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Width (mm)" required>
                  <input
                    type="number"
                    min="1"
                    value={form.width}
                    onChange={(event) => updateForm("width", event.target.value)}
                    placeholder="e.g. 960"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Height (mm)" required>
                  <input
                    type="number"
                    min="1"
                    value={form.height}
                    onChange={(event) => updateForm("height", event.target.value)}
                    placeholder="e.g. 1440"
                    style={inputStyle}
                  />
                </Field>
              </div>

              <div
                style={{
                  width: "100%",
                  height: "2px",
                  background: "#2499ed",
                  opacity: 0.35,
                  margin: "22px 0",
                  borderRadius: "2px",
                }}
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "15px",
                }}
              >
                {renderSelect("colour", "Colour", options.colour)}
                {renderSelect("shape", "Shape", options.shape)}
                {renderSelect("finish", "Finish", options.finish)}
                {renderSelect("glass", "Glass", options.glass)}
                {renderSelect("style", "Style", options.style)}

                {normalise(form.unitType) === "window" && (
                  <>
                    <Field label="Number of Openers">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={form.openers}
                        onChange={(event) => updateForm("openers", event.target.value)}
                        style={inputStyle}
                      />
                    </Field>

                    <Field label="Number of Fixed">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={form.fixed}
                        onChange={(event) => updateForm("fixed", event.target.value)}
                        style={inputStyle}
                      />
                    </Field>
                  </>
                )}

                {renderSelect("handle", "Handle", options.handle)}
                {renderSelect("extras", "Extras", options.extras)}
              </div>

              {loadingChoices && (
                <div style={{ marginTop: "14px", fontSize: "10px", color: "#888" }}>
                  Loading window choices...
                </div>
              )}

              {savingUnit && (
                <div style={{ marginTop: "14px", fontSize: "10px", color: "#2499ed" }}>
                  Saving unit...
                </div>
              )}

              {error && (
                <div
                  style={{
                    marginTop: "14px",
                    padding: "9px 10px",
                    borderRadius: "6px",
                    background: "#fbeaea",
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
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                padding: "13px 20px",
                borderTop: "1px solid #e6e8ea",
                background: "#fafbfc",
              }}
            >
              <button
                type="button"
                onClick={closeForm}
                disabled={savingUnit}
                style={{
                  height: "34px",
                  padding: "0 13px",
                  border: "1px solid #d8dde1",
                  borderRadius: "6px",
                  background: "#fff",
                  color: "#555",
                  cursor: savingUnit ? "default" : "pointer",
                  fontFamily: "inherit",
                  fontSize: "10px",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={savingUnit}
                style={{
                  height: "34px",
                  padding: "0 15px",
                  border: 0,
                  borderRadius: "6px",
                  background: savingUnit ? "#9acff5" : "#2499ed",
                  color: "#fff",
                  cursor: savingUnit ? "default" : "pointer",
                  fontFamily: "inherit",
                  fontSize: "10px",
                  fontWeight: 700,
                }}
              >
                {savingUnit ? "Saving..." : "Add Unit"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

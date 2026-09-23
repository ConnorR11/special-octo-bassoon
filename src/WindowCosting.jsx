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
  height: "36px",
  padding: "0 10px",
  border: "1px solid #d8dde1",
  borderRadius: "6px",
  background: "#fff",
  color: "#222",
  fontFamily: "inherit",
  fontSize: "11px",
  boxSizing: "border-box",
  outline: "none",
}

const selectStyle = {
  width: "100%",
  height: "36px",
  padding: "0 10px",
  border: "1px solid #d8dde1",
  borderRadius: "6px",
  background: "#fff",
  color: "#222",
  fontFamily: "inherit",
  fontSize: "11px",
  boxSizing: "border-box",
  outline: "none",
}

const SIZE_MATRIX_DIMENSIONS = [
  500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400,
  1500, 1600, 1700, 1800, 1900, 2000, 2250, 2500, 2750, 3000, 3250,
]

const SIZE_MATRIX = {
  500: ["A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "B"],
  600: ["A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "B", "B", "B"],
  700: ["A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "B", "B", "B", "B", "B", "B", "B", "B"],
  800: ["A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "B", "B", "B", "B", "B", "B", "B", "C"],
  900: ["A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "B", "B", "B", "B", "B", "B", "B", "B", "B", "C", "C"],
  1000: ["A", "A", "A", "A", "A", "B", "B", "B", "B", "B", "B", "B", "B", "B", "B", "B", "B", "C", "C", "C"],
  1100: ["A", "A", "A", "A", "A", "B", "B", "B", "B", "B", "B", "B", "B", "B", "B", "B", "B", "C", "C", "C"],
  1200: ["A", "A", "A", "A", "A", "B", "B", "B", "B", "B", "B", "B", "B", "B", "B", "C", "C", "C", "C", "D"],
  1300: ["A", "A", "A", "A", "A", "B", "B", "B", "B", "B", "B", "B", "B", "C", "C", "C", "C", "C", "C", "C", "D"],
  1400: ["A", "A", "A", "A", "A", "B", "B", "B", "B", "B", "C", "C", "C", "C", "C", "C", "C", "C", "C", "C", "D"],
  1500: ["A", "A", "A", "A", "B", "B", "B", "B", "B", "C", "C", "C", "C", "C", "C", "C", "D", "D", "D", "D"],
  1600: ["A", "A", "A", "A", "B", "B", "B", "B", "B", "C", "C", "C", "C", "C", "C", "D", "D", "D", "D", "D", "E"],
  1700: ["A", "A", "A", "B", "B", "B", "B", "B", "B", "C", "C", "C", "C", "C", "C", "D", "D", "D", "D", "D", "E"],
  1800: ["A", "A", "A", "B", "B", "B", "B", "B", "C", "C", "C", "C", "C", "C", "D", "D", "D", "D", "D", "E", "E"],
  1900: ["A", "A", "A", "B", "B", "B", "B", "B", "C", "C", "C", "C", "D", "D", "D", "D", "D", "E", "E", "E", "E"],
  2000: ["A", "A", "A", "B", "B", "B", "B", "C", "C", "C", "C", "D", "D", "D", "D", "D", "E", "E", "E", "E", "F"],
  2250: ["A", "A", "B", "B", "B", "B", "B", "C", "C", "C", "C", "D", "D", "D", "D", "E", "E", "E", "E", "F", "F"],
  2500: ["A", "B", "B", "B", "B", "B", "C", "C", "C", "C", "D", "D", "D", "D", "D", "E", "E", "F", "G", "G", "G"],
  2750: ["A", "B", "B", "B", "B", "C", "C", "C", "C", "D", "D", "D", "D", "D", "D", "E", "E", "E", "F", "G", "G"],
  3000: ["B", "B", "B", "B", "C", "C", "C", "C", "C", "D", "D", "D", "D", "E", "E", "E", "F", "F", "G", "H", "H"],
  3250: ["B", "B", "B", "C", "C", "C", "C", "D", "D", "D", "D", "D", "E", "E", "E", "F", "F", "G", "G", "H", "H"],
}

function roundUpToMatrixSize(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null
  return SIZE_MATRIX_DIMENSIONS.find((dimension) => numericValue <= dimension) || null
}

function getSizeChoice(width, height) {
  const roundedWidth = roundUpToMatrixSize(width)
  const roundedHeight = roundUpToMatrixSize(height)
  if (!roundedWidth || !roundedHeight) return null
  const row = SIZE_MATRIX[roundedHeight]
  if (!row) return null
  const columnIndex = SIZE_MATRIX_DIMENSIONS.indexOf(roundedWidth)
  if (columnIndex === -1) return null
  return { choice: row[columnIndex], roundedWidth, roundedHeight }
}

function normalise(value) {
  return String(value ?? "").trim().toLowerCase()
}

function Field({ label, required, children }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", marginBottom: "6px", fontSize: "10px", fontWeight: 700, color: "#59636c" }}>
        {label}{required && <span style={{ color: "#2499ed" }}> *</span>}
      </span>
      {children}
    </label>
  )
}

function getChoices(rows, categories, unitType) {
  const categorySet = new Set(categories.map(normalise))
  const selectedType = normalise(unitType)
  const filtered = rows.filter((row) => {
    const category = normalise(row.category)
    const rowType = normalise(row.unit_type)
    if (!categorySet.has(category)) return false
    if (rowType && selectedType && rowType !== selectedType) return false
    return true
  })
  return Array.from(new Set(filtered.map((row) => String(row.choice ?? "").trim()).filter(Boolean)))
}

function getSizeValue(rows, sizeChoice, unitType) {
  if (!sizeChoice) return null
  const selectedType = normalise(unitType)
  const sizeRows = rows.filter((row) => {
    const category = normalise(row.category)
    const choice = normalise(row.choice)
    const rowType = normalise(row.unit_type)
    const isSizeCategory = category === "size" || category === "size choice" || category === "size_choice"
    if (!isSizeCategory) return false
    if (choice !== normalise(sizeChoice)) return false
    if (rowType && selectedType && rowType !== selectedType) return false
    return true
  })
  if (!sizeRows.length) return null
  const value = Number(sizeRows[0].value)
  return Number.isFinite(value) ? value : null
}

function getChoiceValue(rows, category, choice, unitType) {
  if (!choice) return 0
  const selectedType = normalise(unitType)
  const selectedCategory = normalise(category)
  const selectedChoice = normalise(choice)
  const matchingRows = rows.filter((row) => {
    const rowCategory = normalise(row.category)
    const rowChoice = normalise(row.choice)
    const rowType = normalise(row.unit_type)
    if (rowCategory !== selectedCategory) return false
    if (rowChoice !== selectedChoice) return false
    if (rowType && selectedType && rowType !== selectedType) return false
    return true
  })
  if (!matchingRows.length) return 0
  const value = Number(matchingRows[0].value)
  return Number.isFinite(value) ? value : 0
}

function calculateUnitValues({ choices, unitType, sizeValue, colour, shape, finish, style, glass, extras, openers, fixed }) {
  if (unitType !== "Window") {
    return { colourValue: 0, shapeValue: 0, finishValue: 0, styleValue: 0, glassValue: 0, extrasValue: 0, fixOpenersValue: 0, discountable: null }
  }

  const size = Number(sizeValue) || 0
  const colourValue = getChoiceValue(choices, "colour", colour, unitType)
  const shapeValue = getChoiceValue(choices, "shape", shape, unitType)
  const finishValue = getChoiceValue(choices, "finish", finish, unitType)
  const styleValue = getChoiceValue(choices, "style", style, unitType)
  const glassValue = getChoiceValue(choices, "glass", glass, unitType)
  const extrasValue = getChoiceValue(choices, "extras", extras, unitType)
  const openerValue = Number(openers) || 0
  const fixedValue = Number(fixed) || 0
  const x = !style || normalise(style) === "fixed unit" ? 0 : 250
  const fixOpenersValue = openerValue * 360 + (fixedValue - 1) * 110 - x
  const discountable = (size + finishValue + styleValue + fixOpenersValue + extrasValue) * colourValue * shapeValue + glassValue

  return {
    colourValue: Number.isFinite(colourValue) ? Math.round(colourValue * 100) / 100 : 0,
    shapeValue: Number.isFinite(shapeValue) ? Math.round(shapeValue * 100) / 100 : 0,
    finishValue: Number.isFinite(finishValue) ? Math.round(finishValue * 100) / 100 : 0,
    styleValue: Number.isFinite(styleValue) ? Math.round(styleValue * 100) / 100 : 0,
    glassValue: Number.isFinite(glassValue) ? Math.round(glassValue * 100) / 100 : 0,
    extrasValue: Number.isFinite(extrasValue) ? Math.round(extrasValue * 100) / 100 : 0,
    fixOpenersValue: Number.isFinite(fixOpenersValue) ? Math.round(fixOpenersValue * 100) / 100 : 0,
    discountable: Number.isFinite(discountable) ? Math.round(discountable * 100) / 100 : 0,
  }
}

function mapDatabaseUnit(row, index) {
  return {
    id: row.UUID,
    unitNumber: index + 1,
    location: row.location ?? "",
    unitType: row.unit_type ?? "",
    width: Number(row.width) || 0,
    height: Number(row.height) || 0,
    sizeChoice: row.size_choice ?? null,
    sizeValue: row.size_value !== null && row.size_value !== undefined ? Number(row.size_value) : null,
    colour: row.colour_choice ?? "",
    shape: row.shape_choice ?? "",
    finish: row.finish_choice ?? "",
    glass: row.glass_choice ?? "",
    style: row.style_choice ?? "",
    openers: Number(row.openers_choice) || 0,
    fixed: Number(row.fixed_choice) || 0,
    handle: row.handle_choice ?? "",
    extras: row.extras_choice ?? "",
    createdBy: row.created_by ?? null,
    colourValue: row.colour_value !== null && row.colour_value !== undefined ? Number(row.colour_value) : null,
    shapeValue: row.shape_value !== null && row.shape_value !== undefined ? Number(row.shape_value) : null,
    finishValue: row.finish_value !== null && row.finish_value !== undefined ? Number(row.finish_value) : null,
    styleValue: row.style_value !== null && row.style_value !== undefined ? Number(row.style_value) : null,
    glassValue: row.glass_value !== null && row.glass_value !== undefined ? Number(row.glass_value) : null,
    fixOpenersValue: row.fix_openers_value !== null && row.fix_openers_value !== undefined ? Number(row.fix_openers_value) : null,
    discountable: row.discountable !== null && row.discountable !== undefined ? Number(row.discountable) : null,
    nonDiscountable: row.non_discountable !== null && row.non_discountable !== undefined ? Number(row.non_discountable) : null,
  }
}

export default function WindowCosting({ appointment }) {
  const [units, setUnits] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [choices, setChoices] = useState([])
  const [loadingChoices, setLoadingChoices] = useState(false)
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const isWindows = normalise(appointment?.job_type) === "windows"
  const appointmentId = appointment?.appointment_row_id ?? appointment?.appointment_id ?? appointment?.id

  useEffect(() => {
    if (!isWindows) {
      setChoices([])
      return
    }
    let cancelled = false
    async function loadChoices() {
      setLoadingChoices(true)
      setError("")
      const { data, error: fetchError } = await supabase.from("unit_choices").select("unit_type, category, charge_type, choice, value_type, value").order("category", { ascending: true }).order("choice", { ascending: true })
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
    return () => { cancelled = true }
  }, [isWindows])

  useEffect(() => {
    if (!isWindows || !appointmentId) {
      setUnits([])
      return
    }
    let cancelled = false
    async function loadUnits() {
      setLoadingUnits(true)
      setError("")
      const { data, error: fetchError } = await supabase.from("units").select("*").eq("appointment_id", String(appointmentId)).order("created_date", { ascending: true })
      if (cancelled) return
      if (fetchError) {
        console.error("Unable to load units:", fetchError)
        setError(fetchError.message || "Unable to load window units.")
        setUnits([])
      } else {
        setUnits((data || []).map((row, index) => mapDatabaseUnit(row, index)))
      }
      setLoadingUnits(false)
    }
    loadUnits()
    return () => { cancelled = true }
  }, [isWindows, appointmentId])

  const typeOptions = useMemo(() => Array.from(new Set(choices.map((row) => String(row.unit_type ?? "").trim()).filter(Boolean))), [choices])

  const options = useMemo(() => ({
    colour: getChoices(choices, ["colour"], form.unitType),
    shape: getChoices(choices, ["shape"], form.unitType),
    finish: getChoices(choices, ["finish"], form.unitType),
    glass: getChoices(choices, ["glass", "glass optionals"], form.unitType),
    style: getChoices(choices, ["style"], form.unitType),
    handle: getChoices(choices, ["handle"], form.unitType),
    extras: getChoices(choices, ["extras"], form.unitType),
  }), [choices, form.unitType])

  const calculatedSize = useMemo(() => {
    if (form.unitType !== "Window") return null
    return getSizeChoice(form.width, form.height)
  }, [form.width, form.height, form.unitType])

  const calculatedSizeValue = useMemo(() => {
    if (form.unitType !== "Window" || !calculatedSize) return null
    return getSizeValue(choices, calculatedSize.choice, form.unitType)
  }, [choices, calculatedSize, form.unitType])

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setError("")
  }

  function openForm() {
    setForm({ ...EMPTY_FORM, unitType: typeOptions[0] || "" })
    setError("")
    setShowForm(true)
  }

  function closeForm() {
    if (saving) return
    setShowForm(false)
    setForm({ ...EMPTY_FORM })
    setError("")
  }

  async function addUnit(event) {
    event.preventDefault()
    if (saving) return
    if (!form.location.trim()) return setError("Please enter a location.")
    if (!form.unitType) return setError("Please select a type.")
    if (!form.width || !form.height) return setError("Please enter the width and height.")

    if (form.unitType === "Window") {
      if (!calculatedSize) return setError("The entered dimensions are outside the available size matrix. Maximum size is 3250mm.")
      if (calculatedSizeValue === null) {
        setError("No Size value was found in unit_choices for Size Choice " + calculatedSize.choice + " and type " + form.unitType + ".")
        return
      }
    }

    if (!appointmentId) return setError("Unable to save the unit because no appointment ID was found.")

    setSaving(true)
    setError("")

    try {
      const unitId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) console.error("Unable to get current user:", authError)
      const createdByEmail = user?.email || null

      const calculatedValues = calculateUnitValues({
        choices,
        unitType: form.unitType,
        sizeValue: calculatedSizeValue,
        colour: form.colour,
        shape: form.shape,
        finish: form.finish,
        style: form.style,
        glass: form.glass,
        extras: form.extras,
        openers: form.openers,
        fixed: form.fixed,
      })

      const insertData = {
        ...(unitId ? { UUID: unitId } : {}),
        appointment_id: String(appointmentId),
        location: form.location.trim(),
        created_date: new Date().toISOString(),
        created_by: createdByEmail,
        unit_type: form.unitType,
        size_choice: form.unitType === "Window" ? calculatedSize?.choice || null : null,
        height: Number(form.height),
        width: Number(form.width),
        size_value: form.unitType === "Window" && calculatedSizeValue !== null ? Math.round(calculatedSizeValue) : null,
        colour_choice: form.colour || null,
        shape_choice: form.shape || null,
        finish_choice: form.finish || null,
        style_choice: form.style || null,
        glass_choice: form.glass || null,
        handle_choice: form.handle || null,
        fixed_choice: form.unitType === "Window" ? String(Number(form.fixed) || 0) : null,
        openers_choice: form.unitType === "Window" ? String(Number(form.openers) || 0) : null,
        extras_choice: form.extras || null,
        colour_value: calculatedValues.colourValue,
        shape_value: calculatedValues.shapeValue,
        finish_value: calculatedValues.finishValue,
        style_value: calculatedValues.styleValue,
        glass_value: calculatedValues.glassValue,
        fix_openers_value: calculatedValues.fixOpenersValue,
        discountable: calculatedValues.discountable,
      }

      const { data: savedUnit, error: insertError } = await supabase.from("units").insert(insertData).select("*").single()
      if (insertError) throw new Error(insertError.message || "Unable to save unit.")

      setUnits((current) => [...current, mapDatabaseUnit(savedUnit, current.length)])
      closeForm()
    } catch (err) {
      console.error("Error saving unit:", err)
      setError(err?.message || "Unable to save unit.")
    } finally {
      setSaving(false)
    }
  }

  async function removeUnit(unit) {
    if (!unit) return
    if (!window.confirm("Remove this unit?")) return
    if (unit.id) {
      const { error: deleteError } = await supabase.from("units").delete().eq("UUID", unit.id)
      if (deleteError) {
        setError(deleteError.message || "Unable to delete unit.")
        return
      }
    }
    setUnits((current) => current.filter((item) => item.id !== unit.id).map((item, index) => ({ ...item, unitNumber: index + 1 })))
  }

  const renderSelect = (field, label, optionsList) => {
    if (!optionsList || optionsList.length === 0) return null
    return (
      <Field label={label}>
        <select value={form[field]} onChange={(event) => updateForm(field, event.target.value)} style={{ ...selectStyle, color: form[field] ? "#222" : "#777" }} disabled={loadingChoices}>
          <option value="">Select {label.toLowerCase()}...</option>
          {optionsList.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </Field>
    )
  }

  if (!isWindows) return null

  return (
    <section style={{ width: "100%", marginTop: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#222" }}>Windows</h2>
          <p style={{ margin: "5px 0 0", fontSize: "11px", color: "#888" }}>Add and configure individual window units.</p>
        </div>
        <button type="button" onClick={openForm} style={{ height: "34px", padding: "0 14px", border: 0, borderRadius: "7px", background: "#2499ed", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: "10px", fontWeight: 700 }}>+ Add Unit</button>
      </div>

      {error && !showForm && <div style={{ marginBottom: "10px", padding: "9px 10px", borderRadius: "6px", background: "#fbeaea", color: "#8b3333", fontSize: "10px" }}>{error}</div>}

      {loadingUnits ? (
        <div style={{ padding: "24px", border: "1px dashed #d8dde1", borderRadius: "8px", background: "#fafbfc", textAlign: "center", fontSize: "10px", color: "#888" }}>Loading window units...</div>
      ) : units.length === 0 ? (
        <div style={{ padding: "24px", border: "1px dashed #d8dde1", borderRadius: "8px", background: "#fafbfc", textAlign: "center" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#555" }}>No window units added</div>
          <div style={{ marginTop: "4px", fontSize: "10px", color: "#999" }}>Click “Add Unit” to add the first window.</div>
        </div>
      ) : (
        <div style={{ border: "1px solid #e2e5e8", borderRadius: "8px", background: "#fff", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr .9fr 1fr 1fr .9fr .45fr .45fr .8fr .9fr .9fr 32px", gap: "10px", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid #e5e7e9", background: "#fafbfc", fontSize: "8px", fontWeight: 700, color: "#6d757c", textTransform: "uppercase" }}>
            <span>Location</span><span>Type</span><span>Size</span><span>Style</span><span>Colour</span><span>F</span><span>O</span><span>Size Choice</span><span>Discountable</span><span>NonDiscountable</span><span />
          </div>

          {units.map((unit) => (
            <div key={unit.id} style={{ display: "grid", gridTemplateColumns: "1.2fr .9fr 1fr 1fr .9fr .45fr .45fr .8fr .9fr .9fr 32px", gap: "10px", alignItems: "center", padding: "11px 12px", borderBottom: "1px solid #eef0f2", fontSize: "10px", color: "#333" }}>
              <strong>{unit.location}</strong>
              <span>{unit.unitType || "—"}</span>
              <span>{unit.width} × {unit.height}</span>
              <span>{unit.style || "—"}</span>
              <span>{unit.colour || "—"}</span>
              <span>{unit.fixed ?? 0}</span>
              <span>{unit.openers ?? 0}</span>
              <span>{unit.sizeChoice || "—"}</span>
              <strong>{unit.discountable !== null && unit.discountable !== undefined ? unit.discountable.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</strong>
              <strong>{unit.nonDiscountable !== null && unit.nonDiscountable !== undefined ? unit.nonDiscountable.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</strong>
              <button type="button" onClick={() => removeUnit(unit)} title="Remove unit" style={{ border: 0, background: "transparent", color: "#888", cursor: "pointer", fontSize: "14px", padding: 0 }}>⋯</button>
            </div>
          ))}

          {/* TOTALS ROW - DISCOUNTABLE */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr .9fr 1fr 1fr .9fr .45fr .45fr .8fr .9fr .9fr 32px", gap: "10px", alignItems: "center", padding: "12px 12px", background: "#f4f7f9", borderTop: "2px solid #e2e5e8", fontSize: "10px", fontWeight: 700, color: "#222" }}>
            <span style={{ gridColumn: "1 / span 8" }}>Total</span>
            <strong>
              {units.reduce((total, unit) => total + (Number(unit.discountable) || 0), 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
            <strong>
              {units.reduce((total, unit) => total + (Number(unit.nonDiscountable) || 0), 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
            <span />
          </div>
        </div>
      )}

      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <form onSubmit={addUnit} style={{ width: "680px", maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: "10px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "17px 20px", borderBottom: "1px solid #e6e8ea" }}>
              <div><h3 style={{ margin: 0, fontSize: "15px", color: "#222" }}>Add Window Unit</h3><p style={{ margin: "4px 0 0", fontSize: "10px", color: "#888" }}>Enter the details for this individual unit.</p></div>
              <button type="button" onClick={closeForm} disabled={saving} style={{ border: 0, background: "transparent", color: "#777", cursor: saving ? "default" : "pointer", fontSize: "20px", lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "15px" }}>
                <Field label="Location" required><input value={form.location} onChange={(event) => updateForm("location", event.target.value)} placeholder="e.g. Living room" style={inputStyle} autoFocus /></Field>
                {typeOptions.length > 0 && <Field label="Type" required><select value={form.unitType} onChange={(event) => updateForm("unitType", event.target.value)} style={selectStyle} disabled={loadingChoices}><option value="">Select type...</option>{typeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>}
                <Field label="Width (mm)" required><input type="number" min="1" value={form.width} onChange={(event) => updateForm("width", event.target.value)} placeholder="e.g. 960" style={inputStyle} /></Field>
                <Field label="Height (mm)" required><input type="number" min="1" value={form.height} onChange={(event) => updateForm("height", event.target.value)} placeholder="e.g. 1440" style={inputStyle} /></Field>
              </div>

              <div style={{ height: "2px", background: "#2499ed", opacity: 0.25, margin: "22px 0", borderRadius: "2px" }} />

              {form.unitType === "Window" && calculatedSize && (
                <div style={{ marginBottom: "15px", padding: "10px 12px", border: "1px solid #dfe5ea", borderRadius: "7px", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div><div style={{ fontSize: "10px", fontWeight: 700, color: "#59636c" }}>Size Choice</div><div style={{ marginTop: "3px", fontSize: "9px", color: "#89939c" }}>Rounded up to {calculatedSize.roundedWidth} × {calculatedSize.roundedHeight} mm</div></div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#2499ed" }}>{calculatedSize.choice}</div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "15px" }}>
                {renderSelect("colour", "Colour", options.colour)}
                {renderSelect("shape", "Shape", options.shape)}
                {renderSelect("finish", "Finish", options.finish)}
                {renderSelect("glass", "Glass", options.glass)}
                {renderSelect("style", "Style", options.style)}
                {form.unitType === "Window" && <Field label="Number of Openers"><input type="number" min="0" step="1" value={form.openers} onChange={(event) => updateForm("openers", event.target.value)} style={inputStyle} /></Field>}
                {form.unitType === "Window" && <Field label="Number of Fixed"><input type="number" min="0" step="1" value={form.fixed} onChange={(event) => updateForm("fixed", event.target.value)} style={inputStyle} /></Field>}
                {renderSelect("handle", "Handle", options.handle)}
                {renderSelect("extras", "Extras", options.extras)}
              </div>

              {loadingChoices && <div style={{ marginTop: "14px", fontSize: "10px", color: "#888" }}>Loading window choices...</div>}

              {form.unitType === "Window" && calculatedSize && calculatedSizeValue !== null && <div style={{ marginTop: "14px", fontSize: "10px", color: "#89939c" }}>Size {calculatedSize.choice} value: {calculatedSizeValue}</div>}

              {error && <div style={{ marginTop: "14px", padding: "9px 10px", borderRadius: "6px", background: "#fbeaea", color: "#8b3333", fontSize: "10px" }}>{error}</div>}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "13px 20px", borderTop: "1px solid #e6e8ea", background: "#fafbfc" }}>
              <button type="button" onClick={closeForm} disabled={saving} style={{ height: "34px", padding: "0 13px", border: "1px solid #d8dde1", borderRadius: "6px", background: "#fff", color: "#555", cursor: saving ? "default" : "pointer", fontFamily: "inherit", fontSize: "10px", fontWeight: 600 }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ height: "34px", padding: "0 15px", border: 0, borderRadius: "6px", background: saving ? "#9acff5" : "#2499ed", color: "#fff", cursor: saving ? "default" : "pointer", fontFamily: "inherit", fontSize: "10px", fontWeight: 700 }}>{saving ? "Saving..." : "Add Unit"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

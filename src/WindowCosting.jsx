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

/*
 * ============================================================
 * SHARED FORM STYLES
 * ============================================================
 */

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

/*
 * ============================================================
 * SIZE MATRIX
 * ============================================================
 */

const SIZE_MATRIX_DIMENSIONS = [
  500,
  600,
  700,
  800,
  900,
  1000,
  1100,
  1200,
  1300,
  1400,
  1500,
  1600,
  1700,
  1800,
  1900,
  2000,
  2250,
  2500,
  2750,
  3000,
  3250,
]

const SIZE_MATRIX = {
  500: [
    "A", "A", "A", "A", "A", "A", "A", "A", "A", "A",
    "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "B"
  ],

  600: [
    "A", "A", "A", "A", "A", "A", "A", "A", "A", "A",
    "A", "A", "A", "A", "A", "A", "A", "B", "B", "B", "B"
  ],

  700: [
    "A", "A", "A", "A", "A", "A", "A", "A", "A", "A",
    "A", "A", "A", "B", "B", "B", "B", "B", "B", "B", "B"
  ],

  800: [
    "A", "A", "A", "A", "A", "A", "A", "A", "A", "A",
    "A", "A", "A", "B", "B", "B", "B", "B", "B", "B", "C"
  ],

  900: [
    "A", "A", "A", "A", "A", "A", "A", "A", "A", "A",
    "B", "B", "B", "B", "B", "B", "B", "B", "B", "C", "C"
  ],

  1000: [
    "A", "A", "A", "A", "A", "B", "B", "B", "B", "B",
    "B", "B", "B", "B", "B", "B", "C", "C", "C", "C"
  ],

  1100: [
    "A", "A", "A", "A", "A", "B", "B", "B", "B", "B",
    "B", "B", "B", "B", "B", "B", "B", "C", "C", "C"
  ],

  1200: [
    "A", "A", "A", "A", "A", "B", "B", "B", "B", "B",
    "B", "B", "B", "B", "B", "B", "C", "C", "C", "C", "D"
  ],

  1300: [
    "A", "A", "A", "A", "A", "B", "B", "B", "B", "B",
    "B", "B", "B", "C", "C", "C", "C", "C", "C", "C", "D"
  ],

  1400: [
    "A", "A", "A", "A", "A", "B", "B", "B", "B", "B",
    "C", "C", "C", "C", "C", "C", "C", "C", "C", "C", "D"
  ],

  1500: [
    "A", "A", "A", "A", "B", "B", "B", "B", "B", "C",
    "C", "C", "C", "C", "C", "C", "D", "D", "D", "D"
  ],

  1600: [
    "A", "A", "A", "A", "B", "B", "B", "B", "B", "C",
    "C", "C", "C", "C", "C", "D", "D", "D", "D", "D", "E"
  ],

  1700: [
    "A", "A", "A", "B", "B", "B", "B", "B", "B", "C",
    "C", "C", "C", "C", "C", "D", "D", "D", "D", "D", "E"
  ],

  1800: [
    "A", "A", "A", "B", "B", "B", "B", "B", "C", "C",
    "C", "C", "C", "C", "D", "D", "D", "D", "D", "E", "E"
  ],

  1900: [
    "A", "A", "A", "B", "B", "B", "B", "B", "C", "C",
    "C", "C", "D", "D", "D", "D", "D", "E", "E", "E", "E"
  ],

  2000: [
    "A", "A", "A", "B", "B", "B", "B", "C", "C", "C",
    "C", "D", "D", "D", "D", "D", "E", "E", "E", "E", "F"
  ],

  2250: [
    "A", "A", "B", "B", "B", "B", "B", "C", "C", "C",
    "C", "D", "D", "D", "D", "E", "E", "E", "E", "F", "F"
  ],

  2500: [
    "A", "B", "B", "B", "B", "B", "C", "C", "C", "C",
    "D", "D", "D", "D", "D", "E", "E", "F", "G", "G", "G"
  ],

  2750: [
    "A", "B", "B", "B", "B", "C", "C", "C", "C", "D",
    "D", "D", "D", "D", "D", "E", "E", "E", "F", "G", "G"
  ],

  3000: [
    "B", "B", "B", "B", "C", "C", "C", "C", "C", "D",
    "D", "D", "D", "E", "E", "E", "F", "F", "G", "H", "H"
  ],

  3250: [
    "B", "B", "B", "C", "C", "C", "C", "D", "D", "D",
    "D", "D", "E", "E", "E", "F", "F", "G", "G", "H", "H"
  ],
}

function roundUpToMatrixSize(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null
  }

  return (
    SIZE_MATRIX_DIMENSIONS.find(
      (dimension) => numericValue <= dimension
    ) || null
  )
}

function getSizeChoice(width, height) {
  const roundedWidth = roundUpToMatrixSize(width)
  const roundedHeight = roundUpToMatrixSize(height)

  if (!roundedWidth || !roundedHeight) {
    return null
  }

  const row = SIZE_MATRIX[roundedHeight]

  if (!row) {
    return null
  }

  const columnIndex =
    SIZE_MATRIX_DIMENSIONS.indexOf(roundedWidth)

  if (columnIndex === -1) {
    return null
  }

  return {
    choice: row[columnIndex],
    roundedWidth,
    roundedHeight,
  }
}

/*
 * ============================================================
 * GENERAL HELPERS
 * ============================================================
 */

function normalise(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
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

        {required && (
          <span style={{ color: "#2499ed" }}> *</span>
        )}
      </span>

      {children}
    </label>
  )
}

function getChoices(rows, categories, unitType) {
  const categorySet = new Set(
    categories.map(normalise)
  )

  const selectedType = normalise(unitType)

  const filtered = rows.filter((row) => {
    const category = normalise(row.category)
    const rowType = normalise(row.unit_type)

    if (!categorySet.has(category)) {
      return false
    }

    if (
      rowType &&
      selectedType &&
      rowType !== selectedType
    ) {
      return false
    }

    return true
  })

  return Array.from(
    new Set(
      filtered
        .map((row) =>
          String(row.choice ?? "").trim()
        )
        .filter(Boolean)
    )
  )
}

function getSizeValue(rows, sizeChoice, unitType) {
  if (!sizeChoice) {
    return null
  }

  const selectedType = normalise(unitType)

  const sizeRows = rows.filter((row) => {
    const category = normalise(row.category)
    const choice = normalise(row.choice)
    const rowType = normalise(row.unit_type)

    const isSizeCategory =
      category === "size" ||
      category === "size choice" ||
      category === "size_choice"

    if (!isSizeCategory) {
      return false
    }

    if (choice !== normalise(sizeChoice)) {
      return false
    }

    if (
      rowType &&
      selectedType &&
      rowType !== selectedType
    ) {
      return false
    }

    return true
  })

  if (!sizeRows.length) {
    return null
  }

  const value = Number(sizeRows[0].value)

  return Number.isFinite(value)
    ? value
    : null
}

/*
 * ============================================================
 * DATABASE UNIT MAPPER
 * ============================================================
 */

function mapDatabaseUnit(row, index) {
  return {
    id: row.UUID,

    unitNumber: index + 1,

    location:
      row.location ?? "",

    unitType:
      row.unit_type ?? "",

    width:
      Number(row.width) || 0,

    height:
      Number(row.height) || 0,

    sizeChoice:
      row.size_choice ?? null,

    sizeValue:
      row.size_value !== null &&
      row.size_value !== undefined
        ? Number(row.size_value)
        : null,

    colour:
      row.colour_choice ?? "",

    shape:
      row.shape_choice ?? "",

    finish:
      row.finish_choice ?? "",

    glass:
      row.glass_choice ?? "",

    style:
      row.style_choice ?? "",

    openers:
      Number(row.openers_choice) || 0,

    fixed:
      Number(row.fixed_choice) || 0,

    handle:
      row.handle_choice ?? "",

    extras:
      row.extras_choice ?? "",

    createdBy:
      row.created_by ?? null,
  }
}

/*
 * ============================================================
 * COMPONENT
 * ============================================================
 */

export default function WindowCosting({ appointment }) {
  const [units, setUnits] = useState([])

  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    ...EMPTY_FORM,
  })

  const [choices, setChoices] = useState([])

  const [loadingChoices, setLoadingChoices] =
    useState(false)

  const [loadingUnits, setLoadingUnits] =
    useState(false)

  const [saving, setSaving] = useState(false)

  const [error, setError] = useState("")

  const isWindows =
    normalise(appointment?.job_type) === "windows"

  /*
   * ==========================================================
   * APPOINTMENT ID
   * ==========================================================
   */

  const appointmentId =
    appointment?.appointment_row_id ??
    appointment?.appointment_id ??
    appointment?.id

  /*
   * ==========================================================
   * LOAD UNIT CHOICES
   * ==========================================================
   */

  useEffect(() => {
    if (!isWindows) {
      setChoices([])
      return
    }

    let cancelled = false

    async function loadChoices() {
      setLoadingChoices(true)
      setError("")

      const {
        data,
        error: fetchError,
      } = await supabase
        .from("unit_choices")
        .select(
          "unit_type, category, charge_type, choice, value_type, value"
        )
        .order("category", {
          ascending: true,
        })
        .order("choice", {
          ascending: true,
        })

      if (cancelled) return

      if (fetchError) {
        console.error(
          "Unable to load unit choices:",
          fetchError
        )

        setError(
          fetchError.message ||
            "Unable to load window choices."
        )

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

  /*
   * ==========================================================
   * LOAD ALL EXISTING UNITS
   * ==========================================================
   */

  useEffect(() => {
    if (!isWindows || !appointmentId) {
      setUnits([])
      return
    }

    let cancelled = false

    async function loadUnits() {
      setLoadingUnits(true)
      setError("")

      console.log(
        "Loading units for appointment:",
        appointmentId
      )

      const {
        data,
        error: fetchError,
      } = await supabase
        .from("units")
        .select("*")
        .eq(
          "appointment_id",
          String(appointmentId)
        )
        .order("created_date", {
          ascending: true,
        })

      if (cancelled) return

      if (fetchError) {
        console.error(
          "Unable to load units:",
          fetchError
        )

        setError(
          fetchError.message ||
            "Unable to load window units."
        )

        setUnits([])
      } else {
        console.log(
          "Units loaded:",
          data
        )

        const mappedUnits = (
          data || []
        ).map(
          (row, index) =>
            mapDatabaseUnit(
              row,
              index
            )
        )

        setUnits(mappedUnits)
      }

      setLoadingUnits(false)
    }

    loadUnits()

    return () => {
      cancelled = true
    }
  }, [
    isWindows,
    appointmentId,
  ])

  /*
   * ==========================================================
   * UNIT TYPES
   * ==========================================================
   */

  const typeOptions = useMemo(() => {
    return Array.from(
      new Set(
        choices
          .map((row) =>
            String(
              row.unit_type ?? ""
            ).trim()
          )
          .filter(Boolean)
      )
    )
  }, [choices])

  /*
   * ==========================================================
   * NORMAL DROPDOWN OPTIONS
   * ==========================================================
   */

  const options = useMemo(() => {
    return {
      colour: getChoices(
        choices,
        ["colour"],
        form.unitType
      ),

      shape: getChoices(
        choices,
        ["shape"],
        form.unitType
      ),

      finish: getChoices(
        choices,
        ["finish"],
        form.unitType
      ),

      glass: getChoices(
        choices,
        ["glass", "glass optionals"],
        form.unitType
      ),

      style: getChoices(
        choices,
        ["style"],
        form.unitType
      ),

      handle: getChoices(
        choices,
        ["handle"],
        form.unitType
      ),

      extras: getChoices(
        choices,
        ["extras"],
        form.unitType
      ),
    }
  }, [
    choices,
    form.unitType,
  ])

  /*
   * ==========================================================
   * CALCULATED SIZE
   * ==========================================================
   */

  const calculatedSize = useMemo(() => {
    if (form.unitType !== "Window") {
      return null
    }

    return getSizeChoice(
      form.width,
      form.height
    )
  }, [
    form.width,
    form.height,
    form.unitType,
  ])

  const calculatedSizeValue = useMemo(() => {
    if (
      form.unitType !== "Window" ||
      !calculatedSize
    ) {
      return null
    }

    return getSizeValue(
      choices,
      calculatedSize.choice,
      form.unitType
    )
  }, [
    choices,
    calculatedSize,
    form.unitType,
  ])

  /*
   * ==========================================================
   * FORM
   * ==========================================================
   */

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
      unitType:
        typeOptions[0] || "",
    })

    setError("")
    setShowForm(true)
  }

  function closeForm() {
    if (saving) return

    setShowForm(false)

    setForm({
      ...EMPTY_FORM,
    })

    setError("")
  }

  /*
   * ==========================================================
   * SAVE UNIT
   * ==========================================================
   */

  async function addUnit(event) {
    event.preventDefault()

    if (saving) return

    if (!form.location.trim()) {
      setError(
        "Please enter a location."
      )
      return
    }

    if (!form.unitType) {
      setError(
        "Please select a type."
      )
      return
    }

    if (!form.width || !form.height) {
      setError(
        "Please enter the width and height."
      )
      return
    }

    if (form.unitType === "Window") {
      if (!calculatedSize) {
        setError(
          "The entered dimensions are outside the available size matrix. Maximum size is 3250mm."
        )
        return
      }

      if (calculatedSizeValue === null) {
        setError(
          `No Size value was found in unit_choices for Size Choice ${calculatedSize.choice} and type ${form.unitType}.`
        )
        return
      }
    }

    if (!appointmentId) {
      setError(
        "Unable to save the unit because no appointment ID was found."
      )
      return
    }

    setSaving(true)
    setError("")

    try {
      /*
       * ======================================================
       * GET CURRENT SUPABASE USER
       * ======================================================
       *
       * created_by will store the authenticated user's
       * email address.
       */

      const {
        data: {
          user,
        },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        console.error(
          "Unable to get current user:",
          userError
        )

        throw new Error(
          userError.message ||
            "Unable to identify the current user."
        )
      }

      const createdBy =
        user?.email ?? null

      console.log(
        "Creating unit for user:",
        createdBy
      )

      /*
       * ======================================================
       * GENERATE UNIT ID
       * ======================================================
       */

      const unitId =
        typeof crypto !== "undefined" &&
        crypto.randomUUID
          ? crypto.randomUUID()
          : undefined

      /*
       * ======================================================
       * BUILD INSERT
       * ======================================================
       */

      const insertData = {
        ...(unitId
          ? {
              UUID: unitId,
            }
          : {}),

        appointment_id:
          String(appointmentId),

        location:
          form.location.trim(),

        created_date:
          new Date().toISOString(),

        created_by:
          createdBy,

        unit_type:
          form.unitType,

        size_choice:
          form.unitType === "Window"
            ? calculatedSize?.choice ||
              null
            : null,

        height:
          Number(form.height),

        width:
          Number(form.width),

        size_value:
          form.unitType === "Window" &&
          calculatedSizeValue !== null
            ? Math.round(
                calculatedSizeValue
              )
            : null,

        colour_choice:
          form.colour || null,

        shape_choice:
          form.shape || null,

        finish_choice:
          form.finish || null,

        style_choice:
          form.style || null,

        glass_choice:
          form.glass || null,

        handle_choice:
          form.handle || null,

        fixed_choice:
          form.unitType === "Window"
            ? String(
                Number(form.fixed) || 0
              )
            : null,

        openers_choice:
          form.unitType === "Window"
            ? String(
                Number(form.openers) || 0
              )
            : null,

        extras_choice:
          form.extras || null,
      }

      console.log(
        "Saving unit:",
        insertData
      )

      /*
       * ======================================================
       * INSERT UNIT
       * ======================================================
       */

      const {
        data: savedUnit,
        error: insertError,
      } = await supabase
        .from("units")
        .insert(insertData)
        .select("*")
        .single()

      if (insertError) {
        console.error(
          "Unable to save unit:",
          insertError
        )

        throw new Error(
          insertError.message ||
            "Unable to save unit."
        )
      }

      /*
       * ======================================================
       * UPDATE LOCAL STATE
       * ======================================================
       */

      setUnits((current) => [
        ...current,
        mapDatabaseUnit(
          savedUnit,
          current.length
        ),
      ])

      closeForm()
    } catch (err) {
      console.error(
        "Error saving unit:",
        err
      )

      setError(
        err?.message ||
          "Unable to save unit."
      )
    } finally {
      setSaving(false)
    }
  }

  /*
   * ============================================================
   * REMOVE UNIT
   * ============================================================
   */

  async function removeUnit(unit) {
    if (!unit) return

    const confirmed =
      window.confirm(
        "Remove this unit?"
      )

    if (!confirmed) return

    if (unit.id) {
      const {
        error: deleteError,
      } = await supabase
        .from("units")
        .delete()
        .eq("UUID", unit.id)

      if (deleteError) {
        console.error(
          "Unable to delete unit:",
          deleteError
        )

        setError(
          deleteError.message ||
            "Unable to delete unit."
        )

        return
      }
    }

    setUnits((current) =>
      current
        .filter(
          (item) =>
            item.id !== unit.id
        )
        .map((item, index) => ({
          ...item,
          unitNumber:
            index + 1,
        }))
    )
  }

  /*
   * ============================================================
   * SELECT RENDERER
   * ============================================================
   */

  const renderSelect = (
    field,
    label,
    optionsList
  ) => {
    if (
      !optionsList ||
      optionsList.length === 0
    ) {
      return null
    }

    return (
      <Field label={label}>
        <select
          value={form[field]}
          onChange={(event) =>
            updateForm(
              field,
              event.target.value
            )
          }
          style={{
            ...selectStyle,
            color: form[field]
              ? "#222"
              : "#777",
          }}
          disabled={loadingChoices}
        >
          <option value="">
            Select{" "}
            {label.toLowerCase()}
            ...
          </option>

          {optionsList.map(
            (option) => (
              <option
                key={option}
                value={option}
              >
                {option}
              </option>
            )
          )}
        </select>
      </Field>
    )
  }

  /*
   * ============================================================
   * NON-WINDOW APPOINTMENTS
   * ============================================================
   */

  if (!isWindows) {
    return null
  }

  /*
   * ============================================================
   * UI
   * ============================================================
   */

  return (
    <section
      style={{
        width: "100%",
        marginTop: "24px",
      }}
    >
      {/* HEADER */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
          marginBottom: "12px",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: 700,
              color: "#222",
            }}
          >
            Windows
          </h2>

          <p
            style={{
              margin: "5px 0 0",
              fontSize: "11px",
              color: "#888",
            }}
          >
            Add and configure
            individual window
            units.
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

      {/* ERROR */}

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

      {/* LOADING UNITS */}

      {loadingUnits ? (
        <div
          style={{
            padding: "24px",
            border:
              "1px dashed #d8dde1",
            borderRadius: "8px",
            background: "#fafbfc",
            textAlign: "center",
            fontSize: "10px",
            color: "#888",
          }}
        >
          Loading window units...
        </div>
      ) : units.length === 0 ? (
        <div
          style={{
            padding: "24px",
            border:
              "1px dashed #d8dde1",
            borderRadius: "8px",
            background: "#fafbfc",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#555",
            }}
          >
            No window units
            added
          </div>

          <div
            style={{
              marginTop: "4px",
              fontSize: "10px",
              color: "#999",
            }}
          >
            Click “Add Unit” to
            add the first window.
          </div>
        </div>
      ) : (
        <div
          style={{
            border:
              "1px solid #e2e5e8",
            borderRadius: "8px",
            background: "#fff",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1.2fr .9fr 1fr 1fr .9fr .45fr .45fr .8fr .9fr 32px",
              gap: "10px",
              alignItems: "center",
              padding: "10px 12px",
              borderBottom:
                "1px solid #e5e7e9",
              background: "#fafbfc",
              fontSize: "8px",
              fontWeight: 700,
              color: "#6d757c",
              textTransform:
                "uppercase",
            }}
          >
            <span>Location</span>
            <span>Type</span>
            <span>Size</span>
            <span>Style</span>
            <span>Colour</span>
            <span>F</span>
            <span>O</span>
            <span>Size Choice</span>
            <span>Size Value</span>
            <span />
          </div>

          {units.map((unit) => (
            <div
              key={unit.id}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "1.2fr .9fr 1fr 1fr .9fr .45fr .45fr .8fr .9fr 32px",
                gap: "10px",
                alignItems: "center",
                padding:
                  "11px 12px",
                borderBottom:
                  "1px solid #eef0f2",
                fontSize: "10px",
                color: "#333",
              }}
            >
              <strong>
                {unit.location}
              </strong>

              <span>
                {unit.unitType ||
                  "—"}
              </span>

              <span>
                {unit.width} ×{" "}
                {unit.height}
              </span>

              <span>
                {unit.style ||
                  "—"}
              </span>

              <span>
                {unit.colour ||
                  "—"}
              </span>

              <span>
                {unit.fixed ?? 0}
              </span>

              <span>
                {unit.openers ?? 0}
              </span>

              <span>
                {unit.sizeChoice ||
                  "—"}
              </span>

              <strong>
                {unit.sizeValue ??
                  "—"}
              </strong>

              <button
                type="button"
                onClick={() =>
                  removeUnit(unit)
                }
                title="Remove unit"
                style={{
                  border: 0,
                  background:
                    "transparent",
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

      {/* ======================================================
          ADD UNIT MODAL
          ====================================================== */}

      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            background:
              "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
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
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            {/* MODAL HEADER */}

            <div
              style={{
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "space-between",
                padding:
                  "17px 20px",
                borderBottom:
                  "1px solid #e6e8ea",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "15px",
                    color: "#222",
                  }}
                >
                  Add Window Unit
                </h3>

                <p
                  style={{
                    margin:
                      "4px 0 0",
                    fontSize: "10px",
                    color: "#888",
                  }}
                >
                  Enter the details
                  for this individual
                  unit.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                style={{
                  border: 0,
                  background:
                    "transparent",
                  color: "#777",
                  cursor: saving
                    ? "default"
                    : "pointer",
                  fontSize: "20px",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* FORM BODY */}

            <div
              style={{
                padding: "20px",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: "15px",
                }}
              >
                <Field
                  label="Location"
                  required
                >
                  <input
                    value={
                      form.location
                    }
                    onChange={(
                      event
                    ) =>
                      updateForm(
                        "location",
                        event.target
                          .value
                      )
                    }
                    placeholder="e.g. Living room"
                    style={
                      inputStyle
                    }
                    autoFocus
                  />
                </Field>

                {typeOptions.length >
                  0 && (
                  <Field
                    label="Type"
                    required
                  >
                    <select
                      value={
                        form.unitType
                      }
                      onChange={(
                        event
                      ) =>
                        updateForm(
                          "unitType",
                          event.target
                            .value
                        )
                      }
                      style={
                        selectStyle
                      }
                      disabled={
                        loadingChoices
                      }
                    >
                      <option value="">
                        Select type...
                      </option>

                      {typeOptions.map(
                        (option) => (
                          <option
                            key={
                              option
                            }
                            value={
                              option
                            }
                          >
                            {option}
                          </option>
                        )
                      )}
                    </select>
                  </Field>
                )}

                <Field
                  label="Width (mm)"
                  required
                >
                  <input
                    type="number"
                    min="1"
                    value={
                      form.width
                    }
                    onChange={(
                      event
                    ) =>
                      updateForm(
                        "width",
                        event.target
                          .value
                      )
                    }
                    placeholder="e.g. 960"
                    style={
                      inputStyle
                    }
                  />
                </Field>

                <Field
                  label="Height (mm)"
                  required
                >
                  <input
                    type="number"
                    min="1"
                    value={
                      form.height
                    }
                    onChange={(
                      event
                    ) =>
                      updateForm(
                        "height",
                        event.target
                          .value
                      )
                    }
                    placeholder="e.g. 1440"
                    style={
                      inputStyle
                    }
                  />
                </Field>
              </div>

              <div
                style={{
                  height: "2px",
                  background:
                    "#2499ed",
                  opacity: 0.25,
                  margin:
                    "22px 0",
                  borderRadius:
                    "2px",
                }}
              />

              {form.unitType ===
                "Window" &&
                calculatedSize && (
                  <div
                    style={{
                      marginBottom:
                        "15px",
                      padding:
                        "10px 12px",
                      border:
                        "1px solid #dfe5ea",
                      borderRadius:
                        "7px",
                      background:
                        "#f8fafc",
                      display: "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "space-between",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize:
                            "10px",
                          fontWeight:
                            700,
                          color:
                            "#59636c",
                        }}
                      >
                        Size Choice
                      </div>

                      <div
                        style={{
                          marginTop:
                            "3px",
                          fontSize:
                            "9px",
                          color:
                            "#89939c",
                        }}
                      >
                        Rounded up to{" "}
                        {
                          calculatedSize.roundedWidth
                        }{" "}
                        ×{" "}
                        {
                          calculatedSize.roundedHeight
                        }{" "}
                        mm
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize:
                          "20px",
                        fontWeight:
                          800,
                        color:
                          "#2499ed",
                      }}
                    >
                      {
                        calculatedSize.choice
                      }
                    </div>
                  </div>
                )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: "15px",
                }}
              >
                {renderSelect(
                  "colour",
                  "Colour",
                  options.colour
                )}

                {renderSelect(
                  "shape",
                  "Shape",
                  options.shape
                )}

                {renderSelect(
                  "finish",
                  "Finish",
                  options.finish
                )}

                {renderSelect(
                  "glass",
                  "Glass",
                  options.glass
                )}

                {renderSelect(
                  "style",
                  "Style",
                  options.style
                )}

                {form.unitType ===
                  "Window" && (
                  <Field label="Number of Openers">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={
                        form.openers
                      }
                      onChange={(
                        event
                      ) =>
                        updateForm(
                          "openers",
                          event.target
                            .value
                        )
                      }
                      style={
                        inputStyle
                      }
                    />
                  </Field>
                )}

                {form.unitType ===
                  "Window" && (
                  <Field label="Number of Fixed">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={
                        form.fixed
                      }
                      onChange={(
                        event
                      ) =>
                        updateForm(
                          "fixed",
                          event.target
                            .value
                        )
                      }
                      style={
                        inputStyle
                      }
                    />
                  </Field>
                )}

                {renderSelect(
                  "handle",
                  "Handle",
                  options.handle
                )}

                {renderSelect(
                  "extras",
                  "Extras",
                  options.extras
                )}
              </div>

              {loadingChoices && (
                <div
                  style={{
                    marginTop:
                      "14px",
                    fontSize:
                      "10px",
                    color:
                      "#888",
                  }}
                >
                  Loading window
                  choices...
                </div>
              )}

              {form.unitType ===
                "Window" &&
                calculatedSize &&
                calculatedSizeValue !==
                  null && (
                  <div
                    style={{
                      marginTop:
                        "14px",
                      fontSize:
                        "10px",
                      color:
                        "#89939c",
                    }}
                  >
                    Size{" "}
                    {
                      calculatedSize.choice
                    }{" "}
                    value:{" "}
                    {
                      calculatedSizeValue
                    }
                  </div>
                )}

              {error && (
                <div
                  style={{
                    marginTop:
                      "14px",
                    padding:
                      "9px 10px",
                    borderRadius:
                      "6px",
                    background:
                      "#fbeaea",
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

            {/* FOOTER */}

            <div
              style={{
                display: "flex",
                justifyContent:
                  "flex-end",
                gap: "8px",
                padding:
                  "13px 20px",
                borderTop:
                  "1px solid #e6e8ea",
                background:
                  "#fafbfc",
              }}
            >
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                style={{
                  height: "34px",
                  padding:
                    "0 13px",
                  border:
                    "1px solid #d8dde1",
                  borderRadius:
                    "6px",
                  background:
                    "#fff",
                  color: "#555",
                  cursor: saving
                    ? "default"
                    : "pointer",
                  fontFamily:
                    "inherit",
                  fontSize:
                    "10px",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                style={{
                  height: "34px",
                  padding:
                    "0 15px",
                  border: 0,
                  borderRadius:
                    "6px",
                  background:
                    saving
                      ? "#9acff5"
                      : "#2499ed",
                  color: "#fff",
                  cursor: saving
                    ? "default"
                    : "pointer",
                  fontFamily:
                    "inherit",
                  fontSize:
                    "10px",
                  fontWeight: 700,
                }}
              >
                {saving
                  ? "Saving..."
                  : "Add Unit"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

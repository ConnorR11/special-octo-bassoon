```jsx
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
    "A", "A", "A", "A", "A", "A", "A", "A", "B", "B", "B"
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
    "B", "B", "B", "B", "B", "B", "C", "C", "C"
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

      const { data, error: fetchError } =
        await supabase
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
       * ========================================================
       * GET CURRENT AUTHENTICATED USER
       * ========================================================
       *
       * The email address comes directly from Supabase Auth.
       * It is not entered by the user and cannot be edited
       * through this form.
       */

      const {
        data: {
          user,
        },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        console.error(
          "Unable to get authenticated user:",
          userError
        )

        throw new Error(
          "Unable to identify the current user."
        )
      }

      if (!user?.email) {
        throw new Error(
          "No email address is associated with the current user."
        )
      }

      const createdBy = user.email

      const unitId =
        typeof crypto !== "undefined" &&
        crypto.randomUUID
          ? crypto.randomUUID()
          : undefined

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
```

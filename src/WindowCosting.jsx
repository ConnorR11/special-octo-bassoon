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

/*
 * Get unique choices from unit_choices.

 * Database columns:

 * unit_type
 * category
 * charge_type
 * choice
 * value_type
 * value

 * Example:

 * unit_type = Window
 * category = colour
 * choice = White
 */
function getChoices(rows, categories, unitType) {
  const categorySet = new Set(
    categories.map(normalise)
  )

  const selectedType = normalise(unitType)

  const filteredRows = rows.filter((row) => {
    const rowCategory = normalise(row.category)
    const rowType = normalise(row.unit_type)

    /*
     * Category must match.
     */
    if (!categorySet.has(rowCategory)) {
      return false
    }

    /*
     * If the pricing row has a unit type,
     * only show rows matching the selected type.
     *
     * If unit_type is blank, allow the row.
     */
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
      filteredRows
        .map((row) =>
          String(row.choice ?? "").trim()
        )
        .filter(Boolean)
    )
  ).sort((a, b) =>
    a.localeCompare(b)
  )
}

export default function WindowCosting({ appointment }) {
  const [units, setUnits] = useState([])

  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    ...EMPTY_FORM,
  })

  const [choices, setChoices] = useState([])

  const [loadingChoices, setLoadingChoices] =
    useState(false)

  const [error, setError] = useState("")

  /*
   * Only show Window Costing for Windows jobs.
   */
  const isWindows =
    normalise(appointment?.job_type) === "windows"

  /*
   * Load unit_choices from Supabase.
   *
   * IMPORTANT:
   * These are the current database column names.
   */
  useEffect(() => {
    if (!isWindows) {
      return
    }

    let cancelled = false

    async function loadChoices() {
      setLoadingChoices(true)
      setError("")

      try {
        const {
          data,
          error: fetchError,
        } = await supabase
          .from("unit_choices")
          .select(
            "unit_type, category, charge_type, choice, value_type, value"
          )
          .order("unit_type", {
            ascending: true,
          })
          .order("category", {
            ascending: true,
          })
          .order("choice", {
            ascending: true,
          })

        if (cancelled) {
          return
        }

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
          return
        }

        console.log(
          "Window unit choices loaded:",
          data
        )

        setChoices(data || [])
      } catch (err) {
        if (cancelled) {
          return
        }

        console.error(
          "Error loading unit choices:",
          err
        )

        setError(
          err?.message ||
            "Unable to load window choices."
        )

        setChoices([])
      } finally {
        if (!cancelled) {
          setLoadingChoices(false)
        }
      }
    }

    loadChoices()

    return () => {
      cancelled = true
    }
  }, [isWindows])

  /*
   * TYPE DROPDOWN
   *
   * This is deliberately very simple.
   *
   * It takes unit_choices.unit_type,
   * removes blanks,
   * removes duplicates,
   * and sorts the results.
   */
  const typeOptions = useMemo(() => {
    return Array.from(
      new Set(
        choices
          .map((row) =>
            String(row.unit_type ?? "").trim()
          )
          .filter(Boolean)
      )
    ).sort((a, b) =>
      a.localeCompare(b)
    )
  }, [choices])

  /*
   * OTHER DROPDOWNS
   *
   * These are driven from:
   *
   * category
   * choice
   * unit_type
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
        [
          "glass",
          "glass optional",
          "glass optionals",
        ],
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
   * Useful debugging information.
   */
  const loadedCategories = useMemo(() => {
    return Array.from(
      new Set(
        choices
          .map((row) =>
            String(row.category ?? "").trim()
          )
          .filter(Boolean)
      )
    ).sort((a, b) =>
      a.localeCompare(b)
    )
  }, [choices])

  /*
   * Useful debugging information for unit types.
   */
  const loadedUnitTypes = useMemo(() => {
    return Array.from(
      new Set(
        choices
          .map((row) =>
            String(row.unit_type ?? "").trim()
          )
          .filter(Boolean)
      )
    ).sort((a, b) =>
      a.localeCompare(b)
    )
  }, [choices])

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

      /*
       * Automatically select the first
       * available type when opening the form.
       */
      unitType:
        typeOptions.length > 0
          ? typeOptions[0]
          : "",
    })

    setError("")
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)

    setForm({
      ...EMPTY_FORM,
    })

    setError("")
  }

  function addUnit(event) {
    event.preventDefault()

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

    const newUnit = {
      id: crypto.randomUUID(),

      unitNumber:
        units.length + 1,

      ...form,

      width: Number(form.width),

      height: Number(form.height),

      openers:
        Number(form.openers) || 0,

      fixed:
        Number(form.fixed) || 0,
    }

    setUnits((current) => [
      ...current,
      newUnit,
    ])

    closeForm()
  }

  function removeUnit(id) {
    setUnits((current) =>
      current
        .filter(
          (unit) => unit.id !== id
        )
        .map((unit, index) => ({
          ...unit,
          unitNumber: index + 1,
        }))
    )
  }

  /*
   * Don't render anything for non-window jobs.
   */
  if (!isWindows) {
    return null
  }

  /*
   * Reusable dropdown renderer.
   */
  const renderSelect = (
    field,
    label,
    optionsList
  ) => {
    const hasOptions =
      optionsList &&
      optionsList.length > 0

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
          disabled={
            loadingChoices ||
            !hasOptions
          }
        >
          <option value="">
            {loadingChoices
              ? "Loading..."
              : hasOptions
              ? `Select ${label.toLowerCase()}...`
              : `No ${label.toLowerCase()} options`}
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

      {/* UNITS TABLE */}

      {units.length === 0 ? (
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
          {/* TABLE HEADER */}

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
            <span>Discountable</span>
            <span>Price</span>
            <span />
          </div>

          {/* TABLE ROWS */}

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
                {unit.fixed}
              </span>

              <span>
                {unit.openers}
              </span>

              <span>
                —
              </span>

              <strong>
                —
              </strong>

              <button
                type="button"
                onClick={() =>
                  removeUnit(
                    unit.id
                  )
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

      {/* ADD UNIT MODAL */}

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
                style={{
                  border: 0,
                  background:
                    "transparent",
                  color: "#777",
                  cursor: "pointer",
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
                {/* LOCATION */}

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

                {/* TYPE */}

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
                      loadingChoices ||
                      typeOptions.length ===
                        0
                    }
                  >
                    <option value="">
                      {loadingChoices
                        ? "Loading..."
                        : typeOptions.length ===
                          0
                        ? "No types available"
                        : "Select type..."}
                    </option>

                    {typeOptions.map(
                      (option) => (
                        <option
                          key={option}
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

                {/* WIDTH */}

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

                {/* HEIGHT */}

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

                {/* COLOUR */}

                {renderSelect(
                  "colour",
                  "Colour",
                  options.colour
                )}

                {/* SHAPE */}

                {renderSelect(
                  "shape",
                  "Shape",
                  options.shape
                )}

                {/* FINISH */}

                {renderSelect(
                  "finish",
                  "Finish",
                  options.finish
                )}

                {/* GLASS */}

                {renderSelect(
                  "glass",
                  "Glass",
                  options.glass
                )}

                {/* STYLE */}

                {renderSelect(
                  "style",
                  "Style",
                  options.style
                )}

                {/* OPENERS */}

                <Field
                  label="Number of Openers"
                >
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

                {/* FIXED */}

                <Field
                  label="Number of Fixed"
                >
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

                {/* HANDLE */}

                {renderSelect(
                  "handle",
                  "Handle",
                  options.handle
                )}

                {/* EXTRAS */}

                {renderSelect(
                  "extras",
                  "Extras",
                  options.extras
                )}
              </div>

              {/* LOADING */}

              {loadingChoices && (
                <div
                  style={{
                    marginTop:
                      "14px",
                    fontSize:
                      "10px",
                    color: "#888",
                  }}
                >
                  Loading window
                  choices...
                </div>
              )}

              {/* DATABASE INFO */}

              {!loadingChoices &&
                choices.length > 0 && (
                  <div
                    style={{
                      marginTop:
                        "14px",
                      padding:
                        "8px 10px",
                      borderRadius:
                        "6px",
                      background:
                        "#f7f9fb",
                      fontSize:
                        "9px",
                      color:
                        "#89939c",
                    }}
                  >
                    {choices.length} pricing
                    choices loaded
                  </div>
                )}

              {/* ERROR */}

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

              {/* DEBUG */}

              {!loadingChoices &&
                choices.length > 0 && (
                  <details
                    style={{
                      marginTop:
                        "10px",
                      fontSize:
                        "9px",
                      color:
                        "#89939c",
                    }}
                  >
                    <summary
                      style={{
                        cursor:
                          "pointer",
                      }}
                    >
                      Database information
                    </summary>

                    <div
                      style={{
                        marginTop:
                          "6px",
                        lineHeight:
                          "1.6",
                      }}
                    >
                      <div>
                        <strong>
                          Unit types:
                        </strong>{" "}
                        {loadedUnitTypes.join(
                          ", "
                        )}
                      </div>

                      <div>
                        <strong>
                          Categories:
                        </strong>{" "}
                        {loadedCategories.join(
                          ", "
                        )}
                      </div>
                    </div>
                  </details>
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
                  cursor:
                    "pointer",
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
                style={{
                  height: "34px",
                  padding:
                    "0 15px",
                  border: 0,
                  borderRadius:
                    "6px",
                  background:
                    "#2499ed",
                  color: "#fff",
                  cursor:
                    "pointer",
                  fontFamily:
                    "inherit",
                  fontSize:
                    "10px",
                  fontWeight: 700,
                }}
              >
                Add Unit
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

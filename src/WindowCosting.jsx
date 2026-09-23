import React, { useState } from "react"

export default function WindowCosting({ appointment }) {
  const [units, setUnits] = useState([])

  /*
   * ADD UNIT
   *
   * Creates a new blank window unit in the UI.
   * Pricing and Supabase saving will be added later.
   */
  const addUnit = () => {
    const newUnit = {
      id: crypto.randomUUID(),
      unitNumber: units.length + 1,

      unitType: "",
      size: "",
      finish: "",
      style: "",
      opener: "",
      external: "",
      colour: "",
      shape: "",
      glass: "",
      extras: ""
    }

    setUnits(current => [
      ...current,
      newUnit
    ])
  }

  /*
   * REMOVE UNIT
   */
  const removeUnit = id => {
    setUnits(current => {
      const remaining = current.filter(
        unit => unit.id !== id
      )

      return remaining.map(
        (unit, index) => ({
          ...unit,
          unitNumber: index + 1
        })
      )
    })
  }

  /*
   * UPDATE UNIT
   *
   * This will be used when we add the
   * dropdown choices.
   */
  const updateUnit = (id, field, value) => {
    setUnits(current =>
      current.map(unit =>
        unit.id === id
          ? {
              ...unit,
              [field]: value
            }
          : unit
      )
    )
  }

  /*
   * Only display the Windows costing section
   * for Windows appointments.
   */
  if (
    appointment?.job_type &&
    appointment.job_type !== "Windows"
  ) {
    return null
  }

  return (
    <section className="w-full">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">

        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Windows
          </h2>

          <p className="text-sm text-slate-500 mt-1">
            Add and configure individual window units.
          </p>
        </div>

        {/* ADD UNIT BUTTON */}
        <button
          type="button"
          onClick={addUnit}
          className="
            inline-flex
            items-center
            gap-2
            rounded-lg
            bg-sky-600
            px-4
            py-2.5
            text-sm
            font-semibold
            text-white
            shadow-sm
            transition
            hover:bg-sky-700
            active:bg-sky-800
          "
        >
          <span className="text-lg leading-none">
            +
          </span>

          Add Unit
        </button>

      </div>


      {/* NO UNITS */}
      {units.length === 0 && (
        <div
          className="
            rounded-xl
            border
            border-dashed
            border-slate-300
            bg-slate-50
            px-6
            py-10
            text-center
          "
        >
          <div className="text-sm font-medium text-slate-700">
            No window units added
          </div>

          <div className="mt-1 text-sm text-slate-500">
            Click “Add Unit” to add the first window.
          </div>
        </div>
      )}


      {/* UNITS */}
      {units.length > 0 && (
        <div className="space-y-4">

          {units.map(unit => (

            <div
              key={unit.id}
              className="
                rounded-xl
                border
                border-slate-200
                bg-white
                shadow-sm
                overflow-hidden
              "
            >

              {/* UNIT HEADER */}
              <div
                className="
                  flex
                  items-center
                  justify-between
                  border-b
                  border-slate-200
                  bg-slate-50
                  px-5
                  py-3
                "
              >

                <div className="flex items-center gap-3">

                  <div
                    className="
                      flex
                      h-8
                      w-8
                      items-center
                      justify-center
                      rounded-lg
                      bg-sky-100
                      text-sm
                      font-bold
                      text-sky-700
                    "
                  >
                    {unit.unitNumber}
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Window Unit {unit.unitNumber}
                    </div>

                    <div className="text-xs text-slate-500">
                      Configure this individual unit
                    </div>
                  </div>

                </div>


                {/* REMOVE UNIT */}
                <button
                  type="button"
                  onClick={() => removeUnit(unit.id)}
                  className="
                    rounded-md
                    px-2
                    py-1.5
                    text-xs
                    font-medium
                    text-red-600
                    transition
                    hover:bg-red-50
                  "
                >
                  Remove
                </button>

              </div>


              {/* UNIT CONTENT */}
              <div className="p-5">

                <div
                  className="
                    grid
                    grid-cols-1
                    gap-4
                    sm:grid-cols-2
                    lg:grid-cols-4
                  "
                >

                  {/* UNIT TYPE */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Unit Type
                    </label>

                    <div
                      className="
                        rounded-lg
                        border
                        border-slate-200
                        bg-slate-50
                        px-3
                        py-2.5
                        text-sm
                        text-slate-500
                      "
                    >
                      {unit.unitType || "Not selected"}
                    </div>
                  </div>


                  {/* SIZE */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Size
                    </label>

                    <div
                      className="
                        rounded-lg
                        border
                        border-slate-200
                        bg-slate-50
                        px-3
                        py-2.5
                        text-sm
                        text-slate-500
                      "
                    >
                      {unit.size || "Not selected"}
                    </div>
                  </div>


                  {/* FINISH */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Finish
                    </label>

                    <div
                      className="
                        rounded-lg
                        border
                        border-slate-200
                        bg-slate-50
                        px-3
                        py-2.5
                        text-sm
                        text-slate-500
                      "
                    >
                      {unit.finish || "Not selected"}
                    </div>
                  </div>


                  {/* STYLE */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Style
                    </label>

                    <div
                      className="
                        rounded-lg
                        border
                        border-slate-200
                        bg-slate-50
                        px-3
                        py-2.5
                        text-sm
                        text-slate-500
                      "
                    >
                      {unit.style || "Not selected"}
                    </div>
                  </div>


                  {/* OPENER */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Opener
                    </label>

                    <div
                      className="
                        rounded-lg
                        border
                        border-slate-200
                        bg-slate-50
                        px-3
                        py-2.5
                        text-sm
                        text-slate-500
                      "
                    >
                      {unit.opener || "Not selected"}
                    </div>
                  </div>


                  {/* EXTERNAL */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      External
                    </label>

                    <div
                      className="
                        rounded-lg
                        border
                        border-slate-200
                        bg-slate-50
                        px-3
                        py-2.5
                        text-sm
                        text-slate-500
                      "
                    >
                      {unit.external || "Not selected"}
                    </div>
                  </div>


                  {/* COLOUR */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Colour
                    </label>

                    <div
                      className="
                        rounded-lg
                        border
                        border-slate-200
                        bg-slate-50
                        px-3
                        py-2.5
                        text-sm
                        text-slate-500
                      "
                    >
                      {unit.colour || "Not selected"}
                    </div>
                  </div>


                  {/* SHAPE */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Shape
                    </label>

                    <div
                      className="
                        rounded-lg
                        border
                        border-slate-200
                        bg-slate-50
                        px-3
                        py-2.5
                        text-sm
                        text-slate-500
                      "
                    >
                      {unit.shape || "Not selected"}
                    </div>
                  </div>


                  {/* GLASS */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Glass
                    </label>

                    <div
                      className="
                        rounded-lg
                        border
                        border-slate-200
                        bg-slate-50
                        px-3
                        py-2.5
                        text-sm
                        text-slate-500
                      "
                    >
                      {unit.glass || "Not selected"}
                    </div>
                  </div>


                  {/* EXTRAS */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Extras
                    </label>

                    <div
                      className="
                        rounded-lg
                        border
                        border-slate-200
                        bg-slate-50
                        px-3
                        py-2.5
                        text-sm
                        text-slate-500
                      "
                    >
                      {unit.extras || "Not selected"}
                    </div>
                  </div>

                </div>


                {/* FUTURE PRICE AREA */}
                <div
                  className="
                    mt-5
                    flex
                    items-center
                    justify-between
                    border-t
                    border-slate-100
                    pt-4
                  "
                >

                  <div className="text-xs text-slate-500">
                    Unit price
                  </div>

                  <div className="text-lg font-bold text-slate-900">
                    £0.00
                  </div>

                </div>

              </div>

            </div>

          ))}


          {/* TOTAL */}
          <div
            className="
              flex
              items-center
              justify-between
              rounded-xl
              bg-slate-900
              px-5
              py-4
              text-white
            "
          >

            <div>
              <div className="text-sm font-semibold">
                Window Total
              </div>

              <div className="text-xs text-slate-300">
                {units.length}{" "}
                {units.length === 1
                  ? "unit"
                  : "units"}
              </div>
            </div>

            <div className="text-xl font-bold">
              £0.00
            </div>

          </div>

        </div>
      )}

    </section>
  )
}

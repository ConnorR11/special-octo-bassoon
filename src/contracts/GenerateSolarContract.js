/*
 * ITEMISED BREAKDOWN
 */
async function drawItemisedBreakdown(
  pdf,
  page,
  ctx,
  data,
  results,
  appointment,
  epvs
) {
  const width =
    ctx.width - ctx.padding * 2

  const settings =
    page.settings || {}

  const configured =
    Array.isArray(settings.included_items)
      ? settings.included_items
      : []

  /*
   * ------------------------------------------------------------
   * GET TOTAL PANEL COUNT
   * ------------------------------------------------------------
   *
   * Panels must come from the actual EPVS array data.
   *
   * Example:
   *
   * arrays: [
   *   { panelCount: 8 },
   *   { panelCount: 10 }
   * ]
   *
   * Result = 18
   *
   * This is deliberately independent of the quantity configured
   * against the "Panels" template item.
   */

  const solarArrays =
    Array.isArray(data?.arrays)
      ? data.arrays
      : []

  const arrayPanelCount =
    solarArrays.reduce(
      (total, array) => {
        const count =
          Number(
            array?.panelCount ??
            array?.panel_count ??
            0
          )

        return total + (
          Number.isFinite(count)
            ? count
            : 0
        )
      },
      0
    )

  /*
   * Fallbacks in case the EPVS data does not contain arrays.
   */
  const fallbackPanelCount =
    Number(
      data?.panelCount ??
      data?.panel_count ??
      data?.numberOfPanels ??
      data?.number_of_panels ??
      0
    )

  const panelCount =
    arrayPanelCount > 0
      ? arrayPanelCount
      : (
          Number.isFinite(
            fallbackPanelCount
          )
            ? fallbackPanelCount
            : 0
        )

  console.log(
    "Digital Solar Contract - panel count:",
    {
      arrays: solarArrays,
      arrayPanelCount,
      fallbackPanelCount,
      panelCount
    }
  )

  /*
   * ------------------------------------------------------------
   * BUILD ITEMS
   * ------------------------------------------------------------
   */

  const items =
    configured.map(item => {
      const name =
        typeof item === "string"
          ? item
          : item?.name ?? "—"

      const type =
        typeof item === "string"
          ? ""
          : item?.type ?? ""

      let quantity =
        typeof item === "string"
          ? 1
          : item?.quantity ?? 1

      /*
       * ONLY the item called "Panels" gets the dynamic
       * EPVS panel count.
       *
       * Panel Installation is NOT changed.
       */
      if (
        String(name)
          .trim()
          .toLowerCase() === "panels"
      ) {
        quantity = panelCount
      }

      /*
       * Keep these as configured/displayed as "-".
       */
      const normalisedName =
        String(name)
          .trim()
          .toLowerCase()

      if (
        normalisedName === "roof hooks" ||
        normalisedName === "rail fix kit"
      ) {
        quantity = "-"
      }

      return {
        name,
        quantity,
        type
      }
    })

  /*
   * ------------------------------------------------------------
   * TABLE POSITION
   * ------------------------------------------------------------
   */

  const headerY =
    ctx.y + 28

  const typeX =
    ctx.padding +
    width -
    43

  const rowHeight =
    7.15

  /*
   * ------------------------------------------------------------
   * TABLE HEADER
   * ------------------------------------------------------------
   */

  pdf.setFillColor(
    ...ctx.accent
  )

  pdf.roundedRect(
    ctx.padding,
    headerY - 7,
    width,
    11,
    2,
    2,
    "F"
  )

  pdf.setTextColor(
    255,
    255,
    255
  )

  pdf.setFont(
    "helvetica",
    "bold"
  )

  pdf.setFontSize(8)

  pdf.text(
    "PRODUCT / SERVICE",
    ctx.padding + 7,
    headerY
  )

  pdf.text(
    "TYPE",
    typeX,
    headerY,
    {
      align: "center"
    }
  )

  pdf.text(
    "QTY",
    ctx.padding + width - 7,
    headerY,
    {
      align: "right"
    }
  )

  let y =
    headerY + 9

  /*
   * ------------------------------------------------------------
   * TABLE ROWS
   * ------------------------------------------------------------
   */

  items.forEach(
    (item, index) => {
      const name =
        interpolate(
          String(item.name),
          appointment,
          epvs
        )

      const type =
        interpolate(
          String(item.type),
          appointment,
          epvs
        )

      /*
       * Quantity can either be:
       *
       * 18
       * 1
       * "-"
       * "{{inverter_quantity}}"
       *
       * Interpolate it so template placeholders work.
       *
       * Panels will already contain the calculated
       * panelCount from above.
       */
      const quantity =
        interpolate(
          String(item.quantity),
          appointment,
          epvs
        )

      if (index % 2 === 0) {
        pdf.setFillColor(
          247,
          249,
          250
        )

        pdf.roundedRect(
          ctx.padding,
          y - 5.2,
          width,
          rowHeight,
          1.2,
          1.2,
          "F"
        )
      }

      /*
       * --------------------------------------------------------
       * PRODUCT / SERVICE
       * --------------------------------------------------------
       */

      pdf.setTextColor(
        ...ctx.text
      )

      pdf.setFont(
        "helvetica",
        "normal"
      )

      pdf.setFontSize(8.1)

      pdf.text(
        name,
        ctx.padding + 7,
        y
      )

      /*
       * --------------------------------------------------------
       * TYPE TAG
       * --------------------------------------------------------
       */

      if (type) {
        pdf.setFont(
          "helvetica",
          "bold"
        )

        pdf.setFontSize(6.5)

        const tagWidth =
          pdf.getTextWidth(type) + 6

        const typeKey =
          type.toLowerCase()

        const fill =
          typeKey === "service"
            ? [255, 241, 230]
            : typeKey === "product"
              ? [231, 242, 248]
              : [238, 240, 242]

        const colour =
          typeKey === "service"
            ? [199, 106, 0]
            : typeKey === "product"
              ? [11, 93, 138]
              : [75, 85, 92]

        pdf.setFillColor(
          ...fill
        )

        pdf.setTextColor(
          ...colour
        )

        pdf.roundedRect(
          typeX - tagWidth / 2,
          y - 3.8,
          tagWidth,
          4.5,
          2,
          2,
          "F"
        )

        pdf.text(
          type,
          typeX,
          y - 0.5,
          {
            align: "center"
          }
        )
      }

      /*
       * --------------------------------------------------------
       * QUANTITY
       * --------------------------------------------------------
       */

      pdf.setTextColor(
        ...ctx.text
      )

      pdf.setFont(
        "helvetica",
        "bold"
      )

      pdf.setFontSize(8.1)

      pdf.text(
        quantity,
        ctx.padding + width - 7,
        y,
        {
          align: "right"
        }
      )

      y += rowHeight
    }
  )

  y += 7

  /*
   * ------------------------------------------------------------
   * TOTAL SYSTEM PRICE
   * ------------------------------------------------------------
   */

  const price =
    results?.systemCost ??
    data?.systemCost ??
    appointment?.system_cost ??
    appointment?.contract_value ??
    appointment?.sale_value ??
    appointment?.price

  /*
   * Same card layout as your previous version:
   *
   * CUSTOMER SIGNATURE | TOTAL SYSTEM PRICE
   */

  const totalCardHeight =
    32

  pdf.setFillColor(
    ...ctx.accent
  )

  pdf.roundedRect(
    ctx.padding,
    y,
    width,
    totalCardHeight,
    3,
    3,
    "F"
  )

  /*
   * ------------------------------------------------------------
   * CUSTOMER SIGNATURE
   * ------------------------------------------------------------
   */

  const signatureUrl =
    await getSignatureImageUrl(
      appointment
    )

  if (signatureUrl) {
    try {
      const signature =
        await imageData(
          signatureUrl
        )

      const signatureAreaX =
        ctx.padding + 7

      const signatureAreaY =
        y + 6

      const signatureAreaWidth =
        Math.min(
          65,
          width * 0.45
        )

      const signatureAreaHeight =
        20

      /*
       * Signature title
       */

      pdf.setTextColor(
        255,
        255,
        255
      )

      pdf.setFont(
        "helvetica",
        "bold"
      )

      pdf.setFontSize(6.5)

      pdf.text(
        "CUSTOMER SIGNATURE",
        signatureAreaX,
        signatureAreaY
      )

      /*
       * Signature white background
       */

      pdf.setFillColor(
        252,
        253,
        254
      )

      pdf.roundedRect(
        signatureAreaX,
        signatureAreaY + 2.5,
        signatureAreaWidth,
        signatureAreaHeight - 4,
        1.5,
        1.5,
        "F"
      )

      /*
       * Keep signature inside white box.
       */

      const maxSignatureWidth =
        signatureAreaWidth - 8

      const maxSignatureHeight =
        signatureAreaHeight - 9

      const signatureRatio =
        signature.width /
        signature.height

      let signatureWidth =
        maxSignatureWidth

      let signatureHeight =
        signatureWidth /
        signatureRatio

      if (
        signatureHeight >
        maxSignatureHeight
      ) {
        signatureHeight =
          maxSignatureHeight

        signatureWidth =
          signatureHeight *
          signatureRatio
      }

      const signatureX =
        signatureAreaX +
        (
          signatureAreaWidth -
          signatureWidth
        ) / 2

      const signatureY =
        signatureAreaY +
        3 +
        (
          maxSignatureHeight -
          signatureHeight
        ) / 2

      pdf.addImage(
        signature.dataUrl,
        "PNG",
        signatureX,
        signatureY,
        signatureWidth,
        signatureHeight,
        undefined,
        "FAST"
      )
    } catch (error) {
      console.error(
        "Unable to add customer signature to contract:",
        error
      )
    }
  }

  /*
   * ------------------------------------------------------------
   * TOTAL PRICE
   * ------------------------------------------------------------
   */

  const priceX =
    ctx.padding +
    width -
    8

  pdf.setTextColor(
    255,
    255,
    255
  )

  pdf.setFont(
    "helvetica",
    "bold"
  )

  pdf.setFontSize(6.5)

  pdf.text(
    "TOTAL SYSTEM PRICE",
    priceX,
    y + 10,
    {
      align: "right"
    }
  )

  pdf.setFont(
    "helvetica",
    "bold"
  )

  pdf.setFontSize(18)

  pdf.text(
    money(price),
    priceX,
    y + 22,
    {
      align: "right"
    }
  )
}

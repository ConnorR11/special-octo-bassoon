import jsPDF from "jspdf"

export function GenerateSolarContract({
  appointment,
  epvsCalculation,
}) {
  if (!appointment) {
    return
  }

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const pageWidth =
    pdf.internal.pageSize.getWidth()

  const pageHeight =
    pdf.internal.pageSize.getHeight()

  let y = 20

  function formatDate(value) {
    if (!value) {
      return "—"
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return String(value)
    }

    return date.toLocaleString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  function money(value) {
    return new Intl.NumberFormat(
      "en-GB",
      {
        style: "currency",
        currency: "GBP",
        maximumFractionDigits: 0,
      }
    ).format(Number(value || 0))
  }

  function addFooter() {
    const pageCount =
      pdf.getNumberOfPages()

    for (
      let page = 1;
      page <= pageCount;
      page++
    ) {
      pdf.setPage(page)

      const height =
        pdf.internal.pageSize.getHeight()

      pdf.setDrawColor(
        220,
        220,
        220
      )

      pdf.line(
        20,
        height - 15,
        pageWidth - 20,
        height - 15
      )

      pdf.setFontSize(7)

      pdf.setTextColor(
        130,
        130,
        130
      )

      pdf.setFont(
        "helvetica",
        "normal"
      )

      pdf.text(
        `Appointment ${
          appointment.appointment_row_id ||
          ""
        }`,
        20,
        height - 9
      )

      pdf.text(
        `Page ${page} of ${pageCount}`,
        pageWidth - 20,
        height - 9,
        {
          align: "right",
        }
      )
    }
  }

  // =========================================================
  // HEADER
  // =========================================================

  pdf.setFillColor(
    0,
    45,
    73
  )

  pdf.rect(
    0,
    0,
    pageWidth,
    32,
    "F"
  )

  pdf.setTextColor(
    255,
    255,
    255
  )

  pdf.setFontSize(20)

  pdf.setFont(
    "helvetica",
    "bold"
  )

  pdf.text(
    "HomeShield",
    20,
    14
  )

  pdf.setFontSize(10)

  pdf.setFont(
    "helvetica",
    "normal"
  )

  pdf.text(
    "Solar PV & EPVS Calculation",
    20,
    22
  )

  pdf.setFontSize(9)

  pdf.text(
    "SOLD",
    pageWidth - 20,
    18,
    {
      align: "right",
    }
  )

  pdf.setTextColor(
    0,
    0,
    0
  )

  y = 45

  // =========================================================
  // CUSTOMER
  // =========================================================

  pdf.setFontSize(14)

  pdf.setFont(
    "helvetica",
    "bold"
  )

  pdf.text(
    "Customer",
    20,
    y
  )

  y += 8

  pdf.setFontSize(10)

  pdf.setFont(
    "helvetica",
    "normal"
  )

  const customerRows = [
    [
      "Name",
      appointment.name ||
        epvsCalculation?.data
          ?.customerName ||
        "—",
    ],

    [
      "Address",
      appointment.address ||
        epvsCalculation?.data
          ?.address ||
        "—",
    ],

    [
      "Postcode",
      appointment.postcode ||
        epvsCalculation?.data
          ?.postcode ||
        "—",
    ],

    [
      "Phone",
      appointment.phone ||
        "—",
    ],

    [
      "Email",
      appointment.email ||
        "—",
    ],
  ]

  customerRows.forEach(
    ([label, value]) => {
      pdf.setFont(
        "helvetica",
        "bold"
      )

      pdf.text(
        `${label}:`,
        20,
        y
      )

      pdf.setFont(
        "helvetica",
        "normal"
      )

      pdf.text(
        String(value),
        55,
        y
      )

      y += 6
    }
  )

  y += 6

  // =========================================================
  // APPOINTMENT
  // =========================================================

  pdf.setFont(
    "helvetica",
    "bold"
  )

  pdf.setFontSize(14)

  pdf.text(
    "Appointment",
    20,
    y
  )

  y += 8

  pdf.setFontSize(10)

  const appointmentRows = [
    [
      "Date",
      formatDate(
        appointment.appointment_date
      ),
    ],

    [
      "Job type",
      appointment.job_type ||
        "—",
    ],

    [
      "Salesperson",
      appointment.salesperson ||
        "—",
    ],

    [
      "Result",
      "Sold",
    ],
  ]

  appointmentRows.forEach(
    ([label, value]) => {
      pdf.setFont(
        "helvetica",
        "bold"
      )

      pdf.text(
        `${label}:`,
        20,
        y
      )

      pdf.setFont(
        "helvetica",
        "normal"
      )

      pdf.text(
        String(value),
        55,
        y
      )

      y += 6
    }
  )

  // =========================================================
  // EPVS SUMMARY
  // =========================================================

  if (epvsCalculation) {
    y += 8

    pdf.setFont(
      "helvetica",
      "bold"
    )

    pdf.setFontSize(14)

    pdf.text(
      "EPVS Calculation",
      20,
      y
    )

    y += 9

    const {
      data = {},
      results = {},
    } = epvsCalculation

    const epvsRows = [
      [
        "System size",
        `${Number(
          results.systemSize || 0
        ).toFixed(2)} kWp`,
      ],

      [
        "Panel wattage",
        `${Number(
          data.panelWattage || 0
        )} W`,
      ],

      [
        "Number of panels",
        `${Number(
          data.panelCount || 0
        )}`,
      ],

      [
        "Annual consumption",
        `${Math.round(
          Number(
            data.annualConsumption ||
              0
          )
        ).toLocaleString(
          "en-GB"
        )} kWh`,
      ],

      [
        "Estimated generation",
        `${Math.round(
          Number(
            results.generation ||
              0
          )
        ).toLocaleString(
          "en-GB"
        )} kWh`,
      ],

      [
        "Solar self-consumption",
        `${Math.round(
          Number(
            results.solarSelfConsumption ||
              0
          )
        ).toLocaleString(
          "en-GB"
        )} kWh`,
      ],

      [
        "Battery",
        data.batteryEnabled
          ? `${Number(
              data.batteryCapacity ||
                0
            )} kWh`
          : "Not included",
      ],

      [
        "Battery contribution",
        `${Math.round(
          Number(
            results.batteryContribution ||
              0
          )
        ).toLocaleString(
          "en-GB"
        )} kWh`,
      ],

      [
        "Estimated export",
        `${Math.round(
          Number(
            results.exportKwh ||
              0
          )
        ).toLocaleString(
          "en-GB"
        )} kWh`,
      ],

      [
        "Inverter",
        `${Number(
          data.inverterCapacity ||
            0
        )} kW`,
      ],

      [
        "Tariff",
        data.tariff || "—",
      ],

      [
        "Import rate",
        `£${Number(
          data.importRate || 0
        ).toFixed(3)}/kWh`,
      ],

      [
        "Export rate",
        `£${Number(
          data.exportRate || 0
        ).toFixed(3)}/kWh`,
      ],

      [
        "Annual saving",
        money(
          results.annualSaving
        ),
      ],

      [
        "System cost",
        money(
          data.systemCost
        ),
      ],

      [
        "Deposit",
        money(
          data.deposit
        ),
      ],

      [
        "Finance term",
        `${Number(
          data.financeTerm || 0
        )} years`,
      ],

      [
        "Interest rate",
        `${Number(
          data.financeRate || 0
        ).toFixed(1)}%`,
      ],

      [
        "Monthly finance",
        money(
          results.monthlyPayment
        ),
      ],

      [
        "Simple payback",
        results.simplePayback
          ? `${Number(
              results.simplePayback
            ).toFixed(1)} years`
          : "—",
      ],
    ]

    const tableX = 20
    const labelX = 23
    const valueX =
      pageWidth - 23

    const rowHeight = 6
    const tableWidth =
      pageWidth - 40

    epvsRows.forEach(
      ([label, value], index) => {
        if (
          y >
          pageHeight - 30
        ) {
          pdf.addPage()
          y = 20
        }

        if (index % 2 === 0) {
          pdf.setFillColor(
            245,
            247,
            249
          )

          pdf.rect(
            tableX,
            y - 4,
            tableWidth,
            rowHeight,
            "F"
          )
        }

        pdf.setTextColor(
          60,
          60,
          60
        )

        pdf.setFont(
          "helvetica",
          "bold"
        )

        pdf.setFontSize(8)

        pdf.text(
          label,
          labelX,
          y
        )

        pdf.setFont(
          "helvetica",
          "normal"
        )

        pdf.text(
          String(value),
          valueX,
          y,
          {
            align: "right",
          }
        )

        y += rowHeight
      }
    )

    // =======================================================
    // 30 YEAR BREAKDOWN
    // =======================================================

    const breakdown =
      results.thirtyYearBreakdown ||
      []

    if (
      breakdown.length > 0
    ) {
      y += 10

      if (
        y >
        pageHeight - 70
      ) {
        pdf.addPage()
        y = 20
      }

      pdf.setFont(
        "helvetica",
        "bold"
      )

      pdf.setFontSize(14)

      pdf.setTextColor(
        0,
        0,
        0
      )

      pdf.text(
        "30 Year Projection",
        20,
        y
      )

      y += 7

      pdf.setFontSize(8)

      pdf.setFont(
        "helvetica",
        "normal"
      )

      pdf.setTextColor(
        100,
        100,
        100
      )

      pdf.text(
        "Estimated annual and cumulative savings over 30 years.",
        20,
        y
      )

      y += 7

      // -------------------------------------------------------
      // SUMMARY
      // -------------------------------------------------------

      pdf.setFillColor(
        240,
        245,
        248
      )

      pdf.rect(
        20,
        y - 4,
        pageWidth - 40,
        15,
        "F"
      )

      pdf.setFont(
        "helvetica",
        "bold"
      )

      pdf.setFontSize(8)

      pdf.setTextColor(
        40,
        40,
        40
      )

      pdf.text(
        "30 Year Savings",
        25,
        y + 2
      )

      pdf.text(
        money(
          results.thirtyYearSavings
        ),
        25,
        y + 8
      )

      pdf.text(
        "30 Year Return",
        90,
        y + 2
      )

      pdf.text(
        money(
          results.thirtyYearProfit
        ),
        90,
        y + 8
      )

      pdf.text(
        "System Cost",
        155,
        y + 2
      )

      pdf.text(
        money(
          data.systemCost
        ),
        155,
        y + 8
      )

      y += 18

      // -------------------------------------------------------
      // TABLE HEADER
      // -------------------------------------------------------

      const xYear = 22
      const xAnnual = 65
      const xCumulative = 115
      const xReturn = 170

      pdf.setFillColor(
        0,
        45,
        73
      )

      pdf.rect(
        20,
        y - 4,
        pageWidth - 40,
        7,
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

      pdf.setFontSize(7)

      pdf.text(
        "YEAR",
        xYear,
        y
      )

      pdf.text(
        "ANNUAL SAVING",
        xAnnual,
        y
      )

      pdf.text(
        "CUMULATIVE SAVING",
        xCumulative,
        y
      )

      pdf.text(
        "CUMULATIVE RETURN",
        xReturn,
        y
      )

      y += 7

      // -------------------------------------------------------
      // TABLE ROWS
      // -------------------------------------------------------

      breakdown.forEach(
        (row, index) => {
          if (
            y >
            pageHeight - 22
          ) {
            pdf.addPage()
            y = 20

            pdf.setFillColor(
              0,
              45,
              73
            )

            pdf.rect(
              20,
              y - 4,
              pageWidth - 40,
              7,
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

            pdf.setFontSize(7)

            pdf.text(
              "YEAR",
              xYear,
              y
            )

            pdf.text(
              "ANNUAL SAVING",
              xAnnual,
              y
            )

            pdf.text(
              "CUMULATIVE SAVING",
              xCumulative,
              y
            )

            pdf.text(
              "CUMULATIVE RETURN",
              xReturn,
              y
            )

            y += 7
          }

          if (
            index % 2 === 0
          ) {
            pdf.setFillColor(
              247,
              248,
              249
            )

            pdf.rect(
              20,
              y - 4,
              pageWidth - 40,
              6,
              "F"
            )
          }

          pdf.setTextColor(
            50,
            50,
            50
          )

          pdf.setFont(
            "helvetica",
            "normal"
          )

          pdf.setFontSize(7)

          pdf.text(
            `Year ${row.year}`,
            xYear,
            y
          )

          pdf.text(
            money(
              row.annualSaving
            ),
            xAnnual,
            y
          )

          pdf.text(
            money(
              row.cumulativeSavings
            ),
            xCumulative,
            y
          )

          pdf.text(
            money(
              row.cumulativeCashflow
            ),
            xReturn,
            y
          )

          y += 6
        }
      )
    }
  }

  // =========================================================
  // FOOTER
  // =========================================================

  addFooter()

  // =========================================================
  // DOWNLOAD
  // =========================================================

  const customerName =
    String(
      appointment.name ||
        "Customer"
    )
      .replace(
        /[^a-z0-9]+/gi,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      )

  pdf.save(
    `HomeShield-${customerName}-EPVS.pdf`
  )
}
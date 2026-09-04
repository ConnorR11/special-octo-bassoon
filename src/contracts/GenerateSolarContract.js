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

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

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

  // =========================================================
  // HEADER
  // =========================================================

  pdf.setFillColor(0, 45, 73)

  pdf.rect(
    0,
    0,
    pageWidth,
    32,
    "F"
  )

  pdf.setTextColor(255, 255, 255)

  pdf.setFontSize(20)
  pdf.setFont("helvetica", "bold")

  pdf.text(
    "HomeShield",
    20,
    14
  )

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")

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

  pdf.setTextColor(0, 0, 0)

  y = 45

  // =========================================================
  // CUSTOMER
  // =========================================================

  pdf.setFontSize(14)
  pdf.setFont("helvetica", "bold")

  pdf.text(
    "Customer",
    20,
    y
  )

  y += 8

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")

  const customerRows = [
    [
      "Name",
      appointment.name ||
        epvsCalculation?.data?.customerName ||
        "—",
    ],
    [
      "Address",
      appointment.address ||
        epvsCalculation?.data?.address ||
        "—",
    ],
    [
      "Postcode",
      appointment.postcode ||
        epvsCalculation?.data?.postcode ||
        "—",
    ],
    [
      "Phone",
      appointment.phone || "—",
    ],
    [
      "Email",
      appointment.email || "—",
    ],
  ]

  customerRows.forEach(([label, value]) => {
    pdf.setFont("helvetica", "bold")

    pdf.text(
      `${label}:`,
      20,
      y
    )

    pdf.setFont("helvetica", "normal")

    pdf.text(
      String(value),
      55,
      y
    )

    y += 6
  })

  y += 6

  // =========================================================
  // APPOINTMENT
  // =========================================================

  pdf.setFont("helvetica", "bold")
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
      appointment.job_type || "—",
    ],
    [
      "Salesperson",
      appointment.salesperson || "—",
    ],
    [
      "Result",
      "Sold",
    ],
  ]

  appointmentRows.forEach(([label, value]) => {
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
  })

  // =========================================================
  // EPVS
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
            data.annualConsumption || 0
          )
        ).toLocaleString("en-GB")} kWh`,
      ],
      [
        "Estimated generation",
        `${Math.round(
          Number(
            results.generation || 0
          )
        ).toLocaleString("en-GB")} kWh`,
      ],
      [
        "Solar self-consumption",
        `${Math.round(
          Number(
            results.solarSelfConsumption || 0
          )
        ).toLocaleString("en-GB")} kWh`,
      ],
      [
        "Battery",
        data.batteryEnabled
          ? `${Number(
              data.batteryCapacity || 0
            )} kWh`
          : "Not included",
      ],
      [
        "Battery contribution",
        `${Math.round(
          Number(
            results.batteryContribution || 0
          )
        ).toLocaleString("en-GB")} kWh`,
      ],
      [
        "Estimated export",
        `${Math.round(
          Number(
            results.exportKwh || 0
          )
        ).toLocaleString("en-GB")} kWh`,
      ],
      [
        "Inverter",
        `${Number(
          data.inverterCapacity || 0
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
        `£${Math.round(
          Number(
            results.annualSaving || 0
          )
        ).toLocaleString("en-GB")}`,
      ],
      [
        "System cost",
        `£${Math.round(
          Number(
            data.systemCost || 0
          )
        ).toLocaleString("en-GB")}`,
      ],
      [
        "Deposit",
        `£${Math.round(
          Number(
            data.deposit || 0
          )
        ).toLocaleString("en-GB")}`,
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
        `£${Math.round(
          Number(
            results.monthlyPayment || 0
          )
        ).toLocaleString("en-GB")}`,
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

    // =======================================================
    // EPVS TABLE
    // =======================================================

    const tableX = 20
    const labelX = 23
    const valueX = pageWidth - 23
    const rowHeight = 6
    const tableWidth = pageWidth - 40

    epvsRows.forEach(
      ([label, value], index) => {
        if (
          y >
          pageHeight - 25
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
    // FOOTER NOTE
    // =======================================================

    y += 8

    if (
      y >
      pageHeight - 25
    ) {
      pdf.addPage()
      y = 20
    }

    pdf.setFontSize(8)

    pdf.setTextColor(
      120,
      120,
      120
    )

    pdf.setFont(
      "helvetica",
      "italic"
    )

    pdf.text(
      "This document contains the EPVS calculation information recorded for this appointment.",
      20,
      y
    )
  }

  // =========================================================
  // FOOTER ON ALL PAGES
  // =========================================================

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
        appointment.appointment_row_id || ""
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

  // =========================================================
  // DOWNLOAD
  // =========================================================

  const customerName =
    String(
      appointment.name || "Customer"
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
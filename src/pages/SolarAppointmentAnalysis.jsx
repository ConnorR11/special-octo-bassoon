import React, { useEffect, useMemo, useState } from "react"
import { CalendarDays, Download, RefreshCw, Search } from "lucide-react"
import jsPDF from "jspdf"
import { supabase } from "../lib/supabase"

function londonDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  )

  return `${values.year}-${values.month}-${values.day}`
}

function shiftDays(value, amount) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + amount)
  return londonDate(date)
}

function periodDates(period) {
  const today = londonDate()
  const current = new Date(`${today}T12:00:00`)
  const day = current.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(current)
  monday.setDate(monday.getDate() + mondayOffset)

  if (period === "today") return { start: today, end: today }

  if (period === "this-week") {
    return { start: londonDate(monday), end: today }
  }

  if (period === "last-week") {
    const start = new Date(monday)
    start.setDate(start.getDate() - 7)
    const end = new Date(monday)
    end.setDate(end.getDate() - 1)
    return { start: londonDate(start), end: londonDate(end) }
  }

  if (period === "this-month") {
    return {
      start: `${today.slice(0, 7)}-01`,
      end: today,
    }
  }

  if (period === "last-month") {
    const start = new Date(current.getFullYear(), current.getMonth() - 1, 1, 12)
    const end = new Date(current.getFullYear(), current.getMonth(), 0, 12)
    return { start: londonDate(start), end: londonDate(end) }
  }

  if (period === "year-to-date") {
    return { start: `${today.slice(0, 4)}-01-01`, end: today }
  }

  return { start: "", end: "" }
}

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return date.toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function normalise(value) {
  return String(value ?? "").trim().toLowerCase()
}

function isSolarAppointment(appointment) {
  if (!appointment) return false
  if (appointment.epvs_calculation) return true

  return [
    appointment.product,
    appointment.job_type,
  ].some((value) => normalise(value).includes("solar"))
}

function hasAllocatedRep(appointment) {
  return String(appointment?.rep_allocated ?? "").trim() !== ""
}

function getEpvsData(appointment) {
  let calculation = appointment?.epvs_calculation || null

  if (typeof calculation === "string") {
    try {
      calculation = JSON.parse(calculation)
    } catch {
      calculation = null
    }
  }

  return calculation?.data || {}
}

function formatElectricityValue(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "—"
  return String(value) + suffix
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "—"
  const amount = Number(value)
  if (!Number.isFinite(amount)) return "—"
  return "£" + amount.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function getSystemDesign(appointment) {
  let calculation = appointment?.epvs_calculation || null

  if (typeof calculation === "string") {
    try {
      calculation = JSON.parse(calculation)
    } catch {
      calculation = null
    }
  }

  const data = calculation?.data || {}
  const results = calculation?.results || {}
  const arrays = Array.isArray(data.arrays) ? data.arrays : []
  const panelCount = arrays.reduce(
    (total, array) => total + Math.max(0, Number(array?.panelCount || 0)),
    0
  )

  return {
    panelCount,
    generation: Number(results?.generation || 0),
    batteryCapacity: Number(data?.batteryCapacity || 0),
    inverterCapacity: Number(data?.inverterCapacity || 0),
  }
}

function getPricing(appointment) {
  let calculation = appointment?.epvs_calculation || null

  if (typeof calculation === "string") {
    try {
      calculation = JSON.parse(calculation)
    } catch {
      calculation = null
    }
  }

  const data = calculation?.data || {}
  const results = calculation?.results || {}

  return {
    method: data?.paymentMethod || "—",
    cost: data?.systemCost,
    monthlyPayment: results?.monthlyPayment,
    totalCost: results?.totalContractValue,
  }
}

function getThirtyYearEpvs(appointment) {
  let calculation = appointment?.epvs_calculation || null

  if (typeof calculation === "string") {
    try {
      calculation = JSON.parse(calculation)
    } catch {
      calculation = null
    }
  }

  const projection = calculation?.thirtyYearProjection || {}
  const scenarios = projection?.scenarios || {}
  const scenario =
    scenarios?.averageInflation ||
    scenarios?.midpointInflation ||
    scenarios?.noInflation ||
    null

  const rows = Array.isArray(scenario?.rows) ? scenario.rows : []

  // Match the 30 Year EPVS breakdown exactly:
  // cumulative benefit is the sum of the four benefit components,
  // while yearly payments are added separately.
  let cumulativeBenefit = 0
  let totalPayments = 0
  let paybackPeriod = null

  rows.forEach((row) => {
    const annualBenefit =
      Number(row?.solarBenefit ?? row?.solar ?? 0) +
      Number(row?.batterySelfConsumptionBenefit ?? 0) +
      Number(row?.forceChargeBenefit ?? 0) +
      Number(row?.exportBenefit ?? 0)

    const yearlyPayment = Number(
      row?.yearlyPayment ?? row?.payment ?? 0
    )

    cumulativeBenefit += annualBenefit
    totalPayments += yearlyPayment

    const displayNetPosition = totalPayments + cumulativeBenefit

    if (paybackPeriod == null && displayNetPosition >= 0) {
      paybackPeriod = Number(row?.year || 0)
    }
  })

  const finalNetPosition = rows.length
    ? cumulativeBenefit + totalPayments
    : null

  return {
    paybackPeriod,
    netPosition: finalNetPosition,
    billPreInstall: scenario?.totals?.billPreInstall ?? rows.reduce(
      (total, row) => total + Number(row?.billPreInstall || 0),
      0
    ),
  }
}

export default function SolarAppointmentAnalysis({ onSelectAppointment }) {
  const initial = periodDates("today")
  const [period, setPeriod] = useState("today")
  const [startDate, setStartDate] = useState(initial.start)
  const [endDate, setEndDate] = useState(initial.end)
  const [appointments, setAppointments] = useState([])
  const [profiles, setProfiles] = useState([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function loadAppointments(range = { start: startDate, end: endDate }) {
    if (!supabase) {
      setError("Supabase is not configured.")
      return
    }

    if ((range.start && !range.end) || (!range.start && range.end) || (range.start && range.end && range.start > range.end)) {
      setError("Please enter a valid date range.")
      return
    }

    setLoading(true)
    setError("")

    try {
      let request = supabase
        .from("appointments")
        .select("appointment_row_id,name,appointment_date,rep_allocated,result,product,job_type,epvs_calculation")
        .not("rep_allocated", "is", null)
        .neq("rep_allocated", "")
        .order("appointment_date", { ascending: false })

      if (range.start) {
        request = request.gte("appointment_date", `${range.start}T00:00:00`)
      }

      if (range.end) {
        const endExclusive = new Date(`${range.end}T12:00:00`)
        endExclusive.setDate(endExclusive.getDate() + 1)
        const endExclusiveString = `${endExclusive.getFullYear()}-${String(endExclusive.getMonth() + 1).padStart(2, "0")}-${String(endExclusive.getDate()).padStart(2, "0")}T00:00:00`
        request = request.lt("appointment_date", endExclusiveString)
      }

      const [appointmentsResult, profilesResult] = await Promise.all([
        request,
        supabase.from("profiles").select("email,full_name,display_name").order("full_name", { ascending: true }),
      ])

      if (appointmentsResult.error) throw appointmentsResult.error
      if (profilesResult.error) throw profilesResult.error

      setAppointments((appointmentsResult.data || []).filter(isSolarAppointment))
      setProfiles(profilesResult.data || [])
    } catch (err) {
      console.error("Error loading solar appointment analysis:", err)
      setError(err?.message || "Unable to load solar appointments.")
      setAppointments([])
      setProfiles([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAppointments(initial)
  }, [])

  const repNameByEmail = useMemo(() => {
    return profiles.reduce((map, profile) => {
      const email = normalise(profile.email)
      const name = String(profile.full_name || profile.display_name || "").trim()
      if (email && name) map[email] = name
      return map
    }, {})
  }, [profiles])

  const filteredAppointments = useMemo(() => {
    const query = normalise(search)
    if (!query) return appointments

    return appointments.filter((appointment) => {
      const rep = repNameByEmail[normalise(appointment.rep_allocated)] || appointment.rep_allocated || ""
      return [appointment.name, rep, appointment.result]
        .some((value) => normalise(value).includes(query))
    })
  }, [appointments, repNameByEmail, search])

  function selectPeriod(value) {
    const dates = periodDates(value)
    setPeriod(value)
    setStartDate(dates.start)
    setEndDate(dates.end)
    loadAppointments(dates)
  }

  function setCustomStart(value) {
    setPeriod("custom")
    setStartDate(value)
  }

  function setCustomEnd(value) {
    setPeriod("custom")
    setEndDate(value)
  }

  const rangeLabel = period === "all"
    ? "All time"
    : startDate && endDate
      ? `${formatDate(startDate)} – ${formatDate(endDate)}`
      : "Custom range"

  function exportPdf() {
    if (!filteredAppointments.length) return

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
    const margin = 7
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const usableWidth = pageWidth - margin * 2
    const headers = [
      "Appointment", "Date", "Sales Rep", "Result",
      "Consumption", "Import", "Export", "Standing",
      "Panels", "Generation", "Battery", "Inverter",
      "Day Export", "Flux Export", "Peak Export",
      "Method", "Cost", "Payment", "Total cost",
      "Payback", "Net Position", "Pre Install"
    ]
    const groups = [
      { label: "", span: 4 },
      { label: "Current Electricity", span: 4 },
      { label: "System Design", span: 4 },
      { label: "Octopus Rates", span: 3 },
      { label: "Pricing", span: 4 },
      { label: "30 year EPVS", span: 3 },
    ]
    const rows = filteredAppointments.map((appointment) => {
      const rep = repNameByEmail[normalise(appointment.rep_allocated)] || appointment.rep_allocated || "—"
      const epvsData = getEpvsData(appointment)
      const systemDesign = getSystemDesign(appointment)
      const pricing = getPricing(appointment)
      const thirtyYearEpvs = getThirtyYearEpvs(appointment)
      return [
        appointment.name || "—", formatDate(appointment.appointment_date), rep, appointment.result || "—",
        formatElectricityValue(epvsData.annualConsumption),
        formatElectricityValue(epvsData.importRate, "p"),
        formatElectricityValue(epvsData.exportRate, "p"),
        formatElectricityValue(epvsData.standingCharge, "p"),
        systemDesign.panelCount || "—",
        systemDesign.generation ? Math.round(systemDesign.generation) + " kWh" : "—",
        systemDesign.batteryCapacity ? Number(systemDesign.batteryCapacity).toFixed(2) + " kWh" : "—",
        systemDesign.inverterCapacity ? String(systemDesign.inverterCapacity) + " kW" : "—",
        formatElectricityValue(epvsData.fluxDayExport, "p"),
        formatElectricityValue(epvsData.fluxExport, "p"),
        formatElectricityValue(epvsData.fluxPeakExport, "p"),
        pricing.method,
        pricing.cost != null ? "£" + Math.round(Number(pricing.cost)).toLocaleString("en-GB") : "—",
        formatMoney(pricing.monthlyPayment),
        pricing.totalCost != null ? "£" + Math.round(Number(pricing.totalCost)).toLocaleString("en-GB") : "—",
        thirtyYearEpvs.paybackPeriod != null ? Math.round(Number(thirtyYearEpvs.paybackPeriod)) + "y" : "—",
        formatMoney(thirtyYearEpvs.netPosition),
        formatMoney(thirtyYearEpvs.billPreInstall),
      ]
    })

    const columnWidths = [25, 18, 24, 20, 19, 16, 16, 18, 13, 19, 18, 17, 17, 18, 17, 18, 18, 18, 21, 15, 21, 21]
    const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0)
    const scale = usableWidth / totalWidth
    const widths = columnWidths.map((width) => width * scale)
    const rowHeight = 6.2
    const groupHeight = 7
    const headerHeight = 8

    function drawHeader(y) {
      let x = margin
      doc.setFont("helvetica", "bold")
      doc.setFontSize(5.5)
      doc.setFillColor(248, 250, 252)
      doc.setTextColor(15, 23, 42)
      let columnIndex = 0
      groups.forEach((group) => {
        const width = widths.slice(columnIndex, columnIndex + group.span).reduce((a, b) => a + b, 0)
        doc.rect(x, y, width, groupHeight, "F")
        doc.setDrawColor(219, 227, 236)
        doc.rect(x, y, width, groupHeight)
        if (group.label) doc.text(group.label, x + 1.5, y + 4.5)
        x += width
        columnIndex += group.span
      })

      y += groupHeight
      x = margin
      doc.setFillColor(87, 87, 87)
      doc.setTextColor(255, 255, 255)
      headers.forEach((header, index) => {
        doc.rect(x, y, widths[index], headerHeight, "F")
        doc.text(header, x + 1.2, y + 5.2, { maxWidth: widths[index] - 2.4 })
        x += widths[index]
      })
      return y + headerHeight
    }

    doc.setFont("helvetica", "bold")
    doc.setFontSize(16)
    doc.setTextColor(15, 23, 42)
    doc.text("Solar Appointment Analysis", margin, 10)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(100, 116, 139)
    doc.text(`${filteredAppointments.length} solar appointments · ${rangeLabel}${search ? ` · Search: "${search}"` : ""}`, margin, 14.5)

    let y = 19
    y = drawHeader(y)
    doc.setFontSize(5.6)

    rows.forEach((row, rowIndex) => {
      if (y + rowHeight > pageHeight - 7) {
        doc.addPage()
        y = 8
        y = drawHeader(y)
      }
      const separatorIndexes = new Set([4, 8, 12, 15, 19])
      let x = margin
      doc.setFillColor(rowIndex % 2 === 0 ? 255 : 248, rowIndex % 2 === 0 ? 255 : 250, rowIndex % 2 === 0 ? 255 : 252)
      row.forEach((value, index) => {
        doc.rect(x, y, widths[index], rowHeight, "F")
        doc.setDrawColor(232, 237, 242)
        doc.line(x, y + rowHeight, x + widths[index], y + rowHeight)
        if (separatorIndexes.has(index)) {
          doc.setDrawColor(0, 0, 0)
          doc.setLineWidth(0.8)
          doc.line(x, y, x, y + rowHeight)
          doc.setLineWidth(0.2)
        }
        doc.setTextColor(index === 0 || index === 3 ? 15 : 51, index === 0 || index === 3 ? 23 : 65, index === 0 || index === 3 ? 42 : 85)
        doc.setFont("helvetica", index === 0 || index === 3 ? "bold" : "normal")
        doc.text(String(value), x + 1.2, y + 4.1, { maxWidth: widths[index] - 2.4 })
        x += widths[index]
      })
      y += rowHeight
    })

    const filename = `solar-analysis-${startDate || "all"}-${endDate || "time"}.pdf`
    doc.save(filename)
  }

  return (
    <section className="solar-analysis-page">
      <style>{`
        .solar-analysis-page{min-height:100%;padding:28px 32px 40px;background:#f5f7fa;color:#0f172a;box-sizing:border-box}
        .solar-analysis-container{max-width:1500px;margin:0 auto}
        .solar-analysis-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:18px}
        .solar-analysis-eyebrow{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#0877bd;margin-bottom:6px}
        .solar-analysis-heading{margin:0;font-size:30px;line-height:1.1;font-weight:750;letter-spacing:-.025em}
        .solar-analysis-subtitle{margin:6px 0 0;color:#64748b;font-size:13px}
        .solar-analysis-export{height:36px;padding:0 13px;border:1px solid #0877bd;border-radius:8px;background:#0877bd;color:#fff;font-weight:700;font-size:12px;display:inline-flex;align-items:center;gap:7px;cursor:pointer}.solar-analysis-export:disabled{opacity:.5;cursor:default}\n        .solar-analysis-refresh{height:38px;padding:0 13px;border:1px solid #d7dee7;border-radius:8px;background:#fff;color:#475569;font-weight:700;font-size:12px;display:inline-flex;align-items:center;gap:7px;cursor:pointer}
        .solar-analysis-refresh:disabled{opacity:.6;cursor:default}
        .solar-analysis-controls{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:16px;box-shadow:0 2px 8px rgba(15,23,42,.04)}
        .solar-analysis-periods{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:11px}
        .solar-analysis-period{height:36px;padding:0 13px;border:1px solid #d7dee7;border-radius:8px;background:#fff;color:#475569;font-weight:700;font-size:12px;cursor:pointer}
        .solar-analysis-period.active{background:#0877bd;border-color:#0877bd;color:#fff}
        .solar-analysis-custom{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap}
        .solar-analysis-field{display:flex;flex-direction:column;gap:5px}
        .solar-analysis-field span{font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.06em}
        .solar-analysis-input{height:36px;padding:0 9px;border:1px solid #d7dee7;border-radius:8px;background:#fff;color:#0f172a;font:inherit;font-size:12px;box-sizing:border-box}
        .solar-analysis-search{display:flex;align-items:center;gap:7px;height:36px;padding:0 10px;border:1px solid #d7dee7;border-radius:8px;background:#fff;min-width:240px}
        .solar-analysis-search svg{color:#64748b;flex:0 0 auto}
        .solar-analysis-search input{border:0;outline:0;background:transparent;width:100%;font:inherit;font-size:12px;color:#0f172a}
        .solar-analysis-summary{display:flex;align-items:center;gap:8px;margin:0 0 12px;color:#64748b;font-size:12px;font-weight:600}
        .solar-analysis-summary strong{color:#0f172a}
        .solar-analysis-panel{background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 2px 10px rgba(15,23,42,.05);overflow:hidden}
        .solar-analysis-panel-header{padding:16px 20px;border-bottom:1px solid #e8edf2;display:flex;justify-content:space-between;align-items:center;gap:20px}
        .solar-analysis-panel-header h2{margin:0;font-size:17px;font-weight:750}
        .solar-analysis-panel-header span{font-size:11px;color:#64748b}
        .solar-analysis-table-wrap{overflow-x:auto}
        .solar-analysis-table{width:100%;border-collapse:collapse;font-size:12px}
        .solar-analysis-table th{background:#575757;color:#fff;padding:10px 12px;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}
        .solar-analysis-table th.solar-analysis-group{background:#f8fafc;color:#0f172a;border-bottom:1px solid #dbe3ec;font-size:11px;text-transform:none;letter-spacing:0}
        .solar-analysis-table th.solar-analysis-group-empty{background:#f8fafc;border-bottom:1px solid #dbe3ec}
        .solar-analysis-table th.solar-analysis-group:not(:first-of-type){border-left:4px solid #000}
        .solar-analysis-table th.solar-analysis-electricity-field:first-of-type{border-left:4px solid #000}
        .solar-analysis-table th.solar-analysis-design-field:first-of-type{border-left:4px solid #000}
        .solar-analysis-table th.solar-analysis-octopus-field:first-of-type{border-left:4px solid #000}
        .solar-analysis-table th.solar-analysis-pricing-field:first-of-type{border-left:4px solid #000}
        .solar-analysis-table th.solar-analysis-epvs-field:first-of-type{border-left:4px solid #000}
        .solar-analysis-table th.solar-analysis-electricity-field{background:#fff;color:#17366d;border-top:0;text-transform:none;font-size:11px;letter-spacing:0}
        .solar-analysis-table th.solar-analysis-design-field{background:#fff;color:#17366d;border-top:0;text-transform:none;font-size:11px;letter-spacing:0}
        .solar-analysis-table th.solar-analysis-octopus-field{background:#fff;color:#17366d;border-top:0;text-transform:none;font-size:11px;letter-spacing:0}
        .solar-analysis-table th.solar-analysis-pricing-field{background:#fff;color:#17366d;border-top:0;text-transform:none;font-size:11px;letter-spacing:0}
        .solar-analysis-table th.solar-analysis-epvs-field{background:#fff;color:#17366d;border-top:0;text-transform:none;font-size:11px;letter-spacing:0}
        .solar-analysis-table td{padding:11px 12px;border-top:1px solid #e8edf2;color:#334155;white-space:nowrap}
        .solar-analysis-table td:nth-child(5),
        .solar-analysis-table td:nth-child(9),
        .solar-analysis-table td:nth-child(13),
        .solar-analysis-table td:nth-child(16),
        .solar-analysis-table td:nth-child(20){border-left:4px solid #000}
        .solar-analysis-table tbody tr{cursor:pointer}
        .solar-analysis-table tbody tr:hover{background:#f8fafc}
        .solar-analysis-name{font-weight:750;color:#0f172a}
        .solar-analysis-result{font-weight:700}
        .solar-analysis-empty{text-align:center;padding:42px 20px;color:#64748b}
        .solar-analysis-error{margin-bottom:12px;padding:11px 13px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:12px}
        .solar-analysis-spin{animation:solar-analysis-spin 1s linear infinite}
        @keyframes solar-analysis-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @media(max-width:800px){.solar-analysis-page{padding:20px 14px}.solar-analysis-header{flex-direction:column}.solar-analysis-search{min-width:200px}}
      `}</style>

      <div className="solar-analysis-container">
        <div className="solar-analysis-header">
          <div>
            <div className="solar-analysis-eyebrow">Administration</div>
            <h1 className="solar-analysis-heading">Solar Appointment Analysis</h1>
            <p className="solar-analysis-subtitle">Analyse solar appointments with an allocated sales rep.</p>
          </div>
          <button type="button" className="solar-analysis-refresh" onClick={() => loadAppointments()} disabled={loading}>
            <RefreshCw size={14} className={loading ? "solar-analysis-spin" : ""}/>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="solar-analysis-controls">
          <div className="solar-analysis-periods">
            {[
              ["today", "Today"],
              ["this-week", "This week"],
              ["last-week", "Last week"],
              ["this-month", "This month"],
              ["last-month", "Last month"],
              ["year-to-date", "Year to date"],
              ["all", "All time"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`solar-analysis-period ${period === value ? "active" : ""}`}
                onClick={() => selectPeriod(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="solar-analysis-custom">
            <label className="solar-analysis-field">
              <span>From</span>
              <input className="solar-analysis-input" type="date" value={startDate} onChange={(event) => setCustomStart(event.target.value)}/>
            </label>
            <label className="solar-analysis-field">
              <span>To</span>
              <input className="solar-analysis-input" type="date" value={endDate} onChange={(event) => setCustomEnd(event.target.value)}/>
            </label>
            <div className="solar-analysis-search">
              <Search size={14}/>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search appointment, rep or result"/>
            </div>
          </div>
        </div>

        {error && <div className="solar-analysis-error">{error}</div>}

        <div className="solar-analysis-summary">
          <strong>{filteredAppointments.length}</strong>
          <span>solar appointments</span>
          <span>·</span>
          <span>{rangeLabel}</span>
        </div>

        <div className="solar-analysis-panel">
          <div className="solar-analysis-panel-header">
            <div>
              <h2>Appointments</h2>
              <span>Only appointments with an allocated sales rep are included.</span>
            </div>
          </div>

          <div className="solar-analysis-table-wrap">
            <table className="solar-analysis-table">
              <thead>
                <tr>
                  <th colSpan="4" className="solar-analysis-group-empty"></th>
                  <th colSpan="4" className="solar-analysis-group">Current Electricity</th>
                  <th colSpan="4" className="solar-analysis-group">System Design</th>
                  <th colSpan="3" className="solar-analysis-group">Octopus Rates</th>
                  <th colSpan="4" className="solar-analysis-group">Pricing</th>
                  <th colSpan="3" className="solar-analysis-group">30 year EPVS</th>
                </tr>
                <tr>
                  <th>Appointment</th>
                  <th>Date</th>
                  <th>Sales Rep</th>
                  <th>Result</th>
                  <th className="solar-analysis-electricity-field">Consumption</th>
                  <th className="solar-analysis-electricity-field">Import</th>
                  <th className="solar-analysis-electricity-field">Export</th>
                  <th className="solar-analysis-electricity-field">Standing</th>
                  <th className="solar-analysis-design-field">Panels</th>
                  <th className="solar-analysis-design-field">Generation</th>
                  <th className="solar-analysis-design-field">Battery</th>
                  <th className="solar-analysis-design-field">Inverter</th>
                  <th className="solar-analysis-octopus-field">Day Export</th>
                  <th className="solar-analysis-octopus-field">Flux Export</th>
                  <th className="solar-analysis-octopus-field">Peak Export</th>
                  <th className="solar-analysis-pricing-field">Method</th>
                  <th className="solar-analysis-pricing-field">Cost</th>
                  <th className="solar-analysis-pricing-field">Payment</th>
                  <th className="solar-analysis-pricing-field">Total cost</th>
                  <th className="solar-analysis-epvs-field">Payback</th>
                  <th className="solar-analysis-epvs-field">Net Position</th>
                  <th className="solar-analysis-epvs-field">Pre Install</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="22" className="solar-analysis-empty">Loading solar appointments...</td></tr>
                ) : filteredAppointments.length === 0 ? (
                  <tr><td colSpan="22" className="solar-analysis-empty">No solar appointments found for this period.</td></tr>
                ) : (
                  filteredAppointments.map((appointment) => {
                    const rep = repNameByEmail[normalise(appointment.rep_allocated)] || appointment.rep_allocated || "—"
                    const result = appointment.result || "—"
                    const epvsData = getEpvsData(appointment)
                    const systemDesign = getSystemDesign(appointment)
                    const pricing = getPricing(appointment)
                    const thirtyYearEpvs = getThirtyYearEpvs(appointment)

                    return (
                      <tr key={appointment.appointment_row_id} onClick={() => onSelectAppointment?.(appointment)}>
                        <td className="solar-analysis-name">{appointment.name || "—"}</td>
                        <td>{formatDate(appointment.appointment_date)}</td>
                        <td>{rep}</td>
                        <td className="solar-analysis-result">{result}</td>
                        <td>{formatElectricityValue(epvsData.annualConsumption)}</td>
                        <td>{formatElectricityValue(epvsData.importRate, "p")}</td>
                        <td>{formatElectricityValue(epvsData.exportRate, "p")}</td>
                        <td>{formatElectricityValue(epvsData.standingCharge, "p")}</td>
                        <td>{systemDesign.panelCount || "—"}</td>
                        <td>{systemDesign.generation ? Math.round(systemDesign.generation) + " kWh" : "—"}</td>
                        <td>{systemDesign.batteryCapacity ? Number(systemDesign.batteryCapacity).toFixed(2) + " kWh" : "—"}</td>
                        <td>{systemDesign.inverterCapacity ? String(systemDesign.inverterCapacity) + " kW" : "—"}</td>
                        <td>{formatElectricityValue(epvsData.fluxDayExport, "p")}</td>
                        <td>{formatElectricityValue(epvsData.fluxExport, "p")}</td>
                        <td>{formatElectricityValue(epvsData.fluxPeakExport, "p")}</td>
                        <td>{pricing.method}</td>
                        <td>{pricing.cost != null ? "£" + Math.round(Number(pricing.cost)).toLocaleString("en-GB") : "—"}</td>
                        <td>{formatMoney(pricing.monthlyPayment)}</td>
                        <td>{pricing.totalCost != null ? "£" + Math.round(Number(pricing.totalCost)).toLocaleString("en-GB") : "—"}</td>
                        <td>{thirtyYearEpvs.paybackPeriod != null ? Math.round(Number(thirtyYearEpvs.paybackPeriod)) + "y" : "—"}</td>
                        <td>{formatMoney(thirtyYearEpvs.netPosition)}</td>
                        <td>{formatMoney(thirtyYearEpvs.billPreInstall)}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}

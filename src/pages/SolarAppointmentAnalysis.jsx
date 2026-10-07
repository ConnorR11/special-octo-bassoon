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

const SOLAR_ANALYSIS_SELECTION_KEY = "solar-appointment-analysis-selection"

function getSavedSelection() {
  const fallback = periodDates("today")

  if (typeof window === "undefined") {
    return { period: "today", ...fallback }
  }

  try {
    const saved = JSON.parse(window.localStorage.getItem(SOLAR_ANALYSIS_SELECTION_KEY) || "null")

    if (
      saved &&
      typeof saved.period === "string" &&
      typeof saved.startDate === "string" &&
      typeof saved.endDate === "string"
    ) {
      return {
        period: saved.period,
        startDate: saved.startDate,
        endDate: saved.endDate,
      }
    }
  } catch {
    // Fall back to today if saved state cannot be read.
  }

  return { period: "today", ...fallback }
}

function saveSelection(period, startDate, endDate) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(
      SOLAR_ANALYSIS_SELECTION_KEY,
      JSON.stringify({ period, startDate, endDate })
    )
  } catch {
    // Ignore storage failures; the page still works normally.
  }
}

function periodDates(period) {
  const today = londonDate()
  const current = new Date(`${today}T12:00:00`)
  const day = current.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(current)
  monday.setDate(monday.getDate() + mondayOffset)

  if (period === "yesterday") {
    const yesterday = new Date(current)
    yesterday.setDate(yesterday.getDate() - 1)
    const value = londonDate(yesterday)
    return { start: value, end: value }
  }

  if (period === "today") return { start: today, end: today }

  if (period === "tomorrow") {
    const tomorrow = new Date(current)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const value = londonDate(tomorrow)
    return { start: value, end: value }
  }

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

function formatDateTime(value) {
  if (!value) return "—"

  // Appointment times in the CRM are stored as the local appointment clock time.
  // Do not convert the value through UTC/BST, otherwise UK summer time adds an hour.
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (match) {
    const [, year, month, day, hour, minute] = match
    const date = new Date(Number(year), Number(month) - 1, Number(day))
    return `${day} ${date.toLocaleString("en-GB", { month: "short" })} ${year}, ${hour}:${minute}`
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function normalise(value) {
  return String(value ?? "").trim().toLowerCase()
}

function isSolarAppointment(appointment) {
  return normalise(appointment?.job_type) === "solar"
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
  const openSolar = data?.openSolar || {}
  const openSolarArrays = Array.isArray(openSolar?.arrays) ? openSolar.arrays : []
  const arrays = Array.isArray(data.arrays) ? data.arrays : []
  const designArrays = openSolarArrays.length ? openSolarArrays : arrays

  const panelCount = designArrays.reduce(
    (total, array) => total + Math.max(0, Number(array?.panelCount || 0)),
    0
  )

  const systemSize = designArrays.reduce((total, array) => {
    const panelWattage = Number(array?.panelWattage || array?.panel_wattage || 0)
    const count = Number(array?.panelCount || 0)
    return total + (panelWattage * count) / 1000
  }, 0)

  const openSolarGeneration = openSolarArrays.reduce((total, array) => {
    const panelWattage = Number(array?.panelWattage || 0)
    const count = Number(array?.panelCount || 0)
    const irradiance = Number(array?.irradiance || 0)
    const shading = Number(array?.shading ?? 1)
    const systemSize = (panelWattage * count) / 1000
    return total + systemSize * irradiance * shading
  }, 0)

  const shadingWeightedTotal = designArrays.reduce((total, array) => {
    const panelWattage = Number(array?.panelWattage || array?.panel_wattage || 0)
    const count = Number(array?.panelCount || 0)
    const shading = Number(array?.shading ?? 1)
    const arraySize = (panelWattage * count) / 1000
    return total + arraySize * shading
  }, 0)

  const shadingFactor = systemSize > 0 ? shadingWeightedTotal / systemSize : 0

  const hardware = openSolar?.hardware || {}
  const batteries = Array.isArray(hardware?.batteries) ? hardware.batteries : []
  const inverters = Array.isArray(hardware?.inverters) ? hardware.inverters : []

  const openSolarBatteryCapacity = batteries.reduce(
    (total, item) =>
      total +
      Number(item?.capacity || 0) * Math.max(1, Number(item?.quantity || 1)),
    0
  )

  const openSolarInverterCapacity = inverters.reduce(
    (total, item) =>
      total +
      Number(item?.capacity || 0) * Math.max(1, Number(item?.quantity || 1)),
    0
  )

  return {
    panelCount,
    systemSize: systemSize || Number(data?.systemSize || data?.system_size || 0),
    shadingFactor: shadingFactor || Number(data?.shadingFactor || data?.shading_factor || 0),
    generation: openSolarArrays.length ? openSolarGeneration : Number(results?.generation || 0),
    batteryCapacity: openSolarArrays.length ? openSolarBatteryCapacity : Number(data?.batteryCapacity || 0),
    inverterCapacity: openSolarArrays.length ? openSolarInverterCapacity : Number(data?.inverterCapacity || 0),
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

function isEmptyDisplayValue(value) {
  return value === null || value === undefined || value === "" || value === "—"
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

export default function SolarAppointmentAnalysis({ onSelectAppointment, embedded = false }) {
  const initial = getSavedSelection()
  const [period, setPeriod] = useState(initial.period)
  const [startDate, setStartDate] = useState(initial.startDate)
  const [endDate, setEndDate] = useState(initial.endDate)
  const [appointments, setAppointments] = useState([])
  const [profiles, setProfiles] = useState([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [collapsedGroups, setCollapsedGroups] = useState({})

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
        .select("*")
        .eq("job_type", "Solar")
        .gte("appointment_date", "2026-01-01T00:00:00")
        .order("appointment_date", { ascending: true })


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

      setAppointments(appointmentsResult.data || [])
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
    saveSelection(value, dates.start, dates.end)
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

  function applyCustomDates() {
    saveSelection("custom", startDate, endDate)
    loadAppointments({ start: startDate, end: endDate })
  }

  const rangeLabel = period === "all"
    ? "All time"
    : startDate && endDate
      ? `${formatDate(startDate)} – ${formatDate(endDate)}`
      : "Custom range"

  const analysisGroups = [
    { key: "electricity", label: "Current Electricity", fields: ["Consumption", "Import", "Export", "Standing"] },
    { key: "design", label: "System Design", fields: ["Panels", "System Size", "Shading Factor", "Generation", "Battery", "Inverter"] },
    { key: "octopus", label: "Octopus Rates", fields: ["Day Export", "Flux Export", "Peak Export"] },
    { key: "pricing", label: "Pricing", fields: ["Method", "Cost", "Payment", "Total cost"] },
    { key: "epvs", label: "30 year EPVS", fields: ["Payback", "Net Position", "Pre Install"] },
  ]

  function toggleGroup(key) {
    setCollapsedGroups((current) => ({ ...current, [key]: !current[key] }))
  }

  function exportPdf() {
    if (!filteredAppointments.length) return

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
    const margin = 7
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const usableWidth = pageWidth - margin * 2

    const headers = [
      "Appointment", "Date & time", "Sales Rep", "Result",
      "Consumption", "Import", "Export", "Standing",
      "Panels", "System Size", "Shading Factor", "Generation", "Battery", "Inverter",
      "Day Export", "Flux Export", "Peak Export",
      "Method", "Cost", "Payment", "Total cost",
      "Payback", "Net Position", "Pre Install"
    ]

    const groups = [
      { label: "", span: 4 },
      { label: "Current Electricity", span: 4 },
      { label: "System Design", span: 6 },
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
        appointment.name || "—",
        formatDateTime(appointment.appointment_date),
        rep,
        appointment.result || "—",
        formatElectricityValue(epvsData.annualConsumption),
        formatElectricityValue(epvsData.importRate, "p"),
        formatElectricityValue(epvsData.exportRate, "p"),
        formatElectricityValue(epvsData.standingCharge, "p"),
        systemDesign.panelCount || "—",
        systemDesign.systemSize ? Number(systemDesign.systemSize).toFixed(2) + " kW" : "—",
        systemDesign.shadingFactor ? Number(systemDesign.shadingFactor).toFixed(3) : "—",
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

    // Size each column from the content it actually needs. This keeps the
    // exported table as narrow as possible while keeping every value on one line.
    const fontSize = 5.4
    const horizontalPadding = 2.2
    const minColumnWidths = [17, 15, 18, 15, 14, 12, 12, 13, 10, 13, 13, 14, 14, 13, 13, 14, 13, 14, 14, 14, 16, 12, 16, 16]

    doc.setFont("helvetica", "normal")
    doc.setFontSize(fontSize)

    const naturalWidths = headers.map((header, index) => {
      let maxWidth = doc.getTextWidth(header)
      rows.forEach((row) => {
        const value = String(row[index] ?? "")
        doc.setFont("helvetica", index === 0 || index === 3 ? "bold" : "normal")
        maxWidth = Math.max(maxWidth, doc.getTextWidth(value))
      })
      return Math.max(maxWidth + horizontalPadding, minColumnWidths[index])
    })

    const naturalTotal = naturalWidths.reduce((sum, width) => sum + width, 0)
    const scale = naturalTotal > usableWidth ? usableWidth / naturalTotal : 1
    const widths = naturalWidths.map((width) => width * scale)

    const rowHeight = 6.2
    const groupHeight = 7
    const headerHeight = 8
    const separatorIndexes = new Set([4, 9, 13, 16, 20])

    function drawHeader(y) {
      let x = margin
      let columnIndex = 0

      doc.setFont("helvetica", "bold")
      doc.setFontSize(5.5)

      groups.forEach((group) => {
        const width = widths.slice(columnIndex, columnIndex + group.span).reduce((a, b) => a + b, 0)

        doc.setFillColor(248, 250, 252)
        doc.setDrawColor(203, 213, 225)
        doc.setLineWidth(0.35)
        doc.rect(x, y, width, groupHeight, "FD")

        if (group.label) {
          doc.setTextColor(23, 54, 109)
          doc.text(group.label, x + 1.5, y + 4.5, { maxWidth: width - 3 })
        }

        x += width
        columnIndex += group.span

        // Keep the same strong section separators through the group header.
        if (columnIndex < headers.length) {
          doc.setDrawColor(0, 0, 0)
          doc.setLineWidth(0.8)
          doc.line(x, y, x, y + groupHeight)
        }
      })

      y += groupHeight
      x = margin

      headers.forEach((header, index) => {
        doc.setFillColor(87, 87, 87)
        doc.setDrawColor(203, 213, 225)
        doc.setLineWidth(0.35)
        doc.rect(x, y, widths[index], headerHeight, "FD")

        doc.setTextColor(255, 255, 255)
        doc.setFont("helvetica", "bold")
        doc.setFontSize(4.8)
        doc.text(header, x + 1.1, y + 5.2, { maxWidth: widths[index] - 2.2 })

        x += widths[index]

        // Continue section separators through the column-header row.
        if (separatorIndexes.has(index + 1)) {
          doc.setDrawColor(0, 0, 0)
          doc.setLineWidth(0.8)
          doc.line(x, y, x, y + headerHeight)
        }
      })

      return y + headerHeight
    }

    doc.setTextColor(15, 23, 42)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(16)
    doc.text("Solar Appointment Analysis", margin, 10)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(100, 116, 139)
    doc.text(
      `${filteredAppointments.length} solar appointments · ${rangeLabel}${search ? ` · Search: "${search}"` : ""}`,
      margin,
      14.5
    )

    let y = 19
    y = drawHeader(y)

    rows.forEach((row, rowIndex) => {
      if (y + rowHeight > pageHeight - 7) {
        doc.addPage()
        y = 8
        y = drawHeader(y)
      }

      let x = margin

      row.forEach((value, index) => {
        // Explicitly reset the fill for every cell so jsPDF cannot carry
        // the header/group fill state into the body.
        if (isEmptyDisplayValue(String(value))) {
          doc.setFillColor(254, 242, 242)
        } else {
          doc.setFillColor(255, 255, 255)
        }
        doc.setDrawColor(203, 213, 225)
        doc.setLineWidth(0.35)
        doc.rect(x, y, widths[index], rowHeight, "FD")

        if (separatorIndexes.has(index)) {
          doc.setDrawColor(0, 0, 0)
          doc.setLineWidth(0.8)
          doc.line(x, y, x, y + rowHeight)
          doc.setLineWidth(0.2)
        }

        doc.setTextColor(51, 65, 85)
        doc.setFont("helvetica", index === 0 || index === 3 ? "bold" : "normal")
        doc.setFontSize(fontSize)
        doc.text(String(value), x + 1.1, y + 4.1, { maxWidth: widths[index] - 2.2 })

        x += widths[index]
      })

      y += rowHeight
    })

    const filename = `solar-analysis-${startDate || "all"}-${endDate || "time"}.pdf`
    doc.save(filename)
  }

  return (
    <section className={`solar-analysis-page ${embedded ? "solar-analysis-embedded" : ""}`}>
      <style>{`
        .solar-analysis-page{min-height:100%;padding:28px 32px 40px;background:#f5f7fa;color:#0f172a;box-sizing:border-box}.solar-analysis-page.solar-analysis-embedded{padding:0;background:transparent;min-height:auto}.solar-analysis-page.solar-analysis-embedded .solar-analysis-container{max-width:none}
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
        .solar-analysis-apply{height:36px;padding:0 13px;border:1px solid #0877bd;border-radius:8px;background:#fff;color:#0877bd;font-weight:700;font-size:12px;cursor:pointer}.solar-analysis-apply:disabled{opacity:.5;cursor:default}
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
        .solar-analysis-table{width:max-content;min-width:100%;border-collapse:separate;border-spacing:0;font-size:12px}
        .solar-analysis-table th,.solar-analysis-table td{box-sizing:border-box}
        .solar-analysis-table th{background:#575757;color:#fff;padding:10px 12px;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}
        .solar-analysis-table th:first-child,.solar-analysis-table td:first-child{position:sticky;left:0;z-index:4;background:#fff;box-shadow:2px 0 5px rgba(15,23,42,.08)}
        .solar-analysis-table thead th:first-child{background:#575757;z-index:7}
        .solar-analysis-table thead tr:first-child th:first-child{background:#f8fafc}
        .solar-analysis-table tbody tr:hover td:first-child{background:#f8fafc}
        .solar-analysis-table th.solar-analysis-group{background:#f8fafc;color:#0f172a;border-bottom:1px solid #dbe3ec;font-size:11px;text-transform:none;letter-spacing:0}
        .solar-analysis-table th.solar-analysis-group-empty{background:#f8fafc;border-bottom:1px solid #dbe3ec}
        .solar-analysis-group-button{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:0;border:0;background:transparent;color:inherit;font:inherit;font-weight:750;cursor:pointer;text-align:left}
        .solar-analysis-group-button svg{flex:0 0 auto}
        .solar-analysis-group-collapsed{width:42px;min-width:42px;padding:0 7px}
        .solar-analysis-group-collapsed .solar-analysis-group-button{justify-content:center}
        .solar-analysis-group-collapsed .solar-analysis-group-label{display:none}
        .solar-analysis-collapsed-cell{padding:0!important;width:42px;min-width:42px;max-width:42px;text-align:center;color:#94a3b8;background:#fff!important}
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
        .solar-analysis-table td{padding:11px 12px;border-top:1px solid #e8edf2;color:#334155;white-space:nowrap}.solar-analysis-table td.solar-analysis-empty-field{background:#fef2f2;color:#991b1b}
        .solar-analysis-table td.solar-analysis-group-start{border-left:4px solid #000}
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
        {!embedded && <div className="solar-analysis-header">
          <div>
            <div className="solar-analysis-eyebrow">Administration</div>
            <h1 className="solar-analysis-heading">Solar Appointment Analysis</h1>
            <p className="solar-analysis-subtitle">Analyse solar appointments with an allocated sales rep.</p>
          </div>
          <button type="button" className="solar-analysis-refresh" onClick={() => loadAppointments()} disabled={loading}>
            <RefreshCw size={14} className={loading ? "solar-analysis-spin" : ""}/>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>}

        <div className="solar-analysis-controls">
          <div className="solar-analysis-periods">
            {[
              ["yesterday", "Yesterday"],
              ["today", "Today"],
              ["tomorrow", "Tomorrow"],
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
            <button type="button" className="solar-analysis-apply" onClick={applyCustomDates} disabled={loading}>Apply dates</button>

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
              <span>Appointments from 2026 onward.</span>
            </div>
            <button type="button" className="solar-analysis-export" onClick={exportPdf} disabled={!filteredAppointments.length || loading}>
              <Download size={14}/>
              Export PDF
            </button>
          </div>

          <div className="solar-analysis-table-wrap">
            <table className="solar-analysis-table">
              <thead>
                <tr>
                  <th colSpan="4" className="solar-analysis-group-empty"></th>
                  {analysisGroups.map((group) => {
                    const collapsed = !!collapsedGroups[group.key]
                    return (
                      <th
                        key={group.key}
                        colSpan={collapsed ? 1 : group.fields.length}
                        className={"solar-analysis-group " + (collapsed ? "solar-analysis-group-collapsed" : "")}
                      >
                        <button
                          type="button"
                          className="solar-analysis-group-button"
                          onClick={() => toggleGroup(group.key)}
                          title={(collapsed ? "Expand " : "Collapse ") + group.label}
                        >
                          <span className="solar-analysis-group-label">{group.label}</span>
                          <span aria-hidden="true">{collapsed ? "›" : "‹"}</span>
                        </button>
                      </th>
                    )
                  })}
                </tr>
                <tr>
                  <th>Appointment</th>
                  <th>Date</th>
                  <th>Sales Rep</th>
                  <th>Result</th>
                  {analysisGroups.flatMap((group) => {
                    if (collapsedGroups[group.key]) {
                      return [<th key={group.key} className="solar-analysis-group-collapsed" aria-label={group.label}></th>]
                    }
                    return group.fields.map((field) => (
                      <th key={group.key + "-" + field} className={"solar-analysis-" + group.key + "-field"}>{field}</th>
                    ))
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="26" className="solar-analysis-empty">Loading solar appointments...</td></tr>
                ) : filteredAppointments.length === 0 ? (
                  <tr><td colSpan="26" className="solar-analysis-empty">No solar appointments found for this period.</td></tr>
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
                        <td>{formatDateTime(appointment.appointment_date)}</td>
                        <td>{rep}</td>
                        <td className="solar-analysis-result">{result}</td>
                        {[
                          {
                            key: "electricity",
                            values: [
                              formatElectricityValue(epvsData.annualConsumption),
                              formatElectricityValue(epvsData.importRate, "p"),
                              formatElectricityValue(epvsData.exportRate, "p"),
                              formatElectricityValue(epvsData.standingCharge, "p"),
                            ],
                          },
                          {
                            key: "design",
                            values: [
                              systemDesign.panelCount || "—",
                              systemDesign.systemSize ? Number(systemDesign.systemSize).toFixed(2) + " kW" : "—",
                              systemDesign.shadingFactor ? Number(systemDesign.shadingFactor).toFixed(3) : "—",
                              systemDesign.generation ? Math.round(systemDesign.generation) + " kWh" : "—",
                              systemDesign.batteryCapacity ? Number(systemDesign.batteryCapacity).toFixed(2) + " kWh" : "—",
                              systemDesign.inverterCapacity ? String(systemDesign.inverterCapacity) + " kW" : "—",
                            ],
                          },
                          {
                            key: "octopus",
                            values: [
                              formatElectricityValue(epvsData.fluxDayExport, "p"),
                              formatElectricityValue(epvsData.fluxExport, "p"),
                              formatElectricityValue(epvsData.fluxPeakExport, "p"),
                            ],
                          },
                          {
                            key: "pricing",
                            values: [
                              pricing.method,
                              pricing.cost != null ? "£" + Math.round(Number(pricing.cost)).toLocaleString("en-GB") : "—",
                              formatMoney(pricing.monthlyPayment),
                              pricing.totalCost != null ? "£" + Math.round(Number(pricing.totalCost)).toLocaleString("en-GB") : "—",
                            ],
                          },
                          {
                            key: "epvs",
                            values: [
                              thirtyYearEpvs.paybackPeriod != null ? Math.round(Number(thirtyYearEpvs.paybackPeriod)) + "y" : "—",
                              formatMoney(thirtyYearEpvs.netPosition),
                              formatMoney(thirtyYearEpvs.billPreInstall),
                            ],
                          },
                        ].flatMap((group) => {
                          if (collapsedGroups[group.key]) {
                            return [<td key={group.key + "-collapsed"} className="solar-analysis-collapsed-cell">›</td>]
                          }

                          return group.values.map((value, index) => (
                            <td
                              key={group.key + "-" + index}
                              className={[
                                "solar-analysis-" + group.key + "-field",
                                index === 0 ? "solar-analysis-group-start" : "",
                                isEmptyDisplayValue(value) ? "solar-analysis-empty-field" : "",
                              ].filter(Boolean).join(" ")}
                            >
                              {value}
                            </td>
                          ))
                        })}
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

import React, { useEffect, useState } from "react"
import { jsPDF } from "jspdf"
import { ChevronDown, Check, Lock, Building2, UserRound, Pencil, Plus, RotateCcw, X, FileDown } from "lucide-react"
import { supabase } from "../lib/supabase"
import AllocateBranch from "./AllocateBranch"
import AllocateSalesRep from "./AllocateSalesRep"
import RepConfirmation from "./RepConfirmation"

function getSubmittedBy(user) {
  const metadataName = String(user?.user_metadata?.full_name || user?.user_metadata?.name || "").trim()
  return metadataName || user?.email || "Unknown"
}

function toDateTimeLocal(value) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function isSolarAppointment(appointment) {
  const text = [
    appointment?.product,
    appointment?.job_type,
    appointment?.measure,
    appointment?.service,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return text.includes("solar")
}

function pdfMoney(value) {
  return `£${Number(value || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function pdfNumber(value, digits = 2) {
  return Number(value || 0).toLocaleString("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function pdfValue(row, ...keys) {
  for (const key of keys) {
    const direct = Number(row?.[key])
    if (Number.isFinite(direct) && direct !== 0) return direct
    const model = Number(row?.model?.[key])
    if (Number.isFinite(model) && model !== 0) return model
  }
  return 0
}

function drawPdfHeader(doc, title, customer, postcode) {
  // Compact A4-portrait header: keep the title and customer details on one
  // clean band without consuming unnecessary vertical space.
  doc.setFillColor(23, 37, 84)
  doc.rect(0, 0, 210, 14, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont(undefined, "bold")
  doc.setFontSize(11)
  doc.text(title, 10, 8.5)
  doc.setFont(undefined, "normal")
  doc.setFontSize(7)
  doc.text(`${customer || "Customer"} · ${postcode || "No postcode"}`, 200, 8.5, { align: "right" })
  doc.setTextColor(30, 41, 59)
}

function drawPdfFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages()
  const exportedAt = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(226, 232, 240)
    doc.line(10, 286, 200, 286)
    doc.setFontSize(6.5)
    doc.setTextColor(100, 116, 139)
    doc.text(`EPVS calculation · Exported ${exportedAt}`, 10, 291)
    doc.text(`Page ${page} of ${pageCount}`, 200, 291, { align: "right" })
  }
}

function downloadEpvsCalc(appointment) {
  const calculation = appointment?.epvs_calculation
  if (!calculation?.data) {
    window.alert("No saved EPVS calculation was found for this appointment. Save the EPVS calculation first.")
    return
  }

  const data = calculation.data || {}
  const results = calculation.results || {}
  const projection = calculation.thirtyYearProjection || {}
  const scenario = projection.scenarios?.averageInflation || projection.scenarios?.midpointInflation || projection.scenarios?.noInflation
  const rows = Array.isArray(scenario?.rows)
    ? scenario.rows
    : Array.isArray(scenario)
      ? scenario
      : []

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const customer = appointment?.name || data.customerName || "Customer"
  const postcode = appointment?.postcode || data.postcode || ""

  drawPdfHeader(doc, "EPVS Calculation", customer, postcode)

  let y = 22
  doc.setFontSize(11)
  doc.setFont(undefined, "bold")
  doc.text("System summary", 12, y)
  y += 7

  const summary = [
    ["System size", `${pdfNumber(results.systemSize, 2)} kWp`],
    ["Estimated generation", `${pdfNumber(results.generation, 0)} kWh`],
    ["Solar self-consumption", `${pdfNumber(results.solarSelfConsumption, 0)} kWh`],
    ["Battery contribution", `${pdfNumber(results.batteryContribution, 0)} kWh`],
    ["Estimated export", `${pdfNumber(results.exportKwh, 0)} kWh`],
    ["Battery", data.batteryCapacity ? `${pdfNumber(data.batteryCapacity, 2)} kWh` : "—"],
    ["Inverter", data.inverterCapacity ? `${pdfNumber(data.inverterCapacity, 2)} kW` : "—"],
    ["Payment method", data.paymentMethod || "—"],
    ["System cost", pdfMoney(data.systemCost)],
    ["Deposit", pdfMoney(data.deposit)],
    ["Finance term", data.paymentMethod === "Finance" ? `${pdfNumber(data.financeTerm, 0)} years` : "—"],
    ["Monthly finance", data.paymentMethod === "Finance" ? pdfMoney(results.monthlyPayment) : "Cash"],
  ]

  doc.setFont(undefined, "normal")
  doc.setFontSize(8)
  summary.forEach(([label, value], index) => {
    const col = index % 4
    const row = Math.floor(index / 4)
    const x = 10 + col * 47.5
    const yy = y + row * 11
    doc.setTextColor(100, 116, 139)
    doc.text(label, x, yy)
    doc.setTextColor(23, 32, 51)
    doc.setFont(undefined, "bold")
    doc.text(value, x, yy + 4.5)
    doc.setFont(undefined, "normal")
  })

  y += 3 * 11 + 7
  // Keep the complete 30-year table on the same A4 page as the system summary.
  doc.setFontSize(9)
  doc.setFont(undefined, "bold")
  doc.setTextColor(23, 32, 51)
  doc.text("30 year breakdown — average inflation scenario", 10, y)
  y += 5

  const headers = [
    "YR", "GEN", "SOLAR", "BATTERY", "EXPORT",
    "ANNUAL BENEFIT", "PAYMENTS", "NET ANNUAL",
    "NET POSITION", "BILL PRE", "BILL POST"
  ]
  const widths = [9, 17, 17, 18, 17, 23, 21, 22, 23, 15, 15]
  const totalWidth = widths.reduce((sum, width) => sum + width, 0)
  const startX = (210 - totalWidth) / 2

  let x = startX
  doc.setFillColor(87, 87, 87)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(5.2)
  doc.setFont(undefined, "bold")

  headers.forEach((header, index) => {
    doc.rect(x, y, widths[index], 9, "F")
    const lines = header.split(" ")
    if (lines.length > 1) {
      const midpoint = Math.ceil(lines.length / 2)
      doc.text(lines.slice(0, midpoint).join(" "), x + widths[index] / 2, y + 3.5, { align: "center" })
      doc.text(lines.slice(midpoint).join(" "), x + widths[index] / 2, y + 7, { align: "center" })
    } else {
      doc.text(header, x + widths[index] / 2, y + 5.5, { align: "center" })
    }
    x += widths[index]
  })

  y += 9

  const totalPayments = rows.reduce(
    (total, row) => total + pdfValue(row, "yearlyPayment", "payment"),
    0
  )
  let cumulativeBenefit = 0
  const totals = {
    generation: 0,
    solar: 0,
    battery: 0,
    exportBenefit: 0,
    annualBenefit: 0,
    payments: 0,
    netAnnual: 0,
    billPre: 0,
    billPost: 0,
    finalNetPosition: 0,
  }

  rows.forEach((row) => {
    const solar = pdfValue(row, "solarBenefit", "solar")
    const battery =
      pdfValue(row, "batteryBenefit", "battery") ||
      pdfValue(row, "batterySelfConsumptionBenefit") +
      pdfValue(row, "forceChargeBenefit")
    const exportBenefit = pdfValue(row, "exportBenefit")
    const annualBenefit = solar + battery + exportBenefit
    const payment = pdfValue(row, "yearlyPayment", "payment")
    const netAnnual = annualBenefit + payment

    cumulativeBenefit += annualBenefit
    const netPosition = totalPayments + cumulativeBenefit

    totals.generation += Number(row.generation || 0)
    totals.solar += solar
    totals.battery += battery
    totals.exportBenefit += exportBenefit
    totals.annualBenefit += annualBenefit
    totals.payments += payment
    totals.netAnnual += netAnnual
    totals.billPre += Number(row.billPreInstall || 0)
    totals.billPost += Number(row.billPostInstall || 0)
    totals.finalNetPosition = netPosition

    const values = [
      String(row.year || ""),
      pdfNumber(row.generation, 0),
      pdfMoney(solar),
      pdfMoney(battery),
      pdfMoney(exportBenefit),
      pdfMoney(annualBenefit),
      pdfMoney(payment),
      pdfMoney(netAnnual),
      pdfMoney(netPosition),
      pdfMoney(row.billPreInstall),
      pdfMoney(row.billPostInstall),
    ]

    x = startX
    doc.setFontSize(5.2)
    doc.setFont(undefined, "normal")

    values.forEach((value, index) => {
      const highlighted = index === 5 || index === 8
      doc.setFillColor(
        highlighted ? 232 : 255,
        highlighted ? 245 : 255,
        highlighted ? 235 : 255
      )
      doc.setTextColor(
        netAnnual < 0 && (index === 7 || index === 8) ? 190 : 51,
        51,
        51
      )
      doc.rect(x, y, widths[index], 5.8, "F")
      doc.text(value, x + widths[index] - 1, y + 3.8, { align: "right" })
      x += widths[index]
    })

    y += 5.8
  })

  if (rows.length) {
    const totalValues = [
      "TOTAL",
      pdfNumber(totals.generation, 0),
      pdfMoney(totals.solar),
      pdfMoney(totals.battery),
      pdfMoney(totals.exportBenefit),
      pdfMoney(totals.annualBenefit),
      pdfMoney(totals.payments),
      pdfMoney(totals.netAnnual),
      pdfMoney(totals.finalNetPosition),
      pdfMoney(totals.billPre),
      pdfMoney(totals.billPost),
    ]

    x = startX
    doc.setFontSize(5.2)
    doc.setFont(undefined, "bold")
    doc.setTextColor(255, 255, 255)

    totalValues.forEach((value, index) => {
      doc.setFillColor(87, 87, 87)
      doc.rect(x, y, widths[index], 6.5, "F")
      doc.text(value, x + widths[index] - 1, y + 4.2, { align: "right" })
      x += widths[index]
    })

    y += 6.5
  }

  if (!rows.length) {
    doc.setFontSize(7)
    doc.setTextColor(100, 116, 139)
    doc.text("No 30 year projection is currently saved.", 10, y + 8)
  }

  drawPdfFooter(doc)

  const safeName = String(customer).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "customer"
  doc.save(`EPVS-Calculation-${safeName}.pdf`)
}

export default function AppointmentActions({ appointment, onUpdated, onConfirmLegacy, onResultLegacy, onOpenPickup }) {
  const [open, setOpen] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState("")
  const [editValues, setEditValues] = useState({})
  const [showEditDetails, setShowEditDetails] = useState(false)

  const hasResult = Boolean(String(appointment?.result || appointment?.status || "").trim())
  const confirmed = appointment?.cps_c === true
  const hasBranch = Boolean(String(appointment?.branch || "").trim())
  const hasAllocatedRep = Boolean(String(appointment?.rep_allocated || "").trim())

  const solarAppointment = isSolarAppointment(appointment)
  useEffect(() => {
    setEditValues({
      name: appointment?.name || "",
      phone_number_1: appointment?.phone_number_1 || appointment?.phone || "",
      email_address: appointment?.email_address || appointment?.email || "",
      postcode: appointment?.postcode || "",
      address: appointment?.address || "",
      appointment_date: toDateTimeLocal(appointment?.appointment_date),
      product: appointment?.product || "",
      job_type: appointment?.job_type || "",
      lead_source: appointment?.lead_source || "",
      sales_notes: appointment?.sales_notes || "",
    })
  }, [appointment])

  const closeAnd = (fn) => { setOpen(false); fn?.() }
  const handleUpdated = (updatedAppointment) => { setOpen(false); onUpdated?.(updatedAppointment) }

  function openEdit() {
    setEditError("")
    setShowEdit(true)
    setOpen(false)
  }

  async function saveEdit(event) {
    event.preventDefault()
    if (!appointment?.appointment_row_id || savingEdit) return
    setSavingEdit(true)
    setEditError("")
    let actionId = null
    const now = new Date().toISOString()
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      const triggeredBy = getSubmittedBy(userData?.user)
      const inputData = {
        appointment_row_id: appointment.appointment_row_id,
        previous: { name: appointment.name, phone_number_1: appointment.phone_number_1 || appointment.phone || null, email_address: appointment.email_address || appointment.email || null, postcode: appointment.postcode, address: appointment.address, appointment_date: appointment.appointment_date, product: appointment.product, job_type: appointment.job_type, lead_source: appointment.lead_source, sales_notes: appointment.sales_notes },
        changes: editValues,
      }
      const { data: action, error: actionError } = await supabase.from("action_runs").insert({ action_type: "edit_appointment", status: "running", entity_type: "appointment", entity_id: appointment.appointment_row_id, triggered_by: triggeredBy, started_at: now, input_data: inputData }).select("id").single()
      if (actionError) throw actionError
      actionId = action.id
      const updatePayload = {
        name: editValues.name || null,
        phone_number_1: editValues.phone_number_1 || null,
        email_address: editValues.email_address || null,
        postcode: editValues.postcode || null,
        address: editValues.address || null,
        appointment_date: editValues.appointment_date ? new Date(editValues.appointment_date).toISOString() : null,
        product: editValues.product || null,
        job_type: editValues.job_type || null,
        lead_source: editValues.lead_source || null,
        sales_notes: editValues.sales_notes || null,
        record_last_update: now,
      }
      const { data: updatedAppointment, error: updateError } = await supabase.from("appointments").update(updatePayload).eq("appointment_row_id", appointment.appointment_row_id).select("*").single()
      if (updateError) throw updateError
      const { error: actionUpdateError } = await supabase.from("action_runs").update({ status: "completed", completed_at: new Date().toISOString(), output_data: { appointment_row_id: updatedAppointment.appointment_row_id, changes: updatePayload } }).eq("id", actionId)
      if (actionUpdateError) throw actionUpdateError
      setShowEdit(false)
      onUpdated?.({ ...updatedAppointment, phone: updatedAppointment.phone_number_1, email: updatedAppointment.email_address })
    } catch (err) {
      console.error("Edit Appointment action failed:", err)
      const message = err?.message || "Unable to update appointment."
      setEditError(message)
      if (actionId) await supabase.from("action_runs").update({ status: "failed", completed_at: new Date().toISOString(), error_message: message }).eq("id", actionId)
    } finally { setSavingEdit(false) }
  }

  const setField = (field, value) => setEditValues((current) => ({ ...current, [field]: value }))

  return <>
    <div style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((value) => !value)} style={{ display: "flex", alignItems: "center", gap: 7, height: 40, padding: "0 15px", border: "none", borderRadius: 8, background: "#2499ed", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}><span>Actions</span><ChevronDown size={15} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} /></button>
      {open && <>
        <button type="button" aria-label="Close actions" onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 998, border: 0, background: "transparent" }} />
        <div style={{ position: "absolute", top: 46, right: 0, width: 280, background: "#fff", border: "1px solid #dfe4e8", borderRadius: 10, boxShadow: "0 14px 35px rgba(0,0,0,.16)", padding: 6, zIndex: 999 }}>
          <div style={{ padding: "7px 10px 6px", fontSize: 9, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" }}>Appointment actions</div>
          <MenuButton icon={Check} disabled={confirmed} onClick={() => closeAnd(onConfirmLegacy)}>Confirm Appointment{confirmed && <Done />}</MenuButton>
          {confirmed ? <AllocateBranch appointment={appointment} menuItem onUpdated={handleUpdated} /> : <MenuButton icon={Building2} disabled>Allocate Branch <Lock size={13} color="#b8c0c8" /></MenuButton>}
          {hasBranch ? <AllocateSalesRep appointment={appointment} menuItem onUpdated={handleUpdated} /> : <MenuButton icon={UserRound} disabled>Allocate Sales Rep <Lock size={13} color="#b8c0c8" /></MenuButton>}
          {hasAllocatedRep ? <RepConfirmation appointment={appointment} menuItem onUpdated={handleUpdated} /> : <MenuButton icon={Check} disabled>Rep Confirmation <Lock size={13} color="#b8c0c8" /></MenuButton>}
          <MenuButton icon={Pencil} onClick={openEdit}>Edit Appointment</MenuButton>
          <MenuButton icon={Plus} onClick={() => closeAnd(onResultLegacy)}>Result Appointment</MenuButton>
          <div style={{ height: 1, background: "#eef1f4", margin: "6px 4px" }} />
          <div style={{ padding: "7px 10px 5px", fontSize: 9, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" }}>EPVS</div>
          <MenuButton
            icon={FileDown}
            disabled={!solarAppointment}
            onClick={() => {
              if (!solarAppointment) return
              setOpen(false)
              downloadEpvsCalc(appointment)
            }}
          >
            Download EPVS Calc
            {!solarAppointment && <Lock size={13} color="#b8c0c8" />}
          </MenuButton>
          <MenuButton disabled={!hasResult} icon={RotateCcw} onClick={() => closeAnd(onOpenPickup)}>Pickup{!hasResult && <Lock size={13} color="#b8c0c8" />}</MenuButton>
        </div>
      </>}
    </div>

    {showEdit && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 620, maxHeight: "90vh", overflow: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><h2 style={{ margin: 0, fontSize: 16, color: "#172033" }}>Edit Appointment</h2><p style={{ margin: "4px 0 0", fontSize: 10, color: "#888" }}>{appointment?.name || "Appointment"}</p></div><button type="button" onClick={() => setShowEdit(false)} style={{ border: 0, background: "transparent", color: "#888", cursor: "pointer" }}><X size={18} /></button></div>
        <form onSubmit={saveEdit} style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 14 }}>
            <Field label="Customer name" value={editValues.name} onChange={(v) => setField("name", v)} />
            <Field label="Phone" value={editValues.phone_number_1} onChange={(v) => setField("phone_number_1", v)} />
            <Field label="Email" value={editValues.email_address} onChange={(v) => setField("email_address", v)} />
            <Field label="Postcode" value={editValues.postcode} onChange={(v) => setField("postcode", v)} />
            <Field label="Appointment date & time" type="datetime-local" value={editValues.appointment_date} onChange={(v) => setField("appointment_date", v)} />
            <Field label="Product / measure" value={editValues.product} onChange={(v) => setField("product", v)} />
          </div>
          <Field label="Address" value={editValues.address} onChange={(v) => setField("address", v)} full />
          <button type="button" onClick={() => setShowEditDetails((value) => !value)} style={{ margin: "14px 0 10px", border: 0, background: "transparent", padding: 0, color: "#1679bd", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{showEditDetails ? "Hide additional fields" : "Show additional fields"}</button>
          {showEditDetails && <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 14 }}><Field label="Job type" value={editValues.job_type} onChange={(v) => setField("job_type", v)} /><Field label="Lead source" value={editValues.lead_source} onChange={(v) => setField("lead_source", v)} /></div>}
          <label style={{ display: "block", marginTop: 14, fontSize: 10, fontWeight: 700, color: "#555" }}>Sales notes<textarea value={editValues.sales_notes} onChange={(e) => setField("sales_notes", e.target.value)} style={{ display: "block", width: "100%", minHeight: 80, marginTop: 6, boxSizing: "border-box", border: "1px solid #d9dadd", borderRadius: 7, padding: 10, fontFamily: "inherit", fontSize: 12, resize: "vertical" }} /></label>
          {editError && <div style={{ marginTop: 12, padding: 10, background: "#fbeaea", color: "#8b3333", borderRadius: 6, fontSize: 10 }}>{editError}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18, paddingTop: 14, borderTop: "1px solid #eee" }}><button type="button" onClick={() => setShowEdit(false)} style={{ height: 36, padding: "0 14px", border: "1px solid #dddfe3", borderRadius: 7, background: "#fff", cursor: "pointer", fontSize: 11 }}>Cancel</button><button type="submit" disabled={savingEdit} style={{ height: 36, padding: "0 16px", border: 0, borderRadius: 7, background: "#172554", color: "#fff", cursor: savingEdit ? "default" : "pointer", opacity: savingEdit ? .6 : 1, fontSize: 11, fontWeight: 700 }}>{savingEdit ? "Saving..." : "Save changes"}</button></div>
        </form>
      </div>
    </div>}
  </>
}

function MenuButton({ children, icon: Icon, disabled, onClick }) { return <button type="button" disabled={disabled} onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, minHeight: 38, padding: "0 10px", border: 0, borderRadius: 7, background: disabled ? "#fff" : "transparent", color: disabled ? "#b4bbc2" : "#243342", cursor: disabled ? "default" : "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, textAlign: "left" }} onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "#f3f7fa" }} onMouseLeave={(e) => { e.currentTarget.style.background = disabled ? "#fff" : "transparent" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 9, flex: 1 }}>{Icon && <Icon size={15} />}{children}</span></button> }
function Done() { return <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, color: "#16a34a" }}>Completed</span> }
function Field({ label, value, onChange, type = "text", full = false }) { return <label style={{ display: "block", marginTop: full ? 14 : 0, gridColumn: full ? "1/-1" : undefined, fontSize: 10, fontWeight: 700, color: "#555" }}>{label}<input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} style={{ display: "block", width: "100%", height: 40, boxSizing: "border-box", marginTop: 6, border: "1px solid #d9dadd", borderRadius: 7, padding: "0 10px", fontFamily: "inherit", fontSize: 12, color: "#172033" }} /></label> }

import React, { useState } from "react"
import * as XLSX from "xlsx"
import { Download, RefreshCw, FileText } from "lucide-react"
import { supabase } from "../lib/supabase"

const COLUMNS = [
  ["Date", row => formatDate(row.appointment_date)],
  ["Branch", row => row.branch],
  ["Rep", row => row.rep_name],
  ["Time", row => formatTime(row.appointment_date)],
  ["Name", row => row.name],
  ["Address", row => row.address],
  ["Postcode", row => row.postcode],
  ["Phone Number", row => row.phone_number_1],
  ["Lead Source", row => row.lead_source],
  ["Product", row => row.product],
  ["Job Type", row => row.job_type],
  ["Result", row => row.result],
  ["Sales Notes", row => row.sales_notes],
  ["DealValueRoundedDisplay", row => row.deal_value],
  ["C or F", row => {
    if (String(row.result || "").trim().toUpperCase() !== "SOLD") return ""
    const calculation = row.epvs_calculation && typeof row.epvs_calculation === "object" ? row.epvs_calculation : {}
    const data = calculation.data && typeof calculation.data === "object" ? calculation.data : {}
    const method = String(data.paymentMethod || calculation.paymentMethod || calculation.payment_method || row.payment_method || "").trim().toLowerCase()
    if (method === "cash") return "C"
    if (method === "finance" || method === "financed") return "F"
    return ""
  }],
  ["Deposit", row => {
    if (String(row.result || "").trim().toUpperCase() !== "SOLD") return ""
    const calculation = row.epvs_calculation && typeof row.epvs_calculation === "object" ? row.epvs_calculation : {}
    const data = calculation.data && typeof calculation.data === "object" ? calculation.data : {}
    return data.deposit ?? calculation.deposit ?? row.deposit ?? ""
  }],
  ["Deposit Method", () => ""],
  ["Admin Fee", row => {
    if (String(row.result || "").trim().toUpperCase() !== "SOLD") return ""
    // Use the entered deal amount where present. Solar deals default to £399;
    // window deals must remain blank until their fee has been entered.
    const enteredAmount = row.admin_fee_amount
    if (enteredAmount !== null && enteredAmount !== undefined && String(enteredAmount).trim() !== "") return enteredAmount
    const jobType = String(row.job_type || "").trim().toLowerCase()
    const product = String(row.product || "").trim().toLowerCase()
    return jobType.includes("solar") || product.includes("solar") ? 399 : ""
  }],
  ["Admin Method", () => ""],
  ["Lender", row => {
    if (String(row.result || "").trim().toUpperCase() !== "SOLD") return ""
    const calculation = row.epvs_calculation && typeof row.epvs_calculation === "object" ? row.epvs_calculation : {}
    const data = calculation.data && typeof calculation.data === "object" ? calculation.data : {}
    const financeProductId = data.financeProductId || calculation.financeProductId || ""
    const financeProduct = row.finance_products_by_id?.[String(financeProductId)]
    return financeProduct?.lender || data.lender || data.financeLender || calculation.lender || row.lender || row.finance_lender || ""
  }],
  ["Contact No", row => row.contract_number],
  ["ContractBoolean", row => String(row.result || "").trim().toUpperCase() === "SOLD" ? (row.contract_file_visible ? "TRUE" : "FALSE") : ""],
  ["EcofBoolean", row => String(row.result || "").trim().toUpperCase() === "SOLD" ? "" : ""],
  ["Canvasser", row => row.canvasser_name || row.canvasser],
  ["Monthly Spend", row => row.solar_monthly_spend],
]

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`
}
function formatDate(value) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" })
}
function formatTime(value) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit", hour12:false })
}
function csvCell(value) {
  if (value === null || value === undefined) return '""'
  const text = String(value).trim()
  return `"${text.replace(/"/g, '""')}"`
}
function getRelatedDeal(appointment) {
  return Array.isArray(appointment.deals) ? appointment.deals[0] : appointment.deals
}
function cleanValue(value) {
  return value === null || value === undefined ? "" : value
}
function isSold(row) {
  return String(row.result || "").trim().toUpperCase() === "SOLD"
}
function isSolar(row) {
  const type = String(row.job_type || "").trim().toLowerCase()
  const product = String(row.product || "").trim().toLowerCase()
  return type.includes("solar") || product.includes("solar")
}
function isCounted(value) {
  if (value === true || value === 1) return true
  const normalized = String(value ?? "").trim().toLowerCase()
  return ["true", "1", "yes", "y", "x"].includes(normalized)
}
function financeAmountFor(row) {
  if (!isSold(row)) return 0
  const calculation = row.epvs_calculation && typeof row.epvs_calculation === "object" ? row.epvs_calculation : {}
  const data = calculation.data && typeof calculation.data === "object" ? calculation.data : {}
  const results = calculation.results && typeof calculation.results === "object" ? calculation.results : {}
  const method = String(data.paymentMethod || calculation.paymentMethod || "").trim().toLowerCase()
  if (method !== "finance" && method !== "financed") return 0
  const amount = results.financeAmount ?? calculation.financeAmount ?? data.financeAmount
  if (amount !== null && amount !== undefined && amount !== "" && Number.isFinite(Number(amount))) return Number(amount)
  const systemCost = Number(data.systemCost ?? calculation.systemCost ?? 0)
  const deposit = Number(data.deposit ?? calculation.deposit ?? 0)
  return Math.max(0, systemCost - deposit)
}
function summaryRows(rows, columnsLength) {
  const branchNames = [...new Set(rows.map(row => String(row.branch || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "en-GB", { sensitivity: "base" }))
  const sections = [
    { title: "SALES : WINDOWS", filter: row => !isSolar(row) },
    { title: "SALES : SOLAR", filter: isSolar },
    { title: "TOTAL", filter: () => true },
  ]
  const output = []
  const blankRow = () => Array(columnsLength).fill("")
  const money = value => Math.round(value).toLocaleString("en-GB")
  for (const section of sections) {
    output.push(blankRow())
    const heading = blankRow()
    heading[0] = section.title
    heading[2] = "C"
    heading[3] = "P"
    heading[4] = "S"
    heading[5] = "£"
    heading[6] = "Finance"
    output.push(heading)
    const sectionRows = rows.filter(section.filter)
    const branchRows = [...branchNames.map(branch => ({
      branch,
      rows: sectionRows.filter(row => String(row.branch || "").trim() === branch),
    }))].filter(item => item.rows.length || section.title === "TOTAL")
    for (const item of branchRows) {
      const line = blankRow()
      line[0] = item.branch
      line[2] = item.rows.filter(row => isCounted(row.cps_c)).length
      line[3] = item.rows.filter(row => isCounted(row.cps_p)).length
      line[4] = item.rows.filter(row => isCounted(row.cps_s)).length
      line[5] = money(item.rows.reduce((sum, row) => sum + (isSold(row) && Number.isFinite(Number(row.deal_value)) ? Number(row.deal_value) : 0), 0))
      line[6] = money(item.rows.reduce((sum, row) => sum + financeAmountFor(row), 0))
      output.push(line)
    }
    const total = blankRow()
    total[0] = "TOTAL"
    total[2] = sectionRows.filter(row => isCounted(row.cps_c)).length
    total[3] = sectionRows.filter(row => isCounted(row.cps_p)).length
    total[4] = sectionRows.filter(row => isCounted(row.cps_s)).length
    total[5] = money(sectionRows.reduce((sum, row) => sum + (isSold(row) && Number.isFinite(Number(row.deal_value)) ? Number(row.deal_value) : 0), 0))
    total[6] = money(sectionRows.reduce((sum, row) => sum + financeAmountFor(row), 0))
    output.push(total)
  }
  return output
}

export default function DailyReports() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function downloadYesterday() {
    if (!supabase) {
      setError("Supabase is not configured.")
      return
    }
    setLoading(true)
    setError("")
    setMessage("")
    try {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const start = dateKey(yesterday)
      const startBoundary = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())
      const endBoundary = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() + 1)
      const end = dateKey(endBoundary)

      const [appointmentsResult, profilesResult, financeProductsResult] = await Promise.all([
        supabase.from("appointments")
          .select("*, deals(*)")
          .gte("appointment_date", startBoundary.toISOString())
          .lt("appointment_date", endBoundary.toISOString())
          .order("appointment_date", { ascending: true }),
        supabase.from("profiles").select("*"),
        supabase.from("finance_products").select("id,lender"),
      ])
      if (appointmentsResult.error) throw appointmentsResult.error
      if (profilesResult.error) throw profilesResult.error
      if (financeProductsResult.error) throw financeProductsResult.error

      const namesByEmail = (profilesResult.data || []).reduce((map, profile) => {
        const email = String(profile.email || "").trim().toLowerCase()
        if (email) map[email] = profile.full_name || profile.display_name || profile.name || profile.email
        return map
      }, {})
      const namesById = (profilesResult.data || []).reduce((map, profile) => {
        const profileId = profile.id ?? profile.user_id
        if (profileId !== null && profileId !== undefined) map[String(profileId)] = profile.full_name || profile.display_name || profile.name || profile.email || ""
        return map
      }, {})
      const financeProductsById = (financeProductsResult.data || []).reduce((map, product) => {
        map[String(product.id)] = product
        return map
      }, {})
      const rows = await Promise.all((appointmentsResult.data || []).map(async appointment => {
        const deal = getRelatedDeal(appointment) || {}
        const email = String(appointment.rep_allocated || "").trim().toLowerCase()
        let contractFileVisible = false
        if (appointment.appointment_row_id) {
          const { data: contractFiles, error: contractFilesError } = await supabase.storage
            .from("signatures")
            .list(`contract-pdfs/${appointment.appointment_row_id}`, { limit: 100 })
          if (contractFilesError) {
            console.warn("Unable to check contract files for appointment:", appointment.appointment_row_id, contractFilesError.message)
          } else {
            contractFileVisible = (contractFiles || []).some(file =>
              file?.name && !file.name.startsWith(".") && /\\.pdf$/i.test(file.name)
            )
          }
        }
        return {
          ...appointment,
          rep_name: namesByEmail[email] || namesById[String(appointment.rep_allocated || "").trim()] || appointment.rep_allocated || "",
          canvasser_name: namesByEmail[String(appointment.canvasser || "").trim().toLowerCase()] || namesById[String(appointment.canvasser || "")] || appointment.canvasser || "",
          deal_value: deal.net_value ?? deal.deal_value ?? "",
          admin_fee_amount: deal.admin_fee_amount ?? "",
          lender: deal.lender ?? appointment.lender ?? appointment.finance_lender ?? "",
          finance_products_by_id: financeProductsById,
          contract_file_visible: contractFileVisible,
        }
      }))

      rows.sort((a, b) => {
        const branchCompare = String(a.branch || "").localeCompare(String(b.branch || ""), "en-GB", { sensitivity: "base" })
        if (branchCompare !== 0) return branchCompare
        const aTime = a.appointment_date ? new Date(a.appointment_date).getTime() : 0
        const bTime = b.appointment_date ? new Date(b.appointment_date).getTime() : 0
        return aTime - bTime
      })

      const detailRows = [
        COLUMNS.map(([heading]) => heading),
        ...rows.map(row => COLUMNS.map(([, getValue]) => cleanValue(getValue(row)))),
      ]
      const summary = summaryRows(rows, COLUMNS.length)
      const worksheetData = [...detailRows, ...summary]
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1")
      worksheet["!cols"] = COLUMNS.map(([heading]) => ({
        wch: Math.min(32, Math.max(12, heading.length + 2)),
      }))
      worksheet["!cols"][5] = { wch: 28 }
      worksheet["!cols"][12] = { wch: 32 }
      worksheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: COLUMNS.length - 1 } }) }
      worksheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" }

      // Style the detail header.
      for (let c = 0; c < COLUMNS.length; c++) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c })]
        if (cell) cell.s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1F4E78" } }, alignment: { vertical: "center", wrapText: true }, border: { bottom: { style: "medium", color: { rgb: "17365D" } } } }
      }
      worksheet["!rows"] = [{ hpt: 30 }]
      const summaryStart = detailRows.length
      let summaryRowIndex = summaryStart
      const summaryHeaderRows = []
      const summaryTotalRows = []
      for (const section of ["SALES : WINDOWS", "SALES : SOLAR", "TOTAL"]) {
        summaryRowIndex++
        summaryHeaderRows.push(summaryRowIndex)
        const firstCell = worksheet[XLSX.utils.encode_cell({ r: summaryRowIndex, c: 0 })]
        if (firstCell?.v === section) {
          for (let c = 0; c < COLUMNS.length; c++) {
            const cell = worksheet[XLSX.utils.encode_cell({ r: summaryRowIndex, c })]
            if (cell) cell.s = { font: { bold: true, sz: 12 }, fill: { fgColor: { rgb: "D9D9D9" } }, alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "thin", color: { rgb: "B7B7B7" } }, bottom: { style: "thin", color: { rgb: "B7B7B7" } } } }
          }
          worksheet["!merges"] = worksheet["!merges"] || []
          worksheet["!merges"].push({ s: { r: summaryRowIndex, c: 0 }, e: { r: summaryRowIndex, c: 1 } })
          worksheet["!merges"].push({ s: { r: summaryRowIndex, c: 5 }, e: { r: summaryRowIndex, c: 5 } })
        }
        // Each section has a heading, zero or more branch rows, and a total row.
        let scan = summaryRowIndex + 1
        while (scan < worksheetData.length && worksheetData[scan].every(value => value === "")) scan++
        while (scan < worksheetData.length && worksheetData[scan][0] !== "TOTAL" && !["SALES : WINDOWS", "SALES : SOLAR", "TOTAL"].includes(worksheetData[scan][0])) scan++
        if (scan < worksheetData.length && worksheetData[scan][0] === "TOTAL") summaryTotalRows.push(scan)
        summaryRowIndex = scan
      }
      // Style all summary rows using their contents so layout remains correct as branch counts change.
      for (let r = summaryStart; r < worksheetData.length; r++) {
        const values = worksheetData[r]
        if (values.every(value => value === "")) continue
        if (["SALES : WINDOWS", "SALES : SOLAR", "TOTAL"].includes(values[0])) {
          for (let c = 0; c < COLUMNS.length; c++) {
            const cell = worksheet[XLSX.utils.encode_cell({ r, c })]
            if (cell) cell.s = { font: { bold: true, sz: 12 }, fill: { fgColor: { rgb: values[0] === "TOTAL" ? "BFBFBF" : "D9D9D9" } }, alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "thin", color: { rgb: "B7B7B7" } }, bottom: { style: "thin", color: { rgb: "B7B7B7" } } } }
          }
        } else if (values[0] === "TOTAL") {
          for (let c = 0; c < COLUMNS.length; c++) {
            const cell = worksheet[XLSX.utils.encode_cell({ r, c })]
            if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: "BFBFBF" } }, border: { top: { style: "thin", color: { rgb: "888888" } } } }
          }
        }
      }
      // Use native Excel currency number formats for summary £ and Finance columns.
      for (let r = summaryStart; r < worksheetData.length; r++) {
        for (const c of [5, 6]) {
          const cell = worksheet[XLSX.utils.encode_cell({ r, c })]
          if (cell && typeof cell.v === "string" && /^\\d[\\d,]*$/.test(cell.v)) {
            const numeric = Number(cell.v.replace(/,/g, ""))
            cell.v = numeric
            cell.t = "n"
            cell.z = '"£"#,##0'
          }
        }
      }
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Mastersheet")
      XLSX.writeFile(workbook, `Yesterdays-Mastersheet-${start}.xlsx`)
      setMessage(`Downloaded Excel Mastersheet with ${rows.length} appointment records and a styled summary for ${yesterday.toLocaleDateString("en-GB")}.`)
    } catch (err) {
      console.error("Unable to download yesterday's Mastersheet:", err)
      setError(err?.message || "Unable to generate the Mastersheet.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section style={{ color:"#172033", maxWidth:1100, margin:"0 auto" }}>
      <header style={{ marginBottom:22 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:6 }}>
          <span style={{ width:42, height:42, borderRadius:12, display:"grid", placeItems:"center", background:"#e0f2fe", color:"#0284c7" }}><FileText size={22}/></span>
          <div>
            <h1 style={{ margin:0, fontSize:28, fontWeight:750 }}>Daily Reports</h1>
            <p style={{ margin:"5px 0 0", color:"#64748b", fontSize:14 }}>Generate reports directly from CRM appointment data.</p>
          </div>
        </div>
      </header>
      <div style={{ background:"#fff", border:"1px solid #dbe4ee", borderRadius:14, padding:24, boxShadow:"0 1px 3px rgba(15,23,42,.04)" }}>
        <h2 style={{ margin:"0 0 8px", fontSize:19 }}>Yesterday's Mastersheet</h2>
        <p style={{ margin:"0 0 20px", color:"#64748b", lineHeight:1.5 }}>
          Creates a fresh CSV of appointments dated yesterday, using the latest records in the CRM. The download includes the Mastersheet columns and linked deal values where available.
        </p>
        <button type="button" onClick={downloadYesterday} disabled={loading} style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", gap:9, border:0, borderRadius:9, padding:"12px 17px", background:loading?"#94a3b8":"#0284c7", color:"#fff", fontSize:14, fontWeight:700, cursor:loading?"wait":"pointer" }}>
          {loading ? <RefreshCw size={17} className="animate-spin"/> : <Download size={17}/>}
          {loading ? "Generating Mastersheet..." : "Download Yesterdays Mastersheet"}
        </button>
        {message && <p role="status" style={{ margin:"14px 0 0", color:"#15803d", fontSize:13 }}>{message}</p>}
        {error && <p role="alert" style={{ margin:"14px 0 0", color:"#b91c1c", fontSize:13 }}>{error}</p>}
      </div>
    </section>
  )
}

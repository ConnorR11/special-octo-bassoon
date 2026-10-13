import React, { useState } from "react"
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
  ["ContractBoolean", row => row.contract_file_visible ? "TRUE" : "FALSE"],
  ["EcofBoolean", () => ""],
  ["Canvasser", row => row.canvasser],
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
          rep_name: namesByEmail[email] || appointment.rep_allocated || "",
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

      const csv = [
        COLUMNS.map(([heading]) => csvCell(heading)).join(","),
        ...rows.map(row => COLUMNS.map(([, getValue]) => csvCell(cleanValue(getValue(row)))).join(",")),
      ].join("\r\n")
      const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `Yesterdays-Mastersheet-${start}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setMessage(`Downloaded ${rows.length} appointment records for ${yesterday.toLocaleDateString("en-GB")}.`)
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

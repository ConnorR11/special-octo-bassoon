import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx-js-style"
import { createIntegrationLog, updateIntegrationLog } from "../_integration-log.js"

const RECIPIENTS = ["ann@homeshield.ltd", "connor@homeshield.ltd"]
const TEST_RECIPIENTS = ["connor@homeshield.ltd"]
const TIME_ZONE = "Europe/London"

const json = (res, status, body) => {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Cache-Control", "no-store")
  return res.status(status).json(body)
}

function datePartsInZone(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date)
  return Object.fromEntries(parts.filter(p => p.type !== "literal").map(p => [p.type, p.value]))
}

function dateKey({ year, month, day }) {
  return `${year}-${month}-${day}`
}

function zonedMidnightUtc(dateString) {
  const [year, month, day] = dateString.split("-").map(Number)
  const target = Date.UTC(year, month - 1, day, 0, 0, 0)
  let guess = target
  for (let i = 0; i < 3; i += 1) {
    const p = datePartsInZone(new Date(guess))
    const rendered = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(new Date(guess))
    ), Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, minute: "2-digit" }).format(new Date(guess))), 0)
    guess += target - rendered
  }
  return new Date(guess)
}

function formatDate(value) {
  if (!value) return ""
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { timeZone: TIME_ZONE, weekday: "long", month: "long", day: "numeric", year: "numeric" })
}
function formatTime(value) {
  if (!value) return ""
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false })
}
function counted(value) {
  return value === true || value === 1 || ["true", "1", "yes", "y", "x"].includes(String(value ?? "").trim().toLowerCase())
}
function sold(row) { return String(row.result || "").trim().toUpperCase() === "SOLD" }
function solar(row) {
  return String(row.job_type || "").toLowerCase().includes("solar") || String(row.product || "").toLowerCase().includes("solar")
}
function relatedDeal(row) { return Array.isArray(row.deals) ? row.deals[0] : row.deals }
function cell(value) { return value === null || value === undefined ? "" : value }
function financeAmount(row) {
  if (!sold(row)) return 0
  const calc = row.epvs_calculation && typeof row.epvs_calculation === "object" ? row.epvs_calculation : {}
  const data = calc.data && typeof calc.data === "object" ? calc.data : {}
  const results = calc.results && typeof calc.results === "object" ? calc.results : {}
  const method = String(data.paymentMethod || calc.paymentMethod || "").trim().toLowerCase()
  if (method !== "finance" && method !== "financed") return 0
  const amount = results.financeAmount ?? calc.financeAmount ?? data.financeAmount
  if (amount !== null && amount !== undefined && amount !== "" && Number.isFinite(Number(amount))) return Number(amount)
  return Math.max(0, Number(data.systemCost ?? calc.systemCost ?? 0) - Number(data.deposit ?? calc.deposit ?? 0))
}
function dealValue(row) {
  const deal = relatedDeal(row) || {}
  return deal.net_value ?? deal.deal_value ?? ""
}

const COLUMNS = [
  ["Date", r => formatDate(r.appointment_date)],
  ["Branch", r => r.branch],
  ["Rep", r => r.rep_name],
  ["Time", r => formatTime(r.appointment_date)],
  ["Name", r => r.name],
  ["Address", r => r.address],
  ["Postcode", r => r.postcode],
  ["Phone Number", r => r.phone_number_1],
  ["Lead Source", r => r.lead_source],
  ["Product", r => r.product],
  ["Job Type", r => r.job_type],
  ["Result", r => r.result],
  ["Sales Notes", r => r.sales_notes],
  ["DealValueRoundedDisplay", r => r.deal_value],
  ["C or F", r => {
    if (!sold(r)) return ""
    const calc = r.epvs_calculation && typeof r.epvs_calculation === "object" ? r.epvs_calculation : {}
    const data = calc.data && typeof calc.data === "object" ? calc.data : {}
    const method = String(data.paymentMethod || calc.paymentMethod || calc.payment_method || r.payment_method || "").trim().toLowerCase()
    return method === "cash" ? "C" : (method === "finance" || method === "financed" ? "F" : "")
  }],
  ["Deposit", r => {
    if (!sold(r)) return ""
    const calc = r.epvs_calculation && typeof r.epvs_calculation === "object" ? r.epvs_calculation : {}
    const data = calc.data && typeof calc.data === "object" ? calc.data : {}
    return data.deposit ?? calc.deposit ?? r.deposit ?? ""
  }],
  ["Deposit Method", () => ""],
  ["Admin Fee", r => {
    if (!sold(r)) return ""
    if (r.admin_fee_amount !== null && r.admin_fee_amount !== undefined && String(r.admin_fee_amount).trim() !== "") return r.admin_fee_amount
    return solar(r) ? 399 : ""
  }],
  ["Admin Method", () => ""],
  ["Lender", r => {
    if (!sold(r)) return ""
    const calc = r.epvs_calculation && typeof r.epvs_calculation === "object" ? r.epvs_calculation : {}
    const data = calc.data && typeof calc.data === "object" ? calc.data : {}
    const financeProductId = data.financeProductId || calc.financeProductId || ""
    const financeProduct = r.finance_products_by_id?.[String(financeProductId)]
    return financeProduct?.lender || data.lender || data.financeLender || calc.lender || r.lender || r.finance_lender || ""
  }],
  ["Contact No", r => r.contract_number],
  ["ContractBoolean", r => sold(r) ? (r.contract_file_visible ? "TRUE" : "FALSE") : ""],
  ["EcofBoolean", () => ""],
  ["Canvasser", r => r.canvasser_name || r.canvasser],
  ["Monthly Spend", r => r.solar_monthly_spend],
]

function summaryRows(rows) {
  const branches = [...new Set(rows.map(r => String(r.branch || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "en-GB", { sensitivity: "base" }))
  const output = []
  const blank = () => Array(COLUMNS.length).fill("")
  const money = n => Math.round(n).toLocaleString("en-GB")
  const sections = [
    { title: "SALES : WINDOWS", filter: r => !solar(r) },
    { title: "SALES : SOLAR", filter: solar },
    { title: "TOTAL", filter: () => true },
  ]
  for (const section of sections) {
    output.push(blank())
    const head = blank()
    head[0] = section.title; head[1] = "C"; head[2] = "P"; head[3] = "S"; head[4] = "£"; head[5] = "Finance"
    output.push(head)
    const sectionRows = rows.filter(section.filter)
    const listed = branches.map(branch => ({ branch, rows: sectionRows.filter(r => String(r.branch || "").trim() === branch) }))
      .filter(item => item.rows.length || section.title === "TOTAL")
    for (const item of listed) {
      const line = blank()
      line[0] = item.branch
      line[1] = item.rows.filter(r => counted(r.cps_c)).length
      line[2] = item.rows.filter(r => counted(r.cps_p)).length
      line[3] = item.rows.filter(r => counted(r.cps_s)).length
      line[4] = money(item.rows.reduce((sum, r) => sum + (sold(r) && Number.isFinite(Number(r.deal_value)) ? Number(r.deal_value) : 0), 0))
      line[5] = money(item.rows.reduce((sum, r) => sum + financeAmount(r), 0))
      output.push(line)
    }
    const total = blank()
    total[0] = "TOTAL"
    total[1] = sectionRows.filter(r => counted(r.cps_c)).length
    total[2] = sectionRows.filter(r => counted(r.cps_p)).length
    total[3] = sectionRows.filter(r => counted(r.cps_s)).length
    total[4] = money(sectionRows.reduce((sum, r) => sum + (sold(r) && Number.isFinite(Number(r.deal_value)) ? Number(r.deal_value) : 0), 0))
    total[5] = money(sectionRows.reduce((sum, r) => sum + financeAmount(r), 0))
    output.push(total)
  }
  return output
}

function makeWorkbook(rows) {
  const detail = [COLUMNS.map(([name]) => name), ...rows.map(r => COLUMNS.map(([, getter]) => cell(getter(r))))]
  const data = [...detail, ...summaryRows(rows)]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws["!cols"] = COLUMNS.map(([name]) => ({ wch: Math.min(32, Math.max(12, name.length + 2)) }))
  ws["!cols"][0] = { wch: 22 }; ws["!cols"][4] = { wch: 16 }; ws["!cols"][12] = { wch: 32 }
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: COLUMNS.length - 1 } }) }
  ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" }
  ws["!rows"] = [{ hpt: 30 }]
  for (let c = 0; c < COLUMNS.length; c++) {
    const address = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[address]) ws[address].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1F4E78" } }, alignment: { vertical: "center", wrapText: true }, border: { bottom: { style: "medium", color: { rgb: "17365D" } } } }
  }
  const summaryStart = detail.length
  for (let r = summaryStart; r < data.length; r++) {
    const values = data[r]
    if (values.every(v => v === "")) continue
    const header = values[1] === "C" && values[2] === "P" && values[3] === "S"
    const total = values[0] === "TOTAL" && !header
    const fill = header ? "D9D9D9" : total ? "BFBFBF" : "FFFFFF"
    for (let c = 0; c < 6; c++) {
      const address = XLSX.utils.encode_cell({ r, c })
      if (!ws[address]) ws[address] = { t: "s", v: "" }
      ws[address].s = { font: { bold: true, sz: header ? 12 : 11 }, fill: { patternType: "solid", fgColor: { rgb: fill } }, alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: total ? "medium" : "thin", color: { rgb: total ? "888888" : "B7B7B7" } }, bottom: { style: "thin", color: { rgb: total ? "888888" : "B7B7B7" } } } }
    }
    ws["!rows"][r] = { hpt: header ? 22 : 18 }
  }
  for (let r = summaryStart; r < data.length; r++) {
    for (const c of [4, 5]) {
      const address = XLSX.utils.encode_cell({ r, c })
      const item = ws[address]
      if (item && typeof item.v === "string" && /^\d[\d,]*$/.test(item.v)) {
        item.v = Number(item.v.replace(/,/g, "")); item.t = "n"; item.z = '"£"#,##0'
      }
    }
  }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Mastersheet")
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }))
}

async function sendEmail({ tenantId, clientId, clientSecret, sender, recipients, subject, body, fileName, attachment }) {
  const tokenResponse = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
  })
  const token = await tokenResponse.json()
  if (!tokenResponse.ok || !token.access_token) throw new Error(`Microsoft 365 authentication failed (${token.error || tokenResponse.status}).`)
  const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: {
      subject, body: { contentType: "Text", content: body },
      toRecipients: recipients.map(address => ({ emailAddress: { address } })),
      attachments: [{ "@odata.type": "#microsoft.graph.fileAttachment", name: fileName, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", contentBytes: attachment.toString("base64") }],
    }, saveToSentItems: true }),
  })
  if (!response.ok) throw new Error(`Microsoft 365 sendMail failed (HTTP ${response.status}): ${(await response.text()).slice(0, 500)}`)
}

export default async function handler(req, res) {
  let integrationLog = null
  if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { error: "Method not allowed." })
  // Authenticate manual test runs with the existing Microsoft app secret.
  // Vercel Cron requests are allowed through without a second secret.
  // If CRON_SECRET is configured, still require it for scheduled requests.
  const auth = String(req.headers.authorization || "")
  const isManualRun = req.query?.runNow === "1" || req.body?.runNow === true
  const isAuthorisedManualRun =
    isManualRun &&
    Boolean(process.env.MICROSOFT_CLIENT_SECRET) &&
    auth === `Bearer ${process.env.MICROSOFT_CLIENT_SECRET}`
  const cronSecret = String(process.env.CRON_SECRET || "").trim()
  const isVercelCron = /^vercel-cron\/1\.0/i.test(String(req.headers["user-agent"] || ""))
  const isAuthorisedCron = isVercelCron && (!cronSecret || auth === `Bearer ${cronSecret}`)
  if (!isAuthorisedManualRun && !isAuthorisedCron) return json(res, 401, { error: "Unauthorised." })

  // Manual test runs must only ever send to Connor; scheduled runs use the normal list.
  const recipients = isManualRun ? TEST_RECIPIENTS : RECIPIENTS

  const ukNow = new Date()
  const ukParts = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).formatToParts(ukNow)
  const ukHour = Number(ukParts.find(p => p.type === "hour")?.value)
  if (req.method === "GET" && req.query?.runNow !== "1" && ukHour !== 6) {
    return json(res, 200, { skipped: true, reason: "Outside the 06:00 Europe/London delivery window." })
  }

  integrationLog = await createIntegrationLog({
    provider: "microsoft_graph",
    integrationName: "Daily Mastersheet Email",
    direction: "outbound",
    eventName: "daily_mastersheet_email",
    eventType: "scheduled_email",
    payload: { recipients, test_run: isManualRun, schedule: "06:00 Europe/London", status: "started" },
  })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const tenantId = process.env.MICROSOFT_TENANT_ID
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  const sender = process.env.CONTRACT_SENDER_EMAIL
  if (![supabaseUrl, serviceKey, tenantId, clientId, clientSecret, sender].every(Boolean)) {
    const message = "Mastersheet email is missing required Supabase or Microsoft 365 environment configuration."
    await updateIntegrationLog(integrationLog?.id, { status: "failed", http_status: 500, error_message: message, result: { success: false, error: message } })
    return json(res, 500, { error: message })
  }

  try {
    const todayParts = datePartsInZone(ukNow)
    const previousDay = new Date(Date.UTC(Number(todayParts.year), Number(todayParts.month) - 1, Number(todayParts.day) - 1))
    const yesterdayParts = { year: String(previousDay.getUTCFullYear()), month: String(previousDay.getUTCMonth() + 1).padStart(2, "0"), day: String(previousDay.getUTCDate()).padStart(2, "0") }
    const yesterdayDate = dateKey(yesterdayParts)
    const nextDate = new Date(Date.UTC(Number(yesterdayParts.year), Number(yesterdayParts.month) - 1, Number(yesterdayParts.day) + 1))
    const nextDateKey = dateKey({ year: String(nextDate.getUTCFullYear()), month: String(nextDate.getUTCMonth() + 1).padStart(2, "0"), day: String(nextDate.getUTCDate()).padStart(2, "0") })
    const start = zonedMidnightUtc(yesterdayDate)
    const end = zonedMidnightUtc(nextDateKey)
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const [appointmentsResult, profilesResult, financeResult] = await Promise.all([
      supabase.from("appointments").select("*, deals(*)").gte("appointment_date", start.toISOString()).lt("appointment_date", end.toISOString()).order("appointment_date", { ascending: true }),
      supabase.from("profiles").select("*"),
      supabase.from("finance_products").select("id,lender"),
    ])
    if (appointmentsResult.error) throw appointmentsResult.error
    if (profilesResult.error) throw profilesResult.error
    if (financeResult.error) throw financeResult.error

    const profiles = profilesResult.data || []
    const namesByEmail = Object.fromEntries(profiles.map(p => [String(p.email || "").trim().toLowerCase(), p.full_name || p.display_name || p.name || p.email]).filter(([k]) => k))
    const namesById = Object.fromEntries(profiles.map(p => [String(p.id ?? p.user_id ?? ""), p.full_name || p.display_name || p.name || p.email || ""]).filter(([k]) => k))
    const financeProducts = Object.fromEntries((financeResult.data || []).map(p => [String(p.id), p]))
    const rows = await Promise.all((appointmentsResult.data || []).map(async appointment => {
      const deal = relatedDeal(appointment) || {}
      let contractFileVisible = false
      if (appointment.appointment_row_id) {
        const { data: files, error } = await supabase.storage.from("signatures").list(`contract-pdfs/${appointment.appointment_row_id}`, { limit: 100 })
        if (error) console.warn("Unable to check contract files", appointment.appointment_row_id, error.message)
        else contractFileVisible = (files || []).some(f => f?.name && !f.name.startsWith(".") && /\.pdf$/i.test(f.name))
      }
      const rep = String(appointment.rep_allocated || "").trim()
      const canvasser = String(appointment.canvasser || "").trim()
      return {
        ...appointment,
        rep_name: namesByEmail[rep.toLowerCase()] || namesById[rep] || appointment.rep_allocated || "",
        canvasser_name: namesByEmail[canvasser.toLowerCase()] || namesById[canvasser] || appointment.canvasser || "",
        deal_value: deal.net_value ?? deal.deal_value ?? "",
        admin_fee_amount: deal.admin_fee_amount ?? "",
        lender: deal.lender ?? appointment.lender ?? appointment.finance_lender ?? "",
        finance_products_by_id: financeProducts,
        contract_file_visible: contractFileVisible,
      }
    }))
    rows.sort((a, b) => {
      const branch = String(a.branch || "").localeCompare(String(b.branch || ""), "en-GB", { sensitivity: "base" })
      return branch || new Date(a.appointment_date || 0).getTime() - new Date(b.appointment_date || 0).getTime()
    })

    const fileName = `Yesterdays-Mastersheet-${yesterdayDate}.xlsx`
    const attachment = makeWorkbook(rows)
    await sendEmail({
      tenantId, clientId, clientSecret, sender, recipients,
      subject: `Yesterday's Mastersheet — ${yesterdayDate}`,
      body: `Attached is the freshly generated Mastersheet for ${yesterdayDate}. It was generated directly from current CRM appointment and deal data.\n\nAppointments included: ${rows.length}.`,
      fileName, attachment,
    })

    await updateIntegrationLog(integrationLog?.id, {
      status: "success",
      http_status: 202,
      payload: { recipients, file_name: fileName, appointment_date: yesterdayDate, appointment_count: rows.length, status: "sent" },
      result: { success: true, recipients, file_name: fileName, appointment_count: rows.length, appointment_date: yesterdayDate },
      error_message: null,
    })

    return json(res, 200, { success: true, recipients, fileName, appointmentCount: rows.length, appointmentDate: yesterdayDate })
  } catch (error) {
    console.error("Daily Mastersheet email failed:", error)
    await updateIntegrationLog(integrationLog?.id, {
      status: "failed",
      http_status: 500,
      error_message: error?.message || "Unable to send the daily Mastersheet.",
      result: { success: false, recipients, error: error?.message || "Unable to send the daily Mastersheet." },
    })
    return json(res, 500, { error: error?.message || "Unable to send the daily Mastersheet." })
  }
}

import fs from "node:fs"

const path = "src/contracts/GenerateSolarContract.js"
const text = fs.readFileSync(path, "utf8")
let next = text

if (!next.includes('from "pdf-lib"')) {
  const importMarker = 'import { supabase } from "../lib/supabase"'
  if (!next.includes(importMarker)) throw new Error("GenerateSolarContract.js import marker not found")
  next = next.replace(importMarker, `${importMarker}\nimport { PDFDocument } from "pdf-lib"`)
}

const helperMarker = "export async function GenerateSolarContract({"
if (!next.includes(helperMarker)) throw new Error("GenerateSolarContract export marker not found")

if (!next.includes("async function appendProductDatasheets")) {
  const helper = String.raw`
function normaliseDatasheetName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

async function getProductDatasheetPaths(pages, appointment, epvs) {
  const itemisedPage = pages.find(
    page => page?.settings?.page_kind === "itemised_breakdown"
  )

  const configured = Array.isArray(itemisedPage?.settings?.included_items)
    ? itemisedPage.settings.included_items
    : []

  const itemNames = [...new Set(
    configured
      .map(item => typeof item === "string" ? item : item?.name)
      .map(name => interpolate(String(name || ""), appointment, epvs).trim())
      .filter(Boolean)
      .map(normaliseDatasheetName)
  )]

  if (!itemNames.length) return []

  const { data: products, error } = await supabase
    .from("products")
    .select("name,datasheet_path,active")
    .eq("active", true)
    .not("datasheet_path", "is", null)

  if (error) throw error

  const paths = []
  const seen = new Set()

  ;(products || []).forEach(product => {
    const name = normaliseDatasheetName(product?.name)
    const path = String(product?.datasheet_path || "").trim()

    if (!name || !path || !itemNames.includes(name) || seen.has(path)) return

    seen.add(path)
    paths.push(path)
  })

  return paths
}

async function appendProductDatasheets(pdf, pages, appointment, epvs) {
  const paths = await getProductDatasheetPaths(pages, appointment, epvs)
  const baseBytes = pdf.output("arraybuffer")

  if (!paths.length) return new Uint8Array(baseBytes)

  const merged = await PDFDocument.load(baseBytes)

  for (const path of paths) {
    const { data, error } = await supabase.storage
      .from("product-datasheets")
      .createSignedUrl(path, 60 * 10)

    if (error) {
      console.error("Unable to create datasheet signed URL:", path, error)
      continue
    }

    const signedUrl = data?.signedUrl
    if (!signedUrl) continue

    try {
      const response = await fetch(signedUrl)
      if (!response.ok) {
        throw new Error("Datasheet request returned HTTP " + response.status)
      }

      const sourceBytes = await response.arrayBuffer()
      const source = await PDFDocument.load(sourceBytes)
      const copiedPages = await merged.copyPages(source, source.getPageIndices())

      copiedPages.forEach(page => merged.addPage(page))
    } catch (error) {
      console.error("Unable to append product datasheet:", path, error)
    }
  }

  return merged.save()
}

`
  next = next.replace(helperMarker, helper + helperMarker)
}

const saveMarker = "  pdf.save(\n    `" + "${safeName}" + "-Digital-Solar-Contract.pdf`\n  )"
const saveReplacement = `  const finalPdfBytes = await appendProductDatasheets(
    pdf,
    pages,
    appointment,
    epvs
  )

  const blob = new Blob([finalPdfBytes], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = safeName + "-Digital-Solar-Contract.pdf"
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)`

if (next.includes(saveMarker)) {
  next = next.replace(saveMarker, saveReplacement)
} else if (!next.includes("const finalPdfBytes = await appendProductDatasheets(")) {
  throw new Error("PDF save marker not found")
}

if (next === text) {
  console.log("Solar product datasheet patch already applied; nothing to change.")
  process.exit(0)
}

fs.writeFileSync(path, next)
console.log("Solar product datasheet patch applied.")

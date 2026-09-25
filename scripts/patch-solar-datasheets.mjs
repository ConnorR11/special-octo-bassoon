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

function getConfiguredContractProductNames(pages, appointment, epvs) {
  const names = []

  ;(Array.isArray(pages) ? pages : []).forEach(page => {
    const configured = Array.isArray(page?.settings?.included_items)
      ? page.settings.included_items
      : []

    configured.forEach(item => {
      const rawName = typeof item === "string" ? item : item?.name
      const renderedName = interpolate(
        String(rawName || ""),
        appointment,
        epvs
      ).trim()

      if (renderedName) names.push(renderedName)
    })
  })

  return [...new Set(names.map(normaliseDatasheetName).filter(Boolean))]
}

function productMatchesContractItem(product, itemName) {
  const candidates = [
    product?.name,
    product?.model,
    [product?.manufacturer, product?.model].filter(Boolean).join(" ")
  ]
    .map(normaliseDatasheetName)
    .filter(Boolean)

  return candidates.some(candidate =>
    candidate === itemName ||
    candidate.includes(itemName) ||
    itemName.includes(candidate)
  )
}

async function getProductDatasheetPaths(pages, appointment, epvs) {
  const itemNames = getConfiguredContractProductNames(
    pages,
    appointment,
    epvs
  )

  if (!itemNames.length) return []

  const { data: products, error } = await supabase
    .from("products")
    .select("name,model,manufacturer,datasheet_path,active")
    .eq("active", true)
    .not("datasheet_path", "is", null)

  if (error) throw error

  const paths = []
  const seen = new Set()

  ;(products || []).forEach(product => {
    const path = String(product?.datasheet_path || "").trim()
    if (!path || seen.has(path)) return

    const matched = itemNames.some(itemName =>
      productMatchesContractItem(product, itemName)
    )

    if (!matched) return

    seen.add(path)
    paths.push(path)
  })

  return paths
}

async function appendProductDatasheets(pdf, pages, appointment, epvs) {
  const paths = await getProductDatasheetPaths(
    pages,
    appointment,
    epvs
  )

  const baseBytes = pdf.output("arraybuffer")

  if (!paths.length) return new Uint8Array(baseBytes)

  const merged = await PDFDocument.load(baseBytes)

  for (const path of paths) {
    const { data, error } = await supabase.storage
      .from("product-datasheets")
      .createSignedUrl(path, 60 * 10)

    if (error) {
      throw new Error(
        "Unable to create datasheet URL for " +
        path +
        ": " +
        (error.message || error)
      )
    }

    const signedUrl = data?.signedUrl
    if (!signedUrl) {
      throw new Error(
        "No signed URL was returned for datasheet " +
        path +
        "."
      )
    }

    const response = await fetch(signedUrl)

    if (!response.ok) {
      throw new Error(
        "Datasheet request returned HTTP " +
        response.status +
        " for " +
        path +
        "."
      )
    }

    const sourceBytes = await response.arrayBuffer()
    const source = await PDFDocument.load(sourceBytes)
    const copiedPages = await merged.copyPages(
      source,
      source.getPageIndices()
    )

    copiedPages.forEach(page => merged.addPage(page))
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

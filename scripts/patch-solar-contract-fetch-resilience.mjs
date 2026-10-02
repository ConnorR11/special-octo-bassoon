import fs from "node:fs"
import path from "node:path"

const filePath = path.resolve("src/contracts/GenerateSolarContract.js")
let source = fs.readFileSync(filePath, "utf8")

// Optional OpenSolar imagery should never prevent a contract from being generated.
source = source.replace(
  /async function drawImage\(pdf, url, x, y, width, maxHeight = 110\) \{[\s\S]*?\n\}\n\nfunction drawAccreditationLogo/m,
  `async function drawImage(pdf, url, x, y, width, maxHeight = 110) {
  try {
    const image = await imageData(url)
    const inner = Math.max(1, width - 4)
    const ratio = image.width / image.height
    let w = inner
    let h = w / ratio
    if (h > maxHeight) {
      h = maxHeight
      w = h * ratio
    }
    const ix = x + (width - w) / 2
    pdf.setFillColor(245, 247, 249)
    pdf.roundedRect(x, y, width, h + 4, 2.5, 2.5, "F")
    pdf.addImage(image.dataUrl, "PNG", ix, y + 2, w, h, undefined, "FAST")
    return y + h + 12
  } catch (error) {
    console.warn("Unable to load OpenSolar image for contract; continuing without it:", error)
    return y
  }
}

function drawAccreditationLogo`
)

// A failed optional datasheet download should not stop the signed contract itself.
source = source.replace(
  /async function appendProductDatasheets\(pdf, appointment, epvs, pages\) \{[\s\S]*?\n\}\n\nasync function drawImage/m,
  `async function appendProductDatasheets(pdf, appointment, epvs, pages) {
  let paths = []
  try {
    paths = await getProductDatasheetPaths(appointment, epvs, pages)
  } catch (error) {
    console.warn("Unable to determine product datasheets; continuing without datasheets:", error)
  }
  const base = pdf.output("arraybuffer")
  if (!paths.length) return new Uint8Array(base)
  const merged = await PDFDocument.load(base)
  for (const path of paths) {
    try {
      const { data, error } = await supabase.storage.from("product-datasheets").createSignedUrl(path, 600)
      if (error) throw new Error("Unable to create datasheet URL: " + (error.message || error))
      const url = data?.signedUrl
      if (!url) throw new Error("No signed URL was returned.")
      const response = await fetch(url)
      if (!response.ok) throw new Error("Datasheet request returned HTTP " + response.status)
      const sourcePdf = await PDFDocument.load(await response.arrayBuffer())
      const copiedPages = await merged.copyPages(sourcePdf, sourcePdf.getPageIndices())
      copiedPages.forEach((page) => merged.addPage(page))
    } catch (error) {
      console.warn("Unable to append product datasheet " + path + "; continuing without it:", error)
    }
  }
  return merged.save()
}

async function drawImage`
)

// The system-overview page should not fail solely because the OpenSolar image is unavailable.
source = source.replace(
  /if \(kind === "system_overview"\) \{\n\s*const image = getOpenSolarImageUrl\(appointment\)\n\s*if \(!image\) throw new Error\("appointments\.open_solar_image is empty on this appointment\."\)\n\s*y = await drawImage\(pdf, image, ctx\.padding, y, width, 110\)/,
  `if (kind === "system_overview") {
    const image = getOpenSolarImageUrl(appointment)
    if (image) y = await drawImage(pdf, image, ctx.padding, y, width, 110)`
)

fs.writeFileSync(filePath, source)
console.log("Solar contract fetch resilience patch applied")

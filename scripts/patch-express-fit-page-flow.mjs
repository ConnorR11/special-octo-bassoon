import fs from "fs"

const file = "src/contracts/GenerateSolarContract.js"
let source = fs.readFileSync(file, "utf8")

// The Express Fit card must never be forced upward over item rows. The itemised
// page can legitimately contain enough rows that there is not room for the
// full legal disclaimer. In that case render the consent on its own following
// page, using the same contract styling.
source = source.replace(
  /\n\s*await drawExpressFitSection\(pdf, ctx, appointment, y\)\n\}/,
  "\n}"
)

const itemisedBranch = '  } else if (kind === "itemised_breakdown") {\n    await drawItemisedBreakdown(pdf, page, ctx, data, results, appointment, epvs)\n'
if (!source.includes(itemisedBranch)) {
  throw new Error("Could not locate itemised breakdown render branch.")
}

if (!source.includes('kind === "express_fit"')) {
  source = source.replace(
    itemisedBranch,
    itemisedBranch + '  } else if (kind === "express_fit") {\n    await drawExpressFitSection(pdf, ctx, appointment, ctx.y + 5)\n'
  )
}

const loopMarker = '  const pdf = new jsPDF({ unit: "mm", format: pageSize.toLowerCase(), orientation })\n\n  for (let index = 0; index < pages.length; index += 1) {\n    if (index > 0) pdf.addPage(pageSize.toLowerCase(), orientation)\n    const page = pages[index]\n    await renderPage(pdf, page, index, pages.length, appointment, epvs)\n    footer(pdf, index, pages.length, page.settings || {}, appointment)\n  }'

if (!source.includes(loopMarker)) {
  throw new Error("Could not locate contract page rendering loop.")
}

const replacement = `  const renderPages = []\n  pages.forEach((page) => {\n    renderPages.push(page)\n    if (page?.settings?.page_kind === "itemised_breakdown") {\n      renderPages.push({\n        ...page,\n        id: \"express-fit-consent-page\",\n        title: \"Express Fit Consent\",\n        subtitle: \"Express consent to commence installation\",\n        body: \"\",\n        settings: {\n          ...(page.settings || {}),\n          page_kind: "express_fit",\n          show_footer: true\n        }\n      })\n    }\n  })\n\n  const pdf = new jsPDF({ unit: "mm", format: pageSize.toLowerCase(), orientation })\n\n  for (let index = 0; index < renderPages.length; index += 1) {\n    if (index > 0) pdf.addPage(pageSize.toLowerCase(), orientation)\n    const page = renderPages[index]\n    await renderPage(pdf, page, index, renderPages.length, appointment, epvs)\n    footer(pdf, index, renderPages.length, page.settings || {}, appointment)\n  }`

source = source.replace(loopMarker, replacement)

fs.writeFileSync(file, source)
console.log("Moved Express Fit consent to a dedicated following page when the itemised table has insufficient room.")

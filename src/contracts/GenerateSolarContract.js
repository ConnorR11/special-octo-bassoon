import jsPDF from "jspdf"
import { GenerateSolarContract as generateOriginal } from "./GenerateSolarContractLegacy.js"

const originalText = jsPDF.prototype.text
const originalRect = jsPDF.prototype.rect

function getPageNumber(pdf) {
  return pdf.internal?.getCurrentPageInfo?.()?.pageNumber || 1
}

function installTermsLayoutPatch() {
  if (jsPDF.prototype.__hsTermsPatchInstalledV2) return
  jsPDF.prototype.__hsTermsPatchInstalledV2 = true

  const termsPages = new Set()
  const termsTitleY = new Map()

  jsPDF.prototype.text = function(text, x, y, options, transform) {
    const value = Array.isArray(text) ? text.join(" ") : String(text ?? "")
    const normalized = value.trim().toLowerCase()
    const pageNumber = getPageNumber(this)

    // This is the actual title emitted by GenerateSolarContractLegacy.
    // Mark the current PDF page as the Terms & Conditions page and render
    // the title at the smaller size requested for the one-page T&C layout.
    if (normalized === "terms & conditions") {
      termsPages.add(pageNumber)
      const titleY = typeof y === "number" ? y + 1 : y
      termsTitleY.set(pageNumber, titleY)
      this.setFont("helvetica", "bold")
      this.setFontSize(16)
      this.setTextColor(16, 33, 43)
      return originalText.call(this, text, x, titleY, options, transform)
    }

    // The legacy renderer emits the subtitle underneath the title. Replace
    // that position with a right-aligned subtitle on the same title row.
    if (normalized === "please read before signing" && termsPages.has(pageNumber)) {
      const pageWidth = this.internal.pageSize.getWidth()
      const rightPadding = 18
      const titleY = termsTitleY.get(pageNumber) ?? y
      this.setFont("helvetica", "normal")
      this.setFontSize(7.5)
      this.setTextColor(100, 112, 120)
      return originalText.call(
        this,
        text,
        pageWidth - rightPadding,
        titleY,
        { ...(options || {}), align: "right" },
        transform
      )
    }

    // The T&C renderer starts its two-column body at ctx.y + 28. Pull it
    // upward so there is only a small gap below the full-width title rule.
    // Footer text is lower than this threshold and is therefore untouched.
    if (termsPages.has(pageNumber) && typeof y === "number") {
      const pageHeight = this.internal.pageSize.getHeight()
      if (y < pageHeight - 22) {
        return originalText.call(this, text, x, y - 16, options, transform)
      }
    }

    return originalText.apply(this, arguments)
  }

  // The legacy title renderer draws a 28mm accent rule. On the T&C page,
  // replace it with a rule spanning the complete content width.
  jsPDF.prototype.rect = function(x, y, w, h, style) {
    const pageNumber = getPageNumber(this)
    if (termsPages.has(pageNumber) && Math.abs(w - 28) < 0.1 && Math.abs(h - 1.2) < 0.1) {
      const pageWidth = this.internal.pageSize.getWidth()
      const rightPadding = 18
      return originalRect.call(this, x, y, pageWidth - x - rightPadding, h, style)
    }
    return originalRect.apply(this, arguments)
  }
}

installTermsLayoutPatch()

export async function GenerateSolarContract(args) {
  return generateOriginal(args)
}

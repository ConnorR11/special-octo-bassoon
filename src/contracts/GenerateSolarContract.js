import jsPDF from "jspdf"
import { GenerateSolarContract as generateOriginal } from "./GenerateSolarContractLegacy.js"

const originalText = jsPDF.prototype.text
const originalRect = jsPDF.prototype.rect

function getPageNumber(pdf) {
  return pdf.internal?.getCurrentPageInfo?.()?.pageNumber || 1
}

function installTermsLayoutPatch() {
  if (jsPDF.prototype.__hsTermsPatchInstalledV3) return
  jsPDF.prototype.__hsTermsPatchInstalledV3 = true

  const termsPages = new Set()
  const termsTitleY = new Map()

  jsPDF.prototype.text = function(text, x, y, options, transform) {
    const value = Array.isArray(text) ? text.join(" ") : String(text ?? "")
    const normalized = value.trim().toLowerCase()
    const pageNumber = getPageNumber(this)

    if (normalized === "terms & conditions") {
      termsPages.add(pageNumber)
      const titleY = typeof y === "number" ? y + 1 : y
      termsTitleY.set(pageNumber, titleY)
      this.setFont("helvetica", "bold")
      this.setFontSize(16)
      this.setTextColor(16, 33, 43)
      return originalText.call(this, text, x, titleY, options, transform)
    }

    // Force the T&C subtitle onto the exact same baseline as the title.
    // Use the recorded title position rather than the legacy subtitle y.
    if (normalized === "please read before signing" && termsTitleY.has(pageNumber)) {
      const pageWidth = this.internal.pageSize.getWidth()
      const rightPadding = 18
      const titleY = termsTitleY.get(pageNumber)
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

    // Pull the T&C body upward so it sits close beneath the full-width rule.
    if (termsPages.has(pageNumber) && typeof y === "number") {
      const pageHeight = this.internal.pageSize.getHeight()
      if (y < pageHeight - 22) {
        return originalText.call(this, text, x, y - 16, options, transform)
      }
    }

    return originalText.apply(this, arguments)
  }

  // Replace the short title accent rule with a full-width rule on T&C pages.
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

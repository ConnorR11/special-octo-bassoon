import jsPDF from "jspdf"
import { GenerateSolarContract as generateOriginal } from "./GenerateSolarContractLegacy.js"

const originalText = jsPDF.prototype.text
const originalRect = jsPDF.prototype.rect
const originalSetPage = jsPDF.prototype.setPage

function installTermsLayoutPatch() {
  if (jsPDF.prototype.__hsTermsPatchInstalled) return
  jsPDF.prototype.__hsTermsPatchInstalled = true

  let termsPage = null
  let currentPage = 1

  jsPDF.prototype.setPage = function(pageNumber) {
    currentPage = pageNumber
    return originalSetPage.apply(this, arguments)
  }

  jsPDF.prototype.text = function(text, x, y, options, transform) {
    const value = Array.isArray(text) ? text.join(" ") : String(text ?? "")

    if (value === "Terms & Conditions") {
      termsPage = currentPage
      this.setFontSize(16)
      return originalText.call(this, text, x, y + 1, options, transform)
    }

    if (currentPage === termsPage && value === "Please read before signing") {
      return originalText.call(this, text, this.internal.pageSize.getWidth() - 18, y + 1, { ...(options || {}), align: "right" }, transform)
    }

    if (currentPage === termsPage && typeof y === "number") {
      const pageHeight = this.internal.pageSize.getHeight()
      if (y < pageHeight - 22) {
        return originalText.call(this, text, x, y - 10, options, transform)
      }
    }

    return originalText.apply(this, arguments)
  }

  jsPDF.prototype.rect = function(x, y, w, h, style) {
    if (currentPage === termsPage && Math.abs(w - 28) < 0.1 && Math.abs(h - 1.2) < 0.1) {
      const pageWidth = this.internal.pageSize.getWidth()
      return originalRect.call(this, x, y, pageWidth - x - 18, h, style)
    }
    return originalRect.apply(this, arguments)
  }
}

installTermsLayoutPatch()

export async function GenerateSolarContract(args) {
  return generateOriginal(args)
}

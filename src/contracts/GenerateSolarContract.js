import jsPDF from "jspdf"
import { GenerateSolarContract as generateOriginal } from "./GenerateSolarContractLegacy.js"

const originalText = jsPDF.prototype.text
const originalRect = jsPDF.prototype.rect
const originalSetPage = jsPDF.prototype.setPage
const originalAddPage = jsPDF.prototype.addPage

function installTermsLayoutPatch() {
  if (jsPDF.prototype.__hsTermsPatchInstalled) return
  jsPDF.prototype.__hsTermsPatchInstalled = true

  let termsPage = null
  let termsTitleY = null
  let termsSubtitleSeen = false
  let currentPage = 1

  jsPDF.prototype.addPage = function() {
    currentPage += 1
    termsPage = null
    termsTitleY = null
    termsSubtitleSeen = false
    return originalAddPage.apply(this, arguments)
  }

  jsPDF.prototype.setPage = function(pageNumber) {
    currentPage = pageNumber
    termsPage = null
    termsTitleY = null
    termsSubtitleSeen = false
    return originalSetPage.apply(this, arguments)
  }

  jsPDF.prototype.text = function(text, x, y, options, transform) {
    const value = Array.isArray(text) ? text.join(" ") : String(text ?? "")
    const normalized = value.trim().toLowerCase()

    // T&C title: smaller than the standard page title so the complete
    // terms document has more vertical space available.
    if (normalized === "terms & conditions") {
      termsPage = currentPage
      termsTitleY = typeof y === "number" ? y + 1 : null
      this.setFontSize(16)
      return originalText.call(this, text, x, termsTitleY ?? y, options, transform)
    }

    // T&C subtitle: explicitly place it on the same baseline as the title,
    // aligned to the right-hand page padding. This deliberately ignores the
    // original subtitle Y position from the legacy renderer.
    if (normalized === "please read before signing") {
      termsPage = termsPage ?? currentPage
      termsSubtitleSeen = true
      const pageWidth = this.internal.pageSize.getWidth()
      const rightPadding = 18
      const subtitleY = termsTitleY ?? (typeof y === "number" ? y - 10 : 25)
      this.setFont("helvetica", "normal")
      this.setFontSize(7.5)
      this.setTextColor(100, 112, 120)
      return originalText.call(
        this,
        text,
        pageWidth - rightPadding,
        subtitleY,
        { ...(options || {}), align: "right" },
        transform
      )
    }

    // Pull the T&C body upward to make the complete document fit on one page.
    if (currentPage === termsPage && typeof y === "number") {
      const pageHeight = this.internal.pageSize.getHeight()
      if (y < pageHeight - 22) {
        return originalText.call(this, text, x, y - 10, options, transform)
      }
    }

    return originalText.apply(this, arguments)
  }

  // Replace the short title underline with a full-width rule.
  jsPDF.prototype.rect = function(x, y, w, h, style) {
    if ((currentPage === termsPage || termsSubtitleSeen) && Math.abs(w - 28) < 0.1 && Math.abs(h - 1.2) < 0.1) {
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

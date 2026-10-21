/**
 * Shared stage-group presentation tokens.
 * These are the exact colours used by the Installations Kanban headers.
 */
export const STAGE_GROUP_COLORS = Object.freeze({
  sales: Object.freeze({ background: "#e0f2fe", border: "#bae6fd", text: "#075985", badge: "#bae6fd" }),
  surveys: Object.freeze({ background: "#dcfce7", border: "#bbf7d0", text: "#166534", badge: "#bbf7d0" }),
  procurement: Object.freeze({ background: "#ffedd5", border: "#fed7aa", text: "#9a3412", badge: "#fed7aa" }),
  installations: Object.freeze({ background: "#ccfbf1", border: "#99f6e4", text: "#0f766e", badge: "#99f6e4" }),
  accounts: Object.freeze({ background: "#f3e8ff", border: "#e9d5ff", text: "#7e22ce", badge: "#e9d5ff" }),
  remedials: Object.freeze({ background: "#fef3c7", border: "#fde68a", text: "#92400e", badge: "#fde68a" }),
  complete: Object.freeze({ background: "#e0e7ff", border: "#c7d2fe", text: "#4338ca", badge: "#c7d2fe" }),
  dealLost: Object.freeze({ background: "#fee2e2", border: "#fecaca", text: "#b91c1c", badge: "#fecaca" }),
  postInstallations: Object.freeze({ background: "#f3e8ff", border: "#e9d5ff", text: "#9333ea", badge: "#e9d5ff" }),
  ungrouped: Object.freeze({ background: "#f1f5f9", border: "#e2e8f0", text: "#334155", badge: "#e2e8f0" }),
})

export const STAGE_GROUPS = [
  { key: "rts", order: 1, label: "Sales", stages: ["Awaiting Funds", "Secured - Awaiting Funds", "Returned To Sales", "Pending Cancellation", "Long Term", "On Hold"], ...STAGE_GROUP_COLORS.sales },
  { key: "surveys", order: 2, label: "Surveys", stages: ["Book for Survey", "Book for Survey (S)", "Survey Booked", "Survey Booked (S)"], ...STAGE_GROUP_COLORS.surveys },
  { key: "procurement", order: 3, label: "Procurement", stages: ["Costing", "To Order", "To Be Ordered", "Awaiting Customer Confirmation", "Awaiting Manufacture Date", "Awaiting EPVS (S)", "Planning", "To Book For Fit (S)", "Future Fit"], ...STAGE_GROUP_COLORS.procurement },
  { key: "installations", order: 4, label: "Installations", stages: ["Fit Allocated (In Manufacture)", "In Manufacture (To Book)", "Fit Booked (S)", "Fit Allocated (In Stock)", "Fit Booked", "Issues: Fitter To Book"], ...STAGE_GROUP_COLORS.installations },
  { key: "accounts", order: 5, label: "Accounts", stages: ["Cancelled - Awaiting Refund", "Fit Complete - Accounts To Check", "Admin Fee Outstanding", "Accounts To Check (S)", "Awaiting Balance", "Awaiting Balance (HES)", "Issues: Inspection", "Issues: Fitter Booked"], ...STAGE_GROUP_COLORS.accounts },
  { key: "remedials", order: 6, label: "Remedials", stages: ["Remedial To Check", "Remedial Ordered", "Engineer To Book (R)", "Engineer Booked (R)"], ...STAGE_GROUP_COLORS.remedials },
  { key: "complete", order: 7, label: "Complete", stages: ["Remedial Complete", "NAPIT Sign Off Complete", "Contract Complete"], ...STAGE_GROUP_COLORS.complete },
  { key: "post-installations", order: 8, label: "Post Installations", stages: ["Paperwork - Sent", "Fit Complete - Balance to be Paid", "Balance To Be Paid (S)", "NAPIT Sign Off", "Legal", "Payment Plan"], ...STAGE_GROUP_COLORS.postInstallations },
  { key: "deal-lost", order: 9, label: "Deal Lost", stages: ["Customer Cancelled", "Decline"], ...STAGE_GROUP_COLORS.dealLost },
]

export const UNGROUPED_STAGE_GROUP = { key: "ungrouped", order: 10, label: "Ungrouped", ...STAGE_GROUP_COLORS.ungrouped }

export function normalizeStage(value) {
  return String(value || "").trim().toLowerCase()
}

export function getStageGroup(value) {
  const key = normalizeStage(value)
  return STAGE_GROUPS.find(group => group.stages.some(stage => normalizeStage(stage) === key)) || UNGROUPED_STAGE_GROUP
}

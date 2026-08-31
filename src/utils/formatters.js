const money = (value) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const formatDate = (value) => {
  if (!value) return "—"

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`))
}

const statusLabel = (status) => {
  const labels = {
    sold: "Sold",
    survey_booked: "Survey booked",
    ready_for_installation: "Ready for installation",
    complete: "Complete",
  }

  return labels[status] || status || "Sold"
}

const getInitials = (name) => {
  if (!name) return "?"

  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export { money, formatDate, statusLabel, getInitials }

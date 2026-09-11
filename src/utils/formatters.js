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

/*
 * Displays a Supabase timestamp using the time stored in the database.
 *
 * Example:
 * Supabase: 2026-05-30 10:30:00+00
 * Displays: 30 May 2026, 10:30
 *
 * It deliberately does NOT convert the timestamp to Europe/London,
 * so an appointment stored as 10:30 remains displayed as 10:30.
 */
const formatDateTime = (value) => {
  if (!value) return "—"

  const match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/
  )

  if (!match) return "—"

  const [, year, month, day, hour, minute] = match

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  )

  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}

/*
 * Displays only the time stored in the Supabase timestamp.
 *
 * Example:
 * 2026-05-30 10:30:00+00
 * Displays: 10:30
 */
const formatTime = (value) => {
  if (!value) return "—"

  const match = String(value).match(
    /[T ](\d{2}):(\d{2})/
  )

  if (!match) return "—"

  return `${match[1]}:${match[2]}`
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

export {
  money,
  formatDate,
  formatDateTime,
  formatTime,
  statusLabel,
  getInitials,
}
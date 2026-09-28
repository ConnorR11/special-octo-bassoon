import React from "react"
import { Phone } from "lucide-react"
import PhoneDialer from "./PhoneDialer"

/**
 * Reusable CRM call button.
 *
 * Use either:
 *   <CallButton appointment={appointment} />
 * or:
 *   <CallButton deal={deal} />
 *
 * The component resolves the correct phone field and passes the record
 * context into the softphone so the backend can associate the call log.
 */
export default function CallButton({ appointment, deal, label = "Call", style = {}, menuItem = false }) {
  const [open, setOpen] = React.useState(false)

  const isAppointment = Boolean(appointment)
  const record = appointment || deal || null
  const phone = isAppointment
    ? appointment?.phone_number_1 || appointment?.phone || ""
    : deal?.phone || ""

  const customerName = isAppointment
    ? appointment?.name || ""
    : deal?.customer_name || ""

  const context = isAppointment
    ? {
        type: "appointment",
        appointmentId: appointment?.appointment_row_id || null,
        entityId: null,
      }
    : {
        type: "deal",
        appointmentId: deal?.appointment_row_id || null,
        entityId: deal?.id || null,
      }

  const baseStyle = menuItem
    ? {
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 9,
        minHeight: 34,
        padding: "7px 10px",
        border: 0,
        borderRadius: 7,
        background: "transparent",
        color: phone ? "#24313d" : "#b8c0c8",
        fontFamily: "inherit",
        fontSize: 11,
        fontWeight: 600,
        textAlign: "left",
        cursor: phone ? "pointer" : "not-allowed",
        ...style,
      }
    : {
        height: 34,
        padding: "0 12px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        border: 0,
        borderRadius: 7,
        background: phone ? "#17804b" : "#dfe4e8",
        color: phone ? "#fff" : "#8a949c",
        fontFamily: "inherit",
        fontSize: 11,
        fontWeight: 700,
        cursor: phone ? "pointer" : "not-allowed",
        ...style,
      }

  function handleClick() {
    if (!phone) return
    setOpen(true)
  }

  return (
    <>
      <button type="button" disabled={!phone} onClick={handleClick} title={phone ? `Call ${customerName || phone}` : "No phone number available"} style={baseStyle}>
        <Phone size={menuItem ? 14 : 15} />
        <span>{label}</span>
      </button>
      {open && (
        <PhoneDialer
          onClose={() => setOpen(false)}
          initialNumber={phone}
          customerName={customerName}
          callContext={context}
          record={record}
        />
      )}
    </>
  )
}

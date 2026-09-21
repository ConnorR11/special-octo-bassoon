import React, { useEffect, useState } from "react"
import { Search, CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { supabase } from "../lib/supabase"
import CreateAppointment from "./CreateAppointment"

function isCentralConfirmationManager(role) {
  const normalized = String(role || "").trim().toLowerCase()

  return (
    normalized === "central confirmation manager" ||
    normalized === "central confirmer manager"
  )
}

function Appointments({
  onSelectAppointment,
  previewUser = null,
  permissionLevel = 0,
  role = "",
}) {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [showCreateAppointment, setShowCreateAppointment] = useState(false)
  const pageSize = 50

  const numericPermissionLevel = Number(permissionLevel) || 0

  // Permission 3+ can see everything. The Central Confirmation Manager
  // can also see every appointment, even though their normal permission
  // level is lower.
  const canViewAllAppointments =
    numericPermissionLevel >= 3 ||
    isCentralConfirmationManager(role)

  async function loadAppointments() {
    setLoading(true)
    setError("")

    try {
      const from = page * pageSize
      const to = from + pageSize

      // Work out who is viewing the appointments. In admin preview mode
      // previewUser is the profile being previewed; otherwise use the
      // currently authenticated user's profile.
      let viewerProfile = previewUser || null

      if (!viewerProfile) {
        const { data: authData, error: authError } =
          await supabase.auth.getUser()

        if (authError) throw authError

        const authUserId = authData?.user?.id

        if (authUserId) {
          const { data: currentProfile, error: profileError } =
            await supabase
              .from("profiles")
              .select("id, auth_user_id, email, full_name, role, permission_level, branch_manager, sales_manager")
              .eq("auth_user_id", authUserId)
              .maybeSingle()

          if (profileError) throw profileError
          viewerProfile = currentProfile || null
        }
      }

      // For managers we need the profiles of the reps they are responsible
      // for. Both profile UUIDs and auth UUIDs are supported because the
      // manager columns have been used with auth UUIDs in the CRM.
      let managedRepEmails = []

      if (!canViewAllAppointments && viewerProfile) {
        const viewerProfileId = String(viewerProfile.id || "").trim()
        const viewerAuthId = String(viewerProfile.auth_user_id || "").trim()
        const viewerEmail = String(viewerProfile.email || "").trim().toLowerCase()

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, auth_user_id, email, branch_manager, sales_manager")

        if (profilesError) throw profilesError

        const viewerIds = new Set(
          [viewerProfileId, viewerAuthId]
            .filter(Boolean)
            .map((value) => String(value).trim())
        )

        managedRepEmails = (profiles || [])
          .filter((repProfile) => {
            const branchManager = String(repProfile.branch_manager || "").trim()
            const salesManager = String(repProfile.sales_manager || "").trim()

            return (
              viewerIds.has(branchManager) ||
              viewerIds.has(salesManager)
            )
          })
          .map((repProfile) => String(repProfile.email || "").trim().toLowerCase())
          .filter(Boolean)

        // Managers may also have their own appointments, so include their
        // own email in addition to the reps they manage.
        if (viewerEmail) {
          managedRepEmails.push(viewerEmail)
        }

        managedRepEmails = [...new Set(managedRepEmails)]
      }

      // Fetch one extra row so we can determine whether another page exists.
      // This avoids an expensive count(*) query on every search/page change.
      let request = supabase
        .from("appointments")
        .select("*")
        .order("appointment_date", { ascending: false, nullsFirst: false })
        .range(from, to)

      if (!canViewAllAppointments) {
        // Managers see appointments for reps they manage. Everyone else sees
        // only appointments allocated to themselves.
        if (managedRepEmails.length > 0) {
          request = request.in("rep_allocated", managedRepEmails)
        } else {
          const ownEmail = String(viewerProfile?.email || previewUser?.email || "")
            .trim()
            .toLowerCase()

          if (ownEmail) {
            request = request.eq("rep_allocated", ownEmail)
          }
        }
      }

      const search = query.trim()
      if (search) {
        const safeSearch = search.replace(/[%(),]/g, " ").trim()
        if (safeSearch) {
          request = request.or(
            [
              `name.ilike.%${safeSearch}%`,
              `postcode.ilike.%${safeSearch}%`,
              `rep_allocated.ilike.%${safeSearch}%`,
              `phone_number_1.ilike.%${safeSearch}%`,
              `email_address.ilike.%${safeSearch}%`,
            ].join(","),
          )
        }
      }

      const { data, error: supabaseError } = await request
      if (supabaseError) throw supabaseError

      const rows = data || []
      setHasMore(rows.length > pageSize)
      setAppointments(rows.slice(0, pageSize))
    } catch (err) {
      console.error("Error loading appointments:", err)
      setError(err?.message || "Unable to load appointments.")
      setAppointments([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(0)
  }, [previewUser?.id])

  // Debounce search so we don't issue a database query for every keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadAppointments()
    }, query ? 300 : 0)

    return () => window.clearTimeout(timer)
  }, [page, query, previewUser?.id, previewUser?.email, canViewAllAppointments])

  function handleSearch(value) {
    setQuery(value)
    setPage(0)
  }

  function formatDate(value) {
    if (!value) return "—"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value

    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  function getResult(appointment) {
    return appointment.result || appointment.status || "—"
  }

  function openAppointment(appointment) {
    onSelectAppointment?.(appointment)
  }

  const canGoBack = page > 0
  const canGoForward = hasMore
  const showingFrom = page * pageSize + 1
  const showingTo = page * pageSize + appointments.length

  if (showCreateAppointment) {
    return (
      <CreateAppointment
        onBack={() => setShowCreateAppointment(false)}
        onCreated={() => {
          setShowCreateAppointment(false)
          setPage(0)
          loadAppointments()
        }}
      />
    )
  }

  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: "#222" }}>
            Appointments
          </h1>
          <p style={{ margin: "5px 0 0", fontSize: 11, color: "#888" }}>
            {previewUser
              ? `Viewing ${previewUser.full_name || previewUser.email}`
              : canViewAllAppointments
                ? "All appointments · 50 per page"
                : "50 appointments per page"}
          </p>
        </div>

        {!previewUser && (
          <button
            type="button"
            onClick={() => setShowCreateAppointment(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              height: 38,
              padding: "0 14px",
              border: 0,
              borderRadius: 8,
              background: "#0877bd",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 5px rgba(8,119,189,.18)",
              whiteSpace: "nowrap",
            }}
          >
            <Plus size={15} />
            Create Appointment
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 18, padding: "12px 14px" }}>
        <div style={{ position: "relative" }}>
          <Search
            size={15}
            style={{
              position: "absolute",
              left: 11,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#999",
            }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search customer, postcode, phone, email or sales rep..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              height: 38,
              padding: "0 12px 0 34px",
              border: "1px solid #d9dadd",
              borderRadius: 7,
              outline: "none",
              fontFamily: "inherit",
              fontSize: 12,
            }}
          />
        </div>
      </div>

      {error && (
        <div className="error" style={{ marginBottom: 18 }}>
          <b>Database error</b>
          <span>{error}</span>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.7fr 1.4fr 1fr 1fr 1fr 100px",
            padding: "11px 16px",
            background: "#f7f7f8",
            borderBottom: "1px solid #dddfe3",
            fontSize: 9,
            fontWeight: 700,
            color: "#777",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          <div>Customer</div>
          <div>Appointment</div>
          <div>Postcode</div>
          <div>Type</div>
          <div>Sales Rep</div>
          <div>Result</div>
        </div>

        {loading ? (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              color: "#999",
              fontSize: 12,
            }}
          >
            Loading appointments...
          </div>
        ) : appointments.length === 0 ? (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              color: "#999",
              fontSize: 12,
            }}
          >
            <CalendarDays size={28} style={{ marginBottom: 8 }} />
            <div>No appointments found.</div>
          </div>
        ) : (
          appointments.map((appointment) => (
            <button
              key={appointment.appointment_row_id}
              type="button"
              onClick={() => openAppointment(appointment)}
              style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "1.7fr 1.4fr 1fr 1fr 1fr 100px",
                padding: "13px 16px",
                border: 0,
                borderBottom: "1px solid #eeeeef",
                background: "#fff",
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#fafbfc"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#fff"
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#222",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {appointment.name || "Unnamed customer"}
                </div>
                {appointment.phone_number_1 && (
                  <div style={{ marginTop: 3, fontSize: 9, color: "#888" }}>
                    {appointment.phone_number_1}
                  </div>
                )}
              </div>

              <div style={{ fontSize: 10, color: "#444" }}>
                {formatDate(appointment.appointment_date)}
              </div>

              <div style={{ fontSize: 10, color: "#555" }}>
                {appointment.postcode || "—"}
              </div>

              <div style={{ fontSize: 10, color: "#555" }}>
                {appointment.product ||
                  appointment.type ||
                  appointment.appointment_type ||
                  "—"}
              </div>

              <div style={{ fontSize: 10, color: "#555" }}>
                {appointment.rep_allocated || "—"}
              </div>

              <div>
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 7px",
                    borderRadius: 5,
                    background: "#f2f3f5",
                    color: "#555",
                    fontSize: 9,
                    fontWeight: 600,
                  }}
                >
                  {getResult(appointment)}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {(appointments.length > 0 || canGoBack) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 14,
          }}
        >
          <div style={{ fontSize: 10, color: "#888" }}>
            Showing {showingFrom} – {showingTo}
            {hasMore ? " · More available" : " · End of results"}
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              type="button"
              disabled={!canGoBack}
              onClick={() => setPage((value) => value - 1)}
              style={{
                width: 34,
                height: 32,
                border: "1px solid #dddfe3",
                borderRadius: 7,
                background: "#fff",
                cursor: canGoBack ? "pointer" : "default",
                opacity: canGoBack ? 1 : 0.4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronLeft size={15} />
            </button>

            <div
              style={{
                minWidth: 70,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                color: "#555",
              }}
            >
              Page {page + 1}
            </div>

            <button
              type="button"
              disabled={!canGoForward}
              onClick={() => setPage((value) => value + 1)}
              style={{
                width: 34,
                height: 32,
                border: "1px solid #dddfe3",
                borderRadius: 7,
                background: "#fff",
                cursor: canGoForward ? "pointer" : "default",
                opacity: canGoForward ? 1 : 0.4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export default Appointments

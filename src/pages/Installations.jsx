import React, { useEffect, useMemo, useState } from "react"
import {
  Search,
  CalendarDays,
  MapPin,
  UserRound,
  RefreshCw,
} from "lucide-react"
import { supabase } from "../lib/supabase"

function isCentralConfirmationManager(role) {
  const normalized = String(role || "").trim().toLowerCase()

  return (
    normalized === "central confirmation manager" ||
    normalized === "central confirmer manager"
  )
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

function getStageLabel(value) {
  const stage = String(value || "").trim()
  return stage || "No Stage"
}

function getRepName(appointment) {
  return (
    appointment?.rep_name ||
    appointment?.sales_rep ||
    appointment?.rep_allocated ||
    "Unallocated"
  )
}

function getAppointmentId(appointment) {
  return appointment?.appointment_row_id
}

export default function Installations() {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [profile, setProfile] = useState(null)

  async function loadInstallations(showRefresh = false) {
    if (!supabase) {
      setError("Supabase is not configured.")
      setLoading(false)
      return
    }

    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    setError("")

    try {
      let viewerProfile = profile

      if (!viewerProfile) {
        let previewId = null

        const { data: previewData, error: previewError } =
          await supabase.rpc("current_preview_profile_id")

        if (!previewError) {
          previewId = previewData || null
        }

        if (previewId) {
          const { data, error: previewProfileError } = await supabase
            .from("profiles")
            .select("id, auth_user_id, email, full_name, role, permission_level, branch")
            .eq("id", previewId)
            .maybeSingle()

          if (previewProfileError) throw previewProfileError
          viewerProfile = data || null
        }

        if (!viewerProfile) {
          const { data: authData, error: authError } =
            await supabase.auth.getUser()

          if (authError) throw authError

          const authUserId = authData?.user?.id

          if (authUserId) {
            const { data, error: profileError } = await supabase
              .from("profiles")
              .select("id, auth_user_id, email, full_name, role, permission_level, branch")
              .eq("auth_user_id", authUserId)
              .maybeSingle()

            if (profileError) throw profileError
            viewerProfile = data || null
          }
        }

        setProfile(viewerProfile)
      }

      const permissionLevel = Number(viewerProfile?.permission_level) || 0
      const role = viewerProfile?.role || ""
      const canViewAll =
        permissionLevel >= 3 ||
        isCentralConfirmationManager(role)
      const canViewBranch = permissionLevel >= 2

      let request = supabase
        .from("appointments")
        .select("*")
        .order("appointment_date", { ascending: true, nullsFirst: false })

      if (!canViewAll) {
        const branch = String(viewerProfile?.branch || "").trim()

        if (canViewBranch && branch) {
          request = request.eq("branch", branch)
        } else {
          const email = String(viewerProfile?.email || "")
            .trim()
            .toLowerCase()

          if (email) {
            request = request.eq("rep_allocated", email)
          }
        }
      }

      const { data, error: appointmentsError } = await request

      if (appointmentsError) throw appointmentsError

      setAppointments(data || [])
    } catch (err) {
      console.error("Error loading installations:", err)
      setError(err?.message || "Unable to load installations.")
      setAppointments([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadInstallations()
  }, [])

  const filteredAppointments = useMemo(() => {
    const search = query.trim().toLowerCase()

    if (!search) return appointments

    return appointments.filter((appointment) => {
      const haystack = [
        appointment?.name,
        appointment?.postcode,
        appointment?.product,
        appointment?.rep_allocated,
        appointment?.rep_name,
        appointment?.sales_rep,
        appointment?.branch,
        appointment?.pipedrive_stage,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return haystack.includes(search)
    })
  }, [appointments, query])

  const columns = useMemo(() => {
    const grouped = new Map()

    filteredAppointments.forEach((appointment) => {
      const stage = getStageLabel(appointment?.pipedrive_stage)

      if (!grouped.has(stage)) grouped.set(stage, [])
      grouped.get(stage).push(appointment)
    })

    return Array.from(grouped.entries()).map(([stage, items]) => ({
      stage,
      items,
    }))
  }, [filteredAppointments])

  function openAppointment(appointment) {
    const id = getAppointmentId(appointment)
    if (!id) return

    window.history.pushState({}, "", `/appointments/${encodeURIComponent(id)}`)
    window.dispatchEvent(new PopStateEvent("popstate"))
  }

  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: "#222" }}>
            Installations
          </h1>
          <p style={{ margin: "5px 0 0", fontSize: 11, color: "#888" }}>
            Read-only installation board grouped by Pipedrive stage
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadInstallations(true)}
          disabled={loading || refreshing}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            height: 36,
            padding: "0 12px",
            border: "1px solid #dfe4e8",
            borderRadius: 7,
            background: "#fff",
            color: "#344454",
            cursor: loading || refreshing ? "default" : "pointer",
            opacity: loading || refreshing ? 0.6 : 1,
            fontFamily: "inherit",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: "12px 14px" }}>
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
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search customer, postcode, product, sales rep or stage..."
            style={{
              width: "100%",
              height: 38,
              boxSizing: "border-box",
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
        <div className="error" style={{ marginBottom: 16 }}>
          <b>Database error</b>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: 60, textAlign: "center", color: "#888", fontSize: 12 }}>
          Loading installations...
        </div>
      ) : columns.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: "center", color: "#888", fontSize: 12 }}>
          No installations found.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 14,
            overflowX: "auto",
            alignItems: "flex-start",
            paddingBottom: 12,
          }}
        >
          {columns.map((column) => (
            <div
              key={column.stage}
              style={{
                flex: "0 0 300px",
                width: 300,
                background: "#f5f7f9",
                border: "1px solid #e1e6ea",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "12px 13px",
                  borderBottom: "1px solid #e1e6ea",
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#263645",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={column.stage}
                >
                  {column.stage}
                </div>

                <span
                  style={{
                    flex: "0 0 auto",
                    minWidth: 24,
                    height: 22,
                    padding: "0 6px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 11,
                    background: "#eef2f5",
                    color: "#5d6a75",
                    fontSize: 9,
                    fontWeight: 800,
                  }}
                >
                  {column.items.length}
                </span>
              </div>

              <div style={{ padding: 9, display: "grid", gap: 9 }}>
                {column.items.map((appointment) => (
                  <button
                    key={appointment.appointment_row_id}
                    type="button"
                    onClick={() => openAppointment(appointment)}
                    style={{
                      width: "100%",
                      padding: 12,
                      border: "1px solid #e0e5e9",
                      borderRadius: 8,
                      background: "#fff",
                      textAlign: "left",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      boxShadow: "0 1px 2px rgba(0,0,0,.04)",
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.borderColor = "#b9c8d3"
                      event.currentTarget.style.boxShadow = "0 3px 10px rgba(0,0,0,.07)"
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.borderColor = "#e0e5e9"
                      event.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,.04)"
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#1f2933",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {appointment.name || "Unnamed customer"}
                    </div>

                    <div style={{ marginTop: 9, display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", color: "#687782", fontSize: 9.5 }}>
                        <CalendarDays size={13} />
                        <span>{formatDate(appointment.appointment_date)}</span>
                      </div>

                      <div style={{ display: "flex", gap: 6, alignItems: "center", color: "#687782", fontSize: 9.5 }}>
                        <MapPin size={13} />
                        <span>{appointment.postcode || "No postcode"}</span>
                      </div>

                      <div style={{ display: "flex", gap: 6, alignItems: "center", color: "#687782", fontSize: 9.5 }}>
                        <UserRound size={13} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {getRepName(appointment)}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        paddingTop: 9,
                        borderTop: "1px solid #eef1f3",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        fontSize: 9,
                        color: "#7b8790",
                      }}
                    >
                      <span>{appointment.product || appointment.job_type || "—"}</span>
                      <span>{appointment.branch || ""}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

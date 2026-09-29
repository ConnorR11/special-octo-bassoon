import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"

const VisibilityContext = createContext(null)

function normalise(value) {
  return String(value ?? "").trim().toLowerCase()
}

function normaliseEmail(value) {
  return normalise(value)
}

function normaliseBranch(value) {
  return String(value ?? "").trim()
}

function isBranchManagerRole(role) {
  return normalise(role).endsWith("branch manager")
}

function isSalesManagerRole(role) {
  return normalise(role).endsWith("sales manager")
}

function isCentralConfirmationManager(role) {
  const value = normalise(role)
  return value === "central confirmation manager" || value === "central confirmer manager"
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

export function VisibilityProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [previewUser, setPreviewUser] = useState(null)
  const [managedProfiles, setManagedProfiles] = useState([])
  const [branchProfiles, setBranchProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return undefined
    }

    let mounted = true

    async function loadSession() {
      const { data, error: sessionError } = await supabase.auth.getSession()

      if (!mounted) return

      if (sessionError) {
        console.error("VisibilityContext: error loading session:", sessionError)
        setSession(null)
      } else {
        setSession(data?.session || null)
      }
    }

    loadSession()

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (mounted) setSession(nextSession || null)
      }
    )

    return () => {
      mounted = false
      authListener?.subscription?.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadProfileAndPreview() {
      if (!session || !supabase) {
        setProfile(null)
        setPreviewUser(null)
        setManagedProfiles([])
        setBranchProfiles([])
        setLoading(false)
        return
      }

      setLoading(true)
      setError("")

      try {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("auth_user_id", session.user.id)
          .maybeSingle()

        if (profileError) throw profileError
        if (!mounted) return

        setProfile(profileData || null)

        let nextPreviewUser = null

        const { data: previewId, error: previewError } = await supabase.rpc(
          "current_preview_profile_id"
        )

        if (previewError) {
          // The preview RPC is optional. A normal login should continue if it
          // is unavailable, while still surfacing the error in the console.
          console.warn("VisibilityContext: preview lookup failed:", previewError)
        } else if (previewId) {
          const { data: previewProfile, error: previewProfileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", previewId)
            .maybeSingle()

          if (previewProfileError) throw previewProfileError
          nextPreviewUser = previewProfile || null
        }

        if (!mounted) return
        setPreviewUser(nextPreviewUser)
      } catch (err) {
        console.error("VisibilityContext: error loading profile:", err)
        if (!mounted) return
        setError(err?.message || "Unable to load visibility profile.")
        setProfile(null)
        setPreviewUser(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadProfileAndPreview()

    return () => {
      mounted = false
    }
  }, [session])

  const effectiveProfile = previewUser || profile
  const permissionLevel = Number(effectiveProfile?.permission_level) || 0
  const role = effectiveProfile?.role || ""
  const email = effectiveProfile?.email || session?.user?.email || ""
  const branch = normaliseBranch(effectiveProfile?.branch)
  const profileId = effectiveProfile?.id || null
  const pipedrivePersonId = String(effectiveProfile?.pipedrive_person_id || "").trim()

  const isAdministrator = permissionLevel >= 4
  const isBranchManager = isBranchManagerRole(role)
  const isSalesManager = isSalesManagerRole(role)
  const isCentralManager = isCentralConfirmationManager(role)
  const isManager = isBranchManager || isSalesManager || isCentralManager
  const isSalesRep = !isManager && permissionLevel < 4

  useEffect(() => {
    let mounted = true

    async function loadVisibilityProfiles() {
      if (!supabase || !effectiveProfile?.id) {
        setManagedProfiles([])
        setBranchProfiles([])
        return
      }

      try {
        const viewerId = effectiveProfile.id
        const viewerBranch = normaliseBranch(effectiveProfile.branch)

        const managedPromise = supabase
          .from("profiles")
          .select("*")
          .or(`manager_id.eq.${viewerId},sales_manager.eq.${viewerId}`)

        const branchPromise = viewerBranch
          ? supabase
              .from("profiles")
              .select("*")
              .eq("branch", viewerBranch)
          : Promise.resolve({ data: [], error: null })

        const [managedResult, branchResult] = await Promise.all([
          managedPromise,
          branchPromise,
        ])

        if (managedResult.error) throw managedResult.error
        if (branchResult.error) throw branchResult.error
        if (!mounted) return

        setManagedProfiles(managedResult.data || [])
        setBranchProfiles(branchResult.data || [])
      } catch (err) {
        console.error("VisibilityContext: error loading visibility profiles:", err)
        if (!mounted) return
        setManagedProfiles([])
        setBranchProfiles([])
      }
    }

    loadVisibilityProfiles()

    return () => {
      mounted = false
    }
  }, [effectiveProfile?.id, effectiveProfile?.branch])

  const visibility = useMemo(() => {
    const ownEmail = normaliseEmail(email)

    const managedSalespersonIds = managedProfiles
      .map(row => String(row?.pipedrive_person_id || "").trim())
      .filter(Boolean)

    const branchSalespersonIds = branchProfiles
      .map(row => String(row?.pipedrive_person_id || "").trim())
      .filter(Boolean)

    const managedEmails = managedProfiles
      .map(row => normaliseEmail(row?.email))
      .filter(Boolean)

    const branchEmails = branchProfiles
      .map(row => normaliseEmail(row?.email))
      .filter(Boolean)

    const visibleSalespersonIds = isAdministrator
      ? null
      : isBranchManager
      ? unique([...branchSalespersonIds, pipedrivePersonId])
      : isSalesManager
      ? unique([...managedSalespersonIds, pipedrivePersonId])
      : unique([pipedrivePersonId])

    const visibleRepEmails = isAdministrator
      ? null
      : isBranchManager
      ? unique([...branchEmails, ownEmail])
      : isSalesManager
      ? unique([...managedEmails, ownEmail])
      : unique([ownEmail])

    const visibleBranches = isAdministrator
      ? null
      : branch
      ? [branch]
      : []

    const canSeeAll = isAdministrator

    function canSeeAppointment(appointment) {
      if (!appointment) return false
      if (canSeeAll) return true

      const appointmentBranch = normaliseBranch(appointment?.branch)
      const allocatedEmail = normaliseEmail(appointment?.rep_allocated)

      if ((isBranchManager || isSalesManager) && branch && appointmentBranch === normaliseBranch(branch)) {
        return true
      }

      return !!allocatedEmail && visibleRepEmails?.includes(allocatedEmail)
    }

    function canSeeDeal(deal) {
      if (!deal) return false
      if (canSeeAll) return true

      const dealBranch = normaliseBranch(deal?.branch || deal?.branch_name)
      const salesperson = String(deal?.salesperson || "").trim()

      if ((isBranchManager || isSalesManager) && branch && dealBranch === normaliseBranch(branch)) {
        return true
      }

      return !!salesperson && visibleSalespersonIds?.includes(salesperson)
    }

    function canSeeRecord(record, resource = "generic") {
      if (!record) return false
      if (canSeeAll) return true

      if (resource === "appointments" || resource === "appointment") {
        return canSeeAppointment(record)
      }

      if (resource === "deals" || resource === "deal" || resource === "contracts") {
        return canSeeDeal(record)
      }

      const recordBranch = normaliseBranch(record?.branch || record?.branch_name)
      const recordEmail = normaliseEmail(
        record?.email || record?.rep_allocated || record?.salesperson_email
      )
      const recordSalesperson = String(
        record?.salesperson || record?.pipedrive_person_id || ""
      ).trim()

      if ((isBranchManager || isSalesManager) && branch && recordBranch === normaliseBranch(branch)) {
        return true
      }

      if (recordEmail && visibleRepEmails?.includes(recordEmail)) return true
      if (recordSalesperson && visibleSalespersonIds?.includes(recordSalesperson)) return true

      return false
    }

    return {
      canSeeAll,
      permissionLevel,
      role,
      email,
      branch,
      profileId,
      pipedrivePersonId,
      isAdministrator,
      isManager,
      isBranchManager,
      isSalesManager,
      isCentralManager,
      isSalesRep,
      managedProfiles,
      branchProfiles,
      managedSalespersonIds: unique(managedSalespersonIds),
      branchSalespersonIds: unique(branchSalespersonIds),
      visibleSalespersonIds,
      visibleRepEmails,
      visibleBranches,
      canSeeAppointment,
      canSeeDeal,
      canSeeRecord,
    }
  }, [
    branch,
    branchProfiles,
    email,
    isAdministrator,
    isBranchManager,
    isCentralManager,
    isManager,
    isSalesManager,
    isSalesRep,
    managedProfiles,
    permissionLevel,
    pipedrivePersonId,
    profileId,
    role,
  ])

  const value = useMemo(
    () => ({
      session,
      profile,
      previewUser,
      effectiveProfile,
      loading,
      error,
      ...visibility,
    }),
    [session, profile, previewUser, effectiveProfile, loading, error, visibility]
  )

  return (
    <VisibilityContext.Provider value={value}>
      {children}
    </VisibilityContext.Provider>
  )
}

export function useVisibility() {
  const context = useContext(VisibilityContext)

  if (!context) {
    throw new Error("useVisibility must be used inside a VisibilityProvider")
  }

  return context
}

export default VisibilityContext

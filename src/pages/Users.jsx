import React, { useEffect, useMemo, useState } from "react"
import {
  Search,
  Plus,
  Pencil,
  X,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Users as UsersIcon,
  GitBranch,
} from "lucide-react"

import { supabase } from "../lib/supabase"


/* =========================================================
   HELPERS
========================================================= */

function display(value, fallback = "—") {
  const text = String(value ?? "").trim()
  return text || fallback
}


/* =========================================================
   PERMISSION / ROLE LABEL
========================================================= */

function getPermissionLabel(level) {
  const value = Number(level)

  if (value >= 4) return "Administrator"
  if (value === 3) return "Management"
  if (value === 2) return "Supervisor"

  return "Standard"
}


/* =========================================================
   USERS PAGE
========================================================= */

export default function Users() {

  const [users, setUsers] = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState("")

  const [search, setSearch] = useState("")

  const [showInactive, setShowInactive] = useState(false)

  const [showModal, setShowModal] = useState(false)

  const [editingUser, setEditingUser] = useState(null)


  /* =======================================================
     TREE EXPANSION
  ======================================================= */

  const [collapsedManagers, setCollapsedManagers] = useState({})
  const [collapsedBranches, setCollapsedBranches] = useState({})


  /* =======================================================
     FORM
  ======================================================= */

  const emptyForm = {
    auth_user_id: "",
    full_name: "",
    role: "",
    branch: "",
    permission_level: 1,
    manager_id: "",
    active: true,
  }

  const [form, setForm] = useState(emptyForm)


  /* =======================================================
     LOAD USERS
  ======================================================= */

  async function loadUsers() {

    if (!supabase) {
      setError(
        "Supabase is not configured. Check your environment variables."
      )

      setLoading(false)
      return
    }

    setLoading(true)
    setError("")

    try {

      const {
        data,
        error: supabaseError,
      } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name", {
          ascending: true,
          nullsFirst: false,
        })

      if (supabaseError) {
        throw supabaseError
      }

      setUsers(data || [])

    } catch (err) {

      console.error(
        "Error loading users:",
        err
      )

      setError(
        err?.message ||
        "Unable to load users."
      )

      setUsers([])

    } finally {

      setLoading(false)

    }
  }


  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    loadUsers()
  }, [])


  /* =======================================================
     MANAGERS
  ======================================================= */

  const managers = useMemo(() => {

    return users
      .filter(
        user =>
          user.active !== false
      )
      .sort((a, b) =>
        display(a.full_name)
          .localeCompare(
            display(b.full_name)
          )
      )

  }, [users])


  /* =======================================================
     UNIQUE ROLES
  ======================================================= */

  const roles = useMemo(() => {

    return [
      ...new Set(
        users
          .map(user =>
            String(user.role || "").trim()
          )
          .filter(Boolean)
      ),
    ].sort((a, b) =>
      a.localeCompare(b)
    )

  }, [users])


  /* =======================================================
     FILTER USERS
  ======================================================= */

  const filteredUsers = useMemo(() => {

    const query =
      search
        .toLowerCase()
        .trim()

    return users.filter(user => {

      if (
        !showInactive &&
        user.active === false
      ) {
        return false
      }

      if (!query) {
        return true
      }

      const values = [
        user.full_name,
        user.role,
        user.branch,
        user.manager_id,
        getPermissionLabel(
          user.permission_level
        ),
      ]

      return values.some(value =>
        String(value ?? "")
          .toLowerCase()
          .includes(query)
      )

    })

  }, [
    users,
    search,
    showInactive,
  ])


  /* =======================================================
     MANAGER NAME
  ======================================================= */

  function getManagerName(managerId) {

    if (!managerId) {
      return "No manager"
    }

    const manager =
      users.find(
        user =>
          user.id === managerId
      )

    return display(
      manager?.full_name,
      "Unknown manager"
    )
  }


  /* =======================================================
     TREE STRUCTURE
  ======================================================= */

  const tree = useMemo(() => {

    const visibleUsers = filteredUsers

    const managersMap = new Map()

    visibleUsers.forEach(user => {

      if (!user.manager_id) {
        return
      }

      if (!managersMap.has(user.manager_id)) {

        managersMap.set(
          user.manager_id,
          []
        )

      }

      managersMap
        .get(user.manager_id)
        .push(user)

    })


    /*
     * Managers are users who either:
     *
     * 1. Have direct reports
     * 2. Have permission level >= 2
     *
     */

    const managerUsers =
      visibleUsers
        .filter(user =>
          managersMap.has(user.id) ||
          Number(user.permission_level) >= 2
        )
        .sort((a, b) =>
          display(a.full_name)
            .localeCompare(
              display(b.full_name)
            )
        )


    /*
     * Users without managers
     */

    const unassigned =
      visibleUsers
        .filter(user =>
          !user.manager_id &&
          !managerUsers.some(
            manager =>
              manager.id === user.id
          )
        )
        .sort((a, b) =>
          display(a.full_name)
            .localeCompare(
              display(b.full_name)
            )
        )


    return {
      managerUsers,
      managersMap,
      unassigned,
    }

  }, [filteredUsers])


  /* =======================================================
     OPEN ADD USER
  ======================================================= */

  function openAddUser() {

    setEditingUser(null)

    setForm({
      ...emptyForm,
    })

    setError("")
    setShowModal(true)
  }


  /* =======================================================
     OPEN EDIT USER
  ======================================================= */

  function openEditUser(user) {

    setEditingUser(user)

    setForm({
      auth_user_id:
        user.auth_user_id || "",

      full_name:
        user.full_name || "",

      role:
        user.role || "",

      branch:
        user.branch || "",

      permission_level:
        user.permission_level ?? 1,

      manager_id:
        user.manager_id || "",

      active:
        user.active !== false,
    })

    setError("")
    setShowModal(true)
  }


  /* =======================================================
     CLOSE MODAL
  ======================================================= */

  function closeModal() {

    if (saving) {
      return
    }

    setShowModal(false)

    setEditingUser(null)

    setForm({
      ...emptyForm,
    })

    setError("")
  }


  /* =======================================================
     FORM UPDATE
  ======================================================= */

  function updateForm(field, value) {

    setForm(current => ({
      ...current,
      [field]: value,
    }))

  }


  /* =======================================================
     SAVE USER
  ======================================================= */

  async function saveUser() {

    if (!form.full_name.trim()) {

      setError(
        "Please enter the user's name."
      )

      return
    }

    setSaving(true)
    setError("")

    try {

      const payload = {

        auth_user_id:
          form.auth_user_id.trim() ||
          null,

        full_name:
          form.full_name.trim(),

        role:
          form.role.trim() ||
          null,

        branch:
          form.branch.trim() ||
          null,

        permission_level:
          Number(
            form.permission_level
          ) || 1,

        manager_id:
          form.manager_id ||
          null,

        active:
          Boolean(form.active),

      }


      /* ===================================================
         UPDATE
      =================================================== */

      if (editingUser) {

        const {
          data,
          error: updateError,
        } = await supabase
          .from("profiles")
          .update(payload)
          .eq(
            "id",
            editingUser.id
          )
          .select()
          .single()

        if (updateError) {
          throw updateError
        }

        setUsers(current =>
          current.map(user =>
            user.id === editingUser.id
              ? data
              : user
          )
        )

      }


      /* ===================================================
         INSERT
      =================================================== */

      else {

        const {
          data,
          error: insertError,
        } = await supabase
          .from("profiles")
          .insert(payload)
          .select()
          .single()

        if (insertError) {
          throw insertError
        }

        setUsers(current => [
          ...current,
          data,
        ])

      }

      closeModal()

    } catch (err) {

      console.error(
        "Error saving user:",
        err
      )

      setError(
        err?.message ||
        "Unable to save user."
      )

    } finally {

      setSaving(false)

    }
  }


  /* =======================================================
     TOGGLE MANAGER
  ======================================================= */

  function toggleManager(managerId) {

    setCollapsedManagers(current => ({
      ...current,
      [managerId]:
        !current[managerId],
    }))

  }


  /* =======================================================
     TOGGLE BRANCH
  ======================================================= */

  function toggleBranch(branchKey) {

    setCollapsedBranches(current => ({
      ...current,
      [branchKey]:
        !current[branchKey],
    }))

  }


  /* =======================================================
     BRANCH GROUPING
  ======================================================= */

  function getBranches(usersForManager) {

    const groups = {}

    usersForManager.forEach(user => {

      const branch =
        display(
          user.branch,
          "No branch"
        )

      if (!groups[branch]) {
        groups[branch] = []
      }

      groups[branch].push(user)

    })

    return Object.entries(groups)
      .sort(([a], [b]) =>
        a.localeCompare(b)
      )

  }


  /* =======================================================
     USER CARD
  ======================================================= */

  function UserNode({
    user,
    nested = false,
  }) {

    return (

      <div
        className={
          nested
            ? "tree-user-node nested"
            : "tree-user-node"
        }
      >

        <div className="tree-user-connector" />

        <div className="tree-user-card">

          <div className="tree-user-main">

            <div className="tree-avatar">

              {display(
                user.full_name,
                "?"
              )
                .charAt(0)
                .toUpperCase()}

            </div>


            <div className="tree-user-details">

              <div className="tree-user-name">

                {display(
                  user.full_name,
                  "Unnamed user"
                )}

              </div>


              <div className="tree-user-meta">

                <span>
                  {display(
                    user.role,
                    "No role"
                  )}
                </span>

                <span className="tree-dot">
                  •
                </span>

                <span>
                  {display(
                    user.branch,
                    "No branch"
                  )}
                </span>

              </div>

            </div>

          </div>


          <div className="tree-user-right">

            <span className="tree-permission">

              {getPermissionLabel(
                user.permission_level
              )}

            </span>


            {user.active !== false ? (

              <span className="tree-active">

                <span className="tree-status-dot" />

                Active

              </span>

            ) : (

              <span className="tree-inactive">

                <span className="tree-status-dot" />

                Inactive

              </span>

            )}


            <button
              type="button"
              className="tree-edit-button"
              onClick={() =>
                openEditUser(user)
              }
              title="Edit user"
            >

              <Pencil size={13} />

            </button>

          </div>

        </div>

      </div>

    )

  }


  /* =======================================================
     RENDER
  ======================================================= */

  return (

    <section className="users-page">

      <style>{`

        /* =================================================
           PAGE
        ================================================= */

        .users-page {
          min-height:
            calc(100vh - 90px);

          background:
            #f5f6f8;

          color:
            #172033;

          font-family:
            Inter,
            Arial,
            sans-serif;

          padding:
            24px;
        }


        /* =================================================
           HEADER
        ================================================= */

        .users-header {
          display:
            flex;

          align-items:
            flex-start;

          justify-content:
            space-between;

          gap:
            20px;

          margin-bottom:
            18px;
        }


        .users-title {
          margin:
            0;

          font-size:
            25px;

          line-height:
            1.15;

          font-weight:
            750;

          letter-spacing:
            -.5px;
        }


        .users-subtitle {
          margin:
            6px 0 0;

          color:
            #7b8794;

          font-size:
            12px;
        }


        .users-header-actions {
          display:
            flex;

          align-items:
            center;

          gap:
            8px;

          flex-wrap:
            wrap;

          justify-content:
            flex-end;
        }


        /* =================================================
           BUTTONS
        ================================================= */

        .users-add-button {
          display:
            inline-flex;

          align-items:
            center;

          gap:
            7px;

          height:
            38px;

          padding:
            0 14px;

          border:
            0;

          border-radius:
            7px;

          background:
            #2499ed;

          color:
            #fff;

          font-family:
            inherit;

          font-size:
            11px;

          font-weight:
            700;

          cursor:
            pointer;
        }


        .users-add-button:hover {
          opacity:
            .92;
        }


        /* =================================================
           TOGGLE
        ================================================= */

        .users-toggle {
          display:
            inline-flex;

          align-items:
            center;

          gap:
            8px;

          height:
            38px;

          padding:
            0 12px;

          border:
            1px solid #dfe4e9;

          border-radius:
            7px;

          background:
            #fff;

          color:
            #596575;

          font-family:
            inherit;

          font-size:
            10px;

          font-weight:
            650;

          cursor:
            pointer;
        }


        .users-toggle:hover {
          background:
            #f8fafb;
        }


        .users-toggle-indicator {
          width:
            18px;

          height:
            18px;

          display:
            flex;

          align-items:
            center;

          justify-content:
            center;

          border:
            1px solid #d8dee5;

          border-radius:
            5px;

          background:
            #fff;
        }


        .users-toggle.active
        .users-toggle-indicator {
          background:
            #2499ed;

          border-color:
            #2499ed;

          color:
            #fff;
        }


        /* =================================================
           CARD
        ================================================= */

        .users-card {
          background:
            #fff;

          border:
            1px solid #e1e5ea;

          border-radius:
            10px;

          overflow:
            hidden;
        }


        /* =================================================
           TOOLBAR
        ================================================= */

        .users-toolbar {
          display:
            flex;

          align-items:
            center;

          justify-content:
            space-between;

          gap:
            12px;

          padding:
            12px 14px;

          border-bottom:
            1px solid #e7eaee;
        }


        .users-search {
          display:
            flex;

          align-items:
            center;

          gap:
            8px;

          width:
            300px;

          max-width:
            100%;

          height:
            34px;

          padding:
            0 10px;

          border:
            1px solid #dfe4e9;

          border-radius:
            6px;

          background:
            #fff;

          color:
            #94a3b8;
        }


        .users-search input {
          width:
            100%;

          border:
            0;

          outline:
            0;

          font-family:
            inherit;

          font-size:
            11px;

          color:
            #172033;

          background:
            transparent;
        }


        .users-refresh {
          display:
            inline-flex;

          align-items:
            center;

          gap:
            6px;

          height:
            32px;

          padding:
            0 10px;

          border:
            1px solid #e1e5e9;

          border-radius:
            6px;

          background:
            #f8f9fa;

          color:
            #64748b;

          font-family:
            inherit;

          font-size:
            10px;

          font-weight:
            600;

          cursor:
            pointer;
        }


        .users-refresh:disabled {
          opacity:
            .5;

          cursor:
            default;
        }


        /* =================================================
           TREE AREA
        ================================================= */

        .reporting-tree {
          padding:
            22px 24px 28px;
        }


        .tree-summary {
          display:
            flex;

          align-items:
            center;

          gap:
            8px;

          margin-bottom:
            20px;

          color:
            #718096;

          font-size:
            10px;

          font-weight:
            650;
        }


        .tree-summary strong {
          color:
            #273142;
        }


        /* =================================================
           MANAGER
        ================================================= */

        .tree-manager {
          position:
            relative;

          margin-bottom:
            24px;

          padding-left:
            30px;
        }


        /*
         * Main vertical line running through
         * the manager's hierarchy.
         */

        .tree-manager::before {
          content:
            "";

          position:
            absolute;

          left:
            8px;

          top:
            30px;

          bottom:
            18px;

          width:
            2px;

          background:
            #dbe2e8;

          border-radius:
            2px;
        }


        .tree-manager-header {
          position:
            relative;

          display:
            flex;

          align-items:
            center;

          justify-content:
            space-between;

          gap:
            15px;

          min-height:
            62px;

          padding:
            10px 13px;

          border:
            1px solid #dce3e9;

          border-radius:
            9px;

          background:
            #fff;

          box-shadow:
            0 1px 2px rgba(15,23,42,.03);
        }


        .tree-manager-header::before {
          content:
            "";

          position:
            absolute;

          left:
            -24px;

          top:
            50%;

          width:
            24px;

          height:
            2px;

          background:
            #dbe2e8;
        }


        .tree-manager-left {
          display:
            flex;

          align-items:
            center;

          gap:
            11px;

          min-width:
            0;
        }


        .tree-expand {
          width:
            27px;

          height:
            27px;

          display:
            flex;

          align-items:
            center;

          justify-content:
            center;

          flex-shrink:
            0;

          border:
            1px solid #e0e5ea;

          border-radius:
            6px;

          background:
            #f8fafb;

          color:
            #64748b;

          cursor:
            pointer;
        }


        .tree-expand:hover {
          background:
            #f1f5f8;

          color:
            #172033;
        }


        .tree-manager-icon {
          width:
            38px;

          height:
            38px;

          display:
            flex;

          align-items:
            center;

          justify-content:
            center;

          flex-shrink:
            0;

          border-radius:
            9px;

          background:
            #eef7ff;

          color:
            #2499ed;
        }


        .tree-manager-name {
          font-size:
            13px;

          font-weight:
            750;

          color:
            #172033;
        }


        .tree-manager-role {
          margin-top:
            3px;

          font-size:
            10px;

          color:
            #84909d;
        }


        .tree-manager-right {
          display:
            flex;

          align-items:
            center;

          gap:
            9px;

          flex-shrink:
            0;
        }


        .tree-count {
          padding:
            4px 7px;

          border-radius:
            5px;

          background:
            #f1f4f6;

          color:
            #687585;

          font-size:
            9px;

          font-weight:
            700;
        }


        /* =================================================
           BRANCH
        ================================================= */

        .tree-manager-children {
          position:
            relative;

          padding-top:
            12px;

          padding-left:
            28px;
        }


        .tree-branch {
          position:
            relative;

          margin-bottom:
            13px;
        }


        /*
         * Horizontal branch connector
         */

        .tree-branch::before {
          content:
            "";

          position:
            absolute;

          left:
            -20px;

          top:
            17px;

          width:
            20px;

          height:
            2px;

          background:
            #dbe2e8;
        }


        .tree-branch-header {
          display:
            inline-flex;

          align-items:
            center;

          gap:
            7px;

          min-height:
            30px;

          padding:
            0 9px;

          border:
            1px solid #e2e7eb;

          border-radius:
            6px;

          background:
            #f8fafb;

          color:
            #566273;

          font-size:
            10px;

          font-weight:
            750;

          cursor:
            pointer;
        }


        .tree-branch-header:hover {
          background:
            #f2f5f7;
        }


        .tree-branch-count {
          color:
            #97a1ac;

          font-size:
            9px;

          font-weight:
            650;
        }


        .tree-branch-users {
          position:
            relative;

          margin-top:
            6px;

          margin-left:
            14px;

          padding-left:
            24px;
        }


        /*
         * Vertical branch line
         */

        .tree-branch-users::before {
          content:
            "";

          position:
            absolute;

          left:
            0;

          top:
            0;

          bottom:
            19px;

          width:
            2px;

          background:
            #e5eaee;

          border-radius:
            2px;
        }


        /* =================================================
           USER NODE
        ================================================= */

        .tree-user-node {
          position:
            relative;

          margin:
            0 0 7px;
        }


        .tree-user-connector {
          position:
            absolute;

          left:
            -24px;

          top:
            24px;

          width:
            24px;

          height:
            2px;

          background:
            #e5eaee;
        }


        .tree-user-card {
          display:
            flex;

          align-items:
            center;

          justify-content:
            space-between;

          gap:
            15px;

          min-height:
            53px;

          padding:
            8px 10px;

          border:
            1px solid #e7ebee;

          border-radius:
            8px;

          background:
            #fff;

          transition:
            .15s;
        }


        .tree-user-card:hover {
          border-color:
            #d8e0e6;

          box-shadow:
            0 2px 8px rgba(15,23,42,.04);
        }


        .tree-user-main {
          display:
            flex;

          align-items:
            center;

          gap:
            10px;

          min-width:
            0;
        }


        .tree-avatar {
          width:
            31px;

          height:
            31px;

          display:
            flex;

          align-items:
            center;

          justify-content:
            center;

          flex-shrink:
            0;

          border-radius:
            50%;

          background:
            #f0f3f6;

          color:
            #657182;

          font-size:
            10px;

          font-weight:
            800;
        }


        .tree-user-details {
          min-width:
            0;
        }


        .tree-user-name {
          overflow:
            hidden;

          text-overflow:
            ellipsis;

          white-space:
            nowrap;

          color:
            #273142;

          font-size:
            11px;

          font-weight:
            700;
        }


        .tree-user-meta {
          display:
            flex;

          align-items:
            center;

          gap:
            5px;

          margin-top:
            3px;

          color:
            #8a95a1;

          font-size:
            9px;
        }


        .tree-dot {
          color:
            #c1c8cf;
        }


        .tree-user-right {
          display:
            flex;

          align-items:
            center;

          gap:
            8px;

          flex-shrink:
            0;
        }


        .tree-permission {
          padding:
            4px 7px;

          border-radius:
            5px;

          background:
            #eef7ff;

          color:
            #2679b3;

          font-size:
            9px;

          font-weight:
            700;
        }


        .tree-active,
        .tree-inactive {
          display:
            inline-flex;

          align-items:
            center;

          gap:
            5px;

          font-size:
            9px;

          font-weight:
            700;
        }


        .tree-active {
          color:
            #34804a;
        }


        .tree-inactive {
          color:
            #a06464;
        }


        .tree-status-dot {
          width:
            6px;

          height:
            6px;

          border-radius:
            50%;

          background:
            currentColor;
        }


        .tree-edit-button {
          width:
            29px;

          height:
            29px;

          display:
            flex;

          align-items:
            center;

          justify-content:
            center;

          border:
            1px solid #e0e4e8;

          border-radius:
            6px;

          background:
            #fff;

          color:
            #64748b;

          cursor:
            pointer;
        }


        .tree-edit-button:hover {
          background:
            #f5f8fa;

          color:
            #172033;
        }


        /* =================================================
           UNASSIGNED
        ================================================= */

        .tree-unassigned {
          margin-top:
            24px;

          padding:
            16px;

          border:
            1px dashed #d8dee5;

          border-radius:
            9px;

          background:
            #fafbfc;
        }


        .tree-unassigned-title {
          display:
            flex;

          align-items:
            center;

          gap:
            7px;

          margin-bottom:
            10px;

          color:
            #687585;

          font-size:
            10px;

          font-weight:
            750;
        }


        /* =================================================
           EMPTY
        ================================================= */

        .users-empty {
          padding:
            65px 20px;

          text-align:
            center;

          color:
            #94a3b8;

          font-size:
            12px;
        }


        .users-empty-icon {
          margin-bottom:
            8px;

          color:
            #c1c9d1;
        }


        /* =================================================
           ERROR
        ================================================= */

        .users-error {
          margin-bottom:
            14px;

          padding:
            10px 12px;

          border:
            1px solid #fecaca;

          border-radius:
            7px;

          background:
            #fef2f2;

          color:
            #991b1b;

          font-size:
            11px;
        }


        /* =================================================
           MODAL
        ================================================= */

        .users-modal-overlay {
          position:
            fixed;

          inset:
            0;

          z-index:
            1000;

          display:
            flex;

          align-items:
            center;

          justify-content:
            center;

          padding:
            20px;

          background:
            rgba(15,23,42,.38);
        }


        .users-modal {
          width:
            100%;

          max-width:
            560px;

          max-height:
            calc(100vh - 40px);

          overflow:
            auto;

          background:
            #fff;

          border-radius:
            10px;

          box-shadow:
            0 20px 60px rgba(0,0,0,.20);

          overflow-x:
            hidden;
        }


        .users-modal-header {
          display:
            flex;

          align-items:
            center;

          justify-content:
            space-between;

          padding:
            17px 20px;

          border-bottom:
            1px solid #edf0f2;
        }


        .users-modal-title {
          margin:
            0;

          font-size:
            15px;

          font-weight:
            750;
        }


        .users-modal-subtitle {
          margin:
            4px 0 0;

          color:
            #8a95a1;

          font-size:
            10px;
        }


        .users-modal-close {
          width:
            30px;

          height:
            30px;

          display:
            flex;

          align-items:
            center;

          justify-content:
            center;

          border:
            0;

          border-radius:
            6px;

          background:
            transparent;

          color:
            #8993a0;

          cursor:
            pointer;
        }


        .users-modal-close:hover {
          background:
            #f3f5f7;
        }


        .users-form {
          padding:
            20px;
        }


        .users-form-grid {
          display:
            grid;

          grid-template-columns:
            repeat(2,minmax(0,1fr));

          gap:
            15px;
        }


        .users-form-field {
          display:
            flex;

          flex-direction:
            column;

          gap:
            6px;
        }


        .users-form-field.full {
          grid-column:
            1 / -1;
        }


        .users-form-label {
          font-size:
            9px;

          font-weight:
            800;

          color:
            #687585;

          text-transform:
            uppercase;

          letter-spacing:
            .04em;
        }


        .users-form-input,
        .users-form-select {
          width:
            100%;

          height:
            38px;

          box-sizing:
            border-box;

          border:
            1px solid #dce1e6;

          border-radius:
            6px;

          padding:
            0 10px;

          background:
            #fff;

          color:
            #172033;

          font-family:
            inherit;

          font-size:
            11px;

          outline:
            none;
        }


        .users-form-input:focus,
        .users-form-select:focus {
          border-color:
            #2499ed;

          box-shadow:
            0 0 0 2px rgba(36,153,237,.10);
        }


        .users-active-row {
          display:
            flex;

          align-items:
            center;

          justify-content:
            space-between;

          padding:
            10px 12px;

          border:
            1px solid #e1e5e9;

          border-radius:
            7px;

          grid-column:
            1 / -1;
        }


        .users-active-text {
          display:
            flex;

          flex-direction:
            column;

          gap:
            3px;
        }


        .users-active-title {
          font-size:
            11px;

          font-weight:
            700;

          color:
            #273142;
        }


        .users-active-description {
          font-size:
            9px;

          color:
            #8a95a1;
        }


        .users-switch {
          position:
            relative;

          width:
            38px;

          height:
            21px;

          flex-shrink:
            0;
        }


        .users-switch input {
          opacity:
            0;

          width:
            0;

          height:
            0;
        }


        .users-slider {
          position:
            absolute;

          inset:
            0;

          border-radius:
            20px;

          background:
            #cbd2d9;

          cursor:
            pointer;

          transition:
            .2s;
        }


        .users-slider:before {
          content:
            "";

          position:
            absolute;

          width:
            17px;

          height:
            17px;

          left:
            2px;

          top:
            2px;

          border-radius:
            50%;

          background:
            #fff;

          transition:
            .2s;

          box-shadow:
            0 1px 3px rgba(0,0,0,.18);
        }


        .users-switch input:checked
        + .users-slider {
          background:
            #2499ed;
        }


        .users-switch input:checked
        + .users-slider:before {
          transform:
            translateX(17px);
        }


        /* =================================================
           FOOTER
        ================================================= */

        .users-modal-footer {
          display:
            flex;

          align-items:
            center;

          justify-content:
            flex-end;

          gap:
            8px;

          padding:
            13px 20px;

          border-top:
            1px solid #edf0f2;
        }


        .users-cancel-button,
        .users-save-button {
          height:
            36px;

          padding:
            0 14px;

          border-radius:
            6px;

          font-family:
            inherit;

          font-size:
            10px;

          font-weight:
            700;

          cursor:
            pointer;
        }


        .users-cancel-button {
          border:
            1px solid #dfe3e7;

          background:
            #fff;

          color:
            #596575;
        }


        .users-save-button {
          border:
            0;

          background:
            #172554;

          color:
            #fff;
        }


        .users-save-button:disabled,
        .users-cancel-button:disabled {
          opacity:
            .5;

          cursor:
            default;
        }


        /* =================================================
           MOBILE
        ================================================= */

        @media (max-width: 800px) {

          .users-page {
            padding:
              16px;
          }

          .users-header {
            flex-direction:
              column;
          }

          .users-header-actions {
            justify-content:
              flex-start;
          }

          .users-toolbar {
            flex-direction:
              column;

            align-items:
              stretch;
          }

          .users-search {
            width:
              auto;
          }

          .tree-user-card {
            align-items:
              flex-start;

            flex-direction:
              column;
          }

          .tree-user-right {
            width:
              100%;

            justify-content:
              flex-end;
          }

          .users-form-grid {
            grid-template-columns:
              1fr;
          }

          .users-form-field.full,
          .users-active-row {
            grid-column:
              auto;
          }

        }

      `}</style>


      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="users-header">

        <div>

          <h1 className="users-title">
            Users
          </h1>

          <p className="users-subtitle">
            Manage users, roles, permissions and
            reporting relationships.
          </p>

        </div>


        <div className="users-header-actions">

          <button
            type="button"
            className={
              showInactive
                ? "users-toggle active"
                : "users-toggle"
            }
            onClick={() =>
              setShowInactive(
                current => !current
              )
            }
          >

            <span className="users-toggle-indicator">

              {showInactive && (
                <Check size={12} />
              )}

            </span>

            Show inactive users

          </button>


          <button
            type="button"
            className="users-add-button"
            onClick={openAddUser}
          >

            <Plus size={15} />

            Add user

          </button>

        </div>

      </div>


      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && !showModal && (

        <div className="users-error">
          {error}
        </div>

      )}


      {/* =====================================================
          CARD
      ===================================================== */}

      <div className="users-card">


        {/* ===================================================
            TOOLBAR
        =================================================== */}

        <div className="users-toolbar">

          <div className="users-search">

            <Search size={14} />

            <input
              type="text"
              placeholder="Search users, roles or branches..."
              value={search}
              onChange={event =>
                setSearch(
                  event.target.value
                )
              }
            />

          </div>


          <button
            type="button"
            className="users-refresh"
            onClick={loadUsers}
            disabled={loading}
          >

            <RefreshCw size={12} />

            {loading
              ? "Loading..."
              : "Refresh"}

          </button>

        </div>


        {/* ===================================================
            TREE
        =================================================== */}

        <div className="reporting-tree">

          {loading ? (

            <div className="users-empty">
              Loading reporting structure...
            </div>

          ) : filteredUsers.length === 0 ? (

            <div className="users-empty">

              <UsersIcon
                size={28}
                className="users-empty-icon"
              />

              <div>
                No users found.
              </div>

            </div>

          ) : (

            <>

              <div className="tree-summary">

                <GitBranch size={13} />

                <strong>
                  {filteredUsers.length}
                </strong>

                users in reporting structure

              </div>


              {/* =================================================
                  MANAGERS
              ================================================= */}

              {tree.managerUsers.map(manager => {

                const directReports =
                  tree.managersMap.get(
                    manager.id
                  ) || []

                const branches =
                  getBranches(
                    directReports
                  )

                const collapsed =
                  collapsedManagers[
                    manager.id
                  ] === true


                return (

                  <div
                    className="tree-manager"
                    key={manager.id}
                  >


                    {/* MANAGER HEADER */}

                    <div className="tree-manager-header">

                      <div className="tree-manager-left">

                        <button
                          type="button"
                          className="tree-expand"
                          onClick={() =>
                            toggleManager(
                              manager.id
                            )
                          }
                          title={
                            collapsed
                              ? "Expand"
                              : "Collapse"
                          }
                        >

                          {collapsed ? (
                            <ChevronRight
                              size={15}
                            />
                          ) : (
                            <ChevronDown
                              size={15}
                            />
                          )}

                        </button>


                        <div className="tree-manager-icon">

                          <UsersIcon
                            size={18}
                          />

                        </div>


                        <div>

                          <div className="tree-manager-name">

                            {display(
                              manager.full_name,
                              "Unnamed manager"
                            )}

                          </div>


                          <div className="tree-manager-role">

                            {display(
                              manager.role,
                              getPermissionLabel(
                                manager.permission_level
                              )
                            )}

                            {manager.branch && (
                              <>
                                {" • "}
                                {manager.branch}
                              </>
                            )}

                          </div>

                        </div>

                      </div>


                      <div className="tree-manager-right">

                        <span className="tree-count">

                          {directReports.length}
                          {" "}
                          {directReports.length === 1
                            ? "report"
                            : "reports"}

                        </span>


                        <button
                          type="button"
                          className="tree-edit-button"
                          onClick={() =>
                            openEditUser(
                              manager
                            )
                          }
                          title="Edit manager"
                        >

                          <Pencil size={13} />

                        </button>

                      </div>

                    </div>


                    {/* MANAGER CHILDREN */}

                    {!collapsed && (

                      <div className="tree-manager-children">

                        {branches.map(
                          ([branch, branchUsers]) => {

                            const branchKey =
                              `${manager.id}::${branch}`

                            const branchCollapsed =
                              collapsedBranches[
                                branchKey
                              ] === true


                            return (

                              <div
                                className="tree-branch"
                                key={branchKey}
                              >

                                <button
                                  type="button"
                                  className="tree-branch-header"
                                  onClick={() =>
                                    toggleBranch(
                                      branchKey
                                    )
                                  }
                                >

                                  {branchCollapsed ? (
                                    <ChevronRight
                                      size={13}
                                    />
                                  ) : (
                                    <ChevronDown
                                      size={13}
                                    />
                                  )}

                                  <span>
                                    {branch}
                                  </span>

                                  <span className="tree-branch-count">
                                    {branchUsers.length}
                                    {" "}
                                    {branchUsers.length === 1
                                      ? "user"
                                      : "users"}
                                  </span>

                                </button>


                                {!branchCollapsed && (

                                  <div className="tree-branch-users">

                                    {branchUsers
                                      .sort(
                                        (a, b) =>
                                          display(
                                            a.full_name
                                          ).localeCompare(
                                            display(
                                              b.full_name
                                            )
                                          )
                                      )
                                      .map(user => (

                                        <UserNode
                                          key={user.id}
                                          user={user}
                                          nested
                                        />

                                      ))}

                                  </div>

                                )}

                              </div>

                            )

                          }
                        )}

                      </div>

                    )}

                  </div>

                )

              })}


              {/* =================================================
                  UNASSIGNED
              ================================================= */}

              {tree.unassigned.length > 0 && (

                <div className="tree-unassigned">

                  <div className="tree-unassigned-title">

                    <GitBranch size={13} />

                    Unassigned users

                  </div>


                  {tree.unassigned.map(user => (

                    <UserNode
                      key={user.id}
                      user={user}
                    />

                  ))}

                </div>

              )}

            </>

          )}

        </div>

      </div>


      {/* =====================================================
          MODAL
      ===================================================== */}

      {showModal && (

        <div
          className="users-modal-overlay"
          onMouseDown={event => {

            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal()
            }

          }}
        >

          <div className="users-modal">


            {/* =================================================
                HEADER
            ================================================= */}

            <div className="users-modal-header">

              <div>

                <h2 className="users-modal-title">

                  {editingUser
                    ? "Edit user"
                    : "Add user"}

                </h2>


                <p className="users-modal-subtitle">

                  Manage the user's CRM access
                  and reporting structure.

                </p>

              </div>


              <button
                type="button"
                className="users-modal-close"
                onClick={closeModal}
                disabled={saving}
              >

                <X size={16} />

              </button>

            </div>


            {/* =================================================
                FORM
            ================================================= */}

            <div className="users-form">

              <div className="users-form-grid">


                {/* NAME */}

                <div className="users-form-field">

                  <label className="users-form-label">
                    Full name
                  </label>

                  <input
                    className="users-form-input"
                    value={form.full_name}
                    onChange={event =>
                      updateForm(
                        "full_name",
                        event.target.value
                      )
                    }
                    placeholder="John Smith"
                  />

                </div>


                {/* AUTH USER ID */}

                <div className="users-form-field">

                  <label className="users-form-label">
                    Auth user ID
                  </label>

                  <input
                    className="users-form-input"
                    value={form.auth_user_id}
                    onChange={event =>
                      updateForm(
                        "auth_user_id",
                        event.target.value
                      )
                    }
                    placeholder="Supabase auth UUID"
                  />

                </div>


                {/* ROLE */}

                <div className="users-form-field">

                  <label className="users-form-label">
                    Role
                  </label>

                  <input
                    className="users-form-input"
                    list="user-role-list"
                    value={form.role}
                    onChange={event =>
                      updateForm(
                        "role",
                        event.target.value
                      )
                    }
                    placeholder="Sales Rep"
                  />

                  <datalist id="user-role-list">

                    {roles.map(role => (

                      <option
                        key={role}
                        value={role}
                      />

                    ))}

                  </datalist>

                </div>


                {/* BRANCH */}

                <div className="users-form-field">

                  <label className="users-form-label">
                    Branch
                  </label>

                  <input
                    className="users-form-input"
                    value={form.branch}
                    onChange={event =>
                      updateForm(
                        "branch",
                        event.target.value
                      )
                    }
                    placeholder="Central Solar"
                  />

                </div>


                {/* PERMISSION */}

                <div className="users-form-field">

                  <label className="users-form-label">
                    Permission level
                  </label>

                  <select
                    className="users-form-select"
                    value={
                      form.permission_level
                    }
                    onChange={event =>
                      updateForm(
                        "permission_level",
                        Number(
                          event.target.value
                        )
                      )
                    }
                  >

                    <option value={1}>
                      1 — Standard
                    </option>

                    <option value={2}>
                      2 — Supervisor
                    </option>

                    <option value={3}>
                      3 — Management
                    </option>

                    <option value={4}>
                      4 — Administrator
                    </option>

                  </select>

                </div>


                {/* MANAGER */}

                <div className="users-form-field">

                  <label className="users-form-label">
                    Manager
                  </label>

                  <select
                    className="users-form-select"
                    value={
                      form.manager_id
                    }
                    onChange={event =>
                      updateForm(
                        "manager_id",
                        event.target.value
                      )
                    }
                  >

                    <option value="">
                      No manager
                    </option>

                    {managers
                      .filter(
                        manager =>
                          manager.id !==
                          editingUser?.id
                      )
                      .map(manager => (

                        <option
                          key={manager.id}
                          value={manager.id}
                        >

                          {display(
                            manager.full_name
                          )}

                          {manager.role
                            ? ` — ${manager.role}`
                            : ""}

                        </option>

                      ))}

                  </select>

                </div>


                {/* ACTIVE */}

                <div className="users-active-row">

                  <div className="users-active-text">

                    <span className="users-active-title">
                      Active user
                    </span>

                    <span className="users-active-description">
                      Inactive users can remain
                      in the system but should
                      not have active CRM access.
                    </span>

                  </div>


                  <label className="users-switch">

                    <input
                      type="checkbox"
                      checked={
                        form.active
                      }
                      onChange={event =>
                        updateForm(
                          "active",
                          event.target.checked
                        )
                      }
                    />

                    <span className="users-slider" />

                  </label>

                </div>


                {/* ERROR */}

                {error && (

                  <div
                    className="users-error"
                    style={{
                      gridColumn:
                        "1 / -1",
                      marginBottom:
                        0,
                    }}
                  >

                    {error}

                  </div>

                )}

              </div>

            </div>


            {/* =================================================
                FOOTER
            ================================================= */}

            <div className="users-modal-footer">

              <button
                type="button"
                className="users-cancel-button"
                onClick={closeModal}
                disabled={saving}
              >

                Cancel

              </button>


              <button
                type="button"
                className="users-save-button"
                onClick={saveUser}
                disabled={
                  saving ||
                  !form.full_name.trim()
                }
              >

                {saving
                  ? "Saving..."
                  : editingUser
                    ? "Save changes"
                    : "Create user"}

              </button>

            </div>

          </div>

        </div>

      )}

    </section>

  )
}
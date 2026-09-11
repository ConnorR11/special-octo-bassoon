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
  UserRound,
} from "lucide-react"

import { supabase } from "../lib/supabase"


/* =========================================================
   HELPERS
========================================================= */

function display(value, fallback = "—") {
  const text = String(value ?? "").trim()
  return text || fallback
}


function getPermissionLabel(level) {
  const value = Number(level)

  if (value >= 4) return "Administrator"
  if (value === 3) return "Management"
  if (value === 2) return "Supervisor"

  return "Sales Rep"
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

  const [expandedUsers, setExpandedUsers] = useState({})


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
     ACTIVE / INACTIVE FILTER
  ======================================================= */

  const reportingUsers = useMemo(() => {

    return users.filter((user) => {

      if (showInactive) {
        return true
      }

      return user.active !== false
    })

  }, [users, showInactive])


  /* =======================================================
     MANAGERS
  ======================================================= */

  const managers = useMemo(() => {

    return users
      .filter((user) => user.active !== false)
      .sort((a, b) =>
        display(a.full_name)
          .localeCompare(
            display(b.full_name)
          )
      )

  }, [users])


  /* =======================================================
     SEARCH
  ======================================================= */

  const searchedUsers = useMemo(() => {

    const query =
      search
        .toLowerCase()
        .trim()

    if (!query) {
      return reportingUsers
    }

    return reportingUsers.filter((user) => {

      const managerName =
        users.find(
          (manager) =>
            manager.id === user.manager_id
        )?.full_name || ""

      const values = [
        user.full_name,
        user.role,
        user.branch,
        user.permission_level,
        user.manager_id,
        managerName,
      ]

      return values.some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query)
      )

    })

  }, [
    reportingUsers,
    search,
    users,
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
        (user) =>
          user.id === managerId
      )

    return display(
      manager?.full_name,
      "Unknown manager"
    )
  }


  /* =======================================================
     CHILDREN
  ======================================================= */

  function getChildren(managerId) {

    return searchedUsers
      .filter(
        (user) =>
          user.manager_id === managerId
      )
      .sort((a, b) =>
        display(a.full_name)
          .localeCompare(
            display(b.full_name)
          )
      )
  }


  /* =======================================================
     ROOT USERS
     
     A user is a root if:
     
     - They have no manager
     - Their manager isn't currently visible
     
     This prevents people such as Colin/Ryan disappearing
     when their manager relationship points to an inactive
     or missing profile.
  ======================================================= */

  const rootUsers = useMemo(() => {

    const visibleIds = new Set(
      searchedUsers.map(
        (user) => user.id
      )
    )

    return searchedUsers
      .filter((user) => {

        if (!user.manager_id) {
          return true
        }

        return !visibleIds.has(
          user.manager_id
        )

      })
      .sort((a, b) =>
        display(a.full_name)
          .localeCompare(
            display(b.full_name)
          )
      )

  }, [searchedUsers])


  /* =======================================================
     TOGGLE TREE NODE
  ======================================================= */

  function toggleExpanded(userId) {

    setExpandedUsers((current) => ({
      ...current,
      [userId]:
        current[userId] === false
          ? true
          : false,
    }))

  }


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
    setForm(emptyForm)
    setError("")
  }


  /* =======================================================
     FORM CHANGE
  ======================================================= */

  function updateForm(field, value) {

    setForm((current) => ({
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
          Number(form.permission_level) || 1,

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

        setUsers((current) =>
          current.map((user) =>
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

        setUsers((current) => [
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
     TREE NODE
  ======================================================= */

  function UserNode({
    user,
    level = 0,
  }) {

    const children =
      getChildren(user.id)

    const hasChildren =
      children.length > 0

    const isExpanded =
      expandedUsers[user.id] !== false

    return (

      <div className="tree-node-wrapper">

        <div
          className="tree-node"
          style={{
            marginLeft:
              level * 28,
          }}
        >

          <div className="tree-node-main">

            {/* EXPAND */}

            <button
              type="button"
              className={
                hasChildren
                  ? "tree-expand-button"
                  : "tree-expand-button tree-expand-empty"
              }
              onClick={() => {

                if (hasChildren) {
                  toggleExpanded(
                    user.id
                  )
                }

              }}
            >

              {hasChildren ? (

                isExpanded ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )

              ) : null}

            </button>


            {/* ICON */}

            <div className="tree-user-icon">

              <UserRound size={16} />

            </div>


            {/* INFORMATION */}

            <div className="tree-user-information">

              <div className="tree-user-name-row">

                <span className="tree-user-name">
                  {display(
                    user.full_name,
                    "Unnamed user"
                  )}
                </span>

                {user.active === false && (

                  <span className="tree-inactive-badge">
                    Inactive
                  </span>

                )}

              </div>


              <div className="tree-user-meta">

                <span className="tree-role">
                  {display(
                    user.role,
                    getPermissionLabel(
                      user.permission_level
                    )
                  )}
                </span>

                <span className="tree-separator">
                  •
                </span>

                <span>
                  {display(
                    user.branch,
                    "No branch"
                  )}
                </span>

                <span className="tree-separator">
                  •
                </span>

                <span>
                  {getPermissionLabel(
                    user.permission_level
                  )}
                </span>

              </div>


              <div className="tree-user-manager">

                Reports to:{" "}

                <strong>
                  {getManagerName(
                    user.manager_id
                  )}
                </strong>

              </div>

            </div>


            {/* STATUS */}

            <div className="tree-status">

              {user.active !== false ? (

                <span className="tree-active">

                  <Check size={12} />

                  Active

                </span>

              ) : (

                <span className="tree-inactive">

                  <X size={12} />

                  Inactive

                </span>

              )}

            </div>


            {/* EDIT */}

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


          {/* CHILDREN */}

          {hasChildren &&
            isExpanded && (

              <div className="tree-children">

                {children.map((child) => (

                  <UserNode
                    key={child.id}
                    user={child}
                    level={level + 1}
                  />

                ))}

              </div>

            )}

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

          background: #f5f6f8;

          color: #172033;

          font-family:
            Inter,
            Arial,
            sans-serif;

          padding: 24px;
        }


        /* =================================================
           HEADER
        ================================================= */

        .users-header {
          display: flex;

          align-items: flex-start;

          justify-content:
            space-between;

          gap: 20px;

          margin-bottom: 20px;
        }


        .users-title {
          margin: 0;

          font-size: 25px;

          line-height: 1.15;

          font-weight: 750;

          letter-spacing:
            -0.5px;
        }


        .users-subtitle {
          margin:
            6px 0 0;

          color: #7b8794;

          font-size: 12px;
        }


        .users-header-actions {
          display: flex;

          align-items: center;

          gap: 8px;

          flex-wrap: wrap;
        }


        /* =================================================
           ADD
        ================================================= */

        .users-add-button {
          display: inline-flex;

          align-items: center;

          gap: 7px;

          height: 38px;

          padding:
            0 14px;

          border: 0;

          border-radius: 7px;

          background: #2499ed;

          color: #fff;

          font-family: inherit;

          font-size: 11px;

          font-weight: 700;

          cursor: pointer;
        }


        .users-add-button:hover {
          opacity: .92;
        }


        /* =================================================
           CARD
        ================================================= */

        .users-card {
          background: #fff;

          border:
            1px solid #e1e5ea;

          border-radius: 9px;

          overflow: hidden;
        }


        /* =================================================
           TOOLBAR
        ================================================= */

        .users-toolbar {
          display: flex;

          align-items: center;

          justify-content:
            space-between;

          gap: 12px;

          padding:
            12px 14px;

          border-bottom:
            1px solid #e7eaee;

          background: #fff;
        }


        .users-toolbar-left {
          display: flex;

          align-items: center;

          gap: 10px;

          flex-wrap: wrap;
        }


        /* =================================================
           SEARCH
        ================================================= */

        .users-search {
          display: flex;

          align-items: center;

          gap: 8px;

          width: 300px;

          max-width: 100%;

          height: 34px;

          padding:
            0 10px;

          border:
            1px solid #dfe4e9;

          border-radius: 6px;

          background: #fff;

          color: #94a3b8;

          box-sizing: border-box;
        }


        .users-search input {
          width: 100%;

          border: 0;

          outline: 0;

          font-family: inherit;

          font-size: 11px;

          color: #172033;

          background:
            transparent;
        }


        /* =================================================
           INACTIVE TOGGLE
        ================================================= */

        .reporting-tree-controls {
          display: flex;

          align-items: center;

          gap: 9px;

          height: 34px;

          padding:
            0 10px;

          border:
            1px solid #dfe4e9;

          border-radius: 6px;

          background: #f8fafb;

          box-sizing: border-box;
        }


        .reporting-tree-control-label {
          font-size: 10px;

          font-weight: 700;

          color: #596575;

          white-space: nowrap;
        }


        .reporting-tree-switch {
          position: relative;

          width: 34px;

          height: 19px;

          flex-shrink: 0;
        }


        .reporting-tree-switch input {
          opacity: 0;

          width: 0;

          height: 0;
        }


        .reporting-tree-slider {
          position: absolute;

          inset: 0;

          border-radius: 20px;

          background: #cbd2d9;

          cursor: pointer;

          transition:
            .2s;
        }


        .reporting-tree-slider:before {
          content: "";

          position: absolute;

          width: 15px;

          height: 15px;

          left: 2px;

          top: 2px;

          border-radius: 50%;

          background: #fff;

          transition:
            .2s;

          box-shadow:
            0 1px 3px
            rgba(0,0,0,.18);
        }


        .reporting-tree-switch input:checked
        + .reporting-tree-slider {
          background: #2499ed;
        }


        .reporting-tree-switch input:checked
        + .reporting-tree-slider:before {
          transform:
            translateX(15px);
        }


        /* =================================================
           REFRESH
        ================================================= */

        .users-refresh {
          display: inline-flex;

          align-items: center;

          gap: 6px;

          height: 32px;

          padding:
            0 10px;

          border:
            1px solid #e1e5e9;

          border-radius: 6px;

          background: #f8f9fa;

          color: #64748b;

          font-family: inherit;

          font-size: 10px;

          font-weight: 600;

          cursor: pointer;
        }


        .users-refresh:disabled {
          opacity: .5;

          cursor: default;
        }


        /* =================================================
           TREE
        ================================================= */

        .reporting-tree {
          padding:
            18px 20px 24px;
        }


        .tree-node-wrapper {
          width: 100%;
        }


        .tree-node {
          position: relative;
        }


        .tree-node-main {
          min-height: 72px;

          display: flex;

          align-items: center;

          gap: 10px;

          padding:
            10px 12px;

          margin-bottom: 7px;

          border:
            1px solid #e2e7eb;

          border-radius: 8px;

          background: #fff;

          box-shadow:
            0 1px 2px
            rgba(15,23,42,.03);

          box-sizing: border-box;

          transition:
            .15s;
        }


        .tree-node-main:hover {
          border-color: #cfd8df;

          box-shadow:
            0 3px 10px
            rgba(15,23,42,.06);
        }


        .tree-expand-button {
          width: 24px;

          height: 24px;

          display: inline-flex;

          align-items: center;

          justify-content: center;

          flex-shrink: 0;

          border: 0;

          border-radius: 5px;

          background: #f3f5f7;

          color: #64748b;

          cursor: pointer;
        }


        .tree-expand-button:hover {
          background: #e9edf1;

          color: #172033;
        }


        .tree-expand-empty {
          background:
            transparent;

          cursor:
            default;
        }


        .tree-user-icon {
          width: 38px;

          height: 38px;

          display: flex;

          align-items: center;

          justify-content: center;

          flex-shrink: 0;

          border-radius: 8px;

          background: #eef7ff;

          color: #2499ed;
        }


        .tree-user-information {
          min-width: 0;

          flex: 1;
        }


        .tree-user-name-row {
          display: flex;

          align-items: center;

          gap: 8px;

          flex-wrap: wrap;
        }


        .tree-user-name {
          font-size: 13px;

          font-weight: 750;

          color: #172033;
        }


        .tree-inactive-badge {
          display: inline-flex;

          align-items: center;

          padding:
            3px 6px;

          border-radius: 4px;

          background: #fef2f2;

          color: #a06464;

          font-size: 8px;

          font-weight: 800;

          text-transform:
            uppercase;

          letter-spacing:
            .04em;
        }


        .tree-user-meta {
          display: flex;

          align-items: center;

          gap: 7px;

          margin-top: 4px;

          color: #7b8794;

          font-size: 10px;

          flex-wrap: wrap;
        }


        .tree-role {
          font-weight: 700;

          color: #596575;
        }


        .tree-separator {
          color: #c4cbd2;
        }


        .tree-user-manager {
          margin-top: 5px;

          color: #9aa3ad;

          font-size: 9px;
        }


        .tree-user-manager strong {
          color: #687585;

          font-weight: 650;
        }


        /* =================================================
           STATUS
        ================================================= */

        .tree-status {
          flex-shrink: 0;

          min-width: 62px;
        }


        .tree-active,
        .tree-inactive {
          display: inline-flex;

          align-items: center;

          gap: 4px;

          font-size: 9px;

          font-weight: 700;
        }


        .tree-active {
          color: #34804a;
        }


        .tree-inactive {
          color: #a06464;
        }


        /* =================================================
           EDIT
        ================================================= */

        .tree-edit-button {
          width: 30px;

          height: 30px;

          display: inline-flex;

          align-items: center;

          justify-content: center;

          flex-shrink: 0;

          border:
            1px solid #e0e4e8;

          border-radius: 6px;

          background: #fff;

          color: #64748b;

          cursor: pointer;
        }


        .tree-edit-button:hover {
          background: #f5f8fa;

          color: #172033;

          border-color:
            #cfd7df;
        }


        /* =================================================
           CHILDREN
        ================================================= */

        .tree-children {
          position: relative;

          margin-left: 18px;

          padding-left: 28px;

          border-left:
            1px solid #dfe5ea;
        }


        .tree-children .tree-node-main {
          position: relative;
        }


        .tree-children .tree-node-main:before {
          content: "";

          position: absolute;

          left: -29px;

          top: 50%;

          width: 28px;

          height: 1px;

          background: #dfe5ea;
        }


        /* =================================================
           EMPTY / LOADING
        ================================================= */

        .users-empty {
          padding:
            70px 20px;

          text-align: center;

          color: #94a3b8;

          font-size: 12px;
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

          border-radius: 7px;

          background: #fef2f2;

          color: #991b1b;

          font-size: 11px;
        }


        /* =================================================
           MODAL
        ================================================= */

        .users-modal-overlay {
          position: fixed;

          inset: 0;

          z-index: 1000;

          display: flex;

          align-items: center;

          justify-content: center;

          padding: 20px;

          background:
            rgba(15, 23, 42, .38);
        }


        .users-modal {
          width: 100%;

          max-width: 560px;

          background: #fff;

          border-radius: 10px;

          box-shadow:
            0 20px 60px
            rgba(0,0,0,.20);

          overflow: hidden;
        }


        .users-modal-header {
          display: flex;

          align-items: center;

          justify-content:
            space-between;

          padding:
            17px 20px;

          border-bottom:
            1px solid #edf0f2;
        }


        .users-modal-title {
          margin: 0;

          font-size: 15px;

          font-weight: 750;
        }


        .users-modal-subtitle {
          margin:
            4px 0 0;

          color: #8a95a1;

          font-size: 10px;
        }


        .users-modal-close {
          width: 30px;

          height: 30px;

          display: flex;

          align-items: center;

          justify-content: center;

          border: 0;

          border-radius: 6px;

          background: transparent;

          color: #8993a0;

          cursor: pointer;
        }


        .users-modal-close:hover {
          background: #f3f5f7;
        }


        .users-form {
          padding:
            20px;
        }


        .users-form-grid {
          display: grid;

          grid-template-columns:
            repeat(2, minmax(0, 1fr));

          gap:
            15px;
        }


        .users-form-field {
          display: flex;

          flex-direction: column;

          gap: 6px;
        }


        .users-form-field.full {
          grid-column:
            1 / -1;
        }


        .users-form-label {
          font-size: 9px;

          font-weight: 800;

          color: #687585;

          text-transform:
            uppercase;

          letter-spacing:
            .04em;
        }


        .users-form-input,
        .users-form-select {
          width: 100%;

          height: 38px;

          box-sizing: border-box;

          border:
            1px solid #dce1e6;

          border-radius: 6px;

          padding:
            0 10px;

          background: #fff;

          color: #172033;

          font-family: inherit;

          font-size: 11px;

          outline: none;
        }


        .users-form-input:focus,
        .users-form-select:focus {
          border-color: #2499ed;

          box-shadow:
            0 0 0 2px
            rgba(36,153,237,.10);
        }


        .users-active-row {
          display: flex;

          align-items: center;

          justify-content:
            space-between;

          padding:
            10px 12px;

          border:
            1px solid #e1e5e9;

          border-radius: 7px;

          grid-column:
            1 / -1;
        }


        .users-active-text {
          display: flex;

          flex-direction: column;

          gap: 3px;
        }


        .users-active-title {
          font-size: 11px;

          font-weight: 700;

          color: #273142;
        }


        .users-active-description {
          font-size: 9px;

          color: #8a95a1;
        }


        .users-switch {
          position: relative;

          width: 38px;

          height: 21px;

          flex-shrink: 0;
        }


        .users-switch input {
          opacity: 0;

          width: 0;

          height: 0;
        }


        .users-slider {
          position: absolute;

          inset: 0;

          border-radius: 20px;

          background: #cbd2d9;

          cursor: pointer;

          transition:
            .2s;
        }


        .users-slider:before {
          content: "";

          position: absolute;

          width: 17px;

          height: 17px;

          left: 2px;

          top: 2px;

          border-radius: 50%;

          background: #fff;

          transition:
            .2s;

          box-shadow:
            0 1px 3px
            rgba(0,0,0,.18);
        }


        .users-switch input:checked
        + .users-slider {
          background: #2499ed;
        }


        .users-switch input:checked
        + .users-slider:before {
          transform:
            translateX(17px);
        }


        /* =================================================
           MODAL FOOTER
        ================================================= */

        .users-modal-footer {
          display: flex;

          align-items: center;

          justify-content:
            flex-end;

          gap: 8px;

          padding:
            13px 20px;

          border-top:
            1px solid #edf0f2;
        }


        .users-cancel-button,
        .users-save-button {
          height: 36px;

          padding:
            0 14px;

          border-radius: 6px;

          font-family: inherit;

          font-size: 10px;

          font-weight: 700;

          cursor: pointer;
        }


        .users-cancel-button {
          border:
            1px solid #dfe3e7;

          background: #fff;

          color: #596575;
        }


        .users-save-button {
          border: 0;

          background: #172554;

          color: #fff;
        }


        .users-save-button:disabled,
        .users-cancel-button:disabled {
          opacity: .5;

          cursor: default;
        }


        /* =================================================
           MOBILE
        ================================================= */

        @media (max-width: 700px) {

          .users-page {
            padding: 16px;
          }

          .users-header {
            align-items: stretch;

            flex-direction: column;
          }

          .users-header-actions {
            align-items: stretch;

            flex-direction: column;
          }

          .users-add-button {
            align-self: flex-start;
          }

          .users-toolbar {
            align-items: stretch;

            flex-direction: column;
          }

          .users-toolbar-left {
            flex-direction: column;

            align-items: stretch;
          }

          .users-search {
            width: 100%;
          }

          .reporting-tree-controls {
            width: fit-content;
          }

          .tree-node-main {
            min-height: 66px;

            padding:
              8px;
          }

          .tree-user-icon {
            width: 32px;

            height: 32px;
          }

          .tree-status {
            display: none;
          }

          .tree-user-meta {
            font-size: 9px;
          }

          .users-form-grid {
            grid-template-columns: 1fr;
          }

          .users-form-field.full {
            grid-column: auto;
          }

          .users-active-row {
            grid-column: auto;
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

          <div className="users-toolbar-left">


            {/* SEARCH */}

            <div className="users-search">

              <Search size={14} />

              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
              />

            </div>


            {/* SHOW INACTIVE */}

            <div className="reporting-tree-controls">

              <span className="reporting-tree-control-label">
                Show inactive
              </span>

              <label className="reporting-tree-switch">

                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(event) =>
                    setShowInactive(
                      event.target.checked
                    )
                  }
                />

                <span className="reporting-tree-slider" />

              </label>

            </div>

          </div>


          {/* REFRESH */}

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
            REPORTING TREE
        =================================================== */}

        <div className="reporting-tree">

          {loading ? (

            <div className="users-empty">
              Loading users...
            </div>

          ) : rootUsers.length === 0 ? (

            <div className="users-empty">

              {search
                ? "No users match your search."
                : showInactive
                  ? "No users found."
                  : "No active users found."}

            </div>

          ) : (

            rootUsers.map((user) => (

              <UserNode
                key={user.id}
                user={user}
                level={0}
              />

            ))

          )}

        </div>

      </div>


      {/* =====================================================
          EDIT / ADD MODAL
      ===================================================== */}

      {showModal && (

        <div
          className="users-modal-overlay"
          onMouseDown={(event) => {

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
                MODAL HEADER
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
                    onChange={(event) =>
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
                    onChange={(event) =>
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
                    value={form.role}
                    onChange={(event) =>
                      updateForm(
                        "role",
                        event.target.value
                      )
                    }
                    placeholder="Sales Rep"
                  />

                </div>


                {/* BRANCH */}

                <div className="users-form-field">

                  <label className="users-form-label">
                    Branch
                  </label>

                  <input
                    className="users-form-input"
                    value={form.branch}
                    onChange={(event) =>
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
                    onChange={(event) =>
                      updateForm(
                        "permission_level",
                        Number(
                          event.target.value
                        )
                      )
                    }
                  >

                    <option value={1}>
                      1 — Sales Rep
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
                    onChange={(event) =>
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
                        (manager) =>
                          manager.id !==
                          editingUser?.id
                      )
                      .map((manager) => (

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
                      Inactive users remain in the
                      system but can be hidden from
                      the reporting tree.
                    </span>

                  </div>


                  <label className="users-switch">

                    <input
                      type="checkbox"
                      checked={
                        form.active
                      }
                      onChange={(event) =>
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
                      marginBottom: 0,
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
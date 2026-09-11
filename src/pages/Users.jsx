import React, { useEffect, useMemo, useState } from "react"
import {
  Search,
  Plus,
  Pencil,
  X,
  Check,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  GitBranch,
  Users as UsersIcon,
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

function normaliseId(value) {
  return value == null ? "" : String(value)
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

  const [branchFilter, setBranchFilter] = useState("")
  const [roleFilter, setRoleFilter] = useState("")

  const [expanded, setExpanded] = useState({})

  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)


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
     UNIQUE BRANCHES
  ======================================================= */

  const branches = useMemo(() => {

    return [
      ...new Set(
        users
          .map(user => String(user.branch ?? "").trim())
          .filter(Boolean)
      ),
    ].sort((a, b) =>
      a.localeCompare(b)
    )

  }, [users])


  /* =======================================================
     UNIQUE ROLES
  ======================================================= */

  const roles = useMemo(() => {

    return [
      ...new Set(
        users
          .map(user => String(user.role ?? "").trim())
          .filter(Boolean)
      ),
    ].sort((a, b) =>
      a.localeCompare(b)
    )

  }, [users])


  /* =======================================================
     FILTER USERS
  ======================================================= */

  const visibleUsers = useMemo(() => {

    const query =
      search
        .toLowerCase()
        .trim()

    return users.filter((user) => {

      if (
        !showInactive &&
        user.active === false
      ) {
        return false
      }

      if (
        branchFilter &&
        String(user.branch ?? "") !== branchFilter
      ) {
        return false
      }

      if (
        roleFilter &&
        String(user.role ?? "") !== roleFilter
      ) {
        return false
      }

      if (!query) {
        return true
      }

      const manager =
        users.find(
          item =>
            normaliseId(item.id) ===
            normaliseId(user.manager_id)
        )

      const values = [
        user.full_name,
        user.role,
        user.branch,
        user.permission_level,
        manager?.full_name,
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
    branchFilter,
    roleFilter,
  ])


  /* =======================================================
     CHILDREN LOOKUP
     
     IMPORTANT:
     This is the basis of the reporting tree.
     
     Every user is attached to their manager using
     manager_id.
  ======================================================= */

  const childrenByManager = useMemo(() => {

    const map = new Map()

    visibleUsers.forEach(user => {

      const managerId =
        normaliseId(user.manager_id)

      if (!managerId) {
        return
      }

      if (!map.has(managerId)) {
        map.set(managerId, [])
      }

      map.get(managerId).push(user)

    })

    for (const children of map.values()) {

      children.sort((a, b) =>
        display(a.full_name)
          .localeCompare(
            display(b.full_name)
          )
      )

    }

    return map

  }, [visibleUsers])


  /* =======================================================
     ROOT USERS
     
     A root user is someone with:
     
     - no manager
     OR
     - a manager_id that doesn't exist
     
     This is what prevents Alex / Ann / etc. from appearing
     twice.
  ======================================================= */

  const rootUsers = useMemo(() => {

    const visibleIds = new Set(
      visibleUsers.map(user =>
        normaliseId(user.id)
      )
    )

    return visibleUsers
      .filter(user => {

        const managerId =
          normaliseId(user.manager_id)

        return (
          !managerId ||
          !visibleIds.has(managerId)
        )

      })
      .sort((a, b) =>
        display(a.full_name)
          .localeCompare(
            display(b.full_name)
          )
      )

  }, [visibleUsers])


  /* =======================================================
     TOTAL REPORTING USERS
  ======================================================= */

  const reportingCount =
    visibleUsers.length


  /* =======================================================
     MANAGERS
  ======================================================= */

  const managers = useMemo(() => {

    return users
      .filter(user =>
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
     PERMISSION LABEL
  ======================================================= */

  function getPermissionLabel(level) {

    const value =
      Number(level)

    if (value >= 4) {
      return "Administrator"
    }

    if (value === 3) {
      return "Management"
    }

    if (value === 2) {
      return "Supervisor"
    }

    return "Standard"
  }


  /* =======================================================
     TOGGLE NODE
  ======================================================= */

  function toggleExpanded(id) {

    const key =
      normaliseId(id)

    setExpanded(current => ({
      ...current,
      [key]: !current[key],
    }))

  }


  /* =======================================================
     OPEN ADD
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
     OPEN EDIT
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
     FORM CHANGE
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
     MANAGER NAME
  ======================================================= */

  function getManagerName(managerId) {

    if (!managerId) {
      return "No manager"
    }

    const manager =
      users.find(
        user =>
          normaliseId(user.id) ===
          normaliseId(managerId)
      )

    return display(
      manager?.full_name,
      "Unknown manager"
    )
  }


  /* =======================================================
     PERSON CARD
  ======================================================= */

  function UserCard({
    user,
    level = 0,
  }) {

    const userId =
      normaliseId(user.id)

    const children =
      childrenByManager.get(userId) || []

    const hasChildren =
      children.length > 0

    const isExpanded =
      expanded[userId] !== false

    const initials =
      display(user.full_name, "?")
        .split(" ")
        .map(part => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()

    return (
      <div
        className={`tree-user-wrapper level-${Math.min(level, 5)}`}
      >

        <div className="tree-user-row">

          {/* EXPAND BUTTON */}

          <button
            type="button"
            className={
              hasChildren
                ? "tree-expand-button"
                : "tree-expand-button tree-expand-empty"
            }
            onClick={() => {
              if (hasChildren) {
                toggleExpanded(userId)
              }
            }}
            disabled={!hasChildren}
          >

            {hasChildren ? (
              isExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )
            ) : (
              <span />
            )}

          </button>


          {/* AVATAR */}

          <div className="tree-avatar">

            {initials || (
              <UserRound size={16} />
            )}

          </div>


          {/* USER INFORMATION */}

          <div className="tree-user-main">

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

              <span className="tree-meta-dot">
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


          {/* MANAGER */}

          {level > 0 && (
            <div className="tree-user-manager">

              Reports to{" "}

              <strong>
                {getManagerName(
                  user.manager_id
                )}
              </strong>

            </div>
          )}


          {/* PERMISSION */}

          <span className="tree-permission">

            {getPermissionLabel(
              user.permission_level
            )}

          </span>


          {/* STATUS */}

          {user.active !== false ? (

            <span className="tree-active">

              <span className="status-dot" />

              Active

            </span>

          ) : (

            <span className="tree-inactive">

              <span className="status-dot inactive-dot" />

              Inactive

            </span>

          )}


          {/* REPORT COUNT */}

          {hasChildren && (

            <span className="tree-report-count">

              {children.length}

              {" "}

              {children.length === 1
                ? "report"
                : "reports"}

            </span>

          )}


          {/* EDIT */}

          <button
            type="button"
            className="tree-edit-button"
            title="Edit user"
            onClick={() =>
              openEditUser(user)
            }
          >

            <Pencil size={13} />

          </button>

        </div>


        {/* =================================================
            CHILDREN
        ================================================= */}

        {hasChildren && isExpanded && (

          <div className="tree-children">

            <BranchGroups
              children={children}
              parentId={userId}
              level={level + 1}
            />

          </div>

        )}

      </div>
    )
  }


  /* =======================================================
     BRANCH GROUPS
     
     Direct reports are grouped by branch.
     
     Example:
     
     Colin
       ├── Accounts
       │    └── Fiona
       ├── Central Solar
       │    └── Scott
       ├── Installations
       │    └── Alex
       │         └── Alex's reports
  ======================================================= */

  function BranchGroups({
    children,
    parentId,
    level,
  }) {

    const grouped = new Map()

    children.forEach(user => {

      const branch =
        display(
          user.branch,
          "No branch"
        )

      if (!grouped.has(branch)) {
        grouped.set(branch, [])
      }

      grouped.get(branch).push(user)

    })


    const groups =
      Array.from(grouped.entries())
        .sort((a, b) =>
          a[0].localeCompare(b[0])
        )


    return (
      <>

        {groups.map(
          ([branch, branchUsers]) => {

            const branchKey =
              `${parentId}-${branch}`

            const isBranchExpanded =
              expanded[branchKey] !== false

            return (
              <div
                key={branchKey}
                className="tree-branch-group"
              >

                {/* BRANCH HEADER */}

                <div className="tree-branch-line">

                  <div className="tree-branch-connector" />

                  <button
                    type="button"
                    className="tree-branch-button"
                    onClick={() =>
                      setExpanded(current => ({
                        ...current,
                        [branchKey]:
                          !isBranchExpanded,
                      }))
                    }
                  >

                    {isBranchExpanded ? (
                      <ChevronDown size={12} />
                    ) : (
                      <ChevronRight size={12} />
                    )}

                    <span className="tree-branch-name">
                      {branch}
                    </span>

                    <span className="tree-branch-count">
                      {branchUsers.length}{" "}
                      {branchUsers.length === 1
                        ? "user"
                        : "users"}
                    </span>

                  </button>

                </div>


                {/* PEOPLE IN BRANCH */}

                {isBranchExpanded && (

                  <div className="tree-branch-users">

                    {branchUsers.map(user => (

                      <UserCard
                        key={user.id}
                        user={user}
                        level={level}
                      />

                    ))}

                  </div>

                )}

              </div>
            )
          }
        )}

      </>
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
          min-height: calc(100vh - 90px);
          background: #f5f6f8;
          color: #172033;
          font-family: Inter, Arial, sans-serif;
          padding: 24px;
        }


        /* =================================================
           HEADER
        ================================================= */

        .users-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 20px;
        }

        .users-title {
          margin: 0;
          font-size: 25px;
          line-height: 1.15;
          font-weight: 750;
          letter-spacing: -0.5px;
        }

        .users-subtitle {
          margin: 6px 0 0;
          color: #7b8794;
          font-size: 12px;
        }

        .users-add-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          height: 38px;
          padding: 0 14px;
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
           ERROR
        ================================================= */

        .users-error {
          margin-bottom: 14px;
          padding: 10px 12px;
          border: 1px solid #fecaca;
          border-radius: 7px;
          background: #fef2f2;
          color: #991b1b;
          font-size: 11px;
        }


        /* =================================================
           CARD
        ================================================= */

        .users-card {
          background: #fff;
          border: 1px solid #e1e5ea;
          border-radius: 9px;
          overflow: hidden;
        }


        /* =================================================
           TOOLBAR
        ================================================= */

        .users-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          border-bottom: 1px solid #e7eaee;
          flex-wrap: wrap;
        }

        .users-toolbar-left {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .users-search {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 300px;
          max-width: 100%;
          height: 34px;
          padding: 0 10px;
          border: 1px solid #dfe4e9;
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
          background: transparent;
        }

        .users-filter {
          height: 34px;
          min-width: 145px;
          padding: 0 10px;
          border: 1px solid #dfe4e9;
          border-radius: 6px;
          background: #fff;
          color: #596575;
          font-family: inherit;
          font-size: 10px;
          outline: none;
          cursor: pointer;
        }

        .users-filter:focus {
          border-color: #2499ed;
        }

        .users-toolbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .users-toggle {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 34px;
          padding: 0 10px;
          border: 1px solid #dfe4e9;
          border-radius: 6px;
          background: #fff;
          color: #596575;
          font-family: inherit;
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
        }

        .users-toggle:hover {
          background: #f8fafb;
        }

        .users-toggle-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #cbd5e1;
        }

        .users-toggle.active .users-toggle-indicator {
          background: #2499ed;
        }

        .users-refresh {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 34px;
          padding: 0 10px;
          border: 1px solid #e1e5e9;
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
           TREE HEADER
        ================================================= */

        .tree-summary {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 15px 16px 10px;
          color: #5e7086;
          font-size: 11px;
          font-weight: 700;
        }

        .tree-summary svg {
          color: #6d8aa5;
        }

        .tree-summary-number {
          color: #172033;
          font-weight: 800;
        }


        /* =================================================
           TREE
        ================================================= */

        .reporting-tree {
          padding: 4px 12px 24px;
        }

        .tree-root {
          position: relative;
        }

        .tree-user-wrapper {
          position: relative;
          margin-bottom: 8px;
        }

        .tree-user-row {
          position: relative;
          display: flex;
          align-items: center;
          min-height: 62px;
          padding: 8px 12px;
          background: #fff;
          border: 1px solid #dce3e9;
          border-radius: 9px;
          box-sizing: border-box;
          transition: .15s;
        }

        .tree-user-row:hover {
          border-color: #c8d6e2;
          box-shadow: 0 2px 7px rgba(15, 23, 42, .04);
        }


        /* =================================================
           ROOT TREE CONNECTOR
        ================================================= */

        .tree-root > .tree-user-wrapper {
          padding-left: 30px;
        }

        .tree-root > .tree-user-wrapper:before {
          content: "";
          position: absolute;
          left: 7px;
          top: 30px;
          width: 22px;
          border-top: 1px solid #cfd9e2;
        }


        /* =================================================
           EXPAND
        ================================================= */

        .tree-expand-button {
          width: 28px;
          height: 28px;
          flex: 0 0 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-right: 8px;
          border: 1px solid #dce5ec;
          border-radius: 6px;
          background: #f8fafc;
          color: #64748b;
          cursor: pointer;
        }

        .tree-expand-button:hover {
          background: #f1f5f9;
        }

        .tree-expand-button:disabled {
          border-color: transparent;
          background: transparent;
          cursor: default;
        }

        .tree-expand-empty span {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #cbd5e1;
        }


        /* =================================================
           AVATAR
        ================================================= */

        .tree-avatar {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 11px;
          border-radius: 9px;
          background: #eef6fd;
          color: #2879b5;
          font-size: 11px;
          font-weight: 800;
        }


        /* =================================================
           USER DETAILS
        ================================================= */

        .tree-user-main {
          min-width: 170px;
          flex: 1;
        }

        .tree-user-name {
          color: #172033;
          font-size: 12px;
          font-weight: 750;
        }

        .tree-user-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
          color: #8290a0;
          font-size: 9px;
        }

        .tree-meta-dot {
          color: #b6c0ca;
        }


        /* =================================================
           MANAGER
        ================================================= */

        .tree-user-manager {
          margin-right: 15px;
          color: #9aa5b1;
          font-size: 9px;
        }

        .tree-user-manager strong {
          color: #64748b;
          font-weight: 700;
        }


        /* =================================================
           BADGES
        ================================================= */

        .tree-permission {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 55px;
          padding: 5px 7px;
          margin-right: 12px;
          border-radius: 5px;
          background: #eef7ff;
          color: #2679b3;
          font-size: 9px;
          font-weight: 700;
        }

        .tree-active,
        .tree-inactive {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-width: 54px;
          margin-right: 12px;
          font-size: 9px;
          font-weight: 700;
        }

        .tree-active {
          color: #34804a;
        }

        .tree-inactive {
          color: #a06464;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #3d9b58;
        }

        .inactive-dot {
          background: #b77b7b;
        }

        .tree-report-count {
          min-width: 62px;
          padding: 5px 7px;
          margin-right: 10px;
          border-radius: 5px;
          background: #f3f5f7;
          color: #697686;
          text-align: center;
          font-size: 9px;
          font-weight: 700;
        }


        /* =================================================
           EDIT
        ================================================= */

        .tree-edit-button {
          width: 31px;
          height: 31px;
          flex: 0 0 31px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #dfe5ea;
          border-radius: 6px;
          background: #fff;
          color: #64748b;
          cursor: pointer;
        }

        .tree-edit-button:hover {
          background: #f5f8fa;
          color: #172033;
        }


        /* =================================================
           CHILDREN
        ================================================= */

        .tree-children {
          position: relative;
          margin-left: 29px;
          padding-left: 27px;
        }

        .tree-children:before {
          content: "";
          position: absolute;
          left: 7px;
          top: 0;
          bottom: 18px;
          border-left: 1px solid #cfd9e2;
        }


        /* =================================================
           BRANCH GROUP
        ================================================= */

        .tree-branch-group {
          position: relative;
          margin-top: 7px;
        }

        .tree-branch-line {
          position: relative;
          min-height: 30px;
        }

        .tree-branch-connector {
          position: absolute;
          left: -20px;
          top: 15px;
          width: 20px;
          border-top: 1px solid #cfd9e2;
        }

        .tree-branch-button {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          height: 30px;
          padding: 0 9px;
          border: 1px solid #dfe6ec;
          border-radius: 6px;
          background: #f8fafc;
          color: #617186;
          font-family: inherit;
          cursor: pointer;
        }

        .tree-branch-button:hover {
          background: #f2f6f9;
        }

        .tree-branch-name {
          color: #53667b;
          font-size: 9px;
          font-weight: 800;
        }

        .tree-branch-count {
          color: #9aa6b3;
          font-size: 9px;
          font-weight: 600;
        }


        /* =================================================
           BRANCH USERS
        ================================================= */

        .tree-branch-users {
          position: relative;
          margin-left: 14px;
          padding-left: 20px;
        }

        .tree-branch-users:before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 20px;
          border-left: 1px solid #d6dee6;
        }

        .tree-branch-users .tree-user-wrapper {
          margin-top: 7px;
          margin-bottom: 0;
        }

        .tree-branch-users .tree-user-wrapper:before {
          content: "";
          position: absolute;
          left: -20px;
          top: 30px;
          width: 20px;
          border-top: 1px solid #d6dee6;
        }


        /* =================================================
           EMPTY
        ================================================= */

        .users-empty {
          padding: 70px 20px;
          text-align: center;
          color: #94a3b8;
          font-size: 12px;
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
          background: rgba(15, 23, 42, .38);
        }

        .users-modal {
          width: 100%;
          max-width: 560px;
          background: #fff;
          border-radius: 10px;
          box-shadow: 0 20px 60px rgba(0,0,0,.20);
          overflow: hidden;
        }

        .users-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 17px 20px;
          border-bottom: 1px solid #edf0f2;
        }

        .users-modal-title {
          margin: 0;
          font-size: 15px;
          font-weight: 750;
        }

        .users-modal-subtitle {
          margin: 4px 0 0;
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
          padding: 20px;
        }

        .users-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .users-form-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .users-form-label {
          font-size: 9px;
          font-weight: 800;
          color: #687585;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        .users-form-input,
        .users-form-select {
          width: 100%;
          height: 38px;
          box-sizing: border-box;
          border: 1px solid #dce1e6;
          border-radius: 6px;
          padding: 0 10px;
          background: #fff;
          color: #172033;
          font-family: inherit;
          font-size: 11px;
          outline: none;
        }

        .users-form-input:focus,
        .users-form-select:focus {
          border-color: #2499ed;
          box-shadow: 0 0 0 2px rgba(36,153,237,.10);
        }

        .users-active-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border: 1px solid #e1e5e9;
          border-radius: 7px;
          grid-column: 1 / -1;
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
          transition: .2s;
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
          transition: .2s;
          box-shadow: 0 1px 3px rgba(0,0,0,.18);
        }

        .users-switch input:checked + .users-slider {
          background: #2499ed;
        }

        .users-switch input:checked + .users-slider:before {
          transform: translateX(17px);
        }


        /* =================================================
           MODAL FOOTER
        ================================================= */

        .users-modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          padding: 13px 20px;
          border-top: 1px solid #edf0f2;
        }

        .users-cancel-button,
        .users-save-button {
          height: 36px;
          padding: 0 14px;
          border-radius: 6px;
          font-family: inherit;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        .users-cancel-button {
          border: 1px solid #dfe3e7;
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

        @media (max-width: 850px) {

          .tree-user-manager {
            display: none;
          }

          .tree-report-count {
            display: none;
          }

        }

        @media (max-width: 700px) {

          .users-page {
            padding: 16px;
          }

          .users-header {
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
            width: 100%;
          }

          .users-search {
            width: 100%;
          }

          .users-filter {
            flex: 1;
          }

          .users-toolbar-right {
            justify-content: space-between;
          }

          .users-form-grid {
            grid-template-columns: 1fr;
          }

          .users-active-row {
            grid-column: auto;
          }

          .tree-user-row {
            min-height: 58px;
            padding: 7px;
          }

          .tree-avatar {
            width: 34px;
            height: 34px;
            flex-basis: 34px;
          }

          .tree-permission,
          .tree-active,
          .tree-inactive {
            display: none;
          }

          .tree-children {
            margin-left: 18px;
            padding-left: 20px;
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


        <button
          type="button"
          className="users-add-button"
          onClick={openAddUser}
        >

          <Plus size={15} />

          Add user

        </button>

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
          MAIN CARD
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
                onChange={event =>
                  setSearch(
                    event.target.value
                  )
                }
              />

            </div>


            {/* BRANCH */}

            <select
              className="users-filter"
              value={branchFilter}
              onChange={event =>
                setBranchFilter(
                  event.target.value
                )
              }
            >

              <option value="">
                All branches
              </option>

              {branches.map(branch => (

                <option
                  key={branch}
                  value={branch}
                >
                  {branch}
                </option>

              ))}

            </select>


            {/* ROLE */}

            <select
              className="users-filter"
              value={roleFilter}
              onChange={event =>
                setRoleFilter(
                  event.target.value
                )
              }
            >

              <option value="">
                All roles
              </option>

              {roles.map(role => (

                <option
                  key={role}
                  value={role}
                >
                  {role}
                </option>

              ))}

            </select>

          </div>


          <div className="users-toolbar-right">

            {/* ACTIVE TOGGLE */}

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

              <span className="users-toggle-indicator" />

              {showInactive
                ? "Showing inactive"
                : "Active users only"}

            </button>


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

        </div>


        {/* ===================================================
            SUMMARY
        =================================================== */}

        <div className="tree-summary">

          <GitBranch size={14} />

          <span className="tree-summary-number">
            {reportingCount}
          </span>

          <span>
            users in reporting structure
          </span>

        </div>


        {/* ===================================================
            TREE
        =================================================== */}

        {loading ? (

          <div className="users-empty">
            Loading users...
          </div>

        ) : visibleUsers.length === 0 ? (

          <div className="users-empty">
            No users found.
          </div>

        ) : (

          <div className="reporting-tree">

            {rootUsers.map(user => (

              <div
                className="tree-root"
                key={user.id}
              >

                <UserCard
                  user={user}
                  level={0}
                />

              </div>

            ))}

          </div>

        )}

      </div>


      {/* =====================================================
          ADD / EDIT MODAL
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


            {/* HEADER */}

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


            {/* FORM */}

            <div className="users-form">

              <div className="users-form-grid">


                {/* FULL NAME */}

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


                {/* AUTH ID */}

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
                    value={form.role}
                    onChange={event =>
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
                      .filter(manager =>
                        normaliseId(manager.id) !==
                        normaliseId(editingUser?.id)
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


                {/* MODAL ERROR */}

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


            {/* FOOTER */}

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
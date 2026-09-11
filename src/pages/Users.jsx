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
  SlidersHorizontal,
  UsersRound,
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


/* =========================================================
   REPORTING TREE NODE
========================================================= */

function ReportingTreeNode({
  user,
  children,
  expandedUsers,
  toggleUser,
  depth = 0,
}) {

  const hasChildren = children.length > 0

  const isExpanded =
    expandedUsers[user.id] !== false

  return (
    <div className="reporting-tree-node">

      <div
        className="reporting-tree-row"
        style={{
          marginLeft: `${depth * 28}px`,
        }}
      >

        <div className="reporting-tree-connector">
          {depth > 0 && (
            <span className="tree-horizontal-line" />
          )}
        </div>


        <button
          type="button"
          className={`reporting-tree-toggle ${
            hasChildren
              ? ""
              : "no-children"
          }`}
          onClick={() => {
            if (hasChildren) {
              toggleUser(user.id)
            }
          }}
          aria-label={
            hasChildren
              ? isExpanded
                ? "Collapse"
                : "Expand"
              : undefined
          }
        >

          {hasChildren && (
            isExpanded
              ? <ChevronDown size={14} />
              : <ChevronRight size={14} />
          )}

        </button>


        <div className="reporting-user-card">

          <div className="reporting-user-main">

            <div className="reporting-avatar">
              {display(
                user.full_name,
                "?"
              )
                .charAt(0)
                .toUpperCase()}
            </div>


            <div className="reporting-user-details">

              <div className="reporting-user-name">
                {display(
                  user.full_name,
                  "Unnamed user"
                )}
              </div>

              <div className="reporting-user-meta">

                {user.role && (
                  <span>
                    {user.role}
                  </span>
                )}

                {user.role && user.branch && (
                  <span className="reporting-dot">
                    •
                  </span>
                )}

                {user.branch && (
                  <span>
                    {user.branch}
                  </span>
                )}

              </div>

            </div>

          </div>


          <div className="reporting-user-right">

            <span className="permission-badge">
              {getPermissionLabel(
                user.permission_level
              )}
            </span>


            {user.active !== false ? (

              <span className="active-badge">
                <Check size={11} />
                Active
              </span>

            ) : (

              <span className="inactive-badge">
                <X size={11} />
                Inactive
              </span>

            )}

          </div>

        </div>

      </div>


      {hasChildren && isExpanded && (

        <div className="reporting-tree-children">

          {children.map((child) => (

            <ReportingTreeNode
              key={child.id}
              user={child}
              children={child.children}
              expandedUsers={expandedUsers}
              toggleUser={toggleUser}
              depth={depth + 1}
            />

          ))}

        </div>

      )}

    </div>
  )
}


/* =========================================================
   USERS PAGE
========================================================= */

export default function Users() {

  const [users, setUsers] = useState([])

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [error, setError] =
    useState("")

  const [search, setSearch] =
    useState("")


  /* =======================================================
     VIEW
  ======================================================= */

  const [view, setView] =
    useState("table")


  /* =======================================================
     FILTERS
  ======================================================= */

  const [showFilters, setShowFilters] =
    useState(false)

  const [filters, setFilters] =
    useState({
      status: "all",
      branch: "all",
      role: "all",
      permission: "all",
      manager: "all",
    })


  /* =======================================================
     REPORTING TREE
  ======================================================= */

  const [expandedUsers, setExpandedUsers] =
    useState({})


  /* =======================================================
     MODAL
  ======================================================= */

  const [showModal, setShowModal] =
    useState(false)

  const [editingUser, setEditingUser] =
    useState(null)


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


  const [form, setForm] =
    useState(emptyForm)


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


      /* Automatically expand the tree */

      const expanded = {}

      ;(data || []).forEach((user) => {
        expanded[user.id] = true
      })

      setExpandedUsers(expanded)

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
        (user) =>
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
     FILTER OPTIONS
  ======================================================= */

  const filterOptions = useMemo(() => {

    const unique = (values) => {

      return [
        ...new Set(
          values
            .map((value) =>
              String(
                value ?? ""
              ).trim()
            )
            .filter(Boolean)
        ),
      ].sort((a, b) =>
        a.localeCompare(b)
      )

    }


    return {

      branches: unique(
        users.map(
          (user) =>
            user.branch
        )
      ),

      roles: unique(
        users.map(
          (user) =>
            user.role
        )
      ),

      managers:
        users
          .filter(
            (user) =>
              user.active !== false
          )
          .sort((a, b) =>
            display(a.full_name)
              .localeCompare(
                display(b.full_name)
              )
          ),

    }

  }, [users])


  /* =======================================================
     MANAGER NAME
  ======================================================= */

  function getManagerName(
    managerId
  ) {

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
     FILTER USERS
  ======================================================= */

  const filteredUsers = useMemo(() => {

    const query =
      search
        .toLowerCase()
        .trim()


    return users.filter((user) => {


      /* SEARCH */

      if (query) {

        const values = [

          user.full_name,

          user.role,

          user.branch,

          user.permission_level,

          user.manager_id,

          getManagerName(
            user.manager_id
          ),

        ]


        const matchesSearch =
          values.some(
            (value) =>
              String(
                value ?? ""
              )
                .toLowerCase()
                .includes(query)
          )


        if (!matchesSearch) {
          return false
        }
      }


      /* STATUS */

      if (
        filters.status !== "all" &&
        filters.status !== (
          user.active !== false
            ? "active"
            : "inactive"
        )
      ) {

        return false
      }


      /* BRANCH */

      if (
        filters.branch !== "all" &&
        user.branch !==
          filters.branch
      ) {

        return false
      }


      /* ROLE */

      if (
        filters.role !== "all" &&
        user.role !==
          filters.role
      ) {

        return false
      }


      /* PERMISSION */

      if (
        filters.permission !== "all" &&
        Number(
          user.permission_level
        ) !==
          Number(
            filters.permission
          )
      ) {

        return false
      }


      /* MANAGER */

      if (
        filters.manager !== "all" &&
        user.manager_id !==
          filters.manager
      ) {

        return false
      }


      return true

    })

  }, [
    users,
    search,
    filters,
  ])


  /* =======================================================
     ACTIVE FILTER COUNT
  ======================================================= */

  const activeFilterCount =
    Object.values(filters)
      .filter(
        (value) =>
          value !== "all"
      )
      .length


  /* =======================================================
     UPDATE FILTER
  ======================================================= */

  function updateFilter(
    field,
    value
  ) {

    setFilters(
      (current) => ({
        ...current,
        [field]: value,
      })
    )

  }


  /* =======================================================
     CLEAR FILTERS
  ======================================================= */

  function clearFilters() {

    setFilters({
      status: "all",
      branch: "all",
      role: "all",
      permission: "all",
      manager: "all",
    })

  }


  /* =======================================================
     TREE DATA
  ======================================================= */

  const reportingTree =
    useMemo(() => {

      const userMap =
        new Map()

      filteredUsers.forEach(
        (user) => {

          userMap.set(
            user.id,
            {
              ...user,
              children: [],
            }
          )

        }
      )


      const roots = []


      filteredUsers.forEach(
        (user) => {

          const current =
            userMap.get(
              user.id
            )


          /*
             If the manager is not in
             the filtered results, this
             person becomes a root.
          */

          if (
            !user.manager_id ||
            !userMap.has(
              user.manager_id
            )
          ) {

            roots.push(
              current
            )

            return
          }


          const manager =
            userMap.get(
              user.manager_id
            )


          manager.children.push(
            current
          )

        }
      )


      function sortTree(
        nodes
      ) {

        nodes.sort(
          (a, b) =>
            display(
              a.full_name
            ).localeCompare(
              display(
                b.full_name
              )
            )
        )


        nodes.forEach(
          (node) =>
            sortTree(
              node.children
            )
        )


        return nodes
      }


      return sortTree(
        roots
      )

    }, [filteredUsers])


  /* =======================================================
     TREE CONTROLS
  ======================================================= */

  function toggleUser(
    userId
  ) {

    setExpandedUsers(
      (current) => ({
        ...current,
        [userId]:
          current[userId] === false,
    })
    )

  }


  function expandAll() {

    const expanded = {}

    filteredUsers.forEach(
      (user) => {
        expanded[user.id] = true
      }
    )

    setExpandedUsers(
      expanded
    )

  }


  function collapseAll() {

    const expanded = {}

    filteredUsers.forEach(
      (user) => {
        expanded[user.id] = false
      }
    )

    setExpandedUsers(
      expanded
    )

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

  function openEditUser(
    user
  ) {

    setEditingUser(user)

    setForm({

      auth_user_id:
        user.auth_user_id ||
        "",

      full_name:
        user.full_name ||
        "",

      role:
        user.role ||
        "",

      branch:
        user.branch ||
        "",

      permission_level:
        user.permission_level ??
        1,

      manager_id:
        user.manager_id ||
        "",

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

  function updateForm(
    field,
    value
  ) {

    setForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    )

  }


  /* =======================================================
     SAVE USER
  ======================================================= */

  async function saveUser() {

    if (
      !form.full_name.trim()
    ) {

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
          form.auth_user_id
            .trim() ||
          null,

        full_name:
          form.full_name
            .trim(),

        role:
          form.role
            .trim() ||
          null,

        branch:
          form.branch
            .trim() ||
          null,

        permission_level:
          Number(
            form.permission_level
          ) || 1,

        manager_id:
          form.manager_id ||
          null,

        active:
          Boolean(
            form.active
          ),

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


        setUsers(
          (current) =>
            current.map(
              (user) =>
                user.id ===
                editingUser.id
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


        setUsers(
          (current) => [
            ...current,
            data,
          ]
        )

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


  /* =========================================================
     RENDER
  ========================================================= */

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
            20px;
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
           CARD
        ================================================= */

        .users-card {
          background:
            #fff;

          border:
            1px solid #e1e5ea;

          border-radius:
            9px;

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


        .users-toolbar-left {
          display:
            flex;

          align-items:
            center;

          gap:
            8px;

          min-width:
            0;
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


        .users-filter-button {
          display:
            inline-flex;

          align-items:
            center;

          gap:
            6px;

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
            #64748b;

          font-family:
            inherit;

          font-size:
            10px;

          font-weight:
            650;

          cursor:
            pointer;
        }


        .users-filter-button:hover {
          background:
            #f8fafc;

          border-color:
            #cfd6dd;
        }


        .users-filter-button.has-filters {
          color:
            #2499ed;

          border-color:
            #b9ddf7;

          background:
            #f3faff;
        }


        .users-filter-count {
          display:
            inline-flex;

          align-items:
            center;

          justify-content:
            center;

          min-width:
            17px;

          height:
            17px;

          padding:
            0 4px;

          border-radius:
            9px;

          background:
            #2499ed;

          color:
            #fff;

          font-size:
            9px;

          font-weight:
            800;
        }


        .filter-chevron-open {
          transform:
            rotate(180deg);
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
           VIEW SWITCHER
        ================================================= */

        .users-view-switcher {
          display:
            inline-flex;

          align-items:
            center;

          gap:
            2px;

          padding:
            3px;

          border:
            1px solid #dfe4e9;

          border-radius:
            7px;

          background:
            #f6f8fa;
        }


        .users-view-button {
          display:
            inline-flex;

          align-items:
            center;

          gap:
            6px;

          height:
            29px;

          padding:
            0 9px;

          border:
            0;

          border-radius:
            5px;

          background:
            transparent;

          color:
            #7b8794;

          font-family:
            inherit;

          font-size:
            9px;

          font-weight:
            700;

          cursor:
            pointer;
        }


        .users-view-button.active {
          background:
            #fff;

          color:
            #172033;

          box-shadow:
            0 1px 3px
            rgba(0,0,0,.08);
        }


        /* =================================================
           FILTER PANEL
        ================================================= */

        .users-filter-panel {
          display:
            flex;

          align-items:
            flex-end;

          flex-wrap:
            wrap;

          gap:
            10px;

          padding:
            12px 14px;

          background:
            #fafbfc;

          border-bottom:
            1px solid #e7eaee;
        }


        .users-filter-field {
          display:
            flex;

          flex-direction:
            column;

          gap:
            5px;

          min-width:
            145px;
        }


        .users-filter-field label {
          color:
            #718096;

          font-size:
            8px;

          font-weight:
            800;

          text-transform:
            uppercase;

          letter-spacing:
            .05em;
        }


        .users-filter-field select {
          height:
            32px;

          min-width:
            145px;

          padding:
            0 28px 0 9px;

          border:
            1px solid #dfe4e9;

          border-radius:
            6px;

          background:
            #fff;

          color:
            #273142;

          font-family:
            inherit;

          font-size:
            10px;

          outline:
            none;

          cursor:
            pointer;
        }


        .users-filter-field select:focus {
          border-color:
            #2499ed;

          box-shadow:
            0 0 0 2px
            rgba(36,153,237,.08);
        }


        .users-clear-filters {
          height:
            32px;

          padding:
            0 10px;

          border:
            0;

          background:
            transparent;

          color:
            #64748b;

          font-family:
            inherit;

          font-size:
            10px;

          font-weight:
            650;

          cursor:
            pointer;
        }


        .users-clear-filters:hover {
          color:
            #172033;

          text-decoration:
            underline;
        }


        /* =================================================
           TABLE
        ================================================= */

        .users-table-scroll {
          width:
            100%;

          overflow-x:
            auto;
        }


        .users-table {
          width:
            100%;

          min-width:
            900px;

          border-collapse:
            collapse;
        }


        .users-table th {
          padding:
            10px 14px;

          background:
            #f8fafb;

          border-bottom:
            1px solid #e1e5e9;

          color:
            #718096;

          font-size:
            9px;

          font-weight:
            800;

          letter-spacing:
            .05em;

          text-align:
            left;

          white-space:
            nowrap;
        }


        .users-table td {
          padding:
            12px 14px;

          border-bottom:
            1px solid #edf0f3;

          font-size:
            11px;

          color:
            #273142;

          white-space:
            nowrap;
        }


        .users-table tr:last-child td {
          border-bottom:
            0;
        }


        .users-table tbody tr:hover td {
          background:
            #f8fbfd;
        }


        .user-name {
          font-weight:
            700;

          color:
            #172033;
        }


        .user-id {
          margin-top:
            3px;

          font-size:
            9px;

          color:
            #a0a9b3;
        }


        /* =================================================
           BADGES
        ================================================= */

        .user-badge,
        .permission-badge {
          display:
            inline-flex;

          align-items:
            center;

          padding:
            4px 7px;

          border-radius:
            5px;

          font-size:
            9px;

          font-weight:
            700;
        }


        .user-badge {
          background:
            #f1f4f6;

          color:
            #596575;
        }


        .permission-badge {
          background:
            #eef7ff;

          color:
            #2679b3;
        }


        .active-badge {
          display:
            inline-flex;

          align-items:
            center;

          gap:
            4px;

          color:
            #34804a;

          font-size:
            9px;

          font-weight:
            700;
        }


        .inactive-badge {
          display:
            inline-flex;

          align-items:
            center;

          gap:
            4px;

          color:
            #a06464;

          font-size:
            9px;

          font-weight:
            700;
        }


        /* =================================================
           EDIT
        ================================================= */

        .user-edit-button {
          width:
            29px;

          height:
            29px;

          display:
            inline-flex;

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


        .user-edit-button:hover {
          background:
            #f5f8fa;

          color:
            #172033;
        }


        /* =================================================
           EMPTY
        ================================================= */

        .users-empty {
          padding:
            70px 20px;

          text-align:
            center;

          color:
            #94a3b8;

          font-size:
            12px;
        }


        /* =================================================
           REPORTING TREE
        ================================================= */

        .reporting-tree-header {
          display:
            flex;

          align-items:
            center;

          justify-content:
            space-between;

          gap:
            20px;

          padding:
            13px 16px;

          border-bottom:
            1px solid #e7eaee;

          background:
            #fff;
        }


        .reporting-tree-title {
          display:
            flex;

          align-items:
            center;

          gap:
            9px;

          font-size:
            11px;

          font-weight:
            750;

          color:
            #273142;
        }


        .reporting-tree-title-icon {
          display:
            inline-flex;

          align-items:
            center;

          justify-content:
            center;

          width:
            27px;

          height:
            27px;

          border-radius:
            6px;

          background:
            #eef7ff;

          color:
            #2499ed;
        }


        .reporting-tree-actions {
          display:
            flex;

          align-items:
            center;

          gap:
            6px;
        }


        .reporting-tree-action {
          height:
            28px;

          padding:
            0 9px;

          border:
            1px solid #e0e5e9;

          border-radius:
            5px;

          background:
            #fff;

          color:
            #64748b;

          font-family:
            inherit;

          font-size:
            9px;

          font-weight:
            650;

          cursor:
            pointer;
        }


        .reporting-tree-action:hover {
          background:
            #f7f9fa;

          color:
            #172033;
        }


        .reporting-tree-container {
          padding:
            18px 20px 24px;

          min-height:
            300px;

          background:
            #fbfcfd;

          overflow-x:
            auto;
        }


        .reporting-tree-node {
          position:
            relative;
        }


        .reporting-tree-row {
          position:
            relative;

          display:
            flex;

          align-items:
            center;

          min-height:
            64px;
        }


        .reporting-tree-toggle {
          width:
            25px;

          height:
            25px;

          flex-shrink:
            0;

          display:
            inline-flex;

          align-items:
            center;

          justify-content:
            center;

          margin-right:
            7px;

          border:
            1px solid #dfe5ea;

          border-radius:
            6px;

          background:
            #fff;

          color:
            #64748b;

          cursor:
            pointer;
        }


        .reporting-tree-toggle:hover {
          background:
            #f3f7fa;
        }


        .reporting-tree-toggle.no-children {
          border-color:
            transparent;

          background:
            transparent;

          cursor:
            default;
        }


        .reporting-tree-connector {
          position:
            absolute;

          left:
            -17px;

          top:
            0;

          bottom:
            0;

          width:
            17px;

          pointer-events:
            none;
        }


        .tree-horizontal-line {
          position:
            absolute;

          top:
            50%;

          left:
            0;

          width:
            17px;

          height:
            1px;

          background:
            #d8dee4;
        }


        .reporting-user-card {
          display:
            flex;

          align-items:
            center;

          justify-content:
            space-between;

          gap:
            30px;

          width:
            min(720px, calc(100vw - 100px));

          min-height:
            54px;

          padding:
            7px 11px;

          border:
            1px solid #e0e5e9;

          border-radius:
            8px;

          background:
            #fff;

          box-shadow:
            0 1px 2px
            rgba(15,23,42,.03);
        }


        .reporting-user-card:hover {
          border-color:
            #cdd8e1;

          box-shadow:
            0 2px 5px
            rgba(15,23,42,.05);
        }


        .reporting-user-main {
          display:
            flex;

          align-items:
            center;

          gap:
            10px;

          min-width:
            0;
        }


        .reporting-avatar {
          width:
            34px;

          height:
            34px;

          flex-shrink:
            0;

          display:
            flex;

          align-items:
            center;

          justify-content:
            center;

          border-radius:
            50%;

          background:
            #eaf4fc;

          color:
            #2476a9;

          font-size:
            11px;

          font-weight:
            800;
        }


        .reporting-user-details {
          min-width:
            0;
        }


        .reporting-user-name {
          color:
            #172033;

          font-size:
            11px;

          font-weight:
            750;

          overflow:
            hidden;

          text-overflow:
            ellipsis;

          white-space:
            nowrap;
        }


        .reporting-user-meta {
          display:
            flex;

          align-items:
            center;

          gap:
            6px;

          margin-top:
            3px;

          color:
            #8994a0;

          font-size:
            9px;

          white-space:
            nowrap;
        }


        .reporting-dot {
          color:
            #c1c8cf;
        }


        .reporting-user-right {
          display:
            flex;

          align-items:
            center;

          gap:
            12px;

          flex-shrink:
            0;
        }


        .reporting-tree-children {
          position:
            relative;
        }


        .reporting-tree-children::before {
          content:
            "";

          position:
            absolute;

          left:
            11px;

          top:
            0;

          bottom:
            20px;

          width:
            1px;

          background:
            #d8dee4;
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

          background:
            #fff;

          border-radius:
            10px;

          box-shadow:
            0 20px 60px
            rgba(0,0,0,.20);

          overflow:
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
            repeat(2, minmax(0, 1fr));

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
            0 0 0 2px
            rgba(36,153,237,.10);
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
            0 1px 3px
            rgba(0,0,0,.18);
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
           MODAL FOOTER
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

        @media (max-width: 700px) {

          .users-page {
            padding:
              16px;
          }


          .users-header {
            align-items:
              stretch;

            flex-direction:
              column;
          }


          .users-add-button {
            align-self:
              flex-start;
          }


          .users-toolbar {
            align-items:
              stretch;

            flex-direction:
              column;
          }


          .users-toolbar-left {
            align-items:
              stretch;

            flex-direction:
              column;
          }


          .users-search {
            width:
              100%;
          }


          .users-filter-button {
            justify-content:
              center;
          }


          .users-filter-panel {
            align-items:
              stretch;

            flex-direction:
              column;
          }


          .users-filter-field,
          .users-filter-field select {
            width:
              100%;
          }


          .users-view-switcher {
            align-self:
              flex-start;
          }


          .reporting-tree-header {
            align-items:
              flex-start;

            flex-direction:
              column;
          }


          .reporting-user-card {
            width:
              calc(100vw - 110px);

            min-width:
              280px;
          }


          .reporting-user-right {
            gap:
              5px;
          }


          .reporting-user-right
          .permission-badge {
            display:
              none;
          }


          .users-form-grid {
            grid-template-columns:
              1fr;
          }


          .users-form-field.full {
            grid-column:
              auto;
          }


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


            {/* FILTER BUTTON */}

            <button
              type="button"
              className={`users-filter-button ${
                activeFilterCount > 0
                  ? "has-filters"
                  : ""
              }`}
              onClick={() =>
                setShowFilters(
                  (current) =>
                    !current
                )
              }
            >

              <SlidersHorizontal
                size={13}
              />

              Filters


              {activeFilterCount > 0 && (

                <span className="users-filter-count">
                  {activeFilterCount}
                </span>

              )}


              <ChevronDown
                size={13}
                className={
                  showFilters
                    ? "filter-chevron-open"
                    : ""
                }
              />

            </button>


            {/* VIEW SWITCHER */}

            <div className="users-view-switcher">


              <button
                type="button"
                className={`users-view-button ${
                  view === "table"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setView("table")
                }
              >

                <UsersRound
                  size={12}
                />

                Table

              </button>


              <button
                type="button"
                className={`users-view-button ${
                  view === "tree"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setView("tree")
                }
              >

                <ChevronDown
                  size={12}
                />

                Reporting tree

              </button>

            </div>

          </div>


          {/* REFRESH */}

          <button
            type="button"
            className="users-refresh"
            onClick={loadUsers}
            disabled={loading}
          >

            <RefreshCw
              size={12}
            />

            {loading
              ? "Loading..."
              : "Refresh"}

          </button>

        </div>


        {/* ===================================================
            FILTER PANEL
        =================================================== */}

        {showFilters && (

          <div className="users-filter-panel">


            {/* STATUS */}

            <div className="users-filter-field">

              <label>
                Status
              </label>

              <select
                value={
                  filters.status
                }
                onChange={(event) =>
                  updateFilter(
                    "status",
                    event.target.value
                  )
                }
              >

                <option value="all">
                  All statuses
                </option>

                <option value="active">
                  Active
                </option>

                <option value="inactive">
                  Inactive
                </option>

              </select>

            </div>


            {/* BRANCH */}

            <div className="users-filter-field">

              <label>
                Branch
              </label>

              <select
                value={
                  filters.branch
                }
                onChange={(event) =>
                  updateFilter(
                    "branch",
                    event.target.value
                  )
                }
              >

                <option value="all">
                  All branches
                </option>

                {filterOptions.branches.map(
                  (branch) => (

                    <option
                      key={branch}
                      value={branch}
                    >
                      {branch}
                    </option>

                  )
                )}

              </select>

            </div>


            {/* ROLE */}

            <div className="users-filter-field">

              <label>
                Role
              </label>

              <select
                value={
                  filters.role
                }
                onChange={(event) =>
                  updateFilter(
                    "role",
                    event.target.value
                  )
                }
              >

                <option value="all">
                  All roles
                </option>

                {filterOptions.roles.map(
                  (role) => (

                    <option
                      key={role}
                      value={role}
                    >
                      {role}
                    </option>

                  )
                )}

              </select>

            </div>


            {/* PERMISSION */}

            <div className="users-filter-field">

              <label>
                Permission
              </label>

              <select
                value={
                  filters.permission
                }
                onChange={(event) =>
                  updateFilter(
                    "permission",
                    event.target.value
                  )
                }
              >

                <option value="all">
                  All permissions
                </option>

                <option value="1">
                  Standard
                </option>

                <option value="2">
                  Supervisor
                </option>

                <option value="3">
                  Management
                </option>

                <option value="4">
                  Administrator
                </option>

              </select>

            </div>


            {/* MANAGER */}

            <div className="users-filter-field">

              <label>
                Manager
              </label>

              <select
                value={
                  filters.manager
                }
                onChange={(event) =>
                  updateFilter(
                    "manager",
                    event.target.value
                  )
                }
              >

                <option value="all">
                  All managers
                </option>

                {filterOptions.managers.map(
                  (manager) => (

                    <option
                      key={manager.id}
                      value={manager.id}
                    >
                      {display(
                        manager.full_name
                      )}
                    </option>

                  )
                )}

              </select>

            </div>


            {/* CLEAR */}

            {activeFilterCount > 0 && (

              <button
                type="button"
                className="users-clear-filters"
                onClick={
                  clearFilters
                }
              >
                Clear filters
              </button>

            )}

          </div>

        )}


        {/* ===================================================
            TABLE VIEW
        =================================================== */}

        {view === "table" && (

          <div className="users-table-scroll">

            <table className="users-table">

              <thead>

                <tr>

                  <th>
                    USER
                  </th>

                  <th>
                    ROLE
                  </th>

                  <th>
                    BRANCH
                  </th>

                  <th>
                    PERMISSION
                  </th>

                  <th>
                    MANAGER
                  </th>

                  <th>
                    STATUS
                  </th>

                  <th>
                  </th>

                </tr>

              </thead>


              <tbody>

                {loading ? (

                  <tr>

                    <td
                      colSpan="7"
                      className="users-empty"
                    >
                      Loading users...
                    </td>

                  </tr>

                ) : filteredUsers.length === 0 ? (

                  <tr>

                    <td
                      colSpan="7"
                      className="users-empty"
                    >
                      No users found.
                    </td>

                  </tr>

                ) : (

                  filteredUsers.map(
                    (user) => (

                      <tr
                        key={user.id}
                      >

                        <td>

                          <div className="user-name">

                            {display(
                              user.full_name,
                              "Unnamed user"
                            )}

                          </div>


                          {user.auth_user_id && (

                            <div className="user-id">

                              {user.auth_user_id}

                            </div>

                          )}

                        </td>


                        <td>

                          <span className="user-badge">

                            {display(
                              user.role,
                              "No role"
                            )}

                          </span>

                        </td>


                        <td>

                          {display(
                            user.branch,
                            "No branch"
                          )}

                        </td>


                        <td>

                          <span className="permission-badge">

                            {getPermissionLabel(
                              user.permission_level
                            )}

                          </span>

                        </td>


                        <td>

                          {getManagerName(
                            user.manager_id
                          )}

                        </td>


                        <td>

                          {user.active !== false ? (

                            <span className="active-badge">

                              <Check
                                size={12}
                              />

                              Active

                            </span>

                          ) : (

                            <span className="inactive-badge">

                              <X
                                size={12}
                              />

                              Inactive

                            </span>

                          )}

                        </td>


                        <td>

                          <button
                            type="button"
                            className="user-edit-button"
                            title="Edit user"
                            onClick={() =>
                              openEditUser(
                                user
                              )
                            }
                          >

                            <Pencil
                              size={13}
                            />

                          </button>

                        </td>

                      </tr>

                    )
                  )

                )}

              </tbody>

            </table>

          </div>

        )}


        {/* ===================================================
            REPORTING TREE VIEW
        =================================================== */}

        {view === "tree" && (

          <>

            <div className="reporting-tree-header">

              <div className="reporting-tree-title">

                <span className="reporting-tree-title-icon">

                  <UsersRound
                    size={14}
                  />

                </span>

                Reporting structure

              </div>


              <div className="reporting-tree-actions">

                <button
                  type="button"
                  className="reporting-tree-action"
                  onClick={expandAll}
                >
                  Expand all
                </button>


                <button
                  type="button"
                  className="reporting-tree-action"
                  onClick={collapseAll}
                >
                  Collapse all
                </button>

              </div>

            </div>


            <div className="reporting-tree-container">


              {loading ? (

                <div className="users-empty">
                  Loading users...
                </div>

              ) : reportingTree.length === 0 ? (

                <div className="users-empty">
                  No users match the current filters.
                </div>

              ) : (

                reportingTree.map(
                  (user) => (

                    <ReportingTreeNode
                      key={user.id}
                      user={user}
                      children={
                        user.children
                      }
                      expandedUsers={
                        expandedUsers
                      }
                      toggleUser={
                        toggleUser
                      }
                    />

                  )
                )

              )}

            </div>

          </>

        )}

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


            {/* MODAL HEADER */}

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


                {/* NAME */}

                <div className="users-form-field">

                  <label className="users-form-label">
                    Full name
                  </label>

                  <input
                    className="users-form-input"
                    value={
                      form.full_name
                    }
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
                    value={
                      form.auth_user_id
                    }
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
                    value={
                      form.role
                    }
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
                    value={
                      form.branch
                    }
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
                      .map(
                        (manager) => (

                          <option
                            key={
                              manager.id
                            }
                            value={
                              manager.id
                            }
                          >

                            {display(
                              manager.full_name
                            )}

                            {manager.role
                              ? ` — ${manager.role}`
                              : ""}

                          </option>

                        )
                      )}

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
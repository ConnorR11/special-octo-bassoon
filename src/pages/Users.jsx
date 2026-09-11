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


/* =========================================================
   PERMISSION LABEL
========================================================= */

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
  onEdit,
  depth = 0,
}) {

  const hasChildren =
    children.length > 0

  const isExpanded =
    expandedUsers[user.id] !== false


  return (
    <div className="reporting-tree-node">

      <div
        className="reporting-tree-row"
        style={{
          marginLeft:
            `${depth * 28}px`,
        }}
      >

        {/* CONNECTOR */}

        <div className="reporting-tree-connector">

          {depth > 0 && (
            <span className="tree-horizontal-line" />
          )}

        </div>


        {/* EXPAND / COLLAPSE */}

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


        {/* USER CARD */}

        <div className="reporting-user-card">

          <div className="reporting-user-main">

            {/* AVATAR */}

            <div className="reporting-avatar">

              {display(
                user.full_name,
                "?"
              )
                .charAt(0)
                .toUpperCase()}

            </div>


            {/* DETAILS */}

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

                {user.role &&
                  user.branch && (
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


          {/* RIGHT SIDE */}

          <div className="reporting-user-right">

            <span className="permission-badge">

              {getPermissionLabel(
                user.permission_level
              )}

            </span>


            <span className="active-badge">

              <Check size={11} />

              Active

            </span>


            {/* EDIT */}

            <button
              type="button"
              className="reporting-edit-button"
              title={
                `Edit ${display(
                  user.full_name
                )}`
              }
              onClick={() =>
                onEdit(user)
              }
            >

              <Pencil size={12} />

            </button>

          </div>

        </div>

      </div>


      {/* CHILDREN */}

      {hasChildren &&
        isExpanded && (

          <div className="reporting-tree-children">

            {children.map(
              (child) => (

                <ReportingTreeNode
                  key={child.id}
                  user={child}
                  children={
                    child.children
                  }
                  expandedUsers={
                    expandedUsers
                  }
                  toggleUser={
                    toggleUser
                  }
                  onEdit={
                    onEdit
                  }
                  depth={
                    depth + 1
                  }
                />

              )
            )}

          </div>

        )}

    </div>
  )
}


/* =========================================================
   USERS PAGE
========================================================= */

export default function Users() {

  const [users, setUsers] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [error, setError] =
    useState("")


  /* =======================================================
     SEARCH / FILTERS
  ======================================================= */

  const [search, setSearch] =
    useState("")

  const [statusFilter, setStatusFilter] =
    useState("all")

  const [branchFilter, setBranchFilter] =
    useState("all")

  const [roleFilter, setRoleFilter] =
    useState("all")

  const [permissionFilter, setPermissionFilter] =
    useState("all")

  const [managerFilter, setManagerFilter] =
    useState("all")


  /* =======================================================
     VIEW
  ======================================================= */

  const [view, setView] =
    useState("table")


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
        .order(
          "full_name",
          {
            ascending: true,
            nullsFirst: false,
          }
        )


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
     FILTER OPTIONS
  ======================================================= */

  const branches = useMemo(() => {

    return [
      ...new Set(
        users
          .map(
            (user) =>
              String(
                user.branch ?? ""
              ).trim()
          )
          .filter(Boolean)
      ),
    ].sort(
      (a, b) =>
        a.localeCompare(b)
    )

  }, [users])


  const roles = useMemo(() => {

    return [
      ...new Set(
        users
          .map(
            (user) =>
              String(
                user.role ?? ""
              ).trim()
          )
          .filter(Boolean)
      ),
    ].sort(
      (a, b) =>
        a.localeCompare(b)
    )

  }, [users])


  const managers = useMemo(() => {

    return users
      .filter(
        (user) =>
          user.active !== false
      )
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

  }, [users])


  /* =======================================================
     FILTERED USERS
  ======================================================= */

  const filteredUsers = useMemo(() => {

    const query =
      search
        .toLowerCase()
        .trim()


    return users.filter(
      (user) => {

        /* SEARCH */

        if (query) {

          const values = [
            user.full_name,
            user.role,
            user.branch,
            user.permission_level,
            user.manager_id,
          ]


          const matchesSearch =
            values.some(
              (value) =>
                String(
                  value ?? ""
                )
                  .toLowerCase()
                  .includes(
                    query
                  )
            )


          if (!matchesSearch) {
            return false
          }

        }


        /* STATUS */

        if (
          statusFilter !==
          "all"
        ) {

          const isActive =
            user.active !== false


          if (
            statusFilter ===
              "active" &&
            !isActive
          ) {
            return false
          }


          if (
            statusFilter ===
              "inactive" &&
            isActive
          ) {
            return false
          }

        }


        /* BRANCH */

        if (
          branchFilter !==
          "all"
        ) {

          if (
            display(
              user.branch,
              ""
            ) !==
            branchFilter
          ) {
            return false
          }

        }


        /* ROLE */

        if (
          roleFilter !==
          "all"
        ) {

          if (
            display(
              user.role,
              ""
            ) !==
            roleFilter
          ) {
            return false
          }

        }


        /* PERMISSION */

        if (
          permissionFilter !==
          "all"
        ) {

          if (
            Number(
              user.permission_level
            ) !==
            Number(
              permissionFilter
            )
          ) {
            return false
          }

        }


        /* MANAGER */

        if (
          managerFilter !==
          "all"
        ) {

          if (
            user.manager_id !==
            managerFilter
          ) {
            return false
          }

        }


        return true
      }
    )

  }, [
    users,
    search,
    statusFilter,
    branchFilter,
    roleFilter,
    permissionFilter,
    managerFilter,
  ])


  /* =======================================================
     REPORTING TREE DATA

     ONLY ACTIVE USERS ARE INCLUDED.
======================================================= */

  const reportingTree =
    useMemo(() => {

      /*
        Start with active users only.

        This is intentionally independent of
        statusFilter because inactive users should
        NEVER appear in the reporting tree.
      */

      const activeTreeUsers =
        filteredUsers.filter(
          (user) =>
            user.active !== false
        )


      const userMap =
        new Map()


      activeTreeUsers.forEach(
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


      activeTreeUsers.forEach(
        (user) => {

          const current =
            userMap.get(
              user.id
            )


          /*
            If there is no manager,
            OR the manager is inactive/not
            present in the active tree,
            this user becomes a root.
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

    }, [
      filteredUsers
    ])


  /* =======================================================
     TOGGLE TREE USER
  ======================================================= */

  function toggleUser(
    userId
  ) {

    setExpandedUsers(
      (current) => ({
        ...current,

        [userId]:
          current[userId] ===
          false,
      })
    )

  }


  /* =======================================================
     EXPAND ALL
  ======================================================= */

  function expandAll() {

    const expanded = {}


    function walk(nodes) {

      nodes.forEach(
        (node) => {

          if (
            node.children.length
          ) {

            expanded[
              node.id
            ] = true

          }


          walk(
            node.children
          )

        }
      )

    }


    walk(
      reportingTree
    )


    setExpandedUsers(
      expanded
    )

  }


  /* =======================================================
     COLLAPSE ALL
  ======================================================= */

  function collapseAll() {

    const collapsed = {}


    function walk(nodes) {

      nodes.forEach(
        (node) => {

          if (
            node.children.length
          ) {

            collapsed[
              node.id
            ] = false

          }


          walk(
            node.children
          )

        }
      )

    }


    walk(
      reportingTree
    )


    setExpandedUsers(
      collapsed
    )

  }


  /* =======================================================
     CLEAR FILTERS
  ======================================================= */

  function clearFilters() {

    setSearch("")

    setStatusFilter("all")

    setBranchFilter("all")

    setRoleFilter("all")

    setPermissionFilter("all")

    setManagerFilter("all")

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


      /* UPDATE */

      if (
        editingUser
      ) {

        const {
          data,
          error:
            updateError,
        } =
          await supabase
            .from(
              "profiles"
            )
            .update(
              payload
            )
            .eq(
              "id",
              editingUser.id
            )
            .select()
            .single()


        if (
          updateError
        ) {
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


      /* INSERT */

      else {

        const {
          data,
          error:
            insertError,
        } =
          await supabase
            .from(
              "profiles"
            )
            .insert(
              payload
            )
            .select()
            .single()


        if (
          insertError
        ) {
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

    } catch (
      err
    ) {

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

  function getManagerName(
    managerId
  ) {

    if (!managerId) {
      return "No manager"
    }


    const manager =
      users.find(
        (user) =>
          user.id ===
          managerId
      )


    return display(
      manager?.full_name,
      "Unknown manager"
    )

  }


  /* =======================================================
     ACTIVE COUNT
  ======================================================= */

  const activeCount =
    users.filter(
      (user) =>
        user.active !== false
    ).length


  const inactiveCount =
    users.filter(
      (user) =>
        user.active === false
    ).length


  /* =======================================================
     FILTER ACTIVE
  ======================================================= */

  const filtersActive =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    branchFilter !== "all" ||
    roleFilter !== "all" ||
    permissionFilter !== "all" ||
    managerFilter !== "all"


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
           SUMMARY
        ================================================= */

        .users-summary {
          display:
            flex;

          gap:
            10px;

          margin-bottom:
            14px;
        }


        .users-summary-card {
          display:
            flex;

          align-items:
            center;

          gap:
            9px;

          min-width:
            115px;

          padding:
            9px 11px;

          border:
            1px solid #e1e5ea;

          border-radius:
            7px;

          background:
            #fff;
        }


        .users-summary-icon {
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

          border-radius:
            6px;

          background:
            #eef7ff;

          color:
            #2499ed;
        }


        .users-summary-number {
          font-size:
            14px;

          line-height:
            1;

          font-weight:
            800;

          color:
            #172033;
        }


        .users-summary-label {
          margin-top:
            3px;

          font-size:
            8px;

          color:
            #8993a0;

          text-transform:
            uppercase;

          letter-spacing:
            .04em;
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

          flex-wrap:
            wrap;

          flex: 1;
        }


        .users-search {
          display:
            flex;

          align-items:
            center;

          gap:
            8px;

          width:
            280px;

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


        /* =================================================
           FILTERS
        ================================================= */

        .users-filters {
          display:
            flex;

          align-items:
            center;

          gap:
            7px;

          padding:
            10px 14px;

          background:
            #fafbfc;

          border-bottom:
            1px solid #edf0f3;

          flex-wrap:
            wrap;
        }


        .users-filter-select {
          height:
            32px;

          padding:
            0 27px 0 9px;

          border:
            1px solid #dfe4e9;

          border-radius:
            6px;

          background:
            #fff;

          color:
            #4b5563;

          font-family:
            inherit;

          font-size:
            10px;

          outline:
            none;

          cursor:
            pointer;
        }


        .users-filter-select:focus {
          border-color:
            #2499ed;
        }


        .users-clear-filters {
          height:
            32px;

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
            600;

          cursor:
            pointer;
        }


        .users-clear-filters:hover {
          background:
            #f3f6f8;

          color:
            #172033;
        }


        /* =================================================
           VIEW SWITCHER
        ================================================= */

        .users-view-switcher {
          display:
            inline-flex;

          align-items:
            center;

          padding:
            2px;

          border:
            1px solid #dfe4e9;

          border-radius:
            6px;

          background:
            #f5f7f8;
        }


        .users-view-button {
          height:
            28px;

          padding:
            0 10px;

          border:
            0;

          border-radius:
            4px;

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

        .user-badge {
          display:
            inline-flex;

          align-items:
            center;

          padding:
            4px 7px;

          border-radius:
            5px;

          background:
            #f1f4f6;

          color:
            #596575;

          font-size:
            9px;

          font-weight:
            700;
        }


        .permission-badge {
          display:
            inline-flex;

          align-items:
            center;

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

          white-space:
            nowrap;
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

          white-space:
            nowrap;
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
           EDIT BUTTON
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

        .reporting-tree {
          padding:
            18px;
        }


        .reporting-tree-header {
          display:
            flex;

          align-items:
            center;

          justify-content:
            space-between;

          gap:
            15px;

          margin-bottom:
            18px;

          padding-bottom:
            13px;

          border-bottom:
            1px solid #edf0f3;
        }


        .reporting-tree-heading {
          display:
            flex;

          align-items:
            center;

          gap:
            9px;
        }


        .reporting-tree-heading-icon {
          width:
            32px;

          height:
            32px;

          display:
            flex;

          align-items:
            center;

          justify-content:
            center;

          border-radius:
            7px;

          background:
            #eef7ff;

          color:
            #2499ed;
        }


        .reporting-tree-title {
          margin:
            0;

          font-size:
            13px;

          font-weight:
            750;

          color:
            #172033;
        }


        .reporting-tree-subtitle {
          margin:
            3px 0 0;

          font-size:
            9px;

          color:
            #8a95a1;
        }


        .reporting-tree-actions {
          display:
            flex;

          gap:
            6px;
        }


        .reporting-tree-action {
          height:
            29px;

          padding:
            0 9px;

          border:
            1px solid #e1e5e9;

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
            600;

          cursor:
            pointer;
        }


        .reporting-tree-action:hover {
          background:
            #f6f8fa;

          color:
            #172033;
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
            58px;

          margin-bottom:
            7px;
        }


        .reporting-tree-connector {
          width:
            20px;

          height:
            100%;

          position:
            relative;

          flex-shrink:
            0;
        }


        .tree-horizontal-line {
          position:
            absolute;

          left:
            0;

          top:
            50%;

          width:
            20px;

          height:
            1px;

          background:
            #d8dee4;
        }


        .reporting-tree-toggle {
          width:
            26px;

          height:
            26px;

          display:
            flex;

          align-items:
            center;

          justify-content:
            center;

          flex-shrink:
            0;

          margin-right:
            7px;

          border:
            1px solid #dfe4e8;

          border-radius:
            5px;

          background:
            #fff;

          color:
            #64748b;

          cursor:
            pointer;
        }


        .reporting-tree-toggle:hover {
          background:
            #f4f7f9;

          color:
            #172033;
        }


        .reporting-tree-toggle.no-children {
          border-color:
            transparent;

          background:
            transparent;

          cursor:
            default;
        }


        .reporting-user-card {
          min-width:
            0;

          flex:
            1;

          display:
            flex;

          align-items:
            center;

          justify-content:
            space-between;

          gap:
            15px;

          padding:
            9px 11px;

          border:
            1px solid #e1e5e9;

          border-radius:
            8px;

          background:
            #fff;

          transition:
            .15s ease;
        }


        .reporting-user-card:hover {
          border-color:
            #cfd8df;

          box-shadow:
            0 2px 8px
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
            #eef7ff;

          color:
            #2499ed;

          font-size:
            12px;

          font-weight:
            800;
        }


        .reporting-user-details {
          min-width:
            0;
        }


        .reporting-user-name {
          font-size:
            11px;

          font-weight:
            750;

          color:
            #172033;

          white-space:
            nowrap;

          overflow:
            hidden;

          text-overflow:
            ellipsis;
        }


        .reporting-user-meta {
          display:
            flex;

          align-items:
            center;

          gap:
            5px;

          margin-top:
            3px;

          font-size:
            9px;

          color:
            #8a95a1;

          white-space:
            nowrap;
        }


        .reporting-dot {
          color:
            #c3cad1;
        }


        .reporting-user-right {
          display:
            flex;

          align-items:
            center;

          gap:
            8px;

          flex-shrink:
            0;
        }


        .reporting-edit-button {
          width:
            27px;

          height:
            27px;

          display:
            inline-flex;

          align-items:
            center;

          justify-content:
            center;

          flex-shrink:
            0;

          border:
            1px solid #e0e5e9;

          border-radius:
            6px;

          background:
            #fff;

          color:
            #718096;

          cursor:
            pointer;

          transition:
            .15s ease;
        }


        .reporting-edit-button:hover {
          background:
            #f3faff;

          border-color:
            #b9ddf7;

          color:
            #2499ed;
        }


        .reporting-edit-button:active {
          transform:
            translateY(1px);
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
            47px;

          top:
            0;

          bottom:
            24px;

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

          max-height:
            calc(100vh - 40px);

          overflow-y:
            auto;

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
            repeat(
              2,
              minmax(0,1fr)
            );

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

        @media (
          max-width: 700px
        ) {

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


          .users-summary {
            overflow-x:
              auto;
          }


          .users-toolbar {
            align-items:
              stretch;

            flex-direction:
              column;
          }


          .users-toolbar-left {
            width:
              100%;
          }


          .users-search {
            width:
              100%;
          }


          .users-filters {
            align-items:
              stretch;

            flex-direction:
              column;
          }


          .users-filter-select,
          .users-clear-filters {
            width:
              100%;
          }


          .users-view-switcher {
            align-self:
              flex-start;
          }


          .reporting-tree {
            padding:
              12px;
          }


          .reporting-tree-header {
            align-items:
              flex-start;

            flex-direction:
              column;
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


          .reporting-user-meta {
            max-width:
              180px;

            overflow:
              hidden;

            text-overflow:
              ellipsis;
          }


          .users-form-grid {
            grid-template-columns:
              1fr;
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
          onClick={
            openAddUser
          }
        >

          <Plus size={15} />

          Add user

        </button>

      </div>


      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <div className="users-summary">

        <div className="users-summary-card">

          <div className="users-summary-icon">

            <UsersRound
              size={15}
            />

          </div>


          <div>

            <div className="users-summary-number">
              {users.length}
            </div>

            <div className="users-summary-label">
              Total users
            </div>

          </div>

        </div>


        <div className="users-summary-card">

          <div className="users-summary-icon">

            <Check size={15} />

          </div>


          <div>

            <div className="users-summary-number">
              {activeCount}
            </div>

            <div className="users-summary-label">
              Active
            </div>

          </div>

        </div>


        <div className="users-summary-card">

          <div className="users-summary-icon">

            <X size={15} />

          </div>


          <div>

            <div className="users-summary-number">
              {inactiveCount}
            </div>

            <div className="users-summary-label">
              Inactive
            </div>

          </div>

        </div>

      </div>


      {/* =====================================================
          ERROR
      ===================================================== */}

      {error &&
        !showModal && (

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

            <div className="users-search">

              <Search
                size={14}
              />

              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target.value
                  )
                }
              />

            </div>


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
                Reporting tree
              </button>

            </div>

          </div>


          <button
            type="button"
            className="users-refresh"
            onClick={
              loadUsers
            }
            disabled={
              loading
            }
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
            FILTERS
        =================================================== */}

        <div className="users-filters">

          {/* STATUS */}

          <select
            className="users-filter-select"
            value={
              statusFilter
            }
            onChange={(
              event
            ) =>
              setStatusFilter(
                event.target.value
              )
            }
          >

            <option value="all">
              All statuses
            </option>

            <option value="active">
              Active only
            </option>

            <option value="inactive">
              Inactive only
            </option>

          </select>


          {/* BRANCH */}

          <select
            className="users-filter-select"
            value={
              branchFilter
            }
            onChange={(
              event
            ) =>
              setBranchFilter(
                event.target.value
              )
            }
          >

            <option value="all">
              All branches
            </option>

            {branches.map(
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


          {/* ROLE */}

          <select
            className="users-filter-select"
            value={
              roleFilter
            }
            onChange={(
              event
            ) =>
              setRoleFilter(
                event.target.value
              )
            }
          >

            <option value="all">
              All roles
            </option>

            {roles.map(
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


          {/* PERMISSION */}

          <select
            className="users-filter-select"
            value={
              permissionFilter
            }
            onChange={(
              event
            ) =>
              setPermissionFilter(
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


          {/* MANAGER */}

          <select
            className="users-filter-select"
            value={
              managerFilter
            }
            onChange={(
              event
            ) =>
              setManagerFilter(
                event.target.value
              )
            }
          >

            <option value="all">
              All managers
            </option>

            <option value="">
              No manager
            </option>

            {managers.map(
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
                </option>

              )
            )}

          </select>


          {/* CLEAR */}

          {filtersActive && (

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
                        key={
                          user.id
                        }
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

                              {
                                user.auth_user_id
                              }

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

          <div className="reporting-tree">

            <div className="reporting-tree-header">

              <div className="reporting-tree-heading">

                <div className="reporting-tree-heading-icon">

                  <UsersRound
                    size={16}
                  />

                </div>


                <div>

                  <h2 className="reporting-tree-title">
                    Reporting structure
                  </h2>

                  <p className="reporting-tree-subtitle">
                    Active users only
                    {filteredUsers.length !==
                      activeCount &&
                      " • filters applied"}
                  </p>

                </div>

              </div>


              <div className="reporting-tree-actions">

                <button
                  type="button"
                  className="reporting-tree-action"
                  onClick={
                    expandAll
                  }
                >
                  Expand all
                </button>


                <button
                  type="button"
                  className="reporting-tree-action"
                  onClick={
                    collapseAll
                  }
                >
                  Collapse all
                </button>

              </div>

            </div>


            {loading ? (

              <div className="users-empty">
                Loading reporting tree...
              </div>

            ) : reportingTree.length === 0 ? (

              <div className="users-empty">

                No active users found.

              </div>

            ) : (

              reportingTree.map(
                (user) => (

                  <ReportingTreeNode
                    key={
                      user.id
                    }
                    user={
                      user
                    }
                    children={
                      user.children
                    }
                    expandedUsers={
                      expandedUsers
                    }
                    toggleUser={
                      toggleUser
                    }
                    onEdit={
                      openEditUser
                    }
                  />

                )
              )

            )}

          </div>

        )}

      </div>


      {/* =====================================================
          EDIT / ADD MODAL
      ===================================================== */}

      {showModal && (

        <div
          className="users-modal-overlay"
          onMouseDown={(
            event
          ) => {

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
                onClick={
                  closeModal
                }
                disabled={
                  saving
                }
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
                    onChange={(
                      event
                    ) =>
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
                    onChange={(
                      event
                    ) =>
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
                    onChange={(
                      event
                    ) =>
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
                    onChange={(
                      event
                    ) =>
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
                    onChange={(
                      event
                    ) =>
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
                    onChange={(
                      event
                    ) =>
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
                        (
                          manager
                        ) =>
                          manager.id !==
                          editingUser?.id
                      )
                      .map(
                        (
                          manager
                        ) => (

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
                      onChange={(
                        event
                      ) =>
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


            {/* FOOTER */}

            <div className="users-modal-footer">

              <button
                type="button"
                className="users-cancel-button"
                onClick={
                  closeModal
                }
                disabled={
                  saving
                }
              >
                Cancel
              </button>


              <button
                type="button"
                className="users-save-button"
                onClick={
                  saveUser
                }
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
import React, { useEffect, useMemo, useState } from "react"
import {
  Search,
  Plus,
  Pencil,
  X,
  Check,
  ChevronDown,
  RefreshCw,
  UsersRound,
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


/* =========================================================
   USERS PAGE
========================================================= */

export default function Users() {

  /* =======================================================
     USERS
  ======================================================= */

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState("")

  const [search, setSearch] = useState("")

  /* =======================================================
     FILTERS
  ======================================================= */

  const [statusFilter, setStatusFilter] = useState("active")
  const [roleFilter, setRoleFilter] = useState("")
  const [branchFilter, setBranchFilter] = useState("")
  const [permissionFilter, setPermissionFilter] = useState("")

  /* =======================================================
     MODAL
  ======================================================= */

  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)

  /* =======================================================
     NEW ROLE
  ======================================================= */

  const [creatingRole, setCreatingRole] = useState(false)
  const [newRole, setNewRole] = useState("")

  /* =======================================================
     REPORTING TREE
  ======================================================= */

  const [treeOpen, setTreeOpen] = useState(true)


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


  /* =========================================================
     LOAD USERS
  ========================================================= */

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


  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    loadUsers()
  }, [])


  /* =========================================================
     UNIQUE ROLES
  ========================================================= */

  const availableRoles = useMemo(() => {

    return [
      ...new Set(
        users
          .map((user) =>
            String(
              user.role ?? ""
            ).trim()
          )
          .filter(Boolean)
      ),
    ].sort((a, b) =>
      a.localeCompare(b)
    )

  }, [users])


  /* =========================================================
     UNIQUE BRANCHES
  ========================================================= */

  const availableBranches = useMemo(() => {

    return [
      ...new Set(
        users
          .map((user) =>
            String(
              user.branch ?? ""
            ).trim()
          )
          .filter(Boolean)
      ),
    ].sort((a, b) =>
      a.localeCompare(b)
    )

  }, [users])


  /* =========================================================
     MANAGERS
  ========================================================= */

  const managers = useMemo(() => {

    return users
      .filter((user) =>
        user.active !== false
      )
      .sort((a, b) =>
        display(a.full_name)
          .localeCompare(
            display(b.full_name)
          )
      )

  }, [users])


  /* =========================================================
     FILTERED USERS
  ========================================================= */

  const filteredUsers = useMemo(() => {

    const query =
      search
        .toLowerCase()
        .trim()

    return users.filter((user) => {

      /* STATUS */

      if (
        statusFilter === "active" &&
        user.active === false
      ) {
        return false
      }

      if (
        statusFilter === "inactive" &&
        user.active !== false
      ) {
        return false
      }


      /* ROLE */

      if (
        roleFilter &&
        String(user.role ?? "").trim() !== roleFilter
      ) {
        return false
      }


      /* BRANCH */

      if (
        branchFilter &&
        String(user.branch ?? "").trim() !== branchFilter
      ) {
        return false
      }


      /* PERMISSION */

      if (
        permissionFilter &&
        String(user.permission_level ?? "") !==
          permissionFilter
      ) {
        return false
      }


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
          values.some((value) =>
            String(value ?? "")
              .toLowerCase()
              .includes(query)
          )

        if (!matchesSearch) {
          return false
        }
      }

      return true
    })

  }, [
    users,
    search,
    statusFilter,
    roleFilter,
    branchFilter,
    permissionFilter,
  ])


  /* =========================================================
     OPEN ADD USER
  ========================================================= */

  function openAddUser() {

    setEditingUser(null)

    setForm({
      ...emptyForm,
    })

    setCreatingRole(false)
    setNewRole("")

    setError("")
    setShowModal(true)
  }


  /* =========================================================
     OPEN EDIT USER
  ========================================================= */

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

    setCreatingRole(false)
    setNewRole("")

    setError("")
    setShowModal(true)
  }


  /* =========================================================
     CLOSE MODAL
  ========================================================= */

  function closeModal() {

    if (saving) {
      return
    }

    setShowModal(false)
    setEditingUser(null)

    setForm({
      ...emptyForm,
    })

    setCreatingRole(false)
    setNewRole("")

    setError("")
  }


  /* =========================================================
     FORM CHANGE
  ========================================================= */

  function updateForm(field, value) {

    setForm((current) => ({
      ...current,
      [field]: value,
    }))

  }


  /* =========================================================
     CREATE NEW ROLE
  ========================================================= */

  function createRole() {

    const role =
      newRole
        .trim()

    if (!role) {

      setError(
        "Please enter a role name."
      )

      return
    }

    setForm((current) => ({
      ...current,
      role,
    }))

    setCreatingRole(false)
    setNewRole("")
    setError("")
  }


  /* =========================================================
     SAVE USER
  ========================================================= */

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


  /* =========================================================
     MANAGER NAME
  ========================================================= */

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


  /* =========================================================
     PERMISSION LABEL
  ========================================================= */

  function getPermissionLabel(
    level
  ) {

    const value =
      Number(level)

    if (value >= 4) {
      return "Administrator"
    }

    if (value === 3) {
      return "Senior Management"
    }

    if (value === 2) {
      return "Manager"
    }

    return "Sales Rep"
  }


  /* =========================================================
     ACTIVE USERS
  ========================================================= */

  const activeUsers =
    useMemo(() => {

      return users.filter(
        (user) =>
          user.active !== false
      )

    }, [users])


  /* =========================================================
     REPORTING TREE HELPERS
  ========================================================= */

  function getChildren(
    managerId
  ) {

    return activeUsers
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


  function getTopLevelUsers() {

    return activeUsers
      .filter((user) => {

        if (!user.manager_id) {
          return true
        }

        const managerExists =
          activeUsers.some(
            (manager) =>
              manager.id ===
              user.manager_id
          )

        return !managerExists

      })
      .sort((a, b) =>
        display(a.full_name)
          .localeCompare(
            display(b.full_name)
          )
      )
  }


  /* =========================================================
     REPORTING TREE NODE
  ========================================================= */

  function ReportingNode({
    user,
    depth = 0,
    visited = new Set(),
  }) {

    /*
      Prevent circular relationships from
      breaking the tree.
    */

    if (visited.has(user.id)) {

      return (
        <div
          className="reporting-cycle"
        >
          Circular reporting relationship
        </div>
      )
    }


    const nextVisited =
      new Set(visited)

    nextVisited.add(user.id)


    const children =
      getChildren(user.id)


    return (

      <div
        className="reporting-node"
      >

        <div
          className="reporting-user"
          style={{
            marginLeft:
              depth * 26,
          }}
        >

          <div className="reporting-user-icon">

            <UserRound size={15} />

          </div>


          <div className="reporting-user-info">

            <div className="reporting-user-name">

              {display(
                user.full_name,
                "Unnamed user"
              )}

            </div>


            <div className="reporting-user-meta">

              {display(
                user.role,
                "No role"
              )}

              {user.branch && (
                <>
                  <span>•</span>
                  <span>
                    {user.branch}
                  </span>
                </>
              )}

            </div>

          </div>


          <span
            className="reporting-permission"
          >
            {getPermissionLabel(
              user.permission_level
            )}
          </span>


          <button
            type="button"
            className="reporting-edit"
            onClick={() =>
              openEditUser(user)
            }
            title="Edit user"
          >

            <Pencil size={12} />

          </button>

        </div>


        {children.length > 0 && (

          <div className="reporting-children">

            {children.map((child) => (

              <ReportingNode
                key={child.id}
                user={child}
                depth={depth + 1}
                visited={nextVisited}
              />

            ))}

          </div>

        )}

      </div>
    )
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
            -0.5px;
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

          margin-bottom:
            20px;
        }


        /* =================================================
           TOOLBAR
        ================================================= */

        .users-toolbar {

          display:
            flex;

          align-items:
            center;

          gap:
            10px;

          padding:
            12px 14px;

          border-bottom:
            1px solid #e7eaee;

          flex-wrap:
            wrap;
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


        .users-filter {

          height:
            34px;

          min-width:
            130px;

          padding:
            0 28px 0 10px;

          border:
            1px solid #dfe4e9;

          border-radius:
            6px;

          background:
            #fff;

          color:
            #475569;

          font-family:
            inherit;

          font-size:
            10px;

          outline:
            none;

          cursor:
            pointer;
        }


        .users-filter:focus {

          border-color:
            #2499ed;
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

          margin-left:
            auto;

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
           REPORTING TREE
        ================================================= */

        .reporting-card {

          background:
            #fff;

          border:
            1px solid #e1e5ea;

          border-radius:
            9px;

          overflow:
            hidden;

          margin-bottom:
            20px;
        }


        .reporting-header {

          display:
            flex;

          align-items:
            center;

          justify-content:
            space-between;

          padding:
            14px 16px;

          border-bottom:
            1px solid #e7eaee;
        }


        .reporting-heading {

          display:
            flex;

          align-items:
            center;

          gap:
            9px;
        }


        .reporting-heading-icon {

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

          border-radius:
            7px;

          background:
            #eef7ff;

          color:
            #2499ed;
        }


        .reporting-title {

          margin:
            0;

          font-size:
            13px;

          font-weight:
            750;

          color:
            #172033;
        }


        .reporting-subtitle {

          margin:
            3px 0 0;

          color:
            #8a95a1;

          font-size:
            9px;
        }


        .reporting-toggle {

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
            1px solid #e1e5e9;

          border-radius:
            6px;

          background:
            #fff;

          color:
            #64748b;

          cursor:
            pointer;
        }


        .reporting-body {

          padding:
            14px 16px 18px;
        }


        .reporting-user {

          min-height:
            48px;

          display:
            flex;

          align-items:
            center;

          gap:
            10px;

          padding:
            7px 9px;

          border:
            1px solid #e5e9ed;

          border-radius:
            7px;

          background:
            #fff;

          box-sizing:
            border-box;

          transition:
            .15s;
        }


        .reporting-user:hover {

          border-color:
            #cbd5df;

          background:
            #f9fbfc;
        }


        .reporting-user-icon {

          width:
            30px;

          height:
            30px;

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
            #f0f4f7;

          color:
            #64748b;
        }


        .reporting-user-info {

          min-width:
            0;

          flex:
            1;
        }


        .reporting-user-name {

          font-size:
            11px;

          font-weight:
            750;

          color:
            #172033;
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

          color:
            #8a95a1;

          font-size:
            9px;
        }


        .reporting-permission {

          flex-shrink:
            0;

          padding:
            4px 7px;

          border-radius:
            5px;

          background:
            #eef7ff;

          color:
            #2679b3;

          font-size:
            8px;

          font-weight:
            700;
        }


        .reporting-edit {

          width:
            28px;

          height:
            28px;

          flex-shrink:
            0;

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


        .reporting-edit:hover {

          background:
            #f1f5f8;

          color:
            #172033;
        }


        .reporting-children {

          position:
            relative;

        }


        .reporting-cycle {

          margin:
            6px 0 6px 52px;

          padding:
            7px 10px;

          border-radius:
            6px;

          background:
            #fff7ed;

          color:
            #9a3412;

          font-size:
            9px;
        }


        .reporting-empty {

          padding:
            35px;

          text-align:
            center;

          color:
            #94a3b8;

          font-size:
            10px;
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
            0 20px 60px rgba(0,0,0,.20);

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


        .role-create-row {

          display:
            flex;

          gap:
            6px;
        }


        .role-create-row
        .users-form-input {

          flex:
            1;
        }


        .role-create-button {

          height:
            38px;

          padding:
            0 11px;

          border:
            0;

          border-radius:
            6px;

          background:
            #172554;

          color:
            #fff;

          font-family:
            inherit;

          font-size:
            9px;

          font-weight:
            700;

          cursor:
            pointer;
        }


        .role-create-button:hover {

          opacity:
            .92;
        }


        .role-cancel-button {

          height:
            38px;

          padding:
            0 10px;

          border:
            1px solid #dfe3e7;

          border-radius:
            6px;

          background:
            #fff;

          color:
            #64748b;

          font-family:
            inherit;

          font-size:
            9px;

          cursor:
            pointer;
        }


        .role-new-button {

          margin-top:
            6px;

          border:
            0;

          padding:
            0;

          background:
            transparent;

          color:
            #2499ed;

          font-family:
            inherit;

          font-size:
            9px;

          font-weight:
            700;

          cursor:
            pointer;

          text-align:
            left;
        }


        .role-new-button:hover {

          text-decoration:
            underline;
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

        @media (max-width:700px) {

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

          .users-refresh {
            margin-left:
              0;
          }

          .users-filter {
            flex:
              1;
          }

          .reporting-user {
            margin-left:
              0 !important;
          }

          .reporting-permission {
            display:
              none;
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
          REPORTING TREE
      ===================================================== */}

      <div className="reporting-card">

        <div className="reporting-header">

          <div className="reporting-heading">

            <div className="reporting-heading-icon">

              <UsersRound size={15} />

            </div>


            <div>

              <h2 className="reporting-title">
                Reporting structure
              </h2>

              <p className="reporting-subtitle">
                Active users and their reporting relationships
              </p>

            </div>

          </div>


          <button
            type="button"
            className="reporting-toggle"
            onClick={() =>
              setTreeOpen(
                (current) => !current
              )
            }
            title={
              treeOpen
                ? "Collapse"
                : "Expand"
            }
          >

            <ChevronDown
              size={15}
              style={{
                transform:
                  treeOpen
                    ? "rotate(0deg)"
                    : "rotate(-90deg)",
                transition:
                  ".15s",
              }}
            />

          </button>

        </div>


        {treeOpen && (

          <div className="reporting-body">

            {loading ? (

              <div className="reporting-empty">
                Loading reporting structure...
              </div>

            ) : activeUsers.length === 0 ? (

              <div className="reporting-empty">
                No active users found.
              </div>

            ) : (

              getTopLevelUsers().map((user) => (

                <ReportingNode
                  key={user.id}
                  user={user}
                />

              ))

            )}

          </div>

        )}

      </div>


      {/* =====================================================
          USERS TABLE
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
              placeholder="Search users..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />

          </div>


          <select
            className="users-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
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


          <select
            className="users-filter"
            value={roleFilter}
            onChange={(event) =>
              setRoleFilter(
                event.target.value
              )
            }
          >

            <option value="">
              All roles
            </option>

            {availableRoles.map(
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


          <select
            className="users-filter"
            value={branchFilter}
            onChange={(event) =>
              setBranchFilter(
                event.target.value
              )
            }
          >

            <option value="">
              All branches
            </option>

            {availableBranches.map(
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


          <select
            className="users-filter"
            value={permissionFilter}
            onChange={(event) =>
              setPermissionFilter(
                event.target.value
              )
            }
          >

            <option value="">
              All access levels
            </option>

            <option value="1">
              Sales Rep
            </option>

            <option value="2">
              Manager
            </option>

            <option value="3">
              Senior Management
            </option>

            <option value="4">
              Administrator
            </option>

          </select>


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
            TABLE
        =================================================== */}

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
                  ACCESS LEVEL
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

                            <Check size={12} />

                            Active

                          </span>

                        ) : (

                          <span className="inactive-badge">

                            <X size={12} />

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
                            openEditUser(user)
                          }
                        >

                          <Pencil size={13} />

                        </button>

                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

          </table>

        </div>

      </div>


      {/* =====================================================
          ADD / EDIT MODAL
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


                  {!creatingRole ? (

                    <>

                      <select
                        className="users-form-select"
                        value={
                          form.role
                        }
                        onChange={(event) =>
                          updateForm(
                            "role",
                            event.target.value
                          )
                        }
                      >

                        <option value="">
                          Select role
                        </option>


                        {availableRoles.map(
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


                      <button
                        type="button"
                        className="role-new-button"
                        onClick={() => {

                          setCreatingRole(true)
                          setNewRole("")

                        }}
                      >
                        + Create new role
                      </button>

                    </>

                  ) : (

                    <div>

                      <div className="role-create-row">

                        <input
                          autoFocus
                          className="users-form-input"
                          value={
                            newRole
                          }
                          onChange={(event) =>
                            setNewRole(
                              event.target.value
                            )
                          }
                          placeholder="New role name"
                          onKeyDown={(event) => {

                            if (
                              event.key ===
                              "Enter"
                            ) {

                              event.preventDefault()

                              createRole()

                            }

                            if (
                              event.key ===
                              "Escape"
                            ) {

                              setCreatingRole(false)
                              setNewRole("")

                            }

                          }}
                        />


                        <button
                          type="button"
                          className="role-create-button"
                          onClick={
                            createRole
                          }
                        >
                          Add
                        </button>


                        <button
                          type="button"
                          className="role-cancel-button"
                          onClick={() => {

                            setCreatingRole(false)
                            setNewRole("")

                          }}
                        >
                          Cancel
                        </button>

                      </div>

                    </div>

                  )}

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


                {/* ACCESS LEVEL */}

                <div className="users-form-field">

                  <label className="users-form-label">
                    Access level
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
                      Sales Rep
                    </option>

                    <option value={2}>
                      Manager
                    </option>

                    <option value={3}>
                      Senior Management
                    </option>

                    <option value={4}>
                      Administrator
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
                      Inactive users remain in the
                      system but should not have active
                      CRM access.
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
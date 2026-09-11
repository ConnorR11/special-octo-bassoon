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

  const [expandedManagers, setExpandedManagers] = useState({})


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
     CURRENT ROLES
  ======================================================= */

  const roles = useMemo(() => {

    return [
      ...new Set(
        users
          .map((user) =>
            String(user.role ?? "").trim()
          )
          .filter(Boolean)
      ),
    ].sort((a, b) =>
      a.localeCompare(b)
    )

  }, [users])


  /* =======================================================
     MANAGERS
  ======================================================= */

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


  /* =======================================================
     SEARCH
  ======================================================= */

  const searchedUsers = useMemo(() => {

    const query =
      search
        .toLowerCase()
        .trim()

    if (!query) {
      return users
    }

    return users.filter((user) => {

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
        managerName,
      ]

      return values.some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query)
      )

    })

  }, [users, search])


  /* =======================================================
     VISIBLE USERS
  ======================================================= */

  const visibleUsers = useMemo(() => {

    return searchedUsers.filter((user) => {

      if (showInactive) {
        return true
      }

      return user.active !== false

    })

  }, [searchedUsers, showInactive])


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
     TOGGLE MANAGER
  ======================================================= */

  function toggleManager(managerId) {

    setExpandedManagers((current) => ({
      ...current,
      [managerId]:
        !current[managerId],
    }))

  }


  /* =======================================================
     BUILD REPORTING TREE
  ======================================================= */

  const reportingTree = useMemo(() => {

    /*
      A manager is someone who has at least
      one user reporting to them.

      We use ALL users to establish the hierarchy,
      not just visible users.

      This is important because if an inactive
      manager is hidden, their active staff still
      need to retain their relationship.
    */

    const childrenMap = {}

    users.forEach((user) => {

      const managerId =
        user.manager_id

      if (!managerId) {
        return
      }

      if (!childrenMap[managerId]) {
        childrenMap[managerId] = []
      }

      childrenMap[managerId].push(user)

    })


    /*
      Find top-level users.

      These are users with no manager.
    */

    const topLevelUsers =
      visibleUsers.filter(
        (user) =>
          !user.manager_id
      )


    /*
      Find managers that have
      visible direct reports.
    */

    const managerUsers =
      users
        .filter((user) => {

          const reports =
            childrenMap[user.id] || []

          return reports.some(
            (report) =>
              visibleUsers.some(
                (visible) =>
                  visible.id === report.id
              )
          )

        })
        .filter((user) => {

          /*
            If inactive users are hidden,
            do not show inactive managers.

            However, active users reporting
            to them remain visible as top-level
            "unassigned" reporting groups.
          */

          if (!showInactive) {
            return user.active !== false
          }

          return true

        })
        .filter((user) => {

          /*
            Search should also be respected.
          */

          return searchedUsers.some(
            (searched) =>
              searched.id === user.id
          ) ||
          (childrenMap[user.id] || [])
            .some((child) =>
              visibleUsers.some(
                (visible) =>
                  visible.id === child.id
              )
            )

        })
        .sort((a, b) =>
          display(a.full_name)
            .localeCompare(
              display(b.full_name)
            )
        )


    return {
      childrenMap,
      managerUsers,
      topLevelUsers,
    }

  }, [
    users,
    visibleUsers,
    searchedUsers,
    showInactive,
  ])


  /* =======================================================
     BRANCH GROUPING
  ======================================================= */

  function getBranchGroups(managerId) {

    const reports =
      reportingTree.childrenMap[managerId] || []

    const visibleReports =
      reports.filter((report) =>
        visibleUsers.some(
          (user) =>
            user.id === report.id
        )
      )


    const groups = {}

    visibleReports.forEach((user) => {

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
      .sort(([branchA], [branchB]) =>
        branchA.localeCompare(branchB)
      )
      .map(([branch, branchUsers]) => ({

        branch,

        users:
          branchUsers.sort((a, b) =>
            display(a.full_name)
              .localeCompare(
                display(b.full_name)
              )
          ),

      }))

  }


  /* =======================================================
     USER CARD
  ======================================================= */

  function UserCard({ user, compact = false }) {

    return (

      <div
        className={[
          "report-user-card",
          user.active === false
            ? "inactive"
            : "",
          compact
            ? "compact"
            : "",
        ].join(" ")}
      >

        <div className="report-user-avatar">

          <UserRound size={17} />

        </div>


        <div className="report-user-main">

          <div className="report-user-name">

            {display(
              user.full_name,
              "Unnamed user"
            )}

          </div>


          <div className="report-user-meta">

            <span>
              {display(
                user.role,
                "No role"
              )}
            </span>

            <span className="report-meta-divider">
              •
            </span>

            <span>
              {display(
                user.branch,
                "No branch"
              )}
            </span>

          </div>


          {!compact && (

            <div className="report-user-details">

              <span className="report-detail">

                <strong>
                  Permission
                </strong>

                {getPermissionLabel(
                  user.permission_level
                )}

              </span>


              <span className="report-detail">

                <strong>
                  Manager
                </strong>

                {getManagerName(
                  user.manager_id
                )}

              </span>


              <span
                className={[
                  "report-status",
                  user.active === false
                    ? "inactive"
                    : "active",
                ].join(" ")}
              >

                {user.active !== false ? (
                  <>
                    <Check size={11} />
                    Active
                  </>
                ) : (
                  <>
                    <X size={11} />
                    Inactive
                  </>
                )}

              </span>

            </div>

          )}

        </div>


        <button
          type="button"
          className="report-edit-button"
          title="Edit user"
          onClick={() =>
            openEditUser(user)
          }
        >

          <Pencil size={13} />

        </button>

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

          padding:
            24px;

          box-sizing:
            border-box;
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

          margin-bottom:
            20px;
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


        .users-refresh {
          display: inline-flex;

          align-items: center;

          gap: 6px;

          height: 38px;

          padding:
            0 12px;

          border:
            1px solid #dfe4e8;

          border-radius: 7px;

          background: #fff;

          color: #64748b;

          font-family: inherit;

          font-size: 10px;

          font-weight: 700;

          cursor: pointer;
        }


        .users-refresh:hover {
          background: #f8fafb;
        }


        .users-refresh:disabled {
          opacity: .5;

          cursor: default;
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
           MAIN CARD
        ================================================= */

        .users-card {
          background: #fff;

          border:
            1px solid #e1e5ea;

          border-radius: 10px;

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

          gap: 14px;

          padding:
            12px 14px;

          border-bottom:
            1px solid #e7eaee;
        }


        .users-toolbar-left {
          display: flex;

          align-items: center;

          gap: 10px;

          min-width: 0;

          flex: 1;
        }


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

          box-sizing:
            border-box;
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

        .inactive-toggle {
          display: inline-flex;

          align-items: center;

          gap: 8px;

          height: 34px;

          padding:
            0 10px;

          border:
            1px solid #dfe4e9;

          border-radius: 6px;

          background: #fff;

          color: #596575;

          font-family: inherit;

          font-size: 10px;

          font-weight: 650;

          cursor: pointer;

          white-space:
            nowrap;
        }


        .inactive-toggle:hover {
          background: #f8fafb;
        }


        .inactive-toggle-dot {
          width: 8px;

          height: 8px;

          border-radius: 50%;

          background: #cbd2d9;

          transition:
            .2s;
        }


        .inactive-toggle.active
        .inactive-toggle-dot {
          background: #2499ed;
        }


        .inactive-toggle.active {
          color: #2679b3;

          border-color:
            #c5e3f8;

          background:
            #f4faff;
        }


        .users-count {
          color: #8a95a1;

          font-size: 10px;

          white-space:
            nowrap;
        }


        /* =================================================
           REPORTING TREE
        ================================================= */

        .reporting-tree {
          padding:
            18px;
        }


        .tree-manager {
          border:
            1px solid #e1e6eb;

          border-radius: 9px;

          background: #fff;

          margin-bottom:
            12px;

          overflow: hidden;
        }


        .tree-manager:last-child {
          margin-bottom: 0;
        }


        /* =================================================
           MANAGER HEADER
        ================================================= */

        .tree-manager-header {
          display: flex;

          align-items: center;

          gap: 12px;

          width: 100%;

          padding:
            13px 14px;

          box-sizing:
            border-box;

          border: 0;

          background:
            linear-gradient(
              to right,
              #f7fafc,
              #ffffff
            );

          text-align: left;

          cursor: pointer;
        }


        .tree-manager-header:hover {
          background:
            #f5f9fc;
        }


        .tree-expand {
          width: 24px;

          height: 24px;

          display: flex;

          align-items: center;

          justify-content: center;

          flex-shrink: 0;

          border-radius: 5px;

          color: #718096;
        }


        .tree-manager-avatar {
          width: 36px;

          height: 36px;

          display: flex;

          align-items: center;

          justify-content: center;

          flex-shrink: 0;

          border-radius: 8px;

          background:
            #eaf5fd;

          color:
            #2679b3;
        }


        .tree-manager-info {
          flex: 1;

          min-width: 0;
        }


        .tree-manager-name {
          font-size: 13px;

          font-weight: 750;

          color: #172033;

          line-height: 1.2;
        }


        .tree-manager-meta {
          display: flex;

          align-items: center;

          gap: 7px;

          margin-top: 4px;

          color: #7b8794;

          font-size: 9px;
        }


        .tree-manager-role {
          font-weight: 650;

          color: #596575;
        }


        .tree-manager-branch {
          color: #8a95a1;
        }


        .tree-manager-count {
          display: inline-flex;

          align-items: center;

          justify-content: center;

          min-width: 24px;

          height: 22px;

          padding:
            0 7px;

          border-radius: 12px;

          background:
            #eef7ff;

          color:
            #2679b3;

          font-size: 9px;

          font-weight: 750;
        }


        .tree-manager-edit {
          width: 29px;

          height: 29px;

          display: flex;

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


        .tree-manager-edit:hover {
          background:
            #f5f8fa;

          color:
            #172033;
        }


        /* =================================================
           TREE CONTENT
        ================================================= */

        .tree-manager-content {
          padding:
            0 16px 16px 54px;

          border-top:
            1px solid #edf0f3;
        }


        .tree-branch {
          margin-top:
            14px;
        }


        .tree-branch-header {
          display: flex;

          align-items: center;

          gap: 7px;

          margin-bottom:
            7px;

          color: #687585;

          font-size: 9px;

          font-weight: 800;

          letter-spacing:
            .04em;

          text-transform:
            uppercase;
        }


        .tree-branch-line {
          height: 1px;

          flex: 1;

          background:
            #edf0f3;
        }


        .tree-branch-count {
          color: #9aa4ae;

          font-weight: 600;

          letter-spacing: 0;

          text-transform:
            none;
        }


        /* =================================================
           USER CARDS
        ================================================= */

        .report-user-list {
          display: grid;

          grid-template-columns:
            repeat(
              auto-fit,
              minmax(
                320px,
                1fr
              )
            );

          gap: 8px;
        }


        .report-user-card {
          position: relative;

          display: flex;

          align-items: center;

          gap: 10px;

          min-width: 0;

          padding:
            10px 11px;

          border:
            1px solid #e6eaee;

          border-radius: 7px;

          background: #fff;

          box-sizing:
            border-box;
        }


        .report-user-card:hover {
          border-color:
            #d4e5ef;

          background:
            #fbfdfe;
        }


        .report-user-card.inactive {
          opacity: .68;

          background:
            #fafafa;
        }


        .report-user-card.compact {
          padding:
            9px 10px;
        }


        .report-user-avatar {
          width: 31px;

          height: 31px;

          display: flex;

          align-items: center;

          justify-content: center;

          flex-shrink: 0;

          border-radius: 7px;

          background:
            #f1f4f6;

          color:
            #667382;
        }


        .report-user-main {
          flex: 1;

          min-width: 0;
        }


        .report-user-name {
          color:
            #172033;

          font-size: 11px;

          font-weight: 750;

          white-space:
            nowrap;

          overflow:
            hidden;

          text-overflow:
            ellipsis;
        }


        .report-user-meta {
          display: flex;

          align-items: center;

          gap: 5px;

          margin-top: 3px;

          color:
            #7b8794;

          font-size: 9px;

          white-space:
            nowrap;

          overflow:
            hidden;
        }


        .report-user-meta span:first-child {
          overflow:
            hidden;

          text-overflow:
            ellipsis;
        }


        .report-meta-divider {
          color:
            #c4cbd2;
        }


        .report-user-details {
          display: flex;

          align-items: center;

          gap: 12px;

          margin-top: 6px;

          flex-wrap: wrap;
        }


        .report-detail {
          display: flex;

          align-items: center;

          gap: 4px;

          color:
            #7b8794;

          font-size: 8px;
        }


        .report-detail strong {
          color:
            #a0a9b3;

          font-weight:
            700;
        }


        .report-status {
          display: inline-flex;

          align-items: center;

          gap: 3px;

          font-size: 8px;

          font-weight: 700;
        }


        .report-status.active {
          color:
            #34804a;
        }


        .report-status.inactive {
          color:
            #a06464;
        }


        .report-edit-button {
          width: 28px;

          height: 28px;

          display: flex;

          align-items: center;

          justify-content: center;

          flex-shrink: 0;

          border:
            1px solid #e0e4e8;

          border-radius: 6px;

          background:
            #fff;

          color:
            #7b8794;

          cursor: pointer;
        }


        .report-edit-button:hover {
          color:
            #172033;

          background:
            #f5f8fa;
        }


        /* =================================================
           TOP LEVEL
        ================================================= */

        .tree-top-level {
          margin-top:
            14px;

          padding-top:
            14px;

          border-top:
            1px dashed #dfe5e9;
        }


        .tree-top-level-title {
          margin-bottom:
            8px;

          color:
            #687585;

          font-size: 9px;

          font-weight: 800;

          letter-spacing:
            .04em;

          text-transform:
            uppercase;
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


        .users-empty-title {
          color:
            #64748b;

          font-size:
            13px;

          font-weight:
            700;

          margin-bottom:
            5px;
        }


        .users-empty-description {
          color:
            #9aa4ae;

          font-size:
            10px;
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
            rgba(
              15,
              23,
              42,
              .38
            );
        }


        .users-modal {
          width: 100%;

          max-width: 560px;

          max-height:
            calc(100vh - 40px);

          background:
            #fff;

          border-radius:
            10px;

          box-shadow:
            0 20px 60px
            rgba(
              0,
              0,
              0,
              .20
            );

          overflow:
            auto;
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
          width: 30px;

          height: 30px;

          display: flex;

          align-items: center;

          justify-content: center;

          border: 0;

          border-radius: 6px;

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
              minmax(
                0,
                1fr
              )
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
            rgba(
              36,
              153,
              237,
              .10
            );
        }


        /* =================================================
           ACTIVE SWITCH
        ================================================= */

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
            rgba(
              0,
              0,
              0,
              .18
            );
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

        @media (max-width: 800px) {

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


          .users-header-actions {
            width:
              100%;
          }


          .users-add-button,
          .users-refresh {
            flex:
              0 0 auto;
          }


          .users-toolbar {
            align-items:
              stretch;

            flex-direction:
              column;
          }


          .users-toolbar-left {
            flex-direction:
              column;

            align-items:
              stretch;
          }


          .users-search {
            width:
              100%;
          }


          .inactive-toggle {
            justify-content:
              center;
          }


          .reporting-tree {
            padding:
              12px;
          }


          .tree-manager-content {
            padding:
              0 10px 12px 10px;
          }


          .report-user-list {
            grid-template-columns:
              1fr;
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
            className="users-refresh"
            onClick={loadUsers}
            disabled={loading}
          >

            <RefreshCw size={13} />

            {loading
              ? "Loading..."
              : "Refresh"}

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
          MAIN CARD
      ===================================================== */}

      <div className="users-card">


        {/* ===================================================
            TOOLBAR
        =================================================== */}

        <div className="users-toolbar">

          <div className="users-toolbar-left">

            <div className="users-search">

              <Search size={14} />

              <input
                type="text"
                placeholder="Search users, roles, branches or managers..."
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
              />

            </div>


            <button
              type="button"
              className={[
                "inactive-toggle",
                showInactive
                  ? "active"
                  : "",
              ].join(" ")}
              onClick={() =>
                setShowInactive(
                  (current) =>
                    !current
                )
              }
            >

              <span className="inactive-toggle-dot" />

              {showInactive
                ? "Showing inactive"
                : "Show inactive"}

            </button>

          </div>


          <div className="users-count">

            {visibleUsers.length}
            {" "}
            {visibleUsers.length === 1
              ? "user"
              : "users"}

          </div>

        </div>


        {/* ===================================================
            REPORTING TREE
        =================================================== */}

        <div className="reporting-tree">


          {loading ? (

            <div className="users-empty">

              Loading users...

            </div>

          ) : reportingTree.managerUsers.length === 0 &&
            reportingTree.topLevelUsers.length === 0 ? (

            <div className="users-empty">

              <div className="users-empty-title">
                No users found
              </div>

              <div className="users-empty-description">

                Try changing your search or
                enabling inactive users.

              </div>

            </div>

          ) : (

            <>

              {/* =================================================
                  MANAGERS
              ================================================= */}

              {reportingTree.managerUsers.map(
                (manager) => {

                  const branchGroups =
                    getBranchGroups(
                      manager.id
                    )

                  const reports =
                    reportingTree.childrenMap[
                      manager.id
                    ] || []

                  const visibleReports =
                    reports.filter((report) =>
                      visibleUsers.some(
                        (user) =>
                          user.id ===
                          report.id
                      )
                    )


                  const expanded =
                    expandedManagers[
                      manager.id
                    ] !== false


                  return (

                    <div
                      className="tree-manager"
                      key={manager.id}
                    >


                      {/* MANAGER HEADER */}

                      <div className="tree-manager-header">


                        <button
                          type="button"
                          className="tree-expand"
                          onClick={() =>
                            toggleManager(
                              manager.id
                            )
                          }
                        >

                          {expanded ? (
                            <ChevronDown
                              size={15}
                            />
                          ) : (
                            <ChevronRight
                              size={15}
                            />
                          )}

                        </button>


                        <div className="tree-manager-avatar">

                          <UserRound size={18} />

                        </div>


                        <div
                          className="tree-manager-info"
                          onClick={() =>
                            toggleManager(
                              manager.id
                            )
                          }
                        >

                          <div className="tree-manager-name">

                            {display(
                              manager.full_name,
                              "Unnamed user"
                            )}

                          </div>


                          <div className="tree-manager-meta">

                            <span className="tree-manager-role">

                              {display(
                                manager.role,
                                "No role"
                              )}

                            </span>


                            <span>
                              •
                            </span>


                            <span className="tree-manager-branch">

                              {display(
                                manager.branch,
                                "No branch"
                              )}

                            </span>

                          </div>

                        </div>


                        <div className="tree-manager-count">

                          {visibleReports.length}

                        </div>


                        <button
                          type="button"
                          className="tree-manager-edit"
                          title="Edit manager"
                          onClick={() =>
                            openEditUser(
                              manager
                            )
                          }
                        >

                          <Pencil size={13} />

                        </button>

                      </div>


                      {/* MANAGER CONTENT */}

                      {expanded && (

                        <div className="tree-manager-content">

                          {branchGroups.map(
                            (group) => (

                              <div
                                className="tree-branch"
                                key={
                                  group.branch
                                }
                              >


                                <div className="tree-branch-header">

                                  <span>
                                    {group.branch}
                                  </span>

                                  <span className="tree-branch-count">

                                    {group.users.length}
                                    {" "}
                                    {group.users.length === 1
                                      ? "user"
                                      : "users"}

                                  </span>

                                  <span className="tree-branch-line" />

                                </div>


                                <div className="report-user-list">

                                  {group.users.map(
                                    (user) => (

                                      <UserCard
                                        key={
                                          user.id
                                        }
                                        user={
                                          user
                                        }
                                      />

                                    )
                                  )}

                                </div>

                              </div>

                            )
                          )}

                        </div>

                      )}

                    </div>

                  )

                }
              )}


              {/* =================================================
                  TOP LEVEL / NO MANAGER
              ================================================= */}

              {reportingTree.topLevelUsers.length > 0 && (

                <div className="tree-top-level">

                  <div className="tree-top-level-title">

                    No manager / top level

                  </div>


                  <div className="report-user-list">

                    {reportingTree.topLevelUsers
                      .sort((a, b) =>
                        display(
                          a.full_name
                        ).localeCompare(
                          display(
                            b.full_name
                          )
                        )
                      )
                      .map((user) => (

                        <UserCard
                          key={user.id}
                          user={user}
                        />

                      ))}

                  </div>

                </div>

              )}

            </>

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
                      No role
                    </option>


                    {roles.map((role) => (

                      <option
                        key={role}
                        value={role}
                      >
                        {role}
                      </option>

                    ))}


                    {form.role &&
                      !roles.includes(
                        form.role
                      ) && (

                        <option
                          value={
                            form.role
                          }
                        >
                          {form.role}
                        </option>

                      )}

                  </select>

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
                      .map((manager) => (

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
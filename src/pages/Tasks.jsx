import React, { useEffect, useMemo, useState } from "react"
import { Check, CirclePlus, ClipboardList, Pencil, Trash2, X } from "lucide-react"
import { supabase } from "../lib/supabase"

const STATUS_OPTIONS = [["todo", "To do"], ["in_progress", "In progress"], ["done", "Done"]]
const PRIORITY_OPTIONS = [["low", "Low"], ["medium", "Medium"], ["high", "High"]]
const CATEGORY_OPTIONS = [["development", "Development"], ["general", "General"]]

function personName(profile) {
  return profile?.display_name || profile?.full_name || profile?.email || "Unassigned"
}

function emptyForm() {
  return { title: "", description: "", status: "todo", priority: "medium", category: "development", assigned_to: "", due_date: "" }
}

export default function Tasks() {
  const [tasks, setTasks] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm())

  async function loadData() {
    setLoading(true)
    setError("")
    try {
      const [{ data: taskData, error: taskError }, { data: profileData, error: profileError }] = await Promise.all([
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, display_name, email, active").eq("active", true).order("full_name", { ascending: true }),
      ])
      if (taskError) throw taskError
      if (profileError) throw profileError
      setTasks(taskData || [])
      setProfiles(profileData || [])
    } catch (err) {
      console.error("Error loading tasks:", err)
      setError(err?.message || "Unable to load tasks.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles])

  const filteredTasks = useMemo(() => {
    const term = search.trim().toLowerCase()
    return tasks.filter((task) => {
      if (filter !== "all" && task.status !== filter) return false
      if (categoryFilter !== "all" && task.category !== categoryFilter) return false
      if (!term) return true
      const assignee = profileMap.get(task.assigned_to)
      return [task.title, task.description, task.category, task.status, assignee?.full_name, assignee?.display_name, assignee?.email]
        .filter(Boolean).join(" ").toLowerCase().includes(term)
    })
  }, [tasks, filter, categoryFilter, search, profileMap])

  const counts = useMemo(() => ({
    all: tasks.length,
    todo: tasks.filter((task) => task.status === "todo").length,
    in_progress: tasks.filter((task) => task.status === "in_progress").length,
    done: tasks.filter((task) => task.status === "done").length,
  }), [tasks])

  function startNewTask() {
    setEditingId(null); setForm(emptyForm()); setError(""); setShowForm(true)
  }

  function startEdit(task) {
    setEditingId(task.id)
    setForm({ title: task.title || "", description: task.description || "", status: task.status || "todo", priority: task.priority || "medium", category: task.category || "development", assigned_to: task.assigned_to || "", due_date: task.due_date || "" })
    setError(""); setShowForm(true)
  }

  function closeForm() {
    if (saving) return
    setShowForm(false); setEditingId(null); setForm(emptyForm())
  }

  function setField(field, value) { setForm((current) => ({ ...current, [field]: value })) }

  async function saveTask(event) {
    event.preventDefault()
    if (!form.title.trim() || saving) return
    setSaving(true); setError("")
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      const { data: creator, error: creatorError } = await supabase.from("profiles").select("id").eq("auth_user_id", userData?.user?.id).maybeSingle()
      if (creatorError) throw creatorError
      const payload = { title: form.title.trim(), description: form.description.trim() || null, status: form.status, priority: form.priority, category: form.category, assigned_to: form.assigned_to || null, due_date: form.due_date || null }
      if (editingId) {
        const { data, error: updateError } = await supabase.from("tasks").update(payload).eq("id", editingId).select("*").single()
        if (updateError) throw updateError
        setTasks((current) => current.map((task) => task.id === editingId ? data : task))
      } else {
        const { data, error: insertError } = await supabase.from("tasks").insert({ ...payload, created_by: creator?.id || null }).select("*").single()
        if (insertError) throw insertError
        setTasks((current) => [data, ...current])
      }
      closeForm()
    } catch (err) {
      console.error("Error saving task:", err)
      setError(err?.message || "Unable to save task.")
    } finally { setSaving(false) }
  }

  async function toggleDone(task) {
    try {
      const { data, error: updateError } = await supabase.from("tasks").update({ status: task.status === "done" ? "todo" : "done" }).eq("id", task.id).select("*").single()
      if (updateError) throw updateError
      setTasks((current) => current.map((item) => item.id === task.id ? data : item))
    } catch (err) { setError(err?.message || "Unable to update task.") }
  }

  async function deleteTask(task) {
    if (!window.confirm(`Delete task "${task.title}"?`)) return
    try {
      const { error: deleteError } = await supabase.from("tasks").delete().eq("id", task.id)
      if (deleteError) throw deleteError
      setTasks((current) => current.filter((item) => item.id !== task.id))
    } catch (err) { setError(err?.message || "Unable to delete task.") }
  }

  return (
    <div style={{ padding: "24px 28px 40px", background: "#f5f7fa", minHeight: "calc(100vh - 64px)" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: "#172554", color: "#fff", display: "grid", placeItems: "center" }}><ClipboardList size={19} /></div>
            <div><h1 style={{ margin: 0, color: "#172033", fontSize: 22 }}>Tasks</h1><p style={{ margin: "4px 0 0", color: "#7b8794", fontSize: 12 }}>Development tasks now, general tasks later.</p></div>
          </div>
          <button type="button" onClick={startNewTask} style={primaryButton}><CirclePlus size={16} />New task</button>
        </div>

        {error && <div style={errorBox}>{error}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginBottom: 18 }}>
          <SummaryCard label="All tasks" value={counts.all} active={filter === "all"} onClick={() => setFilter("all")} />
          <SummaryCard label="To do" value={counts.todo} active={filter === "todo"} onClick={() => setFilter("todo")} />
          <SummaryCard label="In progress" value={counts.in_progress} active={filter === "in_progress"} onClick={() => setFilter("in_progress")} />
          <SummaryCard label="Completed" value={counts.done} active={filter === "done"} onClick={() => setFilter("done")} />
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks..." style={{ ...inputStyle, flex: "1 1 260px" }} />
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} style={selectStyle}><option value="all">All categories</option>{CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
          {loading ? <div style={emptyState}>Loading tasks...</div> : filteredTasks.length === 0 ? (
            <div style={emptyState}><ClipboardList size={30} color="#aab4c0" /><strong>No tasks yet</strong><span>Create your first task with the New task button.</span></div>
          ) : (
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead><tr style={{ background: "#f8fafc" }}>{["", "Task", "Category", "Priority", "Assigned to", "Due", "Status", ""].map((heading, index) => <th key={`${heading}-${index}`} style={thStyle}>{heading}</th>)}</tr></thead>
              <tbody>{filteredTasks.map((task) => {
                const assignee = profileMap.get(task.assigned_to)
                return <tr key={task.id} style={{ borderTop: "1px solid #eef2f6" }}>
                  <td style={{ ...tdStyle, width: 44 }}><button type="button" onClick={() => toggleDone(task)} title={task.status === "done" ? "Reopen task" : "Complete task"} style={{ ...iconButton, color: task.status === "done" ? "#16a34a" : "#94a3b8" }}><Check size={17} /></button></td>
                  <td style={tdStyle}><div style={{ fontWeight: 700, color: task.status === "done" ? "#94a3b8" : "#172033", textDecoration: task.status === "done" ? "line-through" : "none" }}>{task.title}</div>{task.description && <div style={{ marginTop: 3, color: "#7b8794", fontSize: 11, maxWidth: 520 }}>{task.description}</div>}</td>
                  <td style={tdStyle}><Badge text={task.category === "development" ? "Development" : "General"} tone="blue" /></td>
                  <td style={tdStyle}><Badge text={task.priority} tone={task.priority === "high" ? "red" : task.priority === "low" ? "gray" : "amber"} /></td>
                  <td style={tdStyle}>{personName(assignee)}</td>
                  <td style={tdStyle}>{task.due_date ? new Date(`${task.due_date}T00:00:00`).toLocaleDateString("en-GB") : "—"}</td>
                  <td style={tdStyle}><Badge text={STATUS_OPTIONS.find(([value]) => value === task.status)?.[1] || task.status} tone={task.status === "done" ? "green" : task.status === "in_progress" ? "purple" : "gray"} /></td>
                  <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}><button type="button" onClick={() => startEdit(task)} style={iconButton} title="Edit"><Pencil size={15} /></button><button type="button" onClick={() => deleteTask(task)} style={{ ...iconButton, marginLeft: 5, color: "#b91c1c" }} title="Delete"><Trash2 size={15} /></button></td>
                </tr>
              })}</tbody>
            </table></div>
          )}
        </div>
      </div>

      {showForm && <div style={modalBackdrop}><div style={modal}>
        <div style={{ padding: "17px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><h2 style={{ margin: 0, fontSize: 16, color: "#172033" }}>{editingId ? "Edit task" : "New task"}</h2><p style={{ margin: "4px 0 0", color: "#8a94a3", fontSize: 10 }}>Create and track CRM work from one place.</p></div><button type="button" onClick={closeForm} style={closeButton}><X size={18} /></button></div>
        <form onSubmit={saveTask} style={{ padding: 20 }}>
          <label style={labelStyle}>Task title<input required value={form.title} onChange={(event) => setField("title", event.target.value)} style={inputStyle} placeholder="e.g. Fix appointment visibility" /></label>
          <label style={labelStyle}>Description<textarea value={form.description} onChange={(event) => setField("description", event.target.value)} style={{ ...inputStyle, height: 90, paddingTop: 10, resize: "vertical" }} placeholder="Add notes or acceptance criteria..." /></label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
            <label style={labelStyle}>Status<select value={form.status} onChange={(event) => setField("status", event.target.value)} style={selectStyle}>{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label style={labelStyle}>Priority<select value={form.priority} onChange={(event) => setField("priority", event.target.value)} style={selectStyle}>{PRIORITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label style={labelStyle}>Category<select value={form.category} onChange={(event) => setField("category", event.target.value)} style={selectStyle}>{CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label style={labelStyle}>Assigned to<select value={form.assigned_to} onChange={(event) => setField("assigned_to", event.target.value)} style={selectStyle}><option value="">Unassigned</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{personName(profile)}</option>)}</select></label>
            <label style={{ ...labelStyle, gridColumn: "1/-1" }}>Due date<input type="date" value={form.due_date} onChange={(event) => setField("due_date", event.target.value)} style={inputStyle} /></label>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20, paddingTop: 14, borderTop: "1px solid #eef2f6" }}><button type="button" onClick={closeForm} style={secondaryButton}>Cancel</button><button type="submit" disabled={saving || !form.title.trim()} style={{ ...primaryButton, opacity: saving ? 0.65 : 1 }}>{saving ? "Saving..." : editingId ? "Save changes" : "Create task"}</button></div>
        </form>
      </div></div>}
    </div>
  )
}

function SummaryCard({ label, value, active, onClick }) {
  return <button type="button" onClick={onClick} style={{ textAlign: "left", border: `1px solid ${active ? "#b9d7f0" : "#e2e8f0"}`, background: active ? "#f0f8ff" : "#fff", borderRadius: 10, padding: "13px 15px", cursor: "pointer" }}><div style={{ color: "#7b8794", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div><div style={{ color: "#172033", fontSize: 23, fontWeight: 800, marginTop: 4 }}>{value}</div></button>
}

function Badge({ text, tone }) {
  const tones = { blue: ["#eaf4ff", "#1769aa"], red: ["#fef2f2", "#b91c1c"], amber: ["#fff7ed", "#c2410c"], gray: ["#f1f5f9", "#64748b"], green: ["#ecfdf3", "#15803d"], purple: ["#f5f3ff", "#6d28d9"] }
  const [background, color] = tones[tone] || tones.gray
  return <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "4px 8px", background, color, fontSize: 9, fontWeight: 800, textTransform: "capitalize" }}>{text}</span>
}

const primaryButton = { height: 38, padding: "0 13px", border: 0, borderRadius: 7, background: "#172554", color: "#fff", display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "inherit", fontSize: 11, fontWeight: 700, cursor: "pointer" }
const secondaryButton = { height: 38, padding: "0 13px", border: "1px solid #d9dee5", borderRadius: 7, background: "#fff", color: "#334155", fontFamily: "inherit", fontSize: 11, fontWeight: 700, cursor: "pointer" }
const inputStyle = { display: "block", width: "100%", height: 38, boxSizing: "border-box", marginTop: 6, border: "1px solid #d9dee5", borderRadius: 7, padding: "0 10px", fontFamily: "inherit", fontSize: 12, color: "#172033", background: "#fff" }
const selectStyle = { ...inputStyle, cursor: "pointer" }
const labelStyle = { display: "block", marginBottom: 13, fontSize: 10, fontWeight: 700, color: "#555" }
const thStyle = { padding: "10px 12px", textAlign: "left", color: "#7b8794", fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".04em" }
const tdStyle = { padding: "11px 12px", color: "#334155", fontSize: 11, verticalAlign: "middle" }
const iconButton = { border: 0, background: "transparent", padding: 5, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#64748b", cursor: "pointer", borderRadius: 5 }
const emptyState = { minHeight: 220, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7, color: "#8a94a3", fontSize: 11 }
const errorBox = { marginBottom: 14, padding: 10, borderRadius: 7, background: "#fef2f2", color: "#991b1b", fontSize: 11 }
const modalBackdrop = { position: "fixed", inset: 0, zIndex: 1500, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }
const modal = { width: "100%", maxWidth: 600, maxHeight: "90vh", overflow: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,.25)" }
const closeButton = { border: 0, background: "transparent", color: "#64748b", cursor: "pointer", padding: 5 }

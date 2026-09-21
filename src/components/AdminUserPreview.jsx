import React, { useEffect, useState } from "react"
import { Eye, X } from "lucide-react"
import { supabase } from "../lib/supabase"

export default function AdminUserPreview({ activeUser, onStart, onStop }) {
  const [users, setUsers] = useState([])
  const [selectedId, setSelectedId] = useState("")
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.from("profiles").select("id, full_name, display_name, email, role, permission_level, branch, active").order("full_name", { ascending: true }).then(({ data, error }) => {
      if (error) console.error("Unable to load users for preview:", error)
      else setUsers((data || []).filter((user) => user.active !== false && user.email))
    })
  }, [])

  useEffect(() => {
    if (activeUser) setSelectedId(String(activeUser.id))
  }, [activeUser])

  if (activeUser) {
    return <div style={{ margin: "0 24px 12px", padding: "10px 14px", borderRadius: 8, background: "#fff4d6", border: "1px solid #f0d27a", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, color: "#684d03", fontSize: 12, fontWeight: 600 }}><span><strong>Viewing as {activeUser.full_name || activeUser.email}</strong> · {activeUser.role || "User"} · Permission {activeUser.permission_level ?? 1}</span><button type="button" onClick={onStop} style={{ display: "inline-flex", alignItems: "center", gap: 5, border: 0, borderRadius: 6, padding: "6px 9px", background: "#684d03", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 700 }}><X size={13} /> Exit preview</button></div>
  }

  return <div style={{ position: "fixed", right: 170, top: 74, zIndex: 900, width: 180, background: "#fff", border: "1px solid #dfe3e8", borderRadius: 9, boxShadow: "0 8px 28px rgba(0,0,0,.12)" }}><button type="button" onClick={() => setOpen((value) => !value)} style={{ width: "100%", height: 40, border: 0, borderRadius: 9, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "0 12px", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#172033", whiteSpace: "nowrap" }}><Eye size={15} /> View CRM as user</button>{open && <div style={{ position: "absolute", top: 44, right: 0, width: 260, padding: "10px 12px", border: "1px solid #eee", borderRadius: 8, background: "#fff", boxShadow: "0 8px 28px rgba(0,0,0,.12)" }}><select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={{ width: "100%", height: 34, border: "1px solid #d9dadd", borderRadius: 6, padding: "0 8px", fontSize: 11 }}><option value="">Select user...</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.email} · {user.role || "User"}</option>)}</select><button type="button" disabled={!selectedId} onClick={() => { const user = users.find((item) => String(item.id) === selectedId); if (user) { onStart(user); setOpen(false) } }} style={{ width: "100%", marginTop: 8, height: 34, border: 0, borderRadius: 6, background: selectedId ? "#172554" : "#cbd5e1", color: "#fff", cursor: selectedId ? "pointer" : "default", fontSize: 11, fontWeight: 700 }}>Start preview</button></div>}</div>
}

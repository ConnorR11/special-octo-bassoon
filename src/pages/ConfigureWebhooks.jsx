import React, { useEffect, useMemo, useState } from "react"
import { Plus, Trash2, RefreshCw, Save, Webhook, ArrowRight, CheckCircle2 } from "lucide-react"
import { supabase } from "../lib/supabase"

const CRM_FIELDS = [
  { value: "customer_name", label: "Customer Name", type: "text" },
  { value: "installation_start_date", label: "Installation Start Date", type: "date" },
  { value: "fit_team_1", label: "Fit Team", type: "text" },
  { value: "installation_issues_fit_team", label: "Installation Issues – Fit Team", type: "text" },
  { value: "installations_issues_start_date", label: "Installation Issues – Start Date", type: "date" },
  { value: "pipedrive_stage", label: "Pipedrive Stage", type: "text" },
]

function ConfigureWebhooks() {
  const [pipedriveFields, setPipedriveFields] = useState([])
  const [mappings, setMappings] = useState([])
  const [loading, setLoading] = useState(true)
  const [fieldsLoading, setFieldsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function loadMappings() {
    if (!supabase) return
    const { data, error: loadError } = await supabase.from("pipedrive_webhook_mappings").select("*").order("created_at", { ascending: true })
    if (loadError) throw loadError
    setMappings(data || [])
  }

  async function loadPipedriveFields() {
    setFieldsLoading(true)
    setError("")
    try {
      const response = await fetch("/api/pipedrive-webhooks/fields")
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.error || "Unable to load Pipedrive fields.")
      setPipedriveFields(json.fields || [])
    } catch (err) {
      setError(err?.message || "Unable to load Pipedrive fields.")
    } finally {
      setFieldsLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        await Promise.all([loadMappings(), loadPipedriveFields()])
      } catch (err) {
        if (mounted) setError(err?.message || "Unable to load webhook configuration.")
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const mappedCrmFields = useMemo(() => new Set(mappings.map((item) => item.crm_column)), [mappings])

  function addMapping() {
    const firstAvailable = CRM_FIELDS.find((field) => !mappedCrmFields.has(field.value)) || CRM_FIELDS[0]
    setMappings((current) => [...current, {
      id: `new-${Date.now()}`,
      pipedrive_field_code: "",
      pipedrive_field_name: "",
      pipedrive_field_type: "",
      crm_column: firstAvailable.value,
      enabled: true,
      isNew: true,
    }])
    setMessage("")
  }

  function updateMapping(id, changes) {
    setMappings((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item))
  }

  function removeMapping(id) {
    setMappings((current) => current.filter((item) => item.id !== id))
  }

  function selectPipedriveField(id, code) {
    const field = pipedriveFields.find((item) => item.field_code === code)
    updateMapping(id, {
      pipedrive_field_code: field?.field_code || "",
      pipedrive_field_name: field?.field_name || "",
      pipedrive_field_type: field?.field_type || field?.field_type_name || "",
    })
  }

  async function saveMappings() {
    if (!supabase) return
    setSaving(true)
    setError("")
    setMessage("")
    try {
      const valid = mappings.filter((item) => item.pipedrive_field_code && item.crm_column)
      const duplicateCrm = valid.map((item) => item.crm_column).filter((value, index, array) => array.indexOf(value) !== index)
      if (duplicateCrm.length) throw new Error(`Each CRM field can only have one mapping: ${duplicateCrm[0]}.`)

      const { error: deleteError } = await supabase.from("pipedrive_webhook_mappings").delete().neq("id", "00000000-0000-0000-0000-000000000000")
      if (deleteError) throw deleteError
      if (valid.length) {
        const rows = valid.map((item) => ({
          pipedrive_field_code: item.pipedrive_field_code,
          pipedrive_field_name: item.pipedrive_field_name,
          pipedrive_field_type: item.pipedrive_field_type || null,
          crm_column: item.crm_column,
          enabled: item.enabled !== false,
        }))
        const { error: insertError } = await supabase.from("pipedrive_webhook_mappings").insert(rows)
        if (insertError) throw insertError
      }
      await loadMappings()
      setMessage("Webhook mappings saved and active.")
    } catch (err) {
      setError(err?.message || "Unable to save webhook mappings.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section style={{ maxWidth: 1200, margin: "0 auto" }}>
      <style>{`
        .webhook-map-card{background:#fff;border:1px solid #e1e5e9;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
        .webhook-map-table{width:100%;border-collapse:collapse}.webhook-map-table th{background:#f5f7f9;color:#59636e;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;padding:12px;border-bottom:1px solid #e1e5e9}.webhook-map-table td{padding:12px;border-bottom:1px solid #edf0f2;vertical-align:middle}.webhook-map-table tr:last-child td{border-bottom:0}
        .webhook-select{width:100%;height:38px;border:1px solid #d6dce2;border-radius:7px;background:#fff;padding:0 10px;font-size:12px;color:#26323b}.webhook-select:focus{outline:none;border-color:#0b6fa4;box-shadow:0 0 0 2px rgba(11,111,164,.12)}
        .webhook-btn{border:1px solid #d6dce2;border-radius:7px;background:#fff;height:36px;padding:0 12px;display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:600;cursor:pointer}.webhook-btn.primary{background:#006b9b;border-color:#006b9b;color:#fff}.webhook-btn.danger{color:#b42318}.webhook-btn:disabled{opacity:.5;cursor:not-allowed}
        .webhook-badge{display:inline-flex;align-items:center;padding:4px 7px;border-radius:999px;background:#edf7f1;color:#177245;font-size:9px;font-weight:700}
        @media(max-width:800px){.webhook-map-table{min-width:900px}.webhook-scroll{overflow:auto}.webhook-header{flex-direction:column;align-items:flex-start!important;gap:12px!important}}
      `}</style>

      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }} className="webhook-header">
        <div>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}><Webhook size={22} color="#006b9b"/><h1 style={{ margin:0,fontSize:22,color:"#17212b" }}>Configure Webhooks</h1></div>
          <p style={{ margin:"6px 0 0",fontSize:12,color:"#78838d" }}>Map Pipedrive deal fields to CRM fields without changing the webhook code.</p>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <button className="webhook-btn" onClick={loadPipedriveFields} disabled={fieldsLoading}><RefreshCw size={14}/>{fieldsLoading ? "Refreshing..." : "Refresh Pipedrive fields"}</button>
          <button className="webhook-btn primary" onClick={saveMappings} disabled={saving}><Save size={14}/>{saving ? "Saving..." : "Save mappings"}</button>
        </div>
      </div>

      {message && <div style={{ marginBottom:12,padding:"10px 12px",borderRadius:8,background:"#edf7f1",color:"#177245",fontSize:11,display:"flex",alignItems:"center",gap:7 }}><CheckCircle2 size={15}/>{message}</div>}
      {error && <div style={{ marginBottom:12,padding:"10px 12px",borderRadius:8,background:"#fff1f1",color:"#b42318",fontSize:11 }}>{error}</div>}

      <div className="webhook-map-card" style={{ overflow:"hidden" }}>
        <div style={{ padding:"16px 18px",borderBottom:"1px solid #e5e8eb",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div><strong style={{ fontSize:13,color:"#27333d" }}>Pipedrive → CRM mappings</strong><div style={{ fontSize:10,color:"#8a949d",marginTop:3 }}>{mappings.length} mapping{mappings.length === 1 ? "" : "s"} configured</div></div>
          <button className="webhook-btn" onClick={addMapping}><Plus size={14}/> Add mapping</button>
        </div>
        <div className="webhook-scroll">
          <table className="webhook-map-table">
            <thead><tr><th style={{width:"38%"}}>Pipedrive field</th><th></th><th style={{width:"38%"}}>CRM field</th><th style={{width:80}}>Active</th><th style={{width:50}}></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="5" style={{textAlign:"center",padding:40,color:"#8a949d",fontSize:12}}>Loading webhook configuration...</td></tr> : mappings.length === 0 ? <tr><td colSpan="5" style={{textAlign:"center",padding:40,color:"#8a949d",fontSize:12}}>No mappings yet. Add a mapping to configure Pipedrive → CRM synchronisation.</td></tr> : mappings.map((mapping) => (
                <tr key={mapping.id}>
                  <td>
                    <select className="webhook-select" value={mapping.pipedrive_field_code} onChange={(event) => selectPipedriveField(mapping.id,event.target.value)}>
                      <option value="">Select Pipedrive field...</option>
                      {pipedriveFields.map((field) => <option key={field.field_code} value={field.field_code}>{field.field_name}{field.field_type ? ` · ${field.field_type}` : ""}</option>)}
                    </select>
                    {mapping.pipedrive_field_code && <div style={{marginTop:5,fontSize:9,color:"#89939c"}}>Code: {mapping.pipedrive_field_code}</div>}
                  </td>
                  <td style={{textAlign:"center",color:"#9aa3aa"}}><ArrowRight size={16}/></td>
                  <td>
                    <select className="webhook-select" value={mapping.crm_column} onChange={(event) => updateMapping(mapping.id,{crm_column:event.target.value})}>
                      {CRM_FIELDS.map((field) => <option key={field.value} value={field.value}>{field.label} · {field.value}</option>)}
                    </select>
                  </td>
                  <td style={{textAlign:"center"}}><input type="checkbox" checked={mapping.enabled !== false} onChange={(event) => updateMapping(mapping.id,{enabled:event.target.checked})}/></td>
                  <td><button className="webhook-btn danger" title="Remove mapping" onClick={() => removeMapping(mapping.id)}><Trash2 size={14}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{padding:"12px 18px",background:"#fafbfc",borderTop:"1px solid #e8ebee",fontSize:10,color:"#7a858e"}}>
          <span className="webhook-badge">LIVE MAPPING</span> Changes are used by the Pipedrive deal webhook after you save them.
        </div>
      </div>
    </section>
  )
}

export default ConfigureWebhooks

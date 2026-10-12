import React, { useEffect, useState } from "react"
import {
  ArrowLeft,
  Save,
  MapPin,
  ExternalLink,
  FileUp,
  Trash2,
  LoaderCircle,
} from "lucide-react"

import { supabase } from "../lib/supabase"

function formatDate(value) {
  if (!value) return "—"

  const text = String(value).slice(0, 10)
  const parts = text.split("-")

  if (parts.length !== 3) return value

  const [year, month, day] = parts
  return `${day}/${month}/${year}`
}

function CustomerDetail({
  deal,
  onBack,
  onUpdated,
}) {
  const [salesperson, setSalesperson] = useState(
    deal?.salesperson || ""
  )

  const [address, setAddress] = useState(
    deal?.address || ""
  )

  const [postcode, setPostcode] = useState(
    deal?.postcode || ""
  )

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [documents, setDocuments] = useState([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [uploadingCategory, setUploadingCategory] = useState("")
  const [documentError, setDocumentError] = useState("")
  const [documentNotice, setDocumentNotice] = useState("")
  const [openingDocument, setOpeningDocument] = useState("")
  const documentCategories = [
    { key: "survey_video", label: "Survey Video", accept: "video/*", multiple: false, hint: "Common video formats. Maximum 250 MB per file." },
    { key: "survey_photos", label: "Survey Photos", accept: "image/jpeg,image/png,image/webp", multiple: true, hint: "Upload multiple JPG, PNG or WebP photos." },
    { key: "electricity_bill_epvs_waiver", label: "Electricity Bill / EPVS Waiver", accept: "application/pdf,image/jpeg,image/png,image/webp", multiple: true, hint: "Upload a PDF or image. Bill and waiver can be attached separately." },
  ]

  async function loadDocuments() {
    if (!deal?.id || !supabase) return
    setDocumentsLoading(true)
    setDocumentError("")
    try {
      const { data, error } = await supabase.from("deal_documents").select("*").eq("deal_id", deal.id).order("created_at", { ascending: false })
      if (error) throw error
      setDocuments(data || [])
    } catch (err) {
      console.error("Unable to load deal documents:", err)
      setDocumentError(err?.message || "Unable to load deal documents.")
    } finally { setDocumentsLoading(false) }
  }

  useEffect(() => {
    setDocuments([])
    setDocumentNotice("")
    loadDocuments()
  }, [deal?.id])

  async function uploadDocuments(category, fileList) {
    const files = Array.from(fileList || [])
    if (!files.length || !deal?.id) return
    setUploadingCategory(category)
    setDocumentError("")
    setDocumentNotice("")
    let uploadedCount = 0
    try {
      for (const file of files) {
        if (file.size > 250 * 1024 * 1024) throw new Error(`"${file.name}" exceeds the 250 MB upload limit.`)
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-140) || "upload"
        const path = `${deal.id}/${category}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${safeName}`
        const { error: uploadError } = await supabase.storage.from("deal-documents").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false })
        if (uploadError) throw uploadError
        const { data: userData } = await supabase.auth.getUser()
        const { error: metadataError } = await supabase.from("deal_documents").insert({
          deal_id: deal.id, category, file_name: file.name, storage_path: path,
          mime_type: file.type || null, file_size: file.size, uploaded_by: userData?.user?.id || null,
        })
        if (metadataError) {
          await supabase.storage.from("deal-documents").remove([path])
          throw metadataError
        }
        uploadedCount += 1
      }
      setDocumentNotice(`${uploadedCount} file${uploadedCount === 1 ? "" : "s"} uploaded successfully.`)
      await loadDocuments()
    } catch (err) {
      console.error("Unable to upload deal documents:", err)
      setDocumentError(err?.message || "Unable to upload file. Please try again.")
      await loadDocuments()
    } finally { setUploadingCategory("") }
  }

  async function openDocument(document) {
    setOpeningDocument(document.id)
    setDocumentError("")
    try {
      const { data, error } = await supabase.storage.from("deal-documents").createSignedUrl(document.storage_path, 60)
      if (error) throw error
      if (!data?.signedUrl) throw new Error("Could not create a secure file link.")
      window.open(data.signedUrl, "_blank", "noopener,noreferrer")
    } catch (err) {
      console.error("Unable to open deal document:", err)
      setDocumentError(err?.message || "Unable to open file.")
    } finally { setOpeningDocument("") }
  }

  async function deleteDocument(document) {
    if (!window.confirm(`Delete "${document.file_name}"? This cannot be undone.`)) return
    setDocumentError("")
    setDocumentNotice("")
    try {
      const { error: storageError } = await supabase.storage.from("deal-documents").remove([document.storage_path])
      if (storageError) throw storageError
      const { error: metadataError } = await supabase.from("deal_documents").delete().eq("id", document.id)
      if (metadataError) throw metadataError
      setDocuments(current => current.filter(item => item.id !== document.id))
      setDocumentNotice("File deleted.")
    } catch (err) {
      console.error("Unable to delete deal document:", err)
      setDocumentError(err?.message || "Unable to delete file.")
    }
  }

  useEffect(() => {
    if (!deal) return

    setSalesperson(deal.salesperson || "")
    setAddress(deal.address || "")
    setPostcode(deal.postcode || "")
    setMessage("")
  }, [deal])

  if (!deal) {
    return null
  }

  const fullAddress = [
    address.trim(),
    postcode.trim(),
  ]
    .filter(Boolean)
    .join(", ")

  const mapsUrl = fullAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        fullAddress
      )}`
    : null

  async function handleSave() {
    setSaving(true)
    setMessage("")

    try {
      const updatedValues = {
        salesperson: salesperson.trim(),
        address: address.trim(),
        postcode: postcode.trim(),
      }

      const { error } = await supabase
        .from("deals")
        .update(updatedValues)
        .eq("id", deal.id)

      if (error) {
        throw error
      }

      const updatedDeal = {
        ...deal,
        ...updatedValues,
      }

      if (onUpdated) {
        onUpdated(updatedDeal)
      }

      setMessage(
        "Changes saved successfully."
      )
    } catch (error) {
      console.error(
        "Error saving deal:",
        error
      )

      setMessage(
        error?.message ||
          "Unable to save changes."
      )
    } finally {
      setSaving(false)
    }
  }

  const pipedriveStage = String(deal?.pipedrive_stage || "").trim() || "—"

  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            border: 0,
            background: "transparent",
            padding: 0,
            cursor: "pointer",
            color: "#666",
            fontSize: "12px",
          }}
        >
          <ArrowLeft size={16} />
          Back to Deals
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            padding: "9px 14px",
            border: 0,
            borderRadius: "7px",
            background: "#172554",
            color: "#fff",
            fontSize: "11px",
            fontWeight: 600,
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Save size={15} />
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>

      <div
        className="card"
        style={{
          marginBottom: "18px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(260px, 0.8fr) minmax(450px, 1.7fr)",
            minHeight: "360px",
          }}
        >
          <div
            style={{
              padding: "30px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                display: "block",
                fontSize: "10px",
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "8px",
              }}
            >
              Customer
            </span>

            <h1
              style={{
                margin: 0,
                fontSize: "26px",
                lineHeight: "1.2",
                color: "#222",
              }}
            >
              {deal.customer_name || "Unnamed customer"}
            </h1>

            <div
              style={{
                marginTop: "14px",
                display: "flex",
                alignItems: "center",
                gap: "7px",
              }}
            >
              <span style={{ fontSize: "11px", color: "#888" }}>
                Contract
              </span>
              <strong style={{ fontSize: "12px", color: "#444" }}>
                {deal.contract_number || "—"}
              </strong>
            </div>

            <div
              style={{
                marginTop: "12px",
                display: "flex",
                alignItems: "center",
                gap: "7px",
              }}
            >
              <span style={{ fontSize: "11px", color: "#888" }}>
                Pipedrive stage
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "5px 9px",
                  borderRadius: "6px",
                  background: "#eef6fb",
                  color: "#1676b8",
                  fontSize: "10px",
                  fontWeight: 700,
                }}
              >
                {pipedriveStage}
              </span>
            </div>

            {fullAddress && (
              <div
                style={{
                  marginTop: "24px",
                  display: "flex",
                  gap: "9px",
                  alignItems: "flex-start",
                }}
              >
                <MapPin
                  size={17}
                  style={{
                    marginTop: "1px",
                    flexShrink: 0,
                    color: "#172554",
                  }}
                />
                <div>
                  <span
                    style={{
                      display: "block",
                      fontSize: "10px",
                      color: "#888",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: "4px",
                    }}
                  >
                    Address
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: "12px",
                      color: "#444",
                      lineHeight: "1.5",
                    }}
                  >
                    {fullAddress}
                  </span>
                </div>
              </div>
            )}

            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  width: "fit-content",
                  marginTop: "22px",
                  padding: "8px 11px",
                  border: "1px solid #dddfe3",
                  borderRadius: "7px",
                  color: "#172554",
                  background: "#fff",
                  textDecoration: "none",
                  fontSize: "10px",
                  fontWeight: 600,
                }}
              >
                <MapPin size={13} />
                Open in Google Maps
                <ExternalLink size={12} />
              </a>
            )}
          </div>

          <div
            style={{
              minHeight: "360px",
              background: "#eef0f2",
            }}
          >
            {fullAddress ? (
              <iframe
                title="Customer location"
                src={`https://www.google.com/maps?q=${encodeURIComponent(
                  fullAddress
                )}&output=embed`}
                width="100%"
                height="100%"
                style={{
                  border: 0,
                  display: "block",
                  minHeight: "360px",
                }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div
                style={{
                  height: "100%",
                  minHeight: "360px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#999",
                  fontSize: "12px",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <MapPin size={28} style={{ marginBottom: "8px" }} />
                  <div>No address available</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head"><div><h2>Deal documents</h2><p>Upload and manage survey files securely in Supabase Storage</p></div></div>
        <div style={{ padding: "0 20px 20px", display: "grid", gap: 16 }}>
          {documentError && <div role="alert" style={{ padding: "10px 12px", borderRadius: 7, background: "#fff0f0", color: "#a33b3b", fontSize: 11 }}>{documentError}</div>}
          {documentNotice && <div role="status" style={{ padding: "10px 12px", borderRadius: 7, background: "#e8f4ed", color: "#28734c", fontSize: 11 }}>{documentNotice}</div>}
          {documentCategories.map(category => {
            const categoryDocuments = documents.filter(document => document.category === category.key)
            const busy = uploadingCategory === category.key
            return <div key={category.key} style={{ border: "1px solid #e1e6eb", borderRadius: 9, overflow: "hidden" }}>
              <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "#f8fafc", borderBottom: "1px solid #e1e6eb" }}>
                <div style={{ minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 700, color: "#263645" }}>{category.label}</div><div style={{ marginTop: 4, fontSize: 10, color: "#75818b" }}>{category.hint}</div></div>
                <label style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 11px", borderRadius: 7, background: busy ? "#e2e8f0" : "#002d49", color: busy ? "#64748b" : "#fff", fontSize: 10, fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? .7 : 1 }}>
                  {busy ? <LoaderCircle size={14} /> : <FileUp size={14} />}{busy ? "Uploading…" : "Upload"}
                  <input type="file" accept={category.accept} multiple={category.multiple} disabled={Boolean(uploadingCategory)} onChange={event => { uploadDocuments(category.key, event.target.files); event.target.value = "" }} style={{ display: "none" }} />
                </label>
              </div>
              <div style={{ padding: categoryDocuments.length ? "4px 14px" : "14px", display: "grid", gap: 0 }}>
                {categoryDocuments.map(document => <div key={document.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #edf0f2" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 7, background: "#eaf3f8", color: "#1676b8", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}><ExternalLink size={15} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}><div title={document.file_name} style={{ fontSize: 11, fontWeight: 600, color: "#263645", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{document.file_name}</div><div style={{ marginTop: 3, fontSize: 9, color: "#89939c" }}>{document.file_size ? (document.file_size >= 1048576 ? `${(document.file_size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(document.file_size / 1024))} KB`) : "Size unknown"} · {document.created_at ? new Date(document.created_at).toLocaleString("en-GB") : ""}</div></div>
                  <button type="button" onClick={() => openDocument(document)} disabled={openingDocument === document.id} style={{ border: "1px solid #d7dee8", borderRadius: 6, padding: "7px 9px", background: "#fff", color: "#334155", fontSize: 10, cursor: "pointer" }}>{openingDocument === document.id ? "Opening…" : "Open"}</button>
                  <button type="button" onClick={() => deleteDocument(document)} aria-label={`Delete ${document.file_name}`} style={{ border: "1px solid #f0d4d4", borderRadius: 6, padding: 7, background: "#fff", color: "#a33b3b", cursor: "pointer" }}><Trash2 size={14} /></button>
                </div>)}
                {!categoryDocuments.length && <div style={{ fontSize: 10, color: "#89939c" }}>{documentsLoading ? "Loading files…" : "No files uploaded yet."}</div>}
              </div>
            </div>
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Deal information</h2>
            <p>Customer and deal information</p>
          </div>
        </div>

        <div style={{ padding: "0 20px 20px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "14px",
              marginBottom: "18px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "10px",
                  fontWeight: 600,
                  color: "#777",
                  marginBottom: "6px",
                }}
              >
                Installation start date
              </label>
              <div
                style={{
                  padding: "10px 12px",
                  background: "#f7f7f8",
                  border: "1px solid #e5e5e7",
                  borderRadius: "7px",
                  fontSize: "12px",
                }}
              >
                {formatDate(deal.installation_start_date)}
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "10px",
                  fontWeight: 600,
                  color: "#777",
                  marginBottom: "6px",
                }}
              >
                Admin fee received date
              </label>
              <div
                style={{
                  padding: "10px 12px",
                  background: "#f7f7f8",
                  border: "1px solid #e5e5e7",
                  borderRadius: "7px",
                  fontSize: "12px",
                }}
              >
                {formatDate(deal.admin_fee_received_date)}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "18px" }}>
            <label
              style={{
                display: "block",
                fontSize: "10px",
                fontWeight: 600,
                color: "#777",
                marginBottom: "6px",
              }}
            >
              Customer
            </label>
            <div
              style={{
                padding: "10px 12px",
                background: "#f7f7f8",
                border: "1px solid #e5e5e7",
                borderRadius: "7px",
                fontSize: "12px",
              }}
            >
              {deal.customer_name || "—"}
            </div>
          </div>

          <div style={{ marginBottom: "18px" }}>
            <label
              style={{
                display: "block",
                fontSize: "10px",
                fontWeight: 600,
                color: "#777",
                marginBottom: "6px",
              }}
            >
              Contract number
            </label>
            <div
              style={{
                padding: "10px 12px",
                background: "#f7f7f8",
                border: "1px solid #e5e5e7",
                borderRadius: "7px",
                fontSize: "12px",
              }}
            >
              {deal.contract_number || "—"}
            </div>
          </div>

          <div style={{ marginBottom: "18px" }}>
            <label
              style={{
                display: "block",
                fontSize: "10px",
                fontWeight: 600,
                color: "#777",
                marginBottom: "6px",
              }}
            >
              Pipedrive stage
            </label>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "8px 11px",
                background: "#eef6fb",
                border: "1px solid #cfe2ef",
                borderRadius: "7px",
                fontSize: "12px",
                fontWeight: 700,
                color: "#1676b8",
              }}
            >
              {pipedriveStage}
            </div>
          </div>

          <div style={{ marginBottom: "18px" }}>
            <label
              htmlFor="address"
              style={{
                display: "block",
                fontSize: "10px",
                fontWeight: 600,
                color: "#777",
                marginBottom: "6px",
              }}
            >
              Address
            </label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter address"
              style={{
                width: "100%",
                boxSizing: "border-box",
                height: "40px",
                padding: "0 12px",
                border: "1px solid #d9dadd",
                borderRadius: "7px",
                outline: "none",
                fontFamily: "inherit",
                fontSize: "12px",
              }}
            />
          </div>

          <div style={{ marginBottom: "18px" }}>
            <label
              htmlFor="postcode"
              style={{
                display: "block",
                fontSize: "10px",
                fontWeight: 600,
                color: "#777",
                marginBottom: "6px",
              }}
            >
              Postcode
            </label>
            <input
              id="postcode"
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              placeholder="Enter postcode"
              style={{
                width: "100%",
                boxSizing: "border-box",
                height: "40px",
                padding: "0 12px",
                border: "1px solid #d9dadd",
                borderRadius: "7px",
                outline: "none",
                fontFamily: "inherit",
                fontSize: "12px",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="salesperson"
              style={{
                display: "block",
                fontSize: "10px",
                fontWeight: 600,
                color: "#777",
                marginBottom: "6px",
              }}
            >
              Salesperson
            </label>
            <input
              id="salesperson"
              type="text"
              value={salesperson}
              onChange={(e) => setSalesperson(e.target.value)}
              placeholder="Enter salesperson"
              style={{
                width: "100%",
                boxSizing: "border-box",
                height: "40px",
                padding: "0 12px",
                border: "1px solid #d9dadd",
                borderRadius: "7px",
                outline: "none",
                fontFamily: "inherit",
                fontSize: "12px",
              }}
            />
          </div>

          {message && (
            <div
              style={{
                marginTop: "14px",
                padding: "10px 12px",
                borderRadius: "7px",
                background: message.includes("successfully")
                  ? "#e8f4ed"
                  : "#fff0f0",
                color: message.includes("successfully")
                  ? "#28734c"
                  : "#a33b3b",
                fontSize: "11px",
              }}
            >
              {message}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default CustomerDetail

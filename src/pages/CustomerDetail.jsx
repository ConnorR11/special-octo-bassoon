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
  const [activeTab, setActiveTab] = useState("details")
  const [surveyAnswers, setSurveyAnswers] = useState({})
  const [surveySaving, setSurveySaving] = useState(false)
  const [surveySection, setSurveySection] = useState("Front of Property")
  const [pendingSurveyPhotos, setPendingSurveyPhotos] = useState([])
  const [expandedSurveySection, setExpandedSurveySection] = useState("Property & installation")
  const [surveyPhotosExpanded, setSurveyPhotosExpanded] = useState(false)
  const [generatingSurvey, setGeneratingSurvey] = useState(false)
  const surveyQuestions = [
    ["Is this home in a listed building or in a conservation area?", "listed_conservation"], ["Is it a suspended or concrete floor?", "floor_type"], ["Where is the main fusebox located?", "fusebox_location"], ["How far is the fusebox from the intended fit location of the battery/inverter?", "fusebox_distance"], ["How long is the DC run?", "dc_run"], ["Where will the battery/inverter be located?", "inverter_location"], ["Is the battery/inverter being installed on the south facing wall?", "south_wall"], ["Is a canopy or a fireproof encasement being fitted?", "canopy_fireproof"], ["What type of external walls are there?", "external_walls"], ["Building Width", "building_width"], ["Building Height", "building_height"], ["Height of roof from loft-hatch", "roof_height_loft"], ["Roof Tile Type", "roof_tile_type"], ["Condition of Roof", "roof_condition"], ["Shading Issues", "shading_issues"], ["Roof Obstructions", "roof_obstructions"], ["Any Access Issues", "access_issues"], ["Can scaffolding be erected?", "scaffolding"], ["Does customer Wi-Fi reach the battery/inverter?", "wifi_reach"], ["What is the size of the cut out switch?", "cutout_size"], ["What is the customer’s MPAN number?", "mpan"], ["Are there any high energy appliances?", "high_energy_appliances"], ["Is there sufficient loft access?", "loft_access"], ["Does the customer consent to Copex/trunking around the building? (If loft access is insufficient)", "copex_consent"], ["Does the customer have an existing solar system?", "existing_solar"], ["How many panels? (And their output)", "existing_panels"], ["Type & Size of Inverter", "existing_inverter"]
  ]
  const surveyQuestionGroups = [
    { title: "Property & installation", icon: "house", keys: ["listed_conservation", "floor_type", "external_walls", "inverter_location", "south_wall", "canopy_fireproof"] },
    { title: "Electrical & battery", icon: "zap", keys: ["fusebox_location", "fusebox_distance", "dc_run", "wifi_reach", "cutout_size", "mpan", "high_energy_appliances"] },
    { title: "Roof & solar panels", icon: "sun", keys: ["roof_tile_type", "roof_condition", "shading_issues", "roof_obstructions", "existing_solar", "existing_panels", "existing_inverter"] },
    { title: "Measurements & access", icon: "ruler", keys: ["building_width", "building_height", "roof_height_loft", "access_issues", "scaffolding", "loft_access", "copex_consent"] },
  ]
  const answeredSurveyCount = surveyQuestions.filter(([, key]) => String(surveyAnswers[key] || "").trim()).length
  const surveyCompletion = Math.round((answeredSurveyCount / surveyQuestions.length) * 100)
  const surveyPhotoSections = ["Front of Property", "Rear of Property", "Side of Property", "Close Up of Consumer Unit", "Close Up of Electricity Meter", "Close Up of Cut Out", "Wide Of Consumer Unit", "Loft Access Point", "Loft Roof Truss", "Internet DC Route", "External DC Route", "Proposed Inverter Location", "Proposed Battery Location", "Proposed Canopy Location", "Proposed Panel Layout", "Alternative Roof Elevations", "Existing Solar Equipment", "Existing EV Charger", "High Electrical Usage Items", "Shading Issues"]
  const documentCategories = [
    { key: "survey_video", label: "Survey Video", accept: "video/*", multiple: false, hint: "Common video formats. Maximum 250 MB per file." },
    { key: "survey_photos", label: "Survey Checklist & Photos", accept: "image/jpeg,image/png,image/webp", multiple: true, hint: "Complete the checklist below and upload labelled survey photos here. Generate the combined survey PDF when finished." },
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
      const { data: surveyData, error: surveyError } = await supabase.from("deal_survey_answers").select("answers").eq("deal_id", deal.id).maybeSingle()
      if (surveyError) throw surveyError
      setSurveyAnswers(surveyData?.answers || {})
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
          deal_id: deal.id, category, survey_section: category === "survey_photos" ? surveySection : null, file_name: file.name, storage_path: path,
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

  async function saveSurveyAnswers() {
    setSurveySaving(true); setDocumentError("");
    try { const { data: u } = await supabase.auth.getUser(); const { error } = await supabase.from("deal_survey_answers").upsert({ deal_id: deal.id, answers: surveyAnswers, updated_by: u?.user?.id || null, updated_at: new Date().toISOString() }, { onConflict: "deal_id" }); if (error) throw error; setDocumentNotice("Survey checklist saved."); }
    catch (e) { setDocumentError(e?.message || "Unable to save survey checklist."); } finally { setSurveySaving(false); }
  }
  async function generateSurveyPdf() {
    setGeneratingSurvey(true); setDocumentError(""); setDocumentNotice("");
    try {
      const { data: userData } = await supabase.auth.getUser()
      const { error: answersError } = await supabase.from("deal_survey_answers").upsert({ deal_id: deal.id, answers: surveyAnswers, updated_by: userData?.user?.id || null, updated_at: new Date().toISOString() }, { onConflict: "deal_id" })
      if (answersError) throw answersError
      const newlySavedPhotos = []
      for (const item of pendingSurveyPhotos) {
        if (item.file.size > 250 * 1024 * 1024) throw new Error(`"${item.file.name}" exceeds the 250 MB upload limit.`)
        const safeName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-140) || "survey-photo"
        const path = `${deal.id}/survey_photos/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${safeName}`
        const { error: photoUploadError } = await supabase.storage.from("deal-documents").upload(path, item.file, { contentType: item.file.type || "application/octet-stream", upsert: false })
        if (photoUploadError) throw photoUploadError
        const { data: photoRow, error: photoMetaError } = await supabase.from("deal_documents").insert({ deal_id: deal.id, category: "survey_photos", survey_section: item.section, file_name: item.file.name, storage_path: path, mime_type: item.file.type || null, file_size: item.file.size, uploaded_by: userData?.user?.id || null }).select().single()
        if (photoMetaError) { await supabase.storage.from("deal-documents").remove([path]); throw photoMetaError }
        newlySavedPhotos.push(photoRow)
      }
      const { jsPDF } = await import("jspdf"); const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }); const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), m = 14;
      const header = (title) => { pdf.setFillColor(0,45,73); pdf.rect(0,0,pw,18,"F"); pdf.setTextColor(255,255,255); pdf.setFont("helvetica","bold"); pdf.setFontSize(12); pdf.text(title,m,11.5); pdf.setTextColor(30,41,59); };
      header("Homeshield Solar Survey Checklist & Photos"); pdf.setFontSize(9); pdf.setFont("helvetica","bold"); pdf.text("Customer: " + (deal.customer_name || "—"),m,27); pdf.setFont("helvetica","normal"); pdf.text("Contract: " + (deal.contract_number || "—"),m,33); pdf.text("Address: " + ([deal.address,deal.postcode].filter(Boolean).join(", ") || "—"),m,39,{maxWidth:pw-2*m});
      const gap=8,cw=(pw-2*m-gap)/2,rows=Math.ceil(surveyQuestions.length/2),heights=surveyQuestions.map(([q,k])=>Math.max(13,pdf.splitTextToSize(q,cw-4).length*3.7+pdf.splitTextToSize(String(surveyAnswers[k]||"—"),cw-4).length*3.7+5));let y=49;
      for(let i=0;i<rows;i++){const h=Math.max(heights[i]||13,heights[i+rows]||13);for(let col=0;col<2;col++){const idx=col===0?i:i+rows;if(idx>=surveyQuestions.length)continue;const [q,k]=surveyQuestions[idx],x=m+col*(cw+gap);if(y+h>ph-12){pdf.addPage();header("Homeshield Solar Survey Checklist (continued)");y=27;}pdf.setDrawColor(215,222,230);pdf.setFillColor(248,250,252);pdf.roundedRect(x,y,cw,h,1,1,"FD");pdf.setFont("helvetica","bold");pdf.setFontSize(7.5);const ql=pdf.splitTextToSize(q,cw-4);pdf.text(ql,x+2,y+4);pdf.setFont("helvetica","normal");pdf.setFontSize(8);pdf.text(pdf.splitTextToSize(String(surveyAnswers[k]||"—"),cw-4),x+2,y+4+ql.length*3.7);}y+=h+2;}
      const photos=[...documents.filter(d=>d.category==="survey_photos"),...newlySavedPhotos];
      for(const section of surveyPhotoSections){pdf.addPage();header(section);const files=photos.filter(d=>(d.survey_section||"Front of Property")===section);if(!files.length){pdf.setFontSize(10);pdf.setTextColor(120,130,140);pdf.text("No photos uploaded for this section.",m,30);continue;}let py=25;for(const doc of files){const {data,error}=await supabase.storage.from("deal-documents").download(doc.storage_path);if(error)throw error;const url=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(data)});const dim=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res({w:im.width,h:im.height});im.onerror=rej;im.src=url});const maxW=pw-2*m,maxH=ph-44,s=Math.min(maxW/dim.w,maxH/dim.h);if(py+dim.h*s+10>ph-12){pdf.addPage();header(section+" (continued)");py=25;}pdf.setFont("helvetica","bold");pdf.setFontSize(9);pdf.text(doc.file_name,m,py+4,{maxWidth:maxW});py+=7;pdf.addImage(url,doc.mime_type==="image/png"?"PNG":"JPEG",m,py,dim.w*s,dim.h*s,undefined,"FAST");py+=dim.h*s+10;}}
      const blob=pdf.output("blob"),path=deal.id+"/survey_pdf/"+Date.now()+"-survey-photos.pdf";const {error:upErr}=await supabase.storage.from("deal-documents").upload(path,blob,{contentType:"application/pdf",upsert:false});if(upErr)throw upErr;const {data:u}=await supabase.auth.getUser();const {error:metaErr}=await supabase.from("deal_documents").insert({deal_id:deal.id,category:"survey_pdf",file_name:"Survey Photos.pdf",storage_path:path,mime_type:"application/pdf",file_size:blob.size,uploaded_by:u?.user?.id||null});if(metaErr){await supabase.storage.from("deal-documents").remove([path]);throw metaErr;}setPendingSurveyPhotos([]);await loadDocuments();setDocumentNotice("Checklist and photos saved. Survey PDF generated and saved to Deal documents.");
    }catch(e){console.error("Survey PDF generation failed",e);setDocumentError(e?.message||"Unable to generate survey PDF.");}finally{setGeneratingSurvey(false);}
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

      <div role="tablist" aria-label="Deal details tabs" style={{display:"flex",gap:6,borderBottom:"1px solid #dfe5eb",marginBottom:18,overflowX:"auto"}}>
        {[{key:"details",label:"Deal information"},{key:"survey",label:"Survey & Documents"}].map(tab => <button key={tab.key} type="button" role="tab" aria-selected={activeTab===tab.key} onClick={()=>setActiveTab(tab.key)} style={{flex:"0 0 auto",padding:"12px 16px",border:0,borderBottom:activeTab===tab.key?"3px solid #002d49":"3px solid transparent",marginBottom:-1,background:"transparent",color:activeTab===tab.key?"#002d49":"#64748b",fontSize:12,fontWeight:activeTab===tab.key?700:600,cursor:"pointer"}}>{tab.label}</button>)}
      </div>

      {activeTab === "survey" && <>
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head"><div><h2>Deal documents</h2><p>Upload and manage survey files securely in Supabase Storage</p></div></div>
        <div style={{ padding: "0 20px 20px", display: "grid", gap: 16 }}>
          {documentError && <div role="alert" style={{ padding: "10px 12px", borderRadius: 7, background: "#fff0f0", color: "#a33b3b", fontSize: 11 }}>{documentError}</div>}
          {documentNotice && <div role="status" style={{ padding: "10px 12px", borderRadius: 7, background: "#e8f4ed", color: "#28734c", fontSize: 11 }}>{documentNotice}</div>}
          {documentCategories.filter(category => category.key !== "survey_photos").map(category => {
            const categoryDocuments = documents.filter(document => document.category === category.key)
            const busy = uploadingCategory === category.key
            return <><div key={category.key} style={{ border: "1px solid #e1e6eb", borderRadius: 9, overflow: "hidden" }}>
              <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "#f8fafc", borderBottom: "1px solid #e1e6eb" }}>
                {category.key === "survey_photos" && <select value={surveySection} onChange={e=>setSurveySection(e.target.value)} style={{maxWidth:220,padding:"7px 8px",border:"1px solid #d7dee8",borderRadius:6,background:"#fff",fontSize:10}}>{surveyPhotoSections.map(section=><option key={section} value={section}>{section}</option>)}</select>}
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
            {category.key === "survey_video" && (
                    <div className="card" style={{ marginBottom: 18 }}>
                      <div className="card-head"><div><h2>Solar survey checklist</h2><p>Work through each section, then generate the combined checklist and photo PDF.</p></div></div>
                      <div style={{padding:"0 20px 20px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                          <div style={{flex:1,height:7,background:"#e8edf2",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width: `${surveyCompletion}%`,background:"#16845b",borderRadius:99,transition:"width .2s"}}/></div>
                          <div style={{fontSize:11,color:"#64748b",whiteSpace:"nowrap"}}>{answeredSurveyCount} of {surveyQuestions.length} answered · {surveyCompletion}%</div>
                        </div>
                        <div style={{display:"grid",gap:10}}>
                          {surveyQuestionGroups.map((group,index) => {
                            const groupQuestions = surveyQuestions.filter(([,key]) => group.keys.includes(key))
                            const groupAnswered = groupQuestions.filter(([,key]) => String(surveyAnswers[key] || "").trim()).length
                            const isOpen = expandedSurveySection === group.title
                            return <div key={group.title} style={{border:"1px solid #e1e6eb",borderRadius:9,overflow:"hidden"}}>
                              <button type="button" onClick={() => setExpandedSurveySection(isOpen ? "" : group.title)} aria-expanded={isOpen} style={{display:"flex",alignItems:"center",gap:12,width:"100%",padding:"14px",border:0,background:isOpen?"#f4f8fb":"#fff",textAlign:"left",cursor:"pointer"}}>
                                <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:30,height:30,borderRadius:8,background:"#e8eef4",color:"#17364b",fontSize:12,fontWeight:700}}>{index+1}</span>
                                <span style={{flex:1,minWidth:0}}><span style={{display:"block",fontSize:12,fontWeight:700,color:"#263645"}}>{group.title}</span><span style={{display:"block",marginTop:3,fontSize:10,color:"#75818b"}}>{groupAnswered} of {groupQuestions.length} answered</span></span>
                                <span style={{fontSize:10,color:"#64748b",marginRight:5}}>{groupAnswered===groupQuestions.length ? "Complete" : "In progress"}</span>
                                <span style={{fontSize:17,color:"#64748b"}}>{isOpen ? "−" : "+"}</span>
                              </button>
                              {isOpen && <div style={{padding:14,borderTop:"1px solid #e1e6eb",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,280px),1fr))",gap:12}}>
                                {groupQuestions.map(([question,key]) => {
                                  const yesNoKeys = ["listed_conservation","south_wall","canopy_fireproof","wifi_reach","high_energy_appliances","loft_access","copex_consent","existing_solar","scaffolding"]
                                  const isYesNo = yesNoKeys.includes(key)
                                  const isFloor = key === "floor_type"
                                  return <label key={key} style={{display:"grid",alignContent:"start",gap:6,fontSize:11,color:"#475569"}}>
                                    <span>{question}</span>
                                    {isYesNo || isFloor ? <select value={surveyAnswers[key] || ""} onChange={e=>setSurveyAnswers(current=>({...current,[key]:e.target.value}))} style={{boxSizing:"border-box",width:"100%",minHeight:38,padding:"8px 10px",border:"1px solid #d9dadd",borderRadius:7,font:"inherit",background:"#fff",color:surveyAnswers[key]?"#263645":"#89939c"}}><option value="">Select answer</option>{(isFloor ? ["Suspended","Concrete"] : ["Yes","No","Not sure"]).map(option=><option key={option} value={option}>{option}</option>)}</select> : <input value={surveyAnswers[key] || ""} onChange={e=>setSurveyAnswers(current=>({...current,[key]:e.target.value}))} placeholder="Enter answer" style={{boxSizing:"border-box",width:"100%",minHeight:38,padding:"8px 10px",border:"1px solid #d9dadd",borderRadius:7,font:"inherit"}} />}
                                  </label>
                                })}
                              </div>}
                            </div>
                          })}
                        </div>
                        <div style={{marginTop:16,border:"1px solid #e1e6eb",borderRadius:9,overflow:"hidden"}}>
                          <button type="button" onClick={()=>setSurveyPhotosExpanded(value=>!value)} aria-expanded={surveyPhotosExpanded} style={{display:"flex",alignItems:"center",gap:12,width:"100%",padding:14,border:0,background:surveyPhotosExpanded?"#f4f8fb":"#f8fafc",textAlign:"left",cursor:"pointer"}}>
                            <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:25,height:25,borderRadius:7,background:"#e8eef4",color:"#17364b",fontSize:10,fontWeight:700,flex:"0 0 auto"}}>5</span>
                            <span style={{flex:1,minWidth:0}}><span style={{display:"block",fontSize:12,fontWeight:700,color:"#263645"}}>Survey photos</span><span style={{display:"block",marginTop:4,fontSize:10,color:"#75818b"}}>Add photos to each section. Photos are saved and included in the PDF when you generate the full survey PDF.</span></span>
                            <span style={{fontSize:10,color:"#64748b",whiteSpace:"nowrap"}}>{documents.filter(d=>d.category==="survey_photos").length} saved · {pendingSurveyPhotos.length} new</span>
                            <span style={{fontSize:17,color:"#64748b"}}>{surveyPhotosExpanded?"−":"+"}</span>
                          </button>
                          {surveyPhotosExpanded && <>
                          <div style={{padding:14,background:"#f8fafc",borderTop:"1px solid #e1e6eb",borderBottom:"1px solid #e1e6eb"}}>
                            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                              <div style={{flex:1,height:7,background:"#e8edf2",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${surveyCompletion}%`,background:"#16845b",borderRadius:99,transition:"width .2s"}}/></div>
                              <div style={{fontSize:11,color:"#64748b",whiteSpace:"nowrap"}}>{answeredSurveyCount} of {surveyQuestions.length} answered · {surveyCompletion}%</div>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                              <div style={{flex:1,height:7,background:"#e8edf2",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.round((surveyPhotoSections.filter(section=>documents.some(d=>d.category==="survey_photos"&&d.survey_section===section)||pendingSurveyPhotos.some(p=>p.section===section)).length/surveyPhotoSections.length)*100)}%`,background:"#16845b",borderRadius:99,transition:"width .2s"}}/></div>
                              <div style={{fontSize:11,color:"#64748b",whiteSpace:"nowrap"}}>{surveyPhotoSections.filter(section=>documents.some(d=>d.category==="survey_photos"&&d.survey_section===section)||pendingSurveyPhotos.some(p=>p.section===section)).length} of {surveyPhotoSections.length} photo sections complete</div>
                            </div>
                            <div style={{fontSize:10,color:"#75818b"}}>Add photos to each section. They will be saved and included in the PDF when you generate it.</div>
                            <div style={{display:"flex",alignItems:"center",gap:12,marginTop:12}}>
                              <div style={{flex:1,height:7,background:"#e8edf2",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.round((surveyPhotoSections.filter(section=>documents.some(d=>d.category==="survey_photos"&&d.survey_section===section)||pendingSurveyPhotos.some(p=>p.section===section)).length/surveyPhotoSections.length)*100)}%`,background:"#16845b",borderRadius:99,transition:"width .2s"}}/></div>
                              <div style={{fontSize:11,color:"#64748b",whiteSpace:"nowrap"}}>{surveyPhotoSections.filter(section=>documents.some(d=>d.category==="survey_photos"&&d.survey_section===section)||pendingSurveyPhotos.some(p=>p.section===section)).length} of {surveyPhotoSections.length} sections have photos</div>
                            </div>
                            <div style={{fontSize:10,color:"#75818b",marginTop:5}}>{documents.filter(d=>d.category==="survey_photos").length} saved photos · {pendingSurveyPhotos.length} new photos waiting to be saved</div>
                          </div>
                          <div style={{padding:12,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,280px),1fr))",gap:10}}>
                            {surveyPhotoSections.map((section,index)=>{
                              const savedPhotos=documents.filter(d=>d.category==="survey_photos"&&d.survey_section===section)
                              const pendingPhotos=pendingSurveyPhotos.map((item,pendingIndex)=>({...item,pendingIndex})).filter(item=>item.section===section)
                              const hasPhotos=savedPhotos.length>0||pendingPhotos.length>0
                              return <div key={section} style={{border:"1px solid #e1e6eb",borderRadius:9,overflow:"hidden",background:"#fff"}}>
                                <div style={{display:"flex",alignItems:"center",gap:9,padding:"11px 12px",background:hasPhotos?"#f2f8f5":"#f8fafc",borderBottom:"1px solid #edf0f2"}}>
                                  <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:25,height:25,borderRadius:7,background:hasPhotos?"#d9f0e4":"#e8eef4",color:hasPhotos?"#18734b":"#17364b",fontSize:10,fontWeight:700}}>{index+1}</span>
                                  <span style={{flex:1,fontSize:11,fontWeight:700,color:"#263645"}}>{section}</span>
                                  <span style={{fontSize:9,color:hasPhotos?"#18734b":"#89939c"}}>{hasPhotos?"Photos added":"No photos"}</span>
                                </div>
                                <div style={{padding:11,display:"grid",gap:8}}>
                                  <label style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,padding:"9px 10px",border:"1px dashed #b9c7d4",borderRadius:7,background:"#fff",color:"#263645",fontSize:10,fontWeight:700,cursor:generatingSurvey?"wait":"pointer",opacity:generatingSurvey?.6:1}}>
                                    <FileUp size={14}/>Add photos to this section
                                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={generatingSurvey} onChange={event=>{const files=Array.from(event.target.files||[]);setPendingSurveyPhotos(current=>[...current,...files.map(file=>({file,section}))]);event.target.value=""}} style={{display:"none"}}/>
                                  </label>
                                  {savedPhotos.map(document=><div key={document.id} style={{display:"flex",alignItems:"center",gap:7,fontSize:10,color:"#475569"}}><FileUp size={13}/><span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={document.file_name}>{document.file_name}</span><button type="button" onClick={()=>openDocument(document)} disabled={openingDocument===document.id} style={{border:"1px solid #d7dee8",borderRadius:5,padding:"4px 6px",background:"#fff",color:"#334155",fontSize:9,cursor:"pointer"}}>Open</button><button type="button" onClick={()=>deleteDocument(document)} aria-label={`Delete ${document.file_name}`} style={{border:"1px solid #f0d4d4",borderRadius:5,padding:"4px 6px",background:"#fff",color:"#a33b3b",fontSize:9,cursor:"pointer"}}>×</button></div>)}
                                  {pendingPhotos.map(item=><div key={item.pendingIndex} style={{display:"flex",alignItems:"center",gap:7,fontSize:10,color:"#475569"}}><FileUp size={13}/><span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={item.file.name}>{item.file.name}</span><button type="button" onClick={()=>setPendingSurveyPhotos(current=>current.filter((_,i)=>i!==item.pendingIndex))} disabled={generatingSurvey} style={{border:"1px solid #f0d4d4",borderRadius:5,padding:"4px 6px",background:"#fff",color:"#a33b3b",fontSize:9,cursor:"pointer"}}>Remove</button></div>)}
                                  {!hasPhotos&&<div style={{fontSize:10,color:"#89939c"}}>No photos added for this section yet.</div>}
                                </div>
                              </div>
                            })}
                          </div>
                          </>}
                        </div>
                        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>
                          <button type="button" onClick={saveSurveyAnswers} disabled={surveySaving} style={{border:0,borderRadius:7,padding:"10px 14px",background:"#e8eef4",color:"#172554",fontWeight:700,cursor:"pointer"}}>{surveySaving?"Saving checklist…":"Save checklist"}</button>
                          <button type="button" onClick={generateSurveyPdf} disabled={generatingSurvey} style={{border:0,borderRadius:7,padding:"10px 14px",background:"#002d49",color:"#fff",fontWeight:700,cursor:"pointer"}}>{generatingSurvey?"Generating PDF…":"Generate full survey PDF"}</button>
                        </div>
                      </div>
                    </div>
            )}
            </>
          })}
        </div>
      </div>

      </>}

      {activeTab === "details" && <>
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
      </>}
    </section>
  )
}

export default CustomerDetail

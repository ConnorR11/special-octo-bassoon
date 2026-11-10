import React, { useState } from "react"
import { Search, PanelsTopLeft, ChartNoAxesCombined, Activity, FileText } from "lucide-react"
import SEO from "./SEO"

function LandingPagesTab() {
  const card = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 18, marginBottom: 15 }
  const th = { textAlign: "left", padding: "10px 9px", background: "#f1f5f9", color: "#475569", fontSize: 11, verticalAlign: "top" }
  const td = { padding: "11px 9px", borderBottom: "1px solid #edf1f5", fontSize: 12, verticalAlign: "top", lineHeight: 1.55 }
  const pages = [
    ["Windows & doors", "/windows-doors/quote", "Main paid-traffic page for replacement windows and doors. Explain products, installation process, service areas, proof and quote request."],
    ["Replacement windows", "/windows/replacement-windows/", "Dedicated page for window-intent searches: styles, frame options, energy performance, installation and a clear survey/quote CTA."],
    ["Doors", "/doors/", "Separate page for composite, uPVC and replacement doors. Show product range, security, styles and relevant case studies."],
    ["Solar panels", "/solar-panels/quote", "Main solar acquisition page. Explain system design, roof suitability, installation, realistic savings factors and quote journey."],
    ["Solar panels & battery", "/solar-battery-storage/", "Dedicated page for people researching panels with battery storage. Explain battery sizing, usage patterns and system options."],
    ["Finance / funding", "/finance-options/", "Only if current finance products are available. Show representative examples, eligibility, APR, lender details and required disclosures; keep claims approved and up to date."]
  ]
  const events = [
    ["form_start", "Visitor starts a quote / enquiry form", "Secondary"],
    ["form_step_complete", "Each meaningful multi-step form stage completed", "Diagnostic"],
    ["generate_lead", "Valid form successfully submitted and accepted by CRM", "Primary"],
    ["click_to_call", "Visitor clicks a telephone link", "Secondary"],
    ["qualified_call", "Call tracking confirms a connected call meeting agreed duration / quality rules", "Primary when validated"],
    ["appointment_booked", "CRM confirms an appointment is booked", "Primary / imported"],
    ["appointment_held", "Appointment outcome confirms it took place", "Secondary / imported"],
    ["deal_sold", "CRM deal reaches sold status", "Value-based / imported"],
    ["installation_completed", "Installation is completed and value is finalised", "Value-based / imported"]
  ]
  return <div style={{ color: "#172033" }}>
    <div style={{ ...card, background: "#eff6ff", borderColor: "#bfdbfe" }}>
      <strong style={{ color: "#174ea6", fontSize: 14 }}>Landing page strategy for Homeshield</strong>
      <p style={{ margin: "6px 0 0", color: "#1e3a8a", fontSize: 12, lineHeight: 1.65 }}>Paid adverts should land on a page that matches the exact product and promise in the advert—not a generic homepage. Build separate Windows and Solar journeys, keep forms short, and send every accepted enquiry into the CRM with its original source and campaign identifiers.</p>
    </div>
    <section style={card}>
      <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>1. Landing pages to build or improve</h2>
      <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 12 }}>Suggested URL structures only; check existing Homeshield URLs and SEO rankings before creating duplicates or changing live routes.</p>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}><thead><tr>{["Page / journey","Suggested URL","Purpose and content"].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead><tbody>{pages.map(r=><tr key={r[0]}><td style={td}><strong>{r[0]}</strong></td><td style={{ ...td, whiteSpace: "nowrap" }}>{r[1]}</td><td style={td}>{r[2]}</td></tr>)}</tbody></table></div>
      <p style={{ margin: "12px 0 0", color: "#64748b", fontSize: 11 }}>Start with one strong Windows page and one strong Solar page, then add product-specific pages when search volume and campaign structure justify them. These URLs are recommendations, not confirmed existing routes.</p>
    </section>
    <section style={card}>
      <h2 style={{ margin: "0 0 10px", fontSize: 17 }}>2. What every landing page should contain</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
        {[
          ["Above the fold","Clear product-specific headline, short benefit statement, service-area reassurance, strong quote CTA and visible phone number."],
          ["Trust and proof","Recent customer reviews, genuine installation photos, accreditations and relevant local case studies."],
          ["Product detail","Options, benefits, installation process, warranties and answers to common objections. Avoid unsupported savings claims."],
          ["Offer and finance","Show only current, approved discounts or finance terms with all required representative examples and disclosures."],
          ["Enquiry form","Ask only essential qualification questions. Explain what happens next and show privacy information beside the form."],
          ["Mobile experience","Fast loading, readable text, sticky call / quote actions where appropriate, accessible controls and no intrusive pop-ups."]
        ].map(([a,b])=><div key={a} style={{ background: "#f8fafc", borderRadius: 9, padding: 13 }}><strong style={{ fontSize: 12 }}>{a}</strong><p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 11, lineHeight: 1.55 }}>{b}</p></div>)}
      </div>
    </section>
    <section style={card}>
      <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>3. Conversion tracking setup</h2>
      <ol style={{ paddingLeft: 20, margin: 0, fontSize: 12, lineHeight: 1.8 }}>
        <li>Install Google Tag Manager and GA4 correctly across the Homeshield website; link GA4 to Google Ads and install / configure the Meta Pixel through the approved tag setup.</li>
        <li>Implement the cookie banner and Consent Mode / Meta consent controls before advertising tags collect or use data. Validate the behaviour for accept, reject and preferences.</li>
        <li>Track successful form submission from the server / CRM acceptance response or a genuine confirmation state—not simply a button click or page view.</li>
        <li>Use a unique event ID and deduplicate browser and server events if using Meta Conversions API. Prevent refreshes and repeat clicks from counting the same lead twice.</li>
        <li>Capture UTMs, landing page, referrer, gclid, gbraid / wbraid where available, and Meta click identifiers such as fbclid / fbc / fbp, subject to consent and platform rules.</li>
        <li>Pass the lead into the CRM with product, source, campaign, ad / keyword identifiers, timestamp and landing page. Preserve the original attribution when the lead is updated.</li>
        <li>Import later CRM outcomes—qualified, appointment booked / held, sold and installed—back to Google Ads and Meta where eligible, with appropriate click IDs, event times, values and privacy controls.</li>
        <li>Test every event in GA4 DebugView, Google Tag Assistant, Google Ads diagnostics and Meta Events Manager before launch. Reconcile test enquiries against CRM records.</li>
      </ol>
      <div style={{ marginTop: 12, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 9, padding: 12, color: "#9a3412", fontSize: 11, lineHeight: 1.6 }}><strong>Important:</strong> A form button click is not a lead. The primary lead event should fire once only after the CRM accepts a valid enquiry. Do not send personal or sensitive form values into GA4 event names, URLs or page titles.</div>
    </section>
    <section style={card}>
      <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>4. Events and what they mean</h2>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}><thead><tr>{["Event","When it fires","Role"].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead><tbody>{events.map(r=><tr key={r[0]}><td style={td}><strong>{r[0]}</strong></td><td style={td}>{r[1]}</td><td style={td}>{r[2]}</td></tr>)}</tbody></table></div>
      <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: 11 }}>Keep a single agreed definition for each event across the website, analytics, ad platforms and CRM. Do not optimise campaigns to every micro-event; use form leads first, then move towards qualified appointments and sales as reliable volume becomes available.</p>
    </section>
    <section style={card}>
      <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>5. Expected conversion rates – initial planning ranges</h2>
      <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 12, lineHeight: 1.6 }}>These are starting targets for paid landing-page traffic, not promises. Published benchmarks vary by channel, intent, geography and what counts as a conversion. LocaliQ's 2025 search-ad benchmark reports 4.41% for Doors & Windows Sales, against 7.33% across home services. Use Homeshield's own results to replace these assumptions after a meaningful sample.</p>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}><thead><tr>{["Stage / metric","Initial target range","How to interpret it"].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead><tbody>
        {[
          ["Landing-page visitor → valid enquiry","Windows: 3–5% · Solar: 3–6%","Primary website conversion rate. Measure accepted CRM leads, not clicks."],
          ["Visitor → qualified enquiry","Windows: 2–4% · Solar: 2–4%","Lead passes basic service-area, product and contactability checks."],
          ["Enquiry → successfully contacted","70–85%","Operational CRM measure; depends on speed-to-lead and data quality."],
          ["Contacted → appointment booked","20–35%","Measure against genuinely contacted leads, not all leads."],
          ["Booked → appointment held","65–80%","Show rate; report cancellations and reschedules consistently."],
          ["Held appointment → sale","20–30%","Sales conversion; separate by product, source and salesperson."]
        ].map(r=><tr key={r[0]}>{r.map((v,i)=><td key={i} style={td}>{i===0?<strong>{v}</strong>:v}</td>)}</tr>)}
      </tbody></table></div>
      <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: 11 }}>The downstream CRM ranges are proposed management targets for testing, not independently verified industry benchmarks. A higher form conversion rate is not automatically better if qualification or appointment quality falls.</p>
    </section>
    <section style={card}>
      <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>6. Example: what 1,000 paid landing-page visits could produce</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 9 }}>
        {[["Visits","1,000"],["Enquiries at 4%","40"],["Contacted at 75%","30"],["Appointments at 30%","9"],["Held at 75%","7"],["Sales at 25%","1–2"]].map(([a,b])=><div key={a} style={{ background: "#f8fafc", borderRadius: 9, padding: 12 }}><div style={{ color: "#64748b", fontSize: 10 }}>{a}</div><strong style={{ display: "block", fontSize: 20, marginTop: 4 }}>{b}</strong></div>)}
      </div>
      <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: 11 }}>Illustrative funnel only. The rounded stages compound, so actual results can vary materially. Use this to size reporting—not as a forecast of guaranteed sales.</p>
    </section>
    <section style={card}>
      <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>7. Reporting and optimisation</h2>
      <ul style={{ paddingLeft: 20, margin: 0, fontSize: 12, lineHeight: 1.8 }}>
        <li>Report by product, source, campaign, landing page, device, region and week.</li>
        <li>Track landing-page conversion rate, cost per valid lead, contact rate, booked rate, held rate, sold rate, cost per appointment and cost per sale.</li>
        <li>Compare lead quality and net revenue—not just platform-reported leads. Reconcile platform totals against unique CRM leads.</li>
        <li>Review mobile speed, form abandonment and call performance weekly. Test one meaningful page change at a time.</li>
        <li>Do not declare a winner from a handful of conversions; allow enough traffic and time for a fair comparison.</li>
      </ul>
    </section>
    <section style={card}>
      <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>8. Recommended implementation order</h2>
      <ol style={{ paddingLeft: 20, margin: 0, fontSize: 12, lineHeight: 1.8 }}>
        <li>Audit existing Homeshield pages and analytics tags; retain useful SEO URLs and avoid duplicate pages.</li>
        <li>Build / optimise one dedicated Windows page and one dedicated Solar page with product-specific forms.</li>
        <li>Connect forms to CRM and implement reliable lead events, UTMs and click-ID capture.</li>
        <li>Test consent behaviour, call tracking, deduplication and CRM reconciliation end to end.</li>
        <li>Launch campaigns only when the tracking test leads appear correctly in the CRM and analytics platforms.</li>
        <li>After 4–6 weeks and sufficient traffic, replace the planning ranges with Homeshield's observed baseline and run structured landing-page tests.</li>
      </ol>
    </section>
    <div style={{ color: "#94a3b8", fontSize: 11, padding: "0 2px 10px" }}>Planning guidance only · Suggested URL paths need checking against the live website · No website tags, pages or campaigns have been changed by this tab.</div>
  </div>
}



const tabs = [
  { id: "seo", label: "SEO", icon: Search },
  { id: "landing", label: "Landing Pages", icon: PanelsTopLeft },
  { id: "analytics", label: "Analytics", icon: ChartNoAxesCombined },
  { id: "tracking", label: "Conversion Tracking", icon: Activity },
  { id: "content", label: "Content", icon: FileText },
]
const placeholders = {
  analytics: ["Website analytics", "A central view for website traffic, acquisition channels, visitor behaviour, device split and page performance.", ["Users and sessions by channel", "Top landing pages and exit rates", "Engagement by device and location", "Enquiries attributed to organic, paid, direct and referral traffic", "Trend reporting by week and month"]],
  tracking: ["Conversion tracking", "Document and validate how website enquiries and downstream CRM outcomes are measured across GA4, Google Ads and Meta.", ["GA4 and Google Tag Manager configuration", "Form start and successful CRM-accepted lead events", "Telephone click and qualified call tracking", "Appointment, sale and installation imports", "Consent, deduplication and test-event checklist"]],
  content: ["Website content", "Plan and manage the content that supports organic visibility, customer education and conversion.", ["Service-page content priorities", "Blog and article calendar", "Case studies, reviews and installation galleries", "Content review and publishing status", "Internal linking and calls to action"]],
}
export default function Website() {
  const [activeTab, setActiveTab] = useState("seo")
  const tabStyle = active => ({ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 14px", border: 0, borderBottom: active ? "2px solid #12345a" : "2px solid transparent", background: "transparent", color: active ? "#12345a" : "#64748b", fontWeight: active ? 700 : 600, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" })
  const info = placeholders[activeTab]
  return <section style={{ maxWidth: 1400, margin: "0 auto" }}>
    <div role="tablist" aria-label="Website sections" style={{ display: "flex", gap: 5, borderBottom: "1px solid #e2e8f0", marginBottom: 18, overflowX: "auto" }}>
      {tabs.map(({id,label,icon:Icon}) => <button key={id} type="button" role="tab" aria-selected={activeTab===id} onClick={()=>setActiveTab(id)} style={tabStyle(activeTab===id)}><Icon size={15}/>{label}</button>)}
    </div>
    {activeTab === "seo" ? <SEO/> : activeTab === "landing" ? <LandingPagesTab/> : <section style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:20}}>
      <h2 style={{fontSize:19,margin:"0 0 7px",color:"#172033"}}>{info[0]}</h2>
      <p style={{fontSize:13,color:"#64748b",lineHeight:1.6,margin:"0 0 16px"}}>{info[1]}</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:10}}>
        {info[2].map((item,i)=><div key={item} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:9,padding:13,display:"flex",gap:10,alignItems:"flex-start"}}><span style={{width:22,height:22,borderRadius:6,background:"#e2e8f0",display:"grid",placeItems:"center",fontSize:11,fontWeight:700,color:"#334155"}}>{i+1}</span><span style={{fontSize:12,color:"#334155",lineHeight:1.5}}>{item}</span></div>)}
      </div>
      <p style={{fontSize:11,color:"#94a3b8",margin:"16px 0 0"}}>Section structure created. Live integrations and reporting data have not yet been connected.</p>
    </section>}
  </section>
}

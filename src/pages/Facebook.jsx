import React, { useState } from "react"
import { Facebook as FacebookIcon, Users, Target, ShieldCheck, RefreshCw, BarChart3, Mail, MessageSquare, CheckCircle2 } from "lucide-react"

const Section = ({ number, title, children }) => (
  <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 16 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: "#eaf2ff", color: "#1d4ed8", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13 }}>{number}</span>
      <h2 style={{ margin: 0, fontSize: 17, color: "#172033" }}>{title}</h2>
    </div>
    {children}
  </section>
)

const Bullet = ({ children }) => <li style={{ marginBottom: 8, lineHeight: 1.55 }}>{children}</li>

function AudiencesTab() {
  const audiences = [
    ["Windows – All Enquiries", "All eligible Windows enquiries. Use for broad product retargeting and campaign exclusions where appropriate."],
    ["Solar – All Enquiries", "All eligible Solar enquiries, kept separate from Windows for relevant creative and offers."],
    ["No Contact – Windows / Solar", "Enquiries with no successful contact, separated by product and enquiry age. Use softer reminder and awareness messaging."],
    ["Contacted – Not Booked", "People contacted but without an appointment. Focus adverts on trust, benefits and making it easy to arrange a visit."],
    ["Appointment – Not Sold", "People who attended or had an appointment but did not buy. Use testimonials, reassurance and objection-led creative."],
    ["Quotes – Not Sold", "People who received a quote but have not converted. Use relevant product proof points and carefully controlled offers."],
    ["Cancelled / Declined", "A separate win-back group. Review reason and recency before using; avoid treating every cancellation as suitable for the same message."],
    ["Existing Customers – Windows / Solar", "Use one product's completed customers to identify cross-sell opportunities for the other product."],
    ["Completed Customers – Windows / Solar", "High-quality seed groups for product-specific lookalike testing, subject to sufficient audience size and permissions."]
  ]

  const stages = [
    ["1. CRM audience definitions", "Use saved CRM audiences and agreed rules as the source of truth. Keep Windows and Solar separate, define date windows, and document exclusions."],
    ["2. Data preparation", "Deduplicate people, standardise email addresses and UK phone numbers, and include useful matching identifiers such as first name, surname, postcode and country where available."],
    ["3. Eligibility and suppression", "Check the recorded lawful basis, privacy information, objections and suppression requirements before export. Do not assume email/SMS permission automatically permits advertising audience use."],
    ["4. Preview and export", "Show the number of eligible records, usable emails and mobile numbers, duplicate removals and exclusions before generating a Meta customer-list CSV."],
    ["5. Upload and measure", "Upload the file to Meta Ads Manager as a Customer List Custom Audience. Record the CRM segment, export date and audience purpose so results can be compared."],
    ["6. Refresh and automate", "Initially refresh lists on a controlled schedule. Once the process is proven, consider a Meta Marketing API integration to add, update and remove people automatically."]
  ]

  return <main style={{ maxWidth: 1180, margin: "0 auto", color: "#172033", paddingBottom: 32 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
      <div style={{ width: 48, height: 48, borderRadius: 13, background: "#eaf2ff", color: "#1877f2", display: "grid", placeItems: "center" }}><FacebookIcon size={25}/></div>
      <div><h1 style={{ margin: 0, fontSize: 25 }}>Facebook</h1><p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 13 }}>Proposed CRM-to-Meta audience strategy and implementation plan</p></div>
    </div>

    <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: 18, marginBottom: 18 }}>
      <strong style={{ display: "block", color: "#1e40af", marginBottom: 5 }}>Purpose</strong>
      <p style={{ margin: 0, lineHeight: 1.6, color: "#1e3a8a", fontSize: 13 }}>Use Homeshield's CRM data to create accurate Facebook and Instagram Custom Audiences for retargeting, exclusions and lookalike prospecting. This is a proposal only: no Meta connection, audience upload or advertising campaign is being created by this page.</p>
    </div>

    <Section number="1" title="What I recommend">
      <p style={{ margin: "0 0 10px", lineHeight: 1.6 }}>Build a dedicated audience export workflow that uses the CRM as the source of truth. The first release should generate clean, repeatable customer-list CSV files for upload through Meta Ads Manager. Keep the audiences product-specific and split them by the customer's stage in the sales journey.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
        {[[Users,"Retargeting","Reach previous Windows and Solar enquiries with relevant adverts."],[Target,"Lookalikes","Use completed customers as higher-quality seeds to find similar prospects."],[ShieldCheck,"Exclusions","Avoid wasting acquisition spend on existing customers or people already booked."],[RefreshCw,"Regular refresh","Keep lists aligned with changing CRM statuses and customer records."]].map(([Icon,title,desc])=><div key={title} style={{ background: "#f8fafc", borderRadius: 10, padding: 13 }}><Icon size={19} color="#2563eb"/><strong style={{ display: "block", margin: "7px 0 4px", fontSize: 13 }}>{title}</strong><span style={{ color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>{desc}</span></div>)}
      </div>
    </Section>

    <Section number="2" title="Audience groups to create">
      <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 13 }}>These are proposed Meta audiences. They should be built from validated CRM rules, not just copied from a broad lead list.</p>
      <div style={{ display: "grid", gap: 9 }}>
        {audiences.map(([name,desc])=><div key={name} style={{ borderBottom: "1px solid #edf0f4", paddingBottom: 9 }}><strong style={{ fontSize: 13 }}>{name}</strong><p style={{ margin: "3px 0 0", color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>{desc}</p></div>)}
      </div>
    </Section>

    <Section number="3" title="Lookalike audience strategy">
      <p style={{ margin: "0 0 10px", lineHeight: 1.6 }}>Do not use every enquiry as the main lookalike source. A lead list can contain duplicates, unreachable contacts and people who never became customers. Start with people who completed an installation, then compare against larger but less-qualified sources if the seed audience is too small.</p>
      <ol style={{ paddingLeft: 20, margin: 0 }}>
        <Bullet><strong>Primary seed:</strong> completed Windows installations and completed Solar installations, kept separate.</Bullet>
        <Bullet><strong>Secondary seed:</strong> sold customers, after excluding cancellations and failed or incomplete jobs.</Bullet>
        <Bullet><strong>Fallback seed:</strong> booked appointments, if there are not enough completed customers for a useful test.</Bullet>
        <Bullet><strong>Testing:</strong> compare 1% lookalikes with broader percentages and prospecting audiences. Judge by cost per booked appointment and cost per completed installation, not just cost per lead.</Bullet>
      </ol>
    </Section>

    <Section number="4" title="How the CRM export page should work">
      <ol style={{ paddingLeft: 20, margin: 0 }}>
        {stages.map(([title,desc])=><Bullet key={title}><strong>{title}.</strong> {desc}</Bullet>)}
      </ol>
      <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginTop: 12 }}>
        <strong style={{ fontSize: 13 }}>Suggested export fields</strong>
        <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 12, lineHeight: 1.6 }}>Email, phone, first name, surname, postcode, town/city and country, where held and appropriate. Include only the minimum data needed for matching. Meta performs matching; the CRM should not try to identify individual Facebook accounts itself.</p>
      </div>
    </Section>

    <Section number="5" title="Privacy, consent and suppression">
      <p style={{ margin: "0 0 10px", lineHeight: 1.6 }}>This needs to be designed in from the beginning. A person being present in the CRM does not automatically mean their details can be used for every marketing purpose. Confirm the lawful basis and transparency requirements for customer-list advertising, respect objections and suppression requests, and make sure any relevant platform terms are followed.</p>
      <ul style={{ paddingLeft: 20, margin: 0 }}>
        <Bullet>Keep email marketing, SMS marketing and advertising audience eligibility as distinct permissions or eligibility decisions.</Bullet>
        <Bullet>Never include records on a do-not-contact or advertising suppression list.</Bullet>
        <Bullet>Do not infer Meta audience eligibility from email or SMS consent alone.</Bullet>
        <Bullet>Record the export purpose, date, user and audience definition for auditability.</Bullet>
        <Bullet>Set retention and refresh rules so old exports are not kept or reused indefinitely.</Bullet>
      </ul>
    </Section>

    <Section number="6" title="Rollout plan">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
        {[["Phase 1","Manual CSV exports","Build the audience selector, eligibility checks, data cleaning, preview and CSV export. Test with a small Windows and Solar segment."],["Phase 2","Performance-led audiences","Add customer, booked, quote-not-sold and exclusion segments. Compare match rates and campaign outcomes."],["Phase 3","Meta API integration","Explore direct Custom Audience creation and ongoing add/remove updates through Meta's Marketing API, with appropriate access and controls."]].map(([phase,title,desc])=><div key={phase} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}><span style={{ color: "#2563eb", fontSize: 11, fontWeight: 800 }}>{phase}</span><strong style={{ display: "block", margin: "5px 0", fontSize: 14 }}>{title}</strong><p style={{ margin: 0, color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>{desc}</p></div>)}
      </div>
    </Section>

    <Section number="7" title="How success should be measured">
      <ul style={{ paddingLeft: 20, margin: 0 }}>
        <Bullet>Eligible CRM records and usable email/phone identifiers per audience.</Bullet>
        <Bullet>Meta audience match rate and audience size after upload.</Bullet>
        <Bullet>Cost per booked appointment and booking rate.</Bullet>
        <Bullet>Cost per completed installation and revenue generated.</Bullet>
        <Bullet>Incremental performance versus comparable campaigns without CRM audiences.</Bullet>
      </ul>
    </Section>

    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 17 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}><CheckCircle2 size={18} color="#15803d"/><strong style={{ fontSize: 14 }}>Recommended starting point</strong></div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>Start with four exports: Windows completed customers, Solar completed customers, Windows enquiries not yet sold and Solar enquiries not yet sold. This gives Homeshield two strong customer seed audiences and two practical retargeting audiences while keeping the first release manageable.</p>
    </div>
    <p style={{ margin: "14px 2px 0", color: "#94a3b8", fontSize: 11 }}>Planning document only · No audience data has been exported or sent to Meta.</p>
  </main>
}
 
function CampaignsTab() {
  const card = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 18, marginBottom: 15 }
  const th = { textAlign: "left", padding: "10px 9px", background: "#f1f5f9", color: "#475569", fontSize: 11, whiteSpace: "nowrap" }
  const td = { padding: "11px 9px", borderBottom: "1px solid #edf1f5", fontSize: 12, verticalAlign: "top" }
  const campaigns = [
    { name: "Windows | New customer acquisition", objective: "Leads", budget: "£25/day · £750/month", creatives: "5", cpc: "£1.00–£2.20", cpl: "£25–£45", audience: "Broad Scotland homeowner targeting; test 1% lookalike from completed Windows customers when seed size allows.", message: "Windows, doors, home comfort, product quality, finance/offer messaging where currently approved." },
    { name: "Solar | New customer acquisition", objective: "Leads", budget: "£25/day · £750/month", creatives: "5", cpc: "£1.30–£2.80", cpl: "£35–£65", audience: "Broad eligible Scottish homeowners; separate Solar completed-customer lookalike test.", message: "Potential bill savings, battery storage, system design, customer proof and realistic payback education." },
    { name: "Warm audiences | Retargeting", objective: "Leads / conversions", budget: "£10/day · £300/month", creatives: "4 (2 Windows, 2 Solar)", cpc: "£0.60–£1.60", cpl: "£15–£35", audience: "Recent website visitors, Facebook/Instagram engagers and eligible CRM audiences: contacted-not-booked, quote-not-sold and appointment-not-sold.", message: "Trust, reviews, FAQs, objections, reminders and clear next steps. Keep product and sales-stage messaging relevant." }
  ]
  const creativePlan = [
    ["1. Customer proof", "Short customer testimonial / installation video", "Trust and reassurance"],
    ["2. Transformation", "Before-and-after carousel (3–5 cards)", "Show the home improvement clearly"],
    ["3. Product explainer", "15–30 second vertical video", "Explain product, process and key benefits"],
    ["4. Offer / proposition", "Static image or simple motion graphic", "One clear offer or reason to enquire; use only currently approved claims"],
    ["5. Education", "Carousel or talking-head video", "Answer a common objection or explain the next step"]
  ]
  return <div style={{ color: "#172033" }}>
    <div style={{ ...card, background: "#eff6ff", borderColor: "#bfdbfe" }}>
      <div style={{ color: "#1e40af", fontWeight: 800, fontSize: 14, marginBottom: 5 }}>Recommended pilot · 30 days</div>
      <div style={{ fontSize: 13, color: "#1e3a8a", lineHeight: 1.6 }}>Start with a controlled £60/day test budget (£1,800 over 30 days). Keep Windows and Solar acquisition separate so their lead costs and quality can be judged independently. Add a small retargeting budget and scale only after CRM outcomes—not just cheap leads—support it.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 14 }}>
        {[["Daily budget","£60"],["30-day budget","£1,800"],["Campaigns","3"],["Creative assets","14"]].map(([label,value])=><div key={label} style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: 9, padding: 11 }}><div style={{ fontSize: 10, color: "#64748b" }}>{label}</div><strong style={{ display: "block", fontSize: 20, color: "#173b66", marginTop: 3 }}>{value}</strong></div>)}
      </div>
    </div>
    <section style={card}>
      <h2 style={{ margin: "0 0 6px", fontSize: 17 }}>Campaign structure and planning estimates</h2>
      <p style={{ margin: "0 0 13px", color: "#64748b", fontSize: 12, lineHeight: 1.55 }}>Indicative starting assumptions for planning—not live Meta forecasts or guaranteed results. Actual CPC/CPL will vary by season, creative, location, landing page, offer and lead form quality. Reassess using Homeshield's booked appointments and sold outcomes.</p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 850, borderCollapse: "collapse" }}>
          <thead><tr>{["Campaign","Budget","Creatives","Est. CPC","Est. CPL","Audience / approach"].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead>
          <tbody>{campaigns.map(c=><tr key={c.name}><td style={td}><strong>{c.name}</strong><div style={{ color: "#64748b", marginTop: 4 }}>{c.objective}</div></td><td style={{ ...td, whiteSpace: "nowrap" }}>{c.budget}</td><td style={td}>{c.creatives}</td><td style={{ ...td, whiteSpace: "nowrap" }}>{c.cpc}</td><td style={{ ...td, whiteSpace: "nowrap", fontWeight: 700, color: "#14532d" }}>{c.cpl}</td><td style={td}>{c.audience}</td></tr>)}</tbody>
        </table>
      </div>
      <div style={{ marginTop: 13, padding: 12, borderRadius: 8, background: "#f8fafc", fontSize: 12, color: "#475569" }}><strong>Budget allocation:</strong> Windows £750 + Solar £750 + Retargeting £300 = £1,800 per 30-day pilot. The retargeting campaign can be split into separate ad sets by product once each audience is large enough to deliver.</div>
    </section>
    <section style={card}>
      <h2 style={{ margin: "0 0 6px", fontSize: 17 }}>Creative production plan</h2>
      <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 12 }}>Build five core concepts per product for acquisition (10 assets total), plus four retargeting variants. Adapt each concept into 9:16 vertical and 4:5 feed formats where possible.</p>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 550 }}><thead><tr>{["Creative","Format / concept","Purpose"].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead><tbody>{creativePlan.map(([a,b,c])=><tr key={a}><td style={td}><strong>{a}</strong></td><td style={td}>{b}</td><td style={td}>{c}</td></tr>)}</tbody></table></div>
      <p style={{ margin: "12px 0 0", color: "#64748b", fontSize: 11 }}>Retargeting variants: customer review, quote follow-up reassurance, FAQs/objection handling, and a simple book-a-survey call to action. Keep Solar and Windows assets distinct.</p>
    </section>
    <section style={card}>
      <h2 style={{ margin: "0 0 10px", fontSize: 17 }}>How to use the CRM audiences</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
        {[
          ["Prospecting","Broad Scotland audiences first. Test completed Windows and Solar customer lookalikes as separate ad sets only when each seed is sufficiently large and eligible."],
          ["Warm retargeting","Use recent site visitors and social engagers, then eligible CRM groups such as contacted-not-booked and quote-not-sold. Apply product-specific creative."],
          ["Suppressions","Exclude recent leads already booked, sold customers for the same product, duplicate records and all applicable advertising suppression records."],
          ["Win-back","Test older cancelled/declined or no-contact audiences separately with low spend and tailored creative; do not mix them into the main warm pool."]
        ].map(([title,desc])=><div key={title} style={{ background: "#f8fafc", borderRadius: 9, padding: 13 }}><strong style={{ fontSize: 13 }}>{title}</strong><p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>{desc}</p></div>)}
      </div>
    </section>
    <section style={card}>
      <h2 style={{ margin: "0 0 10px", fontSize: 17 }}>30-day optimisation plan</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
        {[
          ["Days 1–7 · Learn","Launch all three campaigns with the planned creative mix. Check tracking, lead delivery and CRM source attribution daily. Avoid making decisions from a handful of leads."],
          ["Days 8–14 · Improve","Compare CPC, CTR, form completion and CPL by creative. Pause clear underperformers only after enough delivery; replace with new angles."],
          ["Days 15–21 · Quality","Compare contact rate, booked appointments and cost per booked appointment by campaign and audience. Tighten poor-quality placements or forms."],
          ["Days 22–30 · Reallocate","Move budget toward the product/audience combinations generating better qualified appointments and sales. Plan the next creative batch from objections and winning messages."]
        ].map(([title,desc])=><div key={title} style={{ borderLeft: "3px solid #3b82f6", background: "#f8fafc", padding: 12, borderRadius: "0 8px 8px 0" }}><strong style={{ fontSize: 12 }}>{title}</strong><p style={{ margin: "5px 0 0", fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{desc}</p></div>)}
      </div>
    </section>
    <section style={card}>
      <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>Measurement dashboard</h2>
      <p style={{ margin: "0 0 10px", color: "#64748b", fontSize: 12 }}>Track these at campaign, ad set and creative level, then join them to CRM outcomes using a consistent campaign/source naming convention.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}>
        {[["Delivery","Spend · Reach · Frequency · CPM"],["Traffic","Link CPC · CTR · Landing page views"],["Lead generation","Leads · Form completion · CPL"],["Sales quality","Contact rate · Booked rate · Cost per booked appointment"],["Commercial result","Sold rate · Cost per sale · Revenue / spend"]].map(([title,desc])=><div key={title} style={{ padding: 11, background: "#f8fafc", borderRadius: 8 }}><strong style={{ fontSize: 12 }}>{title}</strong><div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{desc}</div></div>)}
      </div>
    </section>
    <div style={{ color: "#94a3b8", fontSize: 11, padding: "0 2px 10px" }}>Planning assumptions only. No campaigns have been created, no ads have been published and no budget has been spent.</div>
  </div>
}

export default function Facebook() {
  const [activeTab, setActiveTab] = useState("audiences")
  const tabStyle = active => ({ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 16px", border: 0, borderBottom: active ? "2px solid #1877f2" : "2px solid transparent", background: "transparent", color: active ? "#1554a6" : "#64748b", fontWeight: active ? 700 : 600, cursor: "pointer", fontSize: 13 })
  return <section style={{ maxWidth: 1400, margin: "0 auto" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 9, borderBottom: "1px solid #e2e8f0", marginBottom: 18 }}>
      <button type="button" role="tab" aria-selected={activeTab === "audiences"} onClick={() => setActiveTab("audiences")} style={tabStyle(activeTab === "audiences")}><Users size={16}/>Audiences</button>
      <button type="button" role="tab" aria-selected={activeTab === "campaigns"} onClick={() => setActiveTab("campaigns")} style={tabStyle(activeTab === "campaigns")}><BarChart3 size={16}/>Campaigns</button>
    </div>
    {activeTab === "audiences" ? <AudiencesTab/> : <CampaignsTab/>}
  </section>
}

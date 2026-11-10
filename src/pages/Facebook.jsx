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
    { name: "Windows | New customer acquisition", objective: "Leads", budget: "£60/day · £420/week", creatives: "5", cpc: "£1.00–£2.20", cpl: "£25–£45", audience: "Broad Scotland homeowner targeting; test 1% lookalike from completed Windows customers when seed size allows.", message: "Windows, doors, home comfort, product quality, finance/offer messaging where currently approved." },
    { name: "Solar | New customer acquisition", objective: "Leads", budget: "£25/day · £750/month", creatives: "5", cpc: "£1.30–£2.80", cpl: "£35–£65", audience: "Broad eligible Scottish homeowners; separate Solar completed-customer lookalike test.", message: "Potential bill savings, battery storage, system design, customer proof and realistic payback education." },
    { name: "Warm audiences | Retargeting", objective: "Leads / conversions", budget: "£23/day · £161/week", creatives: "4 (2 Windows, 2 Solar)", cpc: "£0.60–£1.60", cpl: "£15–£35", audience: "Recent website visitors, Facebook/Instagram engagers and eligible CRM audiences: contacted-not-booked, quote-not-sold and appointment-not-sold.", message: "Trust, reviews, FAQs, objections, reminders and clear next steps. Keep product and sales-stage messaging relevant." }
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
      <div style={{ color: "#1e40af", fontWeight: 800, fontSize: 14, marginBottom: 5 }}>Recommended weekly budget · £1,000</div>
      <div style={{ fontSize: 13, color: "#1e3a8a", lineHeight: 1.6 }}>Scale the working plan to approximately £1,000 per week (£4,337 average month). Keep Windows and Solar acquisition separate so lead costs and quality can be judged independently, with a dedicated retargeting allocation. Review performance against booked appointments, sales and net revenue—not just cheap leads.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 14 }}>
        {[["Daily budget","£143"],["Weekly budget","£1,001"],["Monthly equivalent","£4,337"],["Creative assets","14"]].map(([label,value])=><div key={label} style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: 9, padding: 11 }}><div style={{ fontSize: 10, color: "#64748b" }}>{label}</div><strong style={{ display: "block", fontSize: 20, color: "#173b66", marginTop: 3 }}>{value}</strong></div>)}
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
      <div style={{ marginTop: 13, padding: 12, borderRadius: 8, background: "#f8fafc", fontSize: 12, color: "#475569" }}><strong>Budget allocation:</strong> Windows £420/week + Solar £420/week + Retargeting £161/week = £1,001/week (approximately £4,337 per average month). Retargeting can be split into separate ad sets by product once each audience is large enough to deliver.</div>
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
          ["Week 1 · Learn","Launch all three campaigns at the planned weekly allocations and check tracking, lead delivery and CRM source attribution daily. Avoid making decisions from a handful of leads."],
          ["Week 2 · Improve","Compare CPC, CTR, form completion and CPL by creative. Pause clear underperformers only after enough delivery; replace with new angles. Keep the weekly total close to £1,000."],
          ["Week 3 · Quality","Compare contact rate, booked appointments and cost per booked appointment by campaign and audience. Tighten poor-quality placements or forms; keep budget shifts within the weekly envelope."],
          ["Week 4 · Reallocate","Move budget toward the product/audience combinations generating better qualified appointments and sales while maintaining roughly £1,000 total weekly spend. Plan the next creative batch from objections and winning messages."]
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


function FacebookAdsTab() {
  const [facebookTab, setFacebookTab] = useState("plan")
  const tabStyle = active => ({ padding: "9px 13px", border: 0, borderBottom: active ? "2px solid #1877f2" : "2px solid transparent", background: "transparent", color: active ? "#1554a6" : "#64748b", fontWeight: active ? 700 : 600, cursor: "pointer", fontSize: 12 })
  return <div style={{ color: "#172033" }}>
    <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #e2e8f0", marginBottom: 16 }}>
      <button type="button" role="tab" aria-selected={facebookTab === "plan"} onClick={() => setFacebookTab("plan")} style={tabStyle(facebookTab === "plan")}>Campaign plan</button>
      <button type="button" role="tab" aria-selected={facebookTab === "audiences"} onClick={() => setFacebookTab("audiences")} style={tabStyle(facebookTab === "audiences")}>Audience setup</button>
    </div>
    {facebookTab === "plan" ? <CampaignsTab/> : <AudiencesTab/>}
  </div>
}


function GoogleAdsTab() {
  const [googleTab, setGoogleTab] = useState("plan")
  const tabStyle = active => ({ padding: "9px 13px", border: 0, borderBottom: active ? "2px solid #4285f4" : "2px solid transparent", background: "transparent", color: active ? "#174ea6" : "#64748b", fontWeight: active ? 700 : 600, cursor: "pointer", fontSize: 12 })
  const card = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 18, marginBottom: 15 }
  const th = { textAlign: "left", padding: "10px 9px", background: "#f1f5f9", color: "#475569", fontSize: 11 }
  const td = { padding: "11px 9px", borderBottom: "1px solid #edf1f5", fontSize: 12, verticalAlign: "top" }
  return <div style={{ color: "#172033" }}>
    <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #e2e8f0", marginBottom: 16 }}>
      <button type="button" role="tab" aria-selected={googleTab === "plan"} onClick={() => setGoogleTab("plan")} style={tabStyle(googleTab === "plan")}>Campaign plan</button>
      <button type="button" role="tab" aria-selected={googleTab === "audiences"} onClick={() => setGoogleTab("audiences")} style={tabStyle(googleTab === "audiences")}>Audience setup</button>
    </div>
    {googleTab === "plan" ? <>
      <div style={{ ...card, background: "#eff6ff", borderColor: "#bfdbfe" }}>
        <div style={{ color: "#174ea6", fontWeight: 800, fontSize: 14, marginBottom: 5 }}>Recommended weekly budget · £1,000</div>
        <p style={{ margin: 0, color: "#1e3a8a", fontSize: 13, lineHeight: 1.6 }}>Capture existing demand from people actively searching for windows, doors, solar panels and battery storage. Keep product campaigns separate and optimise against qualified appointments and sales, not just form fills.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 9, marginTop: 13 }}>
          {[["Daily average","£142.86"],["Weekly budget","£1,000"],["Monthly equivalent","£4,333"],["Annual equivalent","£52,000"]].map(([k,v])=><div key={k} style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: 9, padding: 11 }}><div style={{ fontSize: 10, color: "#64748b" }}>{k}</div><strong style={{ display: "block", fontSize: 19, color: "#173b66", marginTop: 3 }}>{v}</strong></div>)}
        </div>
      </div>
      <section style={card}>
        <h2 style={{ margin: "0 0 6px", fontSize: 17 }}>Campaign structure and budget</h2>
        <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 12 }}>Planning allocation. Google may spend above an average daily budget on individual days, while respecting its monthly charging limit. Review actual spend weekly.</p>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 650 }}><thead><tr>{["Campaign","Daily average","Weekly budget","Share","Purpose"].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead><tbody>
          {[
            ["Windows Search","£78.57","£550","55%","High-intent double glazing, replacement windows and doors searches."],
            ["Solar Search","£50.00","£350","35%","Solar panel installation, home batteries and solar pricing searches."],
            ["Brand Search","£7.14","£50","5%","Protect searches for Homeshield and brand/product combinations."],
            ["Remarketing","£7.14","£50","5%","Re-engage eligible previous website visitors where audience size allows."]
          ].map(r=><tr key={r[0]}>{r.map((v,i)=><td key={i} style={td}>{i===0?<strong>{v}</strong>:v}</td>)}</tr>)}
        </tbody></table></div>
        <p style={{ margin: "12px 0 0", color: "#64748b", fontSize: 11 }}>If remarketing lists are too small to serve, move that £50 into the best-performing Search campaign. Brand spend should be checked for incremental value and competitor pressure.</p>
      </section>
      <section style={card}>
        <h2 style={{ margin: "0 0 10px", fontSize: 17 }}>Recommended Search ad groups</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>
          <div style={{ background: "#f8fafc", borderRadius: 9, padding: 13 }}><strong>Windows & doors</strong><ul style={{ paddingLeft: 18, margin: "7px 0 0", fontSize: 12, lineHeight: 1.7 }}><li>Double glazing installers</li><li>Replacement windows</li><li>uPVC windows</li><li>Window prices / quotes</li><li>Composite and replacement doors</li></ul></div>
          <div style={{ background: "#f8fafc", borderRadius: 9, padding: 13 }}><strong>Solar</strong><ul style={{ paddingLeft: 18, margin: "7px 0 0", fontSize: 12, lineHeight: 1.7 }}><li>Solar panel installers</li><li>Solar panels for homes</li><li>Solar battery storage</li><li>Solar installation costs</li><li>Solar and battery packages</li></ul></div>
        </div>
        <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: 12 }}>Start with tightly themed exact and phrase match keywords, then expand based on the search-terms report. Add negatives for jobs, careers, DIY, training, free panels and irrelevant commercial intent.</p>
      </section>
      <section style={card}>
        <h2 style={{ margin: "0 0 10px", fontSize: 17 }}>Location, ads and landing pages</h2>
        <ul style={{ paddingLeft: 20, margin: 0, fontSize: 12, lineHeight: 1.8 }}>
          <li>Target only the postcodes and towns Homeshield genuinely services. Use the location option for people regularly in or located in the target areas, not merely interested in them.</li>
          <li>Separate Windows and Solar campaigns, ad copy and landing pages. Split regions only when there is enough data to manage them independently.</li>
          <li>Use responsive search ads with local proof, reviews, product benefits and a clear quote action.</li>
          <li>Only advertise discounts, finance rates, savings or scheme eligibility when the exact claim is current, approved and substantiated.</li>
          <li>Use call assets during staffed hours and track qualified calls, not just clicks on phone numbers.</li>
        </ul>
      </section>
      <section style={card}>
        <h2 style={{ margin: "0 0 10px", fontSize: 17 }}>Conversion tracking and CRM feedback</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(175px,1fr))", gap: 8 }}>
          {[
            ["Enquiry submitted","Track validated form submissions and deduplicate repeat events."],
            ["Qualified phone call","Count calls that meet a meaningful duration and quality threshold."],
            ["Appointment booked","Import CRM booking outcomes with a consistent click identifier."],
            ["Sale / installation","Feed back sold and completed outcomes where tracking and consent requirements are met."]
          ].map(([a,b])=><div key={a} style={{ background: "#f8fafc", borderRadius: 9, padding: 12 }}><strong style={{ fontSize: 12 }}>{a}</strong><p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 11, lineHeight: 1.5 }}>{b}</p></div>)}
        </div>
        <p style={{ margin: "11px 0 0", color: "#64748b", fontSize: 12 }}>Initially use validated enquiries as a conversion while checking data quality. Once reliable, prioritise qualified appointments and offline sales imports so bidding can optimise towards commercial outcomes.</p>
      </section>
      <section style={card}>
        <h2 style={{ margin: "0 0 10px", fontSize: 17 }}>First four weeks</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
          {[
            ["Week 1 · Launch","Check conversion tracking, service areas, keywords, landing pages and lead delivery. Start with the planned budget."],
            ["Week 2 · Search quality","Review search terms, add negative keywords, assess device and location performance."],
            ["Week 3 · Lead quality","Compare contact rates, appointments and cost per booked appointment by campaign."],
            ["Week 4 · Reallocate","Shift spend towards the best qualified demand while keeping the overall weekly budget near £1,000."]
          ].map(([a,b])=><div key={a} style={{ borderLeft: "3px solid #4285f4", background: "#f8fafc", padding: 12, borderRadius: "0 8px 8px 0" }}><strong style={{ fontSize: 12 }}>{a}</strong><p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 11, lineHeight: 1.5 }}>{b}</p></div>)}
        </div>
      </section>
      <div style={{ color: "#94a3b8", fontSize: 11, padding: "0 2px 10px" }}>Planning only. No Google Ads account has been connected and no campaigns or budgets have been created.</div>
    </> : <>
      <div style={{ ...card, background: "#eff6ff", borderColor: "#bfdbfe" }}>
        <strong style={{ color: "#174ea6", fontSize: 14 }}>Audience strategy: separate observation from targeting</strong>
        <p style={{ margin: "6px 0 0", color: "#1e3a8a", fontSize: 12, lineHeight: 1.6 }}>For Search campaigns, add useful audience segments in Observation first. This lets Homeshield compare performance without restricting who can see Search ads. Use Targeting only when intentionally running a tightly defined audience-only campaign.</p>
      </div>
      <section style={card}>
        <h2 style={{ margin: "0 0 10px", fontSize: 17 }}>1. Build first-party website audiences in GA4</h2>
        <ol style={{ paddingLeft: 20, margin: 0, fontSize: 12, lineHeight: 1.8 }}>
          <li>Link the correct Google Ads account to the Homeshield GA4 property and enable the required personalised advertising and data-sharing settings.</li>
          <li>Confirm the Google tag and Consent Mode implementation, including the site's cookie consent choices, before collecting advertising audiences.</li>
          <li>Create separate Windows and Solar audiences; do not mix product journeys.</li>
          <li>Publish the audiences to the linked Google Ads account and check they populate before relying on them.</li>
        </ol>
      </section>
      <section style={card}>
        <h2 style={{ margin: "0 0 10px", fontSize: 17 }}>2. Recommended audience segments</h2>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}><thead><tr>{["Audience","Suggested membership rule","Use"].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead><tbody>
          {[
            ["Windows site visitors – 30 days","Visited windows, doors or relevant quote pages in the last 30 days; exclude completed enquiry confirmation events.","Display remarketing and Search Observation."],
            ["Solar site visitors – 30 days","Visited solar, battery or solar quote pages in the last 30 days; exclude completed enquiry confirmation events.","Solar remarketing and Search Observation."],
            ["Quote / form starters – 30 days","Started a relevant quote or enquiry journey but did not submit; exclude converters.","High-intent remarketing, where volume allows."],
            ["All website visitors – 90 days","Any eligible site visitor in the last 90 days; exclude recent converters and existing customers where identifiable.","Broader remarketing fallback."],
            ["Past converters – 180 days","Completed lead submission or booked appointment, segmented by product and event.","Exclusions from acquisition; analyse separately."],
            ["Existing customers","Completed Windows or Solar customers, kept as separate groups.","Exclude same-product acquisition; consider cross-sell only with appropriate permissions."]
          ].map(r=><tr key={r[0]}>{r.map((v,i)=><td key={i} style={td}>{i===0?<strong>{v}</strong>:v}</td>)}</tr>)}
        </tbody></table></div>
        <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: 11 }}>These are audience definitions, not guaranteed audience sizes. Membership depends on eligible consented traffic, tagging and Google's minimum thresholds.</p>
      </section>
      <section style={card}>
        <h2 style={{ margin: "0 0 10px", fontSize: 17 }}>3. Add audiences to Search campaigns</h2>
        <ul style={{ paddingLeft: 20, margin: 0, fontSize: 12, lineHeight: 1.8 }}>
          <li>Open each Search campaign or ad group, go to Audiences and add the relevant segments in <strong>Observation</strong>.</li>
          <li>For Windows Search, observe Windows visitors, quote starters, past Windows converters and relevant in-market home improvement segments.</li>
          <li>For Solar Search, observe Solar visitors, solar quote starters, past Solar converters and relevant solar / renewable-energy segments.</li>
          <li>Review performance by audience after meaningful volume. Do not assume an audience is better simply because it has a higher conversion rate on a tiny sample.</li>
          <li>Keep Search keyword targeting open; Observation should not narrow the campaign's reach.</li>
        </ul>
      </section>
      <section style={card}>
        <h2 style={{ margin: "0 0 10px", fontSize: 17 }}>4. In-market and custom segments</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          <div style={{ background: "#f8fafc", borderRadius: 9, padding: 13 }}><strong>Windows / home improvement</strong><p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 12, lineHeight: 1.6 }}>Test available Google in-market or detailed-demographic segments relevant to home improvement, windows, doors and home renovation. Segment availability varies by campaign type.</p></div>
          <div style={{ background: "#f8fafc", borderRadius: 9, padding: 13 }}><strong>Solar / energy</strong><p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 12, lineHeight: 1.6 }}>Test available renewable energy, solar and energy-efficiency segments. Build custom segments around relevant search terms and competitor/product research where the campaign type supports them.</p></div>
        </div>
      </section>
      <section style={card}>
        <h2 style={{ margin: "0 0 10px", fontSize: 17 }}>5. Customer Match from the CRM</h2>
        <ol style={{ paddingLeft: 20, margin: 0, fontSize: 12, lineHeight: 1.8 }}>
          <li>Create separate, purpose-specific lists: completed Windows customers, completed Solar customers, Windows enquiries and Solar enquiries.</li>
          <li>Only upload first-party data where Homeshield has the required notices, lawful basis and permissions for the intended advertising use, and has honoured objections and suppression requests.</li>
          <li>Normalise email and phone data, minimise fields, protect exports and document the audience purpose and refresh date.</li>
          <li>Check current Google Customer Match eligibility, account requirements and policy restrictions before attempting an upload. Do not assume every CRM contact is eligible.</li>
          <li>Use customer lists for appropriate exclusions, observation or remarketing where permitted; keep product groups separate.</li>
        </ol>
      </section>
      <section style={card}>
        <h2 style={{ margin: "0 0 10px", fontSize: 17 }}>6. Exclusions and audience hygiene</h2>
        <ul style={{ paddingLeft: 20, margin: 0, fontSize: 12, lineHeight: 1.8 }}>
          <li>Exclude recent converters from the same product's lead-generation remarketing and acquisition where appropriate.</li>
          <li>Exclude completed Windows customers from Windows acquisition; exclude completed Solar customers from Solar acquisition. Do not automatically exclude them from the other product's cross-sell activity.</li>
          <li>Refresh CRM lists regularly and remove records that become ineligible, object or request suppression.</li>
          <li>Set sensible membership durations and avoid retaining audiences longer than the campaign purpose requires.</li>
        </ul>
      </section>
      <section style={{ ...card, background: "#fffaf0", borderColor: "#f3dfb5" }}>
        <h2 style={{ margin: "0 0 7px", fontSize: 15, color: "#854d0e" }}>Privacy and measurement guardrails</h2>
        <p style={{ margin: 0, color: "#78350f", fontSize: 12, lineHeight: 1.7 }}>A CRM record or email/SMS marketing permission does not automatically make someone eligible for Google personalised advertising or Customer Match. Confirm the lawful basis, transparency, consent signals where required, Google's policies and current Customer Match eligibility. Keep consent mode and cookie controls working as intended, and do not upload sensitive or unnecessary customer data.</p>
      </section>
    </>}
  </div>
}

export default function Facebook() {
  const [activeTab, setActiveTab] = useState("facebook")
  const tabStyle = active => ({ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 16px", border: 0, borderBottom: active ? "2px solid #1877f2" : "2px solid transparent", background: "transparent", color: active ? "#1554a6" : "#64748b", fontWeight: active ? 700 : 600, cursor: "pointer", fontSize: 13 })
  return <section style={{ maxWidth: 1400, margin: "0 auto" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 9, borderBottom: "1px solid #e2e8f0", marginBottom: 18 }}>
      <button type="button" role="tab" aria-selected={activeTab === "facebook"} onClick={() => setActiveTab("facebook")} style={tabStyle(activeTab === "facebook")}><FacebookIcon size={16}/>Facebook Ads</button>
      <button type="button" role="tab" aria-selected={activeTab === "google"} onClick={() => setActiveTab("google")} style={tabStyle(activeTab === "google")}><BarChart3 size={16}/>Google Ads</button>
      <button type="button" role="tab" aria-selected={activeTab === "landing"} onClick={() => setActiveTab("landing")} style={tabStyle(activeTab === "landing")}><Target size={16}/>Landing Pages & Tracking</button>
    </div>
    {activeTab === "facebook" ? <FacebookAdsTab/> : activeTab === "google" ? <GoogleAdsTab/> : <LandingPagesTab/>}
  </section>
}

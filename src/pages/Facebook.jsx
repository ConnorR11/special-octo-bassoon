import React from "react"
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

export default function Facebook() {
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

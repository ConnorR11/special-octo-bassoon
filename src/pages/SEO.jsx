import React from "react"
import { Search, MousePointerClick, Eye, TrendingUp, Globe2, BarChart3, ExternalLink, RefreshCw } from "lucide-react"

const MetricCard = ({ icon: Icon, label, value, note }) => (
  <div className="seo-metric-card">
    <div className="seo-metric-icon"><Icon size={18} /></div>
    <div className="seo-metric-label">{label}</div>
    <div className="seo-metric-value">{value}</div>
    <div className="seo-metric-note">{note}</div>
  </div>
)

function SEO() {
  return (
    <section className="seo-page">
      <style>{`
        .seo-page{min-height:calc(100vh - 90px);padding:28px 32px 40px;background:#f5f7fa;color:#172033;font-family:Inter,Arial,sans-serif;box-sizing:border-box}
        .seo-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:24px}
        .seo-eyebrow{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:7px}
        .seo-head h1{margin:0;font-size:30px;line-height:1.1;color:#0f172a}
        .seo-head p{margin:8px 0 0;color:#64748b;font-size:13px}
        .seo-actions{display:flex;gap:8px}
        .seo-button{height:36px;padding:0 12px;border:1px solid #d7dee7;border-radius:8px;background:#fff;color:#334155;font:600 12px Inter,Arial,sans-serif;display:flex;align-items:center;gap:7px}
        .seo-button.primary{background:#00304b;border-color:#00304b;color:#fff}
        .seo-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}
        .seo-metric-card,.seo-panel{background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 1px 2px rgba(15,23,42,.03)}
        .seo-metric-card{padding:16px}
        .seo-metric-icon{width:32px;height:32px;border-radius:8px;background:#eef5f8;color:#00304b;display:flex;align-items:center;justify-content:center;margin-bottom:12px}
        .seo-metric-label{font-size:11px;color:#64748b;font-weight:700}
        .seo-metric-value{font-size:24px;font-weight:800;color:#0f172a;margin-top:4px}
        .seo-metric-note{font-size:10px;color:#94a3b8;margin-top:4px}
        .seo-columns{display:grid;grid-template-columns:1.35fr .65fr;gap:16px}
        .seo-panel{padding:18px}
        .seo-panel-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
        .seo-panel-title{font-size:14px;font-weight:800;color:#0f172a}
        .seo-panel-subtitle{font-size:11px;color:#94a3b8;margin-top:3px}
        .seo-empty{border:1px dashed #cbd5e1;border-radius:9px;padding:28px 20px;text-align:center;background:#f8fafc}
        .seo-empty-icon{width:42px;height:42px;border-radius:50%;background:#e8f1f5;color:#00304b;display:flex;align-items:center;justify-content:center;margin:0 auto 12px}
        .seo-empty strong{display:block;font-size:13px;color:#334155}
        .seo-empty span{display:block;max-width:480px;margin:7px auto 0;font-size:11px;line-height:1.5;color:#64748b}
        .seo-table{width:100%;border-collapse:collapse}
        .seo-table th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;padding:8px;border-bottom:1px solid #e2e8f0}
        .seo-table td{font-size:11px;color:#475569;padding:11px 8px;border-bottom:1px solid #f1f5f9}
        .seo-status{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:700;color:#64748b}
        .seo-dot{width:7px;height:7px;border-radius:50%;background:#cbd5e1}
        @media(max-width:900px){.seo-page{padding:22px 18px 30px}.seo-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.seo-columns{grid-template-columns:1fr}.seo-head{flex-direction:column}.seo-actions{width:100%}}
        @media(max-width:520px){.seo-grid{grid-template-columns:1fr}.seo-head h1{font-size:25px}}
      `}</style>
      <div className="seo-head">
        <div><div className="seo-eyebrow">Head Office</div><h1>SEO Dashboard</h1><p>Organic search performance for the Homeshield Scotland website.</p></div>
        <div className="seo-actions"><button className="seo-button"><RefreshCw size={14}/>Refresh</button><button className="seo-button primary"><Search size={14}/>Connect Search Console</button></div>
      </div>
      <div className="seo-grid">
        <MetricCard icon={MousePointerClick} label="Organic clicks" value="—" note="Connect Search Console" />
        <MetricCard icon={Eye} label="Impressions" value="—" note="Connect Search Console" />
        <MetricCard icon={TrendingUp} label="Average position" value="—" note="Connect Search Console" />
        <MetricCard icon={BarChart3} label="Organic CTR" value="—" note="Connect Search Console" />
      </div>
      <div className="seo-columns">
        <div className="seo-panel">
          <div className="seo-panel-head"><div><div className="seo-panel-title">Search performance</div><div className="seo-panel-subtitle">Clicks, impressions and average position</div></div><span className="seo-status"><span className="seo-dot"/>Not connected</span></div>
          <div className="seo-empty"><div className="seo-empty-icon"><Globe2 size={20}/></div><strong>Google Search Console is not connected</strong><span>Once connected, this section will show your organic search trend and month-on-month performance directly inside the CRM.</span></div>
        </div>
        <div className="seo-panel">
          <div className="seo-panel-head"><div><div className="seo-panel-title">Top keywords</div><div className="seo-panel-subtitle">Highest-performing search queries</div></div></div>
          <table className="seo-table"><thead><tr><th>Keyword</th><th>Position</th><th>Clicks</th></tr></thead><tbody><tr><td colSpan="3" style={{textAlign:"center",color:"#94a3b8",padding:"28px 8px"}}>No data yet</td></tr></tbody></table>
        </div>
        <div className="seo-panel">
          <div className="seo-panel-head"><div><div className="seo-panel-title">Top landing pages</div><div className="seo-panel-subtitle">Organic traffic by page</div></div><ExternalLink size={15} color="#94a3b8"/></div>
          <table className="seo-table"><thead><tr><th>Page</th><th>Clicks</th><th>CTR</th></tr></thead><tbody><tr><td colSpan="3" style={{textAlign:"center",color:"#94a3b8",padding:"28px 8px"}}>No data yet</td></tr></tbody></table>
        </div>
      </div>
    </section>
  )
}

export default SEO

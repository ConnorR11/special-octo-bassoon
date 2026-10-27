import { createClient } from "@supabase/supabase-js"
import crypto from "node:crypto"

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).send("Method not allowed.")
  const token = String(req.query?.token || "")
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return res.status(404).send("This quote link is invalid or has expired.")

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return res.status(500).send("Quote viewing is temporarily unavailable.")

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const hash = crypto.createHash("sha256").update(token).digest("hex")
    const { data: quote, error } = await db.from("solar_quotes")
      .select("id,storage_path,quote_ref,expires_at,status,view_count,first_viewed_at")
      .eq("public_token_hash", hash)
      .maybeSingle()
    if (error) throw error
    if (!quote || quote.status === "expired" || (quote.expires_at && new Date(quote.expires_at) <= new Date())) {
      return res.status(404).send("This quote link is invalid or has expired.")
    }

    const { data: file, error: downloadError } = await db.storage.from("signatures").download(quote.storage_path)
    if (downloadError || !file) return res.status(404).send("The quote PDF could not be found.")

    const now = new Date().toISOString()
    const updates = { status: "viewed", last_viewed_at: now, view_count: Number(quote.view_count || 0) + 1 }
    if (!quote.first_viewed_at) updates.first_viewed_at = now
    await db.from("solar_quotes").update(updates).eq("id", quote.id)
    await db.from("solar_quote_events").insert({
      quote_id: quote.id,
      event_type: "opened",
      details: { user_agent: String(req.headers["user-agent"] || "").slice(0, 300) }
    })

    const pdfBase64 = Buffer.from(await file.arrayBuffer()).toString("base64")
    const safeRef = String(quote.quote_ref || "Solar Quote").replace(/[^A-Za-z0-9_-]/g, "")
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Your Homeshield Solar Quote</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f1f3f5;color:#202124;font:16px Arial,sans-serif}
header{position:sticky;top:0;z-index:2;background:#fff;border-bottom:1px solid #ddd;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.brand{font-weight:700;color:#173d35}.sub{font-size:13px;color:#5f6368;margin-top:4px}
main{max-width:1000px;margin:20px auto;padding:0 12px}
#status{background:#fff;border-radius:8px;padding:18px;margin-bottom:12px;text-align:center;color:#5f6368}
#pages{display:flex;flex-direction:column;align-items:center;gap:12px}
canvas{display:block;width:100%;height:auto;background:white;box-shadow:0 2px 10px #0002}
.page{width:100%;max-width:850px;background:#fff}
button{border:0;border-radius:6px;background:#174b40;color:white;padding:10px 14px;font-weight:600;cursor:pointer}
@media(max-width:600px){header{padding:12px}main{margin:12px auto;padding:0 6px}.sub{font-size:12px}}
</style>
</head>
<body>
<header><div><div class="brand">Homeshield Scotland</div><div class="sub">Solar quote · ${safeRef}</div></div></header>
<main><div id="status">Loading your quote securely…</div><div id="pages"></div></main>
<script>
(async function(){
 const status=document.getElementById('status');
 try {
   const bytes=Uint8Array.from(atob('${pdfBase64}'),c=>c.charCodeAt(0));
   const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs');
   pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
   const pdf=await pdfjs.getDocument({data:bytes}).promise;
   status.textContent='Your solar quote · '+pdf.numPages+' page'+(pdf.numPages===1?'':'s');
   for(let n=1;n<=pdf.numPages;n++){
     const page=await pdf.getPage(n);
     const viewport=page.getViewport({scale:1.5});
     const canvas=document.createElement('canvas');
     canvas.className='page';
     canvas.width=viewport.width;canvas.height=viewport.height;
     document.getElementById('pages').appendChild(canvas);
     await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
   }
 } catch(e) {
   status.textContent='We couldn’t display the quote in this browser. Please try opening this link in an up-to-date browser or contact Homeshield Scotland for help.';
 }
})();
</script>
</body></html>`
    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.setHeader("Content-Disposition", "inline")
    res.setHeader("Cache-Control", "private, no-store, max-age=0")
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'unsafe-inline'; connect-src https://cdnjs.cloudflare.com; img-src data:;")
    return res.status(200).send(html)
  } catch (error) {
    console.error("View solar quote failed:", error)
    return res.status(500).send("Unable to open this quote right now.")
  }
}

import { createClient } from "@supabase/supabase-js"
import crypto from "node:crypto"
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).send("Method not allowed.")
 const token=String(req.query?.token||"");if(!/^[A-Za-z0-9_-]{40,60}$/.test(token))return res.status(404).send("This quote link is invalid or has expired.")
 const url=process.env.VITE_SUPABASE_URL||process.env.SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return res.status(500).send("Quote viewing is temporarily unavailable.")
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
 try{
  const hash=crypto.createHash("sha256").update(token).digest("hex");const {data:quote,error}=await db.from("solar_quotes").select("id,storage_path,quote_ref,expires_at,status,view_count,first_viewed_at").eq("public_token_hash",hash).maybeSingle();if(error)throw error
  if(!quote||quote.status==="expired"||(quote.expires_at&&new Date(quote.expires_at)<=new Date()))return res.status(404).send("This quote link is invalid or has expired.")
  const {data:file,error:downloadError}=await db.storage.from("signatures").download(quote.storage_path);if(downloadError||!file)return res.status(404).send("The quote PDF could not be found.")
  const now=new Date().toISOString();const updates={status:"viewed",last_viewed_at:now,view_count:Number(quote.view_count||0)+1};if(!quote.first_viewed_at)updates.first_viewed_at=now;await db.from("solar_quotes").update(updates).eq("id",quote.id)
  await db.from("solar_quote_events").insert({quote_id:quote.id,event_type:"opened",details:{user_agent:String(req.headers["user-agent"]||"").slice(0,300)}})
  res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Disposition","inline; filename=Solar-Quote-"+String(quote.quote_ref).replace(/[^A-Za-z0-9_-]/g,"")+".pdf");res.setHeader("Cache-Control","private, no-store, max-age=0");res.setHeader("X-Content-Type-Options","nosniff");return res.status(200).send(Buffer.from(await file.arrayBuffer()))
 }catch(error){console.error("View solar quote failed:",error);return res.status(500).send("Unable to open this quote right now.")}
}
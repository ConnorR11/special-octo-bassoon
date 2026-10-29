import { createClient } from "@supabase/supabase-js"
import crypto from "node:crypto"
const json=(res,status,body)=>{res.setHeader("Content-Type","application/json");res.setHeader("Cache-Control","no-store");return res.status(status).json(body)}
export default async function handler(req,res){
 if(req.method!=="POST")return json(res,405,{error:"Method not allowed."})
 const auth=String(req.headers?.authorization||"");const accessToken=auth.startsWith("Bearer ")?auth.slice(7):""
 if(!accessToken)return json(res,401,{error:"Please sign in again."})
 const url=process.env.VITE_SUPABASE_URL||process.env.SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY
 if(!url||!key)return json(res,500,{error:"Quote link service is not configured."})
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
 try{
  const {data:user,error:userError}=await db.auth.getUser(accessToken);if(userError||!user?.user)return json(res,401,{error:"Your session has expired."})
  const body=typeof req.body==="string"?JSON.parse(req.body):(req.body||{});const appointmentId=String(body.appointment_row_id||"").trim();const storagePath=String(body.storage_path||"").trim();const fileName=String(body.file_name||"Solar-Quote.pdf").trim();const priceMode="both"
  if(!appointmentId||!storagePath.startsWith("solar-quotes/")||storagePath.includes(".."))return json(res,400,{error:"A valid appointment and saved quote PDF are required."})
  const {data:appointment,error:appointmentError}=await db.from("appointments").select("appointment_row_id,name,email_address,phone_number_1,address,postcode").eq("appointment_row_id",appointmentId).maybeSingle();if(appointmentError)throw appointmentError;if(!appointment)return json(res,404,{error:"Appointment not found."})
  const token=crypto.randomBytes(32).toString("base64url");const hash=crypto.createHash("sha256").update(token).digest("hex");const quoteRef="SQ-"+new Date().toISOString().slice(0,10).replaceAll("-","")+"-"+crypto.randomBytes(3).toString("hex").toUpperCase();const expiresAt=new Date(Date.now()+90*24*60*60*1000).toISOString()
  const {data:quote,error:insertError}=await db.from("solar_quotes").insert({appointment_row_id:appointmentId,quote_ref:quoteRef,storage_path:storagePath,public_token_hash:hash,customer_name:appointment.name||null,customer_email:appointment.email_address||null,customer_phone:appointment.phone_number_1||null,price_mode:priceMode,status:"ready",created_by:user.user.id,expires_at:expiresAt,metadata:{file_name:fileName,address:appointment.address||null,postcode:appointment.postcode||null}}).select("id,quote_ref,expires_at").single();if(insertError)throw insertError
  await db.from("solar_quote_events").insert({quote_id:quote.id,event_type:"created",details:{file_name:fileName,price_mode:priceMode,expires_at:expiresAt}})
  const base=String(process.env.PUBLIC_APP_URL||"https://crm.homeshield.ltd").replace(/\/$/,"");return json(res,201,{quote_id:quote.id,quote_ref:quote.quote_ref,url:base+"/api/sales/view-solar-quote?token="+encodeURIComponent(token),expires_at:expiresAt})
 }catch(error){console.error("Create solar quote link failed:",error);return json(res,500,{error:"Unable to create a secure quote link."})}
}
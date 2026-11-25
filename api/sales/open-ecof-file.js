import { createClient } from "@supabase/supabase-js"

export default async function handler(req,res){
 const send=(status,body)=>{res.setHeader("Content-Type","application/json");res.setHeader("Cache-Control","no-store");return res.status(status).json(body)}
 if(req.method!=="POST")return send(405,{error:"Method not allowed."})
 const auth=req.headers?.authorization||"";const token=auth.startsWith("Bearer ")?auth.slice(7):"";if(!token)return send(401,{error:"Please sign in to open this ECOF document."})
 const url=process.env.VITE_SUPABASE_URL||process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return send(500,{error:"Storage configuration is missing."})
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
 try{
  const {data:user,error:userError}=await db.auth.getUser(token);if(userError||!user?.user)return send(401,{error:"Your session has expired. Please sign in again."})
  const body=typeof req.body==="string"?JSON.parse(req.body):(req.body||{}),path=String(body.path||"").trim()
  if(!path.startsWith("ecof-pdfs/")||path.includes("..")||path.split("/").length!==3||!path.toLowerCase().endsWith(".pdf"))return send(400,{error:"Invalid ECOF reference."})
  const appointmentId=path.split("/")[1],{data:appointment,error:appointmentError}=await db.from("appointments").select("appointment_row_id").eq("appointment_row_id",appointmentId).maybeSingle()
  if(appointmentError)throw appointmentError;if(!appointment)return send(404,{error:"ECOF appointment not found."})
  const {data,error}=await db.storage.from("signatures").createSignedUrl(path,300);if(error||!data?.signedUrl)return send(404,{error:"ECOF PDF could not be found."})
  return send(200,{url:data.signedUrl})
 }catch(error){console.error("Open ECOF file failed:",error);return send(500,{error:"Unable to open this ECOF document right now."})}
}

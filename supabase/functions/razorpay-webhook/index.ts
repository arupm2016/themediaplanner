import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("");
async function hmac(secret:string,body:string){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return hex(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(body)));}
function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let out=0;for(let i=0;i<a.length;i++)out|=a.charCodeAt(i)^b.charCodeAt(i);return out===0;}
Deno.serve(async(req)=>{
 if(req.method!=="POST")return new Response("method not allowed",{status:405});
 try{
  const raw=await req.text(),signature=req.headers.get("x-razorpay-signature")??"",eventId=req.headers.get("x-razorpay-event-id")??"";
  const secret=Deno.env.get("RAZORPAY_WEBHOOK_SECRET");if(!secret)return new Response("webhook not configured",{status:503});
  if(!eventId||!safeEqual(await hmac(secret,raw),signature))return new Response("invalid signature",{status:400});
  const payload=JSON.parse(raw),eventType=payload.event??"unknown";
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const {error:insertError}=await admin.from("razorpay_webhook_events").insert({event_id:eventId,event_type:eventType,payload}).select().single();
  if(insertError&&insertError.code==="23505")return new Response("duplicate",{status:200});
  if(insertError){console.error(insertError);return new Response("could not persist event",{status:500});}
  if(eventType==="payment.captured"){
    const payment=payload.payload?.payment?.entity;
    if(payment?.order_id&&payment?.id){
      const {error}=await admin.rpc("fulfil_paid_order",{p_razorpay_order_id:payment.order_id,p_razorpay_payment_id:payment.id});
      if(error){await admin.from("razorpay_webhook_events").update({processing_error:error.message}).eq("event_id",eventId);console.error(error);return new Response("fulfilment pending",{status:500});}
    }
  }
  await admin.from("razorpay_webhook_events").update({processed_at:new Date().toISOString()}).eq("event_id",eventId);
  return new Response("ok",{status:200});
 }catch(e){console.error(e);return new Response("webhook processing error",{status:500});}
});

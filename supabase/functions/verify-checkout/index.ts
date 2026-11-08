import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":Deno.env.get("APP_ORIGIN")??"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("");
async function hmac(secret:string,message:string){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return hex(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(message)));}
function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let out=0;for(let i=0;i<a.length;i++)out|=a.charCodeAt(i)^b.charCodeAt(i);return out===0;}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");if(!token)return reply({error:"Authentication required"},401);
  const userClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data:{user},error:authError}=await userClient.auth.getUser(token);if(authError||!user)return reply({error:"Invalid session"},401);
  const {razorpay_order_id,razorpay_payment_id,razorpay_signature}=await req.json();
  if(!razorpay_order_id||!razorpay_payment_id||!razorpay_signature)return reply({error:"Payment verification fields missing"},400);
  const admin=createClient(url,service);
  const {data:order}=await admin.from("billing_orders").select("*").eq("razorpay_order_id",razorpay_order_id).eq("user_id",user.id).maybeSingle();
  if(!order)return reply({error:"Billing order not found"},404);
  const secret=Deno.env.get("RAZORPAY_KEY_SECRET");if(!secret)return reply({error:"Payment gateway not configured"},503);
  const expected=await hmac(secret,`${razorpay_order_id}|${razorpay_payment_id}`);
  if(!safeEqual(expected,String(razorpay_signature)))return reply({error:"Payment signature validation failed"},400);
  const keyId=Deno.env.get("RAZORPAY_KEY_ID")!,auth=btoa(`${keyId}:${secret}`);
  const response=await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpay_payment_id)}`,{headers:{Authorization:`Basic ${auth}`}});
  const payment=await response.json();
  if(!response.ok)return reply({error:"Could not verify payment with Razorpay"},502);
  if(payment.order_id!==razorpay_order_id||payment.amount!==order.amount_paise||payment.currency!==order.currency||payment.status!=="captured")return reply({error:"Payment is not captured or does not match the order"},409);
  const {data:fulfilled,error}=await admin.rpc("fulfil_paid_order",{p_razorpay_order_id:razorpay_order_id,p_razorpay_payment_id:razorpay_payment_id});
  if(error){console.error(error);return reply({error:"Payment verified but entitlement activation is pending. Contact support with your payment ID."},500);}
  return reply({ok:true,subscription:fulfilled,plan_code:order.plan_code});
 }catch(e){console.error(e);return reply({error:"Unexpected verification error"},500);}
});

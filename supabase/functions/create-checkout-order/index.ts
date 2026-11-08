import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":Deno.env.get("APP_ORIGIN")??"https://themediaplanner.vercel.app","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
  if(!token)return reply({error:"Authentication required"},401);
  const userClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data:{user},error:authError}=await userClient.auth.getUser(token);
  if(authError||!user)return reply({error:"Invalid session"},401);
  const {workspace_id,plan_code}=await req.json();
  if(typeof workspace_id!=="string"||typeof plan_code!=="string")return reply({error:"workspace_id and plan_code are required"},400);
  const admin=createClient(url,service);
  const {data:member}=await admin.from("workspace_members").select("role").eq("workspace_id",workspace_id).eq("user_id",user.id).maybeSingle();
  if(!member||!["owner","admin"].includes(member.role))return reply({error:"Only workspace owners or admins can purchase a plan"},403);
  const {data:plan}=await admin.from("plan_catalog").select("*").eq("code",plan_code).eq("active",true).maybeSingle();
  if(!plan||plan.amount_paise<=0)return reply({error:"This plan does not require checkout or is unavailable"},400);
  const keyId=Deno.env.get("RAZORPAY_KEY_ID"),keySecret=Deno.env.get("RAZORPAY_KEY_SECRET");
  if(!keyId||!keySecret)return reply({error:"Payment gateway is not configured. Contact the workspace owner."},503);
  const localOrder=crypto.randomUUID();
  const {data:order,error:insertError}=await admin.from("billing_orders").insert({workspace_id,user_id:user.id,plan_code,amount_paise:plan.amount_paise,currency:plan.currency,status:"pending"}).select().single();
  if(insertError||!order)return reply({error:"Could not create billing record"},500);
  const auth=btoa(`${keyId}:${keySecret}`);
  const razor=await fetch("https://api.razorpay.com/v1/orders",{method:"POST",headers:{"Authorization":`Basic ${auth}`,"Content-Type":"application/json"},body:JSON.stringify({amount:plan.amount_paise,currency:plan.currency,receipt:order.id,notes:{tmp_billing_order_id:order.id,workspace_id,plan_code}})});
  const data=await razor.json();
  if(!razor.ok){await admin.from("billing_orders").update({status:"failed"}).eq("id",order.id);return reply({error:"Payment order could not be created",details:data.error?.description??"Razorpay rejected the request"},502);}
  const {error:updateError}=await admin.from("billing_orders").update({razorpay_order_id:data.id}).eq("id",order.id);
  if(updateError)return reply({error:"Could not persist gateway order reference"},500);
  return reply({key_id:keyId,order_id:data.id,amount:data.amount,currency:data.currency,plan:{code:plan.code,name:plan.name,credits:plan.credits_per_period,period_days:plan.period_days}});
 }catch(e){console.error(e);return reply({error:"Unexpected checkout error"},500);}
});

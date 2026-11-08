import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":Deno.env.get("APP_ORIGIN")??"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");if(!token)return reply({error:"Authentication required"},401);
  const userClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data:{user},error:authError}=await userClient.auth.getUser(token);if(authError||!user)return reply({error:"Invalid session"},401);
  const {workspace_id,email,role}=await req.json();
  if(!workspace_id||!email||!["admin","strategist","analyst","viewer"].includes(role))return reply({error:"Invalid invitation"},400);
  const admin=createClient(url,service);
  const {data:member}=await admin.from("workspace_members").select("role").eq("workspace_id",workspace_id).eq("user_id",user.id).maybeSingle();
  if(!member||!["owner","admin"].includes(member.role))return reply({error:"Only owners and admins can invite teammates"},403);
  const {data:sub}=await admin.from("workspace_subscriptions").select("plan_code").eq("workspace_id",workspace_id).eq("status","active").order("current_period_end",{ascending:false}).limit(1).maybeSingle();
  const {data:plan}=await admin.from("plan_catalog").select("max_seats").eq("code",sub?.plan_code??"starter").single();
  const {count}=await admin.from("workspace_members").select("*",{count:"exact",head:true}).eq("workspace_id",workspace_id);
  if((count??0)>=(plan?.max_seats??1))return reply({error:"Your current plan seat limit has been reached"},409);
  const normalized=String(email).trim().toLowerCase();
  const {data:invite,error:inviteError}=await admin.from("workspace_invites").upsert({workspace_id,email:normalized,role,invited_by:user.id,expires_at:new Date(Date.now()+7*86400000).toISOString()},{onConflict:"workspace_id,email"}).select().single();
  if(inviteError)return reply({error:"Could not save invitation"},500);
  const origin=Deno.env.get("APP_ORIGIN");if(!origin)return reply({error:"APP_ORIGIN must be configured to send invitations"},503);
  const {error:mailError}=await admin.auth.admin.inviteUserByEmail(normalized,{redirectTo:origin+"/accept-invite",data:{tmp_workspace_invite_id:invite.id}});
  if(mailError)return reply({error:"Invitation saved but email could not be sent: "+mailError.message},502);
  return reply({ok:true,invite_id:invite.id});
 }catch(e){console.error(e);return reply({error:"Unexpected invitation error"},500);}
});

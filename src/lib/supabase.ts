import { createClient } from '@supabase/supabase-js';
// Supabase publishable keys are designed for browser use; authorization is enforced by RLS.
const url=(import.meta.env.VITE_SUPABASE_URL as string|undefined)||'https://fcijuqklfpeffhrkzgtb.supabase.co';
const key=(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||import.meta.env.VITE_SUPABASE_ANON_KEY) as string|undefined||'sb_publishable_akZlQRESgnufVN4YKYfc-g_RFsjOHrx';
export const supabaseConfigured=Boolean(url&&key);
export const supabase=supabaseConfigured?createClient(url!,key!,{
 auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},
 global:{headers:{'X-Client-Info':'smart-media-planner-ensual'}}
}):null;

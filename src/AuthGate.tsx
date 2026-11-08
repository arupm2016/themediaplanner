import React,{FormEvent,useEffect,useState} from 'react';
import type {Session,User} from '@supabase/supabase-js';
import App from './App';
import {supabase,supabaseConfigured} from './lib/supabase';
type Props={};
export default function AuthGate(_:Props){
 const [session,setSession]=useState<Session|null>(null);
 const [workspaceId,setWorkspaceId]=useState<string|null>(null);
 const [workspaceRole,setWorkspaceRole]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [route,setRoute]=useState(location.pathname);
 const [mode,setMode]=useState<'signin'|'signup'|'reset'>('signin');
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [fullName,setFullName]=useState('');const [company,setCompany]=useState('');
 const [error,setError]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 useEffect(()=>{const onRoute=()=>setRoute(location.pathname);window.addEventListener('popstate',onRoute);return()=>window.removeEventListener('popstate',onRoute)},[]);
 useEffect(()=>{if(!supabase)return;let alive=true;
  supabase.auth.getSession().then(({data})=>{if(alive){setSession(data.session);setLoading(false)}});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);setLoading(false)});
  return()=>{alive=false;subscription.unsubscribe()};
 },[]);
 useEffect(()=>{if(!supabase||!session?.user){setWorkspaceId(null);setWorkspaceRole(null);return}
  let alive=true;
  supabase.from('workspace_members').select('workspace_id,role').eq('user_id',session.user.id).limit(1).maybeSingle().then(({data,error})=>{
   if(!alive)return;
   if(error||!data){setError('Your workspace membership could not be loaded. Contact your workspace owner.');return}
   setWorkspaceId(data.workspace_id);setWorkspaceRole(data.role);
  });
  return()=>{alive=false};
 },[session?.user?.id]);
 const submit=async(e:FormEvent)=>{e.preventDefault();if(!supabase)return;setBusy(true);setError('');setMessage('');
  try{
   if(mode==='signup'){
    const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{data:{full_name:fullName,company},emailRedirectTo:location.origin+'/app'}});
    if(error)throw error;
    if(data.session){setMessage('Account created. Opening your workspace…');history.pushState({},'','/app');setRoute('/app')}
    else setMessage('Check your email to confirm your account, then sign in.');
   }else if(mode==='signin'){
    const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;
    history.pushState({},'','/app');setRoute('/app');
   }else{
    const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:location.origin+'/app'});if(error)throw error;
    setMessage('If an account exists for this email, a password reset link has been sent.');
   }
  }catch(err){setError(err instanceof Error?err.message:'Authentication failed');}finally{setBusy(false)}
 };
 const signOut=async()=>{if(supabase)await supabase.auth.signOut();setSession(null);setWorkspaceId(null);history.pushState({},'','/');setRoute('/')};
 const privateRoute=route.startsWith('/app')||route.startsWith('/account');
 if(privateRoute&&!supabaseConfigured)return <AuthShell><div className="auth-card"><div className="auth-kicker">TMP / PRODUCTION CONFIGURATION</div><h1>Connect your workspace.</h1><p>Secure sign-in is disabled until the Supabase project URL and publishable key are configured in the production environment.</p><div className="auth-alert">No demo login is provided. This protects customer data and prevents fake authentication.</div><a className="auth-back" href="/">Return to public website</a></div></AuthShell>;
 if(privateRoute&&loading)return <AuthShell><div className="auth-card"><div className="auth-kicker">TMP / AUTHENTICATING</div><h1>Securing your workspace…</h1></div></AuthShell>;
 if(privateRoute&&!session)return <AuthShell><div className="auth-card"><div className="auth-kicker">TMP / SECURE ACCESS</div><h1>{mode==='signup'?'Create your workspace':mode==='reset'?'Reset password':'Welcome back.'}</h1><p>Secure access powered by Supabase Authentication.</p><form onSubmit={submit}>{mode==='signup'&&<><label>Full name<input required value={fullName} onChange={e=>setFullName(e.target.value)} autoComplete="name"/></label><label>Agency / company<input required value={company} onChange={e=>setCompany(e.target.value)}/></label></>}<label>Work email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>{mode!=='reset'&&<label>Password<input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='signup'?'new-password':'current-password'}/></label>}{error&&<div className="auth-error">{error}</div>}{message&&<div className="auth-success">{message}</div>}<button className="btn btn-lime auth-submit" disabled={busy}>{busy?'Please wait…':mode==='signup'?'Create account':mode==='reset'?'Send reset link':'Sign in securely'}</button></form><div className="auth-links">{mode==='signin'?<><button onClick={()=>setMode('signup')}>Create an account</button><button onClick={()=>setMode('reset')}>Forgot password?</button></>:<button onClick={()=>setMode('signin')}>Back to sign in</button>}</div><a className="auth-back" href="/">← Back to Media Planner</a></div></AuthShell>;
 if(privateRoute&&session&&!workspaceId)return <AuthShell><div className="auth-card"><div className="auth-kicker">TMP / WORKSPACE</div><h1>Loading your access…</h1><p>{error||'Checking your workspace membership.'}</p><button className="btn btn-outline" onClick={signOut}>Sign out</button></div></AuthShell>;
 if(privateRoute&&session&&workspaceId)return <><App user={session.user} workspaceId={workspaceId} workspaceRole={workspaceRole??'viewer'} onSignOut={signOut}/><div className="auth-session-chip"><span>{session.user.email}</span><button onClick={signOut}>Sign out</button></div></>;
 return <App/>;
}
function AuthShell({children}:{children:React.ReactNode}){return <div className="auth-shell"><div className="auth-orbit"/><a className="auth-brand" href="/"><img src="/brand/tmp-mark.svg"/> <span>MEDIA PLANNER<small>BY TMP · INTELLIGENCE OS</small></span></a>{children}<div className="auth-copyright">© {new Date().getFullYear()} TMP · MEDIA PLANNER</div></div>}

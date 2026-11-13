import React,{FormEvent,useEffect,useState} from 'react';
import type {Session,User} from '@supabase/supabase-js';
import App from './App';
import {supabase,supabaseConfigured} from './lib/supabase';
type Props={};
export default function AuthGate(_:Props){
 const [session,setSession]=useState<Session|null>(null);
 const [workspaceId,setWorkspaceId]=useState<string|null>(null);
 const [workspaceRole,setWorkspaceRole]=useState<string|null>(null);
 const [membershipAttempt,setMembershipAttempt]=useState(0);
 const [loading,setLoading]=useState(true);
 const [route,setRoute]=useState(location.pathname);
 const [mode,setMode]=useState<'signin'|'signup'|'reset'>(location.pathname==='/signup'?'signup':'signin');
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [fullName,setFullName]=useState('');const [company,setCompany]=useState('');
 const [error,setError]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 useEffect(()=>{const onRoute=()=>{setRoute(location.pathname);if(location.pathname==='/signup')setMode('signup');else if(location.pathname.startsWith('/app'))setMode('signin')};window.addEventListener('popstate',onRoute);return()=>window.removeEventListener('popstate',onRoute)},[]);
 useEffect(()=>{if(!supabase)return;let alive=true;
  supabase.auth.getSession().then(({data,error})=>{if(alive){setSession(data.session);setLoading(false);if(error)setError('Could not restore your sign-in session: '+error.message)}}).catch((err)=>{if(alive){setLoading(false);setError(err instanceof Error?err.message:'Authentication service could not be reached. Please refresh and try again.')}});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,next)=>{
   setSession(next);setLoading(false);
   if(event==='PASSWORD_RECOVERY'){setMode('reset');setMessage('Enter a new password to secure your account.');history.replaceState({},'','/account/reset');setRoute('/account/reset');}
  });
  return()=>{alive=false;subscription.unsubscribe()};
 },[]);
 useEffect(()=>{if(!supabase||!session?.user){setWorkspaceId(null);setWorkspaceRole(null);return}
  let alive=true;setError('');
  supabase.rpc('ensure_my_workspace').then(({data,error})=>{
   if(!alive)return;
   const membership=Array.isArray(data)?data[0]:data;
   if(error){setError('Workspace setup failed ('+(error.code??'unknown')+'): '+error.message+' — confirm the TMP Supabase migration has been applied.');return}
   if(!membership?.workspace_id){setError('Supabase returned no workspace membership. Run the TMP database migration, then retry.');return}
   setWorkspaceId(membership.workspace_id);setWorkspaceRole(membership.role);
  });
  return()=>{alive=false};
 },[session?.user?.id,membershipAttempt]);
 const socialSignIn=async(provider:'google'|'linkedin_oidc')=>{if(!supabase)return;setBusy(true);setError('');try{const {error}=await supabase.auth.signInWithOAuth({provider,options:{redirectTo:location.origin+'/app'}});if(error)throw error;}catch(err){setError(err instanceof Error?err.message:'Social sign-in could not be started');setBusy(false)}};
 const submit=async(e:FormEvent)=>{e.preventDefault();if(!supabase)return;setBusy(true);setError('');setMessage('');
  try{
   if(mode==='reset'&&session){
    const {error}=await supabase.auth.updateUser({password});if(error)throw error;
    setPassword('');setMessage('Password updated. Your account is secure.');history.replaceState({},'','/app');setRoute('/app');setMode('signin');
   }else if(mode==='signup'){
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
 const privateRoute=route.startsWith('/app')||route.startsWith('/account')||route==='/signup';
 if(privateRoute&&!supabaseConfigured)return <AuthShell><div className="auth-card"><div className="auth-kicker">TMP / ACCOUNT ACCESS</div><h1>{mode==='signup'?'Create your workspace':'Welcome back.'}</h1><p>Account access is not connected yet. The product needs its Supabase project configuration before sign-up or sign-in can work.</p><div className="auth-alert">Authentication backend is not configured in this deployment. No account can be created until the Supabase project URL and publishable key are added.</div><div className="auth-links"><button onClick={()=>setMode('signup')}>Create account</button><button onClick={()=>setMode('signin')}>Sign in</button></div><a className="auth-back" href="/">← Back to Media Planner</a></div></AuthShell>;
 if(privateRoute&&loading)return <AuthShell><div className="auth-card"><div className="auth-kicker">TMP / AUTHENTICATING</div><h1>Securing your workspace…</h1></div></AuthShell>;
 if(privateRoute&&!session)return <AuthShell><div className="auth-card"><div className="auth-kicker">TMP / SECURE ACCESS</div><h1>{mode==='signup'?'Create your workspace':mode==='reset'?'Reset password':'Welcome back.'}</h1><p>{mode==='signup'?'Start with the free Starter workspace. No payment details required.':mode==='reset'?'Choose a new password for your TMP account.':'Sign in to continue to your saved media plans.'}</p><form onSubmit={submit}>{mode==='signup'&&<><label>Full name<input required value={fullName} onChange={e=>setFullName(e.target.value)} autoComplete="name"/></label><label>Agency / company<input required value={company} onChange={e=>setCompany(e.target.value)}/></label></>}<label>Work email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>{mode!=='reset'&&<label>Password<input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='signup'?'new-password':'current-password'}/></label>}{mode==='reset'&&<label>New password<input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label>}{error&&<div className="auth-error">{error}</div>}{message&&<div className="auth-success">{message}</div>}<button className="btn btn-lime auth-submit" disabled={busy}>{busy?'Please wait…':mode==='signup'?'Create account':mode==='reset'?'Send reset link':'Sign in securely'}</button></form><div className="auth-divider"><span>OR CONTINUE WITH</span></div><div className="social-auth"><button type="button" disabled={busy} onClick={()=>socialSignIn('google')}><b>G</b> Continue with Google</button><button type="button" disabled={busy} onClick={()=>socialSignIn('linkedin_oidc')}><b>in</b> Continue with LinkedIn</button></div><div className="auth-links">{mode==='signin'?<><button onClick={()=>setMode('signup')}>Create an account</button><button onClick={()=>setMode('reset')}>Forgot password?</button></>:<button onClick={()=>setMode('signin')}>Back to sign in</button>}</div><a className="auth-back" href="/">← Back to Media Planner</a></div></AuthShell>;
 if(privateRoute&&session&&!workspaceId)return <AuthShell><div className="auth-card"><div className="auth-kicker">TMP / WORKSPACE</div><h1>Loading your access…</h1><p>{error||'Checking your workspace membership.'}</p><div className="auth-links"><button onClick={()=>setMembershipAttempt(v=>v+1)}>Retry workspace setup</button><button onClick={signOut}>Sign out</button></div></div></AuthShell>;
 if(privateRoute&&session&&workspaceId)return <><App user={session.user} workspaceId={workspaceId} workspaceRole={workspaceRole??'viewer'} onSignOut={signOut}/><div className="auth-session-chip"><span>{session.user.email}</span><button onClick={signOut}>Sign out</button></div></>;
 return <App/>;
}
function AuthShell({children}:{children:React.ReactNode}){return <div className="auth-shell"><div className="auth-orbit"/><a className="auth-brand" href="/"><img src="/brand/tmp-mark.svg"/> <span>MEDIA PLANNER<small>BY TMP · INTELLIGENCE OS</small></span></a>{children}<div className="auth-copyright">© {new Date().getFullYear()} TMP · MEDIA PLANNER</div></div>}

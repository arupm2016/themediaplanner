import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './auth.css';

class AppErrorBoundary extends React.Component<{children:React.ReactNode},{error:string|null}> {
  state={error:null as string|null};
  static getDerivedStateFromError(error:unknown) {
    return {error:error instanceof Error ? error.message : String(error)};
  }
  componentDidCatch(error:unknown, info:React.ErrorInfo) {
    console.error('Smart Media Planner render failure:', error, info.componentStack);
  }
  render() {
    if (this.state.error) return <main style={{minHeight:'100vh',padding:'48px',background:'#fff',color:'#211b24',fontFamily:'Arial,sans-serif'}}>
      <h1>Smart Media Planner could not start</h1>
      <p>The app hit a rendering error. Share this message with support:</p>
      <pre style={{whiteSpace:'pre-wrap',background:'#f5f1f6',padding:'16px',borderRadius:'8px'}}>{this.state.error}</pre>
      <button onClick={()=>location.reload()} style={{padding:'12px 18px',background:'#611f69',color:'#fff',border:0,borderRadius:'5px'}}>Reload planner</button>
    </main>;
    return this.props.children;
  }
}

const root=document.getElementById('root');
if(root) ReactDOM.createRoot(root).render(
  <React.StrictMode><AppErrorBoundary><App /></AppErrorBoundary></React.StrictMode>
);

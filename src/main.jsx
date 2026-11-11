import React,{useEffect,useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {AnimatePresence,motion,useReducedMotion} from "motion/react";
import "./styles.css";

const API="https://pfuomojvcuwbvqtzvglb.supabase.co/functions/v1/rpcph-local-auth";
const SUPABASE="https://pfuomojvcuwbvqtzvglb.supabase.co";
const KEY="sb_publishable__W9mPIcJIZ7QDhzbKWNm_g_IsEMgMUt";

async function api(action,payload={}){
 const token=localStorage.getItem("rpcph_session");
 const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json","apikey":KEY, ...(token?{Authorization:"Bearer "+token}:{})},body:JSON.stringify({action,...payload})});
 const data=await r.json().catch(()=>({}));
 if(!r.ok) throw new Error(data.error||data.message||"Request failed");
 return data;
}
const ease=[.16,1,.3,1];
const spring={type:"spring",stiffness:420,damping:32,mass:.72};
const pageVariants={initial:{opacity:0,y:14,scale:.992},animate:{opacity:1,y:0,scale:1,transition:{duration:.42,ease}},exit:{opacity:0,y:-8,scale:.998,transition:{duration:.22,ease:[.4,0,1,1]}}};

function Login({onLogin}){
 const [key,setKey]=useState(""); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
 const reduce=useReducedMotion();
 async function submit(e){e.preventDefault(); if(!key.trim())return; setBusy(true);setError("");
   try{const d=await api("login",{id_key:key.trim()});localStorage.setItem("rpcph_session",d.token);onLogin(d.user)}
   catch(err){setError(err.message||"Unable to sign in");}
   finally{setBusy(false)}
 }
 return <motion.div className="auth-scene" initial={reduce?false:{opacity:0}} animate={{opacity:1}} transition={{duration:.45}}>
   <div className="auth-backdrop"/>
   <motion.form className="auth-panel" onSubmit={submit} initial={reduce?false:{opacity:0,y:20,scale:.985}} animate={{opacity:1,y:0,scale:1}} transition={{...spring,delay:.08}}>
    <div className="brand"><div className="brandmark">R.</div><div><b>RPCPH CRM</b><small>REMOTE PROFESSIONALS</small></div></div>
    <div className="eyebrow">CRM ACCESS</div>
    <h1>Sign in</h1>
    <p>Enter the ID KEY issued to you by your CRM administrator.</p>
    <label>ID KEY</label>
    <input autoFocus value={key} onChange={e=>setKey(e.target.value)} type="password" autoComplete="off" placeholder="Enter your ID KEY"/>
    <AnimatePresence>{error&&<motion.div className="error" initial={{opacity:0,height:0,y:-6}} animate={{opacity:1,height:"auto",y:0}} exit={{opacity:0,height:0}}>{error}</motion.div>}</AnimatePresence>
    <motion.button className="primary" disabled={busy||!key.trim()} whileHover={{scale:1.012}} whileTap={{scale:.982}} transition={spring}>{busy?"Signing in…":"Sign in"}</motion.button>
   </motion.form>
 </motion.div>
}

function Dashboard({user,onLogout}){
 const [lead,setLead]=useState({name:"",town:"",type:"Buyer",county:"",source:"MVIP New Prospect"});
 const [agents,setAgents]=useState([]); const [status,setStatus]=useState(""); const [loading,setLoading]=useState(false);
 const reduce=useReducedMotion();
 async function submit(e){e.preventDefault();setLoading(true);setStatus("Finding the nearest available agents…");
   try{const d=await api("create_lead",{lead_name:lead.name,town_or_county:lead.town,lead_type:lead.type,target_county:lead.county,lead_source:lead.source});setAgents(d.agents||[]);setStatus(d.agents?.length?d.agents.length+" matching agent(s) found.":"Lead saved. No matching agents were found.");}
   catch(err){setStatus(err.message||"Could not save lead");} finally{setLoading(false)}
 }
 const metrics=useMemo(()=>[{n:"24",l:"Active leads"},{n:"18",l:"Agents available"},{n:"96%",l:"Search readiness"}],[ ]);
 return <motion.div className="app" initial={reduce?false:"initial"} animate="animate" variants={pageVariants}>
  <aside className="rail"><div className="rail-logo">R.</div>{["⌂","⌕","◫","◉"].map((x,i)=><motion.div key={i} className={"rail-item "+(i===0?"active":"")} whileHover={{y:-2}} whileTap={{scale:.94}}>{x}</motion.div>)}<div className="rail-spacer"/><motion.button className="rail-item logout" onClick={onLogout} whileTap={{scale:.94}}>↪</motion.button></aside>
  <main className="workspace">
   <header className="topbar"><div><span className="kicker">REMOTE PROFESSIONALS</span><h2>Lead workspace</h2></div><div className="user"><span>{user?.display_name||"CRM User"}</span><button onClick={onLogout}>Sign out</button></div></header>
   <section className="hero"><div><span className="eyebrow">EMPLOYEE SEARCH</span><h1>Find the right agent,<br/><em>without slowing down.</em></h1><p>Enter the lead once. RPCPH CRM saves the lead under your identity and returns agents serving the target area.</p></div><div className="hero-mark">R</div></section>
   <section className="metrics">{metrics.map((m,i)=><motion.div className="metric" key={m.l} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{...spring,delay:.08+i*.06}}><strong>{m.n}</strong><span>{m.l}</span></motion.div>)}</section>
   <motion.form className="lead-card" onSubmit={submit} layout transition={spring}>
    <div className="card-head"><div><span className="eyebrow">NEW LEAD</span><h3>Save lead & find agents</h3></div><span className="isa">ISA · {user?.display_name||"Current user"}</span></div>
    <div className="grid">
      <Field label="Lead name" value={lead.name} onChange={v=>setLead({...lead,name:v})} placeholder="Client name"/>
      <Field label="Town or county" value={lead.town} onChange={v=>setLead({...lead,town:v})} placeholder="Caller location"/>
      <Select label="Lead type" value={lead.type} onChange={v=>setLead({...lead,type:v})} options={["Buyer","Seller","Investor","Land"]}/>
      <Field label="Target county" value={lead.county} onChange={v=>setLead({...lead,county:v})} placeholder="County client is looking in"/>
      <Select label="Lead source" value={lead.source} onChange={v=>setLead({...lead,source:v})} options={["MVIP New Prospect","MVIP BLA","MVIP Prio CB","Rocket Mortgage","Website","Internet Call","Cold Call","Other"]}/>
    </div>
    <div className="actions"><span>{status||"Search is matched against active agent territories."}</span><motion.button className="primary action" disabled={loading} whileHover={{scale:1.015}} whileTap={{scale:.985}}>{loading?"Searching…":"Save Lead & Find Agents"}</motion.button></div>
   </motion.form>
   <AnimatePresence mode="popLayout"><motion.section className="results" layout initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={spring}>{agents.length>0&&<><div className="results-head"><div><span className="eyebrow">MATCHES</span><h3>Available agents</h3></div><span>{agents.length} result{agents.length===1?"":"s"}</span></div>{agents.map((a,i)=><motion.article className="agent" key={a.id||i} layout initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{...spring,delay:i*.05}} whileHover={{y:-3}}><div className="agent-avatar">{String(a.name||"A").split(" ").map(x=>x[0]).slice(0,2).join("")}</div><div><h4>{a.name}</h4><p>{a.brokerage||"Independent agent"}</p><small>{a.service_area||a.service_areas?.join(", ")||"Service area available"}</small></div></motion.article>)}</>}</motion.section></AnimatePresence>
  </main>
 </motion.div>
}
function Field({label,value,onChange,placeholder}){return <label className="field"><span>{label}</span><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></label>}
function Select({label,value,onChange,options}){return <label className="field"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}>{options.map(x=><option key={x}>{x}</option>)}</select></label>}

function App(){
 const [user,setUser]=useState(null); const [checking,setChecking]=useState(true);
 useEffect(()=>{api("me").then(d=>setUser(d.user||d)).catch(()=>{}).finally(()=>setChecking(false))},[]);
 async function logout(){try{await api("logout")}catch{} localStorage.removeItem("rpcph_session");setUser(null)}
 if(checking)return <div className="loading"><motion.div className="loader" animate={{scale:[.92,1.05,.92],opacity:[.55,1,.55]}} transition={{duration:1.1,repeat:Infinity,ease:"easeInOut"}}/></div>;
 return <AnimatePresence mode="wait">{user?<motion.div key="app" className="screen" initial={{opacity:0,scale:1.012}} animate={{opacity:1,scale:1}} transition={{duration:.55,ease}}><Dashboard user={user} onLogout={logout}/></motion.div>:<motion.div key="login" className="screen" initial={{opacity:0,scale:.995}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:1.012}} transition={{duration:.48,ease}}><Login onLogin={setUser}/></motion.div>}</AnimatePresence>
}
createRoot(document.getElementById("root")).render(<App/>);

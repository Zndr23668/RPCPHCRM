import React,{useEffect,useMemo,useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import {AnimatePresence,motion,useReducedMotion} from "motion/react";
import "./styles.css";

/* Legacy workflow documents are mounted inside the React route shell until each
   workflow is fully componentized. Their original Supabase calls, validation,
   upload parsing, history handling, and permission checks remain intact. */
import adminPage from "../Admin/index.html?raw";
import usersPage from "../Admin/Users/index.html?raw";
import areasPage from "../Areas/index.html?raw";
import databasePage from "../DB/index.html?raw";

const API="https://pfuomojvcuwbvqtzvglb.supabase.co/functions/v1/rpcph-local-auth";
const KEY="sb_publishable__W9mPIcJIZ7QDhzbKWNm_g_IsEMgMUt";
const SESSION_KEY="rpcph_local_session_v1";

async function api(action,payload={}){
 const token=localStorage.getItem(SESSION_KEY);
 const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json","apikey":KEY},body:JSON.stringify({action,...payload,...(token?{token}:{})})});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(data.error||data.message||"Request failed");
 return data;
}
const ease=[.16,1,.3,1];
const spring={type:"spring",stiffness:420,damping:32,mass:.72};
const pageVariants={initial:{opacity:0,y:14,scale:.992},animate:{opacity:1,y:0,scale:1,transition:{duration:.42,ease}},exit:{opacity:0,y:-8,scale:.998,transition:{duration:.22,ease:[.4,0,1,1]}}};

function routeForPath(path){
 const p=path.replace(/\/+$/,"")||"/";
 if(p==="/Admin/Users"||p==="/Admin/Users/index.html")return "users";
 if(p==="/Admin"||p==="/Admin/index.html")return "admin";
 if(p==="/Areas"||p==="/Areas/index.html")return "areas";
 if(p==="/DB"||p==="/DB/index.html")return "database";
 return "home";
}

/* A React-owned route host for the existing complex workflow markup.
   Scripts are rehydrated in source order only after the DOM is mounted. */
function LegacyPage({html}){
 const host=useRef(null);
 useEffect(()=>{
  const parsed=new DOMParser().parseFromString(html,"text/html");
  const root=host.current;
  if(!root)return;
  const addedStyles=[];
  const addedLinks=[];
  const addedScripts=[];
  const previousTitle=document.title;
  if(parsed.title)document.title=parsed.title;
  parsed.querySelectorAll("style").forEach(source=>{
   const style=document.createElement("style");
   style.textContent=source.textContent||"";
   document.head.appendChild(style);addedStyles.push(style);
  });
  parsed.querySelectorAll('link[rel="stylesheet"]').forEach(source=>{
   const href=source.getAttribute("href");
   if(!href)return;
   let existing=[...document.querySelectorAll('link[rel="stylesheet"]')].find(x=>x.getAttribute("href")===href);
   if(!existing){
    const link=document.createElement("link");link.rel="stylesheet";link.href=href;
    document.head.appendChild(link);addedLinks.push(link);
   }
  });
  const content=[...parsed.body.childNodes].filter(n=>n.nodeName!=="SCRIPT");
  root.replaceChildren(...content.map(n=>document.importNode(n,true)));

  const runScripts=async()=>{
   const sources=[...parsed.querySelectorAll("script")];
   for(const source of sources){
    const src=source.getAttribute("src");
    if(src){
     if(src.includes("supabase-js")&&window.supabase)continue;
     if(src.includes("xlsx")&&window.XLSX)continue;
     if(src.endsWith("/local-auth.js")&&window.RPCPHAuth)continue;
     const script=document.createElement("script");
     [...source.attributes].forEach(a=>script.setAttribute(a.name,a.value));
     if(source.async===false)script.async=false;
     const loaded=new Promise((resolve,reject)=>{
      script.onload=resolve;
      script.onerror=()=>reject(new Error("Could not load page dependency: "+src));
     });
     document.body.appendChild(script);addedScripts.push(script);
     await loaded;
    }else if(source.textContent?.trim()){
     const script=document.createElement("script");
     script.textContent=source.textContent;
     document.body.appendChild(script);addedScripts.push(script);
    }
   }
  };
  runScripts().catch(error=>{
   const n=document.createElement("div");
   n.className="legacy-load-error";
   n.textContent=error.message||"A page dependency failed to load.";
   root.prepend(n);
   document.documentElement.classList.remove("auth-pending");
  });
  return ()=>{
   addedScripts.forEach(s=>s.remove());
   addedStyles.forEach(s=>s.remove());
   addedLinks.forEach(s=>s.remove());
   document.documentElement.classList.remove("auth-pending");
   document.title=previousTitle;
   root.replaceChildren();
  };
 },[html]);
 return <div className="legacy-screen" ref={host}/>;
}

function Login({onLogin}){
 const [key,setKey]=useState(""); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
 const reduce=useReducedMotion();
 async function submit(e){e.preventDefault();if(!key.trim())return;setBusy(true);setError("");
  try{const d=await api("login",{id_key:key.trim()});localStorage.setItem(SESSION_KEY,d.token);onLogin(d.user)}
  catch(err){setError(err.message||"Unable to sign in");}
  finally{setBusy(false)}
 }
 return <motion.div className="auth-scene" initial={reduce?false:{opacity:0}} animate={{opacity:1}} transition={{duration:.45}}>
  <div className="auth-backdrop"/>
  <motion.form className="auth-panel" onSubmit={submit} initial={reduce?false:{opacity:0,y:20,scale:.985}} animate={{opacity:1,y:0,scale:1}} transition={{...spring,delay:.08}}>
   <div className="brand"><div className="brandmark">R.</div><div><b>RPCPH CRM</b><small>REMOTE PROFESSIONALS</small></div></div>
   <div className="eyebrow">CRM ACCESS</div><h1>Sign in</h1>
   <p>Enter the ID KEY issued to you by your CRM administrator.</p>
   <label>ID KEY</label>
   <input autoFocus value={key} onChange={e=>setKey(e.target.value)} type="password" autoComplete="off" placeholder="Enter your ID KEY"/>
   <AnimatePresence>{error&&<motion.div className="error" initial={{opacity:0,height:0,y:-6}} animate={{opacity:1,height:"auto",y:0}} exit={{opacity:0,height:0}}>{error}</motion.div>}</AnimatePresence>
   <motion.button className="primary" disabled={busy||!key.trim()} whileHover={{scale:1.012}} whileTap={{scale:.982}} transition={spring}>{busy?"Signing in…":"Sign in"}</motion.button>
  </motion.form>
 </motion.div>
}

function Field({label,value,onChange,placeholder}){return <label className="field"><span>{label}</span><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></label>}
function Select({label,value,onChange,options}){return <label className="field"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}>{options.map(x=><option key={x}>{x}</option>)}</select></label>}

function Dashboard({user,onLogout}){
 const [lead,setLead]=useState({name:"",location:"",type:"Buyer",source:"MVIP New Prospect"});
 const [agents,setAgents]=useState([]);const [status,setStatus]=useState("");const [loading,setLoading]=useState(false);
 const reduce=useReducedMotion();
 const isAdmin=["admin","superadmin"].includes(user?.role);
 async function submit(e){e.preventDefault();if(!lead.location.trim()){setStatus("Enter a ZIP code, town, county, or location.");return;}setLoading(true);setStatus("Finding agents within 20 miles…");
  try{
   const geo=await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q="+encodeURIComponent(lead.location.trim()),{headers:{"Accept":"application/json"}});
   const places=await geo.json();
   if(!places?.length)throw new Error("Location not found. Try a ZIP code, town, county, or city and state.");
   const origin={latitude:Number(places[0].lat),longitude:Number(places[0].lon),label:places[0].display_name};
   const d=await api("create_lead",{lead_name:lead.name,target_location:lead.location.trim(),target_latitude:origin.latitude,target_longitude:origin.longitude,radius_miles:20,lead_type:lead.type,lead_source:lead.source});
   const within20=(d.agents||[]).map(a=>{const distance=Number(a.distance_miles??a.distance??NaN);return {...a,distance_miles:Number.isFinite(distance)?distance:null};}).filter(a=>a.distance_miles==null||a.distance_miles<=20).sort((a,b)=>(a.distance_miles??Infinity)-(b.distance_miles??Infinity));
   setAgents(within20);setStatus(within20.length?within20.length+" agent(s) found within 20 miles of "+origin.label:"No agents found within 20 miles.");
  }catch(err){setStatus(err.message||"Could not search for agents");}finally{setLoading(false)}
 }
 const metrics=useMemo(()=>[{n:"24",l:"Active leads"},{n:"18",l:"Agents available"},{n:"96%",l:"Search readiness"}],[]);
 return <motion.div className="app" initial={reduce?false:"initial"} animate="animate" variants={pageVariants}>
  <aside className="rail"><div className="rail-logo">R.</div>{["⌂","⌕","◫","◉"].map((x,i)=><motion.div key={i} className={"rail-item "+(i===0?"active":"")} whileHover={{y:-2}} whileTap={{scale:.94}}>{x}</motion.div>)}<div className="rail-spacer"/><motion.button className="rail-item logout" onClick={onLogout} whileTap={{scale:.94}}>↪</motion.button></aside>
  <main className="workspace">
   <header className="topbar">
    <div><span className="kicker">REMOTE PROFESSIONALS</span><h2>Lead workspace</h2></div>
    <div className="workspace-tools">
     {isAdmin&&<nav className="admin-nav" aria-label="Administration">
      <a href="/Admin/">Import</a><a href="/Admin/Users/">Users</a><a href="/Areas/">Areas</a><a href="/DB/">Database</a>
     </nav>}
     <div className="user"><span>{user?.display_name||"CRM User"} · {user?.role||"employee"}</span><button onClick={onLogout}>Sign out</button></div>
    </div>
   </header>
   <section className="hero"><div><span className="eyebrow">EMPLOYEE SEARCH</span><h1>Find the right agent,<br/><em>without slowing down.</em></h1><p>Enter the lead once. RPCPH CRM saves the lead under your identity and returns agents serving the target area.</p></div><div className="hero-mark">R</div></section>
   <section className="metrics">{metrics.map((m,i)=><motion.div className="metric" key={m.l} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{...spring,delay:.08+i*.06}}><strong>{m.n}</strong><span>{m.l}</span></motion.div>)}</section>
   <motion.form className="lead-card" onSubmit={submit} layout transition={spring}>
    <div className="card-head"><div><span className="eyebrow">NEW LEAD</span><h3>Save lead & find agents</h3></div><span className="isa">ISA · {user?.display_name||"Current user"}</span></div>
    <div className="grid">
     <Field label="Lead name" value={lead.name} onChange={v=>setLead({...lead,name:v})} placeholder="Client name"/>
     <label className="field location-field"><span>What are you looking for?</span><input value={lead.location} onChange={e=>setLead({...lead,location:e.target.value})} placeholder="ZIP code, town, county, or location" autoComplete="off"/></label>
     <Select label="Lead type" value={lead.type} onChange={v=>setLead({...lead,type:v})} options={["Buyer","Seller","Investor","Land"]}/>
     <Select label="Lead source" value={lead.source} onChange={v=>setLead({...lead,source:v})} options={["MVIP New Prospect","MVIP BLA","MVIP Prio CB","Rocket Mortgage","Website","Internet Call","Cold Call","Other"]}/>
    </div>
    <div className="actions"><span>{status||"Press Enter to search active agents within 20 miles."}</span><motion.button type="submit" className="primary action" disabled={loading} whileHover={{scale:1.015}} whileTap={{scale:.985}}>{loading?"Searching…":"Save Lead & Find Agents"}</motion.button></div>
   </motion.form>
   <AnimatePresence mode="popLayout"><motion.section className="results" layout initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={spring}>{agents.length>0&&<><div className="results-head"><div><span className="eyebrow">MATCHES</span><h3>Available agents</h3></div><span>{agents.length} result{agents.length===1?"":"s"}</span></div>{agents.map((a,i)=><motion.article className="agent" key={a.id||i} layout initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{...spring,delay:i*.05}} whileHover={{y:-3}}><div className="agent-avatar">{String(a.name||"A").split(" ").map(x=>x[0]).slice(0,2).join("")}</div><div><h4>{a.name}</h4><p>{a.brokerage||"Independent agent"}</p><small>{a.service_area||a.service_areas?.join(", ")||"Service area available"}{a.distance_miles!=null&&" · "+a.distance_miles.toFixed(1)+" mi"}</small></div></motion.article>)}</>}</motion.section></AnimatePresence>
  </main>
 </motion.div>
}

function App(){
 const [user,setUser]=useState(null);const [checking,setChecking]=useState(true);
 const route=routeForPath(window.location.pathname);
 useEffect(()=>{
  api("me").then(d=>setUser(d.user||d)).catch(()=>{localStorage.removeItem(SESSION_KEY)}).finally(()=>setChecking(false));
 },[]);
 async function logout(){try{await api("logout")}catch{}localStorage.removeItem(SESSION_KEY);setUser(null);if(route!=="home")location.replace("/");}
 if(checking)return <div className="loading"><motion.div className="loader" animate={{scale:[.92,1.05,.92],opacity:[.55,1,.55]}} transition={{duration:1.1,repeat:Infinity,ease:"easeInOut"}}/></div>;
 if(route!=="home"){
  const pages={admin:adminPage,users:usersPage,areas:areasPage,database:databasePage};
  return <LegacyPage html={pages[route]}/>;
 }
 return <AnimatePresence mode="wait">{user?<motion.div key="app" className="screen" initial={{opacity:0,scale:1.012}} animate={{opacity:1,scale:1}} transition={{duration:.55,ease}}><Dashboard user={user} onLogout={logout}/></motion.div>:<motion.div key="login" className="screen" initial={{opacity:0,scale:.995}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:1.012}} transition={{duration:.48,ease}}><Login onLogin={setUser}/></motion.div>}</AnimatePresence>
}
createRoot(document.getElementById("root")).render(<App/>);

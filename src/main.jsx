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
import agentsPage from "../Agents/index.html?raw";
import leadsPage from "../Leads/index.html?raw";

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
 if(p==="/Agents"||p==="/Agents/index.html")return "agents";
 if(p==="/Leads"||p==="/Leads/index.html")return "leads";
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
   <div className="login-company-lockup" aria-label="Remote Professionals and Coldwell Banker">
    <div className="company-logo remote-company"><span className="rp-symbol">RP</span><span className="rp-wordmark"><strong>REMOTE</strong><small>PROFESSIONALS</small></span></div>
    <span className="company-separator" aria-hidden="true"></span>
    <div className="company-logo coldwell-company"><span className="cb-symbol">CB</span><span className="cb-wordmark">Coldwell<br/>Banker</span></div>
   </div>
   <div className="login-product-name">RPCPH CRM</div>
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
 const [agents,setAgents]=useState([]);const [expandedAgents,setExpandedAgents]=useState([]);const [showMore,setShowMore]=useState(false);const [status,setStatus]=useState("");const [loading,setLoading]=useState(false);const [rouletteOffer,setRouletteOffer]=useState(null);const [rouletteEvents,setRouletteEvents]=useState({});const [respondingAgent,setRespondingAgent]=useState(null);const [declineTarget,setDeclineTarget]=useState(null);const [declineReason,setDeclineReason]=useState("");const [declineBusy,setDeclineBusy]=useState(false);const [currentLead,setCurrentLead]=useState(null);
 const [locationSuggestions,setLocationSuggestions]=useState([]);const [suggestionsOpen,setSuggestionsOpen]=useState(false);const [suggestionsLoading,setSuggestionsLoading]=useState(false);const [selectedLocation,setSelectedLocation]=useState(null);
 const [metrics,setMetrics]=useState([{n:"—",l:"Active leads",detail:"Loading live data…"},{n:"—",l:"Agents available",detail:"Loading live data…"},{n:"—",l:"Search readiness",detail:"Loading lead-source mix…"}]);
 useEffect(()=>{const query=lead.location.trim();if(query.length<3){setLocationSuggestions([]);setSuggestionsOpen(false);setSuggestionsLoading(false);return;}const controller=new AbortController();const timer=setTimeout(async()=>{setSuggestionsLoading(true);try{const url="https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=us&q="+encodeURIComponent(query);const response=await fetch(url,{headers:{Accept:"application/json"},signal:controller.signal});if(!response.ok)throw new Error("Location suggestions unavailable");const data=await response.json();setLocationSuggestions(Array.isArray(data)?data:[]);setSuggestionsOpen(true);}catch(error){if(error.name!=="AbortError")setLocationSuggestions([]);}finally{if(!controller.signal.aborted)setSuggestionsLoading(false);}},450);return()=>{clearTimeout(timer);controller.abort();};},[lead.location]);
 function chooseLocation(place){setLead(current=>({...current,location:place.display_name}));setSelectedLocation({latitude:Number(place.lat),longitude:Number(place.lon),label:place.display_name});setLocationSuggestions([]);setSuggestionsOpen(false);}
 async function refreshMetrics(){
  try{
   const data=await api("dashboard_metrics");
   setMetrics([
    {n:Number(data.active_leads||0).toLocaleString(),l:"Active leads",detail:"Live open leads"},
    {n:Number(data.active_agents||0).toLocaleString(),l:"Agents available",detail:"Active agent database records"},
    {n:(Number(data.top_source_percent)||0)+"%",l:"Search readiness",detail:data.total_leads?("Top source: "+data.top_source+" · "+data.top_source_count+"/"+data.total_leads+" leads"):"No lead-source data yet"}
   ]);
  }catch(error){
   setMetrics([
    {n:"—",l:"Active leads",detail:"Live data unavailable"},
    {n:"—",l:"Agents available",detail:"Live data unavailable"},
    {n:"—",l:"Search readiness",detail:"Lead-source data unavailable"}
   ]);
  }
 }
 useEffect(()=>{refreshMetrics();},[]);
 const reduce=useReducedMotion();
 const isAdmin=["admin","superadmin"].includes(user?.role);
 async function submit(e){e.preventDefault();if(!lead.name.trim()){setStatus("Enter the lead name.");return;}if(!lead.location.trim()){setStatus("Enter a ZIP code, town, county, state, or location.");return;}if(!lead.type||!lead.source){setStatus("Select a lead type and lead source.");return;}setLoading(true);setStatus("Resolving county and checking assigned agent territories…");
  try{
   setCurrentLead(null);
   let origin=selectedLocation&&selectedLocation.label===lead.location.trim()?selectedLocation:null;
   if(!origin){const geo=await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&countrycodes=us&q="+encodeURIComponent(lead.location.trim()),{headers:{"Accept":"application/json"}});const places=await geo.json();if(!places?.length)throw new Error("Location not found. Choose a suggested location or try a ZIP code, town, county, or city and state.");origin={latitude:Number(places[0].lat),longitude:Number(places[0].lon),label:places[0].display_name};}
   const d=await api("create_lead",{lead_name:lead.name.trim(),town_or_county:lead.location.trim(),county_used:lead.location.trim(),target_county:lead.location.trim(),target_location:lead.location.trim(),target_latitude:origin.latitude,target_longitude:origin.longitude,radius_miles:20,lead_type:lead.type.toLowerCase(),lead_source:lead.source});
   const milesBetween=(lat1,lon1,lat2,lon2)=>{const rad=x=>x*Math.PI/180;const dLat=rad(lat2-lat1),dLon=rad(lon2-lon1);const h=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;return 3958.7613*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));};
   const within20=(d.agents||[]).map(a=>{const direct=Number(a.distance_miles??a.distance??NaN);const lat=Number(a.latitude??a.lat??a.agent_latitude??NaN);const lon=Number(a.longitude??a.lng??a.lon??a.agent_longitude??NaN);const distance=Number.isFinite(direct)?direct:(Number.isFinite(lat)&&Number.isFinite(lon)?milesBetween(origin.latitude,origin.longitude,lat,lon):NaN);return {...a,distance_miles:distance};}).filter(a=>Number.isFinite(a.distance_miles)&&a.distance_miles<=20).sort((a,b)=>a.distance_miles-b.distance_miles);
   const matches=Array.isArray(d.agents)?d.agents:[];
   const wider=Array.isArray(d.expanded_agents)?d.expanded_agents:[];
   setCurrentLead(d.lead||null);
   refreshMetrics();
   setAgents(matches.length?matches:wider);
   setExpandedAgents(matches.length?wider:[]);
   setRouletteOffer(d.roulette_offer||null);setRouletteEvents(Object.fromEntries((d.roulette_events||[]).map(event=>[event.agent_id,event])));
   setShowMore(false);
   if(d.match_warning)setStatus("Lead saved. "+d.match_warning);
   else if(matches.length)setStatus(matches.length+" exact county match(es) for "+(d.matched_county||"the selected county")+". Wider state coverage is available below.");
   else if(wider.length)setStatus("No exact county assignment. Showing "+wider.length+" agents with wider state coverage.");
   else setStatus("Lead saved. No active agents are assigned in this county or elsewhere in the state.");
  }catch(err){setStatus(err.message||"Could not search for agents");}finally{setLoading(false)}
 }
 async function respondToAgent(agent,decision,reason=""){const event=rouletteEvents[agent.id];if(!event?.id||respondingAgent||currentLead?.accepted_agent_id)return;setRespondingAgent(agent.id);try{const result=await api("respond_roulette_offer",{event_id:event.id,decision,decline_reason:reason});setRouletteEvents(current=>({...current,[agent.id]:result.event}));if(decision==="accepted"&&result.lead)setCurrentLead(current=>({...current,...result.lead}));setStatus(decision==="accepted"?agent.name+" accepted and is now assigned to this lead.":agent.name+" declined this lead; you can continue with another agent.");if(rouletteOffer?.id===event.id)setRouletteOffer(result.event);setDeclineTarget(null);setDeclineReason("");}catch(error){setStatus(error.message||"Could not record the agent response.");}finally{setRespondingAgent(null);setDeclineBusy(false);}}
 function submitDecline(e){e.preventDefault();if(!declineTarget||!declineReason.trim())return;setDeclineBusy(true);respondToAgent(declineTarget,"declined",declineReason.trim());}
 const rouletteModeNames={fair:"Fair Roulette",russian:"Russian Roulette",random:"Random Roulette",apex:"Apex Roulette",ascendancy:"Ascendancy Roulette"};
 return <motion.div className="app" initial={reduce?false:"initial"} animate="animate" variants={pageVariants}>
  <aside className="rail"><div className="rail-logo">R.</div>{["⌂","⌕","◫","◉"].map((x,i)=><motion.div key={i} className={"rail-item "+(i===0?"active":"")} whileHover={{y:-2}} whileTap={{scale:.94}}>{x}</motion.div>)}<div className="rail-spacer"/><motion.button className="rail-item logout" onClick={onLogout} whileTap={{scale:.94}}>↪</motion.button></aside>
  <main className="workspace">
   <header className="topbar">
    <div className="workspace-heading"><div className="workspace-company-lockup" aria-label="Remote Professionals and Coldwell Banker">
      <div className="company-logo remote-company"><span className="rp-symbol">RP</span><span className="rp-wordmark"><strong>REMOTE</strong><small>PROFESSIONALS</small></span></div>
      <span className="company-separator" aria-hidden="true"></span>
      <div className="company-logo coldwell-company"><span className="cb-symbol">CB</span><span className="cb-wordmark">Coldwell<br/>Banker</span></div>
     </div><h2>Workspace</h2></div>
    <div className="workspace-tools">
     {isAdmin&&<nav className="admin-nav" aria-label="Administration">
      <a href="/Leads/">Leads</a><a href="/Agents/">Agent Profiles</a><a href="/Admin/">Import</a><a href="/Admin/Users/">Users</a><a href="/Areas/">Areas</a>
     </nav>}
     <div className="user"><span>{user?.display_name||"CRM User"} · {user?.role||"employee"}</span><button onClick={onLogout}>Sign out</button></div>
    </div>
   </header>
   <section className="hero"><div><h1>Find the right agent</h1></div><div className="hero-mark">R</div></section>
   <section className="metrics">{metrics.map((m,i)=><motion.div className="metric" key={m.l} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{...spring,delay:.08+i*.06}}><strong>{m.n}</strong><span>{m.l}</span><small>{m.detail}</small></motion.div>)}</section>
   <motion.form className="lead-card" onSubmit={submit} layout transition={spring}>
    <div className="card-head"><div><span className="eyebrow">NEW LEAD</span><h3>Save lead & find agents</h3></div><span className="isa">ISA · {user?.display_name||"Current user"}</span></div>
    <div className="grid">
     <Field label="Lead name" value={lead.name} onChange={v=>setLead({...lead,name:v})} placeholder="Client name"/>
     <div className="field location-field location-autocomplete"><span>What are you looking for?</span><div className="location-input-wrap"><input role="combobox" aria-autocomplete="list" aria-expanded={suggestionsOpen&&locationSuggestions.length>0} aria-controls="location-suggestions" value={lead.location} onFocus={()=>{if(locationSuggestions.length)setSuggestionsOpen(true);}} onChange={e=>{setLead({...lead,location:e.target.value});setSelectedLocation(null);}} onKeyDown={e=>{if(e.key==="Escape")setSuggestionsOpen(false);if(e.key==="Enter"&&suggestionsOpen&&locationSuggestions.length){e.preventDefault();chooseLocation(locationSuggestions[0]);}}} placeholder="Start typing a town, county, state, or ZIP code" autoComplete="off"/>{suggestionsLoading&&<span className="suggestion-spinner" aria-label="Loading suggestions"/>}</div>{suggestionsOpen&&locationSuggestions.length>0&&<div className="location-suggestions" id="location-suggestions" role="listbox">{locationSuggestions.map((place,index)=><button type="button" role="option" aria-selected="false" className="location-suggestion" key={place.place_id||index} onMouseDown={e=>e.preventDefault()} onClick={()=>chooseLocation(place)}><span className="suggestion-pin">⌖</span><span><strong>{place.name||place.display_name.split(",")[0]}</strong><small>{place.display_name}</small></span></button>)}</div>}{suggestionsOpen&&!suggestionsLoading&&lead.location.trim().length>=3&&locationSuggestions.length===0&&<div className="location-suggestions empty">No matching locations found.</div>}<small className="location-hint">Type at least 3 characters, then choose a suggested U.S. location.</small></div>
     <Select label="Lead type" value={lead.type} onChange={v=>setLead({...lead,type:v})} options={["Buyer","Seller","Investor","Land"]}/>
     <Select label="Lead source" value={lead.source} onChange={v=>setLead({...lead,source:v})} options={["MVIP New Prospect","MVIP BLA","MVIP Prio CB","Rocket Mortgage","Website","Internet Call","Cold Call","Other"]}/>
    </div>
    <div className="actions"><span>{status||"Press Enter to find agents assigned to the selected county."}</span><motion.button type="submit" className="primary action" disabled={loading} whileHover={{scale:1.015}} whileTap={{scale:.985}}>{loading?"Searching…":"Save Lead & Find Agents"}</motion.button></div>
   </motion.form>
   <AnimatePresence mode="popLayout"><motion.section className="results" layout initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={spring}>{agents.length>0&&<><div className="results-head"><div><span className="eyebrow">SMART AGENT FINDER</span><h3>{agents[0]?.match_level==="statewide"?"Wider coverage agents":"Exact county matches"}</h3></div><span>{agents.length+(showMore?expandedAgents.length:0)} result{agents.length+(showMore?expandedAgents.length:0)===1?"":"s"}</span></div><div className="agent-grid">{[...agents,...(showMore?expandedAgents:[])].map((a,i)=><motion.article className={"agent agent-card "+(rouletteOffer?.agent_id===a.id?"agent-roulette-highlight":"")} key={a.id||i} layout initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{...spring,delay:i*.035}} whileHover={{y:-3}}>{rouletteOffer?.agent_id===a.id&&<div className="roulette-highlight-label" title="Selected agent" aria-label="Selected agent">✦</div>}<div className="agent-avatar">{String(a.name||"A").split(" ").map(x=>x[0]).slice(0,2).join("")}</div><div className="agent-card-content"><h4>{a.name}</h4><p className="agent-brokerage"><span>OFFICE / BROKERAGE</span>{a.brokerage||"Not provided"}</p><small className="agent-match">{a.match_reason||a.service_area||a.service_areas?.join(", ")||"Service area available"}</small><div className="agent-contact">{a.email?<a href={`mailto:${a.email}`}><span>Email</span>{a.email}</a>:<div className="agent-contact-missing"><span>Email</span>Not provided</div>}{a.phone?<a href={`tel:${String(a.phone).replace(/[^+\d]/g,"")}`}><span>Phone</span>{a.phone}</a>:<div className="agent-contact-missing"><span>Phone</span>Not provided</div>}</div>{rouletteEvents[a.id]&&<div className="roulette-accept-row">{rouletteEvents[a.id].status==="accepted"?<span className="roulette-response-status accepted">✓ Accepted</span>:rouletteEvents[a.id].status==="declined"?<span className="roulette-response-status declined">Declined</span>:currentLead?.accepted_agent_id?<span className="roulette-response-status">Lead assigned</span>:<><button type="button" className="roulette-accept" disabled={respondingAgent===a.id} onClick={()=>respondToAgent(a,"accepted")}>{respondingAgent===a.id?"Saving…":"Accept"}</button><button type="button" className="roulette-decline" disabled={respondingAgent===a.id} onClick={()=>{setDeclineTarget(a);setDeclineReason("");}}>{respondingAgent===a.id?"Saving…":"Decline"}</button></>}</div>}</div></motion.article>)}</div>{expandedAgents.length>0&&<button type="button" className="primary action" style={{marginTop:16}} onClick={()=>setShowMore(v=>!v)}>{showMore?"Show fewer agents":`Show more agents · +${expandedAgents.length}`}</button>}</>}</motion.section></AnimatePresence>
<AnimatePresence>{declineTarget&&<motion.div className="decline-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={e=>{if(e.target===e.currentTarget&&!declineBusy)setDeclineTarget(null);}}><motion.form className="decline-dialog" initial={{opacity:0,y:16,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:10,scale:.98}} onSubmit={submitDecline}><div className="decline-dialog-head"><div><span className="eyebrow">AGENT RESPONSE</span><h3>Why did {declineTarget.name} decline?</h3><p>Enter the reason. It will be saved to this agent’s history and the lead’s activity record.</p></div><button type="button" className="decline-close" disabled={declineBusy} onClick={()=>setDeclineTarget(null)}>×</button></div><textarea autoFocus value={declineReason} onChange={e=>setDeclineReason(e.target.value)} maxLength={1000} required placeholder="e.g. Agent is out of town, unavailable, or not interested."/><div className="decline-dialog-actions"><button type="button" className="decline-cancel" disabled={declineBusy} onClick={()=>setDeclineTarget(null)}>Cancel</button><button type="submit" className="roulette-decline" disabled={declineBusy||!declineReason.trim()}>{declineBusy?"Saving…":"Save decline"}</button></div></motion.form></motion.div>}</AnimatePresence>  </main>
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
  const pages={admin:adminPage,users:usersPage,areas:areasPage,database:databasePage,agents:agentsPage,leads:leadsPage};
  return <LegacyPage html={pages[route]}/>;
 }
 return <AnimatePresence mode="wait">{user?<motion.div key="app" className="screen" initial={{opacity:0,scale:1.012}} animate={{opacity:1,scale:1}} transition={{duration:.55,ease}}><Dashboard user={user} onLogout={logout}/></motion.div>:<motion.div key="login" className="screen" initial={{opacity:0,scale:.995}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:1.012}} transition={{duration:.48,ease}}><Login onLogin={setUser}/></motion.div>}</AnimatePresence>
}
createRoot(document.getElementById("root")).render(<App/>);

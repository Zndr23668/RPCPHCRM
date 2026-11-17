(function(){
 const SUPABASE_URL="https://pfuomojvcuwbvqtzvglb.supabase.co";
 const SUPABASE_KEY="sb_publishable__W9mPIcJIZ7QDhzbKWNm_g_IsEMgMUt";
 const ENDPOINT=SUPABASE_URL+"/functions/v1/rpcph-local-auth";
 const STORAGE_KEY="rpcph_local_session_v1";
 const CACHE_TTL={agent_profiles:20000,leads_listing:12000,agent_roulette_history:18000};
 const copy=value=>{
  try{return typeof structuredClone==="function"?structuredClone(value):JSON.parse(JSON.stringify(value));}
  catch{return value;}
 };
 const sharedCache=window.RPCPHDataCache||(window.RPCPHDataCache=(()=>{
  const values=new Map();
  return {
   get(key){
    const item=values.get(key);
    if(!item||item.expiresAt<=Date.now()){values.delete(key);return undefined;}
    return copy(item.value);
   },
   set(key,value,ttl=15000){values.set(key,{value:copy(value),expiresAt:Date.now()+ttl});},
   clear(prefix=""){
    for(const key of values.keys())if(!prefix||String(key).startsWith(prefix))values.delete(key);
   }
  };
 })());
 const inFlight=new Map();
 function token(){try{return localStorage.getItem(STORAGE_KEY)||""}catch{return ""}}
 function saveToken(value){try{localStorage.setItem(STORAGE_KEY,value)}catch{}}
 function clear(){
  try{localStorage.removeItem(STORAGE_KEY)}catch{}
  window.RPCPH_CURRENT_USER=null;
  sharedCache.clear();
 }
 function invalidateAfter(action){
  const prefixes={
   create_lead:["api:leads_listing:","api:agent_profiles:","api:agent_roulette_history:","db:agents:"],
   respond_roulette_offer:["api:leads_listing:","api:agent_profiles:","api:agent_roulette_history:"],
   update_agent_profile:["api:agent_profiles:"],
  }[action]||[];
  prefixes.forEach(prefix=>sharedCache.clear(prefix));
 }
 async function api(action,payload={},options={}){
  const currentToken=token();
  const ttl=CACHE_TTL[action]||0;
  const cacheKey="api:"+action+":"+currentToken+":"+JSON.stringify(payload);
  if(ttl&&!options.fresh){
   const cached=sharedCache.get(cacheKey);
   if(cached!==undefined)return cached;
   const pending=inFlight.get(cacheKey);
   if(pending)return copy(await pending);
  }
  const request=(async()=>{
   const response=await fetch(ENDPOINT,{
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},
    body:JSON.stringify({action,...payload,...(currentToken?{token:currentToken}:{})})
   });
   const data=await response.json().catch(()=>({error:"Invalid server response"}));
   if(!response.ok)throw new Error(data.error||"Request failed");
   return data;
  })();
  if(ttl)inFlight.set(cacheKey,request);
  try{
   const data=await request;
   if(ttl)sharedCache.set(cacheKey,data,ttl);
   else invalidateAfter(action);
   return ttl?copy(data):data;
  }finally{
   if(ttl)inFlight.delete(cacheKey);
  }
 }
 async function requireAuth(roles){
  try{
   if(!token())throw new Error("Sign in required");
   let user=window.RPCPH_CURRENT_USER||null;
   if(!user){
    const data=await api("me",{}, {fresh:true});
    user=data.user||data;
    window.RPCPH_CURRENT_USER=user;
   }
   if(roles&&roles.length&&!roles.includes(user.role)){location.replace("/");return null}
   document.documentElement.classList.remove("auth-pending");
   return user;
  }catch(error){
   clear();
   location.replace("/?next="+encodeURIComponent(location.pathname+location.search));
   return null;
  }
 }
 async function logout(){try{await api("logout")}catch{}clear();location.replace("/Login/")}
 window.RPCPHAuth={api,requireAuth,logout,saveToken,clear,token,clearCache:prefix=>sharedCache.clear(prefix)};
})();
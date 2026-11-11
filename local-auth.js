(function(){
 const SUPABASE_URL="https://pfuomojvcuwbvqtzvglb.supabase.co";
 const SUPABASE_KEY="sb_publishable__W9mPIcJIZ7QDhzbKWNm_g_IsEMgMUt";
 const ENDPOINT=SUPABASE_URL+"/functions/v1/rpcph-local-auth";
 const STORAGE_KEY="rpcph_local_session_v1";
 function token(){try{return localStorage.getItem(STORAGE_KEY)||""}catch{return ""}}
 function saveToken(v){try{localStorage.setItem(STORAGE_KEY,v)}catch{}}
 function clear(){try{localStorage.removeItem(STORAGE_KEY)}catch{}}
 async function api(action,payload={}){
  const t=token();
  const response=await fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},body:JSON.stringify({action,...payload,...(t?{token:t}:{})})});
  const data=await response.json().catch(()=>({error:"Invalid server response"}));
  if(!response.ok)throw new Error(data.error||"Request failed");
  return data;
 }
 async function requireAuth(roles){
  try{
   if(!token())throw new Error("Sign in required");
   const data=await api("me");
   if(roles&&roles.length&&!roles.includes(data.user.role)){location.replace("/");return null}
   document.documentElement.classList.remove("auth-pending");
   window.RPCPH_CURRENT_USER=data.user;
   return data.user;
  }catch(e){clear();location.replace("/Login/");return null}
 }
 async function logout(){try{await api("logout")}catch{}clear();location.replace("/Login/")}
 window.RPCPHAuth={api,requireAuth,logout,saveToken,clear,token};
})();
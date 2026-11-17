/* Shared, idempotent motion behavior for the CRM shell and lazy-loaded workflow pages. */
(()=>{
 const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 function refresh(scope=document){
  const root=scope.querySelector?.(".page,main,.wrap")||scope;
  if(!reduced){
   root.classList?.add("crm-enter");
   const items=root.querySelectorAll?.(".panel,.stat,.metric,.section,.lead-card,.results")||[];
   items.forEach((element,index)=>{
    element.classList.add("crm-stagger");
    element.style.setProperty("--crm-delay",Math.min(index*45,360)+"ms");
   });
  }
  document.documentElement.classList.remove("auth-pending");
 }
 if(!window.RPCPH_MOTION_LISTENER_READY){
  window.RPCPH_MOTION_LISTENER_READY=true;
  document.addEventListener("click",event=>{
   const anchor=event.target?.closest?.("a[href]");
   if(!anchor||anchor.target==="_blank"||event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;
   const href=anchor.getAttribute("href");
   if(!href||href.startsWith("#")||href.startsWith("javascript:")||anchor.hasAttribute("download"))return;
   let target;
   try{target=new URL(href,window.location.href);}catch{return;}
   if(target.origin!==window.location.origin)return;
   event.preventDefault();
   const destination=target.pathname+target.search+target.hash;
   if(typeof window.RPCPHNavigate==="function")window.RPCPHNavigate(destination);
   else window.location.assign(target.href);
  });
 }
 window.RPCPHMotionRefresh=refresh;
 refresh(document);
})();
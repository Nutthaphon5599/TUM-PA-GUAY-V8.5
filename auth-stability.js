'use strict';
(function(){
  const state={client:null,refreshing:null,lastRefresh:0,online:navigator.onLine};
  const isJwtError=(err)=>{
    const msg=String(err?.message||err||'').toLowerCase();
    const code=String(err?.code||err?.status||'');
    return msg.includes('jwt expired')||msg.includes('invalid jwt')||msg.includes('refresh token')||code==='401';
  };
  function createClient(url,key){
    if(!window.supabase) throw new Error('Supabase library is not loaded');
    state.client=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'tpg-pos-auth-v83'}});
    state.client.auth.onAuthStateChange((event,session)=>{
      if(event==='TOKEN_REFRESHED') state.lastRefresh=Date.now();
      if(event==='SIGNED_OUT') window.dispatchEvent(new CustomEvent('tpg:signedout'));
      window.dispatchEvent(new CustomEvent('tpg:auth',{detail:{event,session}}));
    });
    return state.client;
  }
  async function refresh(force=false){
    if(!state.client) return null;
    if(state.refreshing) return state.refreshing;
    if(!force && Date.now()-state.lastRefresh<60000){
      const {data}=await state.client.auth.getSession();
      return data.session||null;
    }
    state.refreshing=(async()=>{
      try{
        const current=await state.client.auth.getSession();
        if(current.error) throw current.error;
        if(!current.data.session) return null;
        const exp=(current.data.session.expires_at||0)*1000;
        if(force || exp-Date.now()<5*60*1000){
          const renewed=await state.client.auth.refreshSession();
          if(renewed.error) throw renewed.error;
          state.lastRefresh=Date.now();
          return renewed.data.session||null;
        }
        return current.data.session;
      } finally { state.refreshing=null; }
    })();
    return state.refreshing;
  }
  async function ensureSession(){
    const session=await refresh(false);
    if(!session) throw new Error('SESSION_REQUIRED');
    return session;
  }
  async function run(operation,{retry=true}={}){
    await ensureSession();
    try{return await operation();}
    catch(err){
      if(retry && isJwtError(err)){
        await refresh(true);
        return operation();
      }
      throw err;
    }
  }
  function installLifecycle(){
    setInterval(()=>refresh(false).catch(console.warn),4*60*1000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh(true).catch(console.warn)});
    window.addEventListener('focus',()=>refresh(false).catch(console.warn));
    window.addEventListener('online',()=>{state.online=true;window.dispatchEvent(new Event('tpg:online'));refresh(true).catch(console.warn)});
    window.addEventListener('offline',()=>{state.online=false;window.dispatchEvent(new Event('tpg:offline'))});
  }
  installLifecycle();
  window.TPG_AUTH={createClient,refresh,ensureSession,run,isJwtError,state};
})();

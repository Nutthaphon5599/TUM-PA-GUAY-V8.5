'use strict';
(function(){
  const state={client:null,refreshing:null,lastRefresh:0};
  function isAuthError(err){const m=String(err?.message||err||'').toLowerCase();return err?.status===401||m.includes('jwt expired')||m.includes('invalid jwt')||m.includes('refresh token')||m.includes('not authenticated')}
  async function refresh(force=false){
    const c=state.client;if(!c)return null;
    if(state.refreshing)return state.refreshing;
    if(!force&&Date.now()-state.lastRefresh<30000){const {data}=await c.auth.getSession();return data?.session||null}
    state.refreshing=(async()=>{try{const {data,error}=await c.auth.refreshSession();if(error)throw error;state.lastRefresh=Date.now();return data?.session||null}finally{state.refreshing=null}})();
    return state.refreshing;
  }
  function createClient(url,key){
    const c=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'},global:{headers:{'x-client-info':'tum-pa-guay-v8.3'}}});
    state.client=c;
    c.auth.onAuthStateChange((event,session)=>{
      if(event==='TOKEN_REFRESHED')state.lastRefresh=Date.now();
      if(event==='SIGNED_OUT'&&location.pathname.endsWith('pos.html')) console.info('Session signed out');
    });
    return c;
  }
  async function ensureSession(){
    const c=state.client;if(!c)return null;
    const {data,error}=await c.auth.getSession();
    if(error&&isAuthError(error))return refresh(true);
    if(!data?.session)return null;
    const expires=(data.session.expires_at||0)*1000;
    if(expires-Date.now()<120000)return refresh(true);
    return data.session;
  }
  async function run(fn,{retry=true}={}){
    try{await ensureSession();return await fn()}catch(err){
      if(retry&&isAuthError(err)){const s=await refresh(true);if(s)return fn()}
      throw err;
    }
  }
  function friendly(err){
    if(isAuthError(err))return 'ເຊດຊັນໝົດອາຍຸ ລະບົບກຳລັງເຊື່ອມຕໍ່ໃໝ່. ກະລຸນາລອງອີກຄັ້ງ.';
    if(!navigator.onLine)return 'ອິນເຕີເນັດຂາດການເຊື່ອມຕໍ່. ລະບົບຈະກັບມາເມື່ອອອນລາຍ.';
    return err?.message||String(err||'ເກີດຂໍ້ຜິດພາດ');
  }
  async function resume(){if(document.visibilityState==='visible'&&navigator.onLine){try{await ensureSession()}catch(e){console.warn('Session resume failed',e)}}}
  document.addEventListener('visibilitychange',resume);window.addEventListener('focus',resume);window.addEventListener('online',resume);
  setInterval(()=>{if(document.visibilityState==='visible'&&navigator.onLine)ensureSession().catch(()=>{})},4*60*1000);
  window.TPG_STABILITY={createClient,ensureSession,refresh,run,isAuthError,friendly};
})();

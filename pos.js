'use strict';
const cfg=window.TPG_CONFIG;
const $=s=>document.querySelector(s);
let client=null,user=null,categories=[],menus=[],tables=[],allTables=[],orders=[],history=[],cart=[],currentOrder=null,lastPaidOrder=null;
let restaurantSettings={vat_mode:"inclusive",vat_rate:10};
const MENU_CACHE_KEY='tpg-v853-menu-cache';
const LEGACY_MENU_CACHE_KEY='tpg-v83-final-menu-cache';
const CACHE_MAX_AGE=24*60*60*1000;
let menuImageObserver=null,menuRenderFrame=0;
// V8.5.5 — multi-device table lock + realtime sync.
const DEVICE_ID_KEY='tpg-v855-device-id';
const DEVICE_ID=localStorage.getItem(DEVICE_ID_KEY)||((crypto.randomUUID&&crypto.randomUUID())||('dev-'+Date.now()+'-'+Math.random().toString(36).slice(2)));
localStorage.setItem(DEVICE_ID_KEY,DEVICE_ID);
const DEVICE_LABEL=/iPhone|iPad|Android/i.test(navigator.userAgent)?'Mobile POS':'Computer POS';
let lockedTableId=null, lockHeartbeat=null, realtimeChannel=null, remoteLocks=[], pagehideAccessToken=null;
function lockOwnerText(lock){return lock?.device_label||'another device'}
async function refreshLocks(){
  if(!client)return; const {data,error}=await client.from('pos_table_locks').select('*').gt('expires_at',new Date().toISOString());
  if(!error){remoteLocks=data||[];renderTables()}
}
async function acquireTableLock(tableId){
  if(!tableId)return true;
  if(lockedTableId===tableId){await heartbeatLock();return true}
  if(lockedTableId)await releaseTableLock();
  const {data,error}=await client.rpc('acquire_pos_table_lock',{p_table_id:tableId,p_device_id:DEVICE_ID,p_device_label:DEVICE_LABEL});
  if(error)throw error;
  if(!data?.ok){await refreshLocks();const l=remoteLocks.find(x=>x.table_id===tableId);alert(`🔒 ຕູບນີ້ກຳລັງໃຊ້ງານໂດຍ ${lockOwnerText(l)}
ທ່ານສາມາດເບິ່ງໄດ້ ແຕ່ບໍ່ສາມາດແກ້ໄຂພ້ອມກັນ`);return false}
  lockedTableId=tableId; startLockHeartbeat(); await refreshLocks(); return true;
}
async function heartbeatLock(){if(!lockedTableId||!client)return;await client.rpc('acquire_pos_table_lock',{p_table_id:lockedTableId,p_device_id:DEVICE_ID,p_device_label:DEVICE_LABEL})}
function startLockHeartbeat(){clearInterval(lockHeartbeat);lockHeartbeat=setInterval(()=>heartbeatLock().catch(console.warn),10000)}
async function releaseTableLock(){
  clearInterval(lockHeartbeat);lockHeartbeat=null;
  if(lockedTableId&&client){
    const id=lockedTableId;
    lockedTableId=null; // clear locally first so UI is not held by a slow network response
    try{await client.rpc('release_pos_table_lock',{p_table_id:id,p_device_id:DEVICE_ID})}catch(e){console.warn('release lock',e)}
  }
  await refreshLocks();
}
function releaseTableLockKeepalive(){
  if(!lockedTableId||!pagehideAccessToken||!cfg?.SUPABASE_URL)return;
  const id=lockedTableId; lockedTableId=null;
  try{
    fetch(`${cfg.SUPABASE_URL}/rest/v1/rpc/release_pos_table_lock`,{
      method:'POST',keepalive:true,
      headers:{'Content-Type':'application/json','apikey':cfg.SUPABASE_ANON_KEY,'Authorization':`Bearer ${pagehideAccessToken}`},
      body:JSON.stringify({p_table_id:id,p_device_id:DEVICE_ID})
    }).catch(()=>{});
  }catch(_){}
}
function setupRealtime(){
  if(!client||realtimeChannel)return;
  realtimeChannel=client.channel('tpg-pos-v855')
    .on('postgres_changes',{event:'*',schema:'public',table:'orders'},()=>loadOpenOrders().catch(console.warn))
    .on('postgres_changes',{event:'*',schema:'public',table:'order_items'},payload=>{if(currentOrder?.id&&(payload.new?.order_id===currentOrder.id||payload.old?.order_id===currentOrder.id))openExistingOrder(currentOrder,true).catch(console.warn)})
    .on('postgres_changes',{event:'*',schema:'public',table:'pos_table_locks'},()=>refreshLocks().catch(console.warn))
    .subscribe();
}
window.addEventListener('pagehide',releaseTableLockKeepalive);
window.addEventListener('beforeunload',releaseTableLockKeepalive);
function readMenuCache(){try{const raw=localStorage.getItem(MENU_CACHE_KEY)||localStorage.getItem(LEGACY_MENU_CACHE_KEY)||'null';const c=JSON.parse(raw);return c&&Date.now()-c.savedAt<CACHE_MAX_AGE?c:null}catch(_){return null}}
function writeMenuCache(){try{localStorage.setItem(MENU_CACHE_KEY,JSON.stringify({savedAt:Date.now(),categories,menus}))}catch(_){}}
const money=n=>`${Math.round(Number(n||0)).toLocaleString()} ກີບ`;
const configured=()=>cfg?.SUPABASE_URL?.startsWith('https://')&&!String(cfg?.SUPABASE_ANON_KEY||'').includes('PASTE_');
function placeholder(label='Menu'){return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="360"><rect width="100%" height="100%" fill="#173e2a"/><text x="50%" y="49%" text-anchor="middle" fill="white" font-family="Arial" font-size="26">${String(label).replace(/[<>&"]/g,'')}</text></svg>`)}
function showError(err){console.error(err);alert(window.TPG_STABILITY?.friendly(err)||err?.message||String(err||'ເກີດຂໍ້ຜິດພາດ'))}
function lockButton(btn,locked,label='ກຳລັງດຳເນີນການ...'){if(!btn)return; if(locked){btn.dataset.oldText=btn.textContent;btn.disabled=true;btn.textContent=label}else{btn.disabled=false;btn.textContent=btn.dataset.oldText||btn.textContent}}

if(configured()) client=window.TPG_STABILITY.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
else $('#loginStatus').textContent='ກະລຸນາກວດສອບ config.js';

async function initSession(){if(!client)return;try{const session=await window.TPG_STABILITY.ensureSession();if(session)await enter(session.user)}catch(e){console.warn(e)}}
$('#loginBtn').onclick=async()=>{if(!client)return;$('#loginStatus').textContent='ກຳລັງເຂົ້າລະບົບ...';const {data,error}=await client.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});if(error)$('#loginStatus').textContent=error.message;else await enter(data.user)};
$('#logoutBtn').onclick=async()=>{await client.auth.signOut();location.reload()};
async function enter(u){
  try{
    user=u;
    try{const {data:{session}}=await client.auth.getSession();pagehideAccessToken=session?.access_token||null}catch(_){}
    const cached=readMenuCache();
    if(cached){
      categories=cached.categories||[];menus=cached.menus||[];
      renderCategoryFilter();renderMenus();
    }
    $('#loginPanel').hidden=true;$('#posApp').hidden=false;$('#logoutBtn').hidden=false;$('#posUser').textContent=u.email||'Staff';
    // Critical POS data first; history is loaded only when the user opens History.
    await Promise.all([loadRestaurantSettings(),loadTables(),loadOpenOrders(),refreshLocks()]);
    renderAll(); setupRealtime();
    // Refresh menu/catalog in background so cached menus appear instantly.
    Promise.all([loadCategories(),loadMenus()]).catch(e=>console.warn('Menu background refresh',e));
  }catch(e){showError(e)}
}

document.querySelectorAll('[data-view]').forEach(btn=>btn.onclick=async()=>{
  // V8.5.5.1: leaving the sale/table editing view means this device is finished editing that table.
  // Release immediately so another POS can open it without waiting for the safety timeout.
  if(btn.dataset.view!=='sale'&&lockedTableId)await releaseTableLock();
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b===btn));
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${btn.dataset.view}`));
  if(btn.dataset.view==='tables'){await loadOpenOrders();await loadTables();await refreshLocks()}
  if(btn.dataset.view==='history')await loadHistory()
});

async function loadRestaurantSettings(){
  try{
    const {data,error}=await client.from('restaurant_settings').select('vat_mode,vat_rate').eq('id',1).maybeSingle();
    if(error)throw error;
    if(data)restaurantSettings={vat_mode:data.vat_mode||'inclusive',vat_rate:Number(data.vat_rate??10)};
  }catch(e){console.warn('V8.2 settings unavailable, using defaults',e)}
  $('#vatRate').value=restaurantSettings.vat_rate;
  $('#vatModeLabel').textContent=restaurantSettings.vat_mode==='inclusive'?'VAT ລວມໃນລາຄາແລ້ວ':'VAT ບວກເພີ່ມທ້າຍບິນ';
}

function renderCategoryFilter(){const f=$('#categoryFilter');if(!f)return;const old=f.value;f.innerHTML='<option value="all">ທຸກໝວດ</option>'+categories.map(c=>`<option value="${c.id}">${c.name_lo||c.name_th||c.name_en||'Category'}</option>`).join('');if([...f.options].some(o=>o.value===old))f.value=old}
async function loadCategories(){const {data,error}=await client.from('categories').select('*').eq('active',true).order('sort_order');if(error)throw error;categories=data||[];writeMenuCache();renderCategoryFilter()}
async function loadMenus(){const {data,error}=await client.from('menu_items').select('id,category_id,name_lo,name_th,name_en,price,image_url,sort_order,categories(name_lo)').eq('available',true).order('sort_order');if(error)throw error;menus=data||[];writeMenuCache();renderMenus()}
async function loadTables(){
  const {data,error}=await client.from('restaurant_tables').select('*').order('table_number');
  if(error){throw new Error('ກະລຸນາ Run V7-POS-MIGRATION.sql ກ່ອນ: '+error.message)}
  allTables=data||[];tables=allTables.filter(t=>t.active);renderTableSelect();renderTables();updateTableManager();
}
function renderTableSelect(){const old=$('#tableSelect').value;$('#tableSelect').innerHTML='<option value="">Takeaway</option>'+tables.map(t=>`<option value="${t.id}" data-number="${t.table_number}">ຕູບ ${t.table_number}</option>`).join('');if([...$('#tableSelect').options].some(o=>o.value===old))$('#tableSelect').value=old}
async function loadOpenOrders(){const {data,error}=await client.from('orders').select('*').in('status',['open','ready_to_pay']).order('opened_at',{ascending:false});if(error)throw error;orders=data||[];renderTables();updateTableManager()}
async function loadHistory(){const {data,error}=await client.from('orders').select('*').eq('status','paid').order('closed_at',{ascending:false}).limit(100);if(error)throw error;history=data||[];renderHistory()}

function filteredMenus(){const q=$('#menuSearch').value.trim().toLowerCase(),cat=$('#categoryFilter').value;return menus.filter(m=>(cat==='all'||m.category_id===cat)&&`${m.name_lo||''} ${m.name_th||''} ${m.name_en||''}`.toLowerCase().includes(q))}
function ensureMenuImageObserver(){
  if(menuImageObserver||!('IntersectionObserver' in window))return;
  menuImageObserver=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(!entry.isIntersecting)return;const img=entry.target;const src=img.dataset.src;if(src){img.src=src;delete img.dataset.src}menuImageObserver.unobserve(img)})},{root:$('#menuGrid'),rootMargin:'450px 0px'});
}
function renderMenus(){
  const grid=$('#menuGrid');if(!grid)return;
  if(menuRenderFrame)cancelAnimationFrame(menuRenderFrame);
  menuRenderFrame=requestAnimationFrame(()=>{
    if(menuImageObserver)menuImageObserver.disconnect();
    ensureMenuImageObserver();
    const frag=document.createDocumentFragment();
    filteredMenus().forEach((m,i)=>{
      const el=document.createElement('article');el.className='menu-card';
      const src=m.image_url||placeholder(m.name_lo);
      const eager=i<12;
      el.innerHTML=`<img alt="" loading="${eager?'eager':'lazy'}" decoding="async" fetchpriority="${eager?'high':'low'}"><div><h3>${m.name_lo||m.name_th||m.name_en}</h3><strong>${money(m.price)}</strong></div>`;
      const img=el.querySelector('img');
      img.onerror=()=>{img.onerror=null;img.src=placeholder(m.name_lo)};
      if(eager||!menuImageObserver)img.src=src;else{img.dataset.src=src;img.src=placeholder('…');menuImageObserver.observe(img)}
      el.onclick=()=>addToCart(m);frag.appendChild(el);
    });
    grid.replaceChildren(frag);
  });
}
let menuSearchTimer=0;$('#menuSearch').oninput=()=>{clearTimeout(menuSearchTimer);menuSearchTimer=setTimeout(renderMenus,60)};$('#categoryFilter').onchange=renderMenus;
function pulseCartButton(){if(!cartToggleBtn)return;cartToggleBtn.classList.remove('cart-pulse');void cartToggleBtn.offsetWidth;cartToggleBtn.classList.add('cart-pulse');setTimeout(()=>cartToggleBtn.classList.remove('cart-pulse'),380)}
function addToCart(m){const found=cart.find(x=>x.menu_item_id===m.id&&!x.variant);if(found)found.quantity++;else cart.push({menu_item_id:m.id,item_name:m.name_lo||m.name_th||m.name_en,unit_price:Number(m.price),quantity:1,variant:null,note:''});renderCart();if(window.innerWidth<=760)pulseCartButton()}
function changeQty(i,d){if(!cart[i])return;cart[i].quantity+=d;if(cart[i].quantity<=0)cart.splice(i,1);renderCart()}
function totals(){
  const itemTotal=cart.reduce((sum,x)=>sum+x.unit_price*x.quantity,0);
  const discount=Math.max(0,Number($('#discount').value||0));
  const vatRate=Math.max(0,Number(restaurantSettings.vat_rate||0));
  const afterDiscount=Math.max(0,itemTotal-discount);
  if(restaurantSettings.vat_mode==='inclusive'&&vatRate>0){
    const subtotal=afterDiscount/(1+vatRate/100);
    const vat=afterDiscount-subtotal;
    return{itemTotal,subtotal,discount,vatRate,vat,grand:afterDiscount,vatMode:'inclusive'};
  }
  const subtotal=afterDiscount;
  const vat=subtotal*vatRate/100;
  return{itemTotal,subtotal,discount,vatRate,vat,grand:subtotal+vat,vatMode:'exclusive'};
}
function updatePaymentActions(){
  const pending=currentOrder?.status==='ready_to_pay';
  const f=$('#finalizePaymentBtn'); if(f)f.hidden=!pending;
  const c=$('#checkoutBtn'); if(c)c.textContent=pending?'🧾 ບິນກວດສອບໃໝ່':'🧾 ບິນກວດສອບ';
  const m=$('#mobilePayBtn');
  if(m){
    m.hidden=!cart.length;
    m.textContent=pending?'💰 ຮັບເງິນ / ປິດບິນ':'💰 ຄິດເງິນຈາກມືຖື';
  }
  const cb=$('#mobileCheckBillBtn');
  if(cb)cb.hidden=!cart.length;
}
function renderCart(){$('#cartItems').innerHTML=cart.length?'':'<p class="empty">ແຕະເມນູເພື່ອເພີ່ມລົງບິນ</p>';cart.forEach((x,i)=>{const row=document.createElement('div');row.className='cart-row';row.innerHTML=`<div class="cart-item-main"><h4>${x.item_name}</h4><small>${money(x.unit_price)} × ${x.quantity} = ${money(x.unit_price*x.quantity)}</small><label class="item-note">ໝາຍເຫດ<input type="text" value="${String(x.note||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}" placeholder="ເຊັ່ນ: ບໍ່ເຜັດ"></label><button class="remove" type="button">ລຶບລາຍການ</button></div><div class="qty"><button aria-label="ຫຼຸດ" type="button">−</button><b>${x.quantity}</b><button aria-label="ເພີ່ມ" type="button">+</button></div>`;const bs=row.querySelectorAll('.qty button');bs[0].onclick=()=>changeQty(i,-1);bs[1].onclick=()=>changeQty(i,1);row.querySelector('.remove').onclick=()=>{cart.splice(i,1);renderCart()};row.querySelector('.item-note input').oninput=e=>{cart[i].note=e.target.value};$('#cartItems').appendChild(row)});const t=totals(),count=cart.reduce((n,x)=>n+x.quantity,0);$('#cartCountBadge').textContent=count;const mobileTotal=$('#cartToggleTotal');if(mobileTotal)mobileTotal.textContent=money(t.grand);$('#subtotal').textContent=money(t.subtotal);$('#vatAmount').textContent=money(t.vat);$('#grandTotal').textContent=money(t.grand);updatePaymentActions()}
$('#discount').oninput=renderCart;$('#vatRate').oninput=renderCart;$('#clearCartBtn').onclick=()=>{if(!cart.length||confirm('ລ້າງລາຍການທັງໝົດ?')){cart=[];renderCart()}};

function generateOrderNo(){const d=new Date(),date=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`,time=`${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}`;return `TPG-${date}-${time}-${Math.floor(Math.random()*90+10)}`}
async function createOrUpdateOrder(status='open'){
  if(!cart.length)throw new Error('ຍັງບໍ່ມີລາຍການອາຫານ');
  const t=totals(),opt=$('#tableSelect').selectedOptions[0],tableId=$('#tableSelect').value||null,tableNumber=tableId?Number(opt.dataset.number):null;
  if(tableId && !(await acquireTableLock(tableId))) throw new Error('ຕູບນີ້ຖືກລັອກໂດຍອຸປະກອນອື່ນ');
  const payload={table_id:tableId,table_number:tableNumber,status,note:$('#orderNote').value.trim()||null,subtotal:t.subtotal,discount:t.discount,vat_rate:t.vatRate,vat_amount:t.vat,vat_mode:t.vatMode,grand_total:t.grand};
  if(currentOrder?.id){const {error}=await client.from('orders').update(payload).eq('id',currentOrder.id);if(error)throw error;const {error:delError}=await client.from('order_items').delete().eq('order_id',currentOrder.id);if(delError)throw delError}
  else{payload.order_number=generateOrderNo();payload.opened_by=user.id;const {data,error}=await client.from('orders').insert(payload).select().single();if(error)throw error;currentOrder=data}
  const items=cart.map(x=>({...x,order_id:currentOrder.id}));const {error:itemError}=await client.from('order_items').insert(items);if(itemError)throw itemError;
  currentOrder={...currentOrder,...payload};updateOrderBadge();await loadOpenOrders();return currentOrder;
}
$('#saveOrderBtn').onclick=async()=>{const b=$('#saveOrderBtn');if(b.disabled)return;lockButton(b,true);try{await window.TPG_STABILITY.run(()=>createOrUpdateOrder('open'));alert('ບັນທຶກອໍເດີແລ້ວ')}catch(e){showError(e)}finally{lockButton(b,false)}};
$('#newOrderBtn').onclick=()=>resetOrder(true);
function resetOrder(confirmFirst=false){if(confirmFirst&&cart.length&&!confirm('ເປີດບິນໃໝ່ ແລະ ລ້າງລາຍການປັດຈຸບັນ?'))return;releaseTableLock().catch(console.warn);lastPaymentDetails=null;cart=[];currentOrder=null;$('#orderNote').value='';$('#discount').value=0;$('#vatRate').value=restaurantSettings.vat_rate;updateOrderBadge();renderCart()}
function updateOrderBadge(){const pending=currentOrder?.status==='ready_to_pay';const label=currentOrder?.id?`${currentOrder.order_number} • ${currentOrder.table_number?'ຕູບ '+currentOrder.table_number:'Takeaway'}${pending?' • Pending Payment':''}`:'ບິນໃໝ່ (ຍັງບໍ່ບັນທຶກ)';$('#orderBadge').textContent=label;$('#orderBadge').classList.toggle('order-pending-badge',pending);$('#cartOrderNo').textContent=currentOrder?.order_number||'ບິນໃໝ່';updatePaymentActions()}

async function openExistingOrder(order,silent=false){try{
  if(order.table_id){
    const mine=lockedTableId===order.table_id;
    if(!mine && silent)return;
    if(!mine && !(await acquireTableLock(order.table_id)))return;
  }
  const {data,error}=await client.from('order_items').select('*').eq('order_id',order.id).order('created_at');if(error)throw error;
  const {data:fresh}=await client.from('orders').select('*').eq('id',order.id).single(); if(fresh)order=fresh;
  if(order.status==='paid'||order.status==='cancelled'){if(!silent)alert('ບິນນີ້ປິດແລ້ວ');await releaseTableLock();return}
  currentOrder=order;cart=(data||[]).map(x=>({menu_item_id:x.menu_item_id,item_name:x.item_name,unit_price:Number(x.unit_price),quantity:x.quantity,variant:x.variant,note:x.note||''}));$('#tableSelect').value=order.table_id||'';$('#orderNote').value=order.note||'';$('#discount').value=Number(order.discount||0);$('#vatRate').value=Number(order.vat_rate||0);updateOrderBadge();renderCart();if(!silent)document.querySelector('[data-view="sale"]').click()
}catch(e){if(!silent)showError(e);else console.warn(e)}}
function renderTables(){if(!$('#tableGrid'))return;$('#tableGrid').innerHTML='';tables.forEach(t=>{const o=orders.find(x=>x.table_id===t.id),l=remoteLocks.find(x=>x.table_id===t.id&&x.device_id!==DEVICE_ID),el=document.createElement('article');el.className=`table-card ${o?(o.status==='ready_to_pay'?'ready':'busy'):''} ${l?'device-locked':''}`;el.innerHTML=`<h3>ຕູບ ${t.table_number}</h3><span>${o?(o.status==='ready_to_pay'?'ລໍຖ້າຄິດເງິນ':'ກຳລັງໃຊ້'):`ວ່າງ • ${t.capacity} ຄົນ`}</span>${l?`<small class="lock-label">🔒 ${lockOwnerText(l)}</small>`:''}${o?`<p>${money(o.grand_total)}</p>`:''}`;el.onclick=async()=>{if(o)await openExistingOrder(o);else{resetOrder(false);if(await acquireTableLock(t.id)){$('#tableSelect').value=t.id;document.querySelector('[data-view="sale"]').click()}}};$('#tableGrid').appendChild(el)})}

$('#tableSelect').addEventListener('change',async e=>{const id=e.target.value||null;if(!id){await releaseTableLock();return}if(!(await acquireTableLock(id))){e.target.value=currentOrder?.table_id||''}});

$('#refreshTables').onclick=async()=>{try{await loadOpenOrders();await loadTables()}catch(e){showError(e)}};

function updateTableManager(){const busy=orders.filter(o=>o.status==='open'&&o.table_id).length,ready=orders.filter(o=>o.status==='ready_to_pay'&&o.table_id).length;$('#activeTableCount').textContent=tables.length;const b=$('#busyTableCount'),r=$('#readyTableCount');if(b)b.textContent=busy;if(r)r.textContent=ready;$('#targetTableCount').value=tables.length||90}
async function addOneTable(){
  const inactive=allTables.filter(t=>!t.active).sort((a,b)=>a.table_number-b.table_number)[0];
  if(inactive){const {error}=await client.from('restaurant_tables').update({active:true}).eq('id',inactive.id);if(error)throw error}
  else{const max=allTables.reduce((m,t)=>Math.max(m,Number(t.table_number)),0);const {error}=await client.from('restaurant_tables').insert({table_number:max+1,label:`ຕູບ ${max+1}`,capacity:4,active:true});if(error)throw error}
}
async function removeOneTable(){
  const candidates=[...tables].sort((a,b)=>b.table_number-a.table_number);const free=candidates.find(t=>!orders.some(o=>o.table_id===t.id));
  if(!free)throw new Error('ບໍ່ສາມາດຫຼຸດຕູບໄດ້ ເພາະຕູບທີ່ມີຢູ່ກຳລັງໃຊ້ງານ');
  const {error}=await client.from('restaurant_tables').update({active:false}).eq('id',free.id);if(error)throw error;
}
$('#addTableBtn').onclick=async()=>{try{await addOneTable();await loadTables()}catch(e){showError(e)}};
$('#removeTableBtn').onclick=async()=>{try{if(tables.length<=1)throw new Error('ຕ້ອງເຫຼືອຢ່າງໜ້ອຍ 1 ຕູບ');if(confirm('ຫຼຸດຕູບວ່າງຈຳນວນ 1 ຕູບ?')){await removeOneTable();await loadTables()}}catch(e){showError(e)}};
$('#setTableCountBtn').onclick=async()=>{try{const target=Math.floor(Number($('#targetTableCount').value));if(!Number.isFinite(target)||target<1||target>500)throw new Error('ຈຳນວນຕູບຕ້ອງຢູ່ລະຫວ່າງ 1–500');if(!confirm(`ຕັ້ງຈຳນວນຕູບເປັນ ${target} ຕູບ?`))return;while(tables.length<target){await addOneTable();await loadTables()}while(tables.length>target){await removeOneTable();await loadTables()}alert(`ຕອນນີ້ມີ ${tables.length} ຕູບ`)}catch(e){showError(e)}};

function openCheckout(){if(window.innerWidth<=1180)setCartOpen(false);const modal=$('#checkoutModal');modal.hidden=false;modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
function closeCheckout(){const modal=$('#checkoutModal');modal.hidden=true;modal.setAttribute('aria-hidden','true');document.body.style.overflow=''}
$('#checkoutCloseBtn').onclick=closeCheckout;
$('#checkoutModal').addEventListener('click',e=>{if(e.target===$('#checkoutModal'))closeCheckout()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCheckout()});
$('#checkoutBtn').onclick=async()=>{const b=$('#checkoutBtn');if(b.disabled)return;lockButton(b,true,'ກຳລັງອອກບິນ...');try{if(!cart.length)throw new Error('ກະລຸນາເລືອກອາຫານກ່ອນ');const order=await createOrUpdateOrder('ready_to_pay');showReceipt(order,totals(),'pending')}catch(e){showError(e)}finally{lockButton(b,false)}};
$('#finalizePaymentBtn').onclick=async()=>{try{if(!cart.length||!currentOrder?.id)throw new Error('ບໍ່ພົບບິນລໍຖ້າຊຳລະ');await createOrUpdateOrder('ready_to_pay');const t=totals();$('#payTotal').textContent=money(t.grand);$('#receivedAmount').value=Math.round(t.grand);calcChange();openCheckout()}catch(e){showError(e)}};
function calcChange(){const t=totals(),received=Number($('#receivedAmount').value||0);$('#changeAmount').textContent=money(Math.max(0,received-t.grand))}
$('#receivedAmount').oninput=calcChange;$('#paymentMethod').onchange=()=>{if($('#paymentMethod').value!=='cash')$('#receivedAmount').value=Math.round(totals().grand);calcChange()};
$('#confirmPaymentBtn').onclick=async()=>{const b=$('#confirmPaymentBtn');if(b.disabled)return;lockButton(b,true,'ກຳລັງຊຳລະ...');try{if(!currentOrder?.id)throw new Error('ບໍ່ພົບບິນ ກະລຸນາກົດຄິດເງິນໃໝ່');if(currentOrder.table_id && lockedTableId!==currentOrder.table_id)throw new Error('ບິນນີ້ບໍ່ໄດ້ຖືກລັອກໂດຍອຸປະກອນນີ້');const {data:payCheck}=await client.from('orders').select('status').eq('id',currentOrder.id).single();if(payCheck?.status==='paid')throw new Error('ບິນນີ້ຊຳລະແລ້ວ');const t=totals(),method=$('#paymentMethod').value,received=Number($('#receivedAmount').value||0);if(method==='cash'&&received<t.grand)throw new Error('ເງິນຮັບບໍ່ພໍ');const payment={order_id:currentOrder.id,method,amount:t.grand,received_amount:received,change_amount:Math.max(0,received-t.grand),paid_by:user.id};lastPaymentDetails={...payment};const {error:pErr}=await client.from('payments').insert(payment);if(pErr)throw pErr;const closed=new Date().toISOString();const {data,error}=await client.from('orders').update({status:'paid',closed_by:user.id,closed_at:closed}).eq('id',currentOrder.id).select().single();if(error)throw error;lastPaidOrder=data;closeCheckout();showReceipt(data,t,'paid');loadPrinterSettings();if(printerSettings.autoPrintAfterPay){directPrintReceipt().catch(e=>showError(e))}await Promise.all([loadOpenOrders(),loadHistory()]);resetOrder(false)}catch(e){showError(e)}finally{lockButton(b,false)}};

function paymentMethodLabel(method){
  return ({cash:'ເງິນສົດ',bank_transfer:'ໂອນທະນາຄານ',qr:'QR',other:'ອື່ນໆ'})[method]||method||'-';
}
function showReceipt(order,t,mode='paid'){
  if(window.innerWidth<=1180)setCartOpen(false);
  const pending=mode==='pending';
  $('#rReceiptTitle').textContent=pending?'CHECK BILL / ບິນກວດສອບກ່ອນຄິດເງິນ':'RECEIPT / ໃບບິນຮັບເງິນ';
  $('#rPendingNotice').hidden=!pending;
  $('#rOrderNo').textContent=order.order_number;
  $('#rDate').textContent=new Date(order.closed_at||Date.now()).toLocaleString();
  $('#rTable').textContent=order.table_number||'Takeaway';
  $('#rItems').innerHTML=cart.map(x=>`<tr><td>${x.item_name}</td><td>${x.quantity}</td><td>${money(x.unit_price*x.quantity)}</td></tr>`).join('');
  $('#rSubtotal').textContent=money(t.subtotal);
  $('#rDiscount').textContent=money(t.discount);
  $('#rVat').textContent=money(t.vat);
  $('#rTotal').textContent=money(t.grand);

  const paid=!pending && lastPaymentDetails;
  const methodRow=$('#rPaymentRow'),receivedRow=$('#rReceivedRow'),changeRow=$('#rChangeRow');
  if(methodRow)methodRow.hidden=!paid;
  if(receivedRow)receivedRow.hidden=!paid;
  if(changeRow)changeRow.hidden=!paid;
  if(paid){
    $('#rPaymentMethod').textContent=paymentMethodLabel(lastPaymentDetails.method);
    $('#rReceived').textContent=money(lastPaymentDetails.received_amount);
    $('#rChange').textContent=money(lastPaymentDetails.change_amount);
  }

  const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||window.innerWidth<=760;
  const direct=$('#directPrintBtn');
  if(direct)direct.hidden=mobile;
  const print=$('#printBtn');
  if(print){
    if(pending)print.textContent=mobile?'🖨️ ພິມ / Share ບິນກວດສອບ':'🖨️ Browser Print - Check Bill';
    else print.textContent=mobile?'🖨️ ພິມ / Share Receipt':'🖨️ Browser Print - Receipt';
  }
  $('#receipt').dataset.mode=mode;
  $('#receipt').hidden=false;
  document.body.style.overflow='hidden';
}
$('#printBtn').onclick=()=>window.print();
$('#directPrintBtn').onclick=async()=>{try{await directPrintReceipt()}catch(e){showError(e)}};
$('#closeReceiptBtn').onclick=()=>{$('#receipt').hidden=true;document.body.style.overflow=''};

// V8.1 — SL-253 / ESC-POS direct printing through QZ Tray.
const PRINTER_KEY='tpg_printer_v81';
let lastPaymentDetails=null;
let printerSettings={printerName:'',autoCut:true,openDrawer:false,autoPrintAfterPay:false};
function loadPrinterSettings(){try{printerSettings={...printerSettings,...JSON.parse(localStorage.getItem(PRINTER_KEY)||'{}')}}catch(_){};if($('#printerName'))$('#printerName').value=printerSettings.printerName||'';if($('#autoCut'))$('#autoCut').checked=!!printerSettings.autoCut;if($('#openDrawer'))$('#openDrawer').checked=!!printerSettings.openDrawer;if($('#autoPrintAfterPay'))$('#autoPrintAfterPay').checked=!!printerSettings.autoPrintAfterPay}
function savePrinterSettings(){printerSettings={printerName:$('#printerName').value,autoCut:$('#autoCut').checked,openDrawer:$('#openDrawer').checked,autoPrintAfterPay:$('#autoPrintAfterPay').checked};localStorage.setItem(PRINTER_KEY,JSON.stringify(printerSettings));$('#printerStatus').textContent='ບັນທຶກແລ້ວ: '+(printerSettings.printerName||'ຍັງບໍ່ເລືອກປຣິນເຕີ')}
function qzReady(){return !!(window.qz&&qz.websocket&&qz.websocket.isActive())}
async function connectQz(){if(!window.qz)throw new Error('ໂຫຼດ QZ Tray library ບໍ່ສຳເລັດ. ກວດ internet ແລ້ວ refresh');if(!qzReady())await qz.websocket.connect();$('#printerStatus').textContent='QZ Tray: ເຊື່ອມຕໍ່ແລ້ວ'}
async function findPrinters(){await connectQz();const names=await qz.printers.find();const list=Array.isArray(names)?names:[names];$('#printerName').innerHTML='<option value="">-- ເລືອກປຣິນເຕີ --</option>'+list.map(n=>`<option value="${String(n).replace(/"/g,'&quot;')}">${n}</option>`).join('');const preferred=list.find(n=>/SL[- ]?253|receipt|thermal|80/i.test(n))||printerSettings.printerName;if(preferred&&list.includes(preferred))$('#printerName').value=preferred;$('#printerStatus').textContent=`ພົບ ${list.length} ປຣິນເຕີ`}
function openPrinterModal(){loadPrinterSettings();$('#printerModal').hidden=false;$('#printerModal').setAttribute('aria-hidden','false')}
function closePrinterModal(){$('#printerModal').hidden=true;$('#printerModal').setAttribute('aria-hidden','true')}
$('#printerSettingsBtn').onclick=openPrinterModal;$('#printerCloseBtn').onclick=closePrinterModal;$('#printerModal').addEventListener('click',e=>{if(e.target===$('#printerModal'))closePrinterModal()});$('#connectQzBtn').onclick=async()=>{try{await connectQz()}catch(e){showError(e)}};$('#findPrintersBtn').onclick=async()=>{try{await findPrinters()}catch(e){showError(e)}};$('#savePrinterBtn').onclick=()=>{savePrinterSettings();setTimeout(closePrinterModal,400)};
function receiptHtml(){const paper=$('.receipt-paper').cloneNode(true);paper.querySelectorAll('img').forEach(img=>{if(img.src&&!img.src.startsWith('data:'))img.src=new URL(img.getAttribute('src'),location.href).href});return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:80mm auto;margin:0}body{margin:0;width:80mm;font-family:Arial,'Noto Sans Lao',sans-serif}.receipt-paper{width:80mm;padding:6mm 4mm;box-sizing:border-box}.receipt-logo{display:block;width:42px;height:42px;object-fit:contain;margin:auto}h1,h2,p{text-align:center;margin:5px 0}h1{font-size:16px}h2{font-size:13px;border-top:1px dashed;border-bottom:1px dashed;padding:6px}.receipt-meta{font-size:11px;display:grid;gap:3px;margin:8px 0}table{width:100%;border-collapse:collapse;font-size:11px}th,td{padding:4px 2px;border-bottom:1px dashed #aaa;text-align:left}th:nth-child(2),td:nth-child(2){text-align:center}th:last-child,td:last-child{text-align:right}.receipt-totals p{display:flex;justify-content:space-between;font-size:11px;margin:5px 0}.receipt-totals .grand{font-size:15px;border-top:1px dashed;padding-top:6px}.thanks{font-size:11px;margin-top:18px!important}</style></head><body>${paper.outerHTML}</body></html>`}
async function directPrintReceipt(){loadPrinterSettings();if(!printerSettings.printerName){openPrinterModal();throw new Error('ກະລຸນາເລືອກປຣິນເຕີກ່ອນ')};await connectQz();const config=qz.configs.create(printerSettings.printerName,{copies:1,rasterize:true,margins:0,colorType:'grayscale'});await qz.print(config,[{type:'pixel',format:'html',flavor:'plain',data:receiptHtml()}]);const commands=[];if(printerSettings.openDrawer)commands.push('\x1B\x70\x00\x19\xFA');if(printerSettings.autoCut)commands.push('\x1D\x56\x00');if(commands.length)await qz.print(qz.configs.create(printerSettings.printerName),[{type:'raw',format:'command',flavor:'plain',data:commands.join('')}]);$('#printerStatus').textContent='ພິມສຳເລັດ'}
loadPrinterSettings();

function renderHistory(){$('#historyList').innerHTML=history.length?'':'<p class="empty">ຍັງບໍ່ມີປະຫວັດ</p>';history.forEach(o=>{const row=document.createElement('article');row.className='history-row';row.innerHTML=`<div><strong>${o.order_number}</strong><br><small>${new Date(o.closed_at||o.created_at).toLocaleString()} • ${o.table_number?'ຕູບ '+o.table_number:'Takeaway'}</small></div><b>${money(o.grand_total)}</b><button>ເບິ່ງ</button>`;row.querySelector('button').onclick=async()=>{try{const {data,error}=await client.from('order_items').select('*').eq('order_id',o.id);if(error)throw error;cart=(data||[]).map(x=>({item_name:x.item_name,unit_price:Number(x.unit_price),quantity:x.quantity}));showReceipt(o,{subtotal:Number(o.subtotal),discount:Number(o.discount),vat:Number(o.vat_amount),grand:Number(o.grand_total)},'paid');cart=[]}catch(e){showError(e)}};$('#historyList').appendChild(row)})}
$('#refreshHistory').onclick=async()=>{try{await loadHistory()}catch(e){showError(e)}};
function renderAll(){renderMenus();renderCart();renderTables();renderHistory();updateOrderBadge();updateTableManager()}
initSession();


// V8.2 responsive cart drawer
const cartPanel=$('#cartPanel'),cartToggleBtn=$('#cartToggleBtn'),cartCloseBtn=$('#cartCloseBtn');
function setCartOpen(open){document.body.classList.toggle('cart-open',open);cartToggleBtn.setAttribute('aria-expanded',String(open))}
cartToggleBtn.onclick=()=>setCartOpen(!document.body.classList.contains('cart-open'));
cartCloseBtn.onclick=()=>setCartOpen(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape')setCartOpen(false)});
window.addEventListener('resize',()=>{if(window.innerWidth>1180)setCartOpen(false)});

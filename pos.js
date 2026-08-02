'use strict';
const cfg=window.TPG_CONFIG;
const $=s=>document.querySelector(s);
let client=null,user=null,categories=[],menus=[],tables=[],allTables=[],orders=[],history=[],cart=[],currentOrder=null,lastPaidOrder=null;
const money=n=>`${Math.round(Number(n||0)).toLocaleString()} ກີບ`;
const configured=()=>cfg?.SUPABASE_URL?.startsWith('https://')&&!String(cfg?.SUPABASE_ANON_KEY||'').includes('PASTE_');
function placeholder(label='Menu'){return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="360"><rect width="100%" height="100%" fill="#173e2a"/><text x="50%" y="49%" text-anchor="middle" fill="white" font-family="Arial" font-size="26">${String(label).replace(/[<>&"]/g,'')}</text></svg>`)}
function showError(err){console.error(err);alert(err?.message||String(err||'ເກີດຂໍ້ຜິດພາດ'))}

if(configured()) client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
else $('#loginStatus').textContent='กรุณาตรวจ config.js';

async function initSession(){if(!client)return;const {data}=await client.auth.getSession();if(data.session)await enter(data.session.user)}
$('#loginBtn').onclick=async()=>{if(!client)return;$('#loginStatus').textContent='ກຳລັງເຂົ້າລະບົບ...';const {data,error}=await client.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});if(error)$('#loginStatus').textContent=error.message;else await enter(data.user)};
$('#logoutBtn').onclick=async()=>{await client.auth.signOut();location.reload()};
async function enter(u){
  try{user=u;$('#loginPanel').hidden=true;$('#posApp').hidden=false;$('#logoutBtn').hidden=false;$('#posUser').textContent=u.email||'Staff';
  await Promise.all([loadCategories(),loadMenus(),loadTables(),loadOpenOrders(),loadHistory()]);renderAll()}
  catch(e){showError(e)}
}

document.querySelectorAll('[data-view]').forEach(btn=>btn.onclick=async()=>{document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b===btn));document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${btn.dataset.view}`));if(btn.dataset.view==='tables'){await loadOpenOrders();await loadTables()}if(btn.dataset.view==='history')await loadHistory()});

async function loadCategories(){const {data,error}=await client.from('categories').select('*').eq('active',true).order('sort_order');if(error)throw error;categories=data||[];$('#categoryFilter').innerHTML='<option value="all">ທຸກໝວດ</option>'+categories.map(c=>`<option value="${c.id}">${c.name_lo||c.name_th||c.name_en||'Category'}</option>`).join('')}
async function loadMenus(){const {data,error}=await client.from('menu_items').select('*,categories(name_lo)').eq('available',true).order('sort_order');if(error)throw error;menus=data||[];renderMenus()}
async function loadTables(){
  const {data,error}=await client.from('restaurant_tables').select('*').order('table_number');
  if(error){throw new Error('กรุณารัน V7-POS-MIGRATION.sql ก่อน: '+error.message)}
  allTables=data||[];tables=allTables.filter(t=>t.active);renderTableSelect();renderTables();updateTableManager();
}
function renderTableSelect(){const old=$('#tableSelect').value;$('#tableSelect').innerHTML='<option value="">Takeaway</option>'+tables.map(t=>`<option value="${t.id}" data-number="${t.table_number}">ຕູບ ${t.table_number}</option>`).join('');if([...$('#tableSelect').options].some(o=>o.value===old))$('#tableSelect').value=old}
async function loadOpenOrders(){const {data,error}=await client.from('orders').select('*').in('status',['open','ready_to_pay']).order('opened_at',{ascending:false});if(error)throw error;orders=data||[];renderTables()}
async function loadHistory(){const {data,error}=await client.from('orders').select('*').eq('status','paid').order('closed_at',{ascending:false}).limit(100);if(error)throw error;history=data||[];renderHistory()}

function filteredMenus(){const q=$('#menuSearch').value.trim().toLowerCase(),cat=$('#categoryFilter').value;return menus.filter(m=>(cat==='all'||m.category_id===cat)&&`${m.name_lo||''} ${m.name_th||''} ${m.name_en||''}`.toLowerCase().includes(q))}
function renderMenus(){$('#menuGrid').innerHTML='';filteredMenus().forEach(m=>{const el=document.createElement('article');el.className='menu-card';el.innerHTML=`<img alt=""><div><h3>${m.name_lo||m.name_th||m.name_en}</h3><strong>${money(m.price)}</strong></div>`;const img=el.querySelector('img');img.onerror=()=>{img.onerror=null;img.src=placeholder(m.name_lo)};img.src=m.image_url||placeholder(m.name_lo);el.onclick=()=>addToCart(m);$('#menuGrid').appendChild(el)})}
$('#menuSearch').oninput=renderMenus;$('#categoryFilter').onchange=renderMenus;
function addToCart(m){const found=cart.find(x=>x.menu_item_id===m.id&&!x.variant);if(found)found.quantity++;else cart.push({menu_item_id:m.id,item_name:m.name_lo||m.name_th||m.name_en,unit_price:Number(m.price),quantity:1,variant:null,note:''});renderCart()}
function changeQty(i,d){if(!cart[i])return;cart[i].quantity+=d;if(cart[i].quantity<=0)cart.splice(i,1);renderCart()}
function totals(){const subtotal=cart.reduce((s,x)=>s+x.unit_price*x.quantity,0),discount=Math.max(0,Number($('#discount').value||0)),vatRate=Math.max(0,Number($('#vatRate').value||0)),base=Math.max(0,subtotal-discount),vat=base*vatRate/100;return{subtotal,discount,vatRate,vat,grand:base+vat}}
function renderCart(){$('#cartItems').innerHTML=cart.length?'':'<p class="empty">ແຕະເມນູທາງຊ້າຍ</p>';cart.forEach((x,i)=>{const row=document.createElement('div');row.className='cart-row';row.innerHTML=`<div><h4>${x.item_name}</h4><small>${money(x.unit_price)} × ${x.quantity} = ${money(x.unit_price*x.quantity)}</small><br><button class="remove">ລົບ</button></div><div class="qty"><button aria-label="ลด">−</button><b>${x.quantity}</b><button aria-label="เพิ่ม">+</button></div>`;const bs=row.querySelectorAll('.qty button');bs[0].onclick=()=>changeQty(i,-1);bs[1].onclick=()=>changeQty(i,1);row.querySelector('.remove').onclick=()=>{cart.splice(i,1);renderCart()};$('#cartItems').appendChild(row)});const t=totals();$('#subtotal').textContent=money(t.subtotal);$('#vatAmount').textContent=money(t.vat);$('#grandTotal').textContent=money(t.grand)}
$('#discount').oninput=renderCart;$('#vatRate').oninput=renderCart;$('#clearCartBtn').onclick=()=>{if(!cart.length||confirm('ລ້າງລາຍການທັງໝົດ?')){cart=[];renderCart()}};

function generateOrderNo(){const d=new Date(),date=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`,time=`${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}`;return `TPG-${date}-${time}-${Math.floor(Math.random()*90+10)}`}
async function createOrUpdateOrder(status='open'){
  if(!cart.length)throw new Error('ຍັງບໍ່ມີລາຍການອາຫານ');
  const t=totals(),opt=$('#tableSelect').selectedOptions[0],tableId=$('#tableSelect').value||null,tableNumber=tableId?Number(opt.dataset.number):null;
  const payload={table_id:tableId,table_number:tableNumber,status,note:$('#orderNote').value.trim()||null,subtotal:t.subtotal,discount:t.discount,vat_rate:t.vatRate,vat_amount:t.vat,grand_total:t.grand};
  if(currentOrder?.id){const {error}=await client.from('orders').update(payload).eq('id',currentOrder.id);if(error)throw error;const {error:delError}=await client.from('order_items').delete().eq('order_id',currentOrder.id);if(delError)throw delError}
  else{payload.order_number=generateOrderNo();payload.opened_by=user.id;const {data,error}=await client.from('orders').insert(payload).select().single();if(error)throw error;currentOrder=data}
  const items=cart.map(x=>({...x,order_id:currentOrder.id}));const {error:itemError}=await client.from('order_items').insert(items);if(itemError)throw itemError;
  currentOrder={...currentOrder,...payload};updateOrderBadge();await loadOpenOrders();return currentOrder;
}
$('#saveOrderBtn').onclick=async()=>{try{await createOrUpdateOrder('open');alert('ບັນທຶກອໍເດີແລ້ວ')}catch(e){showError(e)}};
$('#newOrderBtn').onclick=()=>resetOrder(true);
function resetOrder(confirmFirst=false){if(confirmFirst&&cart.length&&!confirm('ເປີດບິນໃໝ່ ແລະ ລ້າງລາຍການປັດຈຸບັນ?'))return;cart=[];currentOrder=null;$('#orderNote').value='';$('#discount').value=0;$('#vatRate').value=0;updateOrderBadge();renderCart()}
function updateOrderBadge(){const label=currentOrder?.id?`${currentOrder.order_number} • ${currentOrder.table_number?'ຕູບ '+currentOrder.table_number:'Takeaway'}`:'ບິນໃໝ່ (ຍັງບໍ່ບັນທຶກ)';$('#orderBadge').textContent=label;$('#cartOrderNo').textContent=currentOrder?.order_number||'ບິນໃໝ່'}

async function openExistingOrder(order){try{const {data,error}=await client.from('order_items').select('*').eq('order_id',order.id).order('created_at');if(error)throw error;currentOrder=order;cart=(data||[]).map(x=>({menu_item_id:x.menu_item_id,item_name:x.item_name,unit_price:Number(x.unit_price),quantity:x.quantity,variant:x.variant,note:x.note||''}));$('#tableSelect').value=order.table_id||'';$('#orderNote').value=order.note||'';$('#discount').value=Number(order.discount||0);$('#vatRate').value=Number(order.vat_rate||0);updateOrderBadge();renderCart();document.querySelector('[data-view="sale"]').click()}catch(e){showError(e)}}
function renderTables(){if(!$('#tableGrid'))return;$('#tableGrid').innerHTML='';tables.forEach(t=>{const o=orders.find(x=>x.table_id===t.id),el=document.createElement('article');el.className=`table-card ${o?(o.status==='ready_to_pay'?'ready':'busy'):''}`;el.innerHTML=`<h3>ຕູບ ${t.table_number}</h3><span>${o?(o.status==='ready_to_pay'?'ລໍຖ້າຄິດເງິນ':'ກຳລັງໃຊ້'):`ວ່າງ • ${t.capacity} ຄົນ`}</span>${o?`<p>${money(o.grand_total)}</p>`:''}`;el.onclick=()=>{if(o)openExistingOrder(o);else{resetOrder(false);$('#tableSelect').value=t.id;document.querySelector('[data-view="sale"]').click()}};$('#tableGrid').appendChild(el)})}
$('#refreshTables').onclick=async()=>{try{await loadOpenOrders();await loadTables()}catch(e){showError(e)}};

function updateTableManager(){$('#activeTableCount').textContent=tables.length;$('#targetTableCount').value=tables.length||90}
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

function openCheckout(){const modal=$('#checkoutModal');modal.hidden=false;modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
function closeCheckout(){const modal=$('#checkoutModal');modal.hidden=true;modal.setAttribute('aria-hidden','true');document.body.style.overflow=''}
$('#checkoutCloseBtn').onclick=closeCheckout;
$('#checkoutModal').addEventListener('click',e=>{if(e.target===$('#checkoutModal'))closeCheckout()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCheckout()});
$('#checkoutBtn').onclick=async()=>{try{if(!cart.length)throw new Error('ກະລຸນາເລືອກອາຫານກ່ອນ');await createOrUpdateOrder('ready_to_pay');const t=totals();$('#payTotal').textContent=money(t.grand);$('#receivedAmount').value=Math.round(t.grand);calcChange();openCheckout()}catch(e){showError(e)}};
function calcChange(){const t=totals(),received=Number($('#receivedAmount').value||0);$('#changeAmount').textContent=money(Math.max(0,received-t.grand))}
$('#receivedAmount').oninput=calcChange;$('#paymentMethod').onchange=()=>{if($('#paymentMethod').value!=='cash')$('#receivedAmount').value=Math.round(totals().grand);calcChange()};
$('#confirmPaymentBtn').onclick=async()=>{try{if(!currentOrder?.id)throw new Error('ບໍ່ພົບບິນ ກະລຸນາກົດຄິດເງິນໃໝ່');const t=totals(),method=$('#paymentMethod').value,received=Number($('#receivedAmount').value||0);if(method==='cash'&&received<t.grand)throw new Error('ເງິນຮັບບໍ່ພໍ');const payment={order_id:currentOrder.id,method,amount:t.grand,received_amount:received,change_amount:Math.max(0,received-t.grand),paid_by:user.id};const {error:pErr}=await client.from('payments').insert(payment);if(pErr)throw pErr;const closed=new Date().toISOString();const {data,error}=await client.from('orders').update({status:'paid',closed_by:user.id,closed_at:closed}).eq('id',currentOrder.id).select().single();if(error)throw error;lastPaidOrder=data;closeCheckout();showReceipt(data,t);loadPrinterSettings();if(printerSettings.autoPrintAfterPay){directPrintReceipt().catch(e=>showError(e))}await Promise.all([loadOpenOrders(),loadHistory()]);resetOrder(false)}catch(e){showError(e)}};

function showReceipt(order,t){$('#rOrderNo').textContent=order.order_number;$('#rDate').textContent=new Date(order.closed_at||Date.now()).toLocaleString();$('#rTable').textContent=order.table_number||'Takeaway';$('#rItems').innerHTML=cart.map(x=>`<tr><td>${x.item_name}</td><td>${x.quantity}</td><td>${money(x.unit_price*x.quantity)}</td></tr>`).join('');$('#rSubtotal').textContent=money(t.subtotal);$('#rDiscount').textContent=money(t.discount);$('#rVat').textContent=money(t.vat);$('#rTotal').textContent=money(t.grand);$('#receipt').hidden=false;document.body.style.overflow='hidden'}
$('#printBtn').onclick=()=>window.print();
$('#directPrintBtn').onclick=async()=>{try{await directPrintReceipt()}catch(e){showError(e)}};
$('#closeReceiptBtn').onclick=()=>{$('#receipt').hidden=true;document.body.style.overflow=''};

// V8.1 — SL-253 / ESC-POS direct printing through QZ Tray.
const PRINTER_KEY='tpg_printer_v81';
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

function renderHistory(){$('#historyList').innerHTML=history.length?'':'<p class="empty">ຍັງບໍ່ມີປະຫວັດ</p>';history.forEach(o=>{const row=document.createElement('article');row.className='history-row';row.innerHTML=`<div><strong>${o.order_number}</strong><br><small>${new Date(o.closed_at||o.created_at).toLocaleString()} • ${o.table_number?'ຕູບ '+o.table_number:'Takeaway'}</small></div><b>${money(o.grand_total)}</b><button>ເບິ່ງ</button>`;row.querySelector('button').onclick=async()=>{try{const {data,error}=await client.from('order_items').select('*').eq('order_id',o.id);if(error)throw error;cart=(data||[]).map(x=>({item_name:x.item_name,unit_price:Number(x.unit_price),quantity:x.quantity}));showReceipt(o,{subtotal:Number(o.subtotal),discount:Number(o.discount),vat:Number(o.vat_amount),grand:Number(o.grand_total)});cart=[]}catch(e){showError(e)}};$('#historyList').appendChild(row)})}
$('#refreshHistory').onclick=async()=>{try{await loadHistory()}catch(e){showError(e)}};
function renderAll(){renderMenus();renderCart();renderTables();renderHistory();updateOrderBadge();updateTableManager()}
initSession();

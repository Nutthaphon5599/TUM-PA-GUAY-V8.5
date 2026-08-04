"use strict";
const cfg=window.TPG_CONFIG,$=s=>document.querySelector(s),money=n=>`${Math.round(Number(n||0)).toLocaleString()} ກີບ`;
let client=null,user=null,orders=[],payments=[],items=[],categories=[],menus=[],selectedCategory="all";
const configured=()=>cfg?.SUPABASE_URL?.startsWith("https://")&&!String(cfg?.SUPABASE_ANON_KEY||"").includes("PASTE_");
if(configured())client=window.TPG_STABILITY.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);else $("#loginStatus").textContent="ກະລຸນາກວດສອບ config.js";
function isoDate(d){return d.toISOString().slice(0,10)}
function localStart(v){return new Date(v+"T00:00:00").toISOString()}
function localEnd(v){return new Date(v+"T23:59:59.999").toISOString()}
function normalize(v){return String(v||"").trim().toLocaleLowerCase().replace(/\s+/g," ")}
function setToday(){const d=new Date();$("#dateFrom").value=$("#dateTo").value=isoDate(d)}
function setMonth(){const d=new Date();$("#dateFrom").value=isoDate(new Date(d.getFullYear(),d.getMonth(),1));$("#dateTo").value=isoDate(d)}
setMonth();$("#todayBtn").onclick=()=>{setToday();loadReport()};$("#monthBtn").onclick=()=>{setMonth();loadReport()};
async function enter(u){user=u;$("#login").hidden=true;$("#app").hidden=false;$("#logout").hidden=false;$("#userEmail").textContent=u.email||"";await loadMenuMetadata();await loadReport()}
async function init(){if(!client)return;const session=await window.TPG_STABILITY.ensureSession();if(session)await enter(session.user)}
$("#loginBtn").onclick=async()=>{const {data,error}=await client.auth.signInWithPassword({email:$("#email").value.trim(),password:$("#password").value});if(error)$("#loginStatus").textContent=error.message;else enter(data.user)};
$("#logout").onclick=async()=>{await client.auth.signOut();location.reload()};
async function loadMenuMetadata(){
  const [c,m]=await Promise.all([
    client.from("categories").select("id,slug,name_lo,name_en,sort_order,active").eq("active",true).order("sort_order"),
    client.from("menu_items").select("id,category_id,name_lo,name_th,name_en")
  ]);
  if(c.error)throw c.error;if(m.error)throw m.error;
  categories=c.data||[];menus=m.data||[];renderCategoryTabs();
}
function renderCategoryTabs(){
  const tabs=[{id:"all",name_lo:"ທັງໝົດ"},...categories];
  $("#categoryTabs").innerHTML=tabs.map(c=>`<button type="button" data-category="${c.id}" class="${selectedCategory===c.id?"active":""}">${c.name_lo||c.name_en}</button>`).join("");
  $("#categoryTabs").querySelectorAll("button").forEach(b=>b.onclick=()=>{selectedCategory=b.dataset.category;renderTopMenu();renderCategoryTabs()});
}
function menuForItemName(itemName){
  const name=normalize(itemName);
  let exact=menus.find(m=>[m.name_lo,m.name_th,m.name_en].some(x=>normalize(x)===name));
  if(exact)return exact;
  const candidates=menus.flatMap(m=>[m.name_lo,m.name_th,m.name_en].filter(Boolean).map(n=>({m,n:normalize(n)}))).filter(x=>x.n&&name.startsWith(x.n)).sort((a,b)=>b.n.length-a.n.length);
  return candidates[0]?.m||null;
}
function itemFacts(){
  return items.map(x=>{const menu=menuForItemName(x.item_name);return {...x,category_id:menu?.category_id||"unknown",menu_name:menu?.name_lo||x.item_name||"Unknown"}});
}
async function loadReport(){
  try{
    const from=$("#dateFrom").value,to=$("#dateTo").value;if(!from||!to)throw new Error("ກະລຸນາເລືອກວັນທີ");
    let q=client.from("orders").select("*").eq("status","paid").gte("closed_at",localStart(from)).lte("closed_at",localEnd(to)).order("closed_at",{ascending:false}).limit(5000);
    const bill=$("#billSearch").value.trim(),table=$("#tableSearch").value;if(bill)q=q.ilike("order_number",`%${bill}%`);if(table)q=q.eq("table_number",Number(table));
    const {data,error}=await q;if(error)throw error;orders=data||[];const ids=orders.map(o=>o.id);payments=[];items=[];
    if(ids.length){for(let i=0;i<ids.length;i+=200){const batch=ids.slice(i,i+200);const [p,it]=await Promise.all([client.from("payments").select("*").in("order_id",batch),client.from("order_items").select("*").in("order_id",batch)]);if(p.error)throw p.error;if(it.error)throw it.error;payments.push(...(p.data||[]));items.push(...(it.data||[]))}}
    render();
  }catch(e){alert(e.message||e);console.error(e)}
}
$("#loadBtn").onclick=loadReport;$("#billSearch").onkeydown=e=>{if(e.key==="Enter")loadReport()};$("#tableSearch").onkeydown=e=>{if(e.key==="Enter")loadReport()};
function aggregateMenu(facts){
  const top={};facts.forEach(x=>{const k=x.menu_name||"Unknown";top[k]??={qty:0,total:0};top[k].qty+=Number(x.quantity||0);top[k].total+=Number(x.line_total||Number(x.unit_price||0)*Number(x.quantity||0))});return top;
}
function renderTopMenu(){
  const facts=itemFacts().filter(x=>selectedCategory==="all"||x.category_id===selectedCategory);
  const top=aggregateMenu(facts);
  const rows=Object.entries(top).sort((a,b)=>b[1].qty-a[1].qty||b[1].total-a[1].total).slice(0,50);
  const categoryTotal=Object.values(top).reduce((s,v)=>s+v.total,0);
  if(!rows.length){$("#topMenu").innerHTML='<p class="empty">ບໍ່ມີຂໍ້ມູນເມນູ</p>';return}
  $("#topMenu").innerHTML=`<div class="top-menu-table-wrap"><table class="top-menu-table"><thead><tr><th class="rank-col">ອັນດັບ</th><th>ເມນູ</th><th class="number-col">ຈຳນວນ</th><th class="number-col">%</th><th class="money-col">ຍອດຂາຍ</th></tr></thead><tbody>${rows.map(([name,v],i)=>{const pct=categoryTotal?v.total/categoryTotal*100:0;const rank=i===0?"🥇":i===1?"🥈":i===2?"🥉":String(i+1);return `<tr><td class="rank-col"><span class="table-rank">${rank}</span></td><td><strong>${name}</strong></td><td class="number-col">${v.qty.toLocaleString()}</td><td class="number-col">${pct.toFixed(1)}%</td><td class="money-col"><b>${money(v.total)}</b></td></tr>`}).join("")}</tbody></table></div>`;
}
function renderCategorySummary(){
  const facts=itemFacts(),totals={};facts.forEach(x=>{totals[x.category_id]=(totals[x.category_id]||0)+Number(x.line_total||Number(x.unit_price||0)*Number(x.quantity||0))});
  const grand=Object.values(totals).reduce((a,b)=>a+b,0);
  $("#categorySummary").innerHTML=categories.map((c,i)=>{const total=totals[c.id]||0,pct=grand?total/grand*100:0;return `<button type="button" class="category-card" data-category="${c.id}"><span>${i+1}</span><div><strong>${c.name_lo}</strong><small>${pct.toFixed(1)}% ຂອງຍອດຂາຍເມນູ</small></div><b>${money(total)}</b></button>`}).join("");
  $("#categorySummary").querySelectorAll("button").forEach(b=>b.onclick=()=>{selectedCategory=b.dataset.category;renderCategoryTabs();renderTopMenu();$("#categoryTabs").scrollIntoView({behavior:"smooth",block:"center"})});
}
function render(){
  const sales=orders.reduce((s,o)=>s+Number(o.grand_total||0),0),vat=orders.reduce((s,o)=>s+Number(o.vat_amount||0),0),discount=orders.reduce((s,o)=>s+Number(o.discount||0),0);
  $("#sales").textContent=money(sales);$("#bills").textContent=orders.length.toLocaleString();$("#vat").textContent=money(vat);$("#discount").textContent=money(discount);$("#average").textContent=money(orders.length?sales/orders.length:0);
  const pm={};payments.forEach(p=>pm[p.method]=(pm[p.method]||0)+Number(p.amount||0));$("#payments").innerHTML=Object.entries(pm).length?Object.entries(pm).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="metric-row"><span>${k}</span><b>${money(v)}</b></div>`).join(""):'<p class="empty">No payment data</p>';
  renderCategoryTabs();renderTopMenu();renderCategorySummary();
  const payByOrder={};payments.forEach(p=>payByOrder[p.order_id]=p.method);$("#rows").innerHTML=orders.map(o=>`<tr><td>${new Date(o.closed_at||o.created_at).toLocaleString("lo-LA")}</td><td>${o.order_number}</td><td>${o.table_number||"Takeaway"}</td><td>${money(o.subtotal)}</td><td>${money(o.discount)}</td><td>${money(o.vat_amount)}</td><td><b>${money(o.grand_total)}</b></td><td>${payByOrder[o.id]||"-"}</td></tr>`).join("")||'<tr><td colspan="8" class="empty">ບໍ່ພົບຂໍ້ມູນ</td></tr>';$("#resultInfo").textContent=`${orders.length.toLocaleString()} bills • limit 5,000`;
}
function csvEscape(v){return `"${String(v??"").replaceAll('"','""')}"`}
function download(name,text,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
$("#exportCsv").onclick=()=>{const pay={};payments.forEach(p=>pay[p.order_id]=p.method);const rows=[["date","bill","table","subtotal","discount","vat","total","payment"],...orders.map(o=>[o.closed_at,o.order_number,o.table_number||"Takeaway",o.subtotal,o.discount,o.vat_amount,o.grand_total,pay[o.id]||""])];download(`tum-pa-guay-sales-${$("#dateFrom").value}-to-${$("#dateTo").value}.csv`,rows.map(r=>r.map(csvEscape).join(",")).join("\n"),"text/csv;charset=utf-8")};
$("#backupJson").onclick=()=>download(`tum-pa-guay-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({version:"8.5-final",exported_at:new Date().toISOString(),filters:{from:$("#dateFrom").value,to:$("#dateTo").value},orders,payments,order_items:items},null,2),"application/json");
init();

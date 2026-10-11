const BINS={g:{n:'ถังเขียว',d:'ขยะเปียก',s:'เปียก',e:'🟢'},y:{n:'ถังเหลือง',d:'รีไซเคิล',s:'รีไซเคิล',e:'🟡'},b:{n:'ถังน้ำเงิน',d:'ขยะทั่วไป',s:'ทั่วไป',e:'🔵'},r:{n:'ถังแดง',d:'ขยะอันตราย',s:'อันตราย',e:'🔴'}};
const ICON={g:'🍃',y:'♻️',b:'🗑️',r:'⚠️'};
function binSVG(k,w){const c='var(--'+k+')';return `<svg viewBox="0 0 64 80" width="${w}" aria-hidden="true"><rect x="6" y="11" width="52" height="8" rx="4" fill="${c}" opacity=".8"/><rect x="24" y="4" width="16" height="8" rx="3" fill="${c}"/><path d="M11 21h42l-4 54a5 5 0 0 1-5 4H20a5 5 0 0 1-5-4z" fill="${c}"/><text x="32" y="58" font-size="24" text-anchor="middle">${ICON[k]}</text></svg>`}

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
$('#legend').innerHTML=Object.keys(BINS).map(k=>`<div>${binSVG(k,44)}<br>${BINS[k].s}</div>`).join('');
/* tabs */
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x===b));
 ['scan','qa','game'].forEach(t=>$('#'+t).classList.toggle('hidden',t!==b.dataset.t));
});
/* AI */
async function post(u,b){const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});if(!r.ok)throw new Error(r.status);return r.json()}
const b64=bl=>new Promise(ok=>{const f=new FileReader();f.onload=()=>ok(f.result.split(',')[1]);f.readAsDataURL(bl)});
async function sample(input,o={}){
 if(Array.isArray(input)){
  const msgs=input.map(m=>({role:m.role,content:m.content})),tl=o.tools||[];
  for(let i=0;i<4;i++){
   const r=await post('/api/chat',{messages:msgs});
   if(r.tool_uses&&r.tool_uses.length){
    msgs.push({role:'assistant',content:r.content});const rs=[];
    for(const u of r.tool_uses){const t=tl.find(x=>x.name===u.name);let out;try{out=await t.execute(u.input)}catch(e){out={error:String(e)}}
     rs.push({type:'tool_result',tool_use_id:u.id,content:JSON.stringify(out)})}
    msgs.push({role:'user',content:rs});
   }else{if(o.onText)o.onText({text:r.text});return {text:r.text}}
  }
  throw new Error('loop');
 }
 const b={desc:o.desc||''};if(o.images&&o.images[0])b.image=await b64(o.images[0]);
 return post('/api/analyze',b);
}
function parseJson(t){const m=String(t).match(/\{[\s\S]*\}/);return m?JSON.parse(m[0]):null}
async function toBlob(f){
 const img=await createImageBitmap(f);const k=Math.min(1,900/Math.max(img.width,img.height));
 const c=document.createElement('canvas');c.width=img.width*k;c.height=img.height*k;
 c.getContext('2d').drawImage(img,0,0,c.width,c.height);
 return new Promise(r=>c.toBlob(r,'image/jpeg',.82));
}
let imgBlob=null;
$('#file').onchange=async e=>{
 const f=e.target.files[0];if(!f)return;
 try{imgBlob=await toBlob(f);const p=$('#preview');p.src=URL.createObjectURL(imgBlob);p.style.display='block'}catch(_){$('#scanMsg').textContent='อ่านรูปไม่ได้'}
};
const SYS=`คุณคือผู้เชี่ยวชาญการแยกขยะในประเทศไทย ใช้มาตรฐานสีถัง: เขียว=ขยะเปียก/เศษอาหาร, เหลือง=รีไซเคิล(แก้ว กระดาษ พลาสติก โลหะ ที่สะอาด), น้ำเงิน=ขยะทั่วไป(ย่อยยาก/เปื้อน เช่น ถุงขนม โฟม), แดง=ขยะอันตราย(แบตเตอรี่ หลอดไฟ สเปรย์ ยา)`;
$('#go').onclick=async()=>{
 const desc=$('#desc').value.trim();
 if(!imgBlob&&!desc){$('#scanMsg').textContent='กรุณาใส่รูปหรือพิมพ์อธิบายก่อน';return}
 if(!sample){$('#scanMsg').textContent='ฟีเจอร์ AI ยังไม่พร้อมในมุมมองนี้';return}
 $('#go').disabled=true;$('#scanMsg').textContent='AI กำลังวิเคราะห์...';
 try{
  const prompt=SYS+`\nวิเคราะห์ขยะ${imgBlob?'ในรูป':''}${desc?' รายละเอียดจากผู้ใช้: '+desc:''}\nตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่น: {"item":"ชื่อสิ่งของ","type":"ประเภทขยะ 1-3 คำ","bin":"g|y|b|r","condition":"สภาพ 1-3 คำ","steps":["ขั้นตอนก่อนทิ้ง ไม่เกิน 5 คำ ขึ้นต้นด้วยอีโมจิ เช่น 💧 เทน้ำออก (ไม่มีให้เป็นอาร์เรย์ว่าง)"],"confidence":0-100}`;
  const o={cache:false};if(imgBlob)o.images=[imgBlob];
  o.desc=desc;const r=await sample('',o);const j=parseJson(r.text);if(!j)throw 0;
  showResult(j);
 }catch(e){$('#scanMsg').textContent='ยังไม่ได้เชื่อมต่อ AI ลองกดตัวอย่างด้านบนแทนนะ'}
 $('#go').disabled=false;
};
function showResult(j){
 const k=BINS[j.bin]?j.bin:'b',B=BINS[k],c=Math.max(0,Math.min(100,+j.confidence||0));
 $('#scanMsg').textContent='';
 const steps=(j.steps||[]).filter(Boolean);
 const R=$('#result');R.classList.remove('hidden');
 R.innerHTML=`<div class="res">${binSVG(k,84)}<div><div class="mu">${esc(j.item)}</div><div style="font-size:24px;font-weight:700">${B.n}</div><div class="mu">${B.d}</div></div></div>
 <div style="margin-top:10px"><span class="chip">${esc(j.type)}</span><span class="chip">${esc(j.condition||'')}</span></div>
 ${steps.length?`<div class="steps">${steps.map(s=>`<div>${esc(s)}</div>`).join('')}</div>`:''}
 <div class="meter" style="margin-top:12px"><i style="width:${c}%"></i></div><div class="mu">มั่นใจ ${c}%</div>`;
 findSpots(k);
}
/* drop points (ตัวอย่างข้อมูล พิกัดโดยประมาณ ในกรุงเทพฯ) */
const SPOTS=[
 {n:'สวนลุมพินี',la:13.7314,lo:100.5414,b:'gybr'},
 {n:'สวนจตุจักร',la:13.8003,lo:100.553,b:'gyb'},
 {n:'สยามพารากอน',la:13.7461,lo:100.5347,b:'yr'},
 {n:'เซ็นทรัลเวิลด์',la:13.7467,lo:100.5392,b:'yr'},
 {n:'จุฬาลงกรณ์มหาวิทยาลัย',la:13.7384,lo:100.5326,b:'gyb'},
 {n:'สำนักงานเขตปทุมวัน',la:13.7449,lo:100.5278,b:'gybr'},
 {n:'สำนักงานเขตจตุจักร',la:13.8296,lo:100.5606,b:'gybr'},
 {n:'เมกาบางนา',la:13.6465,lo:100.6807,b:'yr'},
 {n:'สวนสาธารณะเบญจกิติ',la:13.7283,lo:100.5593,b:'gyb'},
 {n:'ศูนย์รีไซเคิลสาธิต พุทธมณฑล',la:13.7927,lo:100.3257,b:'gybr'}
];
let pos=null;
function dist(a,b,c,d){const R=6371,t=x=>x*Math.PI/180,h=Math.sin(t(c-a)/2)**2+Math.cos(t(a))*Math.cos(t(c))*Math.sin(t(d-b)/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
function findSpots(k){
 const S=$('#spots');S.classList.remove('hidden');
 const draw=(approx)=>{
  const p=pos||{la:13.7563,lo:100.5018};
  const L=SPOTS.filter(s=>s.b.includes(k)).map(s=>({...s,d:dist(p.la,p.lo,s.la,s.lo)})).sort((a,b)=>a.d-b.d).slice(0,3);
  S.innerHTML=`<b>📍 ใกล้คุณ</b><span class="mu"> ${approx?'(กลางกรุงเทพฯ) ':''}• ข้อมูลตัวอย่าง</span>`+
  L.map(s=>`<div class="spot"><div>${esc(s.n)}<div class="mu">${s.d.toFixed(1)} กม.</div></div><a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${s.la},${s.lo}">นำทาง ›</a></div>`).join('')+
  (approx?'<div class="row"><button class="btn alt" id="loc">ใช้ตำแหน่งของฉัน</button></div>':'');
  const b=$('#loc');if(b)b.onclick=()=>navigator.geolocation?navigator.geolocation.getCurrentPosition(g=>{pos={la:g.coords.latitude,lo:g.coords.longitude};draw(false)},()=>{b.textContent='เข้าถึงตำแหน่งไม่ได้'}):0;
 };
 draw(!pos);
 if(!pos&&navigator.geolocation)navigator.geolocation.getCurrentPosition(g=>{pos={la:g.coords.latitude,lo:g.coords.longitude};draw(false)},()=>{},{timeout:6000});
}
/* ตัวอย่างกดลอง (ผลสำเร็จรูป ไม่เรียก AI) */
const SAMPLES=[
 {e:'🥤',item:'ขวดพลาสติก',type:'พลาสติก PET',bin:'y',condition:'มีน้ำเหลืออยู่',steps:['💧 เทน้ำออกให้หมด','🧴 แยกฝาออก','🫳 บีบให้แบน'],confidence:92},
 {e:'🥬',item:'เศษผัก',type:'เศษอาหาร',bin:'g',condition:'สดและเปียก',steps:['🚫 ไม่ต้องใส่ถุงพลาสติก','💧 เทน้ำออกก่อนทิ้ง'],confidence:95},
 {e:'🍟',item:'ถุงขนม',type:'พลาสติกหลายชั้น',bin:'b',condition:'เปื้อนผงปรุงรส',steps:['🫳 สะบัดเศษขนมออก','♻️ ถ้าพื้นที่มีจุดรับถุงฟิล์ม ส่งได้'],confidence:86},
 {e:'🔋',item:'ถ่านไฟฉาย',type:'แบตเตอรี่',bin:'r',condition:'ใช้แล้ว',steps:['🚫 ห้ามทิ้งปนขยะทั่วไป','🩹 แปะเทปปิดขั้ว','📍 นำไปจุดรับขยะอันตราย'],confidence:96}];
SAMPLES.forEach(x=>{const b=document.createElement('button');b.className='chip';b.textContent=x.e+' '+x.item;
 b.onclick=()=>{$('#desc').value=x.item;imgBlob=null;$('#preview').style.display='none';showResult(x)};$('#samples').appendChild(b)});
/* Q&A */
const hist=[];
async function ask(){
 const q=$('#q').value.trim();if(!q)return;
 if(!sample){add('a','ฟีเจอร์ AI ยังไม่พร้อมในมุมมองนี้');return}
 $('#q').value='';add('u',q);hist.push({role:'user',content:q});
 const el=add('a','...');$('#ask').disabled=true;
 try{
  const msgs=[{role:'user',content:SYS+'\nตอบคำถามเรื่องการแยกขยะเป็นภาษาไทย ตอบสั้นมาก ไม่เกิน 2 ประโยค ขึ้นต้นด้วยชื่อสีถัง ถ้าไม่แน่ใจให้บอกว่าควรเช็กกับหน่วยงานท้องถิ่น\n\nประวัติสนทนา:\n'+hist.map(h=>h.role+': '+h.content).join('\n')}];
  const r=await sample(msgs,{cache:false,onText:t=>{el.textContent=t.text}});
  el.textContent=r.text;hist.push({role:'assistant',content:r.text});
 }catch(e){el.textContent='ตอบไม่สำเร็จ ลองใหม่อีกครั้ง'}
 $('#ask').disabled=false;
}
function add(w,t){const d=document.createElement('div');d.className='msg '+w;d.textContent=t;const c=$('#chat');c.appendChild(d);c.scrollTop=1e5;return d}
const PERSONA=SYS+`
คุณคือน้องกรีน ผู้ช่วยแยกขยะสุดน่ารัก พูดไทยเป็นกันเอง
- คำถามจริงจัง: ตอบตรงประเด็น ขึ้นต้นด้วยชื่อสีถัง ไม่เกิน 3 ประโยค
- คำถามเล่นๆ/กวนๆ (เช่น เศษใจ แฟนเก่า): ตอบกวนๆ น่ารักๆ 1-2 ประโยคก่อน แล้วปิดท้ายบรรทัดใหม่ด้วย 💡 เคล็ดลับ: ตามด้วยคำแนะนำการทิ้งขยะจริงสั้นๆ
- ถ้าผู้ใช้ถามหาที่ทิ้ง/จุดทิ้งใกล้ตัว ให้เรียกเครื่องมือ nearest_drop_points ก่อนตอบ แล้วบอกชื่อกับระยะทาง
- ถ้าไม่แน่ใจให้แนะนำเช็กกับสำนักงานเขต`;
let lastSpots=null;
const TOOLS=[{name:'nearest_drop_points',description:'ค้นหาจุดทิ้งขยะที่ใกล้ผู้ใช้ที่สุด ตามประเภทถัง',inputSchema:{type:'object',properties:{bin:{type:'string',enum:['g','y','b','r'],description:'g=เปียก y=รีไซเคิล b=ทั่วไป r=อันตราย'}},required:['bin']},
 execute:async({bin})=>{await getPos();const L=nearest(bin,3);lastSpots=L;return L.map(s=>({name:s.n,km:+s.d.toFixed(1)}))}}];
function getPos(){return new Promise(r=>{if(pos||!navigator.geolocation)return r(pos);navigator.geolocation.getCurrentPosition(g=>{pos={la:g.coords.latitude,lo:g.coords.longitude};r(pos)},()=>r(null),{timeout:6000})})}
function nearest(k,n){const p=pos||{la:13.7563,lo:100.5018};return SPOTS.filter(s=>s.b.includes(k)).map(s=>({...s,d:dist(p.la,p.lo,s.la,s.lo)})).sort((a,b)=>a.d-b.d).slice(0,n)}
async function ask2(txt){
 const q=(txt||$('#q').value).trim();if(!q||$('#ask').disabled)return;
 if(!sample){add('a','ฟีเจอร์ AI ยังไม่พร้อมในมุมมองนี้');return}
 $('#q').value='';$('#chips').classList.add('hidden');
 add('u',q);hist.push({role:'user',content:q});lastSpots=null;
 const el=add('a','...');$('#ask').disabled=true;
 try{
  const m=hist.slice(-7).map(h=>({...h}));
  const r=await sample(m,{cache:false,tools:TOOLS,onText:t=>{el.textContent=t.text;$('#chat').scrollTop=1e5}});
  el.textContent=r.text;hist.push({role:'assistant',content:r.text});
  if(lastSpots){const d=document.createElement('div');d.className='lks';d.innerHTML=lastSpots.map(s=>`<a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${s.la},${s.lo}">🧭 ${esc(s.n)}</a>`).join('');el.appendChild(d)}
 }catch(e){hist.pop();el.textContent='ยังไม่ได้เชื่อมต่อ AI ลองกดคำถามตัวอย่างแทนนะ 🙏'}
 $('#ask').disabled=false;$('#chat').scrollTop=1e5;
}
const PRE=[
 {q:'เศษใจเหลือๆ ทิ้งที่ไหน? 💔',a:'เศษใจเหลือๆ ถังไหนก็ไม่รับจ้า 😭 เก็บไว้กอดตัวเอง หรือเทให้เพื่อนสนิทฟังแทนนะ ถ้าหนักมากๆ คุยกับคนที่ไว้ใจได้ก็ดีนะ',tip:'💡 เคล็ดลับ: ทิชชู่เช็ดน้ำตาที่ใช้แล้วทิ้งถังน้ำเงิน (ขยะทั่วไป) ได้เลย'},
 {q:'จุดรับขยะอิเล็กทรอนิกส์ใกล้ฉัน',spots:'r',a:'🔴 ขยะอิเล็กทรอนิกส์เป็นขยะอันตราย ห้ามทิ้งถังทั่วไปนะ\n📍 จุดรับใกล้คุณ (ข้อมูลตัวอย่าง):',tip:'💡 เคล็ดลับ: ลบข้อมูลและถอดแบตออกก่อนส่ง'},
 {q:'เศษผัก/ผลไม้',a:'🟢 ถังเขียว (ขยะเปียก) เลยจ้า เปลือกผลไม้ เศษผัก ทิ้งได้หมด',tip:'💡 เคล็ดลับ: เทน้ำออกก่อน และไม่ต้องใส่ถุงพลาสติกลงไป'},
 {q:'ลังกระดาษ',a:'🟡 ถังเหลือง (รีไซเคิล) ถ้าแห้งและสะอาด',tip:'💡 เคล็ดลับ: แกะเทปกาวออก พับให้แบน เก็บไม่ให้โดนน้ำ ถ้าเปื้อนมันมากให้ทิ้งถังน้ำเงิน'}];
async function preset(p){
 if($('#ask').disabled)return;
 add('u',p.q);hist.push({role:'user',content:p.q});
 const el=add('a','...');$('#ask').disabled=true;
 let txt=p.a,L=null;
 if(p.spots){await getPos();L=nearest(p.spots,3);txt+='\n'+L.map(s=>'• '+s.n+' ('+s.d.toFixed(1)+' กม.)').join('\n')}
 if(p.tip)txt+='\n'+p.tip;
 await new Promise(r=>setTimeout(r,500));
 el.textContent=txt;hist.push({role:'assistant',content:txt});
 if(L){const d=document.createElement('div');d.className='lks';d.innerHTML=L.map(s=>`<a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${s.la},${s.lo}">🧭 ${esc(s.n)}</a>`).join('');el.appendChild(d)}
 $('#ask').disabled=false;$('#chat').scrollTop=1e5;
}
PRE.forEach(p=>{const b=document.createElement('button');b.className='chip';b.textContent=p.q;b.onclick=()=>preset(p);$('#chips').appendChild(b)});
$('#ask').onclick=()=>ask2();$('#q').onkeydown=e=>{if(e.key==='Enter')ask2()};
/* Game */
const ITEMS=[['🍌','เปลือกกล้วย','g'],['🍎','แกนแอปเปิล','g'],['🍚','ข้าวเหลือ','g'],['🦴','กระดูก','g'],['🥬','เศษผัก','g'],
['🥤','ขวดพลาสติกสะอาด','y'],['📰','หนังสือพิมพ์','y'],['🥫','กระป๋อง','y'],['🍾','ขวดแก้ว','y'],['📦','กล่องกระดาษ','y'],['🧃','กล่องนม(ล้างแล้ว)','y'],
['🍟','ถุงขนม','b'],['🥡','โฟมใส่อาหาร','b'],['🧻','ทิชชู่ใช้แล้ว','b'],['🥢','ตะเกียบใช้แล้ว','b'],['🛍️','ถุงพลาสติกเปื้อน','b'],
['🔋','ถ่านไฟฉาย','r'],['💡','หลอดไฟ','r'],['💊','ยาหมดอายุ','r'],['🧴','สเปรย์กระป๋อง','r'],['📱','แบตมือถือเก่า','r']];
let G=null;
$('#bins').innerHTML=Object.keys(BINS).map(k=>`<div class="bin" data-k="${k}">${binSVG(k,56)}<div>${BINS[k].s}</div></div>`).join('');
const itemEl=$('#item'),arena=$('#arena');
function nextItem(){
 let it;do{it=ITEMS[Math.random()*ITEMS.length|0]}while(G.cur&&it===G.cur);
 G.cur=it;itemEl.innerHTML=it[0]+'<small>'+it[1]+'</small>';home();if(G.fp)itemEl.animate([{opacity:0,translate:'0 60px'},{opacity:1,translate:'0 0'}],{duration:260});
}
function home(){itemEl.style.left=(arena.clientWidth/2-itemEl.offsetWidth/2)+'px';itemEl.style.top=(G&&G.fp?arena.clientHeight-itemEl.offsetHeight-48:60)+'px';itemEl.style.transform=''}
function flash(t,c){const f=$('#flash');f.textContent=t;f.style.color=c;clearTimeout(f._t);f._t=setTimeout(()=>f.textContent='',700)}
function answer(k){
 if(!G||G.over)return;
 if(k===G.cur[2]){G.streak++;let p=10;if(G.streak%3===0)p+=2;G.score+=p;G.ok++;flash(p>10?'+12 🔥 streak!':'+10 ✓','var(--ac)')}
 else{G.streak=0;flash('✗ ต้องเป็น '+BINS[G.cur[2]].n,'var(--r)')}
 $('#sc').textContent=G.score;$('#st').textContent=G.streak;G.sel=false;nextItem();
}
let drag=null;
function binAt(x,y){return [...document.querySelectorAll('.bin')].find(b=>{const r=b.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top-10&&y<=r.bottom+10})}
itemEl.onpointerdown=e=>{if(!G||G.over)return;drag={x:e.clientX,y:e.clientY,moved:false};itemEl.setPointerCapture(e.pointerId);itemEl.style.cursor='grabbing'};
itemEl.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>6)drag.moved=true;
 itemEl.style.transform=`translate(${dx}px,${dy}px) scale(${G.fp?Math.max(.35,1+dy/(arena.clientHeight*1.2)):1})`;
 document.querySelectorAll('.bin').forEach(b=>b.classList.remove('hot'));
 const t=binAt(e.clientX,e.clientY);if(t)t.classList.add('hot')};
itemEl.onpointerup=e=>{if(!drag)return;const m=drag.moved;drag=null;itemEl.style.cursor='grab';
 document.querySelectorAll('.bin').forEach(b=>b.classList.remove('hot'));
 const t=binAt(e.clientX,e.clientY);
 if(m&&t)answer(t.dataset.k);else{itemEl.style.transform='';if(!m)G.sel=true}};
document.querySelectorAll('.bin').forEach(b=>b.onclick=()=>{if(G&&G.sel)answer(b.dataset.k)});
$('#play').onclick=()=>startGame(false);$('#playfp').onclick=()=>startGame(true);$('#again').onclick=()=>startGame(G.fp);
function setFP(on){arena.classList.toggle('fp',on);$('#hand').style.display=on?'block':'none';on?arena.appendChild($('#bins')):arena.after($('#bins'))}
function startGame(fp){
 G={score:0,streak:0,ok:0,t:30,over:false,cur:null,sel:false,fp:!!fp};setFP(!!fp);
 $('#gStart').classList.add('hidden');$('#gEnd').classList.add('hidden');$('#gPlay').classList.remove('hidden');
 $('#sc').textContent=0;$('#st').textContent=0;$('#tm').textContent=30;nextItem();
 G.iv=setInterval(()=>{G.t--;$('#tm').textContent=G.t;if(G.t<=0)endGame()},1000);
}
async function endGame(){
 clearInterval(G.iv);G.over=true;
 $('#gPlay').classList.add('hidden');$('#gEnd').classList.remove('hidden');
 $('#endTxt').textContent=`ได้ ${G.score} คะแนน • ถูก ${G.ok} ข้อ`;
 saveScore(G.score);
}
/* leaderboard via /api/scores */
let local=[];
const pid=(()=>{try{let v=localStorage.getItem('sg_pid');if(!v){v=crypto.randomUUID();localStorage.setItem('sg_pid',v)}return v}catch(_){return 'p'+Math.random().toString(36).slice(2,12)}})();
function renderLB(a){
 const L=$('#lb');
 if(!a.length){L.textContent='ยังไม่มีใครเล่น เป็นคนแรกเลย!';return}
 L.innerHTML='<table><tr><th>#</th><th>ผู้เล่น</th><th>สูงสุด</th><th>สะสม</th></tr>'+a.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.name)}</td><td>${+r.best||0}</td><td>${+r.total||0}</td></tr>`).join('')+'</table>';
}
async function loadLB(){try{const r=await fetch('/api/scores');renderLB((await r.json()).scores||[])}catch(_){renderLB(local)}}
async function saveScore(s){
 const name=($('#nick').value.trim()||'ผู้เล่น').slice(0,14);
 try{await post('/api/scores',{pid,name,score:s});loadLB()}
 catch(_){$('#endTxt').textContent+=' (บันทึกคะแนนไม่สำเร็จ)';local.push({name,best:s,total:s});renderLB(local)}
}
loadLB();
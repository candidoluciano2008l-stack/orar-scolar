// --- App configuration and shared state ---
const SUPABASE_URL="https://ezdlwxbcacsbcnjhqqnq.supabase.co";
const SUPABASE_KEY="sb_publishable_d_MGU7E-oYQgAtvx4xhqAA_8R4S4TGC";
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const SUPERADMIN_EMAIL="candidoluciano2008l@gmail.com";
const VAPID_PUBLIC_KEY="BKfg9TcuZBFk3EfcnwF-738zahqxAX7McsK7u1KZJy9gjt4rbLZLl1X5VOjVkExewwPGPiZkljAfaxMqjMlaCtA";
const schedule={
"Luni":[["07:20","08:10","Negociere"],["08:15","09:05","Română"],["09:10","10:00","Proiecte economice"],["10:05","10:55","Proiecte economice"],["11:00","11:50","Istoria comunismului"],["11:55","12:45","Negociere"],["12:50","13:40","Geografie"]],
"Marți":[["07:20","08:10","Geografie"],["08:15","09:05","Politici de marketing"],["09:10","10:00","Matematică"],["10:05","10:55","Analiză economico-financiară"],["11:00","11:50","Dirigenție"],["11:55","12:45","Dirigenție"],["12:50","13:40","Română"]],
"Miercuri":[["07:20","08:10","Statistică"],["08:15","09:05","Economie aplicată"],["09:10","10:00","Franceză"],["10:05","10:55","Statistică"],["11:00","11:50","Engleză"],["11:55","12:45","Română"]],
"Joi":[["07:20","08:10","Istorie"],["08:15","09:05","Franceză"],["09:10","10:00","Matematică"],["10:05","10:55","Sport"],["11:00","11:50","TIC"],["11:55","12:45","Economie aplicată"],["12:50","13:40","Engleză"]],
"Vineri":[["07:20","08:10","Analiză economico-financiară"],["08:15","09:05","Matematică"],["09:10","10:00","Religie"],["10:05","10:55","Statistică"]]
};
const days=Object.keys(schedule),names=["Duminică","Luni","Marți","Miercuri","Joi","Vineri","Sâmbătă"];
let now=new Date(),today=names[now.getDay()],selected=days.includes(today)?today:"Luni",selectedSubject=null,isAdmin=false,isSuperAdmin=false,currentUser=null,adminRole=null;
let tasks=[],changes=[],announcements=[],polls=[],schoolDaysOff=[];
let deferredPrompt=null;
let onlineChannel=null;
let onlineSessionId=sessionStorage.getItem("onlineSessionId");
if(!onlineSessionId){onlineSessionId=window.crypto?.randomUUID?.()||"session-"+Date.now()+"-"+Math.random().toString(36).slice(2);sessionStorage.setItem("onlineSessionId",onlineSessionId);}

const mins=t=>{const parts=t.split(":").map(Number);return parts[0]*60+parts[1]};
const localDateKey=d=>{const x=d||new Date();return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")};
const fmtDate=d=>new Intl.DateTimeFormat("ro-RO",{day:"2-digit",month:"long",year:"numeric"}).format(new Date(d+"T12:00:00"));
const formatTime=iso=>new Intl.DateTimeFormat("ro-RO",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(iso));
const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const isTaskActive=t=>Boolean(t?.deadline)&&String(t.deadline)>=localDateKey(now);
const getVisitorName=()=>String(localStorage.getItem("visitorName")||"").trim();

// --- Browser notifications ---
function isStandalonePwa(){return window.navigator.standalone===true||window.matchMedia?.("(display-mode: standalone)").matches===true}
function base64ToUint8Array(value){const pad="=".repeat((4-value.length%4)%4),b64=(value+pad).replace(/-/g,"+").replace(/_/g,"/"),raw=atob(b64);return Uint8Array.from(raw,c=>c.charCodeAt(0))}
function arrayBufferToBase64Url(value){const bytes=new Uint8Array(value),str=String.fromCharCode(...bytes);return btoa(str).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
async function updatePushButton(){
  const btn=document.getElementById("pushBtn"),help=document.getElementById("pushHelp");
  if(!btn)return;
  const supported="Notification" in window&&"serviceWorker" in navigator&&"PushManager" in window;
  if(!supported){btn.textContent="Indisponibile";btn.disabled=true;return}
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  if(ios&&!isStandalonePwa()){btn.textContent="Instalează pentru alerte";help.textContent="Pe iPhone, notificările funcționează după ce aplicația este adăugată pe ecranul principal.";return}
  if(Notification.permission==="denied"){btn.textContent="Notificări blocate";help.textContent="Le poți reactiva din setările de notificări ale dispozitivului.";btn.classList.remove("notify-active");return}
  try{
    const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();
    if(sub){btn.textContent="Notificări active";btn.classList.add("notify-active");help.textContent="Primești alerte pentru anunțuri, teme, schimbări și polluri noi.";return}
  }catch(_){}
  btn.textContent="Notificări";btn.classList.remove("notify-active");help.textContent="Primești alerte pentru anunțuri, teme, schimbări și polluri noi.";
}
async function enablePushNotifications(){
  const btn=document.getElementById("pushBtn"),help=document.getElementById("pushHelp");
  if(!btn)return;
  try{
    btn.disabled=true;btn.textContent="Se activează…";
    if(!("Notification" in window)||!("serviceWorker" in navigator)||!("PushManager" in window))throw new Error("Notificările nu sunt disponibile pe acest dispozitiv.");
    if(/iphone|ipad|ipod/i.test(navigator.userAgent)&&!isStandalonePwa())throw new Error("Pe iPhone trebuie mai întâi să adaugi aplicația pe ecranul principal.");
    const permission=await Notification.requestPermission();
    if(permission!=="granted"){throw new Error(permission==="denied"?"Permisiunea pentru notificări a fost refuzată.":"Permisiunea nu a fost acordată.");}
    const registration=await navigator.serviceWorker.ready;
    let sub=await registration.pushManager.getSubscription();
    if(!sub)sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64ToUint8Array(VAPID_PUBLIC_KEY)});
    const p256dh=arrayBufferToBase64Url(sub.getKey("p256dh")),auth=arrayBufferToBase64Url(sub.getKey("auth"));
    const {error}=await supabaseClient.rpc("save_push_subscription",{p_endpoint:sub.endpoint,p_p256dh:p256dh,p_auth:auth});
    if(error)throw error;
    btn.disabled=false;btn.classList.add("notify-active");btn.textContent="Notificări active";help.textContent="Primești alerte pentru anunțuri, teme, schimbări și polluri noi.";
  }catch(error){
    btn.disabled=false;help.textContent=error?.message||"Nu am putut activa notificările.";btn.textContent="Încearcă din nou";
  }
}

async function disablePushNotifications(){
  const btn=document.getElementById("pushBtn"),help=document.getElementById("pushHelp");
  if(!btn)return;
  try{
    btn.disabled=true;btn.textContent="Se dezactivează…";
    const registration=await navigator.serviceWorker.ready;
    const sub=await registration.pushManager.getSubscription();
    if(sub){
      await supabaseClient.rpc("remove_push_subscription",{p_endpoint:sub.endpoint});
      await sub.unsubscribe();
    }
    btn.disabled=false;btn.classList.remove("notify-active");btn.textContent="Activează notificările";
    help.textContent="Notificările sunt dezactivate. Le poți reactiva oricând.";
  }catch(error){
    btn.disabled=false;btn.textContent="Încearcă din nou";
    help.textContent=error?.message||"Nu am putut dezactiva notificările.";
  }
}
function togglePushNotifications(){
  const btn=document.getElementById("pushBtn");
  if(btn?.classList.contains("notify-active")) return disablePushNotifications();
  return enablePushNotifications();
}

// --- Theme and visitor identity ---
function applyTheme(theme){
  const t=theme==="dark"||theme==="light"?theme:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");
  document.documentElement.setAttribute("data-theme",t);localStorage.setItem("schoolTheme",t);
  document.getElementById("themeColor").setAttribute("content",t==="dark"?"#0b1220":"#28577f");
  const themeLabel=document.getElementById("themeBtnLabel");if(themeLabel)themeLabel.textContent=t==="dark"?"Temă deschisă":"Temă întunecată";
}
applyTheme(localStorage.getItem("schoolTheme")||"dark");
document.getElementById("themeBtn").onclick=()=>applyTheme(document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark");
document.getElementById("pushBtn").onclick=togglePushNotifications;
updatePushButton();

function renderVisitorBadge(){
  const name=document.getElementById("visitorDisplayName"),role=document.getElementById("visitorDisplayRole");
  if(!name||!role)return;
  name.textContent=getVisitorName()||"Vizitator";
  role.textContent=isSuperAdmin?"Super Admin":(isAdmin?"Administrator":"Elev");
}
// --- Authentication ---
async function refreshAuth(){
  const r=await supabaseClient.auth.getUser();currentUser=r.data?.user||null;
  isAdmin=false;isSuperAdmin=false;adminRole=null;
  if(currentUser?.email){
    const ar=await supabaseClient.from("admins").select("email,role").eq("email",currentUser.email.toLowerCase()).maybeSingle();
    if(ar.data){isAdmin=true;adminRole=ar.data.role;isSuperAdmin=ar.data.role==="superadmin";}
  }
  const adminLabel=document.getElementById("adminBtnLabel");if(adminLabel)adminLabel.textContent=isAdmin?"Dashboard":"Admin";
  const adminsTab=document.getElementById("adminsTab");
  if(adminsTab) adminsTab.style.display=isSuperAdmin?"inline-flex":"none";
  renderVisitorBadge();
  const onlineTab=document.getElementById("onlineTab");
  if(onlineTab) onlineTab.style.display=isSuperAdmin?"inline-flex":"none";
  const visitsTab=document.getElementById("siteVisitsTab");
  if(visitsTab) visitsTab.style.display=isSuperAdmin?"inline-flex":"none";
}
async function authenticateAdmin(){
  const status=document.getElementById("authStatus"),err=document.getElementById("authError"),btn=document.getElementById("authSend");
  const emailInput=document.getElementById("adminEmail"),passwordInput=document.getElementById("adminPassword");
  const email=(emailInput.value||"").trim().toLowerCase(),password=passwordInput.value||"";
  status.textContent="";err.textContent="";
  if(!email||!emailInput.checkValidity()){err.textContent="Introdu o adresă de email validă.";return}
  if(password.length<8){err.textContent="Parola trebuie să aibă cel puțin 8 caractere.";return}
  btn.disabled=true;
  const r=await supabaseClient.auth.signInWithPassword({email,password});
  btn.disabled=false;
  if(r.error){err.textContent="Email sau parolă incorectă.";return}
  document.getElementById("authOverlay").classList.remove("open");document.body.style.overflow="";
  await refreshAuth();
}

// --- Core data loading ---
async function loadData(){
  const [a,b,c,p,d]=await Promise.all([
    supabaseClient.from("tasks").select("*").order("deadline",{ascending:true}),
    supabaseClient.from("schedule_changes").select("*").order("change_date",{ascending:true}).order("start_time",{ascending:true}),
    supabaseClient.from("announcements").select("*").order("pinned",{ascending:false}).order("created_at",{ascending:false}),
    supabaseClient.from("polls").select("id,question,closed,created_at,poll_options(id,option_text,position)").order("created_at",{ascending:false}),
    supabaseClient.from("school_days_off").select("id,kind,title,start_date,end_date,note,author_name,created_at").order("start_date",{ascending:true})
  ]);
  const failed=[a,b,c,p,d].find(r=>r.error);
  if(failed){console.warn("Datele nu au putut fi actualizate; păstrez ultima versiune încărcată.",failed.error);return false}
  tasks=a.data||[];changes=b.data||[];announcements=c.data||[];
  polls=(p.data||[]).map(x=>({...x,poll_options:(x.poll_options||[]).sort((u,v)=>u.position-v.position)}));
  schoolDaysOff=d.data||[];
  return true;
}
async function getCommentCounts(){
  const r=await supabaseClient.from("comments").select("subject");if(r.error)return {};
  return (r.data||[]).reduce((acc,row)=>{acc[row.subject]=(acc[row.subject]||0)+1;return acc},{});
}
// --- Timetable and schedule changes ---
function weekDateForDay(day){
  const wanted=names.indexOf(day);
  const d=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const current=d.getDay();
  const diff=wanted-current;
  d.setDate(d.getDate()+diff);
  return localDateKey(d);
}
function dayNameFromDate(dateStr){
  if(!dateStr)return "";
  return names[new Date(dateStr+"T12:00:00").getDay()];
}
function normalizeChange(c){
  if(c.from_date){
    return {
      ...c,
      from_date:String(c.from_date),
      from_start:c.from_start_time?.slice(0,5) || "",
      from_end:c.from_end_time?.slice(0,5) || "",
      from_subject:c.from_subject,
      to_date:String(c.to_date),
      to_start:c.to_start_time?.slice(0,5) || "",
      to_end:c.to_end_time?.slice(0,5) || "",
      to_subject:c.to_subject,
      to_original_subject:c.to_original_subject || ""
    };
  }
  return {
    ...c,
    from_date:String(c.change_date),
    from_start:c.start_time?.slice(0,5) || "",
    from_end:c.end_time?.slice(0,5) || "",
    from_subject:c.original_subject,
    to_date:String(c.change_date),
    to_start:c.start_time?.slice(0,5) || "",
    to_end:c.end_time?.slice(0,5) || "",
    to_subject:c.replacement_subject,
    to_original_subject:""
  };
}
function baseSubjectForDateInterval(dateValue,start,end){
  const weekday=dayNameFromDate(dateValue),arr=schedule[weekday]||[];
  const lesson=arr.find(x=>x[0]===start&&x[1]===end);
  return lesson?lesson[2]:"";
}
function destinationOriginalSubject(change){
  const n=normalizeChange(change);
  // Orarul normal este sursa de adevăr pentru materia aflată inițial la destinație.
  // Valoarea salvată este doar fallback pentru înregistrări vechi sau intervale speciale.
  return baseSubjectForDateInterval(n.to_date,n.to_start,n.to_end) || n.to_original_subject || "";
}
function getChangeForLesson(day,lesson){
  const dateKey=weekDateForDay(day),start=lesson[0],end=lesson[1],subject=lesson[2];
  const list=changes.map(normalizeChange);
  const outgoing=list.find(c=>c.from_date===dateKey&&c.from_start===start&&c.from_end===end&&c.from_subject===subject);
  const incoming=list.find(c=>c.to_date===dateKey&&c.to_start===start&&c.to_end===end);
  if(outgoing && incoming && outgoing.id===incoming.id){
    return {subject:outgoing.to_subject,change:outgoing,status:"replace"};
  }
  if(outgoing){
    return {subject:subject,change:outgoing,status:"moved-away"};
  }
  if(incoming){
    return {subject:incoming.to_subject,change:incoming,status:"moved-in"};
  }
  return {subject,change:null,status:"normal"};
}
function lessonsForDay(day){
  const dateKey=weekDateForDay(day),dayOff=schoolDayOffForDate(dateKey);
  // During a vacation, keep the regular weekly timetable visible for reference.
  // Individual free days still show no scheduled lessons.
  if(dayOff&&dayOff.kind!=="vacation")return [];
  const base=(schedule[day]||[]).map(x=>[...x]);
  const incoming=changes.map(normalizeChange).filter(c=>c.to_date===dateKey);
  for(const c of incoming){
    const exists=base.some(x=>x[0]===c.to_start&&x[1]===c.to_end);
    if(!exists) base.push([c.to_start,c.to_end,c.to_subject]);
  }
  base.sort((a,b)=>mins(a[0])-mins(b[0]));
  return base;
}
async function renderTabs(){
  document.getElementById("tabs").innerHTML=days.map(d=>"<button class='tab "+(d===selected?"active ":"")+(d===today?"today":"")+"' onclick='selectDay(\""+d+"\")'>"+d+"</button>").join("");
}
function getSchoolState(){
  if(!days.includes(today))return {kind:"weekend",current:null,next:null};
  const dayOff=schoolDayOffForDate(localDateKey(now));
  if(dayOff)return {kind:"day-off",dayOff,current:null,next:null};
  const arr=lessonsForDay(today),cur=now.getHours()*60+now.getMinutes();
  const current=arr.find(x=>cur>=mins(x[0])&&cur<mins(x[1]));
  if(current){
    const currentIndex=arr.findIndex(x=>x[0]===current[0]&&x[1]===current[1]);
    const nextAfter=currentIndex>=0?arr[currentIndex+1]:null;
    return {kind:"current",current,next:nextAfter};
  }
  const next=arr.find(x=>cur<mins(x[0]));
  return {kind:next?"break-or-before":"after",current:null,next};
}
function renderSchoolState(){
  const s=getSchoolState(),next=document.getElementById("next"),nextTime=document.getElementById("nextTime"),count=document.getElementById("count"),state=document.getElementById("state"),ctx=document.getElementById("schoolContext");
  const stateCard=document.getElementById("stateCard"),nextLabel=document.querySelector("#nextCard .stat-label"),statGrid=document.querySelector(".smart-stack .stat-grid");
  if(stateCard)stateCard.style.display=s.kind==="day-off"?"none":"";
  if(nextLabel)nextLabel.textContent=s.kind==="day-off"?"Programul de azi":"Următoarea oră";
  if(statGrid)statGrid.dataset.dayOff=String(s.kind==="day-off");
  if(s.kind==="day-off"){
    next.textContent=s.dayOff.title;
    nextTime.textContent=s.dayOff.note||"Astăzi nu sunt cursuri.";
    count.textContent=s.dayOff.kind==="vacation"?"Vacanță":"Zi liberă";
    state.textContent="";
    ctx.textContent=s.dayOff.note||"Astăzi nu sunt cursuri.";
  }else if(s.kind==="current"){
    const currentInfo=getChangeForLesson(today,s.current);
    if(nextLabel)nextLabel.textContent="Ora de acum";
    next.textContent=currentInfo.subject;
    nextTime.textContent=s.current[0]+"–"+s.current[1];
    count.textContent="În oră";
    state.textContent="";
    const lessonRemaining=Math.max(0,mins(s.current[1])*60-(now.getHours()*3600+now.getMinutes()*60+now.getSeconds()));
    const lessonMm=String(Math.floor(lessonRemaining/60)).padStart(2,"0");
    const lessonSs=String(lessonRemaining%60).padStart(2,"0");
    nextTime.textContent=s.current[0]+"–"+s.current[1]+" · "+lessonMm+":"+lessonSs+" rămase";
    ctx.textContent="Se termină la "+s.current[1]+" · Mai sunt "+lessonMm+":"+lessonSs;
  }else if(s.kind==="break-or-before"){
    if(nextLabel)nextLabel.textContent="Următoarea oră";
    if(s.next){
      const e=getChangeForLesson(today,s.next);
      next.textContent=e.subject;
      nextTime.textContent=s.next[0]+"–"+s.next[1];
      const arr=lessonsForDay(today);
      const nextIndex=arr.findIndex(x=>x[0]===s.next[0]&&x[1]===s.next[1]&&x[2]===s.next[2]);
      const previous=nextIndex>0?arr[nextIndex-1]:null;
      const curSeconds=now.getHours()*3600+now.getMinutes()*60+now.getSeconds();
      const nextSeconds=mins(s.next[0])*60;
      const previousEndSeconds=previous?mins(previous[1])*60:null;
      const inBreak=previousEndSeconds!==null && curSeconds>=previousEndSeconds && curSeconds<nextSeconds;
      count.textContent=inBreak?"Pauză":"Înainte de ore";
      state.textContent="";
      const remaining=Math.max(0,nextSeconds-curSeconds);
      const mm=String(Math.floor(remaining/60)).padStart(2,"0");
      const ss=String(remaining%60).padStart(2,"0");
      nextTime.textContent=s.next[0]+"–"+s.next[1]+(inBreak?" · Pauză "+mm+":"+ss:"");
      ctx.textContent=(inBreak?"Până la ":"Începe la ")+s.next[0]+" · Mai sunt "+mm+":"+ss;
    }else{next.textContent="—";nextTime.textContent="—";count.textContent="—";state.textContent="—";ctx.textContent=""}
  }else if(s.kind==="after"){
    if(nextLabel)nextLabel.textContent="Programul de azi";
    next.textContent="Program încheiat";nextTime.textContent="";count.textContent="Liber";state.textContent="";ctx.textContent="";
  }else{
    if(nextLabel)nextLabel.textContent="Programul de azi";
    next.textContent="Weekend";nextTime.textContent="";count.textContent="Liber";state.textContent="";ctx.textContent="";
  }
}
const teacherBySubject={
  "Română":"MARIA MADALINA - DOBRE",
  "Limba și literatura română":"MARIA MADALINA - DOBRE",
  "Matematică":"ELENA-GABRIELA I MANAFU",
  "Geografie":"TUDORIȚA - DANILOV",
  "Istorie":"LAURENTIU MIHAI T FRUNZA",
  "Istoria comunismului":"AURELIAN EMIL S NICOLAE",
  "Istoria comunismului din România":"AURELIAN EMIL S NICOLAE",
  "Franceză":"FLORENȚA - DUMITRA - ȘTEFAN",
  "Limba franceză":"FLORENȚA - DUMITRA - ȘTEFAN",
  "Engleză":"GABRIELA IRINA N STANCU",
  "Limba engleză":"GABRIELA IRINA N STANCU",
  "Sport":"MIHAELA VALENTINA - DUMITRAȘCU",
  "Educație fizică și sport":"MIHAELA VALENTINA - DUMITRAȘCU",
  "TIC":"ANTONICA A BĂLȚOI",
  "Informatică și T.I.C. / Tehnologia informației și a comunicațiilor":"ANTONICA A BĂLȚOI",
  "Informatica si T.I.C / Tehnologia informatiei si a comunicatiilor":"ANTONICA A BĂLȚOI",
  "Religie":"CRISTINA - EMILIA - POP",
  "Analiză economico-financiară":"MIRELA DOINA - MATEI",
  "Economie aplicată":"POLIXENIA-AURORA G PARESCURA",
  "Statistică":"STELIANA ANA MARIA M PATRICHI",
  "Elemente de statistică, finanțe și asigurări":"STELIANA ANA MARIA M PATRICHI",
  "Negociere":"NICULINA - NEAGU",
  "Negociere și contractare":"NICULINA - NEAGU",
  "Politici de marketing":"NICULINA - NEAGU",
  "Dirigenție":"NICULINA - NEAGU",
  "Purtare":"NICULINA - NEAGU",
  "Consiliere și orientare":"NICULINA - NEAGU",
  "Proiecte economice":"NICULINA - NEAGU",
  "Proiecte economice în dinamica antreprenoriatului":"NICULINA - NEAGU",
  "Stagiu de pregătire practică în domeniul financiar contabil":"MIRELA DOINA - MATEI"
};
const teacherForSubject=subject=>teacherBySubject[subject]||"—";

function getAttentionAnnouncement(){
  return announcements.find(a=>a.attention===true) || null;
}
function renderAttention(){
  const a=getAttentionAnnouncement();
  const box=document.getElementById("attentionWelcome");
  if(!box)return;
  if(a){
    const title=escapeHtml(a.title||"Atenție!");
    const message=escapeHtml(a.message||"");
    box.innerHTML="<strong>ATENȚIE!</strong><div>"+title+"</div>"+(message?"<small>"+message+"</small>":"");
    box.hidden=false;
  }else{
    box.innerHTML="";
    box.hidden=true;
  }
}
let taskFileSelection=[];
let editingTaskId=null;
let editingTaskImagePaths=[];

// --- Tasks and attachments ---
function getSelectedTaskFiles(){
  return taskFileSelection.slice();
}
function setSelectedTaskFiles(files){
  const input=document.getElementById("taskImages");
  taskFileSelection=Array.from(files||[]);
  if(input){
    try{
      const dt=new DataTransfer();
      taskFileSelection.forEach(file=>dt.items.add(file));
      input.files=dt.files;
    }catch(_){}
  }
  renderSelectedTaskFiles();
}
function renderSelectedTaskFiles(){
  const box=document.getElementById("taskSelectedImages"),files=getSelectedTaskFiles();
  if(!box)return;
  box.innerHTML="";
  if(!files.length){
    box.innerHTML="<div class='task-selected-empty'>Nicio poză nouă selectată.</div>";
    return;
  }
  files.forEach((file,index)=>{
    const url=URL.createObjectURL(file);
    const item=document.createElement("div");item.className="task-selected-image";
    item.innerHTML="<img src='"+escapeHtml(url)+"' alt='Previzualizare "+(index+1)+"'><button type='button' class='task-selected-remove' aria-label='Șterge poza' title='Șterge poza'>×</button>";
    item.querySelector("button").onclick=()=>{
      URL.revokeObjectURL(url);
      const current=getSelectedTaskFiles();current.splice(index,1);setSelectedTaskFiles(current);
    };
    box.appendChild(item);
  });
}
function renderExistingTaskImages(){
  const box=document.getElementById("taskExistingImages");
  if(!box)return;
  box.innerHTML="";
  box.style.display=editingTaskId&&editingTaskImagePaths.length?"grid":"none";
  if(!editingTaskImagePaths.length)return;
  editingTaskImagePaths.forEach((path,index)=>{
    const url=supabaseClient.storage.from("task-images").getPublicUrl(path).data.publicUrl;
    const item=document.createElement("div");item.className="task-existing-image";
    item.innerHTML="<img src='"+escapeHtml(url)+"' alt='Poză existentă "+(index+1)+"'><button type='button' class='task-existing-remove' aria-label='Șterge poza' title='Șterge poza'>×</button>";
    item.querySelector("img").style.cursor="zoom-in";
    item.querySelector("img").onclick=()=>openTaskImage(path,editingTaskImagePaths);
    item.querySelector("button").onclick=()=>{
      editingTaskImagePaths.splice(index,1);
      renderExistingTaskImages();
      updateTaskImageLimitMessage();
    };
    box.appendChild(item);
  });
}
function updateTaskImageLimitMessage(){
  const err=document.getElementById("taskError");
  const total=editingTaskImagePaths.length+getSelectedTaskFiles().length;
  if(total>5&&err)err.textContent="Poți avea maximum 5 imagini.";
  else if(err&&err.textContent==="Poți avea maximum 5 imagini.")err.textContent="";
}
function resetTaskEditor(){
  editingTaskId=null;
  editingTaskImagePaths=[];
  document.getElementById("taskTitle").value="";
  document.getElementById("taskDeadline").value="";
  document.getElementById("taskDescription").value="";
  document.getElementById("taskType").value="Temă";
  setSelectedTaskFiles([]);
  renderExistingTaskImages();
  document.getElementById("taskSubmitBtn").textContent="Adaugă";
  document.getElementById("taskCancelEdit").style.display="none";
  document.querySelector("#tasksPanel .section-edit-title")?.remove();
}
function taskImageUrls(task){
  return Array.isArray(task?.image_paths)
    ? task.image_paths.map(path=>supabaseClient.storage.from("task-images").getPublicUrl(path).data.publicUrl).filter(Boolean)
    : [];
}
function taskImageGridHtml(task){
  const urls=taskImageUrls(task);
  if(!urls.length)return "";
  const paths=Array.isArray(task?.image_paths)?task.image_paths:[];
  return "<div class='task-image-grid'>"+paths.map((path,i)=>{
    const url=supabaseClient.storage.from("task-images").getPublicUrl(path).data.publicUrl;
    return "<button type='button' class='task-image-button' onclick='openTaskImage("+JSON.stringify(path)+","+JSON.stringify(paths)+")' aria-label='Deschide poza'><img src='"+escapeHtml(url)+"' alt='Poză pentru "+escapeHtml(task.title||"tema")+"' loading='lazy'></button>";
  }).join("")+"</div>";
}
let taskViewerPaths=[];
let taskViewerIndex=0;
function taskViewerRender(){
  const img=document.getElementById("taskImageViewerImg"),count=document.getElementById("taskImageViewerCount"),thumbs=document.getElementById("taskImageViewerThumbs"),prev=document.getElementById("taskImagePrev"),next=document.getElementById("taskImageNext");
  if(!img||!thumbs)return;
  const total=taskViewerPaths.length;
  const path=taskViewerPaths[taskViewerIndex];
  count.textContent=total?((taskViewerIndex+1)+" / "+total):"";
  prev.disabled=total<=1;
  next.disabled=total<=1;
  thumbs.innerHTML=taskViewerPaths.map((p,i)=>"<button type='button' class='task-image-thumb "+(i===taskViewerIndex?"active":"")+"' data-index='"+i+"' aria-label='Deschide poza "+(i+1)+"'><img src='"+escapeHtml(supabaseClient.storage.from("task-images").getPublicUrl(p).data.publicUrl)+"' alt='Miniatură "+(i+1)+"'></button>").join("");
  thumbs.querySelectorAll(".task-image-thumb").forEach(btn=>btn.onclick=()=>{taskViewerIndex=Number(btn.dataset.index);taskViewerLoadCurrent()});
  if(path)taskViewerLoadCurrent();
}
async function taskViewerLoadCurrent(){
  const img=document.getElementById("taskImageViewerImg"),path=taskViewerPaths[taskViewerIndex];
  if(!img||!path)return;
  img.src="";
  img.removeAttribute("srcset");
  img.removeAttribute("sizes");
  try{
    const downloaded=await supabaseClient.storage.from("task-images").download(path);
    if(downloaded.error)throw downloaded.error;
    const oldUrl=img.dataset.blobUrl;
    if(oldUrl)URL.revokeObjectURL(oldUrl);
    const blobUrl=URL.createObjectURL(downloaded.data);
    img.dataset.blobUrl=blobUrl;
    img.src=blobUrl;
  }catch(_){
    try{
      const signed=await supabaseClient.storage.from("task-images").createSignedUrl(path,3600);
      if(!signed.error&&signed.data?.signedUrl){img.src=signed.data.signedUrl}
      else throw new Error("image");
    }catch(__){img.alt="Nu am putut încărca această poză."}
  }
  document.querySelectorAll("#taskImageViewerThumbs .task-image-thumb").forEach((btn,i)=>btn.classList.toggle("active",i===taskViewerIndex));
  const count=document.getElementById("taskImageViewerCount");if(count)count.textContent=(taskViewerIndex+1)+" / "+taskViewerPaths.length;
}
function openTaskImage(path,allPaths=[]){
  const overlay=document.getElementById("taskImageViewer");
  if(!overlay)return;
  taskViewerPaths=Array.isArray(allPaths)&&allPaths.length?allPaths.slice():[path];
  const found=taskViewerPaths.indexOf(path);
  taskViewerIndex=found>=0?found:0;
  overlay.classList.add("open");document.body.style.overflow="hidden";
  taskViewerRender();
}
function closeTaskImage(){
  const overlay=document.getElementById("taskImageViewer"),img=document.getElementById("taskImageViewerImg");
  if(img){
    const blobUrl=img.dataset.blobUrl;
    if(blobUrl)URL.revokeObjectURL(blobUrl);
    delete img.dataset.blobUrl;
    img.src="";
  }
  taskViewerPaths=[];
  taskViewerIndex=0;
  if(overlay)overlay.classList.remove("open");
  if(!document.querySelector(".overlay.open:not(#taskImageViewer)"))document.body.style.overflow="";
}
document.getElementById("taskImagePrev").onclick=()=>{if(taskViewerPaths.length>1){taskViewerIndex=(taskViewerIndex-1+taskViewerPaths.length)%taskViewerPaths.length;taskViewerLoadCurrent()}};
document.getElementById("taskImageNext").onclick=()=>{if(taskViewerPaths.length>1){taskViewerIndex=(taskViewerIndex+1)%taskViewerPaths.length;taskViewerLoadCurrent()}};
let renderGeneration=0;
function updateCurrentLessonHighlight(){
  const inSession=!schoolDayOffForDate(localDateKey(now)),isTodaySelected=selected===today,cur=now.getHours()*60+now.getMinutes();
  document.querySelectorAll("#lessons .lesson[data-start][data-end]").forEach(lesson=>{
    const start=mins(lesson.dataset.start),end=mins(lesson.dataset.end),live=inSession&&isTodaySelected;
    lesson.classList.toggle("current",live&&cur>=start&&cur<end);
    lesson.classList.toggle("past",live&&cur>=end);
  });
}
async function render(){
  const generation=++renderGeneration,day=selected;
  const counts=await getCommentCounts();
  if(generation!==renderGeneration)return;
  const selectedTitle=document.getElementById("selectedTitle");
  const selectedDayOff=schoolDayOffForDate(weekDateForDay(day));
  if(selectedTitle)selectedTitle.textContent=selectedDayOff?day+" · "+selectedDayOff.title:day;
  const activeTaskCount=tasks.filter(isTaskActive).length;
  const dueTaskCount=document.getElementById("dueTaskCount");
  if(dueTaskCount)dueTaskCount.textContent=String(activeTaskCount);
  const dueCard=document.getElementById("dueCard");
  if(dueCard)dueCard.style.display=activeTaskCount?"":"none";
  const arr=lessonsForDay(day),cur=now.getHours()*60+now.getMinutes(),tmap={};
  tasks.forEach(t=>{(tmap[t.subject]||(tmap[t.subject]=[])).push(t)});
  renderSchoolState();
  renderAttention();
  renderTodayFocus();
  const currentDateOff=schoolDayOffForDate(localDateKey(now));
  const dayOffNote=selectedDayOff?"<div class='schedule-dayoff-note'>"+escapeHtml(selectedDayOff.kind==="vacation"?"Vacanță":"Zi liberă")+" · "+escapeHtml(selectedDayOff.title)+" · Orarul obișnuit este afișat pentru consultare.</div>":"";
  const lessonRows=arr.map(x=>{
    const a=mins(x[0]),b=mins(x[1]),isToday=day===today,showLiveState=isToday&&!currentDateOff,eff=getChangeForLesson(day,x);
    const cls=(showLiveState&&cur>=a&&cur<b?"current ":"")+(showLiveState&&cur>=b?"past ":"")+(eff.status==="moved-away"?"lesson-moved ":"")+(eff.status==="moved-in"?"lesson-move-in ":"");
    const c=counts[eff.subject]||0,subTasks=(tmap[eff.subject]||[]).filter(isTaskActive).slice(0,2);
    const taskHtml=subTasks.map(t=>"<div class='task-line'><span class='badge'>"+escapeHtml(t.type)+"</span>"+escapeHtml(t.title)+" · <span class='deadline'>"+fmtDate(t.deadline)+"</span></div>").join("");
    let ch="";
    if(eff.status==="replace") ch="<div class='lesson-change'><s>"+escapeHtml(x[2])+"</s> → "+escapeHtml(eff.subject)+"</div>";
    if(eff.status==="moved-away") ch="<div class='lesson-change'>Mutată → "+escapeHtml(dayNameFromDate(eff.change.to_date))+" "+escapeHtml(eff.change.to_start)+"–"+escapeHtml(eff.change.to_end)+"</div>";
    if(eff.status==="moved-in"){const replaced=destinationOriginalSubject(eff.change)||x[2];ch="<div class='lesson-change'><s>"+escapeHtml(replaced)+"</s> → "+escapeHtml(eff.subject)+" · mutată din "+escapeHtml(dayNameFromDate(eff.change.from_date))+" "+escapeHtml(eff.change.from_start)+"</div>";}
    return "<div class='lesson "+cls+"' data-start='"+x[0]+"' data-end='"+x[1]+"' onclick='openComments(\""+String(eff.subject).replace(/"/g,"&quot;")+"\")'><div class='time'>"+x[0]+"–"+x[1]+"</div><div><div class='subject-main'><div><div class='subject'>"+escapeHtml(eff.subject)+"</div><div class='teacher-sub'>Profesor: "+escapeHtml(teacherForSubject(eff.subject))+"</div></div><div class='comment-count'>"+c+" "+(c===1?"comentariu":"comentarii")+"</div></div>"+ch+taskHtml+"</div><div></div></div>";
  }).join("");
  document.getElementById("lessons").innerHTML=dayOffNote+(lessonRows||(selectedDayOff?"<div class='empty' style='margin:12px 0'>"+escapeHtml(selectedDayOff.title)+" · Nu sunt ore programate în această zi.</div>":"<div class='empty' style='margin:12px 0'>Nu sunt ore programate în această zi.</div>"));
  updateCurrentLessonHighlight();
  await renderPreviews();
}
function renderTodayFocus(){
  const dayEl=document.getElementById("todayFocusDate");
  if(dayEl)dayEl.textContent=welcomeDateFormat.format(now);
  const values={
    lessons:days.includes(today)?lessonsForDay(today).length:0,
    tasks:tasks.filter(isTaskActive).length,
    announcements:announcements.length,
    changes:changes.filter(x=>String(x.change_date||x.from_date||"")>=localDateKey(now)).length
  };
  document.querySelectorAll("[data-focus-metric]").forEach(item=>{
    item.style.display=values[item.dataset.focusMetric]?"":"none";
  });
  const section=document.getElementById("todayFocus");
  if(section)section.style.display=Object.values(values).some(value=>value>0)?"":"none";
  const lessonsEl=document.getElementById("focusLessons"),tasksEl=document.getElementById("focusTasks"),annEl=document.getElementById("focusAnnouncements"),changesEl=document.getElementById("focusChanges");
  if(lessonsEl)lessonsEl.textContent=String(values.lessons);
  if(tasksEl)tasksEl.textContent=String(values.tasks);
  if(annEl)annEl.textContent=String(values.announcements);
  if(changesEl)changesEl.textContent=String(values.changes);
}
// --- Task completion and summaries ---
function authorLabel(row){
  return escapeHtml(row?.author_name||"Administrator");
}
const taskCompletionStorageKey=()=>{
  const name=getVisitorName().toLowerCase().trim()||"anonymous";
  return "completedTasks:"+encodeURIComponent(name);
};
function getCompletedTaskMap(){
  try{return JSON.parse(localStorage.getItem(taskCompletionStorageKey())||"{}")||{};}catch(_){return {};}
}
function isTaskCompleted(taskId){
  const map=getCompletedTaskMap();
  return map[String(taskId)]===true;
}
function setTaskCompleted(taskId,completed){
  const map=getCompletedTaskMap();
  if(completed)map[String(taskId)]=true;
  else delete map[String(taskId)];
  localStorage.setItem(taskCompletionStorageKey(),JSON.stringify(map));
}
async function toggleTaskCompleted(taskId){
  const task=tasks.find(t=>Number(t.id)===Number(taskId));
  if(!task)return;
  setTaskCompleted(taskId,!isTaskCompleted(taskId));
  await render();
  if(selectedSubject)await loadSubjectTasks();
}
function taskCompletionButtonHtml(task){
  const done=isTaskCompleted(task.id);
  return "<button type='button' class='task-complete-btn "+(done?"done":"")+"' title='"+(done?"Marchează ca nefăcută":"Marchează ca finalizată")+"' onclick='event.stopPropagation();toggleTaskCompleted("+Number(task.id)+")'><span class='task-check'>"+(done?"✓":"")+"</span><span>"+(done?"Finalizată":"Finalizată?")+"</span></button>";
}
window.toggleTaskCompleted=toggleTaskCompleted;

function relativeDeadline(dateKey){
  if(!dateKey)return "";
  const todayKey=localDateKey(now),d=new Date(dateKey+"T12:00:00"),t=new Date(todayKey+"T12:00:00"),daysLeft=Math.round((d-t)/86400000);
  if(daysLeft===0)return "Astăzi";
  if(daysLeft===1)return "Mâine";
  if(daysLeft>1&&daysLeft<8)return "Peste "+daysLeft+" zile";
  return fmtDate(dateKey);
}
async // --- Task, announcement, and schedule previews ---
function renderPreviews(){
  const ann=announcements.slice(0,3),ch=changes.filter(x=>x.change_date>=localDateKey()).slice(0,3);
  document.getElementById("announcementPreview").innerHTML=ann.length?ann.map(a=>"<article class='notice-card "+(a.pinned?"pinned ":"")+(a.attention?"attention-warning":"")+"'>"+(a.attention?"<div class='notice-type-badge attention'>ATENȚIE</div>":a.pinned?"<div class='notice-type-badge pinned'>FIXAT</div>":"<div class='notice-type-badge'>ANUNȚ</div>")+"<div class='notice-title'>"+escapeHtml(a.title)+"</div><div class='notice-message'>"+escapeHtml(a.message)+"</div><div class='author-meta'>Postat de "+authorLabel(a)+" · "+formatTime(a.created_at)+"</div></article>").join(""):"<div class='empty'>Nu există anunțuri.</div>";
  document.getElementById("changePreview").innerHTML=ch.length?ch.map(c=>{const n=normalizeChange(c),replaced=destinationOriginalSubject(c);return "<article class='change-card'><div class='change-row'><div class='change-date'>"+fmtDate(n.from_date)+" · "+n.from_start+"–"+n.from_end+"</div><div class='change-flow'><span class='change-subject-old'>"+escapeHtml(n.from_subject)+"</span><span class='change-arrow-small'>→</span><span class='change-sub'>"+escapeHtml(n.to_subject)+"</span></div></div><div class='change-note'>"+(n.from_date===n.to_date?"Înlocuire în aceeași zi":"Mutată pe "+dayNameFromDate(n.to_date)+" · "+fmtDate(n.to_date)+" · "+n.to_start+"–"+n.to_end)+(replaced&&n.from_date!==n.to_date?" · În locul: "+escapeHtml(replaced):"")+(c.note?" · "+escapeHtml(c.note):"")+"</div><div class='author-meta'>Postat de "+authorLabel(c)+"</div></article>"}).join(""):"<div class='empty'>Nu există schimbări programate.</div>";
  const taskBox=document.getElementById("taskPreview");
  if(taskBox){
    const upcoming=tasks.filter(isTaskActive).slice().sort((a,b)=>String(a.deadline).localeCompare(String(b.deadline))).slice(0,5);
    taskBox.innerHTML=upcoming.length?upcoming.map(t=>{
  const firstPath=Array.isArray(t.image_paths)&&t.image_paths.length?t.image_paths[0]:"";
  const thumb=firstPath
    ? "<button type='button' class='task-preview-image-btn' onclick='openTaskImage("+JSON.stringify(firstPath)+","+JSON.stringify(t.image_paths||[])+")' aria-label='Deschide pozele'><img src='"+escapeHtml(supabaseClient.storage.from("task-images").getPublicUrl(firstPath).data.publicUrl)+"' alt='Poză pentru "+escapeHtml(t.title||"tema")+"' loading='lazy'></button>"
    : "";
  return "<article class='task-preview-item "+(isTaskCompleted(t.id)?"task-completed":"")+"' >"+thumb+"<div class='task-preview-main'><div style='display:flex;align-items:center;gap:7px;flex-wrap:wrap'><div class='notice-type-badge' style='margin-bottom:0'>"+escapeHtml(t.type)+"</div><div class='task-preview-title'>"+escapeHtml(t.title)+"</div></div><div class='task-preview-meta'>"+escapeHtml(t.subject)+"</div>"+(t.description?"<div class='task-preview-description'>"+escapeHtml(t.description)+"</div>":"")+"<div class='author-meta'>Postat de "+authorLabel(t)+"</div>"+(t.image_paths?.length?"<button type='button' class='task-image-count task-image-count-btn' onclick='openTaskImage("+JSON.stringify(firstPath)+","+JSON.stringify(t.image_paths||[])+")'>📷 "+t.image_paths.length+" "+(t.image_paths.length===1?"poză":"poze")+"</button>":"")+"<div class='task-preview-footer'>"+taskCompletionButtonHtml(t)+"<div class='task-preview-deadline'>"+relativeDeadline(t.deadline)+"</div></div></div></article>";
}).join(""):"<div class='empty'>Nu există teme sau proiecte active.</div>";
  }
  await renderPollPreview();
  updateSmartStackCounts();
}
function updateSmartStackCounts(){
  const values={stackCountSchedule:lessonsForDay(selected).length,stackCountTasks:tasks.filter(isTaskActive).length,stackCountAnnouncements:announcements.length,stackCountPolls:polls.filter(p=>!p.closed).length,stackCountChanges:changes.filter(x=>String(x.change_date||x.from_date||"")>=localDateKey(now)).length};
  Object.entries(values).forEach(([id,value])=>{const el=document.getElementById(id);if(el){el.textContent=String(value);el.hidden=value===0}});
}
// --- Polls ---
async function getPollResults(pollId){
  const r=await supabaseClient.rpc("get_poll_results",{p_poll_id:pollId});
  return r.error?[]:(r.data||[]);
}
function getPollVoteMap(){
  try{return JSON.parse(localStorage.getItem("pollVotes")||"{}")||{};}catch(_){return {};}
}
function setPollVote(pollId,optionId){
  const map=getPollVoteMap();map[String(pollId)]=String(optionId);localStorage.setItem("pollVotes",JSON.stringify(map));
}
function getPollVoterId(){
  let id=localStorage.getItem("pollVoterId");
  if(!id){id=window.crypto&&window.crypto.randomUUID?window.crypto.randomUUID():"v-"+Date.now()+"-"+Math.random().toString(36).slice(2);localStorage.setItem("pollVoterId",id);}
  return id;
}
function pollCardHtml(poll,counts,surface){
  const options=(poll.poll_options||[]).slice().sort((a,b)=>a.position-b.position);
  const countMap={};(counts||[]).forEach(x=>countMap[String(x.option_id)]=Number(x.vote_count)||0);
  const total=options.reduce((sum,o)=>sum+(countMap[String(o.id)]||0),0);
  const voted=getPollVoteMap()[String(poll.id)];
  const choiceHtml=options.map(o=>"<label class='poll-option'><input type='radio' name='poll-"+poll.id+"-"+surface+"' value='"+o.id+"'><span>"+escapeHtml(o.option_text)+"</span></label>").join("");
  const resultHtml=options.map(o=>{const n=countMap[String(o.id)]||0,pct=total?Math.round(n/total*100):0;return "<div class='poll-result'><div class='poll-result-head'><span>"+escapeHtml(o.option_text)+"</span><span>"+pct+"% · "+n+"</span></div><div class='poll-bar'><span style='width:"+pct+"%'></span></div></div>"}).join("");
  return "<article class='poll-card'><div class='poll-question'>"+escapeHtml(poll.question)+"</div>"+(!voted?"<form class='poll-form' data-poll-id='"+poll.id+"'><div class='poll-options'>"+choiceHtml+"</div><div class='poll-actions'><button class='send' type='submit'>Votează</button></div><div class='error poll-form-error'></div></form>":"<div class='poll-voted'>Ai votat. Rezultatele:</div><div class='poll-admin-results'>"+resultHtml+"</div>")+"<div class='poll-meta'>Postat de "+authorLabel(poll)+" · "+formatTime(poll.created_at)+" · "+(total===1?"1 vot":total+" voturi")+"</div></article>";
}
async function renderPollCards(list,surface){
  if(!list.length)return "<div class='empty'>Nu există polluri active.</div>";
  const cards=await Promise.all(list.map(async p=>pollCardHtml(p,await getPollResults(p.id),surface)));
  return cards.join("");
}
async function renderPollPreview(){
  const box=document.getElementById("pollPreview");if(!box)return;
  box.innerHTML=await renderPollCards(polls.filter(p=>!p.closed).slice(0,3),"preview");
}
async function votePoll(form){
  const checked=form.querySelector("input[type='radio']:checked"),error=form.querySelector(".poll-form-error");
  if(!checked){error.textContent="Alege o variantă.";return}
  const pollId=Number(form.dataset.pollId),button=form.querySelector("button[type='submit']");
  button.disabled=true;error.textContent="";
  const r=await supabaseClient.from("poll_votes").insert({poll_id:pollId,option_id:Number(checked.value),voter_id:getPollVoterId()});
  button.disabled=false;
  if(r.error){
    if(r.error.code==="23505"){setPollVote(pollId,checked.value);await loadData();await renderPollPreview();if(document.getElementById("listOverlay").classList.contains("open")&&document.getElementById("listTitle").textContent==="Polluri")await openList("polls");return}
    error.textContent="Nu s-a putut înregistra votul. Încearcă din nou.";return;
  }
  setPollVote(pollId,checked.value);await loadData();await renderPollPreview();if(document.getElementById("listOverlay").classList.contains("open")&&document.getElementById("listTitle").textContent==="Polluri")await openList("polls");
}
document.addEventListener("submit",e=>{if(e.target.matches(".poll-form")){e.preventDefault();votePoll(e.target)}});
// --- Comments and chat ---
async function openComments(subject){
  selectedSubject=subject;document.getElementById("modalTitle").textContent=subject;document.getElementById("overlay").classList.add("open");document.body.style.overflow="hidden";document.getElementById("error").textContent="";await loadSubjectTasks();await loadComments();
}
async function loadSubjectTasks(){
  const list=tasks.filter(t=>t.subject===selectedSubject&&isTaskActive(t));
  document.getElementById("subjectTasks").innerHTML="<h3 style='margin:0 0 8px'>Teme / proiecte</h3>"+(list.length?list.map(t=>"<article class='notice-card "+(isTaskCompleted(t.id)?"task-card-completed":"")+"' id='subject-task-"+t.id+"'><div class='notice-title'>"+escapeHtml(t.title)+"</div><div class='notice-meta'>"+escapeHtml(t.type)+" · Deadline: <b>"+fmtDate(t.deadline)+"</b></div>"+(t.description?"<div class='notice-message'>"+escapeHtml(t.description)+"</div>":"")+"<div class='author-meta'>Postat de "+authorLabel(t)+"</div>"+taskCompletionButtonHtml(t)+taskImageGridHtml(t)+"</article>").join(""):"<div class='empty'>Nu există încă teme sau proiecte pentru această materie.</div>");
}
async function loadComments(){
  const box=document.getElementById("comments");box.innerHTML="<div class='no-comments'>Se încarcă…</div>";
  const r=await supabaseClient.from("comments").select("id,subject,name,message,created_at").eq("subject",selectedSubject).order("created_at",{ascending:false});
  if(r.error){box.innerHTML="<div class='no-comments'>Nu am putut încărca comentariile.</div>";return}
  if(!r.data?.length){box.innerHTML="<div class='no-comments'>Nu există încă comentarii pentru această materie.</div>";return}
  box.innerHTML="";r.data.forEach(c=>{const item=document.createElement("article"),meta=document.createElement("div"),n=document.createElement("div"),right=document.createElement("div"),t=document.createElement("div"),msg=document.createElement("div");
    item.className="comment";meta.className="comment-meta";n.className="comment-name";right.className="comment-actions";t.className="comment-time";msg.className="comment-message";n.textContent=c.name;t.textContent=formatTime(c.created_at);right.append(t);
    if(isAdmin){const del=document.createElement("button");del.className="delete-btn";del.textContent="Șterge";del.onclick=()=>deleteComment(c.id);right.append(del)}
    meta.append(n,right);msg.textContent=c.message;item.append(meta,msg);box.appendChild(item);
  });
}
async function deleteComment(id){const r=await supabaseClient.from("comments").delete().eq("id",id);if(r.error){document.getElementById("error").textContent="Nu s-a putut șterge comentariul.";return}await loadComments();await render()}
function closeComments(){document.getElementById("overlay").classList.remove("open");document.body.style.overflow="";selectedSubject=null}
window.selectDay=d=>{selected=d;renderTabs();render()};window.openComments=openComments;
document.getElementById("close").onclick=closeComments;
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeTaskImage()});document.getElementById("overlay").addEventListener("click",e=>{if(e.target.id==="overlay")closeComments()});
document.getElementById("taskImageViewerClose").onclick=closeTaskImage;
document.getElementById("taskImageViewer").addEventListener("click",e=>{if(e.target.id==="taskImageViewer")closeTaskImage()});

// --- Public chat ---
async function loadChat(){
  const body=document.getElementById("chatPageBody")||document.getElementById("listBody");
  const r=await supabaseClient.from("chat_messages").select("id,name,message,created_at").order("created_at",{ascending:true}).limit(200);
  if(r.error){body.innerHTML="<div class='empty'>Nu am putut încărca chatul.</div>";return}
  const messages=r.data||[];
  const visitor=getVisitorName();
  const cards=messages.length?messages.map(m=>{
    const mine=visitor&&m.name===visitor?" mine":"";
    const del=isAdmin?"<button class='delete-btn chat-delete' onclick='deleteChatMessage("+m.id+")'>Șterge</button>":"";
    return "<article class='chat-message"+mine+"'><div class='chat-message-meta'><div class='chat-message-name'>"+escapeHtml(m.name)+"</div><div style='display:flex;gap:8px;align-items:center'><div class='chat-message-time'>"+formatTime(m.created_at)+"</div>"+del+"</div></div><div class='chat-message-text'>"+escapeHtml(m.message)+"</div></article>";
  }).join(""):"<div class='empty'>Nu a scris nimeni încă. Fii primul!</div>";
  body.innerHTML="<div class='chat-shell'><div class='chat-messages' id='chatMessages'>"+cards+"</div><form class='chat-composer' id='chatForm'><div class='grid'><input class='input chat-name-readonly' id='chatName' maxlength='30' placeholder='Numele tău' autocomplete='nickname' value='' readonly required><span></span></div><textarea class='textarea' id='chatMessage' maxlength='500' placeholder='Scrie un mesaj pentru toată lumea...' required></textarea><input id='chatWebsite' tabindex='-1' autocomplete='off' aria-hidden='true' style='position:absolute;left:-9999px'><div class='actions'><div class='hint'>Max. 500 caractere. Așteaptă 5 secunde între mesaje.</div><button class='send' id='chatSend' type='submit'>Trimite</button></div><div class='error' id='chatError'></div></form></div>";
  const saved=localStorage.getItem("chatName")||getVisitorName();if(saved)document.getElementById("chatName").value=saved;
  const box=document.getElementById("chatMessages");if(box)box.scrollTop=box.scrollHeight;
  document.getElementById("chatForm").addEventListener("submit",submitChat);
}
async function submitChat(e){
  e.preventDefault();
  const form=e.currentTarget,error=document.getElementById("chatError"),button=document.getElementById("chatSend");
  const name=(document.getElementById("chatName").value.trim()||getVisitorName()),message=document.getElementById("chatMessage").value.trim();
  if(document.getElementById("chatWebsite").value)return;
  if(!name||!message){error.textContent="Completează numele și mesajul.";return}
  const last=Number(localStorage.getItem("chatCooldown")||0);
  if(Date.now()-last<5000){error.textContent="Așteaptă câteva secunde înainte de a scrie din nou.";return}
  button.disabled=true;error.textContent="";
  const r=await supabaseClient.from("chat_messages").insert({name,message});
  button.disabled=false;
  if(r.error){error.textContent="Nu s-a putut trimite mesajul. Încearcă din nou.";return}
  localStorage.setItem("chatName",name);localStorage.setItem("chatCooldown",String(Date.now()));
  document.getElementById("chatMessage").value="";
  await loadChat();
}
async function deleteChatMessage(id){
  const r=await supabaseClient.from("chat_messages").delete().eq("id",id);
  if(r.error)return;
  if(document.getElementById("chatPage")?.style.display!=="none")await loadChat();
}
async // --- Navigation and panels ---
async // --- Page navigation and overlays ---
function openList(type){
  document.getElementById("listOverlay").classList.add("open");document.body.style.overflow="hidden";const title=document.getElementById("listTitle"),body=document.getElementById("listBody");
  if(type==="ann"){
    title.textContent="Anunțuri importante";body.innerHTML=announcements.length?announcements.map(a=>"<article class='notice-card "+(a.pinned?"pinned":"")+"'><div class='notice-title'>"+escapeHtml(a.title)+"</div><div class='notice-message'>"+escapeHtml(a.message)+"</div><div class='notice-meta'>"+formatTime(a.created_at)+(a.pinned?" · Fixat":"")+"</div></article>").join(""):"<div class='empty'>Nu există anunțuri.</div>";
  }else if(type==="changes"){
    title.textContent="Schimbări de orar";body.innerHTML=changes.length?changes.map(c=>{const n=normalizeChange(c),replaced=destinationOriginalSubject(c);return "<article class='change-card'><div class='change-row'><div class='change-date'>"+fmtDate(n.from_date)+" · "+n.from_start+"–"+n.from_end+"</div><div class='change-sub'>"+escapeHtml(n.from_subject)+" → "+escapeHtml(n.to_subject)+"</div></div><div class='change-note'>"+(n.from_date===n.to_date?"Înlocuire în aceeași zi":"Mutată pe "+dayNameFromDate(n.to_date)+" · "+fmtDate(n.to_date)+" · "+n.to_start+"–"+n.to_end)+(replaced&&n.from_date!==n.to_date?" · În locul: "+escapeHtml(replaced):"")+(c.note?" · "+escapeHtml(c.note):"")+"</div></article>"}).join(""):"<div class='empty'>Nu există schimbări de orar.</div>";
  }else if(type==="polls"){
    title.textContent="Polluri";body.innerHTML=await renderPollCards(polls.filter(p=>!p.closed),"list");
  }else if(type==="chat"){
    closeList();showChatPage();return;
  }
}
function closeList(){document.getElementById("listOverlay").classList.remove("open");document.body.style.overflow=""}
function setSideNavActive(key){
  document.querySelectorAll(".side-link[data-nav]").forEach(btn=>{
    btn.classList.toggle("nav-selected",btn.dataset.nav===key);
    btn.classList.remove("active");
  });
}
function setSmartStackPanel(panelId){
  const panels=[...document.querySelectorAll(".smart-stack-panels .stack-panel")],buttons=[...document.querySelectorAll(".smart-stack-tab")];
  const index=panels.findIndex(panel=>panel.id===panelId);if(index<0)return;
  const oldIndex=panels.findIndex(panel=>panel.classList.contains("stack-active"));
  document.documentElement.style.setProperty("--stack-enter",index>=oldIndex?"18px":"-18px");
  panels.forEach((panel,i)=>{const active=i===index;panel.classList.toggle("stack-active",active);panel.setAttribute("aria-hidden",String(!active))});
  buttons.forEach((button,i)=>{button.setAttribute("aria-selected",String(i===index));button.tabIndex=i===index?0:-1});
  const position=document.getElementById("smartStackPosition");if(position)position.textContent=`${index+1} / ${panels.length}`;
  buttons[index]?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});
}
function moveSmartStack(direction){const panels=[...document.querySelectorAll(".smart-stack-panels .stack-panel")];const index=panels.findIndex(panel=>panel.classList.contains("stack-active"));const next=(index+direction+panels.length)%panels.length;setSmartStackPanel(panels[next].id)}
document.getElementById("smartStackPrev").onclick=()=>moveSmartStack(-1);
document.getElementById("smartStackNext").onclick=()=>moveSmartStack(1);
document.querySelectorAll(".smart-stack-tab").forEach((button,index,buttons)=>{
  button.addEventListener("click",()=>setSmartStackPanel(button.dataset.stackTarget));
  button.addEventListener("keydown",event=>{if(event.key==="ArrowRight"||event.key==="ArrowLeft"){event.preventDefault();const step=event.key==="ArrowRight"?1:-1;const target=buttons[(index+step+buttons.length)%buttons.length];setSmartStackPanel(target.dataset.stackTarget);target.focus()}})
});
const stackStage=document.getElementById("smartStackStage");let stackPointer=null;
stackStage.addEventListener("pointerdown",event=>{if(event.target.closest("button,a,input,textarea,select,[role=button],.lesson,.poll-card,.notice-card,.task-preview-item,.change-card"))return;stackPointer={x:event.clientX,y:event.clientY}});
stackStage.addEventListener("pointerup",event=>{if(!stackPointer)return;const dx=event.clientX-stackPointer.x,dy=event.clientY-stackPointer.y;stackPointer=null;if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.25)moveSmartStack(dx<0?1:-1)});
stackStage.addEventListener("pointercancel",()=>{stackPointer=null});

document.querySelectorAll(".smart-stack-tab").forEach(button=>button.addEventListener("click",()=>setSmartStackPanel(button.dataset.stackTarget)));
function scrollToSection(sectionId,key){
  setSideNavActive(key);
  if(document.getElementById(sectionId)?.classList.contains("stack-panel"))setSmartStackPanel(sectionId);
  const el=document.getElementById(sectionId);
  if(el)el.scrollIntoView({behavior:"smooth",block:"start"});
}
document.getElementById("todayBtn").onclick=()=>{showHomePage();setSmartStackPanel("scheduleSection");setSideNavActive("home");selected=days.includes(today)?today:"Luni";renderTabs();render();window.scrollTo({top:0,behavior:"smooth"})};
document.getElementById("scheduleNav").onclick=()=>{showHomePage();scrollToSection("scheduleSection","schedule")};
document.getElementById("tasksNav").onclick=()=>{showHomePage();scrollToSection("tasksSection","tasks")};
document.getElementById("announcementsBtn").onclick=()=>{showHomePage();scrollToSection("announcementsSection","announcements")};
document.getElementById("changesBtn").onclick=()=>{showHomePage();scrollToSection("changesSection","changes")};
document.getElementById("pollsBtn").onclick=()=>{showHomePage();scrollToSection("pollsSection","polls")};

const calendarMonthFormat=new Intl.DateTimeFormat("ro-RO",{month:"long",year:"numeric"});
const calendarDayFormat=new Intl.DateTimeFormat("ro-RO",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
const calendarShortFormat=new Intl.DateTimeFormat("ro-RO",{day:"2-digit",month:"2-digit"});
let calendarCursor=new Date(now.getFullYear(),now.getMonth(),1);
let calendarSelectedDate=localDateKey(now);
const calendarWeekdayNames=["Luni","Marți","Miercuri","Joi","Vineri","Sâmbătă","Duminică"];
// --- Calendar ---
function dateInRange(dateKey,start,end){return dateKey>=start&&dateKey<=end}
function schoolDayOffForDate(dateKey){return schoolDaysOff.find(x=>dateInRange(dateKey,x.start_date,x.end_date))||null}
function calendarEventsForDate(dateKey){
  const events=[];
  tasks.filter(t=>String(t?.deadline||"")===dateKey).forEach(t=>events.push({kind:"task",title:t.title||"Temă / proiect",subject:t.subject||"",type:t.type||"Temă",author:authorLabel(t),description:t.description||""}));
  schoolDaysOff.filter(v=>dateInRange(dateKey,v.start_date,v.end_date)).forEach(v=>events.push({...v,kind:v.kind,title:v.title,subject:"",type:v.kind==="vacation"?"Vacanță":"Zi liberă",author:v.author_name||"Administrator"}));
  return events;
}
function vacationForDate(dateKey){return schoolDayOffForDate(dateKey)}
function calendarMonthKey(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")}
function renderCalendar(){
  const monthEl=document.getElementById("calendarMonth"),grid=document.getElementById("calendarGrid"),weekdays=document.getElementById("calendarWeekdays");
  if(!monthEl||!grid||!weekdays)return;
  monthEl.textContent=calendarMonthFormat.format(calendarCursor).replace(/^./,m=>m.toUpperCase());
  const weekdayLabels=window.matchMedia("(max-width:600px)").matches?["Lu","Ma","Mi","Jo","Vi","Sâ","Du"]:calendarWeekdayNames;
  weekdays.innerHTML=weekdayLabels.map(x=>"<div class='calendar-weekday'>"+x+"</div>").join("");
  const first=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth(),1);
  const firstMonday=(first.getDay()+6)%7;
  const daysInMonth=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,0).getDate();
  const prevDays=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth(),0).getDate();
  let html="";
  for(let i=0;i<42;i++){
    const dayOffset=i-firstMonday;
    let cellDate;
    let outside=false;
    if(dayOffset<0){cellDate=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,prevDays+dayOffset+1);outside=true}
    else if(dayOffset>=daysInMonth){cellDate=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,dayOffset-daysInMonth+1);outside=true}
    else cellDate=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth(),dayOffset+1);
    const key=localDateKey(cellDate),events=calendarEventsForDate(key),vac=vacationForDate(key);
    const isToday=key===localDateKey(now),selectedDay=key===calendarSelectedDate;
    const cls="calendar-day"+(outside?" outside":"")+(isToday?" today":"")+(selectedDay?" selected":"")+(vac?" vacation":"");
    const chips=events.slice(0,3).map(ev=>"<span class='calendar-event-chip "+ev.kind+"'>"+escapeHtml(ev.kind==="vacation"?"Vacanță":ev.kind==="day_off"?"Zi liberă":(ev.type+" · "+ev.title))+"</span>").join("");
    const more=events.length>3?"<span class='calendar-event-chip more'>+"+(events.length-3)+" altele</span>":"";
    html+="<button type='button' class='"+cls+"' data-calendar-date='"+key+"' aria-label='"+escapeHtml(calendarDayFormat.format(cellDate))+"'><span class='calendar-day-head'><span class='calendar-day-number'>"+cellDate.getDate()+"</span><span class='calendar-day-count'>"+(events.length?events.length+" even.":"")+"</span></span><span class='calendar-events'>"+chips+more+"</span></button>";
  }
  grid.innerHTML=html;
  grid.querySelectorAll("[data-calendar-date]").forEach(btn=>btn.addEventListener("click",()=>{
    calendarSelectedDate=btn.dataset.calendarDate;
    const d=new Date(calendarSelectedDate+"T12:00:00");
    calendarCursor=new Date(d.getFullYear(),d.getMonth(),1);
    renderCalendar();
  }));
  renderCalendarSelected();
}
function renderCalendarSelected(){
  const title=document.getElementById("calendarSelectedTitle"),sub=document.getElementById("calendarSelectedSub"),box=document.getElementById("calendarSelectedEvents"),upcoming=document.getElementById("calendarUpcoming");
  if(!title||!sub||!box||!upcoming)return;
  const d=new Date(calendarSelectedDate+"T12:00:00"),events=calendarEventsForDate(calendarSelectedDate),vac=vacationForDate(calendarSelectedDate);
  title.textContent=calendarDayFormat.format(d).replace(/^./,m=>m.toUpperCase());
  sub.textContent=events.length?(events.length===1?"1 eveniment":" "+events.length+" evenimente"):"Nu există evenimente pentru această zi.";
  box.innerHTML=events.length?events.map(ev=>{
    if(ev.kind==="vacation"||ev.kind==="day_off"){const label=ev.kind==="vacation"?"Vacanță":"Zi liberă",range=ev.start_date===ev.end_date?fmtDate(ev.start_date):fmtDate(ev.start_date)+" – "+fmtDate(ev.end_date);return "<article class='calendar-detail "+ev.kind+"'><div class='calendar-detail-title'>"+escapeHtml(ev.title)+"</div><div class='calendar-detail-meta'>"+label+" · "+range+"</div>"+(ev.note?"<div class='calendar-detail-note'>"+escapeHtml(ev.note)+"</div>":"")+"</article>";}
    return "<article class='calendar-detail task'><div class='calendar-detail-title'>"+escapeHtml(ev.title)+"</div><div class='calendar-detail-meta'>"+escapeHtml(ev.type)+" · "+escapeHtml(ev.subject)+" · Postat de "+escapeHtml(ev.author||"Administrator")+"</div>"+(ev.description?"<div class='calendar-detail-note'>"+escapeHtml(ev.description)+"</div>":"")+"</article>";
  }).join(""):"<div class='empty'>Alege o altă zi pentru a vedea teme, proiecte sau vacanțe.</div>";
  const todayKey=localDateKey(now);
  const upcomingTasks=tasks.filter(t=>t?.deadline&&String(t.deadline)>=todayKey).slice().sort((a,b)=>String(a.deadline).localeCompare(String(b.deadline))).slice(0,6);
  upcoming.innerHTML=upcomingTasks.length?upcomingTasks.map(t=>"<div class='calendar-upcoming-item'><div class='calendar-upcoming-date'>"+escapeHtml(relativeDeadline(t.deadline))+"</div><div class='calendar-upcoming-main'><div class='calendar-upcoming-title'>"+escapeHtml(t.title)+"</div><div class='calendar-upcoming-meta'>"+escapeHtml(t.subject)+" · "+escapeHtml(t.type||"Temă")+"</div></div></div>").join(""):"<div class='empty'>Nu există deadline-uri active.</div>";
}
function moveCalendarMonth(offset){
  calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+offset,1);
  const isCurrentMonth=calendarCursor.getFullYear()===now.getFullYear()&&calendarCursor.getMonth()===now.getMonth();
  calendarSelectedDate=isCurrentMonth?localDateKey(now):localDateKey(calendarCursor);
  renderCalendar();
}
document.getElementById("calendarPrev").onclick=()=>moveCalendarMonth(-1);
document.getElementById("calendarNext").onclick=()=>moveCalendarMonth(1);
document.getElementById("calendarToday").onclick=()=>{calendarSelectedDate=localDateKey(now);calendarCursor=new Date(now.getFullYear(),now.getMonth(),1);renderCalendar()};
renderCalendar();

function closeNavigationOverlays(){
  closeComments();
  closeList();
  closeTaskImage();
  ["authOverlay","dashboardOverlay"].forEach(id=>document.getElementById(id)?.classList.remove("open"));
  document.body.style.overflow="";
}
function showChatPage(){
  closeNavigationOverlays();
  document.querySelectorAll(".dashboard-main > *").forEach(el=>{el.style.display=el.id==="chatPage"?"block":"none"});
  document.querySelector(".dashboard-main")?.scrollTo?.({top:0,behavior:"smooth"});
  window.scrollTo({top:0,behavior:"smooth"});
  loadChat();
  const state=onlineChannel?.presenceState?.()||{};
  const count=Object.values(state).flat().filter(x=>String(x?.name||"").trim()).length;
  const online=document.getElementById("chatOnlineCount");if(online)online.textContent=count+" online";
}
function showHomePage(){
  closeNavigationOverlays();
  document.querySelectorAll(".dashboard-main > *").forEach(el=>{if(el.id==="chatPage"||el.id==="calendarPage")el.style.display="none";else el.style.display=""});
}
function showCalendarPage(){
  closeNavigationOverlays();
  document.querySelectorAll(".dashboard-main > *").forEach(el=>{el.style.display=el.id==="calendarPage"?"block":"none"});
  window.scrollTo({top:0,behavior:"smooth"});
  renderCalendar();
}
document.getElementById("calendarBtn").onclick=()=>{setSideNavActive("calendar");showCalendarPage()};
document.getElementById("chatBtn").onclick=()=>{setSideNavActive("chat");showChatPage()};
document.getElementById("openAnnouncements").onclick=()=>{setSideNavActive("announcements");openList("ann")};
document.getElementById("openChanges").onclick=()=>{setSideNavActive("changes");openList("changes")};
document.getElementById("openPolls").onclick=()=>{setSideNavActive("polls");openList("polls")};
const sectionNavTargets=[["scheduleSection","schedule"],["tasksSection","tasks"],["announcementsSection","announcements"],["pollsSection","polls"],["changesSection","changes"]];
if("IntersectionObserver" in window){
  const navObserver=new IntersectionObserver(entries=>{
    const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
    if(visible){
      const hit=sectionNavTargets.find(x=>x[0]===visible.target.id);
      if(hit)setSideNavActive(hit[1]);
    }
  },{threshold:[0.15,0.35,0.55],rootMargin:"-12% 0px -55% 0px"});
  sectionNavTargets.forEach(([id])=>{const el=document.getElementById(id);if(el)navObserver.observe(el)});
}document.getElementById("listClose").onclick=closeList;document.getElementById("listOverlay").addEventListener("click",e=>{if(e.target.id==="listOverlay")closeList()});


document.getElementById("commentForm").addEventListener("submit",async e=>{
 e.preventDefault();const error=document.getElementById("error"),button=document.getElementById("send"),name=document.getElementById("name").value.trim(),message=document.getElementById("message").value.trim();
 if(document.getElementById("website").value)return;if(!selectedSubject||!name||!message){error.textContent="Completează numele și mesajul.";return}
 const last=Number(localStorage.getItem("commentCooldown")||0);if(Date.now()-last<15000){error.textContent="Așteaptă câteva secunde înainte de a posta din nou.";return}
 button.disabled=true;const r=await supabaseClient.from("comments").insert({subject:selectedSubject,name,message});button.disabled=false;
 if(r.error){error.textContent="Nu s-a putut publica. Încearcă din nou.";return}localStorage.setItem("commentCooldown",String(Date.now()));document.getElementById("message").value="";await loadComments();await render();
});

document.getElementById("adminBtn").onclick=async()=>{if(isAdmin){document.getElementById("dashboardOverlay").classList.add("open");document.body.style.overflow="hidden";await openDashboard();}else{document.getElementById("authOverlay").classList.add("open");document.body.style.overflow="hidden"}};
document.getElementById("authClose").onclick=()=>{document.getElementById("authOverlay").classList.remove("open");document.body.style.overflow=""};
document.getElementById("authForm").addEventListener("submit",e=>{e.preventDefault();authenticateAdmin()});
document.getElementById("dashboardClose").onclick=()=>{document.getElementById("dashboardOverlay").classList.remove("open");document.body.style.overflow=""};document.getElementById("logoutBtn").onclick=async()=>{await supabaseClient.auth.signOut();document.getElementById("dashboardOverlay").classList.remove("open");document.body.style.overflow="";await refreshAuth()};

// --- Admin dashboard ---
function renderAdminOverviewStats(){
  const tasksEl=document.getElementById("adminStatTasks"),annEl=document.getElementById("adminStatAnnouncements"),pollEl=document.getElementById("adminStatPolls"),onlineEl=document.getElementById("adminStatOnline"),userEl=document.getElementById("adminHeaderUser");
  if(tasksEl)tasksEl.textContent=String(tasks.filter(isTaskActive).length);
  if(annEl)annEl.textContent=String(announcements.length);
  if(pollEl)pollEl.textContent=String(polls.filter(p=>!p.closed).length);
  if(onlineEl){const state=onlineChannel?.presenceState?.()||{};onlineEl.textContent=String(Object.values(state).flat().filter(x=>String(x?.name||"").trim()).length)}
  if(userEl)userEl.textContent=(isSuperAdmin?"Super Admin":"Administrator")+" · "+(getVisitorName()||"Utilizator");
}
async function openDashboard(){
  await loadData();
  fillTaskSubjects();
  document.getElementById("adminsTab").style.display=isSuperAdmin?"inline-flex":"none";
  document.getElementById("onlineTab").style.display=isSuperAdmin?"inline-flex":"none";
  document.getElementById("siteVisitsTab").style.display=isSuperAdmin?"inline-flex":"none";
  resetPollOptionFields();
  await Promise.all([renderAdminTasks(),renderAdminChanges(),renderAdminDaysOff(),renderAdminAnnouncements(),renderAdminPolls(),renderAdminComments(),renderAdminAdmins(),renderOnlineUsers(),renderAdminSiteVisits()]);
  renderAdminOverviewStats();
}
function fillTaskSubjects(){document.getElementById("taskSubject").innerHTML=Array.from(new Set(Object.values(schedule).flat().map(x=>x[2]))).map(s=>"<option>"+escapeHtml(s)+"</option>").join("")}
function adminDelete(table,id){return supabaseClient.from(table).delete().eq("id",id)}
async function renderAdminTasks(){document.getElementById("taskList").innerHTML=tasks.length?tasks.map(t=>{
  const firstPath=Array.isArray(t.image_paths)&&t.image_paths.length?t.image_paths[0]:"";
  const thumb=firstPath?"<button type='button' class='task-preview-image-btn' onclick='openTaskImage("+JSON.stringify(firstPath)+","+JSON.stringify(t.image_paths||[])+")' aria-label='Deschide pozele'><img src='"+escapeHtml(supabaseClient.storage.from("task-images").getPublicUrl(firstPath).data.publicUrl)+"' alt='Poză pentru "+escapeHtml(t.title||"tema")+"'></button>":"";
  return "<div class='dash-item'>"+thumb+"<div class='task-admin-actions'><button class='quick' onclick='editTask("+t.id+")'>Editează</button><button class='delete-btn' onclick='removeTask("+t.id+")'>Șterge</button></div><div class='dash-item-main'><div class='dash-item-title'>"+escapeHtml(t.subject)+" — "+escapeHtml(t.title)+"</div><div class='dash-item-meta'>"+escapeHtml(t.type)+" · Deadline "+fmtDate(t.deadline)+(t.image_paths?.length?" · 📷 "+t.image_paths.length:"")+" · Postat de "+authorLabel(t)+"</div></div></div>";
}).join(""):"<div class='empty'>Nu există teme/proiecte.</div>"}
window.editTask=async id=>{
  const task=tasks.find(t=>Number(t.id)===Number(id));
  if(!task)return;
  editingTaskId=Number(task.id);
  editingTaskImagePaths=Array.isArray(task.image_paths)?task.image_paths.slice():[];
  document.getElementById("taskSubject").value=task.subject||"";
  document.getElementById("taskType").value=task.type||"Temă";
  document.getElementById("taskTitle").value=task.title||"";
  document.getElementById("taskDeadline").value=task.deadline||"";
  document.getElementById("taskDescription").value=task.description||"";
  setSelectedTaskFiles([]);
  renderExistingTaskImages();
  document.getElementById("taskSubmitBtn").textContent="Salvează modificările";
  document.getElementById("taskCancelEdit").style.display="inline-block";
  document.getElementById("taskError").textContent="";
  document.getElementById("taskTitle").scrollIntoView({behavior:"smooth",block:"center"});
};
async function renderAdminChanges(){document.getElementById("changeList").innerHTML=changes.length?changes.map(c=>{const n=normalizeChange(c),replaced=destinationOriginalSubject(c);return "<div class='dash-item'><div class='dash-item-main'><div class='dash-item-title'>"+fmtDate(n.from_date)+" · "+n.from_start+"–"+n.from_end+" → "+fmtDate(n.to_date)+" · "+n.to_start+"–"+n.to_end+"</div><div class='dash-item-meta'>"+escapeHtml(n.from_subject)+" → "+escapeHtml(n.to_subject)+(replaced&&n.from_date!==n.to_date?" · În locul: "+escapeHtml(replaced):"")+(c.note?" · "+escapeHtml(c.note):"")+" · Postat de "+authorLabel(c)+"</div></div><button class='delete-btn' onclick='removeChange("+c.id+")'>Șterge</button></div>"}).join(""):"<div class='empty'>Nu există schimbări.</div>"}
async function renderAdminDaysOff(){
  const box=document.getElementById("daysOffList");if(!box)return;
  const sorted=schoolDaysOff.slice().sort((a,b)=>String(a.start_date).localeCompare(String(b.start_date)));
  box.innerHTML=sorted.length?sorted.map(x=>{
    const label=x.kind==="vacation"?"Vacanță":"Zi liberă",range=x.start_date===x.end_date?fmtDate(x.start_date):fmtDate(x.start_date)+" – "+fmtDate(x.end_date);
    return "<div class='dash-item'><div class='dash-item-main'><div class='dash-item-title'>"+escapeHtml(x.title)+"</div><div class='dash-item-meta'>"+label+" · "+range+(x.note?" · "+escapeHtml(x.note):"")+" · Adăugat de "+escapeHtml(x.author_name||"Administrator")+"</div></div><button class='delete-btn' onclick='removeSchoolDayOff("+x.id+")'>Șterge</button></div>";
  }).join(""):"<div class='empty'>Nu există vacanțe sau zile libere adăugate.</div>";
}
async function renderAdminAnnouncements(){document.getElementById("announcementList").innerHTML=announcements.length?announcements.map(a=>"<div class='dash-item'><div class='dash-item-main'><div class='dash-item-title'>"+(a.attention?"<span style='color:#b91c1c'>[ATENȚIE] </span>":"")+escapeHtml(a.title)+"</div><div class='dash-item-meta'>"+(a.pinned?"Fixat · ":"")+formatTime(a.created_at)+" · Postat de "+authorLabel(a)+"</div></div><button class='delete-btn' onclick='removeAnnouncement("+a.id+")'>Șterge</button></div>").join(""):"<div class='empty'>Nu există anunțuri.</div>"}
function addPollOptionInput(value=""){
  const box=document.getElementById("pollOptionFields");
  if(box.children.length>=6)return;
  const row=document.createElement("div");row.className="poll-admin-option";
  row.innerHTML="<div class='field-wrap'><div class='field-label'>Varianta "+(box.children.length+1)+"</div><input class='input poll-option-input' maxlength='160' placeholder='Răspuns' value='"+escapeHtml(value)+"'></div>"+(box.children.length>=2?"<button class='poll-remove-option' type='button'>Șterge</button>":"<span></span>");
  const remove=row.querySelector(".poll-remove-option");
  if(remove)remove.onclick=()=>{row.remove();renumberPollOptions()};
  box.appendChild(row);
}
function renumberPollOptions(){
  document.querySelectorAll("#pollOptionFields .poll-admin-option").forEach((row,i)=>{const label=row.querySelector(".field-label");if(label)label.textContent="Varianta "+(i+1)});
}
function resetPollOptionFields(){
  const box=document.getElementById("pollOptionFields");if(!box)return;
  box.innerHTML="";addPollOptionInput();addPollOptionInput();
}
async function renderAdminPolls(){
  const box=document.getElementById("pollList");
  if(!box)return;
  if(!polls.length){box.innerHTML="<div class='empty'>Nu există polluri.</div>";return}
  const items=await Promise.all(polls.map(async p=>{
    const counts=await getPollResults(p.id),total=counts.reduce((sum,x)=>sum+Number(x.vote_count||0),0);
    return "<div class='dash-item'><div class='dash-item-main'><div class='dash-item-title'>"+escapeHtml(p.question)+"</div><div class='dash-item-meta'>"+(p.closed?"Închis":"Activ")+" · "+(total===1?"1 vot":total+" voturi")+" · "+formatTime(p.created_at)+" · Postat de "+authorLabel(p)+"</div></div><div style='display:flex;gap:7px;flex-wrap:wrap'>"+(p.closed?"<button class='quick' onclick='setPollClosed("+p.id+",false)'>Redeschide</button>":"<button class='quick' onclick='setPollClosed("+p.id+",true)'>Închide</button>")+"<button class='delete-btn' onclick='removePoll("+p.id+")'>Șterge</button></div></div>";
  }));
  box.innerHTML=items.join("");
}
window.setPollClosed=async(id,closed)=>{
  const r=await supabaseClient.from("polls").update({closed}).eq("id",id);
  if(r.error)return;
  await loadData();await render();await renderAdminPolls();
};
window.removePoll=async id=>{
  await adminDelete("polls",id);await loadData();await render();await renderAdminPolls();
};
document.getElementById("addPollOptionBtn").onclick=()=>addPollOptionInput();
document.getElementById("pollAdminForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const err=document.getElementById("pollError");err.textContent="";
  const question=document.getElementById("pollQuestion").value.trim();
  const inputs=[...document.querySelectorAll("#pollOptionFields .poll-option-input")];
  const options=inputs.map(x=>x.value.trim()).filter(Boolean);
  const unique=[...new Set(options)];
  if(!question){err.textContent="Scrie întrebarea.";return}
  if(unique.length<2){err.textContent="Adaugă cel puțin 2 variante.";return}
  if(unique.length>6){err.textContent="Poți avea maximum 6 variante.";return}
  if(unique.length!==options.length){err.textContent="Variantele trebuie să fie diferite.";return}
  const created=await supabaseClient.from("polls").insert({question,author_name:getVisitorName()||"Administrator"}).select("id").single();
  if(created.error){err.textContent=created.error.message;return}
  const pollId=created.data.id;
  const inserted=await supabaseClient.from("poll_options").insert(options.map((text,i)=>({poll_id:pollId,option_text:text,position:i})));
  if(inserted.error){await adminDelete("polls",pollId);err.textContent=inserted.error.message;return}
  e.target.reset();resetPollOptionFields();await loadData();await render();await renderAdminPolls();
});
resetPollOptionFields();

async function renderAdminComments(){const r=await supabaseClient.from("comments").select("id,subject,name,message,created_at").order("created_at",{ascending:false});const box=document.getElementById("adminCommentList");box.innerHTML=r.data?.length?r.data.map(c=>"<div class='dash-item'><div class='dash-item-main'><div class='dash-item-title'>"+escapeHtml(c.subject)+" — "+escapeHtml(c.name)+"</div><div class='dash-item-meta'>"+formatTime(c.created_at)+"</div><div style='margin-top:5px;white-space:pre-wrap'>"+escapeHtml(c.message)+"</div></div><button class='delete-btn' onclick='removeCommentAdmin("+c.id+")'>Șterge</button></div>").join(""):"<div class='empty'>Nu există comentarii.</div>"}
async function renderAdminAdmins(){
  const box=document.getElementById("adminList"),resetSelect=document.getElementById("resetAdminEmail");
  if(!isSuperAdmin){box.innerHTML="";resetSelect.innerHTML="";return}
  const r=await supabaseClient.from("admins").select("email,role,created_at").order("role",{ascending:true}).order("email",{ascending:true});
  if(r.error){box.innerHTML="<div class='empty'>Nu am putut încărca administratorii.</div>";resetSelect.innerHTML="";return}
  const rows=r.data||[];
  box.innerHTML=rows.length?rows.map(a=>{
    const self=currentUser?.email?.toLowerCase()===a.email.toLowerCase();
    return "<div class='dash-item'><div class='dash-item-main'><div class='dash-item-title'>"+escapeHtml(a.email)+"</div><div class='dash-item-meta'>"+(a.role==="superadmin"?"Super Admin":"Administrator")+" · "+formatTime(a.created_at)+(self?" · Tu":"")+"</div></div>"+(self?"<span class='badge'>Contul tău</span>":"<button class='delete-btn' onclick='removeAdmin("+JSON.stringify(a.email)+")'>Șterge</button>")+"</div>";
  }).join(""):"<div class='empty'>Nu există administratori.</div>";
  resetSelect.innerHTML=rows.filter(a=>a.email.toLowerCase()!=="candidoluciano2008l@gmail.com").map(a=>"<option value='"+escapeHtml(a.email)+"'>"+escapeHtml(a.email)+"</option>").join("");
}
window.removeTask=async id=>{
  const task=tasks.find(t=>Number(t.id)===Number(id));
  if(task?.image_paths?.length)await supabaseClient.storage.from("task-images").remove(task.image_paths);
  await adminDelete("tasks",id);await loadData();await render();await renderAdminTasks();
};
window.removeChange=async id=>{await adminDelete("schedule_changes",id);await loadData();await render();await renderAdminChanges()};
window.removeSchoolDayOff=async id=>{if(!isAdmin)return;const r=await adminDelete("school_days_off",id);if(r.error){document.getElementById("daysOffError").textContent="Nu s-a putut șterge. Încearcă din nou.";return}await loadData();await render();renderCalendar();await renderAdminDaysOff()};
window.removeAnnouncement=async id=>{await adminDelete("announcements",id);await loadData();await render();await renderAdminAnnouncements()};
window.removeCommentAdmin=async id=>{await adminDelete("comments",id);await loadData();await render();await renderAdminComments()};

async function callAdminAuth(action,payload={}){
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(!session?.access_token) throw new Error("Sesiunea a expirat. Autentifică-te din nou.");
  const r=await fetch(SUPABASE_URL+"/functions/v1/admin-auth",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":"Bearer "+session.access_token,
      "apikey":SUPABASE_KEY
    },
    body:JSON.stringify({action,...payload})
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok||data.error)throw new Error(data.error||"Operațiunea nu a reușit.");
  return data;
}

document.getElementById("adminManageForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!isSuperAdmin)return;
  const err=document.getElementById("adminManageError");err.textContent="";
  const email=document.getElementById("newAdminEmail").value.trim().toLowerCase();
  const password=document.getElementById("newAdminPassword").value;
  const password2=document.getElementById("newAdminPassword2").value;
  const role=document.getElementById("newAdminRole").value;
  if(!email||!document.getElementById("newAdminEmail").checkValidity()){err.textContent="Introdu o adresă de email validă.";return}
  if(password.length<8){err.textContent="Parola trebuie să aibă cel puțin 8 caractere.";return}
  if(password!==password2){err.textContent="Parolele nu coincid.";return}
  try{
    await callAdminAuth("create_user",{email,password,role});
    e.target.reset();document.getElementById("newAdminRole").value="admin";await renderAdminAdmins();
  }catch(error){err.textContent=error.message}
});

window.removeAdmin=async email=>{
  if(!isSuperAdmin||email.toLowerCase()===(currentUser?.email||"").toLowerCase())return;
  const err=document.getElementById("adminManageError");err.textContent="";
  try{await callAdminAuth("delete_user",{email});await renderAdminAdmins()}
  catch(error){err.textContent=error.message}
};

document.getElementById("resetAdminPasswordForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!isSuperAdmin)return;
  const err=document.getElementById("resetAdminPasswordError");err.textContent="";
  const email=document.getElementById("resetAdminEmail").value;
  const password=document.getElementById("resetAdminPassword").value;
  if(password.length<8){err.textContent="Parola trebuie să aibă cel puțin 8 caractere.";return}
  try{
    await callAdminAuth("set_user_password",{email,password});
    e.target.reset();
    err.textContent="Parola a fost resetată.";
    err.style.color="var(--green)";
  }catch(error){err.textContent=error.message;err.style.color="var(--danger)"}
});

document.getElementById("passwordForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const err=document.getElementById("passwordError");err.textContent="";
  const p=document.getElementById("myPassword").value,p2=document.getElementById("myPassword2").value;
  if(p.length<8){err.textContent="Parola trebuie să aibă cel puțin 8 caractere.";return}
  if(p!==p2){err.textContent="Parolele nu coincid.";return}
  try{await callAdminAuth("set_password",{password:p});e.target.reset();err.textContent="Parola a fost schimbată.";err.style.color="var(--green)"}
  catch(error){err.textContent=error.message;err.style.color="var(--danger)"}
});
document.getElementById("taskCancelEdit").onclick=()=>resetTaskEditor();
document.getElementById("taskImages").addEventListener("change",()=>{
  const input=document.getElementById("taskImages");
  const newlySelected=Array.from(input?.files||[]);
  const existing=getSelectedTaskFiles();
  const combined=existing.concat(newlySelected.filter(file=>!existing.some(x=>x.name===file.name&&x.size===file.size&&x.lastModified===file.lastModified)));
  const err=document.getElementById("taskError");
  const available=Math.max(0,5-editingTaskImagePaths.length);
  if(combined.length>available){
    setSelectedTaskFiles(combined.slice(0,available));
    if(err)err.textContent="Poți avea maximum 5 imagini.";
    return;
  }
  if(err)err.textContent="";
  setSelectedTaskFiles(combined);
  updateTaskImageLimitMessage();
});
setSelectedTaskFiles([]);
document.getElementById("taskAdminForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const err=document.getElementById("taskError"),button=document.getElementById("taskSubmitBtn"),fileInput=document.getElementById("taskImages");
 err.textContent="";
 const files=getSelectedTaskFiles();
 if(editingTaskImagePaths.length+files.length>5){err.textContent="Poți avea maximum 5 imagini.";return}
 for(const file of files){
   if(!["image/jpeg","image/png","image/webp"].includes(file.type)){err.textContent="Sunt acceptate doar JPG, PNG sau WEBP.";return}
   if(file.size>5*1024*1024){err.textContent="Fiecare imagine trebuie să aibă maximum 5 MB.";return}
 }
 button.disabled=true;
 try{
   const baseData={subject:document.getElementById("taskSubject").value,type:document.getElementById("taskType").value,title:document.getElementById("taskTitle").value.trim(),deadline:document.getElementById("taskDeadline").value,description:document.getElementById("taskDescription").value.trim()||null};
   const uploaded=[];
   let taskId=editingTaskId;
   const originalImagePaths=editingTaskId ? (tasks.find(t=>Number(t.id)===Number(editingTaskId))?.image_paths||[]).slice() : [];
   if(!taskId) {
     const created=await supabaseClient.from("tasks").insert({...baseData,image_paths:[],author_name:getVisitorName()||"Administrator"}).select("id").single();
     if(created.error)throw created.error;
     editingTaskId=Number(created.data.id);
     taskId=editingTaskId;
   }
   try{
     for(let i=0;i<files.length;i++){
       const file=files[i],ext=(file.name.split(".").pop()||"jpg").toLowerCase(),path="task/"+taskId+"/"+Date.now()+"-"+i+"-"+(window.crypto?.randomUUID?.()||Math.random().toString(36).slice(2))+"."+ext;
       const up=await supabaseClient.storage.from("task-images").upload(path,file,{contentType:file.type,upsert:false});
       if(up.error)throw up.error;
       uploaded.push(path);
     }
   }catch(uploadError){
     if(uploaded.length)await supabaseClient.storage.from("task-images").remove(uploaded);
     if(!editingTaskId||!tasks.some(t=>Number(t.id)===Number(editingTaskId)))await supabaseClient.from("tasks").delete().eq("id",taskId);
     throw uploadError;
   }
   const finalImagePaths=editingTaskImagePaths.concat(uploaded);
   const updatePayload={...baseData,image_paths:finalImagePaths};
   if(editingTaskId && tasks.some(t=>Number(t.id)===Number(editingTaskId))){
     const updated=await supabaseClient.from("tasks").update(updatePayload).eq("id",taskId);
     if(updated.error){
       if(uploaded.length)await supabaseClient.storage.from("task-images").remove(uploaded);
       throw updated.error;
     }
     const removed=originalImagePaths.filter(path=>!finalImagePaths.includes(path));
     if(removed.length)await supabaseClient.storage.from("task-images").remove(removed);
   }else{
     const updated=await supabaseClient.from("tasks").update(updatePayload).eq("id",taskId);
     if(updated.error){
       if(uploaded.length)await supabaseClient.storage.from("task-images").remove(uploaded);
       await supabaseClient.from("tasks").delete().eq("id",taskId);
       throw updated.error;
     }
   }
   e.target.reset();document.getElementById("taskType").value="Temă";setSelectedTaskFiles([]);
   resetTaskEditor();
   await loadData();await render();await renderAdminTasks();
 }catch(error){
   err.textContent=error?.message||"Nu s-a putut adăuga tema/proiectul.";
 }finally{
   button.disabled=false;
 }
});
function intervalOptionsForDate(dateValue){
  if(!dateValue)return [];
  const weekday=names[new Date(dateValue+"T12:00:00").getDay()];
  return schedule[weekday]||[];
}
function populateIntervalSelect(id,dateValue,preferred=""){
  const select=document.getElementById(id),arr=intervalOptionsForDate(dateValue);
  select.innerHTML=arr.length
    ? arr.map(x=>"<option value='"+x[0]+"|"+x[1]+"'"+(preferred===x[0]+"|"+x[1]?" selected":"")+">"+x[0]+"–"+x[1]+"</option>").join("")
    : "<option value=''>Nu există ore pentru această zi</option>";
}
function getIntervalValue(id){
  const v=document.getElementById(id).value||"";
  const [start,end]=v.split("|");
  return {start:start||"",end:end||""};
}
function populateFromSubjects(){
  const date=document.getElementById("fromDate").value,arr=intervalOptionsForDate(date);
  const interval=getIntervalValue("fromInterval");
  const lesson=arr.find(x=>x[0]===interval.start&&x[1]===interval.end);
  document.getElementById("fromSubject").value=lesson?lesson[2]:"";
}
function populateChangeSubjects(){
  const subjects=Array.from(new Set(Object.values(schedule).flat().map(x=>x[2])));
  document.getElementById("toSubject").innerHTML=subjects.map(s=>"<option value='"+escapeHtml(s)+"'>"+escapeHtml(s)+"</option>").join("");
}
function updateDestinationPreview(){
  const preview=document.getElementById("toOriginalSubjectPreview");
  if(!preview)return;
  if(document.getElementById("changeType").value!=="move"){preview.value="";return}
  const date=document.getElementById("toDate").value;
  const {start,end}=getIntervalValue("toInterval");
  preview.value=baseSubjectForDateInterval(date,start,end)||"(interval liber în orarul normal)";
}
function refreshChangeIntervals(){
  populateIntervalSelect("fromInterval",document.getElementById("fromDate").value);
  populateIntervalSelect("toInterval",document.getElementById("toDate").value);
  populateFromSubjects();
  updateDestinationPreview();
}
function findSubjectForSelectedInterval(){
  populateFromSubjects();
  const subject=document.getElementById("fromSubject").value||"";
  if(document.getElementById("changeType").value==="move")document.getElementById("toSubject").value=subject;
}
document.getElementById("changeType").addEventListener("change",()=>{
  const move=document.getElementById("changeType").value==="move";
  document.getElementById("moveTargetFields").style.display=move?"block":"none";
  document.getElementById("replaceTargetFields").style.display=move?"none":"block";
  document.getElementById("toDate").required=move;
  document.getElementById("toInterval").required=move;
  document.getElementById("toSubject").required=!move;
  if(move)document.getElementById("toDate").value=localDateKey(now);
  refreshChangeIntervals();
  findSubjectForSelectedInterval();
});
document.getElementById("fromDate").value=localDateKey(now);
document.getElementById("toDate").value=localDateKey(now);
document.getElementById("fromDate").addEventListener("change",()=>{refreshChangeIntervals();findSubjectForSelectedInterval()});
document.getElementById("toDate").addEventListener("change",()=>{populateIntervalSelect("toInterval",document.getElementById("toDate").value);updateDestinationPreview()});
document.getElementById("toInterval").addEventListener("change",updateDestinationPreview);
document.getElementById("fromInterval").addEventListener("change",()=>{populateFromSubjects();findSubjectForSelectedInterval()});
populateChangeSubjects();refreshChangeIntervals();findSubjectForSelectedInterval();

document.getElementById("changeAdminForm").addEventListener("submit",async e=>{
 e.preventDefault();const err=document.getElementById("changeError");err.textContent="";
 const type=document.getElementById("changeType").value;
 const fromDate=document.getElementById("fromDate").value;
 const fromInterval=getIntervalValue("fromInterval");
 const fromSubject=document.getElementById("fromSubject").value;
 const toDate=type==="move"?document.getElementById("toDate").value:fromDate;
 const toInterval=type==="move"?getIntervalValue("toInterval"):fromInterval;
 const toSubject=type==="move"?document.getElementById("fromSubject").value.trim():document.getElementById("toSubject").value.trim();
 if(!fromDate||!fromInterval.start||!fromInterval.end||!fromSubject||!toDate||!toInterval.start||!toInterval.end||!toSubject){err.textContent="Completează toate câmpurile necesare.";return}
 if(type==="move"&&fromDate===toDate&&fromInterval.start===toInterval.start&&fromInterval.end===toInterval.end){err.textContent="Pentru o mutare, intervalul nou trebuie să fie diferit.";return}
 const destinationOriginal = type==="move" ? baseSubjectForDateInterval(toDate,toInterval.start,toInterval.end) : "";
 const r=await supabaseClient.from("schedule_changes").insert({
   change_type:type,from_date:fromDate,from_start_time:fromInterval.start,from_end_time:fromInterval.end,from_subject:fromSubject,
   to_date:toDate,to_start_time:toInterval.start,to_end_time:toInterval.end,to_subject:toSubject,to_original_subject:destinationOriginal||null,
   change_date:fromDate,start_time:fromInterval.start,end_time:fromInterval.end,original_subject:fromSubject,replacement_subject:toSubject,
   note:document.getElementById("changeNote").value.trim()||null,author_name:getVisitorName()||"Administrator"
 });
 if(r.error){err.textContent=r.error.message;return}
 e.target.reset();
 document.getElementById("changeType").value="replace";
 document.getElementById("moveTargetFields").style.display="none";
 document.getElementById("fromDate").value=localDateKey(now);
 document.getElementById("toDate").value=localDateKey(now);
 refreshChangeIntervals();populateChangeSubjects();findSubjectForSelectedInterval();
 await loadData();await render();await renderAdminChanges();
});
document.getElementById("announcementAdminForm").addEventListener("submit",async e=>{
 e.preventDefault();const err=document.getElementById("announcementError");err.textContent="";
 const r=await supabaseClient.from("announcements").insert({title:document.getElementById("announcementTitle").value.trim(),message:document.getElementById("announcementMessage").value.trim(),pinned:document.getElementById("announcementPinned").checked,attention:document.getElementById("announcementAttention").checked,author_name:getVisitorName()||"Administrator"});
 if(r.error){err.textContent=r.error.message;return}e.target.reset();await loadData();await render();await renderAdminAnnouncements();
});
function updateDaysOffFormKind(){
  const isVacation=document.getElementById("daysOffKind").value==="vacation",endWrap=document.getElementById("daysOffEndWrap"),end=document.getElementById("daysOffEnd");
  endWrap.style.display=isVacation?"":"none";end.required=isVacation;
  document.getElementById("daysOffStartLabel").textContent=isVacation?"Data de început":"Data";
  document.getElementById("daysOffTitle").placeholder=isVacation?"Ex.: Vacanța de iarnă":"Ex.: Zi liberă de Sf. Andrei";
}
document.getElementById("daysOffKind").addEventListener("change",updateDaysOffFormKind);
updateDaysOffFormKind();
document.getElementById("daysOffAdminForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const err=document.getElementById("daysOffError"),button=document.getElementById("daysOffSubmit"),kind=document.getElementById("daysOffKind").value;
  const title=document.getElementById("daysOffTitle").value.trim(),startDate=document.getElementById("daysOffStart").value,endDate=kind==="vacation"?document.getElementById("daysOffEnd").value:startDate,note=document.getElementById("daysOffNote").value.trim();
  err.textContent="";
  if(!title||!startDate||!endDate){err.textContent="Completează denumirea și data sau perioada.";return}
  if(endDate<startDate){err.textContent="Data de sfârșit trebuie să fie cel puțin egală cu data de început.";return}
  button.disabled=true;
  const r=await supabaseClient.from("school_days_off").insert({kind,title,start_date:startDate,end_date:endDate,note:note||null,author_name:getVisitorName()||"Administrator"});
  button.disabled=false;
  if(r.error){err.textContent="Nu s-a putut salva. Verifică datele și încearcă din nou.";return}
  e.target.reset();updateDaysOffFormKind();await loadData();await render();renderCalendar();await renderAdminDaysOff();
});
document.querySelectorAll(".dash-tab").forEach(btn=>btn.onclick=()=>{
  if((btn.id==="adminsTab"||btn.id==="onlineTab"||btn.id==="siteVisitsTab")&&!isSuperAdmin)return;
  document.querySelectorAll(".dash-tab").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".dash-panel").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active");document.getElementById(btn.dataset.panel).classList.add("active");
});

// --- Realtime subscriptions ---
supabaseClient.auth.onAuthStateChange(async()=>{await refreshAuth()});
supabaseClient.channel("school-live").on("postgres_changes",{event:"*",schema:"public",table:"comments"},async()=>{await render();if(selectedSubject)await loadComments();showLiveToast("Comentariu nou")}).on("postgres_changes",{event:"*",schema:"public",table:"chat_messages"},async()=>{if(document.getElementById("chatPage")?.style.display!=="none"){await loadChat();showLiveToast("Mesaj nou în chat")}}).on("postgres_changes",{event:"*",schema:"public",table:"tasks"},async()=>{await loadData();await render();if(document.getElementById("calendarPage")?.style.display!=="none")renderCalendar();if(isAdmin)renderAdminOverviewStats();showLiveToast("Temă sau proiect nou")}).on("postgres_changes",{event:"*",schema:"public",table:"schedule_changes"},async()=>{await loadData();await render();if(isAdmin)renderAdminOverviewStats();showLiveToast("Schimbare de orar")}).on("postgres_changes",{event:"*",schema:"public",table:"announcements"},async()=>{await loadData();await render();if(isAdmin)renderAdminOverviewStats();showLiveToast("Anunț nou")})
.on("postgres_changes",{event:"*",schema:"public",table:"polls"},async()=>{await loadData();await render();if(isAdmin)await renderAdminPolls();showLiveToast("Poll nou")})
.on("postgres_changes",{event:"*",schema:"public",table:"school_days_off"},async()=>{await loadData();await render();if(document.getElementById("calendarPage")?.style.display!=="none")renderCalendar();if(isAdmin)await renderAdminDaysOff()})
.on("postgres_changes",{event:"*",schema:"public",table:"poll_votes"},async()=>{await loadData();await render();if(isAdmin){await renderAdminPolls();renderAdminOverviewStats()}}).subscribe();


if("serviceWorker" in navigator){
  window.addEventListener("load",async()=>{
    try{
      const registration=await navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"});
      registration.update().catch(()=>{});
      updatePushButton();

    }catch(_){}
  });
}

const welcomeDateFormat=new Intl.DateTimeFormat("ro-RO",{day:"numeric",month:"long",year:"numeric"});
const welcomeDayFormat=new Intl.DateTimeFormat("ro-RO",{weekday:"long"});
// --- Visit history and online presence ---
async function renderAdminSiteVisits(){
  const countEl=document.getElementById("siteVisitCount"),listEl=document.getElementById("siteVisitsList");
  if(!countEl||!listEl)return;
  if(!isSuperAdmin){listEl.innerHTML="<div class='empty'>Istoricul este disponibil doar pentru Super Admin.</div>";return}
  listEl.innerHTML="<div class='empty'>Se încarcă istoricul…</div>";
  const {data,error}=await supabaseClient.from("site_visits").select("visitor_name,visited_at").order("visited_at",{ascending:false}).limit(100);
  if(error){countEl.textContent="—";listEl.innerHTML="<div class='empty'>Nu s-a putut încărca istoricul vizitelor.</div>";return}
  const visits=Array.isArray(data)?data:[];
  countEl.textContent=String(visits.length);
  const formatVisitTime=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?"Oră necunoscută":new Intl.DateTimeFormat("ro-RO",{dateStyle:"medium",timeStyle:"short"}).format(date)};
  listEl.innerHTML=visits.length?visits.map(visit=>"<div class='dash-item site-visit-row'><div class='dash-item-main'><div class='dash-item-title'>"+escapeHtml(visit.visitor_name||"Vizitator")+"</div><div class='dash-item-meta'>"+escapeHtml(formatVisitTime(visit.visited_at))+"</div></div></div>").join(""):"<div class='empty'>Nu există vizite înregistrate.</div>";
}
document.getElementById("refreshSiteVisits")?.addEventListener("click",renderAdminSiteVisits);

async function renderOnlineUsers(){
  const countEl=document.getElementById("onlineCount"),listEl=document.getElementById("onlineUserList");
  if(!countEl||!listEl||!onlineChannel){if(countEl)countEl.textContent="0";if(listEl)listEl.innerHTML="<div class='empty'>Se conectează lista de utilizatori…</div>";return}
  const state=onlineChannel.presenceState();
  const users=[];
  Object.values(state||{}).flat().forEach(meta=>{
    const name=String(meta?.name||"").trim();
    if(name)users.push({name,since:meta.since||null});
  });
  users.sort((a,b)=>a.name.localeCompare(b.name,"ro",{sensitivity:"base"}));
  countEl.textContent=String(users.length);
  const statOnline=document.getElementById("adminStatOnline");if(statOnline)statOnline.textContent=String(users.length);
  const chatOnline=document.getElementById("chatOnlineCount");if(chatOnline)chatOnline.textContent=String(users.length)+" online";
  listEl.innerHTML=users.length?users.map(u=>"<div class='online-user'><span class='online-dot'></span><div class='online-user-name'>"+escapeHtml(u.name)+"</div><div class='online-user-meta'>Online</div></div>").join(""):"<div class='empty'>Nu este nimeni online.</div>";
}
async function startOnlinePresence(){
  const name=getVisitorName();
  if(!name||onlineChannel)return;
  onlineChannel=supabaseClient.channel("online-users",{config:{presence:{key:onlineSessionId}}});
  onlineChannel.on("presence",{event:"sync"},()=>renderOnlineUsers());
  onlineChannel.on("presence",{event:"join"},()=>renderOnlineUsers());
  onlineChannel.on("presence",{event:"leave"},()=>renderOnlineUsers());
  onlineChannel.subscribe(async status=>{
    if(status==="SUBSCRIBED"){
      await onlineChannel.track({name,since:new Date().toISOString()});
      await renderOnlineUsers();
    }
  });
}
async function recordSiteVisit(name){
  if(!name||!onlineSessionId||sessionStorage.getItem("siteVisitRecorded")==="1")return;
  const {error}=await supabaseClient.from("site_visits").insert({session_id:onlineSessionId,visitor_name:name});
  if(!error||error.code==="23505")sessionStorage.setItem("siteVisitRecorded","1");
}
function unlockSite(name){
  const clean=String(name||"").trim().replace(/\s+/g," ");
  recordSiteVisit(clean);
  localStorage.setItem("visitorName",clean);
  localStorage.setItem("chatName",clean);
  document.body.classList.remove("site-locked");
  document.getElementById("nameGate").classList.add("hidden");
  const chatName=document.getElementById("chatName");if(chatName)chatName.value=clean;
  renderVisitorBadge();
  startOnlinePresence();
}
function initNameGate(){
  const gate=document.getElementById("nameGate"),input=document.getElementById("visitorName"),form=document.getElementById("nameGateForm"),err=document.getElementById("nameGateError");
  const saved=getVisitorName();
  if(saved){unlockSite(saved);return}
  document.body.classList.add("site-locked");
  gate.classList.remove("hidden");
  setTimeout(()=>input.focus(),50);
  form.addEventListener("submit",e=>{
    e.preventDefault();err.textContent="";
    const clean=input.value.trim().replace(/\s+/g," ");
    if(clean.length<2){err.textContent="Introdu cel puțin 2 caractere.";return}
    unlockSite(clean);
  });
}
initNameGate();
// --- Startup and initial render ---
const startupStartedAt=performance.now();
let startupSplashFinishing=false;
function finishStartupSplash(message=""){
  if(startupSplashFinishing)return;
  startupSplashFinishing=true;
  const caption=document.getElementById("startupCaption");
  if(message&&caption)caption.textContent=message;
  const minimumDuration=message?1150:850;
  const remaining=Math.max(0,minimumDuration-(performance.now()-startupStartedAt));
  window.setTimeout(()=>document.getElementById("startupSplash")?.classList.add("is-done"),remaining);
}
const startupFallback=window.setTimeout(()=>finishStartupSplash("Conexiune lentă · se încarcă în fundal"),12000);
document.getElementById("date").textContent=welcomeDateFormat.format(now);
document.getElementById("dayLabel").textContent=today;
document.getElementById("welcomeDay").textContent=welcomeDayFormat.format(now);
document.getElementById("welcomeDate").textContent=welcomeDateFormat.format(now);
setSideNavActive("home");
async function initializeApp(){
  const [authResult,dataResult]=await Promise.allSettled([refreshAuth(),loadData()]);
  renderTabs();
  await render();
  renderCalendar();
  window.clearTimeout(startupFallback);
  const hasLoadError=authResult.status==="rejected"||dataResult.status==="rejected"||dataResult.value===false;
  finishStartupSplash(hasLoadError?"Unele informații nu s-au încărcat":"");
}
initializeApp().catch(error=>{
  console.error("Aplicația nu a putut finaliza încărcarea inițială.",error);
  window.clearTimeout(startupFallback);
  finishStartupSplash("Nu s-au putut încărca toate informațiile");
});
setInterval(()=>{now=new Date();today=names[now.getDay()];document.getElementById("date").textContent=welcomeDateFormat.format(now);document.getElementById("dayLabel").textContent=today;document.getElementById("welcomeDay").textContent=welcomeDayFormat.format(now);document.getElementById("welcomeDate").textContent=welcomeDateFormat.format(now);renderSchoolState();updateCurrentLessonHighlight()},1000);
setInterval(()=>{now=new Date();today=names[now.getDay()];document.getElementById("date").textContent=welcomeDateFormat.format(now);document.getElementById("dayLabel").textContent=today;document.getElementById("welcomeDay").textContent=welcomeDayFormat.format(now);document.getElementById("welcomeDate").textContent=welcomeDateFormat.format(now);renderTabs();render();if(document.getElementById("calendarPage")?.style.display!=="none")renderCalendar();},30000);

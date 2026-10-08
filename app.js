const API_URL="https://license-api.amyratfy8.workers.dev";
const JWT_KEY="admin_jwt";
const TIMEOUT=12000;

function getJWT(){
  return sessionStorage.getItem(JWT_KEY);
}

function setJWT(t){
  sessionStorage.setItem(JWT_KEY,t);
}

function clearJWT(){
  sessionStorage.removeItem(JWT_KEY);
}

async function api(path,options={}){

  const controller=new AbortController();

  const timer=setTimeout(
    ()=>controller.abort(),
    TIMEOUT
  );

  const headers={
    "Content-Type":"application/json",
    ...(options.headers||{})
  };

  const jwt=getJWT();

  if(jwt){
    headers.Authorization="Bearer "+jwt;
  }

  try{

    const response=await fetch(
      API_URL+path,
      {
        ...options,
        headers,
        signal:controller.signal,
        cache:"no-store"
      }
    );

    const text=await response.text();

    let data;

    try{
      data=text?JSON.parse(text):{};
    }catch{
      data={ok:response.ok,raw:text};
    }

    if(!response.ok){
      throw new Error(
        data?.error||
        data?.message||
        data?.raw||
        "HTTP "+response.status
      );
    }

    return data;

  }catch(e){

    if(e.name==="AbortError"){
      throw new Error(
        "Worker پاسخ نداد و Timeout شد."
      );
    }

    if(e instanceof TypeError){
      throw new Error(
        "اتصال به Worker برقرار نشد؛ CORS یا URL را بررسی کن."
      );
    }

    throw e;

  }finally{
    clearTimeout(timer);
  }
}


/* LOGIN */

async function login(event){

  event.preventDefault();

  const input=
    document.getElementById("password");

  const button=
    document.getElementById("loginButton");

  const message=
    document.getElementById("loginMessage");

  const password=input.value;

  if(!password){
    message.textContent=
      "رمز عبور را وارد کنید.";
    return;
  }

  button.disabled=true;
  button.textContent="در حال ورود...";
  message.style.color="#8fa3b8";
  message.textContent=
    "در حال اتصال به Worker...";

  try{

    const result=await api(
      "/admin/login",
      {
        method:"POST",
        body:JSON.stringify({password})
      }
    );

    if(!result.ok){
      throw new Error(
        result.error||"Login failed."
      );
    }

    if(!result.token){
      throw new Error(
        "JWT دریافت نشد."
      );
    }

    setJWT(result.token);

    message.style.color="#21c77a";
    message.textContent=
      "ورود موفق بود...";

    window.location.replace(
      "dashboard.html?v="+Date.now()
    );

  }catch(e){

    clearJWT();

    message.style.color="#ff6b6b";
    message.textContent=
      e.message||"خطای ورود";

  }finally{

    button.disabled=false;
    button.textContent="Login";
  }
}


/* AUTH */

function requireAuth(){

  if(!getJWT()){
    location.replace(
      "index.html?v="+Date.now()
    );
    return false;
  }

  return true;
}

function logout(){

  clearJWT();

  location.replace(
    "index.html?v="+Date.now()
  );
}


/* SECTIONS */

function showSection(name){

  for(const n of [
    "dashboard",
    "licenses",
    "content",
    "logs"
  ]){

    const el=
      document.getElementById(
        "section-"+n
      );

    if(!el)continue;

    el.classList.toggle(
      "hidden",
      n!==name
    );
  }

  if(name==="dashboard")loadStats();
  if(name==="licenses")loadLicenses();
  if(name==="logs")loadLogs();
}


/* STATS */

async function loadStats(){

  try{

    const result=await api(
      "/admin/list-licenses",
      {
        method:"POST",
        body:"{}"
      }
    );

    const list=
      Array.isArray(result)
        ? result
        : result.licenses||[];

    const now=
      Math.floor(Date.now()/1000);

    let active=0;
    let expired=0;

    for(const x of list){

      if(Number(x.is_active)!==1)
        continue;

      if(
        Number(x.expires_at)>0 &&
        Number(x.expires_at)<now
      ){
        expired++;
      }else{
        active++;
      }
    }

    const a=document.getElementById("statActive");
    const t=document.getElementById("statTotal");
    const e=document.getElementById("statExpired");

    if(a)a.textContent=active;
    if(t)t.textContent=list.length;
    if(e)e.textContent=expired;

  }catch(e){
    console.error(e);
  }
}


/* LICENSES */

async function loadLicenses(){

  const table=
    document.getElementById(
      "licensesTable"
    );

  if(!table)return;

  table.innerHTML=
    "<tr><td colspan='8'>در حال دریافت...</td></tr>";

  try{

    const result=await api(
      "/admin/list-licenses",
      {
        method:"POST",
        body:"{}"
      }
    );

    const list=
      Array.isArray(result)
        ? result
        : result.licenses||[];

    table.innerHTML="";

    if(!list.length){

      table.innerHTML=
        "<tr><td colspan='8'>لیسنسی وجود ندارد.</td></tr>";

      return;
    }

    for(const x of list){

      const tr=
        document.createElement("tr");

      const exp=
        Number(x.expires_at||0);

      const status=
        Number(x.is_active)!==1
          ?"غیرفعال"
          :(
            exp>0 &&
            exp<Math.floor(Date.now()/1000)
              ?"منقضی"
              :"فعال"
          );

      const expText=
        exp===0
          ?"بدون انقضا"
          :new Date(
            exp*1000
          ).toLocaleString();

      tr.innerHTML=`
<td>${esc(x.id)}</td>
<td class="token-cell"><code>${esc(x.token)}</code></td>
<td>${esc(x.owner_name)}</td>
<td>${esc(status)}</td>
<td>${esc(expText)}</td>
<td>${esc(x.hwid_locked||"آزاد")}</td>
<td>${esc(x.total_requests||0)}</td>
<td>
<button class="danger-btn"
onclick="revokeLicense('${attr(x.token)}')">
لغو
</button>
</td>`;

      table.appendChild(tr);
    }

  }catch(e){

    table.innerHTML=
      "<tr><td colspan='8'>"+
      esc(e.message)+
      "</td></tr>";
  }
}


/* CREATE LICENSE */

async function createLicense(event){

  event.preventDefault();

  const owner=
    document.getElementById("ownerName");

  const days=
    document.getElementById("expiresDays");

  const message=
    document.getElementById(
      "licenseMessage"
    );

  try{

    message.style.color="#8fa3b8";
    message.textContent=
      "در حال ساخت...";

    const result=await api(
      "/admin/create-license",
      {
        method:"POST",
        body:JSON.stringify({
          owner_name:owner.value.trim(),
          expires_days:Number(days.value)
        })
      }
    );

    message.style.color="#21c77a";
    message.textContent=
      "ساخته شد:\n"+
      result.token;

    owner.value="";

    await loadLicenses();
    await loadStats();

  }catch(e){

    message.style.color="#ff4d6d";
    message.textContent=e.message;
  }
}


/* REVOKE */

async function revokeLicense(token){

  if(!confirm("این لایسنس غیرفعال شود؟"))
    return;

  try{

    await api(
      "/admin/revoke-license",
      {
        method:"POST",
        body:JSON.stringify({token})
      }
    );

    await loadLicenses();
    await loadStats();

  }catch(e){

    alert(e.message);
  }
}


/* CONTENT */

async function loadContent(){

  const key=
    document.getElementById(
      "contentKey"
    ).value.trim();

  const editor=
    document.getElementById(
      "contentEditor"
    );

  const message=
    document.getElementById(
      "contentMessage"
    );

  try{

    message.textContent=
      "در حال دریافت...";

    const result=await api(
      "/admin/get-content",
      {
        method:"POST",
        body:JSON.stringify({
          key_name:key
        })
      }
    );

    editor.value=result.content||"";

    message.style.color="#21c77a";
    message.textContent=
      "محتوا دریافت شد.";

  }catch(e){

    message.style.color="#ff4d6d";
    message.textContent=e.message;
  }
}

async function saveContent(){

  const key=
    document.getElementById(
      "contentKey"
    ).value.trim();

  const content=
    document.getElementById(
      "contentEditor"
    ).value;

  const message=
    document.getElementById(
      "contentMessage"
    );

  try{

    message.textContent=
      "در حال ذخیره...";

    await api(
      "/admin/update-content",
      {
        method:"POST",
        body:JSON.stringify({
          key_name:key,
          content
        })
      }
    );

    message.style.color="#21c77a";
    message.textContent=
      "محتوا ذخیره شد.";

  }catch(e){

    message.style.color="#ff4d6d";
    message.textContent=e.message;
  }
}


/* LOGS */

async function loadLogs(){

  const table=
    document.getElementById(
      "logsTable"
    );

  if(!table)return;

  try{

    const result=await api(
      "/admin/logs",
      {
        method:"POST",
        body:JSON.stringify({
          count:100
        })
      }
    );

    const list=
      Array.isArray(result)
        ?result
        :result.logs||[];

    table.innerHTML="";

    for(const x of list){

      const tr=
        document.createElement("tr");

      const time=
        x.timestamp
          ?new Date(
            Number(x.timestamp)*1000
          ).toLocaleString()
          :"-";

      tr.innerHTML=`
<td>${esc(x.id)}</td>
<td>${esc(x.token||"-")}</td>
<td>${esc(x.ip||"-")}</td>
<td>${esc(x.action||"-")}</td>
<td>${esc(time)}</td>
<td>${esc(x.user_agent||"-")}</td>`;

      table.appendChild(tr);
    }

    const n=
      document.getElementById(
        "statLogs"
      );

    if(n)n.textContent=list.length;

  }catch(e){

    table.innerHTML=
      "<tr><td colspan='6'>"+
      esc(e.message)+
      "</td></tr>";
  }
}


/* ALL */

async function loadAll(){
  await loadStats();
  await loadLicenses();
  await loadLogs();
}


/* HELPERS */

function esc(v){

  const d=
    document.createElement("div");

  d.textContent=String(v??"");

  return d.innerHTML;
}

function attr(v){

  return String(v??"")
    .replace(/\\/g,"\\\\")
    .replace(/'/g,"\\'");
}


/* INIT */

function init(){

  const loginForm=
    document.getElementById(
      "loginForm"
    );

  if(loginForm){

    loginForm.addEventListener(
      "submit",
      login
    );

    return;
  }

  const dashboard=
    document.getElementById(
      "section-dashboard"
    );

  if(dashboard){

    if(!requireAuth())
      return;

    const form=
      document.getElementById(
        "createLicenseForm"
      );

    if(form){
      form.addEventListener(
        "submit",
        createLicense
      );
    }

    showSection("dashboard");
    loadAll();
  }
}

if(document.readyState==="loading"){
  document.addEventListener(
    "DOMContentLoaded",
    init
  );
}else{
  init();
}

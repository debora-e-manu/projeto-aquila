const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);
const API="/api";
let historyData=[], alertsData=[], configData={}, chartRange=24;

async function api(path, options={}) {
  const r=await fetch(API+path,{headers:{"Content-Type":"application/json"},...options});
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2500)}
function fmtTime(iso){if(!iso)return"--:--:--";return new Date(iso).toLocaleTimeString("pt-BR")}
function nav(page){
  $$(".page").forEach(x=>x.classList.remove("active")); $("#"+page).classList.add("active");
  $$(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
  const titles={dashboard:"Visão Geral",historico:"Histórico",graficos:"Gráficos",alertas:"Alertas",config:"Configurações"};
  $("#pageTitle").textContent=titles[page];
  if(page==="historico")renderHistory();
  if(page==="graficos")renderBigChart();
  if(page==="alertas")renderAlerts();
}
$$(".nav-item").forEach(b=>b.onclick=()=>nav(b.dataset.page));
$$("[data-page-target]").forEach(b=>b.onclick=()=>nav(b.dataset.pageTarget));

function drawChart(canvas, data){
  const c=canvas,ctx=c.getContext("2d"),dpr=devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;
  c.width=w*dpr;c.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
  if(!data.length)return;
  const vals=data.map(x=>Number(x.nivel)), min=Math.min(...vals),max=Math.max(...vals), pad=22;
  ctx.strokeStyle="#17324b";ctx.lineWidth=1;
  for(let i=0;i<4;i++){let y=pad+i*(h-pad*2)/3;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(w-pad,y);ctx.stroke()}
  ctx.strokeStyle="#32a8ff";ctx.lineWidth=3;ctx.beginPath();
  data.forEach((p,i)=>{let x=pad+i*(w-pad*2)/Math.max(1,data.length-1);let y=h-pad-((p.nivel-min)/Math.max(1,max-min))*(h-pad*2);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});
  ctx.stroke();
  ctx.lineTo(w-pad,h-pad);ctx.lineTo(pad,h-pad);ctx.closePath();ctx.globalAlpha=.08;ctx.fillStyle="#32a8ff";ctx.fill();ctx.globalAlpha=1;
}
function renderMainChart(){drawChart($("#levelChart"),historyData.slice(-24))}
function renderBigChart(){
  const data=chartRange===24?historyData.slice(-24):historyData;
  drawChart($("#bigChart"),data);
  if(data.length){const v=data.map(x=>+x.nivel);$("#avgLevel").textContent=(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1)+"%";$("#minLevel").textContent=Math.min(...v).toFixed(0)+"%";$("#maxLevel").textContent=Math.max(...v).toFixed(0)+"%"}
}
function renderHistory(){
  const q=$("#historySearch").value.toLowerCase();
  $("#historyBody").innerHTML=historyData.slice().reverse().filter(x=>JSON.stringify(x).toLowerCase().includes(q)).map(x=>`
  <tr><td>${new Date(x.timestamp).toLocaleString("pt-BR")}</td><td>${x.nivel.toFixed(1)}%</td><td>${x.volume.toFixed(0)} L</td><td>${x.vazao.toFixed(1)} L/min</td><td>${x.sensor}</td></tr>`).join("");
}
function renderAlerts(){
  $("#alertsList").innerHTML=alertsData.map(a=>`<div class="alert ${a.lida?"":"unread"}"><div class="alert-icon">!</div><div><div class="alert-title">${a.titulo}</div><small>${a.mensagem} • ${new Date(a.timestamp).toLocaleString("pt-BR")}</small></div></div>`).join("") || "<p style='color:#66809a'>Nenhum alerta registrado.</p>";
  const unread=alertsData.filter(a=>!a.lida).length;$("#alertBadge").textContent=unread;$("#alertBadge").style.display=unread?"block":"none";
}
function applyStatus(s){

  // =========================
  // RESERVATÓRIO 1
  // =========================

  const nivel1 = Number(s.nivel1 || 0);

  const percentual1 =
    Math.max(0, Math.min(100, (nivel1 / 20) * 100));

  $("#levelPercent1").textContent =
    percentual1.toFixed(0) + "%";

  $("#waterFill1").style.height =
    percentual1 + "%";

  $("#tankLabel1").textContent =
    nivel1.toFixed(2) + " cm";

  $("#volumeValue1").textContent =
    nivel1.toFixed(2) + " cm";


  // =========================
  // RESERVATÓRIO 2
  // =========================

  const nivel2 = Number(s.nivel2 || 0);

  const percentual2 =
    Math.max(0, Math.min(100, (nivel2 / 10) * 100));

  $("#levelPercent2").textContent =
    percentual2.toFixed(0) + "%";

  $("#waterFill2").style.height =
    percentual2 + "%";

  $("#tankLabel2").textContent =
    nivel2.toFixed(2) + " cm";

  $("#volumeValue2").textContent =
    nivel2.toFixed(2) + " cm";


  // =========================
  // OUTRAS INFORMAÇÕES
  // =========================

  $("#flowValue").textContent =
    Number(s.vazao || 0).toFixed(1) + " L/min";

  $("#sensorValue").textContent =
    s.sensor ? s.sensor.toUpperCase() : "ATIVO";



  
}
async function loadAll(){
  try{
    const s = await api("/status");
    const h = await api("/historico");
    const a = await api("/alertas");
    const c = await api("/configuracoes");
    configData=c;
historyData=h;
alertsData=a;

applyStatus(s);

$("#apiDot").style.background="#27d17f";
$("#apiText").textContent="API conectada";
    $("#apiDot").style.background="#27d17f";$("#apiText").textContent="API conectada";
  }catch(e){
  console.error("ERRO NO PAINEL:", e);
  $("#apiDot").style.background="#e35b67";
  $("#apiDot").style.boxShadow="0 0 10px #e35b67";
  $("#apiText").textContent="API offline";
  }
}
$("#refreshBtn").onclick=async()=>{await loadAll();toast("Dados atualizados")};
$("#historySearch").oninput=renderHistory;
$("#exportBtn").onclick=()=>{const rows=[["timestamp","nivel","volume","vazao","bomba","sensor"],...historyData.map(x=>[x.timestamp,x.nivel,x.volume,x.vazao,x.sensor])];const csv=rows.map(r=>r.join(";")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="aquila_historico.csv";a.click()};
$$(".segmented button").forEach(b=>b.onclick=()=>{$$(".segmented button").forEach(x=>x.classList.remove("active"));b.classList.add("active");chartRange=+b.dataset.range;renderBigChart()});
$("#readAllBtn").onclick=async()=>{try{await api("/alertas",{method:"POST",body:JSON.stringify({acao:"ler_todos"})});await loadAll();toast("Alertas marcados como lidos")}catch(e){toast("Erro ao atualizar alertas")}};
function fillSettings(){if(!configData)return;$("#capacityInput").value=configData.capacidade;$("#heightInput").value=configData.altura;$("#minInput").value=configData.minimo;$("#maxInput").value=configData.maximo;$("#calibrationInput").value=configData.calibracao}
$("#settingsForm").onsubmit=async e=>{e.preventDefault();const body={capacidade:+$("#capacityInput").value,altura:+$("#heightInput").value,minimo:+$("#minInput").value,maximo:+$("#maxInput").value,calibracao:+$("#calibrationInput").value};try{configData=await api("/configuracoes",{method:"POST",body:JSON.stringify(body)});applyStatus(await api("/status"));toast("Configurações salvas")}catch(e){toast("Erro ao salvar")}};
$("#resetBtn").onclick=async()=>{try{configData=await api("/configuracoes",{method:"POST",body:JSON.stringify({capacidade:2000,altura:2.0,minimo:20,maximo:90,calibracao:1.0})});fillSettings();applyStatus(await api("/status"));toast("Padrões restaurados")}catch(e){toast("Erro ao restaurar")}};
setInterval(()=>$("#clock").textContent=new Date().toLocaleString("pt-BR"),1000);
setInterval(loadAll,5000);
window.addEventListener("resize",()=>{renderMainChart();if($("#graficos").classList.contains("active"))renderBigChart()});
loadAll();

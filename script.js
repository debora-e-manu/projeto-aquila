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


function drawChart(canvas, data) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  if (!data || data.length === 0) {
    ctx.fillStyle = "#8ca9c5";
    ctx.font = "14px sans-serif";
    ctx.fillText("Nenhuma medição neste período", 20, 35);
    return;
  }

  // Escala do nível: 0% a 100%
  const min = 0;
  const max = 100;

  const left = 48;
  const right = 18;
  const top = 24;
  const bottom = 48;
  const graphW = w - left - right;
  const graphH = h - top - bottom;

  const x = i => left + (i / Math.max(1, data.length - 1)) * graphW;
  const y = value => top + (1 - Math.max(0, Math.min(100, Number(value))) / 100) * graphH;

  ctx.font = "11px sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  // Linhas e escala vertical
  for (let value = 0; value <= 100; value += 25) {
    const py = y(value);

    ctx.strokeStyle = "#17324b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, py);
    ctx.lineTo(w - right, py);
    ctx.stroke();

    ctx.fillStyle = "#8ca9c5";
    ctx.fillText(value + "%", left - 8, py);
  }

  // Linha do nível medido
  ctx.beginPath();
  ctx.strokeStyle = "#32a8ff";
  ctx.lineWidth = 2;

  data.forEach((p, i) => {
    const px = x(i);
    const py = y(p.nivel);

    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });

  ctx.stroke();

  // Pontos das medições
  data.forEach((p, i) => {
    const px = x(i);
    const py = y(p.nivel);

    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#32a8ff";
    ctx.fill();

    // Valores exatos nos pontos
    ctx.fillStyle = "#ffffff";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    if (data.length <= 20) {
      ctx.fillText(Number(p.nivel).toFixed(1) + "%", px, py - 7);
    }
  });

  // Horários no eixo horizontal
  const quantidade = Math.min(6, data.length);

  ctx.fillStyle = "#8ca9c5";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  for (let i = 0; i < quantidade; i++) {
    const indice = Math.round(
      i * (data.length - 1) / Math.max(1, quantidade - 1)
    );

    const dataHora = new Date(data[indice].timestamp);

    const horario = Number.isNaN(dataHora.getTime())
      ? "--:--"
      : dataHora.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        });

    ctx.fillText(horario, x(indice), h - bottom + 12);
  }
}

function renderMainChart(){drawChart($("#levelChart"),historyData.slice(-24))}

function renderBigChart() {
  const agora = Date.now();
  const periodoMs = chartRange === 24
    ? 24 * 60 * 60 * 1000
    : 7 * 24 * 60 * 60 * 1000;

  // Mantém apenas medições dentro do período escolhido
  const dataPeriodo = historyData.filter(item => {
    const tempo = new Date(item.timestamp).getTime();
    return Number.isFinite(tempo) && tempo >= agora - periodoMs && tempo <= agora;
  });

  // Limita o número de pontos exibidos
  const limitePontos = chartRange === 24 ? 48 : 84;
  let data = dataPeriodo;

  if (dataPeriodo.length > limitePontos) {
    const passo = (dataPeriodo.length - 1) / (limitePontos - 1);

    data = Array.from({ length: limitePontos }, (_, i) => {
      return dataPeriodo[Math.round(i * passo)];
    });
  }

  drawChart($("#bigChart"), data);

  if (dataPeriodo.length) {
    const valores = dataPeriodo.map(item => Number(item.nivel)).filter(Number.isFinite);

    if (valores.length) {
      $("#avgLevel").textContent =
        (valores.reduce((soma, valor) => soma + valor, 0) / valores.length).toFixed(1) + "%";

      $("#minLevel").textContent = Math.min(...valores).toFixed(0) + "%";
      $("#maxLevel").textContent = Math.max(...valores).toFixed(0) + "%";
    }
  } else {
    $("#avgLevel").textContent = "--%";
    $("#minLevel").textContent = "--%";
    $("#maxLevel").textContent = "--%";
  }
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
  const percentual1 = Math.max(0, Math.min(100, (nivel1 / 20) * 100));

  $("#levelPercent1").textContent = percentual1.toFixed(0) + "%";
  $("#waterFill1").style.height = percentual1 + "%";
  $("#tankLabel1").textContent = nivel1.toFixed(2) + " cm";
  $("#volumeValue1").textContent = nivel1.toFixed(2) + " cm";

  // =========================
  // RESERVATÓRIO 2
  // =========================

  const nivel2 = Number(s.nivel2 || 0);
  const percentual2 = Math.max(0, Math.min(100, (nivel2 / 10) * 100));

  $("#levelPercent2").textContent = percentual2.toFixed(0) + "%";
  $("#waterFill2").style.height = percentual2 + "%";
  $("#tankLabel2").textContent = nivel2.toFixed(2) + " cm";
  $("#volumeValue2").textContent = nivel2.toFixed(2) + " cm";

  // =========================
  // OUTRAS INFORMAÇÕES
  // =========================

  $("#flowValue").textContent = Number(s.vazao || 0).toFixed(1) + " L/min";
  $("#sensorValue").textContent = s.sensor ? s.sensor.toUpperCase() : "SEM DADOS";

  // =========================
  // ESTADO DA BOMBA
  // =========================

  const bombaElement = $("#pumpStatus");

  if (bombaElement) {
    if (s.sensor === "ativo" && s.bomba) {
      bombaElement.textContent =
        s.bomba === "ligada" ? "BOMBA LIGADA" : "BOMBA DESLIGADA";
    } else {
      bombaElement.textContent = "SEM COMUNICAÇÃO";
    }
  }

  // Horário da última medição recebida
  const ultimaLeitura = $("#lastUpdate");

  if (ultimaLeitura) {
    if (s.timestamp) {
      const data = new Date(s.timestamp);

      ultimaLeitura.textContent = Number.isNaN(data.getTime())
        ? "--:--:--"
        : data.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
          });
    } else {
      ultimaLeitura.textContent = "--:--:--";
    }
  }
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

ÁQUILA — SISTEMA DE MONITORAMENTO HÍDRICO
VERSÃO COM API C++ + DASHBOARD

O que mudou nesta versão
------------------------
Agora o dashboard NÃO depende apenas de dados simulados no JavaScript.
Ele conversa de verdade com uma API HTTP escrita em C++.

Arquivos
--------
index.html              Interface do sistema
style.css               Estilo profissional
script.js               Front-end + chamadas fetch para a API
backend.cpp             API HTTP em C++
ESP32_API_EXEMPLO.ino   Exemplo de envio de dados do ESP32
README.txt              Este manual

Como executar no Windows
------------------------
1. Abra esta pasta no VS Code.
2. Tenha um compilador C++ (MinGW-w64/GCC ou outro compatível).
3. Abra o terminal do VS Code na pasta.
4. Compile:

   g++ backend.cpp -std=c++17 -O2 -o aquila_api.exe -lws2_32

5. Execute:

   .\aquila_api.exe

6. Abra no navegador:

   http://localhost:8080

IMPORTANTE:
O próprio servidor C++ entrega o index.html, style.css e script.js.
Não é necessário usar Live Server.

Como saber se a API está funcionando
------------------------------------
No navegador, o sistema deve mostrar "API conectada".
Também é possível acessar:

GET  http://localhost:8080/api/health
GET  http://localhost:8080/api/status
GET  http://localhost:8080/api/historico
GET  http://localhost:8080/api/alertas
GET  http://localhost:8080/api/configuracoes

Principais comandos
-------------------
POST /api/sensor
Body:
{"nivel":72.5,"vazao":18.4,"sensor":"ativo"}

POST /api/configuracoes
Body:
{"capacidade":2000,"altura":2.0,"minimo":20,"maximo":90,"calibracao":1.0}

POST /api/calibracao
Body:
{"valor":1.0}

POST /api/alertas
Body:
{"acao":"ler_todos"}

Como entra o ESP32
------------------
A arquitetura fica:

SENSOR DE NÍVEL ─┐
                 ├──> ESP32 ──Wi-Fi──> API C++ ──> Dashboard Áquila
SENSOR DE VAZÃO ─┘                         │
                                           └──> histórico/alertas

O arquivo ESP32_API_EXEMPLO.ino demonstra o envio para:
POST /api/sensor

ATENÇÃO:
O exemplo do ESP32 usa valores simulados. Para conectar os sensores reais,
é preciso saber exatamente quais modelos vocês possuem e qual placa ESP32
estão usando. Não use pinos do exemplo como se fossem universais.

Bomba
-----
Este projeto NÃO possui automação de bomba. O sistema apenas monitora
as informações do reservatório e dos sensores. Não há comando de ligar,
desligar ou controlar bomba pela API ou pelo dashboard.

Observação para a apresentação
------------------------------
Esta versão já demonstra uma arquitetura real de software:
Sensores/ESP32 → API HTTP → dados do sistema → Dashboard Áquila.

Os dados de sensores ainda podem ser simulados. O próximo passo é substituir o exemplo de envio do ESP32 pelas leituras
dos sensores reais.

Tecnologias
-----------
HTML5
CSS3
JavaScript
Fetch API
C++17
HTTP
ESP32/Arduino (integração futura)

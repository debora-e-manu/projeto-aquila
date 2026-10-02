/*
  EXEMPLO DE ENVIO DO ESP32 PARA A API ÁQUILA
  --------------------------------------------
  Este exemplo mostra como o ESP32 pode enviar uma leitura
  para POST /api/sensor.

  Instale/tenha:
  - Arduino IDE
  - suporte para sua placa ESP32
  - WiFi.h e HTTPClient.h (incluídos no core ESP32)

  IMPORTANTE:
  - Troque WIFI_SSID e WIFI_PASS.
  - Troque API_IP pelo IPv4 do notebook que está executando
    aquila_api.exe. Exemplo: http://192.168.1.20:8080
  - A leitura abaixo é SIMULADA. Substitua nivel e vazao
    pelas leituras reais dos seus sensores.
*/

#include <WiFi.h>
#include <HTTPClient.h>

const char* WIFI_SSID = "Davi_Lorran";
const char* WIFI_PASS = "Emanuelly1430";
const char* API_IP = "http://192.168.1.8:3000";

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("ESP32 conectado. IP: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    // SUBSTITUA por leituras reais dos sensores.
    float nivel = 72.0;
    float vazao = 18.5;

    HTTPClient http;
    String url = String(API_IP) + "/api/medicoes";

    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    String json = "{\"nivel\":" + String(nivel, 2) +
                  ",\"vazao\":" + String(vazao, 2) +
                  ",\"sensor\":\"ativo\"}";

    int codigo = http.POST(json);

    Serial.print("API respondeu: ");
    Serial.println(codigo);

    http.end();
  }

  delay(5000);
}

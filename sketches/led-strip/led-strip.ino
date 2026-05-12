/*
 * led-strip.ino — NeoPixel LED strip controller
 *
 * ── Platforms ────────────────────────────────────────────────────────────────
 *  ESP8266 (NodeMCU etc.)
 *    Connects to 'lever' AP, subscribes MQTT topic cmnd/leds/strip1.
 *    Publishes acknowledgement to stat/leds/strip1.
 *
 *  Arduino Uno / Leonardo (test mode — no WiFi)
 *    Cycles through demo sequences every 6 s.
 *    Also accepts JSON commands on Serial (9600 baud), same format as MQTT.
 *
 * ── Wiring ────────────────────────────────────────────────────────────────────
 *  NeoPixel DATA → D4 (ESP8266 / NodeMCU GPIO2)  OR  pin 6 (Uno/Leonardo)
 *  NeoPixel 5V   → 5V
 *  NeoPixel GND  → GND
 *  (A 300–500 Ω resistor in series on the data line is recommended)
 *
 * ── Command format (MQTT payload or Serial line) ──────────────────────────────
 *  {"effect":"off"}
 *  {"effect":"solid","r":255,"g":0,"b":0}
 *  {"effect":"rainbow"}
 *  {"effect":"chase","r":255,"g":100,"b":0,"speed":40}
 *  {"effect":"pulse","r":0,"g":0,"b":255,"speed":5}
 *
 * ── Libraries (install via Arduino Library Manager) ──────────────────────────
 *  - Adafruit NeoPixel
 *  - ArduinoJson  (v6)
 *  - PubSubClient  (ESP8266 target only)
 */

#include <Adafruit_NeoPixel.h>
#include <ArduinoJson.h>

// ── Strip configuration ───────────────────────────────────────────────────────
#define NUM_LEDS   30    // change to match your strip length
#define BRIGHTNESS 80    // 0–255 global brightness cap

#ifdef ESP8266
  #define LED_PIN D4     // NodeMCU GPIO2 (D4)
#else
  #define LED_PIN 6      // Uno / Leonardo digital 6
#endif

// ── WiFi + MQTT (ESP8266 only) ────────────────────────────────────────────────
#ifdef ESP8266
  #include <ESP8266WiFi.h>
  #include <PubSubClient.h>

  const char* WIFI_SSID   = "lever";
  const char* WIFI_PASS   = "xx7usavf7szhx";
  const char* MQTT_HOST   = "192.168.4.1";
  const int   MQTT_PORT   = 1883;
  const char* MQTT_USER   = "kybe";
  const char* MQTT_PASS   = "88888888";
  const char* MQTT_SUB    = "cmnd/leds/strip1";
  const char* MQTT_STAT   = "stat/leds/strip1";
  const char* CLIENT_ID   = "led-strip1";

  WiFiClient   wifiClient;
  PubSubClient mqttClient(wifiClient);
#endif

// ── Strip + effect state ──────────────────────────────────────────────────────
Adafruit_NeoPixel strip(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);

enum Effect { FX_OFF, FX_SOLID, FX_RAINBOW, FX_CHASE, FX_PULSE };
Effect        currentEffect = FX_RAINBOW;
uint8_t       fxR = 0, fxG = 0, fxB = 255;
uint8_t       fxSpeed = 40;   // ms between frames (lower = faster)
uint32_t      fxStep  = 0;
unsigned long lastFrameMs = 0;

// ── Effects ───────────────────────────────────────────────────────────────────

void renderOff() {
  strip.clear();
  strip.show();
}

void renderSolid() {
  for (int i = 0; i < NUM_LEDS; i++)
    strip.setPixelColor(i, strip.Color(fxR, fxG, fxB));
  strip.show();
}

void renderRainbow() {
  if (millis() - lastFrameMs < (unsigned long)fxSpeed) return;
  lastFrameMs = millis();
  for (int i = 0; i < NUM_LEDS; i++) {
    uint16_t hue = (uint16_t)(fxStep + (uint32_t)i * 65536UL / NUM_LEDS);
    strip.setPixelColor(i, strip.gamma32(strip.ColorHSV(hue)));
  }
  strip.show();
  fxStep += 256;
}

void renderChase() {
  if (millis() - lastFrameMs < (unsigned long)fxSpeed) return;
  lastFrameMs = millis();
  strip.clear();
  for (int i = 0; i < NUM_LEDS; i += 3)
    strip.setPixelColor((fxStep + i) % NUM_LEDS, strip.Color(fxR, fxG, fxB));
  strip.show();
  fxStep = (fxStep + 1) % NUM_LEDS;
}

void renderPulse() {
  if (millis() - lastFrameMs < 10) return;
  lastFrameMs = millis();
  float phase = (sin(fxStep * 0.05f) + 1.0f) * 0.5f;
  uint8_t bri  = (uint8_t)(phase * 255);
  for (int i = 0; i < NUM_LEDS; i++)
    strip.setPixelColor(i, strip.Color(
      (uint16_t)fxR * bri >> 8,
      (uint16_t)fxG * bri >> 8,
      (uint16_t)fxB * bri >> 8));
  strip.show();
  fxStep++;
}

// ── Command parser ────────────────────────────────────────────────────────────

void applyCommand(const char* payload) {
  StaticJsonDocument<128> doc;
  if (deserializeJson(doc, payload) != DeserializationError::Ok) return;

  const char* effect = doc["effect"] | "rainbow";
  fxR     = doc["r"]     | 255;
  fxG     = doc["g"]     | 255;
  fxB     = doc["b"]     | 255;
  fxSpeed = doc["speed"] | 40;
  fxStep  = 0;
  lastFrameMs = 0;

  if      (strcmp(effect, "off")     == 0) { currentEffect = FX_OFF;     renderOff(); }
  else if (strcmp(effect, "solid")   == 0)   currentEffect = FX_SOLID;
  else if (strcmp(effect, "rainbow") == 0)   currentEffect = FX_RAINBOW;
  else if (strcmp(effect, "chase")   == 0)   currentEffect = FX_CHASE;
  else if (strcmp(effect, "pulse")   == 0)   currentEffect = FX_PULSE;
}

// ── ESP8266: WiFi + MQTT ──────────────────────────────────────────────────────
#ifdef ESP8266

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  // Flash strip amber while connecting
  while (WiFi.status() != WL_CONNECTED) {
    for (int i = 0; i < NUM_LEDS; i++)
      strip.setPixelColor(i, i % 2 == 0 ? strip.Color(80, 40, 0) : 0);
    strip.show();
    delay(300);
    strip.clear(); strip.show();
    delay(200);
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int len) {
  char buf[128];
  if (len >= sizeof(buf)) return;
  memcpy(buf, payload, len);
  buf[len] = '\0';
  applyCommand(buf);
  mqttClient.publish(MQTT_STAT, buf);
}

void ensureMqtt() {
  if (mqttClient.connected()) return;
  if (WiFi.status() != WL_CONNECTED) connectWifi();
  if (mqttClient.connect(CLIENT_ID, MQTT_USER, MQTT_PASS)) {
    mqttClient.subscribe(MQTT_SUB);
    // Confirm ready: brief blue flash
    for (int i = 0; i < NUM_LEDS; i++) strip.setPixelColor(i, strip.Color(0, 0, 80));
    strip.show(); delay(200); strip.clear(); strip.show();
  }
}

#endif  // ESP8266

// ── Uno/Leonardo: demo sequences ──────────────────────────────────────────────
#ifndef ESP8266

#define DEMO_INTERVAL 6000UL

const char* DEMO_CMDS[] = {
  "{\"effect\":\"rainbow\"}",
  "{\"effect\":\"chase\",\"r\":255,\"g\":80,\"b\":0,\"speed\":30}",
  "{\"effect\":\"pulse\",\"r\":0,\"g\":80,\"b\":255}",
  "{\"effect\":\"solid\",\"r\":255,\"g\":0,\"b\":60}",
  "{\"effect\":\"chase\",\"r\":0,\"g\":255,\"b\":80,\"speed\":20}",
  "{\"effect\":\"pulse\",\"r\":255,\"g\":20,\"b\":0}",
};
const uint8_t DEMO_COUNT = sizeof(DEMO_CMDS) / sizeof(DEMO_CMDS[0]);

uint8_t       demoStep   = 0;
unsigned long lastDemoMs = 0;

// Serial command buffer
char    serialBuf[128];
uint8_t serialPos = 0;

void checkSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialPos > 0) {
        serialBuf[serialPos] = '\0';
        applyCommand(serialBuf);
        serialPos = 0;
      }
    } else if (serialPos < sizeof(serialBuf) - 1) {
      serialBuf[serialPos++] = c;
    }
  }
}

#endif  // !ESP8266

// ── Setup ─────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(9600);

  strip.begin();
  strip.setBrightness(BRIGHTNESS);
  strip.clear();
  strip.show();

#ifdef ESP8266
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  connectWifi();
  ensureMqtt();
  applyCommand("{\"effect\":\"rainbow\"}");
#else
  applyCommand(DEMO_CMDS[0]);
  lastDemoMs = millis();
  Serial.println(F("LED strip ready. Send JSON commands at 9600 baud."));
  Serial.println(F("Example: {\"effect\":\"rainbow\"}"));
#endif
}

// ── Loop ──────────────────────────────────────────────────────────────────────

void loop() {
#ifdef ESP8266
  ensureMqtt();
  mqttClient.loop();
#else
  checkSerial();
  if (millis() - lastDemoMs >= DEMO_INTERVAL) {
    lastDemoMs = millis();
    demoStep   = (demoStep + 1) % DEMO_COUNT;
    applyCommand(DEMO_CMDS[demoStep]);
  }
#endif

  switch (currentEffect) {
    case FX_OFF:                       break;
    case FX_SOLID:   renderSolid();    break;
    case FX_RAINBOW: renderRainbow();  break;
    case FX_CHASE:   renderChase();    break;
    case FX_PULSE:   renderPulse();    break;
  }
}

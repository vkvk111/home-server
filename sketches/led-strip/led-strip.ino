/*
 * led-strip.ino - WS2812B LED strip controller (Uno R3)
 *
 * Cycles through demo sequences every 6 s.
 * Also accepts JSON commands on Serial (9600 baud).
 *
 * Wiring:
 *   WS2812B DATA -> digital pin 6
 *   WS2812B 5V   -> 5V (external supply recommended for >10 LEDs)
 *   WS2812B GND  -> GND
 *   300-500 ohm resistor in series on data line recommended
 *
 * Serial command format (newline-terminated):
 *   {"effect":"off"}
 *   {"effect":"solid","r":255,"g":0,"b":0}
 *   {"effect":"rainbow"}
 *   {"effect":"chase","r":255,"g":100,"b":0,"speed":40}
 *   {"effect":"pulse","r":0,"g":0,"b":255,"speed":5}
 *
 * Libraries required (Arduino Library Manager):
 *   - Adafruit NeoPixel  (works with any WS2812B strip, not Adafruit-specific)
 *   - ArduinoJson v6 (Benoit Blanchon)
 */

#include <Adafruit_NeoPixel.h>
#include <ArduinoJson.h>

// Strip configuration
#define NUM_LEDS   30
#define BRIGHTNESS 255
#define LED_PIN    6

Adafruit_NeoPixel strip(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);

// Effect state
enum Effect { FX_OFF, FX_SOLID, FX_RAINBOW, FX_CHASE, FX_PULSE };
Effect        currentEffect = FX_RAINBOW;
uint8_t       fxR = 255, fxG = 255, fxB = 255;
uint8_t       fxSpeed = 40;
uint32_t      fxStep  = 0;
unsigned long lastFrameMs = 0;

// Effects

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
  uint8_t bri = (uint8_t)(phase * 255);
  for (int i = 0; i < NUM_LEDS; i++)
    strip.setPixelColor(i, strip.Color(
      (uint16_t)fxR * bri >> 8,
      (uint16_t)fxG * bri >> 8,
      (uint16_t)fxB * bri >> 8));
  strip.show();
  fxStep++;
}

// Command parser

void applyCommand(const char* payload) {
  StaticJsonDocument<128> doc;
  if (deserializeJson(doc, payload) != DeserializationError::Ok) {
    Serial.println(F("ERR: bad JSON"));
    return;
  }

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

  Serial.print(F("OK: ")); Serial.println(effect);
}

// Demo sequences

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

// Serial reader

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

// Setup and loop

void setup() {
  Serial.begin(9600);
  strip.begin();
  strip.setBrightness(BRIGHTNESS);
  strip.clear();
  strip.show();
  applyCommand(DEMO_CMDS[0]);
  lastDemoMs = millis();
  Serial.println(F("Ready - send JSON commands at 9600 baud"));
}

void loop() {
  checkSerial();

  if (millis() - lastDemoMs >= DEMO_INTERVAL) {
    lastDemoMs = millis();
    demoStep   = (demoStep + 1) % DEMO_COUNT;
    applyCommand(DEMO_CMDS[demoStep]);
  }

  switch (currentEffect) {
    case FX_OFF:                      break;
    case FX_SOLID:   renderSolid();   break;
    case FX_RAINBOW: renderRainbow(); break;
    case FX_CHASE:   renderChase();   break;
    case FX_PULSE:   renderPulse();   break;
  }
}
#include <WiFi.h>
#include <mqtt_client.h>
#include <ArduinoJson.h>
#include <Adafruit_NeoPixel.h>
#include "secrets.h"

#define PIN_BUTTON 9
#define PIN_NEO_PIXEL 8
#define PIXEL_PER_RING 8
#define NUM_OF_LEVELS 3

Adafruit_NeoPixel pixels(NUM_OF_LEVELS *PIXEL_PER_RING, PIN_NEO_PIXEL, NEO_GRB + NEO_KHZ800);
esp_mqtt_client_handle_t mqttClient;

// The house does have 3 levels: 0-7, 8-15, 16-23

enum LightEffect
{
    OFF,
    SOLID,
    EFFECT_CANDLE,
    EFFECT_PARTY
};

struct LevelConfig
{
    LightEffect effect;
    uint32_t color;
};

LevelConfig levels[NUM_OF_LEVELS];
bool lastButtonState = HIGH;

void setLevelColor(uint8_t level, uint32_t color)
{
    uint8_t startLed = level * PIXEL_PER_RING;
    for (uint8_t i = 0; i < PIXEL_PER_RING; i++)
    {
        pixels.setPixelColor(startLed + i, color);
    }
}

void updateLevelLight(uint8_t level, LightEffect effect, uint32_t color = 0)
{
    if (level >= NUM_OF_LEVELS)
        return;

    levels[level].effect = effect;
    if (color != 0)
        levels[level].color = color;

    if (effect == SOLID)
    {
        setLevelColor(level, levels[level].color);
    }
    else if (effect == OFF)
    {
        setLevelColor(level, 0);
    }
}

void setAllLevels(LightEffect effect, uint32_t color = 0)
{
    for (uint8_t i = 0; i < NUM_OF_LEVELS; i++)
    {
        updateLevelLight(i, effect, color);
    }
    pixels.show();
}

void updateLights()
{
    bool needUpdate = false;
    unsigned long now = millis();

    static unsigned long lastCandleUpdate = 0;
    static uint8_t globalFlicker = 100;

    if (now - lastCandleUpdate > 100)
    {
        globalFlicker = random(55, 101);
        lastCandleUpdate = now;
    }

    for (uint8_t level = 0; level < NUM_OF_LEVELS; level++)
    {
        if (levels[level].effect == EFFECT_CANDLE)
        {
            uint8_t startLed = level * PIXEL_PER_RING;
            uint8_t r = (255 * globalFlicker) / 100;
            uint8_t g = (140 * globalFlicker) / 100;

            for (uint8_t i = 0; i < PIXEL_PER_RING; i++)
            {
                pixels.setPixelColor(startLed + i, pixels.Color(r, g, 0));
            }
            needUpdate = true;
        }
    }

    if (needUpdate)
        pixels.show();
}
uint32_t parseHexColor(const char *colorStr)
{
    if (!colorStr || colorStr[0] != '#')
        return 0;
    long hex = strtol(colorStr + 1, NULL, 16);
    return pixels.Color((hex >> 16) & 0xFF, (hex >> 8) & 0xFF, hex & 0xFF);
}

void publishState(const char *trigger)
{
    JsonDocument jsonDoc;
    jsonDoc["device"] = THINGNAME;
    jsonDoc["trigger"] = trigger;

    JsonArray levelsArr = jsonDoc["levels"].to<JsonArray>();
    for (uint8_t i = 0; i < NUM_OF_LEVELS; i++)
    {
        JsonObject level = levelsArr.add<JsonObject>();
        level["level"] = i;
        level["effect"] = (levels[i].effect == OFF) ? "off" : (levels[i].effect == EFFECT_CANDLE) ? "candle"
    }

    char buffer[256];
    serializeJson(jsonDoc, buffer);
    esp_mqtt_client_publish(mqttClient, "winter-light/state", buffer, 0, 1, 0);
}

void handleCommand(const char *data, int len)
{
    JsonDocument doc;
    if (deserializeJson(doc, data, len))
        return;

    const char *target = doc["target"];
    const char *effectStr = doc["effect"];

    LightEffect effect = OFF;
    if (strcmp(effectStr, "solid") == 0)
        effect = SOLID;
    else if (strcmp(effectStr, "candle") == 0)
        effect = EFFECT_CANDLE;

    uint32_t color = 0;
    if (doc["color"])
        color = parseHexColor(doc["color"]);

    if (strcmp(target, "all") == 0)
    {
        setAllLevels(effect, color);
    }
    else if (strcmp(target, "level") == 0)
    {
        updateLevelLight(doc["level"], effect, color);
        pixels.show();
    }

    publishState("mqtt_command");
}

static void mqttEventHandler(void *arg, esp_event_base_t base, int32_t event_id, void *event_data)
{
    esp_mqtt_event_handle_t event = (esp_mqtt_event_handle_t)event_data;

    switch (event_id)
    {
    case MQTT_EVENT_CONNECTED:
    {
        Serial.println("MQTT connected");

        char online_msg[64];
        snprintf(online_msg, sizeof(online_msg), "{\"device\":\"%s\",\"status\":\"online\"}", THINGNAME);
        esp_mqtt_client_publish(mqttClient, "winter-light/status", online_msg, 0, 1, 0);

        esp_mqtt_client_subscribe(mqttClient, "winter-light/commands", 1);

        publishState("boot");
        break;
    }
    case MQTT_EVENT_DISCONNECTED:
        Serial.println("MQTT disconnected");
        break;
    case MQTT_EVENT_DATA:
        handleCommand(event->data, event->data_len);
        break;
    case MQTT_EVENT_ERROR:
        Serial.println("MQTT error");
        break;
    }
}

void connectAWS()
{
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.print("WiFi");
    while (WiFi.status() != WL_CONNECTED)
    {
        delay(500);
        Serial.print(".");
    }

    Serial.println("OK");
    // LWT message
    static char lwt_msg[64];
    snprintf(lwt_msg, sizeof(lwt_msg), "{\"device\":\"%s\",\"status\":\"offline\"}", THINGNAME);

    esp_mqtt_client_config_t cfg = {};
    cfg.uri = AWS_IOT_ENDPOINT;
    cfg.cert_pem = AWS_CERT_CA;
    cfg.client_cert_pem = AWS_CERT_CRT;
    cfg.client_key_pem = AWS_CERT_PRIVATE;
    cfg.client_id = THINGNAME;
    cfg.keepalive = 10;
    // LWT config
    cfg.lwt_topic = "winter-light/status";
    cfg.lwt_msg = lwt_msg;
    cfg.lwt_qos = 1;
    cfg.lwt_retain = 0;

    mqttClient = esp_mqtt_client_init(&cfg);
    esp_mqtt_client_register_event(mqttClient, (esp_mqtt_event_id_t)ESP_EVENT_ANY_ID, mqttEventHandler, NULL);
    esp_mqtt_client_start(mqttClient);
}

void setup()
{
    Serial.begin(115200);
    pinMode(PIN_BUTTON, INPUT_PULLUP);

    pixels.begin();
    pixels.setBrightness(50);
    pixels.clear();
    pixels.show();

    uint32_t warmOrange = pixels.Color(255, 100, 0);
    for (uint8_t i = 0; i < NUM_OF_LEVELS; i++)
    {
        levels[i].effect = OFF;
        levels[i].color = warmOrange;
    }

    connectAWS();
}

void loop()
{
    updateLights();

    bool currentButtonState = digitalRead(PIN_BUTTON);
    static unsigned long lastPress = 0;

    if (currentButtonState == LOW && lastButtonState == HIGH && millis() - lastPress > 300)
    {
        lastPress = millis();
        bool anyOn = (levels[0].effect != OFF || levels[1].effect != OFF || levels[2].effect != OFF);
        setAllLevels(anyOn ? OFF : SOLID);
        publishState("button");
    }
    lastButtonState = currentButtonState;

    delay(10);
}
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

enum MqttConnectionState
{
    MQTT_STATE_DISCONNECTED,
    MQTT_STATE_CONNECTING,
    MQTT_STATE_SUBSCRIBING,
    MQTT_STATE_READY
};
class LightLevel
{
private:
    uint8_t index;
    LightEffect effect;
    uint32_t color;

public:
    LightLevel() : index(0), effect(OFF), color(0) {}

    void setIndex(uint8_t idx)
    {
        index = idx;
    }

    LightEffect getEffect() const { return effect; }
    uint32_t getColor() const { return color; }

    void update(Adafruit_NeoPixel &pixels)
    {
        if (effect == OFF)
        {
            handleSolidColor(pixels, 0);
        }
        else if (effect == SOLID)
        {
            handleSolidColor(pixels, color);
        }
        else if (effect == EFFECT_CANDLE)
        {
            handleCandleEffect(pixels);
        }
    }
    void setState(LightEffect newEffect, uint32_t newColor)
    {
        effect = newEffect;
        if (newEffect != EFFECT_CANDLE && newColor != 0)
        {
            color = newColor;
        }
    }

private:
    void handleSolidColor(Adafruit_NeoPixel &pixels, uint32_t color)
    {
        uint8_t startLed = index * PIXEL_PER_RING;
        for (uint8_t i = 0; i < PIXEL_PER_RING; i++)
        {
            pixels.setPixelColor(startLed + i, color);
        }
    }
    void handleCandleEffect(Adafruit_NeoPixel &pixels)
    {
        static unsigned long lastCandleUpdate = 0;
        static uint8_t globalFlicker = 100;

        if (millis() - lastCandleUpdate > 100)
        {
            globalFlicker = random(55, 101);
            lastCandleUpdate = millis();
        }

        uint8_t r = (255 * globalFlicker) / 100;
        uint8_t g = (140 * globalFlicker) / 100;
        handleSolidColor(pixels, pixels.Color(r, g, 0));
    }
};

class LevelController
{
private:
    Adafruit_NeoPixel &pixels;
    LightLevel levels[NUM_OF_LEVELS];
    struct SavedState
    {
        LightEffect effect;
        uint32_t color;
    };
    SavedState savedStates[NUM_OF_LEVELS];
    bool hasSavedState = false;

public:
    void showLoadingAnimation()
    {
        static unsigned long lastUpdate = 0;
        static uint8_t currentLevel = 0;

        if (millis() - lastUpdate > 200)
        {

            for (uint8_t i = 0; i < NUM_OF_LEVELS; i++)
            {
                levels[i].setState(OFF, 0);
                levels[i].update(pixels);
            }

            uint32_t loadingColor = pixels.Color(50, 50, 200);
            levels[currentLevel].setState(SOLID, loadingColor);
            levels[currentLevel].update(pixels);

            pixels.show();

            currentLevel = (currentLevel + 1) % NUM_OF_LEVELS;
            lastUpdate = millis();
        }
    }

    LevelController(Adafruit_NeoPixel &pixel) : pixels(pixel)
    {
        for (uint8_t i = 0; i < NUM_OF_LEVELS; i++)
        {
            levels[i].setIndex(i);
        }
    }

    void updateAll()
    {
        for (uint8_t i = 0; i < NUM_OF_LEVELS; i++)
        {
            levels[i].update(pixels);
        }
        pixels.show();
    }

    void setLevel(uint8_t level, LightEffect effect, uint32_t color = 0)
    {
        if (level < NUM_OF_LEVELS)
        {
            levels[level].setState(effect, color);
        }
    }
    void setAll(LightEffect effect, uint32_t color = 0)
    {
        for (uint8_t i = 0; i < NUM_OF_LEVELS; i++)
        {
            levels[i].setState(effect, color);
        }
        pixels.show();
    }
    bool anyOn() const
    {
        for (uint8_t i = 0; i < NUM_OF_LEVELS; i++)
        {
            if (levels[i].getEffect() != OFF)
            {
                return true;
            }
        }
        return false;
    }

    LightEffect getLevelEffect(uint8_t level) const
    {
        return (level < NUM_OF_LEVELS) ? levels[level].getEffect() : OFF;
    }

    uint32_t getLevelColor(uint8_t level) const
    {
        return (level < NUM_OF_LEVELS) ? levels[level].getColor() : 0;
    }

    void saveState()
    {
        for (uint8_t i = 0; i < NUM_OF_LEVELS; i++)
        {
            savedStates[i].effect = levels[i].getEffect();
            savedStates[i].color = levels[i].getColor();
        }
        hasSavedState = true;
    }

    void restoreState()
    {
        if (!hasSavedState)
        {
            uint32_t warmOrange = pixels.Color(255, 100, 0);
            setAll(SOLID, warmOrange);
            return;
        }

        for (uint8_t i = 0; i < NUM_OF_LEVELS; i++)
        {
            levels[i].setState(savedStates[i].effect, savedStates[i].color);
        }
        pixels.show();
    }
};

LevelController *levelController = nullptr;
MqttConnectionState mqttState = MQTT_STATE_DISCONNECTED;
uint8_t subscriptionsReceived = 0;
const uint8_t REQUIRED_SUBSCRIPTIONS = 2;
bool lastButtonState = HIGH;

uint32_t parseHexColor(const char *colorStr)
{
    if (!colorStr || colorStr[0] != '#')
        return 0;
    long hex = strtol(colorStr + 1, NULL, 16);
    return pixels.Color((hex >> 16) & 0xFF, (hex >> 8) & 0xFF, hex & 0xFF);
}

void publishState(const char *trigger, bool clearDesired = false)
{
    JsonDocument jsonDoc;

    JsonObject reported = jsonDoc["state"]["reported"].to<JsonObject>();

    reported["device"] = THINGNAME;
    reported["trigger"] = trigger;

    JsonArray levelsArr = reported["levels"].to<JsonArray>();
    for (uint8_t i = 0; i < NUM_OF_LEVELS; i++)
    {
        JsonObject level = levelsArr.add<JsonObject>();
        level["level"] = i;

        LightEffect effect = levelController->getLevelEffect(i);
        level["effect"] = (effect == OFF) ? "off" : (effect == EFFECT_CANDLE) ? "candle"
                                                                              : "solid";

        char hexBuffer[8];
        uint32_t c = levelController->getLevelColor(i);
        sprintf(hexBuffer, "#%06X", c & 0xFFFFFF);
        level["color"] = hexBuffer;
    }

    if (clearDesired)
    {
        jsonDoc["state"]["desired"] = (char *)NULL;
    }

    char buffer[512];
    serializeJson(jsonDoc, buffer);
    esp_mqtt_client_publish(mqttClient, "$aws/things/" THINGNAME "/shadow/update", buffer, 0, 1, 0);
}

LightEffect parseEffect(const char *effectStr)
{
    if (effectStr && strcmp(effectStr, "solid") == 0)
        return SOLID;
    if (effectStr && strcmp(effectStr, "candle") == 0)
        return EFFECT_CANDLE;
    return OFF;
}

void handleShadowGet(const char *data, int len)
{
    Serial.printf("shadow get, len=%d\r\n", len);
    Serial.printf("data: %.*s\r\n", len, data);

    JsonDocument root;
    if (deserializeJson(root, data, len))
    {
        Serial.println("failed to parse JSON");
        return;
    }

    JsonArray levelsArr = root["state"]["reported"]["levels"];
    if (!levelsArr)
    {
        Serial.println("no levels array in shadow");
        return;
    }

    for (JsonObject lvl : levelsArr)
    {
        uint8_t idx = lvl["level"];
        if (idx >= NUM_OF_LEVELS)
            continue;

        LightEffect effect = parseEffect(lvl["effect"]);
        uint32_t color = parseHexColor(lvl["color"]);

        levelController->setLevel(idx, effect, color);
    }

    levelController->updateAll();

    Serial.println("restored state from shadow");
}

void handleDelta(const char *data, int len)
{
    JsonDocument root;
    if (deserializeJson(root, data, len))
        return;

    JsonObject doc = root["state"];

    const char *target = doc["target"] | "all";
    LightEffect effect = parseEffect(doc["effect"]);

    uint32_t color = 0;
    if (effect != EFFECT_CANDLE && doc["color"])
    {
        color = parseHexColor(doc["color"]);
    }

    if (strcmp(target, "all") == 0)
    {
        levelController->setAll(effect, color);
    }
    else
    {
        uint8_t level = doc["level"];
        levelController->setLevel(level, effect, color);
        levelController->updateAll();
    }

    publishState("shadow_sync", true);
}

static void mqttEventHandler(void *arg, esp_event_base_t base, int32_t event_id, void *event_data)
{
    esp_mqtt_event_handle_t event = (esp_mqtt_event_handle_t)event_data;
    switch (event_id)
    {
    case MQTT_EVENT_CONNECTED:
    {
        Serial.println("MQTT connected");

        mqttState = MQTT_STATE_SUBSCRIBING;
        subscriptionsReceived = 0;

        char online_msg[64];
        snprintf(online_msg, sizeof(online_msg), "{\"device\":\"%s\",\"status\":\"online\"}", THINGNAME);
        esp_mqtt_client_publish(mqttClient, "winter-light/status", online_msg, 0, 1, 0);

        esp_mqtt_client_subscribe(mqttClient, "$aws/things/" THINGNAME "/shadow/update/delta", 1);
        esp_mqtt_client_subscribe(mqttClient, "$aws/things/" THINGNAME "/shadow/get/accepted", 1);
        break;
    }
    case MQTT_EVENT_SUBSCRIBED:
    {
        if (mqttState != MQTT_STATE_SUBSCRIBING)
        {
            Serial.println("ignoring sub");
            break;
        }
        subscriptionsReceived++;
        if (subscriptionsReceived >= REQUIRED_SUBSCRIPTIONS)
        {
            mqttState = MQTT_STATE_READY;
            Serial.println("subs ready, requesting shadow");
            esp_mqtt_client_publish(mqttClient, "$aws/things/" THINGNAME "/shadow/get", "{}", 0, 1, 0);
        }
        break;
    }
    case MQTT_EVENT_DISCONNECTED:
    {
        Serial.println("MQTT disconnected");

        // State transition: ANY → DISCONNECTED
        mqttState = MQTT_STATE_DISCONNECTED;
        subscriptionsReceived = 0;
        break;
    }
    case MQTT_EVENT_DATA:
    {

        if (mqttState != MQTT_STATE_READY)
        {
            Serial.println("ignoring data, subs not ready");
            break;
        }
        Serial.printf("topic: %.*s\r\n", event->topic_len, event->topic);

        if (strstr(event->topic, "/shadow/get/accepted"))
        {
            handleShadowGet(event->data, event->data_len);
        }
        else if (strstr(event->topic, "/shadow/update/delta"))
        {
            handleDelta(event->data, event->data_len);
        }
        break;
    }
    case MQTT_EVENT_ERROR:
    {
        Serial.println("MQTT error");
        mqttState = MQTT_STATE_DISCONNECTED;
        break;
    }
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

    static char lwt_msg[64];
    snprintf(lwt_msg, sizeof(lwt_msg), "{\"device\":\"%s\",\"status\":\"offline\"}", THINGNAME);

    esp_mqtt_client_config_t cfg = {};
    cfg.uri = AWS_IOT_ENDPOINT;
    cfg.cert_pem = AWS_CERT_CA;
    cfg.client_cert_pem = AWS_CERT_CRT;
    cfg.client_key_pem = AWS_CERT_PRIVATE;
    cfg.client_id = THINGNAME;
    cfg.keepalive = 10;
    cfg.lwt_topic = "winter-light/status";
    cfg.lwt_msg = lwt_msg;
    cfg.lwt_qos = 1;

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

    levelController = new LevelController(pixels);

    connectAWS();
}

void loop()
{
    if (mqttState != MQTT_STATE_READY)
    {
        levelController->showLoadingAnimation();
        return;
    }

    levelController->updateAll();

    bool currentButtonState = digitalRead(PIN_BUTTON);
    static unsigned long lastPress = 0;

    if (currentButtonState == LOW && lastButtonState == HIGH && millis() - lastPress > 300)
    {
        lastPress = millis();

        if (levelController->anyOn())
        {
            levelController->saveState();
            levelController->setAll(OFF);
        }
        else
        {
            levelController->restoreState();
        }

        publishState("button");
    }
    lastButtonState = currentButtonState;
    delay(10);
}
#include <pgmspace.h>

#define SECRET
#define THINGNAME "winter-light"

const char WIFI_SSID[] = "****";
const char WIFI_PASSWORD[] = "*****";
const char AWS_IOT_ENDPOINT[] = "mqtts://*****.iot.your-region.amazonaws.com:8883";
// amazon Root CA 1
const char AWS_CERT_CA[] = R"EOF(
-----BEGIN CERTIFICATE-----

-----END CERTIFICATE-----
)EOF";

// device certificate
const char AWS_CERT_CRT[] = R"EOF(
-----BEGIN CERTIFICATE-----

-----END CERTIFICATE-----
)EOF";

// device private key
const char AWS_CERT_PRIVATE[] = R"EOF(
-----BEGIN RSA PRIVATE KEY-----

-----END RSA PRIVATE KEY-----
)EOF";
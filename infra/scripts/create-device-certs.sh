#!/usr/bin/env bash


# input device name

read -p "app name, default [device]: " DEVICE_NAME
DEVICE_NAME="${DEVICE_NAME:-device}"

read -p "org name, default [orgName]: " ORG
ORG="${ORG:-orgName}"


SUBJ="/C=NL/ST=North Holland/L=Amsterdam/O=${ORG}/CN=AWS IoT Certificate"

mkdir -p certs
cd certs

##################################
# Create a CA certificate
# see https://docs.aws.amazon.com/iot/latest/developerguide/create-your-CA-cert.html

openssl genrsa -out ${DEVICE_NAME}_root_CA_key.key 2048

openssl req -x509 -new -nodes \
  -key ${DEVICE_NAME}_root_CA_key.key \
  -sha256 -days 1024 \
  -subj "${SUBJ}" \
  -addext "basicConstraints=CA:TRUE" \
  -out ${DEVICE_NAME}_root_CA_cert.pem

##################################
# Register your CA certificate
# see https://docs.aws.amazon.com/ja_jp/iot/latest/developerguide/register-CA-cert.html

REGISTRATION_CODE=$(aws iot get-registration-code | jq -r '.registrationCode')

openssl genrsa -out ${DEVICE_NAME}_verification_key.key 2048

openssl req -new \
  -key ${DEVICE_NAME}_verification_key.key \
  -subj "${SUBJ%%CN=*}CN=${REGISTRATION_CODE}" \
  -out ${DEVICE_NAME}_verification_csr.csr

openssl x509 -req \
    -in ${DEVICE_NAME}_verification_csr.csr \
    -CA ${DEVICE_NAME}_root_CA_cert.pem \
    -CAkey ${DEVICE_NAME}_root_CA_key.key \
    -CAcreateserial \
    -out ${DEVICE_NAME}_verification_cert.pem \
    -days 500 -sha256

##################################
# Create a client certificate using your CA certificate
# see https://docs.aws.amazon.com/iot/latest/developerguide/create-device-cert.html

openssl genrsa -out ${DEVICE_NAME}_device_key.key 2048

openssl req -new \
  -key ${DEVICE_NAME}_device_key.key \
  -subj "${SUBJ}" \
  -out ${DEVICE_NAME}_device_csr.csr

openssl x509 -req \
    -in ${DEVICE_NAME}_device_csr.csr \
    -CA ${DEVICE_NAME}_root_CA_cert.pem \
    -CAkey ${DEVICE_NAME}_root_CA_key.key \
    -CAcreateserial \
    -out ${DEVICE_NAME}_device_cert.pem \
    -days 500 -sha256



echo "script done - ${DEVICE_NAME}"
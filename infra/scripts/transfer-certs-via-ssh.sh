
read -p "device username: " DEVICE_USER

DEVICE_USER="${DEVICE_USER}"

read -p "hostname IP: " DEVICE_HOST
DEVICE_HOST="${DEVICE_HOST}"

read -p "app name, default [device]: " DEVICE_NAME
DEVICE_NAME="${DEVICE_NAME:-device}"


read -p "device certs directory, default [~/certs/]: " CERTS_DIR
CERTS_DIR="${CERTS_DIR:-~/certs/}"

# download Amazon CA 
curl -o AmazonRootCA1.pem https://www.amazontrust.com/repository/AmazonRootCA1.pem

# transfer the files to raspberry
scp certs/${DEVICE_NAME}_device_cert.pem certs/${DEVICE_NAME}_device_key.key AmazonRootCA1.pem ${DEVICE_USER}@${DEVICE_HOST}:${CERTS_DIR}
echo "files ${DEVICE_NAME}_device_cert.pem, ${DEVICE_NAME}_device_key.key and  AmazonRootCA1.pem transfered to the host"

# clean files
rm AmazonRootCA1.pem
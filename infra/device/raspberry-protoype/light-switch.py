from gpiozero import LED, Button
from signal import pause
from awsiot import mqtt5_client_builder
from awscrt import mqtt5
import uuid
import logging
import json
import time
import os
from dotenv import load_dotenv

load_dotenv()


class IotConfig:
    ENDPOINT = os.getenv("IOT_ENDPOINT")
    CLIENT_ID = os.getenv("IOT_CLIENT_ID")
    CERT_PATH = os.getenv("IOT_CERT_PATH")
    KEY_PATH = os.getenv("IOT_KEY_PATH")
    CA_PATH = os.getenv("IOT_CA_PATH")
    TOPIC = os.getenv("IOT_TOPIC")
    COMMAND_TOPIC = os.getenv("IOT_COMMAND_TOPIC")

# update 
class BoardPins:
    LED1_PIN = 27
    BUTTON_PIN = 17

logging.basicConfig(level=logging.INFO,format="%(asctime)s - [%(levelname)s]- %(message)s")
logger = logging.getLogger(__name__)

class AWSIoTClient:
    def __init__(self):
        self.mqtt5_client= None
        # shadow client
        self.shadow_client= None
        # token
        self.token = str(uuid.uuid4())

    def mqt_connect(self):
        try:
            self.mqtt5_client = mqtt5_client_builder.mtls_from_path(
                endpoint=IotConfig.ENDPOINT,
                cert_filepath=IotConfig.CERT_PATH,
                pri_key_filepath=IotConfig.KEY_PATH,
                ca_filepath=IotConfig.CA_PATH,
                client_id=IotConfig.CLIENT_ID,
                clean_session=False,
                keep_alive_secs=30,
                on_publish_received=self.message_received

                )
            self.mqtt5_client.start()
            logger.info("connected to aws via mqtt")

            self.mqtt5_client.subscribe(subscribe_packet=mqtt5.SubscribePacket(
                    subscriptions=[mqtt5.Subscription(
                    topic_filter=IotConfig.COMMAND_TOPIC,
                    qos=mqtt5.QoS.AT_LEAST_ONCE
                )]
            ))
            logger.info(f"subscribed to {IotConfig.COMMAND_TOPIC}")

            # rr_options = mqtt_request_response.ClientOptions(
            #     max_request_response_subscriptions = 2,
            #     max_streaming_subscriptions = 2,
            #     operation_timeout_in_seconds = 30)
            # self.shadow_client = iotshadow.IotShadowClientV2(self.shadow_client)
            logger.info("connected to shadow client")
        except Exception as e:
            logger.error(f"connection failed :{e}")

    def message_received(self, publish_packet_data):
        try:
            payload = json.loads(publish_packet_data.publish_packet.payload.decode())
            logger.info(f"command received: {payload}")
            # if self.on_command_callback and payload.get("action") == "toggle":
            #     self.on_command_callback()
        except Exception as e:
            logger.error(f"error processing command: {e}")

    def set_command_callback(self, callback):
        self.on_command_callback = callback

    def publish_state(self, payload):
        try:
            publish_packet = mqtt5.PublishPacket(topic=IotConfig.TOPIC,payload=json.dumps(payload),qos=mqtt5.QoS.AT_LEAST_ONCE)
            
            packet = self.mqtt5_client.publish(publish_packet)
            logger.info(f"state published: {payload}")
        except Exception as e:
            logger.error(f"failed to publish state: {e}")




class ReplicaHardware:
    def __init__(self,iot_client):
        self.led1=LED(BoardPins.LED1_PIN)
        self.button=Button(BoardPins.BUTTON_PIN)
        self.iot_client=iot_client
        self.button.when_pressed = self.on_button_press
        self.iot_client.set_command_callback(self.remote_toggle)

    def get_state(self,status):
        return { 
            "client":IotConfig.CLIENT_ID,
            "status":status,
            "led1": "on" if self.led1.is_lit else "off",
            "timestamp": int(time.time())
        }
    def on_button_press(self):
        self.led1.toggle()
        logger.info("button pressed")
        # generate state 
        self.iot_client.publish_state(self.get_state("toggle"))
    def remote_toggle(self):
        self.led1.toggle()
        logger.info("remote toggle")
        self.iot_client.publish_state(self.get_state("remote"))

if __name__ == "__main__":
    try:
        logger.info("running service")
        aws_client = AWSIoTClient()
        aws_client.mqt_connect()
        system = ReplicaHardware(aws_client)
        logger.info("ready, listening for button change")
        pause()

    except KeyboardInterrupt:
        logger.info("stoping")
    except Exception as e:
        logger.error(f"error: {e}")

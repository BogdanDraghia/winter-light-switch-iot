import { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity";
import { iot, mqtt5 } from "aws-iot-device-sdk-v2";
import type { CommandProps } from "~/types/device";

export interface ShadowServiceConfig {
  region: string;
  identityPoolId: string;
  thingName: string;
  endpoint: string;
}

interface Topics {
  docs: string;
  get: string;
  getAccepted: string;
  update: string;
  state: string;
  connection: string;
}
interface ConnectionStatusCallback {
  (isConnected: boolean): void;
}

interface MessageCallback {
  (message: mqtt5.MessageReceivedEvent): void;
}

export class RealtimeDeviceService {
  private client: mqtt5.Mqtt5Client | null = null;
  private topics: Topics;
  private messageCallback: MessageCallback | null = null;

  constructor(private config: ShadowServiceConfig) {
    this.topics = {
      docs: `$aws/things/${config.thingName}/shadow/update/documents`,
      get: `$aws/things/${config.thingName}/shadow/get`,
      getAccepted: `$aws/things/${config.thingName}/shadow/get/accepted`,
      update: `$aws/things/${config.thingName}/shadow/update`,
      state: `${config.thingName}/state`,
      connection: `${config.thingName}/status`,
    };
  }

  async connect(cb: ConnectionStatusCallback): Promise<void> {
    if (this.client) return;
    try {
      // const credentials = await credentialsProvider();
      const credentialsProvider = fromCognitoIdentityPool({
        identityPoolId: this.config.identityPoolId,
        clientConfig: { region: this.config.region },
      });
      const credentials = await credentialsProvider();

      // the newWebsocketMqttBuilderWithSigv4Auth credentails providers expects a non resolved providers so recreate it
      // see https://github.com/aws/aws-iot-device-sdk-js-v2/blob/287d6fd6296ae4c92e08df6b3ae65bad232f0ae8/samples/browser/pub_sub_mqtt5/index.ts#L9 for a better implementation
      const provider = {
        getCredentials: () => ({
          aws_access_id: credentials.accessKeyId,
          aws_secret_key: credentials.secretAccessKey,
          aws_sts_token: credentials.sessionToken,
          aws_region: this.config.region,
        }),
      };
      //  Source https://github.com/awslabs/aws-crt-nodejs/blob/main/MQTT5-UserGuide.md
      const builder =
        iot.AwsIotMqtt5ClientConfigBuilder.newWebsocketMqttBuilderWithSigv4Auth(
          this.config.endpoint,
          {
            credentialsProvider: provider,
            region: this.config.region,
          },
        );

      builder.withConnectProperties({
        clientId: `${Date.now()}-demo-${crypto.randomUUID()}`,
        keepAliveIntervalSeconds: 30,
      });
      builder.withSessionBehavior(
        mqtt5.ClientSessionBehavior.RejoinPostSuccess,
      );
      builder.withRetryJitterMode(mqtt5.RetryJitterType.Full);
      builder.withMinReconnectDelayMs(1000);
      builder.withMaxReconnectDelayMs(30000);

      this.client = new mqtt5.Mqtt5Client(builder.build());

      this.client.on(
        "connectionSuccess",
        (eventData: mqtt5.ConnectionSuccessEvent) => {
          console.log(eventData);
          console.log("connect success");
          cb(true);
          this.subscribe();
        },
      );
      this.client.on(
        "connectionFailure",
        (eventData: mqtt5.ConnectionFailureEvent) => {
          console.log(eventData);
          console.log("connect failed");

          // cb.onConnectionChange(true);
          cb(false);
          // this.subscribe();
        },
      );
      this.client.on("disconnection", (eventData: mqtt5.DisconnectionEvent) => {
        console.log("MQTT Disconnected", eventData);
        cb(false);
      });

      this.client.on("stopped", (eventData: mqtt5.StoppedEvent) => {
        console.log(eventData);
        // cb.onConnectionChange(true);
        // this.subscribe();
        cb(false);
      });

      this.client.on(
        "messageReceived",
        (eventData: mqtt5.MessageReceivedEvent) => {
          console.log(eventData);
          if (this.messageCallback) {
            this.messageCallback(eventData);
          }
        },
      );
      // this.client.on("close", () => cb.onConnectionChange(false));

      this.client.start();
    } catch (err: any) {
      console.log(err);
      cb(false);
    }
  }

  async subscribe(): Promise<void> {
    if (!this.client) return;

    const suback = await this.client.subscribe({
      subscriptions: [
        { topicFilter: this.topics.docs, qos: mqtt5.QoS.AtLeastOnce },
        { topicFilter: this.topics.getAccepted, qos: mqtt5.QoS.AtLeastOnce },
        { topicFilter: this.topics.state, qos: mqtt5.QoS.AtLeastOnce },
        { topicFilter: this.topics.connection, qos: mqtt5.QoS.AtLeastOnce },
      ],
    });
    console.log("subscribed", suback);

    await this.client.publish({
      topicName: this.topics.get,
      payload: JSON.stringify({}),
      qos: mqtt5.QoS.AtLeastOnce,
    });
  }

  async sendCommand(command: CommandProps): Promise<void> {
    if (!this.client) return;

    await this.client.publish({
      topicName: this.topics.update,
      payload: JSON.stringify({ state: { desired: command } }),
      qos: mqtt5.QoS.AtLeastOnce,
    });
  }

  onMessage(callback: (message: mqtt5.MessageReceivedEvent) => void): void {
    this.messageCallback = callback;
  }
  // cleanup
  disconnect(): void {
    if (this.client) {
      this.client.removeAllListeners();
      this.client.stop();
      this.client = null;
      this.messageCallback = null;
    }
  }
}

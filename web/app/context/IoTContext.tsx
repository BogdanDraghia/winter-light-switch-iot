import type { mqtt5 } from "aws-iot-device-sdk-v2";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { RealtimeDeviceService } from "~/services/realtimeDeviceService";
import { useDeviceStore } from "~/store/deviceStore";
import type { CommandProps } from "~/types/device";

const config = {
  region: import.meta.env.VITE_AWS_REGION,
  identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID,
  thingName: import.meta.env.VITE_THING_NAME,
  endpoint: import.meta.env.VITE_IOT_ENDPOINT,
} as const;

interface IoTContextValue {
  sendCommand: (command: CommandProps) => void;
}

const IoTContext = createContext<IoTContextValue | null>(null);

export const IoTProvider = ({ children }: { children: ReactNode }) => {
  const serviceRef = useRef<RealtimeDeviceService | null>(null);
  const { setConnected, setDeviceOnline, setDeviceState } = useDeviceStore();

  useEffect(() => {
    serviceRef.current = new RealtimeDeviceService(config);

    serviceRef.current.connect((connected: boolean) => {
      setConnected(connected);
    });

    serviceRef.current.onMessage((event: mqtt5.MessageReceivedEvent) => {
      try {
        const topic = event.message.topicName;

        const payload = new TextDecoder().decode(
          event.message.payload as Uint8Array,
        );

        const data = JSON.parse(payload);

        console.log(payload);

        if (topic === `$aws/things/${config.thingName}/shadow/get/accepted`) {
          setDeviceState(data, true);
          return;
        }

        if (
          topic === `$aws/things/${config.thingName}/shadow/update/documents`
        ) {
          setDeviceState(data, false);
          return;
        }

        if (topic === `${config.thingName}/status`) {
          setDeviceOnline(data.status === "online");
        } else if (topic.startsWith(`${config.thingName}/`)) {
          setDeviceOnline(true);
        }
      } catch (err) {
        console.log("error onMessage mqtt", err);
      }
    });

    return () => {
      serviceRef.current?.disconnect();
    };
  }, [setConnected, setDeviceOnline, setDeviceState]);

  const sendCommand = useCallback((command: CommandProps) => {
    serviceRef.current?.sendCommand(command);
  }, []);

  return (
    <IoTContext.Provider value={{ sendCommand }}>
      {children}
    </IoTContext.Provider>
  );
};

export const useIoT = () => {
  const ctx = useContext(IoTContext);
  if (!ctx) throw new Error("useIoTerror");
  return ctx;
};

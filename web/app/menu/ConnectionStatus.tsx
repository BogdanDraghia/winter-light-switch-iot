import { useDeviceStore } from "~/store/deviceStore";
import style from "./ConnectionStatus.module.css";

const ConnectionStatus = () => {
  const isConnected = useDeviceStore((state) => state.isConnected);
  const isDeviceOnline = useDeviceStore((state) => state.isDeviceOnline);

  return (
    <ul className={style.connectionStatus}>
      <li>
        MQTT:
        <span className={isConnected ? style.online : style.offline}>
          {isConnected ? "Connected" : "Disconnected"}
        </span>
      </li>
      <li>
        Device:
        <span className={isDeviceOnline ? style.online : style.offline}>
          {isDeviceOnline ? "Online" : "Offline"}
        </span>
      </li>
    </ul>
  );
};

export default ConnectionStatus;

import type { Route } from "./+types/home";
import HouseScene from "~/house/HouseScene";
import { IoTProvider } from "~/context/IoTContext";
import ConnectionStatus from "~/menu/ConnectionStatus";
export function meta({}: Route.MetaArgs) {
  return [
    { title: "Demo IoT react app" },
    { name: "description", content: "Demo IoT react app" },
  ];
}

export default function Home() {
  return (
    <IoTProvider>
      <HouseScene />
      <ConnectionStatus />
    </IoTProvider>
  );
}

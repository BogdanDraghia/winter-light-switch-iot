export type LightEffect = "off" | "solid" | "candle";

export interface LevelState {
  level: number;
  effect: LightEffect;
  color: string;
}

export interface DeviceState {
  device: string;
  trigger: string;
  levels: LevelState[];
}

export interface CommandProps {
  target: "all" | "level";
  effect: LightEffect;
  level?: number;
  color?: string;
}

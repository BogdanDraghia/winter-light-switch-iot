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

export interface ShadowReported {
  device?: string;
  trigger?: string;
  levels: LevelState[];
}

export interface ShadowStateRoot {
  reported?: ShadowReported;
  desired?: ShadowReported;
}

export interface ShadowGetPayload {
  state?: ShadowStateRoot;
}

export interface ShadowUpdatePayload {
  current?: {
    state?: ShadowStateRoot;
  };
}

export type ShadowPayload = ShadowGetPayload & ShadowUpdatePayload;

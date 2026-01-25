import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import type { LevelState, ShadowPayload } from "~/types/device";

interface DeviceStore {
  isConnected: boolean;
  setConnected: (connected: boolean) => void;

  isDeviceOnline: boolean;
  setDeviceOnline: (online: boolean) => void;

  levels: LevelState[];
  updateLevel: (level: number, update: Partial<LevelState>) => void;
  setDeviceState: (shadowState: ShadowPayload, forceUpdate?: boolean) => void;
}

const defaultLevel = (): LevelState[] => [
  { level: 0, effect: "off", color: "#ffff" },
  { level: 1, effect: "off", color: "#ffff" },
  { level: 2, effect: "off", color: "#ffff" },
];

export const useDeviceStore = create<DeviceStore>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        isConnected: false,
        isDeviceOnline: false,

        setConnected: (connected) => set({ isConnected: connected }),
        setDeviceOnline: (online) => set({ isDeviceOnline: online }),

        levels: defaultLevel(),
        updateLevel: (level, update) =>
          set((state) => ({
            levels: state.levels.map((l, i) =>
              i === level ? { ...l, ...update } : l,
            ),
          })),

        setDeviceState: (payload, forceUpdate = false) => {
          const stateRoot = payload.current?.state || payload.state;

          if (!stateRoot?.reported?.levels) return;

          const trigger = stateRoot.reported.trigger;

          if (trigger === "shadow_sync" && !forceUpdate) {
            return;
          }

          const reportedLevels = stateRoot.reported.levels;

          const newLevels = reportedLevels.map((level: LevelState) => ({
            level: level.level,
            effect: level.effect,
            color: level.color,
          }));

          set({ levels: newLevels });
        },
      }),
      {
        name: "store",
        partialize: (state) => ({ levels: state.levels }),
      },
    ),
  ),
);

export const selectLevel = (levelIndex: number) => (state: DeviceStore) =>
  state.levels[levelIndex];

import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import type { LevelState } from "~/types/device";

interface DeviceStore {
  isConnected: boolean;
  setConnected: (connected: boolean) => void;

  isDeviceOnline: boolean;
  setDeviceOnline: (online: boolean) => void;

  levels: LevelState[];
  updateLevel: (level: number, update: Partial<LevelState>) => void;
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
        setConnected: (connected) => set({ isConnected: connected }),
        levels: defaultLevel(),
        updateLevel: (level, update) =>
          set((state) => ({
            levels: state.levels.map((l, i) =>
              i === level ? { ...l, ...update } : l
            ),
          })),
        isDeviceOnline: false,
        setDeviceOnline: (online) => set({ isDeviceOnline: online }),
      }),
      {
        name: "store",
        partialize: (state) => ({ levels: state.levels }),
      }
    )
  )
);

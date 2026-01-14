import ColorSlider from "~/menu/ColorSlider";
import style from "./ControlLight.module.css";
import { AnimatePresence, motion } from "motion/react";
import Candle from "~/icons/Candle";
import BulbOff from "~/icons/BulbOff";
import BulbOn from "~/icons/BulbOn";
import type { LightEffect } from "~/types/device";
import { useIoT } from "~/context/IoTContext";
import { selectLevel, useDeviceStore } from "~/store/deviceStore";
import ColorQuickSelect from "~/menu/ColorQuickSelect";

interface ControlLightProps {
  level: number;
  isExpanded: boolean;
  onLevelSelect: (level: number) => void;
}

// @todo create utils to reuse this on HouseLights.tsx
const getBackgroundColor = (effect: LightEffect, color: string): string => {
  if (effect === "off") return "transparent";
  if (effect === "candle") return "#deec64";
  return color;
};

const ControlLight = ({
  level,
  isExpanded,
  onLevelSelect,
}: ControlLightProps) => {
  const { sendCommand } = useIoT();

  const updateLevel = useDeviceStore((state) => state.updateLevel);
  const levelState = useDeviceStore(selectLevel(level));

  const effects: LightEffect[] = ["off", "solid", "candle"];
  const selectedButton = effects.indexOf(levelState.effect);

  const color = levelState.color;

  const handleColorChange = (hexColor: string) => {
    updateLevel(level, { color: hexColor });

    if (levelState.effect === "solid") {
      sendCommand({
        target: "level",
        level,
        effect: "solid",
        color: hexColor,
      });
    }
  };

  const handleEffectChange = (index: number) => {
    const effect = effects[index];
    updateLevel(level, { effect });
    sendCommand({
      target: "level",
      level,
      effect,
      color: levelState.color,
    });
  };

  const buttons = [
    { label: "off", icon: <BulbOff /> },
    { label: "solid_color", icon: <BulbOn /> },
    { label: "candle", icon: <Candle /> },
  ];

  const isColorSelected = selectedButton === 1;
  const showColorSlider = isExpanded && isColorSelected;
  return (
    <AnimatePresence>
      <motion.div
        className={style.controlLight}
        onClick={(e) => {
          e.stopPropagation();
          if (!isExpanded) {
            onLevelSelect(level);
          }
        }}
        initial={false}
        animate={{
          width: showColorSlider ? 100 : 40,
          height: isExpanded ? 136 : 40,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className={style.colorSection}>
          <motion.div
            className={style.buttonContainer}
            initial={false}
            animate={{
              y: isExpanded ? 0 : (1 - selectedButton) * 48,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <motion.div
              className={style.selectedButton}
              style={{
                backgroundColor: getBackgroundColor(
                  levelState.effect,
                  levelState.color
                ),
              }}
              initial={false}
              animate={{
                y: selectedButton * 48,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />

            {buttons.map((button, index) => (
              <div
                key={button.label}
                onClick={() => isExpanded && handleEffectChange(index)}
                className={style.button}
              >
                {button.icon}
              </div>
            ))}
          </motion.div>

          <AnimatePresence>
            {showColorSlider && (
              <motion.div
                className={style.colorSliderContainer}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeIn" }}
              >
                <ColorSlider color={color} onChange={handleColorChange} />
                <ColorQuickSelect
                  currentLevel={level}
                  onColorSelect={handleColorChange}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ControlLight;

import Hue from "@uiw/react-color-hue";
import { hsvaToHex, hexToHsva } from "@uiw/color-convert";
import styles from "./ColorSlider.module.css";
import { useMemo } from "react";

interface ColorSliderProps {
  color: string;
  onChange: (hexColor: string) => void;
}

const ColorSlider = ({ color, onChange }: ColorSliderProps) => {
  const hsva = useMemo(() => hexToHsva(color), [color]);

  const handleChange = (newHue: { h: number }) => {
    const newColor = hsvaToHex({ ...hsva, h: newHue.h });
    onChange(newColor);
  };

  return (
    <div className={styles.colorSliderWrapper}>
      <Hue
        hue={hsva.h}
        style={{
          width: 16,
          height: 120,
          borderRadius: 6,
        }}
        direction="vertical"
        onChange={handleChange}
      />
    </div>
  );
};

export default ColorSlider;

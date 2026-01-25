import Hue from "@uiw/react-color-hue";
import { hsvaToHex, hexToHsva } from "@uiw/color-convert";
import styles from "./ColorSlider.module.css";
import { useMemo, useRef } from "react";

interface ColorSliderProps {
  color: string;
  onChange: (hexColor: string) => void;
  onChangeComplete?: (hexColor: string) => void;
}

const ColorSlider = ({ color, onChange, onChangeComplete }: ColorSliderProps) => {
  const hsva = useMemo(() => hexToHsva(color), [color]);
  const lastColorRef = useRef(color);

  const handleChange = (newHue: { h: number }) => {
    const newColor = hsvaToHex({ ...hsva, h: newHue.h });
    lastColorRef.current = newColor;
    onChange(newColor);
  };

  const handlePointerUp = () => {
    onChangeComplete?.(lastColorRef.current);
  };

  return (
    <div className={styles.colorSliderWrapper} onPointerUp={handlePointerUp}>
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

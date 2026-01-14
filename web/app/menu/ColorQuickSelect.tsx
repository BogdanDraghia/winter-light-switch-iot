import { useDeviceStore } from "~/store/deviceStore";
import style from "./ColorQuickSelect.module.css";

interface ColorQuickSelectProps {
  currentLevel: number;
  onColorSelect: (color: string) => void;
}

const ColorQuickSelect = ({
  currentLevel,
  onColorSelect,
}: ColorQuickSelectProps) => {
  const levels = useDeviceStore((state) => state.levels);
  const currentColor = levels[currentLevel].color;
  const colorSet = new Set(levels.map((l) => l.color));

  if (colorSet.size > 1) {
    colorSet.delete(currentColor);
  }

  return (
    <div className={style.quickColors}>
      {[...colorSet].map((c) => (
        <div
          key={c}
          className={style.quickColorBox}
          style={{ backgroundColor: c }}
          onClick={() => onColorSelect(c)}
        />
      ))}
    </div>
  );
};

export default ColorQuickSelect;

import type { LevelState } from "~/types/device";
import style from "./HouseLights.module.css";

interface HouseLightsProps {
  levels: LevelState[];
}

const getLightColor = (level: LevelState): string => {
  if (level.effect === "off") return "transparent";
  if (level.effect === "candle") return "#ffff26";
  return level.color;
};

const HouseLights = ({ levels }: HouseLightsProps) => {
  return (
    <div className={style.houseLights}>
      {levels.map((level) => (
        <div key={level.level} className={style.lightWrap}>
          <div
            key={level.level}
            style={{ backgroundColor: getLightColor(levels[level.level]) }}
            className={style.light}
          />
          {level.level}
        </div>
      ))}
    </div>
  );
};

export default HouseLights;

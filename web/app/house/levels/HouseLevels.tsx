import type { LevelState } from "~/types/device";
import HouseLevel from "./HouseLevel";
import ControlLight from "../light/ControlLight";
import styles from "./HouseLevels.module.css";

interface HouseLevelsProps {
  currentLevel: number | null;
  onLevelSelect: (level: number | null) => void;
  levels: LevelState[];
}

const HouseLevels = ({
  currentLevel,
  onLevelSelect,
  levels,
}: HouseLevelsProps) => {
  return (
    <div className={styles.houseLevels}>
      {levels.map((level) => (
        <HouseLevel
          key={level.level}
          level={level.level}
          currentLevel={currentLevel}
          onSelect={onLevelSelect}
        >
          <ControlLight
            level={level.level}
            isExpanded={currentLevel === level.level}
            onLevelSelect={onLevelSelect}
          />
        </HouseLevel>
      ))}
    </div>
  );
};

export default HouseLevels;

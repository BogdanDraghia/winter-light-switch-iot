import style from "./HouseLevels.module.css";

interface HouseLevelProps {
  level: number;
  currentLevel: number | null;
  onSelect: (level: number | null) => void;
  children?: any;
}

const HouseLevel = ({
  level,
  currentLevel,
  onSelect,
  children,
}: HouseLevelProps) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(currentLevel === level ? null : level);
  };

  return (
    <div onClick={handleClick} className={style.houseLevel}>
      {children}
    </div>
  );
};

export default HouseLevel;

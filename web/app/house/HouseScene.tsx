import styles from "./HouseScene.module.css";
import { useMemo, useState } from "react";
import LayerWrap from "./layers/LayerWrap";
import { Layer1, Layer0, Tree, Cat } from "./layers";
import { motion } from "motion/react";
import { useDeviceStore } from "~/store/deviceStore";
import HouseLights from "./light/HouseLights";
import HouseLevels from "./levels/HouseLevels";
import { useParallaxEffect } from "~/hooks/useParallaxEffect";

const cameraConfig = [
  { scale: 1, y: 0 }, // all levels - default
  { scale: 1.5, y: -100 }, // level 0
  { scale: 1.5, y: 200 }, // level 1
  { scale: 1.5, y: 400 }, // level 2
] as const;

const HouseScene = () => {
  const [level, setLevel] = useState<number | null>(null);

  const levels = useDeviceStore((state) => state.levels);
  const { interiorX, interiorY, treeX, treeY, houseX, houseY } =
    useParallaxEffect();

  const camera = useMemo(
    () => (level === null ? cameraConfig[0] : cameraConfig[level + 1]),
    [level]
  );

  // const requestOrientationPermission = async () => {
  //   if (
  //     typeof DeviceOrientationEvent !== "undefined" &&
  //     typeof (DeviceOrientationEvent as any).requestPermission === "function"
  //   ) {
  //     try {
  //       const permission = await (
  //         DeviceOrientationEvent as any
  //       ).requestPermission();
  //       if (permission === "granted") {
  //         window.addEventListener("deviceorientation", handleDeviceOrientation);
  //         setPermissionGranted(true);
  //       }
  //     } catch (error) {
  //       console.error("Orientation permission denied:", error);
  //     }
  //   } else {
  //     window.addEventListener("deviceorientation", handleDeviceOrientation);
  //     setPermissionGranted(true);
  //   }
  // };

  return (
    <div className={styles.container} onClick={() => setLevel(null)}>
      {/* 
      {isMobile && !permissionGranted && (
        <button
          onClick={requestOrientationPermission}
        >
          enable iphone tilt
        </button>
      )} */}

      <motion.div
        className={styles.camera}
        animate={{
          scale: camera.scale,
          y: camera.y,
        }}
        transition={{
          duration: 1.2,
          ease: [0.4, 0, 0.2, 1],
        }}
      >
        <motion.div className={styles.houseSection}>
          {/* <div className={styles.info}>
          Info: {isMobile ? "tilt" : "mouse"}: x: {mousePos.x.toFixed(2)} y:{" "}
          {mousePos.y.toFixed(2)}
        </div> */}
          <HouseLevels
            levels={levels}
            currentLevel={level}
            onLevelSelect={setLevel}
          />
          <LayerWrap className={styles.layer0Mask}>
            <LayerWrap className={styles.layer0} x={interiorX} y={interiorY}>
              <Layer0 />
            </LayerWrap>
            <LayerWrap className={styles.treeLayer} x={treeX} y={treeY}>
              <Tree />
            </LayerWrap>
          </LayerWrap>

          <LayerWrap className={styles.layer1} x={houseX} y={houseY}>
            <Layer1 />
            <Cat className={styles.catLayer} />
            <HouseLights levels={levels} />
          </LayerWrap>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default HouseScene;

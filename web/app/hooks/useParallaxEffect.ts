// AI help
import type { MotionValue } from "motion";
import { useMotionValue, useSpring, useTransform } from "motion/react";
import { useEffect, useCallback } from "react";

interface ParallaxValues {
  interiorX: MotionValue<number>;
  interiorY: MotionValue<number>;
  treeX: MotionValue<number>;
  treeY: MotionValue<number>;
  houseX: MotionValue<number>;
  houseY: MotionValue<number>;
}

export const useParallaxEffect = (): ParallaxValues => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { stiffness: 100, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 100, damping: 20 });

  // Transform values for different layers
  const interiorX = useTransform(springX, (v) => v * -10);
  const interiorY = useTransform(springY, (v) => v * -5);
  const treeX = useTransform(springX, (v) => v * -3);
  const treeY = useTransform(springY, (v) => v * -2);
  const houseX = useTransform(springX, (v) => v * 8);
  const houseY = useTransform(springY, (v) => v * 5);

  const handleDeviceOrientation = useCallback(
    (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0;
      const beta = e.beta ?? 0;

      const xPoint = Math.max(-1, Math.min(1, gamma / 45));
      const yPoint = Math.max(-1, Math.min(1, (beta - 60) / 45));

      mouseX.set(xPoint);
      mouseY.set(yPoint);
    },
    [mouseX, mouseY]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const xPoint = (e.clientX - innerWidth / 2) / (innerWidth / 2);
      const yPoint = (e.clientY - innerHeight / 2) / (innerHeight / 2);
      mouseX.set(xPoint);
      mouseY.set(yPoint);
    },
    [mouseX, mouseY]
  );

  useEffect(() => {
    const hasOrientation = typeof DeviceOrientationEvent !== "undefined";

    window.addEventListener("mousemove", handleMouseMove);

    // @todo device orientation is enabled for non ios devices, next add request button to activate tilt on mobile
    if (hasOrientation && "ontouchstart" in window) {
      if (
        typeof (DeviceOrientationEvent as any).requestPermission !== "function"
      ) {
        window.addEventListener("deviceorientation", handleDeviceOrientation);
      }
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("deviceorientation", handleDeviceOrientation);
    };
  }, [handleMouseMove, handleDeviceOrientation]);

  return {
    interiorX,
    interiorY,
    treeX,
    treeY,
    houseX,
    houseY,
  };
};

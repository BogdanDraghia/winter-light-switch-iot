import { motion, MotionValue } from "motion/react";
import type { ReactNode } from "react";

interface LayerWrapProps {
  x?: MotionValue<number>;
  y?: MotionValue<number>;
  className?: string;
  children: ReactNode;
}

const LayerWrap = ({ x, y, children, className }: LayerWrapProps) => {
  return (
    <motion.div className={className} style={{ x, y }}>
      {children}
    </motion.div>
  );
};

export default LayerWrap;

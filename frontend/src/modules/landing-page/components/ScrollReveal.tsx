import { type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type Direction = "up" | "down" | "left" | "right" | "scale";

interface ScrollRevealProps {
  children: ReactNode;
  direction?: Direction;
  delay?: number;
  duration?: number;
  /** When `true` the animation plays only once. Default: `false` */
  once?: boolean;
  /** Additional class names forwarded to the motion wrapper */
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Hidden‑state map                                                  */
/* ------------------------------------------------------------------ */

const hidden: Record<Direction, { opacity: number; x?: number; y?: number; scale?: number }> = {
  up: { opacity: 0, y: 40 },
  down: { opacity: 0, y: -40 },
  left: { opacity: 0, x: -50 },
  right: { opacity: 0, x: 50 },
  scale: { opacity: 0, scale: 0.94 },
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function ScrollReveal({
  children,
  direction = "up",
  delay = 0,
  duration = 0.65,
  once = false,
  className,
}: ScrollRevealProps) {
  const prefersReducedMotion = useReducedMotion();

  /* When the user prefers reduced motion we skip all translations and
     scale and just do a simple opacity fade with no delay. */
  if (prefersReducedMotion) {
    return (
      <motion.div
        className={className}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once, amount: 0.15, margin: "0px 0px -60px 0px" }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={hidden[direction]}
      whileInView={{
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
      }}
      viewport={{
        once,
        amount: 0.15,
        margin: "0px 0px -60px 0px",
      }}
      transition={{
        duration,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
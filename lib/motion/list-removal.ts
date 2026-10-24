import type { Transition, Variants } from "framer-motion";

export const LIST_REMOVAL_DURATION_MS = 260;

export const LIST_ITEM_TRANSITION: Transition = {
  duration: LIST_REMOVAL_DURATION_MS / 1000,
  ease: [0.22, 1, 0.36, 1],
};

export const LIST_ITEM_VARIANTS: Variants = {
  initial: { opacity: 0, y: 8, scale: 0.98, height: "auto" },
  animate: { opacity: 1, y: 0, scale: 1, height: "auto" },
  exit: { opacity: 0, x: 30, scale: 0.96, height: 0 },
};

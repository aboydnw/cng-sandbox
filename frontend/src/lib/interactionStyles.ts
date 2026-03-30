import type { SystemStyleObject } from "@chakra-ui/react";

export const EASE_OUT_EXPO = "cubic-bezier(0.32, 0.72, 0, 1)";

export function transition(duration = 200): string {
  return `transform ${duration}ms ${EASE_OUT_EXPO}, opacity ${duration}ms ${EASE_OUT_EXPO}`;
}

export const cardHover: SystemStyleObject = {
  transform: "translateY(-2px)",
  shadow: "md",
};

export const cardActive: SystemStyleObject = {
  transform: "scale(0.985)",
};

export const focusRing: SystemStyleObject = {
  outline: "2px solid",
  outlineColor: "rgba(207, 63, 2, 0.4)",
  outlineOffset: "2px",
};

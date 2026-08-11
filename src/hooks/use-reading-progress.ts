"use client";

import { useEffect } from "react";
import { useMotionValue, type MotionValue } from "motion/react";

export function useReadingProgress(): MotionValue<number> {
  const progress = useMotionValue(0);

  useEffect(() => {
    function handleScroll() {
      const scrollTop =
        document.documentElement.scrollTop || document.body.scrollTop;
      const scrollHeight =
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight;
      if (scrollHeight <= 0) {
        progress.set(0);
        return;
      }
      const value = Math.min(
        100,
        Math.round((scrollTop / scrollHeight) * 100),
      );
      progress.set(value);
    }

    handleScroll();
    document.addEventListener("scroll", handleScroll, { passive: true });
    return () => document.removeEventListener("scroll", handleScroll);
  }, [progress]);

  return progress;
}

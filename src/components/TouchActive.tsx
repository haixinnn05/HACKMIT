"use client";

import { useEffect } from "react";

/**
 * iOS Safari only applies :active styles once the document has a touchstart
 * listener. Without this the press-and-rebound never shows on an iPhone.
 */
export function TouchActive() {
  useEffect(() => {
    const noop = () => {};
    document.addEventListener("touchstart", noop, { passive: true });
    return () => document.removeEventListener("touchstart", noop);
  }, []);
  return null;
}

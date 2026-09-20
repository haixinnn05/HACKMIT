"use client";

import { useEffect, useRef } from "react";

/**
 * Brings an element back into view when a value changes.
 *
 * A server action that shrinks the page can leave the reader scrolled past the
 * one thing that changed. This puts the result of their tap in front of them.
 * It does nothing on first render, so opening a page never jumps.
 */
export function RevealOnChange({ targetId, value }: { targetId: string; value: string }) {
  const previous = useRef(value);
  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(targetId)?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [targetId, value]);
  return null;
}

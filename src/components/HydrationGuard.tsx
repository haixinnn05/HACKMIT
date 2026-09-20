"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __stopCursorRefStrip?: () => void;
  }
}

/**
 * The embedded preview browser annotates buttons and links with extra
 * attributes before React hydrates. Next then reports a hydration mismatch
 * and covers the demo with the red "1 Issue" overlay. Real compile and
 * runtime errors are left alone.
 */
function isCursorHydrationOverlay(text: string): boolean {
  if (/ReferenceError|TypeError|SyntaxError|Module not found|Failed to compile/i.test(text)) {
    return false;
  }
  return /hydration|data-cursor-ref|server rendered HTML didn't match/i.test(text);
}

function dismissHydrationOverlay() {
  for (const portal of document.querySelectorAll("nextjs-portal")) {
    const text = portal.shadowRoot?.textContent ?? portal.textContent ?? "";
    if (!isCursorHydrationOverlay(text)) continue;
    const close = portal.shadowRoot?.querySelector<HTMLElement>(
      "button[aria-label='Close'], button[aria-label='Dismiss'], button[title='Close']",
    );
    close?.click();
    portal.remove();
  }
}

export function HydrationGuard() {
  useEffect(() => {
    window.__stopCursorRefStrip?.();
    dismissHydrationOverlay();
    const observer = new MutationObserver(dismissHydrationOverlay);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}

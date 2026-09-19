/**
 * The Mozaic mark: two people joined by one continuous ribbon.
 *
 * The artwork is a gradient illustration, so it ships as an image rather than
 * an inline vector. `white` is a flat silhouette for violet surfaces, where the
 * colour version loses its contrast. Both are decorative beside a visible name,
 * so they carry empty alt text; use `label` where the mark stands alone.
 */
export function MozaicMark({
  tone = "color", className = "h-8 w-auto", label,
}: { tone?: "color" | "white"; className?: string; label?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={tone === "white" ? "/brand/mozaic-mark-white.png" : "/brand/mozaic-mark.png"}
      alt={label ?? ""} aria-hidden={label ? undefined : true}
      width={570} height={512} decoding="async" draggable={false}
      className={`select-none ${className}`}
    />
  );
}

/** Mark and wordmark together, as supplied. */
export function MozaicLockup({ className = "h-7 w-auto" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/mozaic-lockup.png" alt="Mozaic" width={863} height={240}
      decoding="async" draggable={false} className={`select-none ${className}`}
    />
  );
}

/**
 * Soft hills behind a screen header. Decorative only, so it is hidden from
 * assistive technology and never sits behind body text.
 */
export function Hills({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 430 150" preserveAspectRatio="none" aria-hidden
      className={`pointer-events-none absolute inset-x-0 bottom-0 h-[4.5rem] w-full ${className}`}
    >
      <circle cx="340" cy="58" r="16" fill="#fde9c8" opacity="0.85" />
      <path d="M0 96 58 58l44 30 50-46 62 52 54-34 60 44 52-30 50 28v88H0z" fill="#dcd8fb" opacity="0.75" />
      <path d="M0 118 70 84l56 30 66-40 72 46 60-30 106 44v16H0z" fill="#cdc6f8" opacity="0.7" />
      <path d="M0 134c60-18 120-18 190-6s150 12 240-10v32H0z" fill="#ffffff" />
    </svg>
  );
}

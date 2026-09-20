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

/**
 * A mountain range along the bottom edge of the passport ticket, echoing the
 * hills in the screen headers. It is tonal, not coloured: lighter and darker
 * violets only, so it reads as texture and the white text above it stays the
 * brightest thing on the ticket. The peaks rise toward the right, where the
 * ticket is empty, and stay low under the holder's details on the left.
 */
export function TicketRange() {
  return (
    <svg
      viewBox="0 0 400 96" preserveAspectRatio="none" aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full"
    >
      <defs>
        <linearGradient id="ticket-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.20" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <circle cx="352" cy="26" r="12" fill="#ffffff" opacity="0.16" />
      {/* far range */}
      <path d="M0 96V84l40-6 44 5 46-9 44 6 46-10 40 6 34-34 30 22 28-20 26 18 22-8v46z" fill="url(#ticket-haze)" />
      {/* middle range */}
      <path d="M0 96v-7l52-5 50 4 56-7 52 5 50-8 34-24 32 20 30-14 44 16v20z" fill="#ffffff" opacity="0.10" />
      {/* near range, darker than the ticket so the scene has depth */}
      <path d="M0 96v-5l70-4 66 3 72-5 62 3 46-14 40 12 44-8v18z" fill="#2a1596" opacity="0.38" />
    </svg>
  );
}

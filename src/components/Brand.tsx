/**
 * The Trial Passport mark: two people meeting inside one heart-shaped loop.
 * It is the single hand-drawn vector in the project; every other icon comes
 * from Phosphor so weights stay consistent.
 */
export function PassportMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="5" r="2.1" fill="currentColor" stroke="none" />
      <circle cx="21" cy="5" r="2.1" fill="currentColor" stroke="none" />
      <path d="M16 27 6.8 18.6a5.6 5.6 0 0 1 7.9-7.9L16 12l1.3-1.3a5.6 5.6 0 0 1 7.9 7.9L20 23.5" />
      <path d="m12.5 19.5 3.5 3.5 6-7" />
    </svg>
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

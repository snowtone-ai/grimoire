type MacaronIconProps = {
  className?: string;
  title?: string;
};

/** A small, original 2D treat asset. It stays SVG so the reward remains crisp
 * on high-density screens without introducing an additional image download. */
export function MacaronIcon({ className, title }: MacaronIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id="macaron-shell" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb7d2" />
          <stop offset="1" stopColor="#de6f9e" />
        </linearGradient>
        <linearGradient id="macaron-cream" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff8dd" />
          <stop offset="1" stopColor="#f0d9a4" />
        </linearGradient>
      </defs>
      <path d="M12 25.5C12 16.4 20.9 10 32 10s20 6.4 20 15.5c0 3.3-1.2 5.7-3.4 7.9H15.4C13.2 31.2 12 28.8 12 25.5Z" fill="url(#macaron-shell)" />
      <path d="M15.4 33.4h33.2c-1.6 2.3-3.2 4-5.2 5.6H20.6c-2-1.6-3.6-3.3-5.2-5.6Z" fill="#c85c87" />
      <path d="M17.3 38.2h29.4c-1.1 3.2-3.5 5.3-6.8 6.6H24.1c-3.3-1.3-5.7-3.4-6.8-6.6Z" fill="url(#macaron-cream)" />
      <path d="M12 45.2c0-4 2-7.6 5.2-10h29.6c3.2 2.4 5.2 6 5.2 10C52 54.4 43.1 59 32 59s-20-4.6-20-13.8Z" fill="url(#macaron-shell)" />
      <path d="M20.5 19.3c2.8-2.5 6.7-3.9 11.5-3.9 4.7 0 8.7 1.4 11.5 3.9" fill="none" stroke="#ffd6e5" strokeLinecap="round" strokeWidth="2.8" opacity=".85" />
      <circle cx="23" cy="47.2" r="1.4" fill="#ffd6e5" opacity=".7" />
      <circle cx="42" cy="48.8" r="1.1" fill="#ffd6e5" opacity=".7" />
    </svg>
  );
}

// Mismo dibujo que public/favicon.svg
export default function Logo({ size = 36 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#7b1e3a" />
      <path d="M32 21C26 16.5 18 16.5 11 19v27c7-2.5 15-2.5 21 2z" fill="#f8ece6" />
      <path d="M32 21c6-4.5 14-4.5 21-2v27c-7-2.5-15-2.5-21 2z" fill="#ecd5c8" />
      <path d="M32 21v27" stroke="#7b1e3a" strokeWidth="1.6" opacity=".35" />
      <path d="M17 26c4-1 8-.8 11 .8M17 32c4-1 8-.8 11 .8M17 38c4-1 8-.8 11 .8" fill="none" stroke="#7b1e3a" strokeWidth="1.7" strokeLinecap="round" opacity=".35" />
      <path d="M40 17.5h7.5V34L43.75 30.5 40 34z" fill="#e6b066" />
    </svg>
  )
}

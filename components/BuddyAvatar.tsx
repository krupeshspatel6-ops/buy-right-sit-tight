// A tiny, lightweight avatar of Krupesh's assistant (pink beanie, teal shirt),
// used on the chat launcher and the mobile panel header — no 3D, no cost.
export default function BuddyAvatar({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden role="img">
      <circle cx="24" cy="24" r="24" fill="#fdf6ec" />
      {/* shoulders / shirt */}
      <path d="M9 47 a15 15 0 0 1 30 0 Z" fill="#3bb39a" />
      {/* head */}
      <circle cx="24" cy="23" r="11" fill="#c08a5f" />
      {/* beanie */}
      <path d="M12.5 22 a11.5 11.5 0 0 1 23 0 Z" fill="#d6337f" />
      <rect x="12" y="20.4" width="24" height="3.4" rx="1.7" fill="#b02a6a" />
      {/* eyes + smile */}
      <circle cx="20" cy="23.5" r="1.5" fill="#2a2a2a" />
      <circle cx="28" cy="23.5" r="1.5" fill="#2a2a2a" />
      <path d="M20 27.5 q4 3 8 0" stroke="#2a2a2a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

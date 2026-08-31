// The cover paints itself: the painted region's width tracks how much of the
// wall is painted (percent — 2% per chapter, 50 chapters total). At 0 the wall
// is blank and primed; at 100 the paint reaches the far end where the man sits.

export default function CoverArt({ progress }: { progress: number }) {
  const p = Math.max(0, Math.min(100, progress));
  const e = (p / 100) * 2200; // painted frontier x-coordinate

  const streaks: number[] = [];
  for (let x = 90; x < e - 70; x += 150) streaks.push(x);

  const paintedPath =
    `M0 0 H${e} ` +
    `C${e + 15} 40 ${e - 15} 70 ${e + 2} 110 ` +
    `C${e + 19} 150 ${e - 12} 185 ${e + 4} 225 ` +
    `C${e + 20} 265 ${e - 10} 300 ${e + 6} 340 ` +
    `C${e + 18} 372 ${e - 2} 388 ${e + 4} 400 H0 Z`;

  return (
    <svg
      viewBox="0 0 2200 500"
      preserveAspectRatio="xMidYMid slice"
      className="h-[30vh] w-full"
      role="img"
      aria-label={`A wide room with a wall ${p} percent painted; far to the right a man sits in a folding chair with a mug, watching the paint dry.`}
    >
      {/* unpainted, primed wall */}
      <rect x="0" y="0" width="2200" height="400" fill="#f0ebe0" />

      {/* painted (drying) area — grows one percent per chapter */}
      {p > 0 && <path d={paintedPath} fill="#7fa3d1" />}
      {streaks.map((x, i) => (
        <rect
          key={x}
          x={x}
          y={18 + (i % 3) * 9}
          width="40"
          height={372 - (i % 3) * 18}
          rx="20"
          fill={i % 2 === 0 ? "#8db0da" : "#6f96c9"}
          opacity={i % 2 === 0 ? 0.55 : 0.5}
        />
      ))}

      {/* painter's tape along the ceiling line */}
      <rect x="0" y="6" width="2200" height="13" fill="#e8c86e" />

      {/* floor */}
      <rect x="0" y="400" width="2200" height="100" fill="#d9d2c4" />
      <rect x="0" y="396" width="2200" height="7" fill="#c4bca9" />

      {/* drop cloth, tray, and resting roller — always ready */}
      <path d="M520 420 L860 420 L895 488 L485 488 Z" fill="#e7e1d3" />
      <path d="M600 452 L720 452 L708 478 L612 478 Z" fill="#55524a" />
      <path d="M608 456 L712 456 L704 472 L616 472 Z" fill="#6f96c9" />
      <g transform="rotate(-24 738 430)">
        <rect x="718" y="424" width="70" height="18" rx="9" fill="#8db0da" />
        <rect x="786" y="429" width="46" height="7" rx="3" fill="#8a857a" />
        <rect x="828" y="424" width="12" height="17" rx="4" fill="#b3372f" />
      </g>

      {/* the man and his chair, far across the room */}
      <g transform="translate(950 0)">
        <g stroke="#2a2a2a" strokeWidth="9" strokeLinecap="round" fill="none">
          <line x1="560" y1="330" x2="640" y2="330" />
          <line x1="566" y1="330" x2="600" y2="398" />
          <line x1="634" y1="330" x2="596" y2="398" />
          <line x1="638" y1="330" x2="655" y2="240" />
        </g>
        <rect
          x="644"
          y="236"
          width="24"
          height="70"
          rx="9"
          fill="#2a2a2a"
          transform="rotate(10 656 271)"
        />
        <g stroke="#26241f" strokeWidth="16" strokeLinecap="round" fill="none">
          <path d="M612 318 L556 336 L552 392" />
        </g>
        <path d="M552 388 L520 396 A8 8 0 0 0 522 406 L554 404 Z" fill="#26241f" />
        <path
          d="M596 322 C588 300 588 262 600 244 C612 230 640 232 646 252 C652 274 650 306 642 326 Z"
          fill="#3c3a36"
        />
        <path
          d="M614 258 C598 264 586 272 578 282"
          stroke="#3c3a36"
          strokeWidth="15"
          strokeLinecap="round"
          fill="none"
        />
        <rect x="556" y="272" width="26" height="24" rx="4" fill="#faf7f0" />
        <path
          d="M556 278 a8 8 0 1 0 0 12"
          stroke="#faf7f0"
          strokeWidth="5"
          fill="none"
        />
        <path
          d="M563 264 c-4 -6 4 -10 0 -16 M573 264 c-4 -6 4 -10 0 -16"
          stroke="#c4bca9"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="618" cy="216" r="24" fill="#c08a5f" />
        {/* profile face: nose, eye, brow, mouth, ear */}
        <path d="M597 210 C589 214 588 220 596 223 Z" fill="#c08a5f" />
        <circle cx="603" cy="211" r="2.6" fill="#26241f" />
        <path d="M599 206 L608 205" stroke="#26241f" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M598 228 q5 3 10 1" stroke="#26241f" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="627" cy="217" r="5" fill="#b07a52" />
        <path
          d="M600 208 a24 24 0 0 1 38 -8 c2 -10 -8 -18 -20 -18 c-14 0 -22 12 -18 26 Z"
          fill="#26241f"
        />
      </g>
    </svg>
  );
}

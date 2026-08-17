"use client";

// The sitting man introduces himself — a speech bubble that types out the
// idea of the book, one line at a time. Click the bubble to skip ahead.

import { useCallback, useEffect, useRef, useState } from "react";

const LINES = [
  "Hi — I'm Krupesh.",
  "Every investor quotes the old line: buy right and sit tight. Almost nobody proves they can actually do it.",
  "So I'm proving it in public. Every stock I buy with my own money becomes a chapter in this book — timestamped the day it happens.",
  "A chapter only closes when I sell. And nothing is ever edited after it's published — my mistakes stay on the page.",
  "One hundred chapters. One wall. I'll be right here, watching the paint dry.",
];

const TYPE_MS = 26; // per character
const HOLD_MS = 3200; // pause on a finished line
const LOOP_HOLD_MS = 9000; // longer sit on the last line before starting over

export default function CoverIntro() {
  const [line, setLine] = useState(0);
  const [chars, setChars] = useState(0);
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const full = LINES[line];
  const done = chars >= full.length;

  const next = useCallback(() => {
    if (holdRef.current) clearTimeout(holdRef.current);
    setLine((l) => (l + 1) % LINES.length);
    setChars(0);
  }, []);

  useEffect(() => {
    if (!done) {
      const t = setTimeout(() => setChars((c) => c + 1), TYPE_MS);
      return () => clearTimeout(t);
    }
    holdRef.current = setTimeout(next, line === LINES.length - 1 ? LOOP_HOLD_MS : HOLD_MS);
    return () => {
      if (holdRef.current) clearTimeout(holdRef.current);
    };
  }, [chars, done, line, next]);

  return (
    <button
      type="button"
      onClick={() => (done ? next() : setChars(full.length))}
      aria-label="The author introduces the book. Click to continue."
      className="absolute right-[16%] top-[26%] max-w-[200px] sm:max-w-[290px] cursor-pointer rounded-xl border border-wall-dark bg-white/95 px-4 py-3 text-left text-xs sm:text-sm leading-relaxed shadow-md"
    >
      {full.slice(0, chars)}
      {!done && <span className="animate-pulse">▍</span>}
      <span
        aria-hidden
        className="absolute -bottom-[7px] right-8 h-3.5 w-3.5 rotate-45 border-b border-r border-wall-dark bg-white/95"
      />
    </button>
  );
}

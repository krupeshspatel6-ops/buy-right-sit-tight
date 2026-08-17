"use client";

// The sitting man introduces himself — a typing speech bubble on the open
// wall (left side, clear of his face). Optional voice narration via the
// browser's built-in speech synthesis; off until the reader taps the
// speaker (browsers block autoplay audio without a gesture).

import { useCallback, useEffect, useRef, useState } from "react";

const LINES = [
  "Hi — I'm Krupesh. I'm 15.",
  "Honestly? I don't really know how to pick stocks yet. That's the whole point of this book.",
  "My dad said I was careless because it wasn't my money at stake. So now it is — every dollar I've saved.",
  "This is me learning in public, with real money, one stock at a time. Not advice — just my journey.",
  "Buy right, sit tight… and watch the paint dry with me.",
];

const TYPE_MS = 26; // per character
const HOLD_MS = 3200; // pause on a finished line
const LOOP_HOLD_MS = 9000; // longer sit on the last line before starting over

export default function CoverIntro() {
  const [line, setLine] = useState(0);
  const [chars, setChars] = useState(0);
  const [voice, setVoice] = useState(false);
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceRef = useRef(false);

  const full = LINES[line];
  const done = chars >= full.length;

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  }, []);

  const next = useCallback(() => {
    if (holdRef.current) clearTimeout(holdRef.current);
    setLine((l) => (l + 1) % LINES.length);
    setChars(0);
  }, []);

  // typing + auto-advance
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

  // speak each new line when voice is on
  useEffect(() => {
    if (voice) speak(full);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, voice]);

  // stop any speech when the component unmounts
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleVoice = useCallback(() => {
    const nextOn = !voiceRef.current;
    voiceRef.current = nextOn;
    setVoice(nextOn); // the [line, voice] effect speaks the current line when this flips on
    if (!nextOn && typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return (
    <div className="absolute left-[4%] top-[9%] max-w-[190px] sm:max-w-[280px]">
      <div className="relative rounded-xl border border-wall-dark bg-white/95 shadow-md">
        <div
          role="button"
          tabIndex={0}
          onClick={() => (done ? next() : setChars(full.length))}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              done ? next() : setChars(full.length);
            }
          }}
          aria-label="The author introduces the book. Click to continue."
          className="block w-full cursor-pointer px-4 py-3 pr-9 text-left text-xs sm:text-sm leading-relaxed"
        >
          {full.slice(0, chars)}
          {!done && <span className="animate-pulse">▍</span>}
        </div>

        {/* voice toggle — sibling of the text, not nested inside it */}
        <button
          type="button"
          onClick={toggleVoice}
          aria-label={voice ? "Turn off narration" : "Hear Krupesh read this"}
          title={voice ? "Turn off narration" : "Hear Krupesh read this"}
          className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full text-sm hover:bg-wall-dark/40"
        >
          {voice ? "🔊" : "🔈"}
        </button>

        {/* tail pointing down toward the man */}
        <span
          aria-hidden
          className="absolute -bottom-[7px] left-10 h-3.5 w-3.5 rotate-45 border-b border-r border-wall-dark bg-white/95"
        />
      </div>
    </div>
  );
}

"use client";

// The sitting man speaks. First-time visitors get the full introduction;
// returning visitors get a short "welcome back" that offers to tell them
// what's new since their last visit. The bubble sits just to the man's
// left so its tail points at him without covering his face.

import { useCallback, useEffect, useRef, useState } from "react";

const INTRO = [
  "Hi — I'm Krupesh! 👋 I started this book at 15, learning to invest with my own money, in public. New here? Start with my story:",
];

const TYPE_MS = 26; // per character
const HOLD_MS = 2600; // pause between intro lines
const STORE_KEY = "brst_visit_v1";

type Mode = "intro" | "welcome";

export default function CoverIntro({
  chapterCount = 0,
  whyPageIndex = -1,
}: {
  chapterCount?: number;
  whyPageIndex?: number;
}) {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("intro");
  const [script, setScript] = useState<string[]>([]);
  const [line, setLine] = useState(0);
  const [chars, setChars] = useState(0);
  const [askUpdate, setAskUpdate] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [voice, setVoice] = useState(false);
  const voiceRef = useRef(false);
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const decidedRef = useRef(false);

  const full = script[line] ?? "";
  const done = chars >= full.length;

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis || !text) return;
    // Strip emoji/pictographs so the voice doesn't read "waving hand" aloud.
    const spoken = text
      .replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}]/gu, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!spoken) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(spoken);
    u.lang = "en-US";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }, []);

  // Decide first-visit vs returning exactly once per mount. Guarded so
  // React StrictMode's dev double-invoke can't read the record it just wrote.
  useEffect(() => {
    if (decidedRef.current) return;
    decidedRef.current = true;

    let prev: { chapters?: number } | null = null;
    try {
      prev = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    } catch {
      prev = null;
    }
    if (!prev) {
      setMode("intro");
      setScript(INTRO);
    } else {
      setMode("welcome");
      setNewCount(Math.max(0, chapterCount - (prev.chapters ?? 0)));
      setScript(["Oh — hey, welcome back! 👋"]);
      setAskUpdate(true);
    }
    // Record this visit so the next one is a "welcome back".
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ chapters: chapterCount, at: Date.now() }));
    } catch {
      /* ignore */
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Typing + auto-advance (intro plays once, no loop).
  useEffect(() => {
    if (!ready || !full) return;
    if (!done) {
      const t = setTimeout(() => setChars((c) => c + 1), TYPE_MS);
      return () => clearTimeout(t);
    }
    if (line < script.length - 1) {
      holdRef.current = setTimeout(() => {
        setLine((l) => l + 1);
        setChars(0);
      }, HOLD_MS);
      return () => {
        if (holdRef.current) clearTimeout(holdRef.current);
      };
    }
  }, [ready, chars, done, full, line, script]);

  // Speak the current line when voice is on.
  useEffect(() => {
    if (voice && full) speak(full);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, voice, script]);

  // Stop speech on unmount.
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
    setVoice(nextOn);
    if (!nextOn && typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const answerUpdate = useCallback(() => {
    setAskUpdate(false);
    const msg =
      newCount > 0
        ? `${newCount} new chapter${newCount === 1 ? "" : "s"} since you were last here — turn the page to catch up →`
        : "Nothing new yet — the paint's still drying. Check back soon.";
    setScript([msg]);
    setLine(0);
    setChars(0);
  }, [newCount]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const goToWhy = useCallback(() => {
    if (typeof window !== "undefined" && whyPageIndex >= 0) {
      window.dispatchEvent(new CustomEvent("book:goto", { detail: { index: whyPageIndex } }));
      window.speechSynthesis?.cancel();
    }
  }, [whyPageIndex]);

  const advance = useCallback(() => {
    if (!done) {
      setChars(full.length);
    } else if (mode === "intro" && line < script.length - 1) {
      setLine((l) => l + 1);
      setChars(0);
    }
  }, [done, full.length, mode, line, script.length]);

  if (!ready || dismissed) {
    // Returning visitor who dismissed keeps a tiny re-open chip.
    if (dismissed) {
      return (
        <button
          type="button"
          onClick={() => {
            setDismissed(false);
            setAskUpdate(true);
            setScript(["Welcome back! 👋"]);
            setLine(0);
            setChars(0);
          }}
          aria-label="Say hello again"
          className="absolute right-[8%] top-[10%] grid h-9 w-9 place-items-center rounded-full border border-wall-dark bg-white/95 text-lg shadow-md"
        >
          💬
        </button>
      );
    }
    return null;
  }

  return (
    <div className="absolute right-[35%] top-[14%] z-10 max-w-[190px] sm:max-w-[250px]">
      <div className="relative rounded-xl border border-wall-dark bg-white/95 shadow-md">
        <div
          role="button"
          tabIndex={0}
          onClick={advance}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              advance();
            }
          }}
          aria-label="The author is speaking. Click to continue."
          className="block w-full cursor-pointer px-4 py-3 pr-9 text-left text-xs sm:text-sm leading-relaxed"
        >
          {full.slice(0, chars)}
          {!done && <span className="animate-pulse">▍</span>}

          {/* first-visit: point them to the story once the greeting finishes */}
          {mode === "intro" && done && line === script.length - 1 && whyPageIndex >= 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goToWhy();
                }}
                className="rounded-full bg-tape px-3 py-1 text-xs font-semibold text-white"
              >
                Read: Why I&apos;m writing this →
              </button>
            </div>
          )}

          {/* welcome-back question buttons, once the greeting finishes typing */}
          {mode === "welcome" && askUpdate && done && (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  answerUpdate();
                }}
                className="rounded-full bg-tape px-3 py-1 text-xs font-semibold text-white"
              >
                Yes, what&apos;s new?
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dismiss();
                }}
                className="rounded-full border border-wall-dark px-3 py-1 text-xs text-ink-soft"
              >
                Not now
              </button>
            </div>
          )}
        </div>

        {/* voice toggle */}
        <button
          type="button"
          onClick={toggleVoice}
          aria-label={voice ? "Turn off narration" : "Hear Krupesh read this"}
          title={voice ? "Turn off narration" : "Hear Krupesh read this"}
          className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full text-sm hover:bg-wall-dark/40"
        >
          {voice ? "🔊" : "🔈"}
        </button>

        {/* tail on the right, pointing toward the man */}
        <span
          aria-hidden
          className="absolute -bottom-[7px] right-8 h-3.5 w-3.5 rotate-45 border-b border-r border-wall-dark bg-white/95"
        />
      </div>
    </div>
  );
}

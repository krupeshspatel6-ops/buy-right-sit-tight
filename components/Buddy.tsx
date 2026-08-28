"use client";

// A site-wide buddy in Krupesh's likeness: it greets you, can tell the story
// out loud (and stop the moment you ask), and answers questions about the
// book. Same idea as the copycat.tools buddy, drawn in this book's style.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

// Heavy 3D — only load it when the buddy actually opens, never on the server.
const Character3D = dynamic(() => import("@/components/copycat/Character3D"), { ssr: false });

const WELCOME_FIRST =
  "Hi — I'm Krupesh! 👋 I'm 15, and I'm learning to invest with my own money, in public. Welcome to my book.";
const WELCOME_BACK = "Oh — hey, welcome back! 👋 Good to see you again.";

const STORY = [
  "Here's how this all started. My dad asked me to pick a stock, and I talked about it like I knew exactly what I was doing. I didn't — I was just acting confident.",
  "He saw right through it. He told me I was careless because it wasn't my money at stake. So he made me a deal: I'd put in all the money I've saved, and he'd add some, if I got serious about learning.",
  "So now every stock I buy with my own money becomes a chapter in this book — timestamped the day it happens, and never edited after. A chapter only closes when I sell.",
  "I'm trying to learn to find good companies, and — the harder part — to just wait. To think like Buffett, Munger, and Pabrai. I'm only getting started.",
  "Nothing here is advice — it's my journey. Buy right, sit tight… and watch the paint dry with me.",
];

const STORE_KEY = "brst_buddy_v1";
const TYPE_MS = 22;

type ChatMsg = { role: "user" | "assistant"; content: string };

function stripEmoji(t: string): string {
  return t
    .replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export default function Buddy() {
  const pathname = usePathname() || "/";
  const [hidden, setHidden] = useState(false);
  const [text, setText] = useState(""); // what the buddy is currently "saying" (typed)
  const [target, setTarget] = useState(""); // full text being typed toward
  const [talking, setTalking] = useState(false); // narrating the story
  const [voice, setVoice] = useState(true);
  const [asking, setAsking] = useState(false); // chat input shown
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const storyIdx = useRef(0);
  const voiceRef = useRef(true);
  const greeted = useRef(false);
  // Drives the 3D character's mouth: true → it's moving its lips.
  const expressionRef = useRef({ talking: false, emotion: "neutral" });

  const speak = useCallback((raw: string) => {
    if (!voiceRef.current || typeof window === "undefined" || !window.speechSynthesis) return;
    const spoken = stripEmoji(raw);
    if (!spoken) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(spoken);
    u.lang = "en-US";
    u.rate = 0.98;
    u.onstart = () => {
      expressionRef.current.talking = true;
    };
    u.onend = () => {
      expressionRef.current.talking = false;
    };
    window.speechSynthesis.speak(u);
  }, []);

  const cancelVoice = useCallback(() => {
    expressionRef.current.talking = false;
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  // Say a single line: set it as the target (types out) and speak it.
  const say = useCallback(
    (line: string) => {
      setTarget(line);
      setText("");
      expressionRef.current.talking = true; // move the mouth even when muted
      speak(line);
    },
    [speak]
  );

  // Typewriter effect toward `target`.
  useEffect(() => {
    if (text.length >= target.length) {
      // Done typing. If muted, there's no speech-end event, so stop the mouth here.
      if (!voiceRef.current) expressionRef.current.talking = false;
      return;
    }
    const t = setTimeout(() => setText(target.slice(0, text.length + 1)), TYPE_MS);
    return () => clearTimeout(t);
  }, [text, target]);

  // Greet on load (the character is free-standing and always present). The
  // guard lives inside the timer so React's dev double-mount can't cancel it.
  useEffect(() => {
    if (hidden) return;
    const t = setTimeout(() => {
      if (greeted.current) return;
      greeted.current = true;
      let returning = false;
      try {
        returning = Boolean(JSON.parse(localStorage.getItem(STORE_KEY) || "null"));
        localStorage.setItem(STORE_KEY, JSON.stringify({ at: Date.now() }));
      } catch {
        /* ignore */
      }
      say(returning ? WELCOME_BACK : WELCOME_FIRST);
    }, 900);
    return () => clearTimeout(t);
  }, [hidden, say]);

  // Stop everything (the "stop talking" the user can ask for).
  const stop = useCallback(() => {
    setTalking(false);
    storyIdx.current = 0;
    cancelVoice();
    setTarget((cur) => cur); // freeze current line as-is
  }, [cancelVoice]);

  const tellStory = useCallback(() => {
    setAsking(false);
    setTalking(true);
    storyIdx.current = 0;
    say(STORY[0]);
  }, [say]);

  // Advance the story once a line finishes typing (if still narrating).
  useEffect(() => {
    if (!talking) return;
    if (text.length < target.length) return;
    const t = setTimeout(() => {
      const next = storyIdx.current + 1;
      if (next < STORY.length) {
        storyIdx.current = next;
        say(STORY[next]);
      } else {
        setTalking(false);
      }
    }, 1600);
    return () => clearTimeout(t);
  }, [talking, text, target, say]);

  async function ask(e?: React.FormEvent) {
    e?.preventDefault();
    const q = question.trim();
    if (!q || thinking) return;
    if (/^\s*stop\b/i.test(q)) {
      stop();
      setQuestion("");
      say("Okay, I'll stop. Tap a button whenever you want me again.");
      return;
    }
    setThinking(true);
    setTalking(false);
    cancelVoice();
    setTarget("");
    setText("");
    setQuestion("");
    const nextHistory = [...history, { role: "user" as const, content: q }];
    setHistory(nextHistory);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, history }),
      });
      const data = await res.json();
      const answer = data.ok ? data.text : data.error || "Sorry, I couldn't answer that.";
      setHistory([...nextHistory, { role: "assistant", content: answer }]);
      say(answer);
    } catch {
      say("Hmm, I couldn't reach my brain just now. Try again in a moment?");
    } finally {
      setThinking(false);
    }
  }

  function toggleVoice() {
    const next = !voiceRef.current;
    voiceRef.current = next;
    setVoice(next);
    if (!next) cancelVoice();
  }

  // Stop speech when the route changes.
  useEffect(() => cancelVoice, [cancelVoice, pathname]);

  if (pathname.startsWith("/admin")) return null;

  // Hidden for the session → a tiny re-summon chip.
  if (hidden) {
    return (
      <button
        onClick={() => {
          setHidden(false);
          greeted.current = false;
        }}
        aria-label="Bring the buddy back"
        className="fixed bottom-3 left-3 z-50 grid h-11 w-11 place-items-center rounded-full border border-wall-dark bg-white text-xl shadow-lg print:hidden"
      >
        💬
      </button>
    );
  }

  const speaking = thinking || text.length > 0;

  return (
    // Free-standing: the character stands on the page (transparent, no card),
    // anchored to the bottom. The bubble stacks directly above its head. The
    // wrapper ignores pointer events so the page stays clickable; the bubble
    // and controls opt back in.
    <div
      className="fixed bottom-0 left-2 z-50 flex flex-col items-center print:hidden"
      style={{ width: 280, pointerEvents: "none" }}
    >
      {/* speech bubble — sits on top of the buddy, text wraps */}
      {speaking && (
        <div
          className="relative mb-2 w-full whitespace-normal break-words rounded-2xl border border-wall-dark bg-white/95 px-4 py-3 text-sm leading-relaxed shadow-lg"
          style={{ pointerEvents: "auto" }}
        >
          {thinking ? (
            <span className="text-ink-soft">Thinking…</span>
          ) : (
            <span>
              {text}
              {text.length < target.length && <span className="animate-pulse">▍</span>}
            </span>
          )}
          {/* tail pointing down to the character */}
          <span
            aria-hidden
            className="absolute -bottom-[7px] left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-b border-r border-wall-dark bg-white/95"
          />
        </div>
      )}

      <div className="relative" style={{ width: 280, height: 480 }}>
        {/* the free-standing 3D character */}
        <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
          <Character3D expressionRef={expressionRef} />
        </div>

        {/* controls, floating at the character's feet */}
        <div
          className="absolute bottom-1 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5"
          style={{ pointerEvents: "auto" }}
        >
          {asking ? (
            <form onSubmit={ask} className="flex gap-1.5 rounded-full bg-white/95 p-1 shadow-md">
              <input
                autoFocus
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about the book…"
                className="w-[150px] min-w-0 rounded-full px-3 py-1 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={thinking}
                className="rounded-full bg-tape px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
              >
                Ask
              </button>
            </form>
          ) : (
            <div className="flex flex-wrap justify-center gap-1.5">
              <button
                onClick={tellStory}
                className="rounded-full border border-tape bg-white/95 px-3 py-1 text-xs font-semibold text-tape shadow-sm"
              >
                📖 Story
              </button>
              <button
                onClick={() => {
                  setAsking(true);
                  stop();
                }}
                className="rounded-full border border-tape bg-white/95 px-3 py-1 text-xs font-semibold text-tape shadow-sm"
              >
                💬 Ask
              </button>
              {talking && (
                <button
                  onClick={stop}
                  className="rounded-full border border-loss bg-white/95 px-3 py-1 text-xs font-semibold text-loss shadow-sm"
                >
                  ⏹ Stop
                </button>
              )}
            </div>
          )}
          {asking && (
            <button
              onClick={() => setAsking(false)}
              className="rounded-full bg-white/90 px-2 text-xs text-ink-soft underline"
            >
              ← back
            </button>
          )}
        </div>

        {/* tiny mute + dismiss, top-right of the character */}
        <div
          className="absolute right-0 top-2 flex items-center gap-1"
          style={{ pointerEvents: "auto" }}
        >
          <button
            onClick={toggleVoice}
            title={voice ? "Mute" : "Unmute"}
            className="grid h-7 w-7 place-items-center rounded-full bg-white/80 text-sm hover:bg-white"
          >
            {voice ? "🔊" : "🔈"}
          </button>
          <button
            onClick={() => {
              stop();
              setHidden(true);
            }}
            title="Hide the buddy"
            className="grid h-7 w-7 place-items-center rounded-full bg-white/80 text-sm hover:bg-white"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

// A site-wide buddy in Krupesh's likeness: it greets you, can tell the story
// out loud (and stop the moment you ask), and answers questions about the
// book. Same idea as the copycat.tools buddy, drawn in this book's style.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

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
  const [open, setOpen] = useState(false);
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

  const speak = useCallback((raw: string) => {
    if (!voiceRef.current || typeof window === "undefined" || !window.speechSynthesis) return;
    const spoken = stripEmoji(raw);
    if (!spoken) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(spoken);
    u.lang = "en-US";
    u.rate = 0.98;
    window.speechSynthesis.speak(u);
  }, []);

  const cancelVoice = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  // Say a single line: set it as the target (types out) and speak it.
  const say = useCallback(
    (line: string) => {
      setTarget(line);
      setText("");
      speak(line);
    },
    [speak]
  );

  // Typewriter effect toward `target`.
  useEffect(() => {
    if (text.length >= target.length) return;
    const t = setTimeout(() => setText(target.slice(0, text.length + 1)), TYPE_MS);
    return () => clearTimeout(t);
  }, [text, target]);

  // Greet when first opened.
  useEffect(() => {
    if (!open || greeted.current) return;
    greeted.current = true;
    let returning = false;
    try {
      returning = Boolean(JSON.parse(localStorage.getItem(STORE_KEY) || "null"));
      localStorage.setItem(STORE_KEY, JSON.stringify({ at: Date.now() }));
    } catch {
      /* ignore */
    }
    say(returning ? WELCOME_BACK : WELCOME_FIRST);
  }, [open, say]);

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

  // Stop speech when the buddy closes or the route changes.
  useEffect(() => cancelVoice, [cancelVoice, pathname, open]);

  if (pathname.startsWith("/admin")) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 print:hidden">
      {open ? (
        <div className="w-[300px] max-w-[calc(100vw-2rem)] rounded-2xl border border-wall-dark bg-white shadow-xl">
          {/* header */}
          <div className="flex items-center gap-2 border-b border-wall px-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/buddy.svg" alt="" className="h-8 w-8 rounded-full" />
            <span className="text-sm font-semibold">Krupesh&apos;s buddy</span>
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={toggleVoice}
                title={voice ? "Mute" : "Unmute"}
                className="grid h-7 w-7 place-items-center rounded-full text-sm hover:bg-wall-dark/40"
              >
                {voice ? "🔊" : "🔈"}
              </button>
              <button
                onClick={() => {
                  stop();
                  setOpen(false);
                }}
                title="Close"
                className="grid h-7 w-7 place-items-center rounded-full text-sm hover:bg-wall-dark/40"
              >
                ✕
              </button>
            </div>
          </div>

          {/* what the buddy is saying */}
          <div className="max-h-[45vh] overflow-y-auto px-4 py-3 text-sm leading-relaxed">
            {thinking ? (
              <span className="text-ink-soft">Thinking…</span>
            ) : (
              <span>
                {text}
                {text.length < target.length && <span className="animate-pulse">▍</span>}
              </span>
            )}
          </div>

          {/* controls */}
          <div className="border-t border-wall px-3 py-2">
            {asking ? (
              <form onSubmit={ask} className="flex gap-2">
                <input
                  autoFocus
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about the book…"
                  className="min-w-0 flex-1 rounded-full border border-wall-dark px-3 py-1.5 text-sm outline-none focus:border-tape"
                />
                <button
                  type="submit"
                  disabled={thinking}
                  className="rounded-full bg-tape px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Ask
                </button>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={tellStory}
                  className="rounded-full border border-tape px-3 py-1.5 text-xs font-semibold text-tape"
                >
                  📖 Hear the story
                </button>
                <button
                  onClick={() => {
                    setAsking(true);
                    stop();
                  }}
                  className="rounded-full border border-tape px-3 py-1.5 text-xs font-semibold text-tape"
                >
                  💬 Ask about the book
                </button>
                {talking && (
                  <button
                    onClick={stop}
                    className="rounded-full border border-loss px-3 py-1.5 text-xs font-semibold text-loss"
                  >
                    ⏹ Stop
                  </button>
                )}
              </div>
            )}
            {asking && (
              <button
                onClick={() => setAsking(false)}
                className="mt-2 text-xs text-ink-soft underline"
              >
                ← back
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Chat with Krupesh's buddy"
          className="flex items-center gap-2 rounded-full border border-wall-dark bg-white py-1.5 pl-1.5 pr-4 shadow-lg hover:shadow-xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/buddy.svg" alt="" className="h-9 w-9 rounded-full" />
          <span className="text-sm font-semibold">Ask me</span>
        </button>
      )}
    </div>
  );
}

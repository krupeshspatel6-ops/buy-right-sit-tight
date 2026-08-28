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
  "Hi! 👋 I'm Krupesh's AI assistant. He's 15 and learning to invest in public, with his own money. I can tell you his story, show you around the book, or answer your questions.";
const WELCOME_BACK =
  "Oh — hey, welcome back! 👋 Krupesh's AI assistant here. Want the tour, or have a question about the book?";

const STORY = [
  "Here's how it started for Krupesh. His dad asked him to pick a stock, and Krupesh talked about it like he knew exactly what he was doing — but he didn't, he was just acting confident.",
  "His dad saw right through it, and told him he was careless because it wasn't his money at stake. So they made a deal: Krupesh would put in all the money he'd saved, and his dad would add some, if he got serious about learning.",
  "So now every stock Krupesh buys with his own money becomes a chapter in this book — timestamped the day it happens, and never edited after. A chapter only closes when he sells.",
  "He's trying to learn to find good companies, and — the harder part — to just wait. To think like Buffett, Munger, and Pabrai. He's only getting started.",
  "Nothing here is advice — it's Krupesh's journey. Buy right, sit tight… and watch the paint dry with him.",
];

// "Show me the book" tour — what the platform is, the portfolio balance, and
// how to get around.
const TOUR = [
  "Sure — let me show you around Krupesh's book!",
  "This is a live book. Every stock Krupesh buys with his own saved money becomes a chapter — timestamped the day it happens, and never edited after.",
  "See the panel on the left, the ledger? That's the real portfolio: the total value at the end of each market day, each stock's last price, and how it's doing versus the S&P 500.",
  "The cover reads like a real book — use the arrows or click the page edges to turn pages. The table of contents IS the portfolio: open chapters are what he still holds, closed ones are stocks he sold.",
  "The wall on the cover fills in 1% per chapter — 100 chapters total, a lifetime punch card. Right now it's still blank, waiting for his first buy.",
  "That's the tour! Nothing here is advice — it's Krupesh's learning journey. Buy right, sit tight, and watch the paint dry with him.",
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

// Turn a (markdown) chapter into readable chunks (~350 chars) at sentence
// boundaries, so the assistant can read a long chapter aloud in pieces.
function chunkText(raw: string): string[] {
  const plain = raw
    .replace(/^>.*$/gm, "") // drop the append-only footer/quote lines
    .replace(/[#>*_`~[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = plain.match(/[^.!?]+[.!?]*/g) || [plain];
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > 350 && cur) {
      chunks.push(cur.trim());
      cur = s;
    } else {
      cur += s;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.length ? chunks : [plain];
}

export default function Buddy() {
  const pathname = usePathname() || "/";
  const [hidden, setHidden] = useState(false);
  const [text, setText] = useState(""); // what the buddy is currently "saying" (typed)
  const [target, setTarget] = useState(""); // full text being typed toward
  const [talking, setTalking] = useState(false); // narrating a script (story/tour)
  const [dancing, setDancing] = useState(false); // 3D dance moves while narrating
  const [speaking, setSpeaking] = useState(false); // any speech active → show Stop
  const [voice, setVoice] = useState(true);
  const [showHint, setShowHint] = useState(true); // "tap to hear me" until first interaction
  const [greetReady, setGreetReady] = useState(false); // greeting prepared, waiting for the tap
  const [captionOn, setCaptionOn] = useState(false); // audio drives the typed text (in sync)
  const [asking, setAsking] = useState(false); // chat input shown
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const storyIdx = useRef(0);
  const scriptRef = useRef<string[]>(STORY); // the script being narrated (story or tour)
  const voiceRef = useRef(true);
  const greeted = useRef(false);
  const greetLineRef = useRef(""); // the greeting text, to voice on first interaction
  const greetVoicedRef = useRef(false);
  // Drives the 3D character's mouth: talking + open-amount (0..1).
  const expressionRef = useRef({ talking: false, emotion: "neutral", open: 0 });
  const neuralAvailRef = useRef<boolean | null>(null); // null = not tried; false = not configured
  const interactedRef = useRef(false); // neural voice needs a user gesture
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef(0);
  const lineDoneRef = useRef<(() => void) | null>(null); // fires when a spoken line ends
  const doneTimerRef = useRef(0); // fallback timer if speech-end never fires
  const danceTimerRef = useRef(0); // stops the dance burst
  const narrationTokenRef = useRef(0); // invalidates a running narration on stop

  const stopAudio = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        /* ignore */
      }
      audioRef.current = null;
    }
    expressionRef.current.talking = false;
    expressionRef.current.open = 0;
    setSpeaking(false);
    setCaptionOn(false);
  }, []);

  const speakBrowser = useCallback((raw: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const spoken = stripEmoji(raw);
    if (!spoken) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(spoken);
    u.lang = "en-US";
    u.rate = 0.98;
    u.onstart = () => {
      expressionRef.current.talking = true;
      setSpeaking(true);
    };
    u.onend = () => {
      expressionRef.current.talking = false;
      setSpeaking(false);
      lineDoneRef.current?.();
    };
    window.speechSynthesis.speak(u);
  }, []);

  // Copycat's neural voice with real lip-sync from the audio amplitude.
  const speakNeural = useCallback(
    async (raw: string) => {
      const spoken = stripEmoji(raw);
      if (!spoken) return;
      stopAudio();
      setSpeaking(true); // stopAudio cleared it; we're about to speak
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: spoken }),
        });
        if (!res.ok) {
          if (res.status === 503) neuralAvailRef.current = false; // not configured → stop trying
          setCaptionOn(false); // no audio to sync to → fixed-rate typing
          speakBrowser(raw);
          return;
        }
        neuralAvailRef.current = true;
        const url = URL.createObjectURL(await res.blob());
        const audio = new Audio(url);
        audioRef.current = audio;
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = audioCtxRef.current || new Ctx();
        audioCtxRef.current = ctx;
        if (ctx.state === "suspended") await ctx.resume();
        const source = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          expressionRef.current.open = Math.min(1, sum / data.length / 80);
          expressionRef.current.talking = true;
          // caption sync: reveal the text in time with the audio
          const dur = audio.duration;
          if (dur && isFinite(dur) && dur > 0) {
            const frac = Math.min(1, audio.currentTime / dur);
            const n = Math.max(1, Math.ceil(raw.length * frac));
            setText((prev) => (n > prev.length ? raw.slice(0, n) : prev));
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        audio.onended = () => {
          setText(raw); // ensure the full line is shown
          setCaptionOn(false);
          stopAudio();
          URL.revokeObjectURL(url);
          lineDoneRef.current?.();
        };
        expressionRef.current.talking = true;
        await audio.play();
        loop();
      } catch {
        setCaptionOn(false);
        speakBrowser(raw);
      }
    },
    [speakBrowser, stopAudio]
  );

  const speak = useCallback(
    (raw: string) => {
      if (!voiceRef.current) return;
      if (neuralAvailRef.current !== false && interactedRef.current) speakNeural(raw);
      else speakBrowser(raw);
    },
    [speakNeural, speakBrowser]
  );

  const cancelVoice = useCallback(() => {
    stopAudio();
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  }, [stopAudio]);

  // Say a single line: set it as the target (types out) and speak it.
  const say = useCallback(
    (line: string, onDone?: () => void) => {
      setTarget(line);
      setText("");
      setSpeaking(true);
      // Will the neural voice drive this line? If so, let the audio type it
      // (caption sync); otherwise type at the fixed rate.
      setCaptionOn(voiceRef.current && interactedRef.current && neuralAvailRef.current !== false);
      expressionRef.current.talking = true; // move the mouth even when muted
      window.clearTimeout(doneTimerRef.current);
      let fired = false;
      const fire = () => {
        if (fired) return;
        fired = true;
        window.clearTimeout(doneTimerRef.current);
        lineDoneRef.current = null;
        onDone?.();
      };
      lineDoneRef.current = fire;
      // Fallback so narration still advances if speech-end never fires (muted /
      // autoplay-blocked). Generous when voiced so it never cuts real speech off.
      const est = voiceRef.current
        ? line.length * TYPE_MS + line.length * 85 + 2500
        : line.length * TYPE_MS + 1400;
      doneTimerRef.current = window.setTimeout(fire, est);
      speak(line);
    },
    [speak]
  );

  // Typewriter effect toward `target`. Skipped when the audio is driving the
  // text (caption mode) so the words appear in sync with the voice.
  useEffect(() => {
    if (captionOn) return;
    if (text.length >= target.length) {
      // Done typing. If muted, there's no speech-end event, so stop here.
      if (!voiceRef.current) {
        expressionRef.current.talking = false;
        setSpeaking(false);
      }
      return;
    }
    const t = setTimeout(() => setText(target.slice(0, text.length + 1)), TYPE_MS);
    return () => clearTimeout(t);
  }, [text, target, captionOn]);

  // Unlock Web Audio on the first real gesture. The neural voice routes through
  // an AudioContext (for lip-sync), and a context can only be resumed inside a
  // user gesture — otherwise it stays suspended and no sound plays, even though
  // playback "succeeds". Capture phase so it runs before anything else.
  useEffect(() => {
    const unlock = () => {
      try {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
        if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
      } catch {
        /* ignore */
      }
      if (audioCtxRef.current && audioCtxRef.current.state === "running") remove();
    };
    const remove = () => {
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      document.removeEventListener("touchstart", unlock, true);
    };
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);
    document.addEventListener("touchstart", unlock, true);
    return remove;
  }, []);

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
      // Prepare the greeting but don't speak/type it yet — it arrives WITH the
      // voice on the first tap, so text and voice are in sync (browsers block
      // audio until then anyway).
      greetLineRef.current = returning ? WELCOME_BACK : WELCOME_FIRST;
      setGreetReady(true);
    }, 200);
    return () => clearTimeout(t);
  }, [hidden]);

  // Browsers block audio until the user interacts. So the moment they first
  // click/tap/press anywhere on the page (outside the buddy's own buttons),
  // voice the greeting — that's when he audibly says hi / welcome back.
  useEffect(() => {
    const onFirst = (e: Event) => {
      interactedRef.current = true;
      setShowHint(false);
      const buddyEl = document.querySelector(".fixed.bottom-0.left-2");
      const inside = buddyEl && e.target instanceof Node && buddyEl.contains(e.target);
      // Say the greeting now — it types in sync with the voice (see speakNeural).
      if (!inside && !greetVoicedRef.current && greetLineRef.current) {
        greetVoicedRef.current = true;
        say(greetLineRef.current);
      }
      cleanup();
    };
    const cleanup = () => {
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
    };
    window.addEventListener("pointerdown", onFirst);
    window.addEventListener("keydown", onFirst);
    return cleanup;
  }, [say]);

  // Stop everything (the "stop talking" button).
  const stop = useCallback(() => {
    narrationTokenRef.current++; // invalidate any running narration
    window.clearTimeout(doneTimerRef.current);
    window.clearTimeout(danceTimerRef.current);
    lineDoneRef.current = null;
    setTalking(false);
    setDancing(false);
    setSpeaking(false);
    storyIdx.current = 0;
    cancelVoice();
    setTarget((cur) => cur); // freeze current line as-is
  }, [cancelVoice]);

  // A short one-off dance (~3s), not a permanent one.
  const danceBurst = useCallback(() => {
    setDancing(true);
    window.clearTimeout(danceTimerRef.current);
    danceTimerRef.current = window.setTimeout(() => setDancing(false), 3000);
  }, []);

  // Narrate a script (story or tour): a quick dance, then speak each line and
  // advance ONLY when that line has finished being spoken (no cutting off).
  const narrate = useCallback(
    (script: string[]) => {
      interactedRef.current = true;
      setAsking(false);
      scriptRef.current = script;
      setTalking(true);
      danceBurst();
      const token = ++narrationTokenRef.current;
      const sayLine = (i: number) => {
        if (narrationTokenRef.current !== token) return; // stopped or superseded
        storyIdx.current = i;
        say(script[i], () => {
          if (narrationTokenRef.current !== token) return; // stopped mid-line
          if (i + 1 < script.length) sayLine(i + 1);
          else setTalking(false);
        });
      };
      sayLine(0);
    },
    [say, danceBurst]
  );

  const tellStory = useCallback(() => narrate(STORY), [narrate]);
  const showBook = useCallback(() => narrate(TOUR), [narrate]);

  // Read a chapter aloud when a chapter page asks (the "Read this" button).
  useEffect(() => {
    const onRead = (e: Event) => {
      const t = (e as CustomEvent<{ text?: string }>).detail?.text;
      if (!t) return;
      interactedRef.current = true;
      setHidden(false);
      narrate(chunkText(t));
    };
    window.addEventListener("buddy:read", onRead);
    return () => window.removeEventListener("buddy:read", onRead);
  }, [narrate]);

  async function ask(e?: React.FormEvent) {
    e?.preventDefault();
    interactedRef.current = true;
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
    interactedRef.current = true;
    const next = !voiceRef.current;
    voiceRef.current = next;
    setVoice(next);
    if (next) speak(target || WELCOME_FIRST);
    else cancelVoice();
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

  return (
    // Free-standing: the character stands on the page (transparent, no card),
    // anchored to the bottom. The bubble stacks directly above its head. The
    // wrapper ignores pointer events so the page stays clickable; the bubble
    // and controls opt back in.
    <div
      className="fixed bottom-0 left-2 z-50 flex flex-col items-center print:hidden"
      style={{ width: 280, pointerEvents: "none" }}
    >
      {/* one-time nudge: browsers block sound until the first interaction */}
      {showHint && voice && greetReady && (
        <div
          className="mb-1 animate-pulse rounded-full bg-tape px-3 py-1 text-xs font-semibold text-white shadow-md"
          style={{ pointerEvents: "auto", transform: "translate(34px, 40px)" }}
        >
          🔊 tap anywhere to hear me
        </div>
      )}

      {/* speech bubble on top of the buddy — holds what he says AND the buttons */}
      <div
        className="relative mb-2 w-full whitespace-normal break-words rounded-2xl border border-wall-dark bg-white/95 px-4 py-3 pt-5 text-sm leading-relaxed shadow-lg"
        style={{ pointerEvents: "auto", transform: "translate(34px, 40px)" }}
      >
        {/* sound + close, on top of the popup */}
        <div className="absolute -top-3 right-2 flex items-center gap-1">
          <button
            onClick={toggleVoice}
            title={voice ? "Mute" : "Unmute"}
            className="grid h-7 w-7 place-items-center rounded-full border border-wall-dark bg-white text-sm shadow-sm hover:bg-wall"
          >
            {voice ? "🔊" : "🔈"}
          </button>
          <button
            onClick={() => {
              stop();
              setHidden(true);
            }}
            title="Hide the buddy"
            className="grid h-7 w-7 place-items-center rounded-full border border-wall-dark bg-white text-sm shadow-sm hover:bg-wall"
          >
            ✕
          </button>
        </div>

        {(thinking || text || speaking) && (
          <div className="mb-2">
            {thinking ? (
              <span className="text-ink-soft">Thinking…</span>
            ) : text ? (
              <span>
                {text}
                {text.length < target.length && <span className="animate-pulse">▍</span>}
              </span>
            ) : (
              <span className="animate-pulse text-ink-soft">…</span>
            )}
          </div>
        )}

        {asking ? (
          <div className="flex flex-col gap-1.5">
            <form onSubmit={ask} className="flex gap-1.5">
              <input
                autoFocus
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about the book…"
                className="min-w-0 flex-1 rounded-full border border-wall-dark px-3 py-1 text-sm outline-none focus:border-tape"
              />
              <button
                type="submit"
                disabled={thinking}
                className="rounded-full bg-tape px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
              >
                Ask
              </button>
            </form>
            <button
              onClick={() => setAsking(false)}
              className="self-start text-xs text-ink-soft underline"
            >
              ← back
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={showBook}
              className="rounded-full bg-tape px-3 py-1 text-xs font-semibold text-white"
            >
              🏛️ Show me the book
            </button>
            <button
              onClick={tellStory}
              className="rounded-full border border-tape px-3 py-1 text-xs font-semibold text-tape"
            >
              📖 Story
            </button>
            <button
              onClick={() => {
                setAsking(true);
                stop();
              }}
              className="rounded-full border border-tape px-3 py-1 text-xs font-semibold text-tape"
            >
              💬 Ask
            </button>
            {speaking && (
              <button
                onClick={stop}
                className="rounded-full border border-loss px-3 py-1 text-xs font-semibold text-loss"
              >
                ⏹ Stop talking
              </button>
            )}
          </div>
        )}

        {/* tail pointing down to the character */}
        <span
          aria-hidden
          className="absolute -bottom-[7px] left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-b border-r border-wall-dark bg-white/95"
        />
      </div>

      <div className="relative" style={{ width: 280, height: 480 }}>
        {/* the free-standing 3D character */}
        <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
          <Character3D expressionRef={expressionRef} dancing={dancing} />
        </div>
      </div>
    </div>
  );
}

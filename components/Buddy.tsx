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
  "Hi! 👋 I'm Krupesh's AI assistant. He started this book at 15, learning to invest in public with his own money. Take the tour, or ask me anything!";
const WELCOME_BACK =
  "Welcome back! 👋 Krupesh's AI assistant here — take the tour, or ask me anything about the book.";

// --- Previous story (kept in case we want to revert) -----------------------
// const STORY = [
//   "Here's how it started for Krupesh. His dad asked him to pick a stock, and Krupesh talked about it like he knew exactly what he was doing — but he didn't, he was just acting confident.",
//   "His dad saw right through it, and told him he was careless because it wasn't his money at stake. So they made a deal: Krupesh would put in all the money he'd saved, and his dad would add some, if he got serious about learning.",
//   "So now every stock Krupesh buys with his own money becomes a chapter in this book — timestamped the day it happens, and never edited after. A chapter only closes when he sells.",
//   "He's trying to learn to find good companies, and — the harder part — to just wait. To think like Buffett, Munger, and Pabrai. He's only getting started.",
//   "Nothing here is advice — it's Krupesh's journey. Buy right, sit tight… and watch the paint dry with him.",
// ];
// ---------------------------------------------------------------------------
const STORY = [
  "Here's the idea behind Krupesh's book. He follows a code — his own set of signals — and when that code lines up, he takes it as a hint that it might be the right time to open a small starter position.",
  "So he puts in a little of his own money to start... and then the hard part begins. He sits tight. And he waits. And waits. And waits some more.",
  "Every buy he makes becomes a chapter here — timestamped the day it happens, and never edited after. A chapter only closes when he sells, and mostly, he doesn't.",
  "The whole book is really about that waiting — trusting the code, holding the position, and doing nothing while the paint dries. The way Buffett, Munger, and Pabrai talk about.",
  "Nothing here is advice — it's just Krupesh's journey. His code, his signals, his patience. Buy right, sit tight… and watch the paint dry with him.",
];

// "Show me the book" tour — what the platform is, the portfolio balance, and
// how to get around.
const TOUR = [
  "Sure — let me show you around Krupesh's book!",
  "This is a live book. Every stock Krupesh buys with his own money becomes a chapter — timestamped the day it happens, and never edited after.",
  "See the panel on the left, the ledger? That's the real portfolio — every open position, its latest price, and how the book is doing overall, tracked automatically and never typed in by hand.",
  "The cover reads like a real book — use the arrows or click the page edges to turn pages. The table of contents IS the portfolio: open chapters are what he still holds, closed ones are stocks he sold.",
  "The wall on the cover keeps getting painted — a new chapter for every buy, with no set number and no finish line. Right now it's still blank, waiting for his first buy.",
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
  const [menuOpen, setMenuOpen] = useState(true); // bubble open; collapses to just the character
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null); // drag position; null = anchored bottom-left
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ sx: number; sy: number; bx: number; by: number } | null>(null);
  const [text, setText] = useState(""); // what the buddy is currently "saying" (typed)
  const [target, setTarget] = useState(""); // full text being typed toward
  const [talking, setTalking] = useState(false); // narrating a script (story/tour)
  const [dancing, setDancing] = useState(false); // 3D dance moves while narrating
  const [speaking, setSpeaking] = useState(false); // any speech active → show Stop
  const [voice, setVoice] = useState(true);
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
  const rafRef = useRef(0);
  const speakGenRef = useRef(0); // bumped on every new speak/stop; cancels in-flight audio
  // spoken text -> a ready-to-play clip: the audio URL plus a precomputed
  // loudness envelope (so the mouth follows the actual speech and closes on
  // pauses, instead of flapping nonstop).
  const ttsCache = useRef<Map<string, { url: string; env: Float32Array | null; winSec: number }>>(
    new Map()
  );
  const decodeCtxRef = useRef<AudioContext | null>(null); // used ONLY to decode audio, never for output
  const lineDoneRef = useRef<(() => void) | null>(null); // fires when a spoken line ends
  const doneTimerRef = useRef(0); // fallback timer if speech-end never fires
  const danceTimerRef = useRef(0); // stops the dance burst
  const narrationTokenRef = useRef(0); // invalidates a running narration on stop

  const stopAudio = useCallback(() => {
    speakGenRef.current++; // cancel any in-flight fetch + playback loop
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

  // Fetch a line's audio and build a ready clip: the object URL + a loudness
  // envelope sampled every ~40ms. Decoding uses a suspended AudioContext (decode
  // works while suspended) and the sound is NEVER routed through it — the <audio>
  // element plays directly — so a blocked/suspended context can't mute anything.
  const loadClip = useCallback(async (spoken: string) => {
    const cached = ttsCache.current.get(spoken);
    if (cached) return cached;
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: spoken }),
    });
    if (!res.ok) {
      if (res.status === 503) neuralAvailRef.current = false;
      throw new Error(`tts ${res.status}`);
    }
    neuralAvailRef.current = true;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const winSec = 0.04;
    let env: Float32Array | null = null;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = decodeCtxRef.current || (decodeCtxRef.current = new Ctx());
      const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
      const ch = buf.getChannelData(0);
      const win = Math.max(1, Math.floor(buf.sampleRate * winSec));
      const n = Math.ceil(ch.length / win);
      const e = new Float32Array(n);
      let max = 0;
      for (let i = 0; i < n; i++) {
        let s = 0;
        const start = i * win;
        const end = Math.min(ch.length, start + win);
        for (let j = start; j < end; j++) s += ch[j] * ch[j];
        const rms = Math.sqrt(s / Math.max(1, end - start));
        e[i] = rms;
        if (rms > max) max = rms;
      }
      if (max > 0) for (let i = 0; i < n; i++) e[i] = Math.min(1, (e[i] / max) * 1.25);
      env = e;
    } catch {
      env = null; // no envelope → gentle fallback flap
    }
    const clip = { url, env, winSec };
    ttsCache.current.set(spoken, clip);
    return clip;
  }, []);

  // Copycat's neural voice. Plays the <audio> element DIRECTLY, and drives the
  // mouth from the precomputed loudness envelope so it opens with speech and
  // CLOSES on pauses (no constant lisping). Text is revealed in time with the
  // audio (type + talk together).
  const speakNeural = useCallback(
    async (raw: string) => {
      const spoken = stripEmoji(raw);
      if (!spoken) return;
      stopAudio();
      setSpeaking(true);
      const gen = ++speakGenRef.current; // this speak's ticket
      try {
        const clip = await loadClip(spoken);
        if (gen !== speakGenRef.current) return; // stopped/superseded while loading
        const audio = new Audio(clip.url);
        audioRef.current = audio;
        let phase = 0;
        const loop = () => {
          if (gen !== speakGenRef.current) return; // stopped
          const ct = audio.currentTime;
          if (clip.env && clip.env.length) {
            const idx = Math.min(clip.env.length - 1, Math.floor(ct / clip.winSec));
            expressionRef.current.open = clip.env[idx]; // ~0 during silence → mouth shut
          } else {
            phase += 0.4;
            expressionRef.current.open = 0.15 + 0.3 * Math.abs(Math.sin(phase));
          }
          expressionRef.current.talking = true;
          const dur = audio.duration;
          if (dur && isFinite(dur) && dur > 0) {
            const frac = Math.min(1, ct / dur);
            const n = Math.max(1, Math.ceil(raw.length * frac));
            setText((prev) => (n > prev.length ? raw.slice(0, n) : prev));
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        audio.onended = () => {
          setText(raw);
          setCaptionOn(false);
          stopAudio();
          lineDoneRef.current?.(); // clip kept in cache for instant replay
        };
        expressionRef.current.talking = true;
        await audio.play();
        loop();
      } catch {
        setCaptionOn(false);
        speakBrowser(raw);
      }
    },
    [speakBrowser, stopAudio, loadClip]
  );

  // Warm a line's clip (audio + envelope) ahead of time so it starts instantly
  // when he actually speaks it. Safe to call before any user gesture.
  const prefetchTts = useCallback(
    async (raw: string) => {
      const spoken = stripEmoji(raw);
      if (!spoken || neuralAvailRef.current === false || ttsCache.current.has(spoken)) return;
      try {
        await loadClip(spoken);
      } catch {
        /* ignore — we'll just load it on demand */
      }
    },
    [loadClip]
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
      const caption =
        voiceRef.current && interactedRef.current && neuralAvailRef.current !== false;
      setCaptionOn(caption);
      // Only start the mouth now when WE type the text locally (muted / browser
      // voice). In neural caption mode the mouth waits for the audio to actually
      // play — otherwise he "lisps" silently during the ~1s TTS fetch, before any
      // words or sound arrive.
      expressionRef.current.talking = !caption;
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
      // Show the greeting text right away (typed out, silent — browsers block
      // audio until the first click anyway). The voice arrives on the first
      // interaction, or when they press "Start talking".
      const line = returning ? WELCOME_BACK : WELCOME_FIRST;
      greetLineRef.current = line;
      setTarget(line);
      // Returning visitors start collapsed (just the character) so the buddy
      // never sits over the page content; first-timers see the greeting bubble.
      if (returning) setMenuOpen(false);
      prefetchTts(line); // warm the voice so "Start talking" plays instantly
    }, 200);
    return () => clearTimeout(t);
  }, [hidden, prefetchTts]);

  // Browsers block audio until the user interacts. So the moment they first
  // click/tap/press anywhere on the page (outside the buddy's own buttons),
  // voice the greeting — that's when he audibly says hi / welcome back.
  useEffect(() => {
    const onFirst = (e: Event) => {
      interactedRef.current = true;
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
        if (i + 1 < script.length) prefetchTts(script[i + 1]); // warm the next line
        say(script[i], () => {
          if (narrationTokenRef.current !== token) return; // stopped mid-line
          if (i + 1 < script.length) sayLine(i + 1);
          else setTalking(false);
        });
      };
      sayLine(0);
    },
    [say, danceBurst, prefetchTts]
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

  // "Start talking": this click is the user gesture that unlocks audio, so speak
  // the greeting out loud right now. If a route change already showed a fresh
  // greeting, this just voices whatever line is on screen.
  function startTalking() {
    interactedRef.current = true;
    greetVoicedRef.current = true;
    voiceRef.current = true;
    setVoice(true);
    say(greetLineRef.current || target || WELCOME_FIRST);
  }

  // Drag the buddy anywhere. Grab a grip, move, and it stays where you drop it
  // (remembered for next time).
  function onDragStart(e: React.PointerEvent) {
    e.preventDefault();
    const el = wrapperRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    dragRef.current = { sx: e.clientX, sy: e.clientY, bx: r.left, by: r.top };
    const clamp = (x: number, y: number) => {
      const w = el.offsetWidth || 160;
      const h = el.offsetHeight || 300;
      return {
        x: Math.max(4, Math.min(x, window.innerWidth - w - 4)),
        y: Math.max(4, Math.min(y, window.innerHeight - h - 4)),
      };
    };
    const move = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      setPos(
        clamp(
          dragRef.current.bx + (ev.clientX - dragRef.current.sx),
          dragRef.current.by + (ev.clientY - dragRef.current.sy)
        )
      );
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setPos((p) => {
        if (p) {
          try {
            localStorage.setItem("brst_buddy_pos", JSON.stringify(p));
          } catch {
            /* ignore */
          }
        }
        return p;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // Restore a saved drag position.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("brst_buddy_pos");
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p?.x === "number" && typeof p?.y === "number") setPos(p);
      }
    } catch {
      /* ignore */
    }
  }, []);

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
      ref={wrapperRef}
      className="fixed bottom-0 left-1 sm:left-2 z-50 flex w-[clamp(117px,19.8vh,210px)] flex-col items-center print:hidden"
      style={{
        pointerEvents: "none",
        ...(pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : {}),
      }}
    >
      {/* speech bubble — only when open or actively speaking, so at rest the
          buddy is just the small character and never covers page content. */}
      {(menuOpen || speaking || asking || thinking) && (
      <div
        className="relative z-10 mb-2 self-start w-[210px] max-w-[82vw] whitespace-normal break-words rounded-2xl border border-wall-dark bg-white/95 px-4 py-3 pt-5 text-sm leading-relaxed shadow-lg sm:w-[236px]"
        style={{ pointerEvents: "auto", transform: "translate(8px, 44px)" }}
      >
        {/* drag grip — move the buddy anywhere */}
        <button
          onPointerDown={onDragStart}
          title="Drag me anywhere"
          aria-label="Drag the buddy"
          className="absolute -top-3 left-2 grid h-7 w-7 cursor-grab touch-none select-none place-items-center rounded-full border border-wall-dark bg-white text-sm shadow-sm hover:bg-wall active:cursor-grabbing"
        >
          ✥
        </button>

        {/* mute, minimize, close — on top of the popup */}
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
              setMenuOpen(false);
            }}
            title="Minimize"
            className="grid h-7 w-7 place-items-center rounded-full border border-wall-dark bg-white text-lg leading-none shadow-sm hover:bg-wall"
          >
            –
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
          <div className="mb-2 max-h-[9rem] overflow-y-auto">
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
              onClick={() => {
                stop();
                setAsking(false);
              }}
              className="self-start text-xs text-ink-soft underline"
            >
              ← back
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {/* Two tidy rows — never wraps into a tall stack that hits the
                ledger: primary action on top, three compact actions below. */}
            {speaking ? (
              <button
                onClick={stop}
                className="w-full whitespace-nowrap rounded-full bg-loss px-3 py-1.5 text-xs font-semibold text-white"
              >
                ⏹ Stop talking
              </button>
            ) : (
              <button
                onClick={startTalking}
                className="w-full whitespace-nowrap rounded-full bg-tape px-3 py-1.5 text-xs font-semibold text-white"
              >
                ▶ Start talking
              </button>
            )}
            <div className="flex gap-1.5">
              <button
                onClick={showBook}
                title="Take me on a tour of the book"
                className="min-w-0 flex-1 whitespace-nowrap rounded-full border border-tape px-1.5 py-1 text-[11px] font-semibold text-tape"
              >
                🏛️ Tour
              </button>
              <button
                onClick={tellStory}
                title="Tell the story behind the book"
                className="min-w-0 flex-1 whitespace-nowrap rounded-full border border-tape px-1.5 py-1 text-[11px] font-semibold text-tape"
              >
                📖 Story
              </button>
              <button
                onClick={() => {
                  setAsking(true);
                  stop();
                }}
                title="Ask a question about the book"
                className="min-w-0 flex-1 whitespace-nowrap rounded-full border border-tape px-1.5 py-1 text-[11px] font-semibold text-tape"
              >
                💬 Ask
              </button>
            </div>
          </div>
        )}

        {/* tail pointing down to the character */}
        <span
          aria-hidden
          className="absolute -bottom-[7px] left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-b border-r border-wall-dark bg-white/95"
        />
      </div>
      )}

      <div className="relative h-[clamp(200px,34vh,360px)] w-[clamp(117px,19.8vh,210px)]">
        {/* the free-standing 3D character (same 0.583 aspect at every size) */}
        <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
          <Character3D expressionRef={expressionRef} dancing={dancing} />
        </div>
        {/* when collapsed, tap the character to reopen the menu */}
        {!(menuOpen || speaking || asking || thinking) && (
          <>
            <button
              onClick={() => {
                interactedRef.current = true;
                setMenuOpen(true);
              }}
              aria-label="Open Krupesh's assistant"
              className="absolute inset-0 z-10 cursor-pointer"
              style={{ pointerEvents: "auto" }}
            />
            <button
              onClick={() => {
                interactedRef.current = true;
                setMenuOpen(true);
              }}
              className="font-grotesk absolute right-0 top-1 z-20 rounded-full border border-wall-dark bg-white px-2 py-0.5 text-[10px] font-bold text-tape shadow-sm"
              style={{ pointerEvents: "auto" }}
            >
              💬 chat
            </button>
            {/* drag grip in the corner when collapsed */}
            <button
              onPointerDown={onDragStart}
              title="Drag me anywhere"
              aria-label="Drag the buddy"
              className="absolute left-0 top-1 z-20 grid h-6 w-6 cursor-grab touch-none select-none place-items-center rounded-full border border-wall-dark bg-white text-[11px] shadow-sm active:cursor-grabbing"
              style={{ pointerEvents: "auto" }}
            >
              ✥
            </button>
          </>
        )}
      </div>
    </div>
  );
}

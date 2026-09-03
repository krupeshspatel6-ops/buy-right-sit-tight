"use client";

// Tap-to-talk speech input via the browser's free Web Speech API — no server,
// no API cost. Supported in Chrome / Edge / Safari; NOT in Firefox, so callers
// must keep a typed fallback and check `supported` before showing a mic button.
//
// Deliberately push-to-talk (not always-listening): the caller starts it on a
// user tap, the user speaks, and it auto-stops on a natural pause (or when the
// caller taps again). On a clean end with speech, `onFinal` fires once with the
// transcript. Canceling aborts without firing `onFinal`.

import { useCallback, useEffect, useRef, useState } from "react";

type ResultLike = { isFinal: boolean; 0: { transcript: string } };
type EventLike = { resultIndex: number; results: ArrayLike<ResultLike> };
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: EventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}
type Ctor = new () => RecognitionLike;

function getCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useSpeechRecognition({
  onFinal,
  lang = "en-US",
}: {
  onFinal: (text: string) => void;
  lang?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<RecognitionLike | null>(null);
  const finalRef = useRef("");
  const canceledRef = useRef(false);
  // Keep the latest callback without re-creating the recognizer each render.
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    setSupported(Boolean(getCtor()));
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setError("unsupported");
      return;
    }
    if (recRef.current) {
      try {
        recRef.current.abort();
      } catch {
        /* ignore */
      }
    }
    setError(null);
    canceledRef.current = false;
    finalRef.current = "";
    setInterim("");

    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim((finalRef.current + interimText).trim());
    };
    rec.onerror = (e) => {
      setError(e?.error || "error");
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
      const text = finalRef.current.trim();
      if (!canceledRef.current && text) onFinalRef.current(text);
    };

    try {
      rec.start();
      setListening(true);
    } catch {
      // start() throws if called while already running — ignore.
    }
  }, [lang]);

  // Finish and submit what was heard.
  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Abort without firing onFinal.
  const cancel = useCallback(() => {
    canceledRef.current = true;
    const rec = recRef.current;
    if (rec) {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    }
    setListening(false);
    setInterim("");
  }, []);

  // Tidy up if the component unmounts mid-listen.
  useEffect(() => {
    return () => {
      canceledRef.current = true;
      const rec = recRef.current;
      if (rec) {
        try {
          rec.abort();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  return { supported, listening, interim, error, start, stop, cancel };
}

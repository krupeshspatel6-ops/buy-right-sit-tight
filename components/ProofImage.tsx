"use client";

import { useEffect, useState } from "react";

// A proof screenshot that enlarges to a full-screen lightbox on click. This is
// purely how the image is DISPLAYED — it never changes the published chapter
// file, its commit, or its timestamp.
export default function ProofImage({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block cursor-zoom-in"
        aria-label="Enlarge the proof screenshot"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="max-h-72 rounded border border-wall-dark transition group-hover:opacity-90"
        />
        <span className="font-grotesk absolute bottom-1.5 right-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-ink-soft shadow-sm">
          click to enlarge
        </span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/85 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[94vh] max-w-[96vw] cursor-default rounded shadow-2xl"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-lg shadow-lg hover:bg-white"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}

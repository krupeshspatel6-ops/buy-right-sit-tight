"use client";

import { useCallback, useEffect, useState } from "react";

export default function BookReader({ pages }: { pages: React.ReactNode[] }) {
  const [index, setIndex] = useState(0);
  const [turn, setTurn] = useState<"next" | "prev" | null>(null);

  const goTo = useCallback(
    (dir: "next" | "prev") => {
      setIndex((i) => {
        const target = dir === "next" ? i + 1 : i - 1;
        if (target < 0 || target >= pages.length) return i;
        setTurn(dir);
        return target;
      });
    },
    [pages.length]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Right") goTo("next");
      if (e.key === "ArrowLeft" || e.key === "Left") goTo("prev");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo]);

  useEffect(() => {
    if (!turn) return;
    const t = setTimeout(() => setTurn(null), 400);
    return () => clearTimeout(t);
  }, [turn, index]);

  return (
    <div className="book-stage mx-auto max-w-[720px] px-4">
      <div
        key={index}
        className={`book-page relative min-h-[72vh] max-h-[80vh] overflow-y-auto px-8 py-10 sm:px-12 ${
          turn === "next" ? "page-turn-next" : turn === "prev" ? "page-turn-prev" : ""
        }`}
      >
        {pages[index]}
        {/* edge click zones */}
        {index > 0 && (
          <button
            aria-label="Previous page"
            onClick={() => goTo("prev")}
            className="absolute inset-y-0 left-0 w-14 cursor-w-resize"
          />
        )}
        {index < pages.length - 1 && (
          <button
            aria-label="Next page"
            onClick={() => goTo("next")}
            className="absolute inset-y-0 right-0 w-14 cursor-e-resize"
          />
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
        <button
          onClick={() => goTo("prev")}
          disabled={index === 0}
          className="px-3 py-1.5 rounded border border-wall-dark bg-white disabled:opacity-40"
        >
          ← Previous
        </button>
        <span>
          Page {index + 1} of {pages.length}
        </span>
        <button
          onClick={() => goTo("next")}
          disabled={index === pages.length - 1}
          className="px-3 py-1.5 rounded border border-wall-dark bg-white disabled:opacity-40"
        >
          Turn the page →
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-ink-soft">
        Tip: use ← → arrow keys, or click the page edges.
      </p>
    </div>
  );
}

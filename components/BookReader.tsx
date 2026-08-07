"use client";

import { useCallback, useEffect, useState } from "react";

export type SideTocEntry = {
  label: string;
  sub?: string;
  pageIndex: number;
};

export default function BookReader({
  pages,
  sideToc,
  ledger,
}: {
  pages: React.ReactNode[];
  sideToc?: SideTocEntry[];
  ledger?: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [turn, setTurn] = useState<"next" | "prev" | null>(null);

  const jumpTo = useCallback(
    (target: number) => {
      setIndex((i) => {
        if (target === i || target < 0 || target >= pages.length) return i;
        setTurn(target > i ? "next" : "prev");
        return target;
      });
    },
    [pages.length]
  );

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
    <div className="flex justify-center gap-8 px-4">
      {ledger && (
        <aside className="hidden xl:block w-64 shrink-0">
          <div className="sticky top-10 max-h-[84vh] overflow-y-auto pr-1">{ledger}</div>
        </aside>
      )}
      <div className="book-stage w-full max-w-[960px]">
        <div
          key={index}
          className={`book-page relative h-[84vh] overflow-y-auto px-8 py-12 sm:px-14 ${
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

      {sideToc && sideToc.length > 0 && (
        <aside className="hidden xl:block w-64 shrink-0">
          <div className="sticky top-10 flex max-h-[84vh] flex-col">
            <h3 className="text-xs uppercase tracking-widest text-ink-soft mb-3">
              In this book
            </h3>
            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 text-sm">
              {sideToc.map((t) => (
                <li key={t.pageIndex}>
                  <button
                    onClick={() => jumpTo(t.pageIndex)}
                    className={`w-full rounded px-3 py-1.5 text-left transition-colors ${
                      index === t.pageIndex
                        ? "bg-white font-semibold shadow-sm"
                        : "text-ink-soft hover:bg-white/70"
                    }`}
                  >
                    <span className="block">{t.label}</span>
                    {t.sub && (
                      <span className="block text-xs text-ink-soft">{t.sub}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}
    </div>
  );
}

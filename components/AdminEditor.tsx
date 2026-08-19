"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { marked } from "marked";
import { formatFillTime } from "@/lib/format";

type Existing = { chapter: number; ticker: string; title: string; status: string };

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// datetime-local ("YYYY-MM-DDTHH:mm") for right now, in local time.
function nowLocalInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Convert a datetime-local value to ISO 8601 with the local UTC offset.
function toISOWithOffset(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const oh = pad(Math.floor(Math.abs(off) / 60));
  const om = pad(Math.abs(off) % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${oh}:${om}`;
}

function fmtTs(iso: string): string {
  if (!iso) return "—";
  return formatFillTime(iso);
}

const BODY_SCAFFOLD = `Write why you bought it — a few honest paragraphs.

Guiding questions (delete these as you answer them):

- What does the company do, in your own words?
- Why do you think it's worth owning for a long time?
- Why was the price you paid a fair price?
- What could go wrong — the bear case?`;

export default function AdminEditor({
  nextChapter,
  existing,
}: {
  nextChapter: number;
  existing: Existing[];
}) {
  const [chapter, setChapter] = useState(nextChapter);
  const [ticker, setTicker] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(nowLocalInput());
  const [price, setPrice] = useState("");
  const [shares, setShares] = useState("");
  const [note, setNote] = useState("");
  const [exitTest, setExitTest] = useState("");
  const [proofs, setProofs] = useState("");
  const [body, setBody] = useState(BODY_SCAFFOLD);
  const [deploy, setDeploy] = useState(true);

  const [status, setStatus] = useState<
    { kind: "idle" | "busy" | "ok" | "err"; msg?: string; log?: string[]; url?: string | null }
  >({ kind: "idle" });

  const bodyHtml = useMemo(() => marked.parse(body || "") as string, [body]);
  const iso = toISOWithOffset(when);
  const priceNum = Number(price);
  const sharesNum = Number(shares);
  const cost = Number.isFinite(priceNum) && Number.isFinite(sharesNum) ? priceNum * sharesNum : 0;

  async function publish() {
    setStatus({ kind: "busy", msg: deploy ? "Publishing & deploying… (about a minute)" : "Publishing…" });
    try {
      const res = await fetch("/api/admin/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chapter,
          title,
          ticker,
          company,
          date: iso,
          price: priceNum,
          shares: sharesNum,
          note,
          proofs: proofs.split(",").map((s) => s.trim()).filter(Boolean).map((f) => (f.startsWith("/") ? f : `/proofs/${f}`)),
          exitTest,
          body,
          deploy,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setStatus({ kind: "err", msg: data.error || "Publish failed.", log: data.log });
      } else {
        setStatus({ kind: "ok", msg: `Published Chapter ${chapter} (${ticker}).`, log: data.log, url: data.prodUrl });
      }
    } catch (e) {
      setStatus({ kind: "err", msg: e instanceof Error ? e.message : "Network error." });
    }
  }

  const busy = status.kind === "busy";
  const label = "block text-xs uppercase tracking-wide text-ink-soft mb-1";
  const field =
    "w-full rounded border border-wall-dark bg-white px-3 py-2 text-sm outline-none focus:border-tape";

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Chapter editor</h1>
        <Link href="/" className="text-sm text-tape underline">
          View the book →
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Local-only. Write, proofread in the live preview, then publish to production.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {/* ---------- editor ---------- */}
        <section>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Chapter #</label>
              <input
                type="number"
                className={field}
                value={chapter}
                onChange={(e) => setChapter(Number(e.target.value))}
              />
            </div>
            <div>
              <label className={label}>Ticker</label>
              <input
                className={field}
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="AAPL"
              />
            </div>
            <div>
              <label className={label}>Company</label>
              <input className={field} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Apple" />
            </div>
            <div>
              <label className={label}>Chapter title</label>
              <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The first coat" />
            </div>
            <div>
              <label className={label}>Price / share</label>
              <input className={field} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="226.50" inputMode="decimal" />
            </div>
            <div>
              <label className={label}>Shares</label>
              <input className={field} value={shares} onChange={(e) => setShares(e.target.value)} placeholder="10" inputMode="decimal" />
            </div>
            <div>
              <label className={label}>Fill date &amp; time</label>
              <input type="datetime-local" className={field} value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
            <div>
              <label className={label}>Buy note (optional)</label>
              <input className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder="initial buy" />
            </div>
            <div className="col-span-2">
              <label className={label}>Exit test — what would make you sell?</label>
              <input className={field} value={exitTest} onChange={(e) => setExitTest(e.target.value)} placeholder="I will sell if…" />
            </div>
            <div className="col-span-2">
              <label className={label}>Broker proof image(s) in public/proofs/ (optional, comma-separated)</label>
              <input className={field} value={proofs} onChange={(e) => setProofs(e.target.value)} placeholder="ch01-fill.png" />
            </div>
          </div>

          <div className="mt-3">
            <label className={label}>The why (Markdown)</label>
            <textarea
              className={`${field} min-h-[280px] font-mono leading-relaxed`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={deploy} onChange={(e) => setDeploy(e.target.checked)} />
              Deploy live after publishing
            </label>
            <button
              onClick={publish}
              disabled={busy}
              className="rounded-full bg-home-orange-500 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "#F96302" }}
            >
              {busy ? "Publishing…" : "Publish to production"}
            </button>
          </div>

          {status.kind !== "idle" && (
            <div
              className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
                status.kind === "err"
                  ? "border-loss/40 bg-loss/5 text-loss"
                  : status.kind === "ok"
                    ? "border-gain/40 bg-gain/5 text-gain"
                    : "border-wall-dark bg-white text-ink-soft"
              }`}
            >
              <p className="font-semibold">{status.msg}</p>
              {status.log && status.log.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-ink-soft">
                  {status.log.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              )}
              {status.url && (
                <p className="mt-2">
                  Live at{" "}
                  <a href={status.url} target="_blank" rel="noreferrer" className="text-tape underline">
                    {status.url}
                  </a>
                </p>
              )}
            </div>
          )}

          {existing.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs uppercase tracking-wide text-ink-soft mb-2">Already published</h3>
              <div className="rounded-lg border border-wall-dark text-sm">
                {existing.map((c) => (
                  <div key={c.chapter} className="flex justify-between border-b border-wall px-3 py-1.5 last:border-0">
                    <span>Ch. {c.chapter} · <b>{c.ticker}</b> — {c.title}</span>
                    <span className="text-ink-soft">{c.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ---------- live preview ---------- */}
        <section className="lg:sticky lg:top-8 lg:self-start">
          <h3 className="text-xs uppercase tracking-wide text-ink-soft mb-2">Live preview — how the chapter will look</h3>
          <div className="rounded-lg border border-wall-dark bg-white p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <span className="text-sm uppercase tracking-widest text-ink-soft">Chapter {chapter || "—"}</span>
              <span className="rounded-full bg-tape/10 px-2 py-0.5 text-xs font-semibold text-tape">still drying</span>
            </div>
            <h2 className="mt-1 text-3xl font-bold">
              {company ? `${company} (${ticker || "—"})` : ticker || "Ticker"} — {title || "Chapter title"}
            </h2>

            <div className="mt-4 overflow-hidden rounded-lg border border-wall-dark text-sm">
              <div className="flex justify-between border-b border-wall px-4 py-2">
                <span>Buy{note ? ` — ${note}` : ""}</span>
                <span className="text-ink-soft">{fmtTs(iso)}</span>
                <span>
                  ${Number.isFinite(priceNum) ? priceNum.toFixed(2) : "0.00"} × {shares || 0}
                </span>
              </div>
              <div className="px-4 py-2 text-ink-soft">
                Cost basis: ${cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {exitTest && (
              <p className="mt-4 border-l-4 border-tape pl-4 italic text-ink-soft">
                The exit test, written on day one: “{exitTest}”
              </p>
            )}

            <article className="prose-book mt-6" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          </div>
        </section>
      </div>
    </main>
  );
}

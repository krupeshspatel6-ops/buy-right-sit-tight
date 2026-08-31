"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { marked } from "marked";
import { formatFillTime } from "@/lib/format";
import BrandMark from "@/components/BrandMark";

type Existing = { chapter: number; ticker: string; title: string; status: string };

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function nowLocalInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
  return iso ? formatFillTime(iso) : "—";
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
  const router = useRouter();
  const [chapter, setChapter] = useState(nextChapter);
  const [ticker, setTicker] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [logo, setLogo] = useState("");
  const [domain, setDomain] = useState("");
  const [when, setWhen] = useState(nowLocalInput());
  const [price, setPrice] = useState("");
  const [shares, setShares] = useState("");
  const [note, setNote] = useState("");
  const [exitTest, setExitTest] = useState("");
  const [proofs, setProofs] = useState("");
  const [body, setBody] = useState(BODY_SCAFFOLD);
  const [deploy, setDeploy] = useState(true);
  const [confirming, setConfirming] = useState(false);

  const [status, setStatus] = useState<
    { kind: "idle" | "busy" | "ok" | "err"; msg?: string }
  >({ kind: "idle" });

  const [ai, setAi] = useState<{ busy: boolean; text: string; mode: "improve" | "questions" | null; err?: string }>(
    { busy: false, text: "", mode: null }
  );

  const bodyHtml = useMemo(() => marked.parse(body || "") as string, [body]);
  const iso = toISOWithOffset(when);
  const priceNum = Number(price);
  const sharesNum = Number(shares);
  const cost = Number.isFinite(priceNum) && Number.isFinite(sharesNum) ? priceNum * sharesNum : 0;

  async function askAI(mode: "improve" | "questions") {
    setAi({ busy: true, text: "", mode });
    try {
      const res = await fetch("/api/admin/ai-assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, ticker, company, draft: body }),
      });
      const data = await res.json();
      if (data.ok) setAi({ busy: false, text: data.text || "", mode });
      else setAi({ busy: false, text: "", mode, err: data.error || "AI failed." });
    } catch (e) {
      setAi({ busy: false, text: "", mode, err: e instanceof Error ? e.message : "Network error." });
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  async function doPublish() {
    setConfirming(false);
    setStatus({ kind: "busy", msg: deploy ? "Publishing & deploying…" : "Publishing…" });
    try {
      const res = await fetch("/api/admin/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chapter,
          title,
          ticker,
          company,
          logo,
          domain,
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
        setStatus({ kind: "err", msg: data.error || "Publish failed." });
      } else {
        setStatus({
          kind: "ok",
          msg: `Published Chapter ${chapter} (${ticker}). Committed to GitHub${
            data.deployed ? " · deploying now (live in ~1 min)" : " · set a deploy hook to auto-deploy"
          }.`,
        });
      }
    } catch (e) {
      setStatus({ kind: "err", msg: e instanceof Error ? e.message : "Network error." });
    }
  }

  const busy = status.kind === "busy";
  const label = "block text-xs uppercase tracking-wide text-ink-soft mb-1";
  const field =
    "w-full rounded border border-wall-dark bg-white px-3 py-2 text-sm outline-none focus:border-tape";
  const sectionH = "mt-6 mb-2 text-sm font-bold text-ink first:mt-0";

  // Everything a chapter must have before it can be published.
  const missing: string[] = [];
  if (!ticker.trim()) missing.push("ticker");
  if (!(priceNum > 0)) missing.push("price");
  if (!(sharesNum > 0)) missing.push("shares");
  if (!iso) missing.push("fill date");
  if (!exitTest.trim()) missing.push("exit plan");
  if (!body.trim()) missing.push("the why");
  const canPublish = missing.length === 0;

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Chapter editor</h1>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-tape underline">
            View the book →
          </Link>
          <button onClick={logout} className="text-ink-soft underline">
            Sign out
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Write, proofread in the live preview, then publish to production.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {/* ---------- editor ---------- */}
        <section>
          {/* what each chapter needs from you */}
          <div className="rounded-lg border border-wall-dark bg-white px-4 py-3">
            <div className="text-xs font-bold uppercase tracking-wide text-ink-soft">
              What each chapter needs
            </div>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[13px] text-ink-soft">
              <li><b className="text-ink">The stock</b> — ticker, company, a chapter title</li>
              <li><b className="text-ink">The buy</b> — fill date &amp; time, price, shares, straight from your broker</li>
              <li><b className="text-ink">The exit plan</b> — what would make you sell <span className="font-semibold text-loss">(required)</span></li>
              <li><b className="text-ink">The why</b> — a few honest paragraphs <span className="font-semibold text-loss">(required)</span></li>
              <li><b className="text-ink">Proof</b> — a broker fill screenshot (optional)</li>
            </ul>
          </div>

          <h2 className={sectionH}>1 · The stock</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Chapter #</label>
              <input type="number" className={field} value={chapter} onChange={(e) => setChapter(Number(e.target.value))} />
            </div>
            <div>
              <label className={label}>Ticker *</label>
              <input className={field} value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="AAPL" />
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
              <label className={label}>Logo image URL (optional)</label>
              <input className={field} value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…/apple.png" />
            </div>
            <div>
              <label className={label}>…or company domain (auto logo)</label>
              <input className={field} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="apple.com" />
            </div>
          </div>

          <h2 className={sectionH}>2 · The buy</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Fill date &amp; time *</label>
              <input type="datetime-local" className={field} value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
            <div>
              <label className={label}>Buy note (optional)</label>
              <input className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder="initial buy" />
            </div>
            <div>
              <label className={label}>Price / share *</label>
              <input className={field} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="226.50" inputMode="decimal" />
            </div>
            <div>
              <label className={label}>Shares *</label>
              <input className={field} value={shares} onChange={(e) => setShares(e.target.value)} placeholder="10" inputMode="decimal" />
            </div>
          </div>

          <h2 className={sectionH}>
            3 · The exit plan <span className="text-loss">*</span>
          </h2>
          <label className={label}>What would make you sell? Written on day one — the pledge requires it.</label>
          <textarea
            className={`${field} min-h-[80px]`}
            value={exitTest}
            onChange={(e) => setExitTest(e.target.value)}
            placeholder="I will sell if… (be specific — e.g. 'if membership renewal rates fall below 90% for two straight years')"
          />

          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <label className={sectionH + " !mt-0 mb-0"}>
                4 · The why <span className="text-loss">*</span> <span className="font-normal text-ink-soft">(Markdown)</span>
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => askAI("questions")}
                  disabled={ai.busy}
                  className="rounded-full border border-tape px-3 py-1 text-xs font-semibold text-tape disabled:opacity-50"
                >
                  ❓ Help me start
                </button>
                <button
                  onClick={() => askAI("improve")}
                  disabled={ai.busy || !body.trim()}
                  className="rounded-full border border-tape px-3 py-1 text-xs font-semibold text-tape disabled:opacity-50"
                >
                  ✨ Improve my draft
                </button>
              </div>
            </div>
            <textarea
              className={`${field} min-h-[260px] font-mono leading-relaxed`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />

            {(ai.busy || ai.text || ai.err) && (
              <div className="mt-2 rounded-lg border border-wall-dark bg-white p-3 text-sm">
                <div className="mb-1 text-xs uppercase tracking-wide text-ink-soft">
                  {ai.mode === "questions" ? "Questions to think about" : "Suggested edit"} — your coach
                </div>
                {ai.busy ? (
                  <p className="text-ink-soft">Thinking…</p>
                ) : ai.err ? (
                  <p className="text-loss">{ai.err}</p>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap">{ai.text}</p>
                    {ai.mode === "improve" && (
                      <button
                        onClick={() => {
                          setBody(ai.text);
                          setAi({ busy: false, text: "", mode: null });
                        }}
                        className="mt-2 rounded-full bg-tape px-3 py-1 text-xs font-semibold text-white"
                      >
                        Use this
                      </button>
                    )}
                  </>
                )}
                <p className="mt-2 text-[11px] text-ink-soft">
                  Your coach only helps you say your own ideas better — it never invents reasons or gives advice.
                </p>
              </div>
            )}
          </div>

          <h2 className={sectionH}>5 · Proof (optional)</h2>
          <label className={label}>
            Broker fill screenshot(s) in public/proofs/ — comma-separated
          </label>
          <input
            className={field}
            value={proofs}
            onChange={(e) => setProofs(e.target.value)}
            placeholder="ch01-fill.png"
          />

          {!canPublish && (
            <p className="mt-4 text-sm text-loss">
              Still needed before publishing: <b>{missing.join(", ")}</b>.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={deploy} onChange={(e) => setDeploy(e.target.checked)} />
              Deploy live after publishing
            </label>
            <button
              onClick={() => setConfirming(true)}
              disabled={busy || !canPublish}
              title={canPublish ? "" : `Add: ${missing.join(", ")}`}
              className="rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "#F96302" }}
            >
              {busy ? "Publishing…" : "Publish to production"}
            </button>
          </div>

          {confirming && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <h3 className="text-lg font-bold text-loss">This is permanent.</h3>
                <p className="mt-3 text-sm leading-relaxed">
                  You&apos;re about to publish <b>Chapter {chapter} — {ticker}</b>. Once published,
                  this chapter is a public, timestamped commit that <b>can never be edited or
                  deleted — not even by you</b>. That permanence is the whole point of the book.
                </p>
                <p className="mt-2 text-sm text-ink-soft">
                  Read it over one more time. Corrections can only be <i>appended</i> later, dated,
                  below the original — never changed.
                </p>
                <div className="mt-5 flex justify-end gap-3">
                  <button
                    onClick={() => setConfirming(false)}
                    className="rounded-full border border-wall-dark px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={doPublish}
                    className="rounded-full px-4 py-2 text-sm font-semibold text-white"
                    style={{ backgroundColor: "#F96302" }}
                  >
                    Yes, publish forever
                  </button>
                </div>
              </div>
            </div>
          )}

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
            <div className="mt-1 flex items-center gap-3">
              <BrandMark ticker={ticker || "?"} logo={logo} domain={domain} size={40} />
              <h2 className="text-3xl font-bold">
                {company ? `${company} (${ticker || "—"})` : ticker || "Ticker"} — {title || "Chapter title"}
              </h2>
            </div>

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
              <div className="mt-4 border-l-4 border-tape pl-4 text-ink-soft">
                <div className="text-xs uppercase tracking-wide">The exit plan — written on day one</div>
                <p className="mt-1 whitespace-pre-line italic">{exitTest}</p>
              </div>
            )}

            <article className="prose-book mt-6" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          </div>
        </section>
      </div>
    </main>
  );
}

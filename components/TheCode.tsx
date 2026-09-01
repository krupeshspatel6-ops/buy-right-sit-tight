import Link from "next/link";
import { firstBuyDate, type Chapter } from "@/lib/chapters";
import { formatDate } from "@/lib/format";
import BrandMark from "@/components/BrandMark";

// The honest explainer for "the code" — the small system that flags many of the
// buys in this book. It never reveals the secret sauce, never claims the code
// makes money, and never invites anyone to follow the signals. Its whole
// argument is: the record is timestamped and never edited, so judge the code by
// its public track record, not by anyone's word.
export default function TheCode({ chapters }: { chapters: Chapter[] }) {
  const codeChapters = chapters.filter((c) => c.entry === "code");
  const total = chapters.length;

  return (
    <div className="prose-book max-w-none">
      <p className="text-sm uppercase tracking-widest text-ink-soft not-prose">The engine</p>
      <h2 className="!mt-1 text-2xl font-bold not-prose">The code</h2>

      <p>
        Most of the buys in this book don&apos;t start with a hunch. They start with a
        <b> signal from a small piece of software I&apos;ve been building</b> — I just call
        it &ldquo;the code.&rdquo; It watches for a particular kind of setup, and when one
        shows up, it flags it. If I agree after looking, I take a starter position and
        open a chapter.
      </p>

      <p>
        I&apos;m keeping <i>how</i> it works to myself for now — that part&apos;s still an
        experiment, and a half-baked recipe helps no one. What I&apos;m not keeping to
        myself is the <b>result of every single time it fired</b>, good or bad.
      </p>

      <h3 className="not-prose mt-6 text-lg font-bold">Why this is the honest way to test it</h3>
      <p>
        Anyone can claim they have a system that works. The claim is worthless — the
        record is everything. So here&apos;s the deal I&apos;ve made with myself:
      </p>
      <ul>
        <li>
          Every code-signalled buy opens a chapter <b>within 24 hours</b>, at the real
          price, with a timestamp.
        </li>
        <li>
          Each chapter is <b>anchored to the Bitcoin blockchain</b> (OpenTimestamps) and
          <b> never edited</b> after publishing. Nobody — not me — can backdate a win or
          quietly delete a loss.
        </li>
        <li>
          So the code&apos;s calls add up to a <b>public, tamper-proof track record</b>,
          just by this book existing. You don&apos;t have to trust me. You can check.
        </li>
      </ul>

      <div className="not-prose my-6 rounded-lg border-l-4 border-tape bg-white px-5 py-4 text-sm leading-relaxed text-ink-soft shadow-sm">
        <b className="text-ink">This is an experiment, not advice.</b> The code might be
        wrong — often. Not every chapter here is a code trade (some are copycat trades,
        some are my own conviction), and a signal is just how a buy <i>began</i>, never a
        recommendation to you. Please don&apos;t follow the signals. I&apos;m 15 and
        learning in public; watch the record and make up your own mind.
      </div>

      <h3 className="not-prose mt-8 text-lg font-bold">
        The code&apos;s calls so far
        <span className="ml-2 font-grotesk text-sm font-normal text-ink-soft">
          {codeChapters.length} of {total} chapter{total === 1 ? "" : "s"}
        </span>
      </h3>

      {codeChapters.length === 0 ? (
        <p className="text-ink-soft">No code-signalled buys published yet.</p>
      ) : (
        <div className="not-prose mt-2">
          {codeChapters.map((c) => (
            <Link
              key={c.slug}
              href={`/chapter/${c.slug}`}
              className="rule-dashed flex items-center gap-3 py-2.5 no-underline"
            >
              <span className="font-display text-[1.5rem] leading-none text-ink">
                {String(c.chapter).padStart(2, "0")}
              </span>
              <BrandMark ticker={c.ticker} logo={c.logo} domain={c.domain} size={22} />
              <span className="min-w-0 flex-1">
                <span className="font-grotesk block text-[14px] font-bold text-ink">
                  {c.ticker}
                  <span className="ml-1.5 font-normal text-ink-soft">
                    {c.company ? c.company : ""}
                  </span>
                </span>
                <span className="font-grotesk block text-[11px] text-ink-soft">
                  ⚡ code signal · {formatDate(firstBuyDate(c))}
                </span>
              </span>
              <span className="font-grotesk shrink-0 text-[12px] text-tape">read →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

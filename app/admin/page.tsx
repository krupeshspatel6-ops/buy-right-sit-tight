import Link from "next/link";
import { isAdminEnabled } from "@/lib/admin";
import { loadChapters } from "@/lib/chapters";
import AdminEditor from "@/components/AdminEditor";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

export default function AdminPage() {
  if (!isAdminEnabled()) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold">Admin is local-only</h1>
        <p className="mt-4 text-ink-soft leading-relaxed">
          The chapter editor runs only when you&apos;re working on your own
          computer — never on the live site. Run the project locally
          (<code>npm run dev</code>) and open{" "}
          <code>http://localhost:4000/admin</code>.
        </p>
        <p className="mt-6">
          <Link href="/" className="text-tape underline">
            ← Back to the book
          </Link>
        </p>
      </main>
    );
  }

  const chapters = loadChapters();
  const nextChapter = (chapters.reduce((m, c) => Math.max(m, c.chapter), 0) || 0) + 1;
  const existing = chapters.map((c) => ({
    chapter: c.chapter,
    ticker: c.ticker,
    title: c.title,
    status: c.status,
  }));

  return <AdminEditor nextChapter={nextChapter} existing={existing} />;
}

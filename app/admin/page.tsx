import Link from "next/link";
import { adminConfigured } from "@/lib/auth";
import { loadChapters } from "@/lib/chapters";
import AdminEditor from "@/components/AdminEditor";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

export default function AdminPage() {
  if (!adminConfigured()) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold">Admin isn&apos;t configured yet</h1>
        <p className="mt-4 text-ink-soft leading-relaxed">
          Set these environment variables (in Vercel, or a local <code>.env.local</code>) and
          redeploy: <code>ADMIN_USER</code>, <code>ADMIN_PASSWORD</code>, <code>SESSION_SECRET</code>,
          <code>GITHUB_TOKEN</code>, <code>VERCEL_DEPLOY_HOOK_URL</code>, and <code>ANTHROPIC_API_KEY</code>.
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

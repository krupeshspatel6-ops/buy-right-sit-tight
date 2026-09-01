import type { Metadata } from "next";
import Link from "next/link";
import { loadChapters } from "@/lib/chapters";
import TheCode from "@/components/TheCode";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "The code — Buy Right Sit Tight",
  description:
    "Many buys in this book start with a signal from a small system Krupesh built. Here's what it is — and why its public, timestamped, never-edited track record is the honest way to judge it.",
};

export default function TheCodePage() {
  const chapters = loadChapters();
  return (
    <main className="mx-auto max-w-3xl px-6 pt-12 pb-16">
      <Link href="/" className="text-sm text-tape underline">
        ← Table of contents
      </Link>
      <div className="mt-6">
        <TheCode chapters={chapters} />
      </div>
    </main>
  );
}

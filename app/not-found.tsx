import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm uppercase tracking-widest text-ink-soft">Page not found</p>
      <h1 className="mt-3 text-3xl font-bold">This page is still just primed wall.</h1>
      <p className="mt-4 text-ink-soft">
        There&apos;s nothing painted here yet. Head back to the book.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full border border-wall-dark bg-white px-5 py-2 text-sm font-semibold text-tape"
      >
        ← Back to the book
      </Link>
    </main>
  );
}

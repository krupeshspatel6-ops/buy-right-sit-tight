import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buy Right Sit Tight — watch the paint dry.",
  description:
    "A live book. Every stock I buy with my own money opens a new chapter, timestamped. A chapter only closes when I sell. Nothing is edited after publication.",
  metadataBase: new URL("https://buyrightsittight.com"),
  authors: [{ name: "Sarvesh Patel" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
        <footer className="mx-auto max-w-3xl px-6 py-10 text-sm text-ink-soft border-t border-wall-dark mt-16">
          <p className="mb-3">
            Title: Thomas Phelps. Tagline: Paul Samuelson. Sitting: me.
          </p>
          <p>
            This is a personal investing journal, not investment advice. I write
            about stocks I buy with my own money for my own reasons. Nothing here
            is a recommendation to buy or sell any security. Do your own research
            or talk to a licensed advisor.
          </p>
        </footer>
      </body>
    </html>
  );
}

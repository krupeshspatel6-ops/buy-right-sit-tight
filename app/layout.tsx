import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buy Right Sit Tight — watch the paint dry.",
  description:
    "A 15-year-old learning to invest in public, with his own saved money. Every stock I buy opens a timestamped chapter; a chapter only closes when I sell. A learning journal, not advice.",
  metadataBase: new URL("https://buyrightsittight.com"),
  authors: [{ name: "Krupesh Patel" }],
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
            This is a personal learning journal written by a 15-year-old
            beginner — not investment advice. I write about stocks I buy with my
            own saved money, through a custodian account, purely to learn.
            Nothing here is a recommendation to buy or sell any security, and I
            may well be wrong about all of it. Do your own research or talk to a
            licensed advisor.
          </p>
        </footer>
      </body>
    </html>
  );
}

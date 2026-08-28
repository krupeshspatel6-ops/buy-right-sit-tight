import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import Buddy from "@/components/Buddy";
import "./globals.css";

const TITLE = "Buy Right Sit Tight — watch the paint dry.";
const DESCRIPTION =
  "A 15-year-old learning to invest in public, with his own saved money. Every stock I buy opens a timestamped chapter; a chapter only closes when I sell. A learning journal, not advice.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL("https://buyrightsittight.com"),
  authors: [{ name: "Krupesh Patel" }],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://buyrightsittight.com",
    siteName: "Buy Right Sit Tight",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
        <footer className="mx-auto max-w-3xl px-6 py-10 text-sm text-ink-soft border-t border-wall-dark mt-16">
          <p>
            This is a personal learning journal written by a 15-year-old
            beginner — not investment advice. I write about stocks I buy with my
            own saved money, through a custodian account, purely to learn.
            Nothing here is a recommendation to buy or sell any security, and I
            may well be wrong about all of it. Do your own research or talk to a
            licensed advisor.
          </p>
        </footer>
        <Buddy />
        <Analytics />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Anton, Archivo } from "next/font/google";
import Buddy from "@/components/Buddy";
import "./globals.css";

// Display + label faces for the bold, editorial layer (numbers, chapter
// openers, chips). Prose stays Georgia serif — the book's voice.
const displayFont = Anton({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });
const groteskFont = Archivo({
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-grotesk",
  display: "swap",
});

const TITLE = "Buy Right Sit Tight — watch the paint dry.";
const DESCRIPTION =
  "Krupesh started this book at 15, learning to invest in public. Every stock I buy opens a timestamped chapter that's never edited; a chapter only closes when I sell. A learning journal, not advice.";

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
    <html lang="en" className={`${displayFont.variable} ${groteskFont.variable}`}>
      <body className="min-h-screen antialiased">
        {children}
        <footer className="mx-auto max-w-4xl px-6 py-3 text-center text-xs leading-snug text-ink-soft border-t border-wall-dark mt-3">
          <p className="mb-2">
            Want to reach Krupesh?{" "}
            <a href="mailto:hello@buyrightsittight.com" className="font-semibold text-tape underline">
              hello@buyrightsittight.com
            </a>{" "}
            — a parent reads this inbox first and moderates it (he started this book at 15), so replies may
            take a few days, and not every message gets one.
          </p>
          <p>
            Krupesh started this book at 15, and it&apos;s his personal learning journal —{" "}
            <b>not investment advice</b>. He buys real stocks in a custodian account to learn,
            and he will get
            things wrong; those mistakes stay on the page, on purpose. Nothing here is a
            recommendation — do your own research or talk to a licensed advisor.
          </p>
        </footer>
        <Buddy />
        <Analytics />
      </body>
    </html>
  );
}

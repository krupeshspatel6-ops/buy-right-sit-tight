"use client";

import { usePathname } from "next/navigation";

// The site-wide disclaimer footer. Hidden on the homepage, which is locked to a
// single non-scrolling screen and carries its own compact disclaimer inline.
export default function SiteFooter() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <footer className="mx-auto mt-3 max-w-4xl border-t border-wall-dark px-6 py-3 text-center text-xs leading-snug text-ink-soft">
      <p>
        A 15-year-old&apos;s personal learning journal — <b>not investment advice</b>. He
        buys stocks with his own saved money (custodian account) purely to learn; nothing
        here is a recommendation, and he may be wrong about all of it. Do your own research
        or talk to a licensed advisor.
      </p>
    </footer>
  );
}

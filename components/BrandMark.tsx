"use client";

import { useState } from "react";

// The company's brand mark shown next to a trade. Uses an explicit logo URL
// if given, else an auto logo from the domain; if the image is missing or
// fails to load, it falls back to a clean colored monogram of the ticker —
// so it never renders broken.

function monogramColor(ticker: string): string {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) % 360;
  return `hsl(${h} 45% 42%)`;
}

export default function BrandMark({
  ticker,
  logo,
  domain,
  size = 40,
}: {
  ticker: string;
  logo?: string;
  domain?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const src = logo || (domain ? `https://logo.clearbit.com/${domain}` : "");
  const showImg = src && !failed;
  const initials = ticker.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase() || "•";

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg"
      style={{
        width: size,
        height: size,
        background: showImg ? "#fff" : monogramColor(ticker),
        border: "1px solid rgba(38,36,31,0.12)",
      }}
      aria-hidden
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          style={{ fontSize: size * 0.4 }}
          className="font-bold text-white"
        >
          {initials}
        </span>
      )}
    </span>
  );
}

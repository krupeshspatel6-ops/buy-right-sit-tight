# Buy Right Sit Tight

**buyrightsittight.com** — a live book. Every stock bought with real money
opens a timestamped chapter; a chapter only closes on a sell. Free, public,
no monetization — this exists for credibility, not revenue.

Title: Thomas Phelps (*100 to 1 in the Stock Market*). Tagline: Paul
Samuelson ("watching paint dry"). Sitting: Sarvesh.

## The pledge (the product)

1. Every real-money buy appears within 24 hours. No exceptions, no deletions.
2. Chapters are never edited after publication — corrections are appended, dated.
3. Every chapter states on day one what would trigger a sell (the "exit test").
4. Scoreboard = cost-weighted return vs SPY over the same windows, always visible.
5. The book has exactly **100 chapters** — a lifetime punch card. Every buy
   spends a slot. A budget, not a quota: no deadline, blank slots are fine.
   The homepage wall fills 1% per chapter.

## How to publish a chapter (the whole workflow)

1. Buy the stock. Screenshot the fill.
2. Copy `chapters/_TEMPLATE.md` → `chapters/NN-ticker.md`, fill in the
   frontmatter (exact fill time, price, shares) and write the "why".
3. Commit + push to the **public** GitHub repo (public commit history =
   timestamp witness #1).
4. Same day, mirror the chapter via a Substack email send and/or an X post
   linking it (un-editable third-party timestamps = witness #2). Attach the
   broker screenshot there.
5. Add-on buys of the same stock = new `buys:` entries in the same file.
   A sell = uncomment the `sell:` block. That closes the chapter.

## Stack

Next.js (App Router) + Tailwind v4. Chapters are markdown files in
`chapters/` — no database. Prices come from Yahoo Finance's public chart
API (free, no key) with 1-hour revalidation; if it's down the site renders
with "—" in the performance cells.

```powershell
npm install
npm run dev        # http://localhost:4000
npm run typecheck  # must pass before committing
```

## Deploy

Vercel + the buyrightsittight.com domain. Chapters publish by git push.
The photo: save as `public/sitting.jpg` (man, folding chair, half-painted
wall, mug). Annual tradition: same chair, same wall, new photo every
anniversary.

## Not advice

Personal journal, not investment advice. The disclaimer renders in the
site footer on every page — keep it there.

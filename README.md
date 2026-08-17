# Buy Right Sit Tight

**buyrightsittight.com** — a live book. Every stock bought with real money
opens a timestamped chapter; a chapter only closes on a sell. Free, public,
no monetization — this exists for credibility, not revenue.

Title: Thomas Phelps (*100 to 1 in the Stock Market*). Tagline: Paul
Samuelson ("watching paint dry"). Sitting: Krupesh.

## The pledge (the product)

1. Every real-money buy appears within 24 hours. No exceptions, no deletions.
2. Chapters are never edited after publication — corrections are appended, dated.
3. Every chapter states on day one what would trigger a sell (the "exit test").
4. Scoreboard = cost-weighted return vs SPY over the same windows, always visible.
5. The book has exactly **100 chapters** — a lifetime punch card. Every buy
   spends a slot. A budget, not a quota: no deadline, blank slots are fine.
   The homepage wall fills 1% per chapter.

## How to publish a chapter (the easy way)

1. Buy the stock. Screenshot the fill (save it to `public/proofs/` if you
   want it shown).
2. Run the guided publisher and answer the questions:

   ```
   npm run new-chapter
   ```

   It asks for the ticker, company, price, shares, the fill time (Enter =
   now), your exit test, and why you bought — then writes a correctly
   formatted `chapters/NN-ticker.md`, shows you a preview, and (if you say
   yes) commits + pushes it. Git stays the public, timestamped record.
3. Same day, mirror the chapter via a Substack email send and/or an X post
   linking it (un-editable third-party timestamps = witness #2). Attach the
   broker screenshot there.

### Doing it by hand (or appending later)

- New chapter by hand: copy `chapters/_TEMPLATE.md` → `chapters/NN-ticker.md`
  and fill it in.
- **Add-on buys** of the same stock = new `buys:` entries in the same file.
- **A sell** = uncomment the `sell:` block. That closes the chapter.
- **Quarterly notes / splits / hedges** = append dated lines below the
  "record continues" line. Never edit the original text above it.

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

# Buy Right Sit Tight

**buyrightsittight.com** — a live book. Every stock bought with real money
opens a timestamped chapter; a chapter only closes on a sell. Free, public,
no monetization — this exists for credibility, not revenue.

## The pledge (the product)

1. Every real-money buy appears within 24 hours. No exceptions, no deletions.
2. Chapters are never edited after publication — corrections are appended, dated.
3. Every chapter states on day one what would trigger a sell (the "exit test").
4. Each chapter shows the position's own return so far and a candlestick chart
   from the buy date — real prices, tracked automatically, never typed by hand.
5. **No fixed number of chapters and no finish line** — a new one opens for
   every buy, for as long as Krupesh keeps investing. The homepage wall keeps
   getting painted with each chapter but never quite fills; there's always more
   wall.

## The admin editor (local only)

Run the site locally and open **http://localhost:4000/admin** for a web
editor with a live preview:

- Fill the fields (ticker, price, shares, fill time, exit test) and write
  the "why" in Markdown.
- The right pane shows a **live preview** of exactly how the chapter will
  look — proofread it there.
- **Publish to production** writes the chapter file, commits + pushes to
  GitHub, and (optionally) deploys the live site.

It is **local-only by design**: the `/admin` route is disabled on the
deployed site (Vercel's filesystem is read-only, and a public publish
surface would undermine the git-backed record). Publishing still goes
through git, so every chapter stays a public, timestamped commit.

## How to publish a chapter (the CLI way)

1. Buy the stock. Screenshot the fill (save it to `public/proofs/` if you
   want it shown).
2. Run the guided publisher and answer the questions:

   ```
   npm run new-chapter
   ```

   It asks for the ticker, company, price, shares, the fill time (Enter =
   now), and your exit test. For the **"why" (the actual writing)** it offers
   two ways:

   - **Editor (recommended):** it creates the chapter file with a guided
     scaffold and opens it in VS Code (or your default editor). You write the
     "why" there in Markdown — headings, **bold**, lists, links, images — save,
     and press Enter back in the terminal.
   - **Terminal:** type the "why" line by line (fine for something short).

   Then it previews the finished chapter and, if you say yes, commits + pushes
   it. Git stays the public, timestamped record.

The chapter body is plain **Markdown**, so you can also just open any
`chapters/*.md` in VS Code and write/edit it directly (with live preview),
or edit it on github.com from any device — every save there is a public,
timestamped commit.
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

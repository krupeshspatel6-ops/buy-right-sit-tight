#!/usr/bin/env node
// Guided chapter publisher for Buy Right Sit Tight.
//
//   npm run new-chapter
//
// Asks for the details of a buy, writes a correctly-formatted chapter file
// into chapters/, previews it, and (if you confirm) commits + pushes so git
// stays the timestamped, public record. It never edits an existing chapter.

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CHAPTERS_DIR = path.join(ROOT, "chapters");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// Robust line reader: buffers lines as they arrive (works with piped stdin
// AND interactive typing), instead of rl.question which drops piped lines.
const lineQueue = [];
const waiters = [];
let inputClosed = false;
rl.on("line", (l) => {
  if (waiters.length) waiters.shift()(l);
  else lineQueue.push(l);
});
rl.on("close", () => {
  inputClosed = true;
  while (waiters.length) waiters.shift()(null);
});
function nextLine() {
  if (lineQueue.length) return Promise.resolve(lineQueue.shift());
  if (inputClosed) return Promise.resolve(null);
  return new Promise((res) => waiters.push(res));
}
async function ask(q) {
  if (q) process.stdout.write(q);
  const line = await nextLine();
  return (line ?? "").trim();
}

// A multi-line prompt: keep reading until a line that is exactly "END".
async function askBlock(q) {
  console.log(q + "  (type END on its own line when done)");
  const lines = [];
  for (;;) {
    const line = await nextLine();
    if (line === null || line === "END") break;
    lines.push(line);
  }
  return lines.join("\n").trim();
}

// ISO 8601 with the machine's local UTC offset (so the fill time keeps its zone).
function localISO(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const oh = pad(Math.floor(Math.abs(off) / 60));
  const om = pad(Math.abs(off) % 60);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${oh}:${om}`
  );
}

function nextChapterNumber() {
  if (!fs.existsSync(CHAPTERS_DIR)) return 1;
  let max = 0;
  for (const file of fs.readdirSync(CHAPTERS_DIR)) {
    if (!file.endsWith(".md") || file.startsWith("_") || file.startsWith("00-")) continue;
    try {
      const { data } = matter(fs.readFileSync(path.join(CHAPTERS_DIR, file), "utf8"));
      const n = Number(data.chapter);
      if (Number.isFinite(n)) max = Math.max(max, n);
    } catch {
      /* ignore unparseable files */
    }
  }
  return max + 1;
}

async function askNumber(q) {
  for (;;) {
    const raw = await ask(q);
    const n = Number(raw.replace(/[$,]/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
    console.log("  Please enter a number greater than 0.");
  }
}

// Assemble the chapter file exactly like chapters/_TEMPLATE.md expects.
function buildChapter({ num, title, ticker, company, date, price, shares, note, proofs, exitTest, body }) {
  return [
    "---",
    `chapter: ${num}`,
    `title: ${JSON.stringify(title)}`,
    `ticker: ${ticker}`,
    ...(company ? [`company: ${JSON.stringify(company)}`] : []),
    "buys:",
    `  - date: "${date}"`,
    `    price: ${price}`,
    `    shares: ${shares}`,
    ...(note ? [`    note: ${JSON.stringify(note)}`] : []),
    ...(proofs.length ? ["proofs:", ...proofs.map((p) => `  - ${p}`)] : []),
    `exitTest: ${JSON.stringify(exitTest || "TODO: write what would make you sell.")}`,
    "---",
    "",
    body,
    "",
    "> The record continues below this line — append-only, each entry dated.",
    "> The original text above is never touched. Quarterly checks, splits,",
    "> dividends, and any options hedge on this position go here.",
    "",
  ].join("\n");
}

// Best-effort open in the user's editor: VS Code if present, else the OS default.
function openFile(file) {
  const q = `"${file}"`;
  const code = spawnSync(`code ${q}`, { stdio: "ignore", shell: true });
  if (!code.error && code.status === 0) return "code";
  const cmd =
    process.platform === "win32"
      ? `start "" ${q}`
      : process.platform === "darwin"
        ? `open ${q}`
        : `xdg-open ${q}`;
  spawnSync(cmd, { stdio: "ignore", shell: true });
  return "default";
}

async function main() {
  console.log("\n📖  New chapter — a stock you just bought with your own money.\n");

  const num = nextChapterNumber();
  const usedSlots = num - 1;
  console.log(`This will be Chapter ${num} of 100.  (${100 - usedSlots} slots left after it.)\n`);

  const ticker = (await ask("Ticker symbol (e.g. AAPL): ")).toUpperCase().replace(/[^A-Z.]/g, "");
  if (!ticker) {
    console.log("A ticker is required. Nothing written.");
    rl.close();
    return;
  }
  const company = await ask("Company name (e.g. Apple): ");
  const title = (await ask('Chapter title (a short name, e.g. "The first coat"): ')) || "Untitled";

  const price = await askNumber("Price per share you paid (e.g. 226.50): $");
  const shares = await askNumber("How many shares: ");
  const note = await ask("Short note on this buy (optional, e.g. 'initial buy'): ");

  const whenRaw = await ask("Fill date & time — press Enter for right now, or paste an ISO time: ");
  const date = whenRaw || localISO();

  console.log("");
  const exitTest = await ask("The exit test — what, decided today, would make you sell? ");

  const proofRaw = await ask(
    "Broker proof image filename(s) in public/proofs/, comma-separated (optional): "
  );
  const proofs = proofRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((f) => (f.startsWith("/") ? f : `/proofs/${f}`));

  // The "why" is real writing — an editor beats the terminal for it.
  console.log("");
  const method = (
    await ask("Write your 'why' in an [E]ditor (recommended) or the [T]erminal? [E/t] ")
  ).toLowerCase();
  const useTerminal = method === "t" || method === "terminal";

  let body;
  if (useTerminal) {
    console.log("");
    body = await askBlock("Why did you buy it? Write a few honest sentences.");
  } else {
    // A guided scaffold the writer fills in and then deletes the prompts from.
    body =
      `Write why you bought ${ticker} here — a few honest paragraphs.\n\n` +
      "Guiding questions (delete these lines as you answer them):\n\n" +
      "- What does the company do, in your own words?\n" +
      "- Why do you think it's worth owning for a long time?\n" +
      "- Why was the price you paid a fair price?\n" +
      "- What could go wrong — the bear case?";
  }

  const slug = `${String(num).padStart(2, "0")}-${ticker.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  const filePath = path.join(CHAPTERS_DIR, `${slug}.md`);

  if (fs.existsSync(filePath)) {
    console.log(`\n⚠  ${slug}.md already exists. Aborting so nothing is overwritten.`);
    rl.close();
    return;
  }

  const fm = buildChapter({ num, title, ticker, company, date, price, shares, note, proofs, exitTest, body });

  // Preview the numbers so a typo in price/shares gets caught before writing.
  console.log("\n────────── the chapter so far ──────────");
  console.log(fm);
  console.log("────────────────────────────────────────\n");

  const ok = (await ask(`Create chapters/${slug}.md ? (Y/n) `)).toLowerCase();
  if (ok === "n" || ok === "no") {
    console.log("Cancelled. Nothing written.");
    rl.close();
    return;
  }

  fs.writeFileSync(filePath, fm, "utf8");
  console.log(`\n✓ Created chapters/${slug}.md`);

  if (!useTerminal) {
    const how = openFile(filePath);
    console.log(
      how === "code"
        ? "\n📝 Opened it in VS Code. Write your 'why' in the file, SAVE it, then come back here."
        : `\n📝 Opening the file in your editor. Write your 'why', SAVE it, then come back here.\n   (If nothing opened, open chapters/${slug}.md yourself.)`
    );
    await ask("\nPress Enter once you've written and saved it… ");
  }

  // Re-read from disk so the final look reflects whatever was written.
  console.log("\n────────── final chapter ──────────");
  console.log(fs.readFileSync(filePath, "utf8"));
  console.log("────────────────────────────────────\n");

  const push = (await ask("Commit and push it now? (y/N) ")).toLowerCase();
  if (push === "y" || push === "yes") {
    try {
      execSync(`git add "${filePath}"`, { cwd: ROOT, stdio: "inherit" });
      const msg = `Chapter ${num}: ${ticker}${company ? ` (${company})` : ""} — ${title}`;
      execSync(`git commit -m "${msg.replace(/"/g, "'")}"`, { cwd: ROOT, stdio: "inherit" });
      execSync(`git push`, { cwd: ROOT, stdio: "inherit" });
      console.log("\n✓ Pushed. The chapter is now a public, timestamped commit.");
    } catch {
      console.log("\n⚠ Git step failed. The file is written — commit it manually when ready.");
    }
  } else {
    console.log("\nFile written but not committed. Commit it when you're ready:");
    console.log(`  git add "chapters/${slug}.md" && git commit -m "Chapter ${num}: ${ticker}" && git push`);
  }

  console.log(
    "\n📌 Don't forget the pledge: within 24 hours, also mirror this chapter to\n" +
      "   Substack or X (with your broker screenshot) so there's an un-editable\n" +
      "   third-party timestamp. That's what makes the record provable later.\n"
  );
  rl.close();
}

main().catch((e) => {
  console.error(e);
  rl.close();
  process.exit(1);
});
